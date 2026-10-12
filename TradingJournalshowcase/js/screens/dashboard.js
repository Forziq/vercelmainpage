// Dashboard (#/dashboard, app/(app)/dashboard): range picker, primary and secondary stat cards, data health, the
// seven charts and recent trades. Every figure comes from SJ.analytics.dashboard(range), recomputed from the store.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var f = SJ.format;
  var A = SJ.explain.anchor;
  var RANGES = [{ value: "7d", label: "7D" }, { value: "30d", label: "30D" }, { value: "90d", label: "90D" }, { value: "all", label: "All" }];
  var RANGE_TEXT = { "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", all: "All history" };
  var M = SJ.motion;
  // The headline values last shown, so a redraw (a range change, a sync) counts on from them.
  var shown = {};

  var signed = function (v) { return f.sol(v, { signed: true }); };
  var pnlTone = function (v) { return v === null ? "default" : ui.toneOf(f.signOf(v)); };
  var dayLabel = function (day) { return SJ.charts.shortDay(day); };
  var eurLine = function (units, pnl, show) {
    var v = show === false ? null : units;
    return ui.fiatSub(SJ.fiat.label(v, pnl), pnl ? ui.toneOf(SJ.fiat.sign(v)) : null);
  };

  /**
   * A headline value: counts up from zero when the dashboard opens (staggered with the cards) and from the previous
   * value after a range change or a sync (ui/Ticker). Display only; "—" and "∞" are shown as they are.
   */
  function ticker(label, text, index, redraw) {
    var from = redraw && shown[label] !== undefined ? shown[label] : redraw ? text : null;
    shown[label] = text;
    return M.ticker(text, { from: from, delay: index * M.ENTER_STAGGER_MS });
  }

  function header(range) {
    var picker = ui.segmented({ label: "Period", options: RANGES, value: range, onChange: function (v) { window.location.hash = v === "30d" ? "#/dashboard" : "#/dashboard?range=" + v; } });
    picker.querySelectorAll(".segment").forEach(function (b) { b.setAttribute("data-refocus", "range-" + b.getAttribute("data-value")); });
    return h("header", { class: "page-header" },
      h("div", null, h("h1", { class: "text-headline-lg", tabindex: "-1", text: "Dashboard" }),
        h("p", { class: "text-body-sm text-muted", text: RANGE_TEXT[range] + " · positions by entry trading day" })),
      A(h("div", null, picker), "dash-range"));
  }

  function primary(d, redraw) {
    var s = d.summary;
    var none = s.trades === 0;
    var card = function (o, text, index) {
      return ui.statCard(Object.assign(o, { value: ticker(o.label, text, index, redraw), flash: M.changed("dash:" + o.label, text, redraw) }));
    };
    var grid = h("div", { class: "dash-primary" },
      A(card({ hero: true, className: "dash-hero", label: "Net P&L", unit: "SOL", tone: pnlTone(none ? null : s.netPnl), sub: eurLine(d.eur.netPnl, true, !none), delta: s.trades + " closed" }, signed(s.netPnl), 0), "dash-net"),
      A(card({ label: "Win rate", unit: s.winRate === null ? null : "%", delta: s.wins + "W · " + s.losses + "L · " + s.breakevens + " BE" }, f.rate(s.winRate), 1), "dash-winrate"),
      card({ label: "Profit factor" }, f.profitFactor(s.profitFactor), 2),
      A(card({ label: "Trades", delta: d.open > 0 ? d.open + " open" : null }, String(d.entered), 3), "dash-countup"),
      // No count-up on this card (owner decision 2026-10-03), only the entrance.
      A(h("a", { class: "stat-link", href: "#/inbox", "aria-label": d.needsReview + " trades need review. Open the Inbox" },
        ui.statCard({ label: "Needs review", value: String(d.needsReview), delta: "Open Inbox →", flash: M.changed("dash:Needs review", String(d.needsReview), redraw) })), "dash-review"));
    // First load only: the five cards rise in, 40 ms apart.
    if (!redraw) Array.prototype.forEach.call(grid.children, function (el, i) {
      el.classList.add("dash-enter");
      el.style.setProperty("--delay", i * M.ENTER_STAGGER_MS + "ms");
    });
    return grid;
  }

  function group(title, stats) {
    return ui.card({ label: title, padding: "none", className: "stat-group" }, [h("h2", { class: "stat-group-title text-label-sm text-muted", text: title }), h("div", { class: "stat-group-grid" }, stats)]);
  }

  function secondary(d, redraw) {
    var stat = function (o) { return ui.statCard(Object.assign({ compact: true, flash: M.changed("dash:" + o.label, o.value, redraw) }, o)); };
    var s = d.summary;
    var st = d.streak;
    var limits = SJ.analytics.describeLimits(d.limits);
    var anyNet = s.trades > 0 || d.rebates > 0n || d.reclaimFees > 0n;
    var fees6 = function (v) { return f.sol(v, { decimals: 6 }); };
    return h("div", { class: "dash-secondary" },
      group("Results", [
        stat({ label: "Avg winner", value: s.avgWinner === null ? f.DASH : signed(s.avgWinner), tone: pnlTone(s.avgWinner), unit: s.avgWinner === null ? null : "SOL" }),
        stat({ label: "Avg loser", value: s.avgLoser === null ? f.DASH : signed(s.avgLoser), tone: pnlTone(s.avgLoser), unit: s.avgLoser === null ? null : "SOL" }),
        stat({ label: "Avg R:R", value: d.avgPlannedRR === null ? f.DASH : d.avgPlannedRR.toFixed(2) + "R", delta: "Trades with a planned stop" }),
        stat({ label: "Avg hold", value: f.duration(s.avgHoldSeconds) }),
      ]),
      A(group("Fees", [
        stat({ label: "Total fees", value: fees6(d.feesTotal), unit: "SOL", sub: eurLine(d.eur.fees), delta: "Incl. orphan failed fees" }),
        stat({ label: "Reclaim fees", value: fees6(d.reclaimFees), unit: "SOL", sub: eurLine(d.eur.reclaimFees), delta: "Rent reclaims, in no trade" }),
        stat({ className: "span-2", label: "Net after rebates", value: signed(d.netAfterRebates), tone: pnlTone(anyNet ? d.netAfterRebates : null), unit: "SOL", sub: eurLine(d.eur.netAfterRebates, true, anyNet),
          delta: h("span", null, "+ cashback ", ui.solText(fees6(d.rebates) + " SOL"), " − reclaim fees ", ui.solText(fees6(d.reclaimFees) + " SOL")) }),
      ]), "dash-fees"),
      group("Days & streak", [
        stat({ label: "Best day", value: d.days ? signed(d.days.best.netPnl) : f.DASH, tone: pnlTone(d.days ? d.days.best.netPnl : null), unit: d.days ? "SOL" : null, delta: d.days ? dayLabel(d.days.best.day) : null }),
        stat({ label: "Worst day", value: d.days ? signed(d.days.worst.netPnl) : f.DASH, tone: pnlTone(d.days ? d.days.worst.netPnl : null), unit: d.days ? "SOL" : null, delta: d.days ? dayLabel(d.days.worst.day) : null }),
        stat({ label: "Current streak", value: st ? st.length + " " + (st.kind === "win" ? (st.length === 1 ? "win" : "wins") : st.length === 1 ? "loss" : "losses") : f.DASH, tone: st ? (st.kind === "win" ? "profit" : "loss") : "default" }),
      ]),
      A(group("Discipline", [
        stat({ label: "Rule adherence", value: f.rate(s.ruleAdherence), unit: s.ruleAdherence === null ? null : "%", delta: s.reviewed + " reviewed" }),
        stat({ label: "Avg execution", value: s.avgExecutionScore === null ? f.DASH : s.avgExecutionScore.toFixed(2), unit: s.avgExecutionScore === null ? null : "/ 4" }),
        stat({ className: "span-2", label: "Days within your limits", value: d.daysWithinLimits ? d.daysWithinLimits.within + " of " + d.daysWithinLimits.days : f.DASH, delta: limits ? "Limits: " + limits : "No limits set (Settings)" }),
      ]), "dash-discipline"));
  }

  function chartCard(id, title, meta, content, actions) {
    return ui.card({ labelledby: id, padding: "lg", className: "chart-card" }, [ui.cardHeader({ id: id, title: title, size: "label", meta: meta, actions: actions }), content]);
  }

  function periodChart(d) {
    var holder = h("div");
    var titleId = "chart-period";
    var card;
    // The Day/Week switch shows the other series at once; only the first mount draws in.
    function draw(period, drawIn) {
      var data = period === "day" ? d.daily.map(function (x) { return { x: x.day, y: x.netPnl }; }) : d.weekly.map(function (w) { return { x: w.week, y: w.netPnl }; });
      SJ.dom.clear(holder).appendChild(SJ.charts.render("bars", data, { label: "Net P&L per " + period, drawIn: drawIn === false ? false : undefined, xFormat: dayLabel, tipLabel: function (x) { return period === "week" ? "Week of " + dayLabel(x.x) : dayLabel(x.x); } }));
      if (card) card.querySelector("#" + titleId).textContent = period === "day" ? "Daily net P&L" : "Weekly net P&L";
    }
    var toggle = ui.segmented({ label: "Group by", size: "sm", value: "day", options: [{ value: "day", label: "Day" }, { value: "week", label: "Week" }], onChange: function (p) { draw(p, false); } });
    card = chartCard(titleId, "Daily net P&L", null, holder, toggle);
    draw("day", true);
    return card;
  }

  function charts(d) {
    var tz = SJ.store.settings().timeZone;
    var last = d.daily.length ? d.daily[d.daily.length - 1].cumulative : 0;
    var named = function (id, title, rows, empty, anchor) {
      var card = chartCard(id, title, "Reviewed trades", SJ.charts.render("barList", rows, { label: title + ", net P&L per group", empty: empty }));
      return anchor ? A(card, anchor) : card;
    };
    return [
      A(chartCard("chart-cumulative", "Cumulative net P&L", ui.solText(last.toFixed(4) + " SOL"),
        SJ.charts.render("line", d.daily.map(function (x) { return { x: x.day, y: x.cumulative }; }), { label: "Cumulative net P&L by trading day", height: 260, xFormat: dayLabel })), "dash-cumulative"),
      h("div", { class: "dash-charts" },
        periodChart(d),
        chartCard("chart-frequency", "Trades per day", null, SJ.charts.render("bars", d.daily.map(function (x) { return { x: x.day, y: x.trades }; }),
          { label: "Positions entered per trading day", colorMode: "neutral", integer: true, yWidth: 32, yFormat: String, tipName: "Trades", tipValue: String, xFormat: dayLabel })),
        A(chartCard("chart-roi", "Win/loss distribution", "ROI", SJ.charts.render("histogram", d.roiDistribution, { label: "Number of trades per ROI range" })), "dash-roi"),
        chartCard("chart-hour", "P&L by hour of day", tz, SJ.charts.render("bars", d.byHour.map(function (x) { return { x: String(x.hour).padStart(2, "0"), y: x.netPnl }; }),
          { label: "Net P&L by entry hour (" + tz + ")", tipLabel: function (x) { return x.x + ":00"; } })),
        named("chart-strategy", "P&L by strategy", d.byStrategy, "No reviewed trades with a strategy yet.", "dash-gating"),
        named("chart-mistake", "P&L by mistake tag", d.byMistake, "No reviewed trades with a mistake tag yet.")),
    ];
  }

  function recent() {
    var rows = SJ.tradeList.query({}, 5).rows;
    if (!rows.length) return null;
    return A(ui.card({ labelledby: "recent-trades", padding: "lg" }, [
      ui.cardHeader({ id: "recent-trades", title: "Recent trades", size: "label", actions: h("a", { class: "btn btn-ghost btn-sm", href: "#/trades", text: "View all" }) }),
      SJ.tradeTable.table({ rows: rows, timeZone: SJ.store.settings().timeZone }),
    ]), "dash-recent");
  }

  function render() {
    var range = new URLSearchParams(SJ.router.query()).get("range");
    if (!SJ.analytics.RANGE_DAYS.hasOwnProperty(range)) range = "30d";
    var d = SJ.analytics.dashboard(range);
    var redraw = SJ.router.current().redraw;
    SJ.router.watch(SJ.router.refresh);
    return h("div", { class: "page" }, header(range), primary(d, redraw), secondary(d, redraw), SJ.healthPanel.card({ anchor: "dash-health" }), charts(d), recent());
  }

  SJ.screens = SJ.screens || {};
  SJ.screens.dashboard = { render: render };
})();
