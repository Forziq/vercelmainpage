// The Summary and Notes sheets of the Exports preview (lib/accounting/workbook-summary.ts): period, method and its
// assumption, token gains, CGT periods with payment dates, the reconciliation with the journal and the warnings.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var f = SJ.format;
  var L = SJ.ledger;

  var address = function (id) { var w = SJ.store.wallets().filter(function (x) { return x.id === id; })[0]; return w ? w.address : id; };
  var lines = function (rows) {
    return h("dl", { class: "x-lines" }, rows.filter(Boolean).map(function (r) {
      return h("div", { class: SJ.dom.cx("x-line", r[2] && "is-sub") }, h("dt", { class: "text-body-sm text-muted", text: r[0] }), h("dd", { class: "font-mono text-data-sm text-fg" }, r[1]));
    }));
  };
  var block = function (title, children) { return h("section", { class: "x-block" }, h("h3", { class: "text-label-sm text-muted", text: title }), children); };

  function render(x, detail) {
    var t = x.totals;
    var r = x.reconciliation;
    var warnings = L.warnings(x);
    var events = {};
    SJ.store.data().events.forEach(function (e) { events[e.id] = e; });
    return h("div", { class: "x-sheet" },
      h("p", { class: "text-body-md text-fg", text: "Accountant workbook — Solana token disposals" }),
      h("p", { class: "text-body-sm text-warning", text: "Not tax advice. No tax is computed; figures are for your accountant." }),
      lines([
        ["Period", x.period.label + " (" + L.dublin(x.period.from) + " to before " + L.dublin(x.period.to) + ", " + L.TAX_TZ + ")"],
        ["Wallet listed", ui.address({ value: address(x.walletId), label: "wallet listed" })],
        ["Wallets pooled for matching", h("span", { class: "x-wallets" }, x.wallets.map(function (id) { return ui.address({ value: address(id), label: "pooled wallet" }); }))],
        ["Method", x.method.label],
        ["Assumption", h("span", { class: "x-wrap", text: x.method.assumption })],
      ]),
      block("Token gains (SOL's own gains are excluded)", lines([
        ["Disposals", String(t.disposals)], ["Gains EUR", f.eur(t.gains)], ["Losses EUR", f.eur(t.losses)], ["Net gain EUR", f.eur(t.net, { signed: true })],
        ["Disposals with unknown gain (left out of the sums)", String(t.unknown)],
        ["Personal exemption EUR (for reference, not applied)", f.eur(String(L.EXEMPTION_EUR))],
        x.period.year !== null && ["Return due", L.returnDue(x.period.year) + " (31 October of the following year)"],
      ])),
      block("CGT periods (disposals 1 Jan–30 Nov: pay by 15 Dec; 1–31 Dec: pay by 31 Jan)", ui.dataTable({
        caption: "CGT periods", rows: x.cgt, rowKey: function (g) { return g.period.label; },
        empty: h("p", { class: "text-body-sm text-muted", text: "No disposals in this period." }),
        columns: [
          { key: "p", header: "CGT period", cell: function (g) { return g.period.label; } },
          { key: "n", header: "Disposals", numeric: true, cell: function (g) { return String(g.totals.disposals); } },
          { key: "g", header: "Gains EUR", numeric: true, cell: function (g) { return f.eur(g.totals.gains); } },
          { key: "l", header: "Losses EUR", numeric: true, cell: function (g) { return f.eur(g.totals.losses); } },
          { key: "net", header: "Net EUR", numeric: true, cell: function (g) { return f.eur(g.totals.net, { signed: true }); } },
          { key: "u", header: "Unknown gain", numeric: true, cell: function (g) { return String(g.totals.unknown); } },
          { key: "due", header: "Payment due", cell: function (g) { return g.period.paymentDue; } },
        ] })),
      SJ.explain.anchor(block("Reconciliation with the journal", lines([
        ["App net P&L EUR (decided trades closed in the period)", f.eur(r.appNetPnlEur, { signed: true })],
        ["Method gain EUR", f.eur(r.methodGainEur, { signed: true })],
        ["Difference (app − method)", f.eur(r.difference, { signed: true })],
        ["Voided in the journal", f.eur(r.lines.voided, { signed: true }), true],
        ["Excluded in the journal", f.eur(r.lines.excluded, { signed: true }), true],
        ["Failed-swap fees", f.eur(r.lines.failedFees, { signed: true }), true],
        ["Written-off basis", f.eur(r.lines.writtenOffBasis, { signed: true }), true],
        ["Method and timing", f.eur(r.lines.methodAndTiming, { signed: true }), true],
        ["Journal positions left out (missing rate)", String(r.missingRates.positions)],
        ["Disposals left out (missing rate)", String(r.missingRates.disposals)],
      ])), "x-recon"),
      block("Warnings · " + warnings.length, ui.dataTable({
        caption: "Warnings", rows: warnings, rowKey: function (w) { return w.code + ":" + w.eventId + ":" + (w.lotEventId || ""); },
        empty: h("p", { class: "text-body-sm text-muted", text: "No warnings." }),
        columns: [
          { key: "code", header: "Code", cell: function (w) { return ui.badge(w.code, "warning"); } },
          { key: "at", header: "Date (Dublin)", cell: function (w) { return h("span", { class: "font-mono text-data-xs", text: L.dublin(w.at).slice(0, 16) }); } },
          { key: "token", header: "Token", cell: function (w) { var e = events[w.eventId]; var tk = e && e.mint && SJ.store.token(e.mint); return tk ? "$" + tk.symbol : e ? e.kind : "—"; } },
          { key: "detail", header: "Detail", cell: function (w) { return h("span", { class: "x-wrap text-body-sm", text: detail[w.code] }); } },
        ] })));
  }

  function notes(x) {
    var pooled = x.wallets.map(address).map(function (a) { return f.shortAddress(a); }).join(", ");
    var rows = [
      ["Not tax advice", "This workbook lists on-chain token trades valued in EUR for your accountant. It is not tax advice and computes no tax."],
      ["Method", x.method.assumption],
      ["Scope", "Token gains only. Each token buy also disposes of SOL; SOL's own gains and losses are excluded because they need an EUR cost for every SOL deposit, which the app does not track."],
      ["Wallets", "Lots are pooled per token across all your wallets (" + pooled + "), because tax is on the person, not the wallet. The Disposals, Acquisitions, Fees and Cashback sheets list only the rows of the wallet chosen for this export (" + f.shortAddress(address(x.walletId)) + ")."],
      ["Valuation", "Each SOL amount is valued at the Coinbase SOL/EUR one-minute candle close of its own minute. When that minute has no candle, the nearest candle within ±5 minutes is used and shown under \"Candle used\". With none, the EUR cells stay blank, the row is flagged missing_rate and listed under Warnings; nothing is guessed."],
      ["Cost and proceeds", "Acquisition cost = EUR of the SOL spent plus that buy's fees. Proceeds = EUR of the SOL received minus that sale's fees. A partly sold lot gives its cost pro rata by quantity."],
      ["Fees", "Network, priority, tip and platform fees are listed per event. Fees inside a lot's cost or a sale's proceeds are marked; failed swaps no kept trade holds and rent-reclaim fees are unallocated and listed in their own block."],
      ["Voided and excluded", "Trades voided or events excluded in the journal are still real on-chain trades. They stay in every sheet, flagged voided_in_journal or excluded_in_journal; they are never dropped."],
      ["Written off", "Positions written off in the journal are not claimed losses. Their buy lots stay open, flagged written_off_in_journal (not claimed)."],
      ["Transfers", "Token transfers are never disposals. Between your own wallets they change nothing. Tokens sent to someone else leave the pool with their cost, flagged transfer_out_review; tokens received from someone else get cost 0, flagged transfer_in_unknown_cost."],
      ["Cashback and other receipts", "Incoming SOL is listed with your label for the sender, unclassified: Revenue's crypto-asset manual does not address rewards, so the app treats it neither as income nor as a cost reduction."],
      ["CGT periods", "Disposals 1 January–30 November: payment due 15 December. Disposals 1–31 December: payment due 31 January of the following year."],
      ["Personal exemption", "€1,270 a year, shown for reference only and not applied."],
      ["Return", "Due 31 October of the following year. Form CG1 only if you do not usually file annual returns; otherwise Form 11 (self-employed) or Form 12 (PAYE employees)."],
      ["Sources", "The live file links Revenue's pages on Capital Gains Tax, on paying and filing it, and its crypto-asset manual (TDM 02-01-03)."],
    ];
    return SJ.explain.anchor(h("dl", { class: "x-notes" }, rows.map(function (r) {
      return h("div", { class: "x-note-row" }, h("dt", { class: "text-label-sm text-muted", text: r[0] }), h("dd", { class: "text-body-sm text-fg", text: r[1] }));
    })), "x-notes");
  }

  SJ.exportSummary = { render: render, notes: notes };
})();
