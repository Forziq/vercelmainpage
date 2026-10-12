// The §6 per-group columns shared by Analytics and the Strategies / Mistakes pages (components/vocab/cells.tsx):
// trades, win rate, net and average P&L, average ROI, profit factor and execution score. A group with fewer than 10
// trades is greyed out and gets no P&L colour.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var f = SJ.format;
  var thin = function (g) { return !g || !g.enoughData; };
  var muted = function (g, text) { return h("span", { class: SJ.dom.cx("font-mono tabular", thin(g) && "text-muted"), text: text }); };

  function pnl(g, v) {
    if (!g || v === null || v === undefined) return h("span", { class: "font-mono text-muted", text: f.DASH });
    return ui.pnlValue({ value: f.sol(v, { signed: true }), sign: f.signOf(v), neutral: thin(g) });
  }
  function roi(g) {
    var r = g ? g.summary.avgRoi : null;
    if (r === null) return h("span", { class: "font-mono text-muted", text: f.DASH });
    return ui.pnlValue({ value: f.pct(r), sign: r === 0 ? 0 : r > 0 ? 1 : -1, unit: "", neutral: thin(g) });
  }

  /** The metric cells of a group row (undefined = no trades yet). */
  var METRICS = [
    ["n", "Trades", function (g) { return muted(g, String(g ? g.n : 0)); }],
    ["win", "Win rate", function (g) { return muted(g, g && g.summary.winRate !== null ? f.rate(g.summary.winRate) + "%" : f.DASH); }],
    ["net", "Net P&L", function (g) { return pnl(g, g ? g.summary.netPnl : null); }],
    ["avg", "Avg P&L", function (g) { return pnl(g, g ? g.summary.expectancy : null); }],
    ["roi", "Avg ROI", roi],
    ["pf", "PF", function (g) { return muted(g, f.profitFactor(g ? g.summary.profitFactor : null)); }],
    ["exec", "Exec", function (g) { return muted(g, g && g.summary.avgExecutionScore !== null ? g.summary.avgExecutionScore.toFixed(2) : f.DASH); }],
  ];

  function columns(get) {
    return METRICS.map(function (m) { return { key: m[0], header: m[1], numeric: true, cell: function (r) { return m[2](get(r)); } }; });
  }

  /** The same numbers as a grid, for phone cards. */
  function grid(g) {
    return h("dl", { class: "group-grid" }, METRICS.map(function (m) {
      return h("div", null, h("dt", { class: "text-label-sm text-muted uppercase", text: m[1] }), h("dd", { class: "text-body-sm" }, m[2](g)));
    }));
  }

  /** "A vs B: avg P&L …, win rate … pts, avg ROI …", only for two groups that both have 10 trades. Facts only. */
  function comparison(c, rowCount) {
    if (!c) return rowCount > 1 ? h("p", { class: "text-body-sm text-muted", text: "No comparison: fewer than two groups have 10 trades." }) : null;
    var pts = c.winRateDiff === null ? f.DASH : (c.winRateDiff < 0 ? "" : "+") + (c.winRateDiff * 100).toFixed(1) + " pts";
    return h("p", { class: "compare-row text-body-sm text-muted" },
      h("span", null, h("span", { class: "text-fg", text: c.a.bucket.label }), " vs ", h("span", { class: "text-fg", text: c.b.bucket.label }), ":"),
      h("span", null, "avg P&L ", ui.pnlValue({ value: f.sol(c.avgNetPnlDiff, { signed: true }), sign: f.signOf(c.avgNetPnlDiff) })),
      h("span", { class: "font-mono", text: "win rate " + pts }),
      h("span", { class: "font-mono", text: "avg ROI " + f.pct(c.avgRoiDiff) }));
  }

  SJ.groupTable = { columns: columns, grid: grid, comparison: comparison, thin: thin };
})();
