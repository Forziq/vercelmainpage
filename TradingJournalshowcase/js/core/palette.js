// Cmd+K / Ctrl+K search (the app's CommandPalette + command-search.ts): pages from the navigation, tokens and trades
// of every wallet by symbol, name or mint prefix, at most 8 results with up to 3 tokens first. A combobox with
// aria-activedescendant; arrow keys move, Enter opens, Esc closes and focus returns to where it was.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var LIMIT = 8;
  var TOKEN_SLOTS = 3;
  var OUTCOME = { win: "Win", loss: "Loss", breakeven: "Breakeven" };
  var STATUS = { open: "Open", closed: "Closed", written_off: "Written off", transferred: "Transferred" };
  var GROUPS = [["page", "Pages"], ["token", "Tokens"], ["trade", "Trades"]];
  var openDialog = null;

  var pages = function () {
    return SJ.shell.NAV_GROUPS.reduce(function (all, g) { return all.concat(g.items); }, []).concat([SJ.shell.SETTINGS_ITEM]);
  };

  /** Pages whose name contains the query (all of them for an empty query). */
  function matchPages(query) {
    var q = query.trim().toLowerCase();
    return pages().filter(function (p) { return p.label.toLowerCase().indexOf(q) >= 0; }).map(function (p) {
      return { kind: "page", id: "page:" + p.href, href: "#" + p.href, title: p.label, icon: p.icon };
    });
  }

  /** textMatch: symbol or name contains the text, or the mint starts with it (case-insensitive). */
  function textMatch(token, mint, q) {
    var t = token || {};
    return (t.symbol || "").toLowerCase().indexOf(q) >= 0 || (t.name || "").toLowerCase().indexOf(q) >= 0 || mint.toLowerCase().indexOf(q) === 0;
  }

  /** Up to `tokenSlots` tokens first, then trades; slots one side leaves empty go to the other. */
  function pickResults(tokens, trades, limit, tokenSlots) {
    var t = Math.min(tokens.length, Math.max(tokenSlots, limit - trades.length));
    return tokens.slice(0, t).concat(trades.slice(0, limit - Math.min(t, limit))).slice(0, limit);
  }

  /** Tokens (most recently entered first) and trades (newest entry first) of every wallet matching `query`. */
  function search(query) {
    var q = query.trim().toLowerCase();
    if (!q) return [];
    var tz = SJ.store.settings().timeZone;
    var trades = SJ.store.trades({ allWallets: true }).filter(function (t) { return textMatch(SJ.store.token(t.mint), t.mint, q); })
      .sort(function (a, b) { return b.openedAt - a.openedAt || (a.key < b.key ? -1 : 1); });
    var byMint = {};
    var order = [];
    trades.forEach(function (t) {
      if (!byMint[t.mint]) { byMint[t.mint] = { mint: t.mint, trades: 0 }; order.push(t.mint); }
      byMint[t.mint].trades++;
    });
    var tokens = order.map(function (mint) {
      var token = SJ.store.token(mint) || {};
      var n = byMint[mint].trades;
      return { kind: "token", id: "token:" + mint, href: SJ.tradeList.tokenHref(mint), title: token.symbol ? "$" + token.symbol : SJ.format.shortAddress(mint),
        detail: [token.name, n + (n === 1 ? " trade" : " trades")].filter(Boolean).join(" · ") };
    });
    var rows = trades.map(function (t) {
      var token = SJ.store.token(t.mint) || {};
      return {
        kind: "trade", id: "trade:" + t.key, href: SJ.tradeList.tradeHref(t.key), title: token.symbol ? "$" + token.symbol : SJ.format.shortAddress(t.mint),
        detail: SJ.format.localTime(t.openedAt, tz, "MMM d, HH:mm") + " · " + (t.outcome ? OUTCOME[t.outcome] : STATUS[t.status]),
        // Open and transferred positions have no P&L yet.
        pnl: t.outcome ? t.netPnl : null,
      };
    });
    return pickResults(tokens, rows, LIMIT, TOKEN_SLOTS);
  }

  var isTextEntry = function (el) { return !!el && (el.isContentEditable === true || ["INPUT", "TEXTAREA", "SELECT"].indexOf(el.tagName) >= 0); };
  /** isPaletteShortcut: Cmd+K or Ctrl+K, never while typing in a field or working in another dialog. */
  function isShortcut(e) {
    var target = e.target && e.target.nodeType === 1 ? e.target : null;
    var inDialog = !!(target && target.closest('[aria-modal="true"]'));
    return e.key === "k" && (e.metaKey || e.ctrlKey) && !e.altKey && !inDialog && !isTextEntry(target);
  }

  function option(r, i, base, selected, pick, hover) {
    var icon = r.kind === "page" ? r.icon : r.kind === "token" ? "coins" : "arrow-left-right";
    return h("div", { id: base + "-opt-" + i, role: "option", "aria-selected": String(selected), class: SJ.dom.cx("palette-option", selected && "is-active"),
      onmousedown: function (e) { e.preventDefault(); }, onmousemove: hover, onclick: pick },
      SJ.dom.icon(icon, "text-muted"),
      h("span", { class: "palette-text" }, h("span", { class: "text-body-md", text: r.title }), r.detail && h("span", { class: "text-body-sm text-muted", text: r.detail })),
      r.pnl !== undefined && r.pnl !== null && SJ.ui.pnl(r.pnl, { className: "text-data-sm" }));
  }

  /** Opens the search dialog; the input is focused and owns the keyboard. */
  function open() {
    if (openDialog && openDialog.panel.isConnected) return openDialog;
    var base = SJ.dom.uid("palette");
    var query = "";
    var active = 0;
    var items = [];
    var input = h("input", { type: "text", role: "combobox", "data-autofocus": true, class: "input palette-input", "aria-expanded": "false", "aria-controls": base + "-list",
      "aria-autocomplete": "list", "aria-label": "Search pages, tokens and trades", placeholder: "Symbol, name, mint or page", autocomplete: "off", spellcheck: "false", maxlength: "64" });
    var status = h("p", { role: "status", class: "text-body-sm text-muted" });
    var list = h("div", { id: base + "-list", role: "listbox", "aria-label": "Search results", class: "palette-list" });

    function go(r) {
      close();
      window.location.hash = r.href;
    }
    function paint() {
      var q = query.trim();
      items = matchPages(q).concat(search(q));
      var current = items.length ? Math.min(active, items.length - 1) : -1;
      active = Math.max(0, current);
      input.setAttribute("aria-expanded", String(items.length > 0));
      if (current >= 0) input.setAttribute("aria-activedescendant", base + "-opt-" + current);
      else input.removeAttribute("aria-activedescendant");
      status.textContent = !q ? "Find a token or trade by symbol, name or mint prefix, or jump to a page."
        : items.length === 0 ? "No matches for “" + q + "”." : items.length + (items.length === 1 ? " result" : " results");
      SJ.dom.clear(list);
      GROUPS.forEach(function (g) {
        var rows = items.map(function (r, i) { return [r, i]; }).filter(function (x) { return x[0].kind === g[0]; });
        if (!rows.length) return;
        list.appendChild(h("div", { role: "group", "aria-labelledby": base + "-" + g[0] },
          h("div", { id: base + "-" + g[0], class: "palette-group text-label-sm text-muted", text: g[1] }),
          rows.map(function (x) {
            return option(x[0], x[1], base, x[1] === current, function () { go(x[0]); }, function () { if (active !== x[1]) { active = x[1]; paint(); } });
          })));
      });
      var sel = current >= 0 && document.getElementById(base + "-opt-" + current);
      if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: "nearest" });
    }
    input.addEventListener("input", function () { query = input.value; active = 0; paint(); });
    input.addEventListener("keydown", function (e) {
      var n = items.length;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (n > 0) { active = (active + (e.key === "ArrowDown" ? 1 : n - 1)) % n; paint(); }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (items[active]) go(items[active]);
      }
    });
    var dialog = SJ.overlay.modal({ title: "Search", body: h("div", { class: "palette" }, input, status, list), onClose: function () { openDialog = null; } });
    function close() { dialog.close(); }
    dialog.panel.classList.add("palette-panel");
    openDialog = dialog;
    paint();
    return dialog;
  }

  function init() {
    document.addEventListener("keydown", function (e) {
      if (!isShortcut(e)) return;
      e.preventDefault(); // browsers bind Ctrl+K to the address bar
      open();
    });
  }

  SJ.palette = { LIMIT: LIMIT, matchPages: matchPages, pickResults: pickResults, search: search, isShortcut: isShortcut, open: open, init: init };
})();
