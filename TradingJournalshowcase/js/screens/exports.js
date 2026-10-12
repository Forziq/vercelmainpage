// Exports (#/exports, app/(app)/exports): tax year or custom range, the wallet listed, rows per sheet, data-health
// warnings, a simulated Download, and a read-only preview of the six workbook sheets built by SJ.ledger (pooled FIFO).
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var f = SJ.format;
  var L = SJ.ledger;
  var A = function (el, id) { return SJ.explain.anchor(el, id); };
  var MIN_YEAR = 2020;
  var PAGE = 25;
  var DAY = /^\d{4}-\d{2}-\d{2}$/;
  var SHEETS = [["summary", "Summary"], ["disposals", "Disposals"], ["acquisitions", "Acquisitions"], ["fees", "Fees"], ["receipts", "Cashback and other receipts"], ["notes", "Notes and assumptions"]];
  var DETAIL = {
    missing_rate: "No SOL/EUR rate for this minute: its EUR figures are left blank.",
    missing_lot_rate: "A lot this sale matched has no SOL/EUR rate: the matched cost and gain are left blank.",
    no_known_cost: "More tokens sold than the known lots hold (or received at unknown cost): cost 0 was used for the rest.",
    transfer_out_review: "Tokens sent to someone else. Not treated as a disposal; decide with your accountant.",
  };
  var LIVE = "GET /api/export/accounting builds the .xlsx on request (exceljs, never stored, no-store) from raw events of every wallet, with the same six sheets and EUR cells as numbers.";
  var view = { sheet: "summary", pages: {} };

  var taxYear = function () { return Number(f.localTime(SJ.store.now(), L.TAX_TZ, "yyyy")); };
  var validDay = function (s) { return DAY.test(s || "") && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s; };

  /** The hash query as the app's accountingExportSchema reads it; anything invalid falls back to this tax year. */
  function parse(query) {
    var q = new URLSearchParams(query);
    var wallets = SJ.store.wallets().map(function (w) { return w.id; });
    var year = q.get("year");
    var from = q.get("from");
    var to = q.get("to");
    var wallet = q.get("wallet");
    var bad = (year !== null && !(/^\d{4}$/.test(year) && Number(year) >= MIN_YEAR && Number(year) <= 2100)) || (from !== null) !== (to !== null) ||
      (from !== null && (!validDay(from) || !validDay(to) || from > to)) || (wallet !== null && wallets.indexOf(wallet) < 0);
    var out = { walletId: SJ.store.activeWallet().id, invalid: bad };
    if (bad) return Object.assign(out, { period: L.period({ year: taxYear() }) });
    if (wallet) out.walletId = wallet;
    out.period = from ? L.period({ from: from, to: to }) : L.period({ year: year ? Number(year) : taxYear() });
    return out;
  }
  var href = function (o) {
    var p = new URLSearchParams();
    if (o.from) { p.set("from", o.from); p.set("to", o.to); } else p.set("year", String(o.year));
    p.set("wallet", o.wallet);
    return "#/exports?" + p.toString();
  };

  var walletLabel = function (id) { var w = SJ.store.wallets().filter(function (x) { return x.id === id; })[0]; return w ? f.shortAddress(w.address) + (w.id === SJ.store.activeWallet().id ? " (active)" : "") : id; };
  var event = function (id) { return SJ.store.data().events.filter(function (e) { return e.id === id; })[0]; };
  var tokenOf = function (e) { var t = e && e.mint && SJ.store.token(e.mint); return t ? "$" + t.symbol : "—"; };
  var eur = function (units, signed) { return units === null ? h("span", { class: "text-muted", title: "Missing rate: left blank", text: "blank" }) : f.eur(L.eurText(units), { signed: signed }); };
  var when = function (at) { return h("span", { class: "font-mono text-data-xs", text: L.dublin(at).slice(0, 16) }); };
  var flags = function (r) { return r.flags && r.flags.length ? h("span", { class: "x-flags" }, r.flags.map(function (x) { return ui.badge(x === "written_off_in_journal" ? x + " (not claimed)" : x, x === "missing_rate" || x === "no_known_cost" || x === "transfer_out_review" ? "warning" : null); })) : "—"; };

  function form(x) {
    var mode = x.period.year === null ? "custom" : "year";
    var years = [];
    for (var y = taxYear(); y >= MIN_YEAR; y--) years.push({ value: String(y), label: String(y) });
    var yearField = ui.select({ label: "Tax year", options: years, value: String(x.period.year || taxYear()) });
    var fromField = ui.input({ label: "From (Dublin)", value: x.period.fromDay, attrs: { type: "date" } });
    var toField = ui.input({ label: "To, inclusive", value: x.period.toDay, attrs: { type: "date" } });
    var walletField = ui.select({ label: "Wallet listed", hint: "Lots are matched across all your wallets.", value: x.walletId, options: SJ.store.wallets().map(function (w) { return { value: w.id, label: walletLabel(w.id) }; }) });
    var show = function () { yearField.hidden = mode !== "year"; fromField.hidden = toField.hidden = mode !== "custom"; };
    var error = h("p", { role: "alert", class: "text-body-sm text-loss", hidden: true });
    function submit(e) {
      e.preventDefault();
      var wallet = walletField.querySelector("select").value;
      if (mode === "year") { window.location.hash = href({ year: yearField.querySelector("select").value, wallet: wallet }); return; }
      var from = fromField.querySelector("input").value;
      var to = toField.querySelector("input").value;
      if (!validDay(from) || !validDay(to) || from > to) { error.textContent = "Pick a start and an end day, the start first."; error.hidden = false; return; }
      window.location.hash = href({ from: from, to: to, wallet: wallet });
    }
    var picker = ui.segmented({ label: "Period", value: mode, options: [{ value: "year", label: "Tax year" }, { value: "custom", label: "Custom range" }], onChange: function (v) { mode = v; show(); } });
    show();
    return A(ui.card({ labelledby: "export-options-title" }, [
      ui.cardHeader({ id: "export-options-title", title: "Accountant workbook" }),
      x.invalid && h("p", { class: "text-body-sm text-warning x-note", text: "That period or wallet was not valid, so the current tax year is shown." }),
      h("form", { class: "x-form", onsubmit: submit }, picker,
        h("div", { class: "x-fields" }, yearField, fromField, toField, walletField, h("button", { type: "submit", class: "btn btn-secondary", "data-refocus": "x-update", text: "Update preview" })), error),
    ]), "x-period");
  }

  function preview(x) {
    var c = L.counts(x);
    var t = x.totals;
    var rows = [[SHEETS[0][1], c.warnings + " warning" + (c.warnings === 1 ? "" : "s")], [SHEETS[1][1], c.disposals], [SHEETS[2][1], c.acquisitions], [SHEETS[3][1], c.fees], [SHEETS[4][1], c.receipts], [SHEETS[5][1], "—"]];
    return A(ui.card({ labelledby: "export-preview-title" }, [
      ui.cardHeader({ id: "export-preview-title", title: "Preview", meta: x.period.label }),
      h("div", { class: "x-stats" },
        ui.statCard({ label: "Gains", value: f.eur(t.gains) }), ui.statCard({ label: "Losses", value: f.eur(t.losses) }),
        ui.statCard({ label: "Net gain", value: f.eur(t.net, { signed: true }), tone: ui.toneOf(f.eurSign(t.net)) }),
        ui.statCard({ label: "Unknown gain", value: String(t.unknown), delta: t.unknown > 0 ? "missing rates" : null })),
      ui.dataTable({ caption: "Rows per sheet", rows: rows, rowKey: function (r) { return r[0]; }, columns: [
        { key: "sheet", header: "Sheet", cell: function (r) { return r[0]; } }, { key: "rows", header: "Rows", numeric: true, cell: function (r) { return String(r[1]); } }] }),
      h("p", { class: "text-body-sm text-muted x-note", text: x.method.assumption + " Not tax advice; no tax is computed." }),
    ]), "x-counts");
  }

  /** A paginated sheet table; the page lives in `view` so a redraw keeps it. */
  function sheetTable(id, caption, rows, columns) {
    var holder = h("div");
    function draw() {
      var pages = Math.max(1, Math.ceil(rows.length / PAGE));
      var p = Math.min(view.pages[id] || 1, pages);
      SJ.dom.clear(holder).appendChild(ui.dataTable({ caption: caption, rows: rows.slice((p - 1) * PAGE, p * PAGE), rowKey: function (r) { return r.eventId + ":" + (r.code || r.allocation || ""); }, columns: columns,
        empty: ui.emptyState({ title: "No rows", body: "Nothing in this period for the listed wallet." }) }));
      if (rows.length > PAGE) holder.appendChild(ui.pagination({ page: p, pageCount: pages, pageSize: PAGE, total: rows.length, noun: "rows", onPage: function (n) { view.pages[id] = n; draw(); } }));
    }
    draw();
    return holder;
  }

  var col = function (key, header, cell, numeric) { return { key: key, header: header, cell: cell, numeric: numeric }; };
  var dateCol = col("at", "Date (Dublin)", function (r) { return when(r.at); });
  var tokenCol = col("token", "Token", function (r) { return tokenOf(event(r.eventId)); });
  var qtyCol = col("qty", "Quantity", function (r) { var e = event(r.eventId); return f.tokenQty(r.qty, e.tokenDecimals); }, true);
  var solCol = function (key, header) { return col(key, header, function (r) { return f.sol(r[key], { decimals: 6 }); }, true); };

  var Sheets = {
    summary: function (x) { return SJ.exportSummary.render(x, DETAIL); },
    disposals: function (x) {
      return sheetTable("disposals", "Disposals", x.disposals, [dateCol, tokenCol, qtyCol, solCol("solReceived", "SOL received"),
        col("proceeds", "Proceeds EUR (after fees)", function (r) { return eur(r.proceeds); }, true), col("cost", "Matched cost EUR", function (r) { return eur(r.cost); }, true),
        col("gain", "Gain EUR", function (r) { return eur(r.gain, true); }, true), col("cgt", "CGT period", function (r) { return L.cgtPeriod(r.at).label; }), col("flags", "Flags", flags)]);
    },
    acquisitions: function (x) {
      return sheetTable("acquisitions", "Acquisitions", x.acquisitions, [dateCol, tokenCol, qtyCol, solCol("solSpent", "SOL spent"), solCol("fees", "Fees (SOL)"),
        col("cost", "Cost EUR (incl. fees)", function (r) { return eur(r.cost); }, true), col("flags", "Flags", flags)]);
    },
    fees: function (x) {
      var cols = [dateCol, tokenCol, col("kind", "Event", function (r) { return event(r.eventId).kind; }), solCol("lamports", "Total (SOL)"),
        col("eur", "EUR", function (r) { return eur(r.eur); }, true), col("allocation", "Allocation", function (r) { return r.allocation.replace("_", " "); }),
        col("disposal", "Allocated to a disposal", function (r) { return r.allocation === "disposal" ? "yes" : "no"; }), col("flags", "Flags", flags)];
      var unallocated = x.fees.filter(function (r) { return r.allocation === "unallocated"; });
      return h("div", { class: "x-sheet" }, sheetTable("fees", "Trade fees", x.fees.filter(function (r) { return r.allocation !== "unallocated"; }), cols),
        h("h3", { class: "text-label-sm text-muted x-block", text: "Unallocated fees (failed swaps no kept trade holds, rent reclaims)" }),
        sheetTable("unallocated", "Unallocated fees", unallocated, cols));
    },
    receipts: function (x) {
      return h("div", { class: "x-sheet" }, h("p", { class: "text-body-sm text-muted", text: "Every incoming SOL payment with your label for the sender, unclassified: neither income nor a cost reduction." }),
        sheetTable("receipts", "Cashback and other receipts", x.receipts, [dateCol,
          col("label", "Your label", function (r) { return r.label || "unlabelled"; }), col("name", "Label name", function (r) { return r.name || "—"; }),
          solCol("lamports", "SOL"), col("eur", "EUR", function (r) { return eur(r.eur); }, true),
          col("flags", "Flags", function (r) { return r.eur === null ? ui.badge("missing_rate", "warning") : "—"; })]));
    },
    notes: function (x) { return SJ.exportSummary.notes(x); },
  };

  function workbook(x) {
    return A(ui.card({ labelledby: "workbook-title" }, [
      ui.cardHeader({ id: "workbook-title", title: "Workbook preview", description: "Read-only. The file has more columns (signature, wallet, mint, rate minute and source, matched lots)." }),
      ui.tabs({ label: "Workbook sheets", value: view.sheet, onChange: function (id) { view.sheet = id; },
        items: SHEETS.map(function (s) { return { id: s[0], label: s[1], content: function () { return Sheets[s[0]](x); } }; }) }),
    ]), "x-sheets");
  }

  function download(x, button) {
    button.disabled = true;
    SJ.sim.run({ action: "Workbook download", success: "Workbook ready", live: LIVE, steps: ["Running FIFO over every wallet", "Writing six sheets"] })
      .then(function () { button.disabled = false; });
  }

  function render() {
    var x0 = parse(SJ.router.query());
    var x = Object.assign(L.build({ walletId: x0.walletId, period: x0.period }), { invalid: x0.invalid });
    SJ.router.watch(SJ.router.refresh);
    var button = ui.button({ label: "Download workbook", icon: "download", variant: "primary", attrs: { "data-refocus": "x-download" } });
    button.addEventListener("click", function () { download(x, button); });
    var header = SJ.router.pageHeader("Exports", "An Excel workbook per tax year for your accountant: disposals with FIFO-matched EUR cost, acquisitions, fees and receipts.");
    header.appendChild(A(h("div", null, button), "x-download"));
    return h("div", { class: "page" }, header, form(x),
      h("div", { class: "x-grid" }, preview(x), SJ.healthPanel.card({ anchor: "x-health" })), workbook(x));
  }

  SJ.screens = SJ.screens || {};
  SJ.screens.exports = { render: render, view: view, parse: parse, DETAIL: DETAIL, LIVE: LIVE };
})();
