// Analytics (#/analytics, app/(app)/analytics): range picker, the weekly heatmap with its metric toggle, breakdown
// tables for every §6 dimension (n < 10 greyed, comparisons only between groups of 10+), and "After a loss".
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var f = SJ.format;
  var S = SJ.store;
  var BD = SJ.breakdowns;
  var G = SJ.groupTable;
  var A = SJ.explain.anchor;
  var RANGES = [{ value: "30d", label: "30D" }, { value: "90d", label: "90D" }, { value: "180d", label: "180D" }, { value: "all", label: "All" }];
  var DAYS = { "30d": 30, "90d": 90, "180d": 180, all: null };
  var RANGE_TEXT = { "30d": "Last 30 days", "90d": "Last 90 days", "180d": "Last 180 days", all: "All history" };
  var METRICS = [{ value: "pnl", label: "Net P&L" }, { value: "winRate", label: "Win rate" }, { value: "score", label: "Grade" }];
  var TABS = [["time", "Time", ["time", "session"]], ["behaviour", "Behaviour", ["reflection"]], ["distribution", "Distribution", ["shape", "context"]]];
  var view = { tab: "overview", metric: "pnl" };

  function breakdownCard(b) {
    var id = "breakdown-" + b.id;
    var name = function (r) { return h("span", { class: G.thin(r) ? "text-muted" : null, title: G.thin(r) ? "Not enough data: fewer than 10 trades" : null, text: r.bucket.label }); };
    return ui.card({ labelledby: id, className: "an-card" }, [
      ui.cardHeader({ id: id, title: b.title, size: "label", meta: b.reviewedOnly ? "reviewed trades" : null }),
      h("div", { class: "an-body" },
        ui.dataTable({
          caption: b.title, rows: b.rows, rowKey: function (r) { return r.bucket.key; },
          columns: [{ key: "group", header: "Group", cell: name }].concat(G.columns(function (r) { return r; })),
          mobileCard: function (r) { return h("div", { class: "an-mobile" }, h("span", { class: "text-body-md" }, name(r)), G.grid(r)); },
          empty: h("p", { class: "text-body-sm text-muted", text: b.emptyMessage || "No trades in this range." }),
        }),
        G.comparison(b.comparison, b.rows.length)),
    ]);
  }

  /** `reveal`: the cells fade in on this mount (a new page or the Overview tab opened); a metric switch shows at once. */
  function heatmapCard(matrix, zone, reveal) {
    var holder = h("div");
    var paint = function (fade) { SJ.dom.clear(holder).appendChild(SJ.charts.heatmap(matrix, view.metric, fade)); };
    paint(reveal);
    return A(ui.card({ labelledby: "heatmap-title", padding: "lg", className: "an-card" }, [
      ui.cardHeader({ id: "heatmap-title", title: "Weekly heatmap", size: "label", description: "Entry time (" + zone + ") · hatched: fewer than " + BD.HEATMAP_MIN_N + " trades",
        actions: ui.segmented({ label: "Heatmap metric", size: "sm", options: METRICS, value: view.metric, onChange: function (m) { view.metric = m; paint(false); } }) }),
      holder]), "an-heatmap");
  }

  function afterLossCard(groups) {
    var num = function (g, text) { return h("span", { class: SJ.dom.cx("font-mono tabular", !g.enoughData && "text-muted"), text: text }); };
    var label = function (g) { return h("span", { class: g.enoughData ? null : "text-muted" }, g.label, !g.enoughData && h("span", { class: "an-small text-body-sm text-muted", text: "(n too small)" })); };
    var roi = function (g) { return g.avgRoi === null ? num(g, f.DASH) : ui.pnlValue({ value: f.pct(g.avgRoi), sign: g.avgRoi === 0 ? 0 : g.avgRoi > 0 ? 1 : -1, unit: "", neutral: !g.enoughData }); };
    var columns = [
      { key: "group", header: "Group", cell: label },
      { key: "n", header: "Trades", numeric: true, cell: function (g) { return num(g, String(g.n)); } },
      { key: "size", header: "Median size (SOL)", numeric: true, cell: function (g) { return num(g, g.medianSize === null ? f.DASH : f.sol(g.medianSize)); } },
      { key: "gap", header: "Median time since previous close", numeric: true, cell: function (g) { return num(g, f.duration(g.medianGapSeconds)); } },
      { key: "win", header: "Win rate", numeric: true, cell: function (g) { return num(g, g.winRate === null ? f.DASH : f.rate(g.winRate) + "%"); } },
      { key: "roi", header: "Avg ROI", numeric: true, cell: roi },
    ];
    return A(ui.card({ labelledby: "after-loss-title", className: "an-card" }, [
      ui.cardHeader({ id: "after-loss-title", title: "After a loss", size: "label", meta: "closed trades" }),
      h("div", { class: "an-body" },
        h("p", { class: "text-body-sm text-muted", text: "A trade is “after a loss” when the last trade closed before its entry, on the same trading day, was a loss. Every other closed trade in the range is in the second group." }),
        ui.dataTable({
          caption: "After a loss", columns: columns, rows: groups, rowKey: function (g) { return g.id; },
          mobileCard: function (g) {
            return h("div", { class: "an-mobile" }, h("span", { class: "text-body-md" }, label(g)),
              h("dl", { class: "group-grid" }, columns.slice(1).map(function (c) { return h("div", null, h("dt", { class: "text-label-sm text-muted uppercase", text: c.header }), h("dd", { class: "text-body-sm" }, c.cell(g))); })));
          },
        })),
    ]), "an-after-loss");
  }

  function render() {
    SJ.router.watch(SJ.router.refresh);
    var range = new URLSearchParams(SJ.router.query()).get("range");
    if (!DAYS.hasOwnProperty(range)) range = "90d";
    var s = S.settings();
    var all = S.trades();
    var from = S.rangeStart(DAYS[range]);
    var trades = all.filter(function (t) { return !from || t.openedAt >= from; });
    var data = S.data();
    var names = { strategies: S.names("strategies"), emotions: S.names("emotions"), tags: {} };
    data.vocab.tags.forEach(function (t) { names.tags[t.id] = t; });
    var breakdowns = BD.build(trades, S.contexts(), s, names, SJ.buckets.entryMcEdges(all));
    var summary = counts(trades);
    var zone = s.timeZone.split("/").pop().replace(/_/g, " ");
    var grid = function (sections) {
      return A(h("div", { class: "an-grid" }, breakdowns.filter(function (b) { return sections.indexOf(b.section) >= 0; }).map(breakdownCard)), "an-" + sections[0]);
    };
    var picker = ui.segmented({ label: "Period", options: RANGES, value: range, onChange: function (v) { window.location.hash = v === "90d" ? "#/analytics" : "#/analytics?range=" + v; } });
    picker.querySelectorAll(".segment").forEach(function (b) { b.setAttribute("data-refocus", "range-" + b.getAttribute("data-value")); });

    // A redraw (range change, store change) keeps the heatmap still; opening the page or the tab reveals it.
    var fresh = !SJ.router.current().redraw;
    var opened = false;
    var overview = function () {
      var reveal = fresh || opened;
      opened = true;
      return heatmapCard(BD.heatmap(trades, s.timeZone), zone, reveal);
    };
    var items = [{ id: "overview", label: "Overview", content: overview }]
      .concat(TABS.map(function (t) { return { id: t[0], label: t[1], content: function () { return grid(t[2]); } }; }))
      .concat([
        { id: "extension", label: "Extension", content: function () { return A(ui.emptyState({ icon: "search-x", title: "No extension captures in this demo", body: "In the live app this tab breaks trades down by what the Chrome extension saw at the buy: decision time, the badge, warnings bought through and matched posts." }), "an-extension"); } },
        { id: "after-loss", label: "After a loss", content: function () { return afterLossCard(BD.afterLoss(trades, BD.previousDecided(all, s))); } },
      ]);
    return h("div", { class: "page" },
      h("header", { class: "page-header" },
        h("div", null, h("h1", { class: "text-headline-lg", tabindex: "-1", text: "Analytics" }),
          A(h("p", { class: "text-body-sm text-muted", text: RANGE_TEXT[range] + " · " + summary.closed + " closed of " + summary.entered + " entered · groups under 10 trades are greyed out (not enough data)" }), "an-gating")),
        A(h("div", null, picker), "an-range")),
      ui.tabs({ label: "Analytics sections", items: items, value: view.tab, onChange: function (id) { view.tab = id; } }));
  }

  function counts(trades) {
    return { entered: trades.length, closed: trades.filter(function (t) { return t.outcome !== null; }).length };
  }

  SJ.screens = SJ.screens || {};
  SJ.screens.analytics = { render: render, view: view };
})();
