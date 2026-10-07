// Data parts (the app's DataTable, Pagination, EmptyState, Skeleton, Progress, Address, TokenAvatar, Sol, FiatSub,
// Pnl). Classes live in css/widgets.css.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var icon = SJ.dom.icon;
  var cx = SJ.dom.cx;

  // ---- SOL, EUR and P&L values

  var SOL_MARK = '<polygon points="4.5,0 18,0 13.5,3.4 0,3.4"/><polygon points="0,5.3 13.5,5.3 18,8.7 4.5,8.7"/><polygon points="4.5,10.6 18,10.6 13.5,14 0,14"/>';

  /** The SOL unit as the monochrome Solana mark, muted (or the parent's colour with `inherit`). Read as "SOL". */
  function solIcon(o) {
    var opts = o || {};
    var holder = document.createElement("template");
    holder.innerHTML = '<svg viewBox="0 0 18 14" aria-hidden="true" focusable="false">' + SOL_MARK + "</svg>";
    return h("span", { class: cx("sol-icon", opts.inherit && "is-inherit", opts.className) }, holder.content.firstChild, h("span", { class: "sr-only", text: "SOL" }));
  }

  /** An amount followed by the SOL mark. */
  function solAmount(text, className) {
    return h("span", { class: cx("sol-amount", className) }, text, solIcon());
  }

  /** A formatted string; a trailing " SOL" becomes the mark, anything else ("—") is shown as is. */
  function solText(text, className) {
    if (!/ SOL$/.test(text)) return h("span", { class: className, text: text });
    return solAmount(text.slice(0, -4), className);
  }

  /** The EUR line under a SOL amount: `(€12.30)`, muted or in the P&L colour; nothing when unknown. */
  function fiatSub(value, tone, className) {
    if (value === null || value === undefined) return null;
    return h("span", { class: cx("fiat-sub", tone && SJ.ui.TONE_TEXT[tone], tone && "is-toned", className) },
      h("span", { class: "sr-only", text: "EUR at trade time " }), "(" + value + ")");
  }

  /**
   * Signed, coloured amount such as `+0.4000 SOL`. `sign` is the value's sign (−1, 0, 1), taken from the final
   * value; null renders a muted "—". o: { value, sign, unit ("SOL" | other | ""), neutral, className }
   */
  function pnlValue(o) {
    if (o.sign === null || o.sign === undefined) return h("span", { class: cx("font-mono text-muted", o.className), text: "—" });
    var unit = o.unit === undefined ? "SOL" : o.unit;
    var tone = o.neutral ? "neutral" : SJ.ui.toneOf(o.sign);
    return h("span", { class: cx("pnl", SJ.ui.TONE_TEXT[tone], o.className) }, o.value,
      unit === "SOL" ? solIcon({ inherit: true }) : unit && h("span", { class: "pnl-unit", text: unit }));
  }

  /** A P&L in BigInt lamports: formatted signed to 4 dp, coloured by its own sign. */
  function pnl(lamports, o) {
    var opts = o || {};
    return pnlValue({ value: SJ.format.sol(lamports, { signed: true, decimals: opts.decimals }), sign: SJ.format.signOf(lamports), unit: opts.unit, className: opts.className });
  }

  // ---- Table and pagination

  function sortIcon(sort) {
    return icon(sort === "asc" ? "arrow-up" : sort === "desc" ? "arrow-down" : "arrow-up-down", sort ? null : "is-unsorted");
  }

  /**
   * Dense table with a sticky header. o: { caption, columns, rows, rowKey, mobileCard, empty, highlight }
   * column: { key, header, cell(row) → node | string, align, numeric, sort ("asc"|"desc"|null), onSort, className }
   */
  function dataTable(o) {
    if (o.rows.length === 0 && o.empty) return o.empty;
    var alignOf = function (c) { return c.align || (c.numeric ? "right" : "left"); };
    var head = h("tr", null, o.columns.map(function (c) {
      return h("th", { scope: "col", class: alignOf(c) !== "left" && "align-" + alignOf(c), "aria-sort": c.sort === "asc" ? "ascending" : c.sort === "desc" ? "descending" : null },
        c.onSort ? h("button", { type: "button", class: "sort-button", "data-refocus": "sort-" + c.key, onclick: c.onSort }, c.header, sortIcon(c.sort || null)) : c.header);
    }));
    var body = o.rows.map(function (row) {
      return h("tr", { "data-key": o.rowKey(row), class: o.highlight && o.highlight(row) ? "is-highlight" : null }, o.columns.map(function (c) {
        return h("td", { class: cx(alignOf(c) !== "left" && "align-" + alignOf(c), c.numeric && "num", c.className) }, c.cell(row));
      }));
    });
    var table = h("div", { class: cx("table-wrap", o.mobileCard && "has-cards") },
      h("table", { class: "table" }, h("caption", { class: "sr-only", text: o.caption }), h("thead", null, head), h("tbody", null, body)));
    if (!o.mobileCard) return table;
    return h("div", null, table, h("ul", { class: "row-cards", "aria-label": o.caption }, o.rows.map(function (row) { return h("li", null, o.mobileCard(row)); })));
  }

  /** Page numbers around the current one, with gaps as null: 1 … 4 5 6 … 12. */
  function pageList(page, count) {
    var wanted = [1, count, page - 1, page, page + 1].filter(function (p, i, all) { return p >= 1 && p <= count && all.indexOf(p) === i; });
    wanted.sort(function (a, b) { return a - b; });
    var out = [];
    wanted.forEach(function (p, i) {
      if (i > 0 && p - wanted[i - 1] > 1) out.push(null);
      out.push(p);
    });
    return out;
  }

  /** "Showing x–y of n" + prev / numbers / next. o: { page, pageCount, pageSize, total, onPage(page), noun } */
  function pagination(o) {
    var from = o.total === 0 ? 0 : (o.page - 1) * o.pageSize + 1;
    var to = Math.min(o.total, o.page * o.pageSize);
    var square = function (current) { return cx("btn btn-sm", current ? "btn-primary" : "btn-secondary"); };
    var arrow = function (target, label, name) {
      var off = target < 1 || target > o.pageCount;
      return h("li", null, h("button", { type: "button", class: square(false), "aria-label": label, "aria-disabled": off ? "true" : null, disabled: off, onclick: function () { o.onPage(target); } }, icon(name)));
    };
    return h("nav", { "aria-label": "Pagination", class: "pagination" },
      h("p", { class: "text-body-sm text-muted" }, "Showing ", h("span", { class: "font-mono text-fg", text: from + "–" + to }), " of ", h("span", { class: "font-mono text-fg", text: String(o.total) }), " " + (o.noun || "items")),
      o.pageCount > 1 && h("ul", null,
        arrow(o.page - 1, "Previous page", "chevron-left"),
        pageList(o.page, o.pageCount).map(function (p) {
          if (p === null) return h("li", { class: "page-gap", "aria-hidden": "true", text: "…" });
          return h("li", null, h("button", { type: "button", class: square(p === o.page), "aria-label": "Page " + p, "aria-current": p === o.page ? "page" : null, onclick: function () { o.onPage(p); } }, String(p)));
        }),
        arrow(o.page + 1, "Next page", "chevron-right")));
  }

  // ---- Empty, loading, progress

  /** o: { icon, title, body, action } */
  function emptyState(o) {
    return h("div", { class: "empty" }, o.icon && icon(o.icon), h("p", { class: "text-title-sm text-fg", text: o.title }),
      o.body && h("p", { class: "text-body-sm" }, o.body), o.action && h("div", { class: "empty-action" }, o.action));
  }

  /** Placeholder block; a lighter band sweeps across it (transform only). */
  function skeleton(style) {
    return h("div", { class: "skeleton", "aria-hidden": "true", style: style });
  }

  /** A group of skeletons announced once. */
  function skeletonGroup(label, children) {
    return h("div", { role: "status", "aria-busy": "true", "aria-label": label || "Loading", class: "skeleton-stack" }, children);
  }

  /** 6 px bar, value 0–100. tone: accent (default) | profit | loss. The fill scales, it never changes width. */
  function progress(o) {
    var pct = Math.max(0, Math.min(100, o.value));
    return h("div", { role: "progressbar", "aria-label": o.label, "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(Math.round(pct)), class: cx("progress", o.tone && "progress-" + o.tone) },
      h("div", { class: "progress-fill", style: "transform: scaleX(" + pct / 100 + ")" }));
  }

  // ---- Address and token avatar

  /**
   * Truncated mono address with a copy button. o: { value, label, full, explorer }. In the demo the explorer button
   * is shown but never leaves the page (every address here is invented).
   */
  function address(o) {
    var label = o.label || "address";
    var copy = h("button", { type: "button", class: "address-button", "aria-label": "Copy " + label }, icon("copy"));
    copy.addEventListener("click", function () {
      var done = function () {
        SJ.dom.clear(copy).appendChild(icon("check", "text-profit"));
        copy.setAttribute("aria-label", "Copied");
        setTimeout(function () {
          SJ.dom.clear(copy).appendChild(icon("copy"));
          copy.setAttribute("aria-label", "Copy " + label);
        }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(o.value).then(done, function () {});
    });
    return h("span", { class: "address" },
      h("span", { title: o.value, class: o.full ? "address-full" : null, text: o.full ? o.value : SJ.format.shortAddress(o.value) }),
      copy,
      o.explorer && h("button", { type: "button", class: "address-button", "aria-label": "Open " + label + " in explorer", title: "In the live app this opens the block explorer", onclick: o.explorer }, icon("external-link")));
  }

  /** 32 px square with two-letter initials; the border is tinted by outcome. o: { symbol, outcome, size (md|lg) } */
  function tokenAvatar(o) {
    var initials = (o.symbol || "?").replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "?";
    return h("span", { "aria-hidden": "true", class: cx("avatar", o.size === "lg" && "avatar-lg", o.outcome && "avatar-" + o.outcome), text: initials });
  }

  /** The closed "Under the hood" disclosure: technical text plus an optional code excerpt with its file path. */
  function hood(technical, code) {
    return h("details", { class: "hood" },
      h("summary", { class: "hood-summary text-body-sm" }, icon("chevron-right", "hood-chevron"), "Under the hood"),
      h("div", { class: "hood-body" },
        h("p", { class: "text-body-sm", text: technical }),
        code && h("figure", { class: "code" },
          h("figcaption", { class: "code-label text-data-xs", text: code.label }),
          h("pre", null, h("code", { class: "text-data-xs", text: code.lines.join("\n") })))));
  }

  Object.assign(SJ.ui, {
    solIcon: solIcon, solAmount: solAmount, solText: solText, fiatSub: fiatSub, pnlValue: pnlValue, pnl: pnl,
    dataTable: dataTable, pageList: pageList, pagination: pagination,
    emptyState: emptyState, skeleton: skeleton, skeletonGroup: skeletonGroup, progress: progress,
    address: address, tokenAvatar: tokenAvatar, hood: hood,
  });
})();
