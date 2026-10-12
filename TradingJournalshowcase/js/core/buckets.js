// Breakdown groups (port of lib/analytics/buckets.ts): every §6 dimension as a function from a trade to its group(s).
// A bucket is { key, label, order }; a trade can fall into several groups (tags) or none (empty list).
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var M = SJ.metrics;
  var MIN = 60;
  var HOUR = 3600;
  var HOLD = [[0, "<1m"], [MIN, "1–5m"], [5 * MIN, "5–15m"], [15 * MIN, "15–60m"], [HOUR, "1–4h"], [4 * HOUR, ">4h"]];
  var AGE = [[0, "<5m"], [5 * MIN, "5–30m"], [30 * MIN, "30m–2h"], [2 * HOUR, "2–24h"], [24 * HOUR, ">1d"]];
  var WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var VENUES = { pump_curve: "Bonding curve", pumpswap: "PumpSwap", unknown: "Unknown" };
  var TERMINALS = { axiom: "Axiom", padre: "Padre", other: "Other" };
  /** Decided trades with a known entry market cap needed before that breakdown is bucketed (T41). */
  var MIN_MC_TRADES = 50;

  /** The last range whose lower bound is ≤ value (the first one starts at −∞). */
  function inRanges(value, ranges, prefix) {
    var index = 0;
    ranges.forEach(function (r, i) { if (i === 0 || value >= r[0]) index = i; });
    return { key: prefix + ":" + index, label: ranges[index][1], order: index };
  }
  var one = function (b) { return b ? [b] : []; };
  var value = function (prefix, v, label, order) { return v === null || v === undefined ? null : { key: prefix + ":" + v, label: label === undefined ? String(v) : label, order: order || 0 }; };

  function countBucket(n, prefix, cap) {
    var c = cap || 10;
    var v = Math.min(n, c);
    return { key: prefix + ":" + v, label: v === c ? c + "+" : String(v), order: v };
  }

  /** `L3+ … L1, No streak, W1 … W3+`. */
  function streakBucket(streak) {
    if (!streak) return { key: "streak:0", label: "No streak", order: 0 };
    var n = Math.min(streak.length, 3);
    var sign = streak.kind === "win" ? 1 : -1;
    return { key: "streak:" + sign * n, label: (streak.kind === "win" ? "W" : "L") + n + (n === 3 ? "+" : ""), order: sign * n };
  }

  /** Position size (SOL in) quintiles: equal sizes share the group of their first rank. */
  function sizeQuintiles(trades) {
    var sizes = trades.map(function (t) { return t.solIn; }).sort(function (a, b) { return a < b ? -1 : a > b ? 1 : 0; });
    var first = {};
    sizes.forEach(function (s, i) { if (first[String(s)] === undefined) first[String(s)] = i; });
    return function (t) {
      var rank = first[String(t.solIn)];
      if (rank === undefined) return null;
      var q = Math.floor((rank * 5) / sizes.length) + 1;
      return { key: "size:" + q, label: "Q" + q, order: q };
    };
  }

  /** Edges splitting `values` into equal-count groups; ties never straddle an edge, an edge at the minimum is dropped. */
  function quantileEdges(values, buckets) {
    var n = buckets || 5;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var edges = [];
    for (var i = 1; i < n; i++) {
      var edge = sorted[Math.floor((i * sorted.length) / n)];
      if (edge === undefined || edge === sorted[0]) continue;
      if (edges[edges.length - 1] !== edge) edges.push(edge);
    }
    return edges;
  }

  /** Quintile edges of the entry market caps of every decided trade (all time, so groups stay put); null under 50. */
  function entryMcEdges(allTrades) {
    var mcs = allTrades.filter(function (t) { return t.outcome !== null && t.entryMcSol !== null; }).map(function (t) { return t.entryMcSol; });
    return mcs.length < MIN_MC_TRADES ? null : quantileEdges(mcs);
  }

  function mcRangeLabel(index, edges) {
    var f = SJ.format.marketCap;
    var lo = edges[index - 1];
    var hi = edges[index];
    if (lo === undefined) return hi === undefined ? "All" : "<" + f(hi);
    return hi === undefined ? "≥" + f(lo) : f(lo).replace(/ SOL$/, "") + "–" + f(hi);
  }

  function entryMcBucket(t, edges) {
    if (t.entryMcSol === null) return null;
    var index = edges.reduce(function (found, edge, i) { return t.entryMcSol >= edge ? i + 1 : found; }, 0);
    return { key: "mc:" + index, label: mcRangeLabel(index, edges), order: index };
  }

  /** Local clock hour of entry (not shifted by the day start). */
  var hourBucket = function (t, s) {
    var h = M.localHour(t.openedAt, s.timeZone);
    return { key: "hour:" + h, label: (h < 10 ? "0" : "") + h + ":00", order: h };
  };
  /** Weekday of the trade's trading day, so a 02:30 trade with day start 04:00 counts for the day before. */
  var weekdayBucket = function (ctx) { var d = M.weekdayOf(ctx.tradingDay); return { key: "dow:" + d, label: WEEKDAYS[d - 1], order: d }; };

  SJ.buckets = {
    WEEKDAYS: WEEKDAYS, MIN_MC_TRADES: MIN_MC_TRADES, NOT_ENOUGH_MC: "Not enough trades with a known entry market cap yet",
    one: one, value: value, inRanges: inRanges, countBucket: countBucket, streakBucket: streakBucket, sizeQuintiles: sizeQuintiles,
    quantileEdges: quantileEdges, entryMcEdges: entryMcEdges, entryMcBucket: entryMcBucket, mcRangeLabel: mcRangeLabel,
    hourBucket: hourBucket, weekdayBucket: weekdayBucket,
    hold: function (t) { return t.holdingSeconds === null ? null : inRanges(t.holdingSeconds, HOLD, "hold"); },
    age: function (t) { return t.tokenAgeAtEntrySeconds === null ? null : inRanges(t.tokenAgeAtEntrySeconds, AGE, "age"); },
    venue: function (t) { return { key: "venue:" + t.entryVenue, label: VENUES[t.entryVenue], order: Object.keys(VENUES).indexOf(t.entryVenue) }; },
    terminal: function (t) { return t.review && t.review.terminal ? value("terminal", t.review.terminal, TERMINALS[t.review.terminal]) : null; },
  };
})();
