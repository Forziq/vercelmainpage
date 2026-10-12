// The data-health card (the app's dashboard/data-health.tsx, lib/health.ts) shared by the Dashboard and Exports, plus
// its details panel: all eight checks with what each one means, why it matters for totals and exports, and a link
// to where it is fixed. Counts come from SJ.store.health() and cover every wallet.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var f = SJ.format;

  // [key, label, link, short line, why it matters]
  var ROWS = [
    ["parseFailures", "Parse failures", "#/settings", "Transactions the parser could not read; listed under Sync status.",
      "A transaction that cannot be read adds nothing to any trade, so its fills and fees are missing everywhere until the parser is fixed and re-run."],
    ["unsupportedEvents", "Unsupported events", "#/settings", "Protocols or pairs the parser skips; they are left out of every trade.",
      "Anything other than a Pump.fun swap is stored as UNSUPPORTED and counted here, so a trade made elsewhere never silently changes the totals."],
    ["missingRates", "Missing EUR rates", "#/settings", "Events with no SOL/EUR rate; each sync fetches more, minutes with no candle stay blank.",
      "EUR figures need the rate of each event's own minute. Without one the EUR value stays blank (never guessed) and the export lists it as a warning."],
    ["unlinkedRent", "Unlinked rent", "#/settings/sol", "Rent paid or refunded that no trade holds.",
      "Token-account rent is linked to the position that used the account. Rent no position holds is not in any trade's SOL flow."],
    ["unlabelledSolIn", "Unlabelled incoming SOL", "#/settings/sol", "Label the sender once (cashback, deposit…); it applies to every payment.",
      "Incoming SOL is never assumed to be income. Until its sender is labelled, cashback cannot be allocated as rebates."],
    ["orphanFees", "Orphan fees", "#/settings", "Failed swaps no trade holds, e.g. of a voided trade; their fees still count.",
      "A failed swap still costs fees. When no position holds it, the fee stays in the fee totals and the export's unallocated block."],
    ["writtenOff", "Written-off trades", "#/trades?status=written_off", "Basis written off in the journal; check each one is meant.",
      "A write-off realises the basis as a loss in the journal. The export keeps those lots open and says so: they are not claimed losses."],
    ["unreviewed", "Unreviewed trades", "#/inbox", "Finished trades waiting in the Inbox.",
      "Reviews feed the discipline numbers and the Coach. Unreviewed trades still count in P&L but not in rule adherence or grades."],
  ];

  var count = function (counts, key) { return counts[key]; };
  function rowText(r, counts) {
    return h("span", { class: "text-body-md text-fg" }, r[1],
      r[0] === "orphanFees" && counts.orphanFeeLamports > 0n && h("span", { class: "text-muted" }, " · ", ui.solAmount(f.sol(counts.orphanFeeLamports, { decimals: 6 }), "font-mono text-data-sm")));
  }

  /** Rows of the checks that are not clear, each a link to where it is fixed. */
  function list(counts) {
    var open = ROWS.filter(function (r) { return count(counts, r[0]) > 0; });
    if (!open.length) return h("p", { class: "health-clear text-body-md" }, SJ.dom.icon("check-circle", "text-muted"), "Everything looks complete");
    return h("ul", { class: "health-list" }, open.map(function (r) {
      return h("li", null, h("a", { href: r[2], class: "health-row" },
        h("span", { class: "health-count font-mono text-data-md text-warning", text: String(count(counts, r[0])) }),
        h("span", { class: "health-text" }, rowText(r, counts), h("span", { class: "text-body-sm text-muted", text: r[3] })),
        SJ.dom.icon("chevron-right", "text-muted")));
    }));
  }

  /** Every check, clear ones included, with why it matters (opened from the card's Details button). */
  function details() {
    var counts = SJ.store.health();
    var body = h("ul", { class: "health-details" }, ROWS.map(function (r) {
      var n = count(counts, r[0]);
      return h("li", { class: "health-detail" },
        h("div", { class: "health-detail-head" },
          h("span", { class: SJ.dom.cx("health-count font-mono text-data-md", n > 0 ? "text-warning" : "text-muted"), text: String(n) }),
          rowText(r, counts),
          n > 0 ? ui.badge("Needs attention", "warning") : ui.badge("Clear")),
        h("p", { class: "text-body-sm text-muted", text: r[4] }),
        n > 0 && h("a", { class: "btn btn-ghost btn-sm health-fix", href: r[2], onclick: function () { dialog.close(); } }, "Where to fix it", SJ.dom.icon("arrow-right")));
    }));
    var dialog = SJ.overlay.drawer({
      title: "Data health", description: "Everything that would make a total or an export wrong. All of your wallets are counted.",
      body: [body, SJ.sim.liveNote("the same counts come from one query per check over every wallet of the owner (loadDataHealth), and the Exports page shows them as its warnings.")],
    });
    return dialog;
  }

  /** The card. o: { anchor (explain id), title } */
  function card(o) {
    var counts = SJ.store.health();
    var open = ROWS.filter(function (r) { return count(counts, r[0]) > 0; }).length;
    var el = ui.card({ labelledby: "data-health-title" }, [
      ui.cardHeader({ id: "data-health-title", title: "Data health", size: "label", meta: open ? open + " of " + ROWS.length + " need attention" : null,
        actions: ui.button({ label: "Details", size: "sm", variant: "ghost", onclick: details, attrs: { "aria-haspopup": "dialog", "data-refocus": "health-details" } }) }),
      list(counts),
      open > 0 && open < ROWS.length && h("p", { class: "health-foot text-body-sm text-muted", text: "The other " + (ROWS.length - open) + " checks are clear." }),
    ]);
    return o && o.anchor ? SJ.explain.anchor(el, o.anchor) : el;
  }

  SJ.healthPanel = { ROWS: ROWS, list: list, card: card, details: details };
})();
