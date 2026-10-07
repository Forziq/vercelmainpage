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
  var COUNT_MS = 600;
  var STAGGER_MS = 40;
  var counted = false;

  var signed = function (v) { return f.sol(v, { signed: true }); };
  var pnlTone = function (v) { return v === null ? "default" : ui.toneOf(f.signOf(v)); };
  var dayLabel = function (day) { return SJ.charts.shortDay(day); };
  var eurLine = function (units, pnl, show) {
    var v = show === false ? null : units;
    return ui.fiatSub(SJ.fiat.label(v, pnl), pnl ? ui.toneOf(SJ.fiat.sign(v)) : null);
  };

  /**
   * Counts a formatted number up from zero on the first visit, keeping its sign and decimals. Display only: screen
   * readers get the final value at once, the last frame is exactly `text`, and "—" or "∞" are shown as they are.
   */
  function ticker(text, index) {
    var m = /^([+-]?)(\d+)(\.\d+)?$/.exec(text);
    if (counted || !m || SJ.overlay.reducedMotion()) return h("span", { text: text });
    var el = h("span", { "aria-hidden": "true" });
    var target = Number(m[2] + (m[3] || ""));
    var decimals = m[3] ? m[3].length - 1 : 0;
    var start = null;
    function frame(now) {
      if (start === null) start = now + index * STAGGER_MS;
      var p = Math.max(0, Math.min(1, (now - start) / COUNT_MS));
      el.textContent = p >= 1 ? text : m[1] + (target * (1 - Math.pow(1 - p, 3))).toFixed(decimals);
      if (p < 1) requestAnimationFrame(frame);
    }
    el.textContent = m[1] + (0).toFixed(decimals);
    requestAnimationFrame(frame);
    return h("span", null, h("span", { class: "sr-only", text: text }), el);
  }

  function header(range) {
    var picker = ui.segmented({ label: "Period", options: RANGES, value: range, onChange: function (v) { window.location.hash = v === "30d" ? "#/dashboard" : "#/dashboard?range=" + v; } });
    picker.querySelectorAll(".segment").forEach(function (b) { b.setAttribute("data-refocus", "range-" + b.getAttribute("data-value")); });
    return h("header", { class: "page-header" },
      h("div", null, h("h1", { class: "text-headline-lg", tabindex: "-1", text: "Dashboard" }),
        h("p", { class: "text-body-sm text-muted", text: RANGE_TEXT[range] + " · positions by entry trading day" })),
      A(h("div", null, picker), "dash-range"));
  }

  function primary(d) {
    var s = d.summary;
    var none = s.trades === 0;
    return h("div", { class: "dash-primary" },
      A(ui.statCard({ hero: true, className: "dash-hero", label: "Net P&L", value: ticker(signed(s.netPnl), 0), unit: "SOL", tone: pnlTone(none ? null : s.netPnl), sub: eurLine(d.eur.netPnl, true, !none), delta: s.trades + " closed" }), "dash-net"),
      A(ui.statCard({ label: "Win rate", value: ticker(f.rate(s.winRate), 1), unit: s.winRate === null ? null : "%", delta: s.wins + "W · " + s.losses + "L · " + s.breakevens + " BE" }), "dash-winrate"),
      ui.statCard({ label: "Profit factor", value: ticker(f.profitFactor(s.profitFactor), 2) }),
      A(ui.statCard({ label: "Trades", value: ticker(String(d.entered), 3), delta: d.open > 0 ? d.open + " open" : null }), "dash-countup"),
      // No count-up on this card (owner decision 2026-10-03), only the entrance.
      A(h("a", { class: "stat-link", href: "#/inbox", "aria-label": d.needsReview + " trades need review. Open the Inbox" },
        ui.statCard({ label: "Needs review", value: String(d.needsReview), delta: "Open Inbox →" })), "dash-review"));
  }

  function group(title, stats) {
    return ui.card({ label: title, padding: "none", className: "stat-group" }, [h("h2", { class: "stat-group-title text-label-sm text-muted", text: title }), h("div", { class: "stat-group-grid" }, stats)]);
  }
  var stat = function (o) { return ui.statCard(Object.assign({ compact: true }, o)); };

  function secondary(d) {
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

  var HEALTH = [
    ["parseFailures", "Parse failures", "#/settings", "Transactions the parser could not read; listed under Sync status."],
    ["unsupportedEvents", "Unsupported events", "#/settings", "Protocols or pairs the parser skips; they are left out of every trade."],
    ["missingRates", "Missing EUR rates", "#/settings", "Events with no SOL/EUR rate; each sync fetches more, minutes with no candle stay blank."],
    ["unlinkedRent", "Unlinked rent", "#/settings/sol", "Rent paid or refunded that no trade holds."],
    ["unlabelledSolIn", "Unlabelled incoming SOL", "#/settings/sol", "Label the sender once (cashback, deposit…); it applies to every payment."],
    ["orphanFees", "Orphan fees", "#/settings", "Failed swaps no trade holds, e.g. of a voided trade; their fees still count."],
    ["writtenOff", "Written-off trades", "#/trades?status=written_off", "Basis written off in the journal; check each one is meant."],
    ["unreviewed", "Unreviewed trades", "#/inbox", "Finished trades waiting in the Inbox."],
  ];

  /** Every check with a count and a link to where it is fixed; all of the owner's wallets count. */
  function health() {
    var counts = SJ.store.health();
    var open = HEALTH.filter(function (r) { return counts[r[0]] > 0; });
    var body = open.length === 0
      ? h("p", { class: "health-clear text-body-md" }, SJ.dom.icon("check-circle", "text-muted"), "Everything looks complete")
      : h("ul", { class: "health-list" }, open.map(function (r) {
        return h("li", null, h("a", { href: r[2], class: "health-row" },
          h("span", { class: "health-count font-mono text-data-md text-warning", text: String(counts[r[0]]) }),
          h("span", { class: "health-text" },
            h("span", { class: "text-body-md text-fg" }, r[1], r[0] === "orphanFees" && h("span", { class: "text-muted" }, " · ", ui.solAmount(f.sol(counts.orphanFeeLamports, { decimals: 6 }), "font-mono text-data-sm"))),
            h("span", { class: "text-body-sm text-muted", text: r[3] })),
          SJ.dom.icon("chevron-right", "text-muted")));
      }));
    return A(ui.card({ labelledby: "data-health-title" }, [
      ui.cardHeader({ id: "data-health-title", title: "Data health", size: "label", meta: open.length ? open.length + " of " + HEALTH.length + " need attention" : null }),
      body,
      open.length > 0 && open.length < HEALTH.length && h("p", { class: "health-foot text-body-sm text-muted", text: "The other " + (HEALTH.length - open.length) + " checks are clear." }),
    ]), "dash-health");
  }

  function chartCard(id, title, meta, content, actions) {
    return ui.card({ labelledby: id, padding: "lg", className: "chart-card" }, [ui.cardHeader({ id: id, title: title, size: "label", meta: meta, actions: actions }), content]);
  }

  function periodChart(d) {
    var holder = h("div");
    var titleId = "chart-period";
    var card;
    function draw(period) {
      var data = period === "day" ? d.daily.map(function (x) { return { x: x.day, y: x.netPnl }; }) : d.weekly.map(function (w) { return { x: w.week, y: w.netPnl }; });
      SJ.dom.clear(holder).appendChild(SJ.charts.render("bars", data, { label: "Net P&L per " + period, xFormat: dayLabel, tipLabel: function (x) { return period === "week" ? "Week of " + dayLabel(x.x) : dayLabel(x.x); } }));
      if (card) card.querySelector("#" + titleId).textContent = period === "day" ? "Daily net P&L" : "Weekly net P&L";
    }
    var toggle = ui.segmented({ label: "Group by", size: "sm", value: "day", options: [{ value: "day", label: "Day" }, { value: "week", label: "Week" }], onChange: draw });
    card = chartCard(titleId, "Daily net P&L", null, holder, toggle);
    draw("day");
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
    SJ.router.watch(SJ.router.refresh);
    var page = h("div", { class: "page" }, header(range), primary(d), secondary(d), health(), charts(d), recent());
    counted = true;
    return page;
  }

  SJ.screens = SJ.screens || {};
  SJ.screens.dashboard = { render: render };
})();
