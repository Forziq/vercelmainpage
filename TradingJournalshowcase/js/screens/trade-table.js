// The trade table shared by the Dashboard (recent trades) and Trades (app/(app)/trades/trade-table.tsx): token link
// to the token page, opened time in the owner's zone, P&L with its EUR line, outcome, grade, review state and the
// Grade / Inspect action. With `sort` the headers sort and the Fees and Entry MC columns are added.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var f = SJ.format;
  var L = SJ.tradeList;
  var DATE_SHORT = "MMM d, HH:mm";

  var zoneLabel = function (tz) { return (tz.split("/").pop() || tz).replace(/_/g, " "); };
  var roiSign = function (t) { return t.roiParts ? f.signOf(t.roiParts.num) : null; };
  var reviewedAt = function (t) { return t.reflection ? t.reflection.reviewedAt || null : null; };
  var grade = function (t) { return t.reflection ? t.reflection.grade || null : null; };

  function token(t) {
    return h("span", { class: "trade-token" }, ui.tokenAvatar({ symbol: t.symbol, outcome: t.outcome }),
      h("span", { class: "trade-token-text" },
        h("a", { class: "link-quiet text-body-md", href: L.tokenHref(t.mint) }, t.symbol ? "$" + t.symbol : "Unknown", h("span", { class: "sr-only", text: " token page" })),
        h("span", { class: "font-mono text-data-xs text-muted", text: f.shortAddress(t.mint) })));
  }

  function result(t) {
    return t.outcome || t.status === "closed" ? ui.outcomeBadge(t.outcome) : ui.badge(L.STATUS[t.status]);
  }

  function review(t) {
    if (reviewedAt(t)) return ui.statusDot("Reviewed", "profit");
    if (t.status === "open") return ui.statusDot("Open");
    return ui.statusDot("Needs review", "warning");
  }

  function action(t) {
    var toGrade = !reviewedAt(t) && t.status !== "open";
    return h("a", { class: SJ.dom.cx("btn btn-sm", toGrade ? "btn-primary" : "btn-secondary"), href: L.tradeHref(t.key) },
      toGrade ? "Grade" : "Inspect", h("span", { class: "sr-only", text: " " + (t.symbol || "trade") }));
  }

  /** Net P&L (neutral for a breakeven) with the EUR line under it. */
  function pnl(t) {
    var be = t.outcome === "breakeven";
    var eur = SJ.fiat.pnlOf(t);
    return h("span", { class: "pnl-stack" },
      ui.pnlValue({ value: f.sol(t.netPnl, { signed: true }), sign: f.signOf(t.netPnl), neutral: be }),
      ui.fiatSub(SJ.fiat.label(eur, true), be ? "neutral" : ui.toneOf(SJ.fiat.sign(eur))));
  }

  var roi = function (t) { return ui.pnlValue({ value: f.pct(t.roi), sign: roiSign(t), unit: "", neutral: t.outcome === "breakeven" }); };
  var hold = function (t) { return t.status === "open" ? "Open" : f.duration(t.holdingSeconds); };

  /** o: { rows, timeZone, sort: { current, onSort(key) } (optional), caption } */
  function table(o) {
    var tz = o.timeZone;
    var by = function (key) {
      if (!o.sort) return {};
      return { sort: o.sort.current.key === key ? o.sort.current.dir : null, onSort: function () { o.sort.onSort(key); } };
    };
    var extra = o.sort ? [
      Object.assign({ key: "fees", header: "Fees", numeric: true, cell: function (t) { return f.sol(t.feesTotal, { decimals: 6 }); } }, by("fees")),
      Object.assign({ key: "entry_mc", header: "Entry MC", numeric: true, cell: function (t) { return ui.solText(f.marketCap(t.entryMcSol)); } }, by("entry_mc")),
    ] : [];
    var columns = [
      { key: "token", header: "Token", cell: token },
      Object.assign({ key: "opened_at", header: "Opened (" + zoneLabel(tz) + ")", cell: function (t) { return h("span", { class: "font-mono text-data-sm", text: f.localTime(t.openedAt, tz, DATE_SHORT) }); } }, by("opened_at")),
      Object.assign({ key: "hold", header: "Hold", numeric: true, cell: hold }, by("hold")),
      { key: "fills", header: "Buys / sells", numeric: true, align: "center", cell: function (t) { return t.buyCount + " / " + t.sellCount; } },
      Object.assign({ key: "size", header: "SOL in", numeric: true, cell: function (t) { return f.sol(t.solIn); } }, by("size")),
      { key: "out", header: "SOL out", numeric: true, cell: function (t) { return f.sol(t.solOut); } },
    ].concat(extra, [
      Object.assign({ key: "net_pnl", header: "Net P&L", numeric: true, cell: pnl }, by("net_pnl")),
      Object.assign({ key: "roi", header: "ROI", numeric: true, cell: roi }, by("roi")),
      { key: "outcome", header: "Outcome", align: "center", cell: result },
      { key: "grade", header: "Grade", align: "center", cell: function (t) { return ui.gradeBadge(grade(t)); } },
      { key: "status", header: "Status", cell: review },
      { key: "action", header: "Action", align: "right", cell: action },
    ]);
    return ui.dataTable({
      caption: o.caption || "Trades", columns: columns, rows: o.rows, rowKey: function (t) { return t.key; },
      mobileCard: function (t) {
        return h("div", { class: "trade-card" },
          h("div", { class: "trade-card-row" }, token(t), h("span", { class: "trade-card-badges" }, result(t), ui.gradeBadge(grade(t)))),
          h("div", { class: "trade-card-row is-baseline" }, h("span", { class: "text-data-md" }, pnl(t)), h("span", { class: "text-data-sm" }, roi(t))),
          h("div", { class: "trade-card-row trade-card-meta font-mono text-data-xs text-muted" },
            h("span", { text: f.localTime(t.openedAt, tz, DATE_SHORT) }), h("span", { text: hold(t) }), h("span", { text: t.buyCount + "B / " + t.sellCount + "S" }), review(t)),
          h("div", { class: "trade-card-action" }, action(t)));
      },
    });
  }

  SJ.tradeTable = { table: table, zoneLabel: zoneLabel, DATE_SHORT: DATE_SHORT, result: result, review: review, roiSign: roiSign };
})();
