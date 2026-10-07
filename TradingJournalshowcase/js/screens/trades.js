// Trades (#/trades, app/(app)/trades): filters in the hash query, summary strip for the current filters, sortable
// table, 50 rows a page and a simulated CSV export. The list logic lives in SJ.tradeList.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var f = SJ.format;
  var L = SJ.tradeList;
  var A = SJ.explain.anchor;
  var DESCRIPTION = "Every rebuilt position, newest first unless sorted. Grade and reflect on execution.";

  var options = function (labels) { return Object.keys(labels).map(function (k) { return { value: k, label: labels[k] }; }); };
  var byName = function (kind) {
    return S().vocab(kind, { includeArchived: true }).map(function (v) { return { value: v.id, label: v.name }; })
      .sort(function (a, b) { return a.label.localeCompare(b.label); });
  };
  var S = function () { return SJ.store; };

  function exportCsv(params, total) {
    var button = ui.button({ label: "Export CSV", icon: "download", size: "sm", attrs: { "data-refocus": "export-csv" } });
    button.addEventListener("click", function () {
      button.disabled = true;
      SJ.sim.run({
        action: "CSV export", success: "CSV export ready", steps: ["Query trades", "Write CSV"], ms: 900,
        live: "the server writes all " + total + " matching trades, with these filters and this order, to a CSV file your browser downloads. Nothing is stored.",
      }).then(function () { button.disabled = false; });
    });
    return A(button, "trades-export");
  }

  function header(params, total) {
    return h("header", { class: "page-header" },
      h("div", null,
        h("div", { class: "detail-title-row" }, h("h1", { class: "text-headline-lg", tabindex: "-1", text: "Trades" }), A(ui.badge(total + " position" + (total === 1 ? "" : "s")), "trades-count")),
        h("p", { class: "text-body-sm text-muted", text: DESCRIPTION })),
      total > 0 && exportCsv(params, total));
  }

  /** A plain form, like the app's GET form: Apply writes the filters into the hash, so a filtered list can be bookmarked. */
  function filters(params) {
    var input = function (label, name, cls, extra) { return ui.input(Object.assign({ label: label, value: params[name] || "", className: cls, attrs: { name: name } }, extra)); };
    var select = function (label, name, opts, cls, placeholder) { return ui.select({ label: label, options: opts, placeholder: placeholder || "All", value: params[name] || "", className: cls, attrs: { name: name } }); };
    var form = h("form", { class: "filter-form", "aria-label": "Filter trades" },
      input("Token", "q", "is-wide is-search", { search: true, placeholder: "Symbol, name or mint", attrs: { name: "q", maxlength: "64" } }),
      input("Opened from", "from", "is-date", { attrs: { name: "from", type: "date" } }),
      input("Opened to", "to", "is-date", { attrs: { name: "to", type: "date" } }),
      select("Strategy", "strategy", byName("strategies")),
      select("Tag", "tag", byName("tags")),
      select("Grade", "grade", options(L.GRADES), "is-short"),
      select("Outcome", "outcome", options(L.OUTCOME)),
      select("Status", "status", options(L.STATUS)),
      select("Hold time", "hold", L.HOLD.map(function (r, i) { return { value: String(i), label: r.label }; }), null, "Any"),
      select("Entry venue", "venue", options(L.VENUE)),
      select("Reviewed", "reviewed", options(L.REVIEWED)),
      select("Rules", "rules", options(L.RULES)),
      input("Net P&L min (SOL)", "pnlMin", "is-pnl", { placeholder: "-0.5", attrs: { name: "pnlMin", inputmode: "decimal" } }),
      input("Net P&L max (SOL)", "pnlMax", "is-pnl", { placeholder: "1", attrs: { name: "pnlMax", inputmode: "decimal" } }),
      // Applying filters keeps the order; on phones (no table headers) these are the only sort control.
      select("Sort by", "sort", options(L.SORT).filter(function (o) { return o.value !== "opened_at"; }), null, "Opened"),
      select("Order", "dir", [{ value: "asc", label: L.DIR.asc }], "is-order", L.DIR.desc),
      h("button", { type: "submit", class: "btn btn-secondary is-wide", "data-refocus": "filters-apply", text: "Apply" }));
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var query = new URLSearchParams();
      Array.prototype.forEach.call(form.elements, function (el) { if (el.name && el.value) query.set(el.name, el.value); });
      window.location.hash = L.href(L.parse(query.toString()));
    });
    var active = L.activeFilters(params);
    return A(h("div", { class: "filter-bar" }, form,
      active.length > 0 && h("div", { class: "filter-active" },
        h("span", { class: "text-label-sm text-muted uppercase", text: "Active" }),
        active.map(function (a) {
          var patch = {};
          patch[a.key] = undefined;
          patch.page = undefined;
          return h("a", { class: "filter-chip", href: L.href(params, patch), "aria-label": "Remove filter " + a.label + ": " + a.value },
            h("span", { class: "text-muted", text: a.label + ":" }), " " + a.value, SJ.dom.icon("x"));
        }),
        h("a", { class: "btn btn-ghost btn-sm", href: "#/trades", text: "Clear all" }))), "trades-filters");
  }

  /** Net P&L, win rate (decided trades) and rule compliance (reviewed trades) of every matching trade, all pages. */
  function strip(s) {
    var decided = s.wins + s.losses;
    return A(ui.card({ label: "Summary of the filtered trades", padding: "none", className: "summary-strip" }, [
      ui.statCard({ compact: true, label: "Net P&L", value: f.sol(s.netPnl, { signed: true }), unit: "SOL", tone: ui.toneOf(f.signOf(s.netPnl)), delta: "Decided trades" }),
      ui.statCard({ compact: true, label: "Win rate", value: f.rate(s.winRate), unit: s.winRate === null ? null : "%", delta: decided === 0 ? "No wins or losses" : s.wins + " W / " + s.losses + " L" }),
      ui.statCard({ compact: true, label: "Rule compliance", value: f.rate(s.compliance), unit: s.compliance === null ? null : "%", delta: s.reviewed === 0 ? "No reviewed trades" : s.reviewed + " reviewed" }),
    ]), "trades-strip");
  }

  function table(params, list) {
    var node = SJ.tradeTable.table({
      rows: list.rows, timeZone: S().settings().timeZone,
      sort: { current: list.sort, onSort: function (key) { window.location.hash = L.sortHref(params, key); } },
    });
    // The first row's action (desktop table) opens the trade, where corrections are made.
    var first = node.querySelector(".table tbody td:last-child a");
    if (first) A(first, "trades-fix");
    return A(node, "trades-table");
  }

  function render() {
    var params = L.parse(SJ.router.query());
    var list = L.query(params);
    SJ.router.watch(SJ.router.refresh);
    var body = list.rows.length === 0
      ? ui.emptyState({ icon: "search-x", title: "No trades match these filters", action: h("a", { class: "btn btn-secondary", href: "#/trades", text: "Clear filters" }) })
      : [table(params, list), A(ui.pagination({ page: list.page, pageCount: list.pageCount, pageSize: list.pageSize, total: list.total, noun: "trades", onPage: function (p) {
        window.location.hash = L.href(params, { page: p });
        window.scrollTo(0, 0);
      } }), "trades-paging")];
    return h("div", { class: "page page-tight" }, header(params, list.total), filters(params), list.total > 0 && strip(list.summary), body);
  }

  SJ.screens = SJ.screens || {};
  SJ.screens.trades = { render: render };
})();
