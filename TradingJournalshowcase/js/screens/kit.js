// Hidden #/kit gallery (like the app's dev UI page): every UI kit part with invented sample data.
// Not in the navigation; removed in SH13.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var f = SJ.format;
  var SOL = 1000000000n;
  var L = function (sol) { return BigInt(Math.round(sol * 10000)) * (SOL / 10000n); };

  var ROWS = [
    { key: "a", ticker: "$KELPO", pnl: L(2.64), roi: 0.628, outcome: "win", grade: "A", opened: "2026-09-28T14:22:00Z", hold: 734 },
    { key: "b", ticker: "$DRIFTA", pnl: 0n, roi: 0, outcome: "breakeven", grade: "B", opened: "2026-09-27T09:05:00Z", hold: 95 },
    { key: "c", ticker: "$NIMBO", pnl: L(-5.6), roi: -0.861, outcome: "loss", grade: "F", opened: "2026-09-26T21:47:00Z", hold: 11400 },
    { key: "d", ticker: "$OPENLY", pnl: 0n, roi: null, outcome: null, grade: null, opened: "2026-09-25T07:30:00Z", hold: null },
  ];
  var DAILY = [0.4, -0.2, 0.7, 0.1, -0.9, 0.3, 1.2, -0.1, 0.5, 0, -0.35, 0.8, 0.25, -0.6, 0.15, 0.9, -0.05, 0.45].map(function (pnl, i) {
    return { day: "2026-09-" + String(i + 10).padStart(2, "0"), pnl: pnl, trades: [3, 1, 4, 2, 6, 2, 5, 1, 3, 0, 2, 4, 3, 5, 1, 4, 2, 3][i] };
  });
  var BINS = [["< -50%", 4, -1], ["-50…-20%", 7, -1], ["-20…-5%", 9, -1], ["±5%", 5, 0], ["5…20%", 6, 1], ["20…50%", 5, 1], ["50…100%", 3, 1], ["> 100%", 2, 1]];
  var STRATEGIES = [["Early entry", 1.42, true], ["Breakout retest", -0.38, true], ["Volume spike", 0.21, false], ["Late momentum", -1.15, true]];
  var DEMO_WALLET = "Demo0Wa11et0Fake0Only0Not0Rea100000000000";

  function section(title, children, wide, explain) {
    var card = ui.card({ label: title, padding: "lg" }, [ui.cardHeader({ title: title }), h("div", { class: wide ? "kit-stack" : "kit-row" }, children)]);
    return explain ? SJ.explain.anchor(card, explain) : card;
  }
  var toast = function (title, tone, body) { return function () { SJ.overlay.toast({ title: title, tone: tone, body: body }); }; };

  function buttons() {
    return section("Buttons", [
      ui.button({ label: "Log reflection", variant: "primary", icon: "plus" }),
      ui.button({ label: "Export CSV", icon: "download" }),
      ui.button({ label: "Reset filters", variant: "ghost" }),
      ui.button({ label: "Write off", variant: "danger" }),
      ui.button({ label: "Save & next", variant: "primary", kbd: "Enter" }),
      ui.button({ label: "Small", size: "sm" }),
      ui.button({ label: "Disabled", disabled: true }),
      ui.iconButton({ label: "Search", icon: "search", variant: "secondary" }),
    ]);
  }

  function stats() {
    return section("Stat cards", [
      ui.statCard({ label: "Net P&L", value: f.sol(L(3.42), { signed: true }), unit: "SOL", tone: "profit", delta: "+18.4% vs prev", deltaTone: "profit", hero: true, sub: ui.fiatSub(f.eur(512.3, { signed: true }), "profit") }),
      ui.statCard({ label: "Win rate", value: f.rate(0.54), unit: "%" }),
      ui.statCard({ label: "Profit factor", value: f.profitFactor(1.18) }),
      ui.statCard({ label: "Worst day", value: f.sol(L(-0.92), { signed: true }), unit: "SOL", tone: "loss" }),
      ui.statCard({ label: "Avg ROI", value: f.DASH }),
      ui.card({ label: "Compact strip", padding: "none", className: "kit-strip" }, [
        ui.statCard({ label: "Fees", value: f.sol(L(0.0841)), unit: "SOL", compact: true }),
        ui.statCard({ label: "Trades", value: "42", compact: true }),
      ]),
    ], false, "kit-money");
  }

  function chips() {
    return section("Chips and badges", [
      ui.chip({ label: "FOMO entry", kind: "mistake", selected: true }),
      ui.chip({ label: "Waited for pullback", kind: "strength", selected: true }),
      ui.chip({ label: "Early entry", selected: false }),
      ui.tag({ label: "Outcome: Win", onRemove: function () {}, removeLabel: "Remove outcome filter" }),
      ui.tag({ label: "Chased", kind: "mistake" }),
      ui.outcomeBadge("win"), ui.outcomeBadge("loss"), ui.outcomeBadge("breakeven"), ui.outcomeBadge(null),
      ["A", "B", "C", "D", "F"].map(ui.gradeBadge), ui.gradeBadge(null),
      ui.badge("Pump"), ui.badge("Unsupported", "warning"), ui.badge("3", "accent", "3 to review"), ui.badge("Archived"),
      ui.statusDot("Reviewed", "profit"), ui.statusDot("Needs review", "loss"), ui.statusDot("Open"),
    ]);
  }

  function forms() {
    return section("Form controls", [
      h("div", { class: "kit-grid kit-grid-3" }, [
        ui.input({ label: "Search", search: true, placeholder: "Ticker or mint" }),
        ui.input({ label: "Breakeven band", hint: "Percent of SOL in", value: "1.0" }),
        ui.input({ label: "Wallet", error: "Not a valid Solana address", value: "abc" }),
        ui.select({ label: "Emotion", placeholder: "Pick one", options: [{ value: "calm", label: "Calm" }, { value: "fomo", label: "FOMO" }, { value: "tilt", label: "Tilted" }] }),
        ui.textarea({ label: "Takeaway", placeholder: "One line you want to remember", rows: 3 }),
      ]),
      h("div", { class: "kit-row" }, [
        ui.segmented({ label: "Period", value: "30d", options: [{ value: "7d", label: "7D" }, { value: "30d", label: "30D" }, { value: "90d", label: "90D" }, { value: "all", label: "All" }] }),
        ui.segmented({ label: "Confidence", size: "sm", value: "3", options: ["1", "2", "3", "4", "5"].map(function (v) { return { value: v, label: v }; }) }),
      ]),
      h("div", { class: "kit-narrow" }, ui.gradePicker({ value: "B" })),
      h("div", { class: "kit-narrow kit-stack-tight" }, [
        ui.checkRow({ label: "Entered with a plan", checked: true }),
        ui.checkRow({ label: "Max loss per trade respected", checked: false, alert: true, meta: "auto" }),
        ui.checkRow({ label: "Took partial profit", checked: false }),
      ]),
    ], true);
  }

  function tabsSection() {
    var panel = function (text) { return function () { return h("p", { class: "text-body-sm text-muted", text: text }); }; };
    return section("Tabs", [ui.tabs({ label: "Analytics views", items: [
      { id: "overview", label: "Overview", content: panel("Overview panel") },
      { id: "time", label: "Time", content: panel("Time panel") },
      { id: "behaviour", label: "Behaviour", content: panel("Behaviour panel") },
      { id: "after-loss", label: "After a loss", content: panel("After a loss panel") },
    ] })], true);
  }

  function table() {
    var state = { sort: "desc", page: 2 };
    var holder = h("div", { class: "kit-stack" });
    function paint() {
      var rows = ROWS.slice().sort(function (a, b) { var d = a.pnl < b.pnl ? -1 : a.pnl > b.pnl ? 1 : 0; return state.sort === "asc" ? d : -d; });
      SJ.dom.clear(holder).appendChild(ui.dataTable({
        caption: "Sample trades",
        rows: rows,
        rowKey: function (r) { return r.key; },
        highlight: function (r) { return r.key === "c"; },
        columns: [
          { key: "token", header: "Token", cell: function (r) { return h("span", { class: "kit-token" }, ui.tokenAvatar({ symbol: r.ticker, outcome: r.outcome }), r.ticker); } },
          { key: "opened", header: "Opened (Dublin)", numeric: true, cell: function (r) { return f.localTime(new Date(r.opened), "Europe/Dublin", "MMM d, HH:mm"); } },
          { key: "hold", header: "Hold", numeric: true, cell: function (r) { return f.duration(r.hold); } },
          { key: "pnl", header: "Net P&L", numeric: true, sort: state.sort, onSort: function () { state.sort = state.sort === "desc" ? "asc" : "desc"; paint(); }, cell: function (r) { return r.outcome ? ui.pnl(r.pnl) : ui.pnlValue({ value: "", sign: null }); } },
          { key: "roi", header: "ROI", numeric: true, cell: function (r) { return r.roi === null ? h("span", { class: "text-muted", text: f.DASH }) : h("span", { class: ui.TONE_TEXT[ui.toneOf(r.roi)], text: f.pct(r.roi) }); } },
          { key: "outcome", header: "Outcome", align: "center", cell: function (r) { return ui.outcomeBadge(r.outcome); } },
          { key: "grade", header: "Grade", align: "center", cell: function (r) { return ui.gradeBadge(r.grade); } },
        ],
        mobileCard: function (r) { return h("div", { class: "kit-card-row" }, h("span", { class: "kit-token" }, ui.tokenAvatar({ symbol: r.ticker, outcome: r.outcome }), r.ticker), ui.outcomeBadge(r.outcome)); },
      }));
      holder.appendChild(ui.pagination({ page: state.page, pageCount: 12, pageSize: 25, total: 288, noun: "trades", onPage: function (p) { state.page = p; paint(); } }));
    }
    paint();
    return section("Data table and pagination", [holder], true);
  }

  function values() {
    return section("Values", [
      ui.pnl(L(0.4)), ui.pnl(L(-11.25)), ui.pnl(0n), ui.pnlValue({ value: "", sign: null }),
      ui.pnlValue({ value: f.pct(0.172), sign: 1, unit: "" }),
      h("span", { class: "kit-stack-tight" }, ui.pnl(L(1.2)), ui.fiatSub(f.eur(180.44, { signed: true }), "profit")),
      ui.solText(f.sol(L(12.5)) + " SOL", "font-mono"), ui.solText(f.DASH),
      h("span", { class: "text-data-sm", text: f.marketCap(45678) + " · " + f.price(0.0000000284612) + " · " + f.tokenQty(1250000500000n, 6) }),
      ui.address({ value: DEMO_WALLET, label: "wallet address", explorer: toast("Explorer link", "info", "In the live app this opens the address on a block explorer.") }),
      ui.tokenAvatar({ symbol: "$KELPO", outcome: "win" }), ui.tokenAvatar({ symbol: "$NIMBO", outcome: "loss", size: "lg" }), ui.tokenAvatar({ symbol: null, outcome: null }),
      h("div", { class: "kit-narrow kit-stack-tight" }, ui.progress({ value: 64, label: "Import progress" }), ui.progress({ value: 81, label: "Rules followed", tone: "profit" })),
    ]);
  }

  function chartCard(title, chart, meta) {
    return ui.card({ label: title, padding: "lg" }, [ui.cardHeader({ title: title, size: "label", meta: meta }), chart]);
  }

  function charts() {
    var total = 0;
    var cumulative = DAILY.map(function (d) { total += d.pnl; return { x: d.day, y: Number(total.toFixed(4)) }; });
    var daily = DAILY.map(function (d) { return { x: d.day, y: d.pnl }; });
    var c = SJ.charts;
    return section("Charts", [h("div", { class: "kit-grid" }, [
      chartCard("Cumulative net P&L", c.render("line", cumulative, { label: "Cumulative net P&L (sample)", height: 260, xFormat: c.shortDay }), ui.solText(total.toFixed(4) + " SOL")),
      chartCard("Cumulative with area", c.render("line", cumulative, { label: "Cumulative net P&L with area (sample)", area: true, xFormat: c.shortDay })),
      chartCard("Daily net P&L", c.render("bars", daily, { label: "Net P&L per day (sample)", xFormat: c.shortDay })),
      chartCard("Trades per day", c.render("bars", DAILY.map(function (d) { return { x: d.day, y: d.trades }; }), { label: "Positions entered per day (sample)", colorMode: "neutral", integer: true, yWidth: 32, yFormat: String, xFormat: c.shortDay, tipName: "Trades", tipValue: String })),
      chartCard("Win/loss distribution", c.render("histogram", BINS.map(function (b) { return { label: b[0], count: b[1], sign: b[2] }; }), { label: "Trades per ROI range (sample)" }), "ROI"),
      chartCard("P&L by strategy", c.render("barList", STRATEGIES.map(function (s) { return { label: s[0] + " (" + (s[2] ? 14 : 4) + ")", value: s[1], enough: s[2] }; }), { label: "Net P&L per strategy (sample)" }), "Reviewed trades"),
      chartCard("Empty state", c.render("bars", [], { label: "No data", empty: "No reviewed trades with a strategy yet." })),
    ])], true);
  }

  function heatmapSection() {
    var matrix = SJ.charts.HEATMAP_DAYS.map(function (_, d) {
      return Array.apply(null, Array(SJ.charts.HEATMAP_BLOCKS)).map(function (__, b) {
        var n = (d * 7 + b * 3) % 6;
        var pnl = n === 0 ? 0 : Number((Math.sin(d * 1.7 + b) * 0.9).toFixed(4));
        return { n: n, netPnl: pnl, winRate: n === 0 ? null : (d + b) % 5 / 4, avgScore: n === 0 ? null : (b % 5) };
      });
    });
    var holder = h("div");
    var paint = function (metric) { SJ.dom.clear(holder).appendChild(SJ.charts.heatmap(matrix, metric)); };
    var toggle = ui.segmented({ label: "Heatmap metric", size: "sm", value: "pnl", onChange: paint, options: [{ value: "pnl", label: "Net P&L" }, { value: "winRate", label: "Win rate" }, { value: "score", label: "Grade" }] });
    paint("pnl");
    return ui.card({ label: "Weekly heatmap", padding: "lg" }, [ui.cardHeader({ title: "Weekly heatmap", size: "label", description: "Entry time (Dublin) · hatched: fewer than 3 trades", actions: toggle }), holder]);
  }

  function calendarSection() {
    var days = {};
    DAILY.forEach(function (d) { if (d.trades) days[d.day] = { netPnl: L(d.pnl), entered: d.trades }; });
    var selected = "2026-09-16";
    var holder = h("div");
    var paint = function () {
      SJ.dom.clear(holder).appendChild(SJ.charts.calendar(SJ.charts.buildMonth("2026-09", days, ["2026-09-10", "2026-09-12", "2026-09-16", "2026-09-22"]), {
        selectedDay: selected, today: "2026-09-27", onSelect: function (day) { selected = day; paint(); },
      }));
    };
    paint();
    return section("Calendar (September 2026)", [holder], true, "kit-calendar");
  }

  /** SJ.sim on a sync (progress steps) and on the Coach (a sample failure first, then Retry). */
  function simulations() {
    var status = h("p", { class: "text-body-sm text-muted", "aria-live": "polite", text: "Not started." });
    var bar = h("div", { class: "kit-narrow" }, ui.progress({ label: "Sync progress", value: 0 }));
    var sync = ui.button({ label: "Simulate a sync", icon: "refresh-cw", onclick: function () {
      sync.disabled = true;
      SJ.sim.run({
        action: "Sync", steps: ["Fetching transactions", "Parsing events", "Rebuilding positions"],
        live: "the server fetches new transactions from the data provider, parses them and rebuilds the positions they touch.",
        onProgress: function (fraction, step) {
          SJ.dom.clear(bar).appendChild(ui.progress({ label: "Sync progress", value: fraction * 100 }));
          status.textContent = step ? step + "…" : "Done.";
        },
      }).then(function () { sync.disabled = false; });
    } });

    var coachLive = "the server sends the review and the position's numbers to the AI service and checks the answer before showing it.";
    var coach = h("div", { class: "kit-stack-tight kit-narrow", "aria-live": "polite" });
    var attempts = 0;
    function generate() {
      attempts += 1;
      SJ.dom.clear(coach).appendChild(h("p", { class: "text-body-sm text-muted", text: "Generating…" }));
      SJ.sim.run({ action: "Coach", toast: false, ms: 900, fail: attempts === 1, error: "The AI service did not answer in time (sample failure).", live: coachLive })
        .then(function (r) {
          if (r.cancelled) return;
          SJ.dom.clear(coach).append.apply(coach, r.ok
            ? [h("div", null, ui.badge("Sample output", "accent")), h("p", { class: "text-body-md", text: "Your review calls the entry planned, but no strategy is chosen for this position." }), SJ.sim.liveNote(coachLive)]
            : [h("p", { class: "text-body-sm text-loss", text: r.error }), ui.button({ label: "Retry", size: "sm", onclick: generate }), SJ.sim.liveNote(coachLive)]);
        });
    }
    return section("Simulated server actions", [
      h("div", { class: "kit-stack-tight kit-narrow" }, sync, bar, status),
      h("div", { class: "kit-stack-tight kit-narrow" }, ui.button({ label: "Coach: generate", icon: "lightbulb", onclick: generate }), coach),
    ], true, "kit-sim");
  }

  function overlays() {
    var footer = function (close, label) { return [ui.button({ label: "Cancel", variant: "ghost", onclick: close }), ui.button({ label: label, variant: "danger", onclick: close })]; };
    return section("Overlays and feedback", [
      ui.button({ label: "Open modal", onclick: function () {
        var m = SJ.overlay.modal({ title: "Write off position", description: "The remaining basis is booked as a loss.", body: h("p", { class: "text-body-md", text: "This creates a correction; raw data is not changed." }), footer: footer(function () { m.close(); }, "Write off") });
      } }),
      ui.button({ label: "Open drawer", onclick: function () {
        SJ.overlay.drawer({ title: "Friday, 26 Sep", body: h("p", { class: "text-body-md", text: "Day inspector content." }) });
      } }),
      ui.button({ label: "Success toast", onclick: toast("Review saved", "success") }),
      ui.button({ label: "Error toast", onclick: toast("Sync failed", "error", "The data provider returned 502.") }),
      ui.button({ label: "Info toast", onclick: toast("Demo only", "info", "Nothing was sent anywhere.") }),
    ]);
  }

  function emptyAndLoading() {
    return section("Empty and loading", [h("div", { class: "kit-grid" }, [
      ui.emptyState({ icon: "inbox", title: "Inbox zero", body: "Every closed trade has a review.", action: ui.button({ label: "Open trades", size: "sm" }) }),
      ui.skeletonGroup("Loading trades", [ui.skeleton(), ui.skeleton(), ui.skeleton("width: 66%")]),
    ])], true);
  }

  SJ.screens = SJ.screens || {};
  SJ.screens.kit = {
    render: function () {
      return h("div", { class: "page" },
        h("header", { class: "page-header" }, h("div", null,
          h("h1", { class: "text-headline-lg", tabindex: "-1", text: "UI kit" }),
          h("p", { class: "text-body-sm text-muted", text: "Every shared part of the demo, drawn with invented sample data." }))),
        buttons(), stats(), chips(), forms(), tabsSection(), table(), values(), charts(), heatmapSection(), calendarSection(), simulations(), overlays(), emptyAndLoading());
    },
  };
})();
