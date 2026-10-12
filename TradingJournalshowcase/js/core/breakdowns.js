// Analytics page logic (ports of lib/analytics/{breakdowns,heatmap,tilt}.ts): every §6 breakdown with n ≥ 10 gating
// and the best-vs-worst comparison, the weekday × two-hour heatmap and the "After a loss" groups. Descriptive only.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var M = SJ.metrics;
  var B = SJ.buckets;
  var A = SJ.analytics;
  var MIN_SAMPLE = 10;
  var HEATMAP_MIN_N = 3;
  var BLOCKS = 12;

  /** Among groups with n ≥ 10, the ones with the highest and lowest average net P&L; null with fewer than two. */
  function bestVsWorst(rows) {
    var ok = rows.filter(function (r) { return r.enoughData && r.summary.expectancy !== null; });
    if (ok.length < 2) return null;
    var best = ok[0], worst = ok[0];
    ok.forEach(function (r) {
      if (r.summary.expectancy > best.summary.expectancy) best = r;
      if (r.summary.expectancy < worst.summary.expectancy) worst = r;
    });
    if (best === worst) return null;
    var a = best.summary, b = worst.summary;
    return {
      a: best, b: worst,
      winRateDiff: a.winRate === null || b.winRate === null ? null : a.winRate - b.winRate,
      avgNetPnlDiff: a.expectancy - b.expectancy,
      avgRoiDiff: a.avgRoi === null || b.avgRoi === null ? null : a.avgRoi - b.avgRoi,
    };
  }

  /**
   * Every §6 breakdown over `trades` (already the range). `contexts` and `mcEdges` come from all trades, so session
   * numbers, streaks and market-cap groups do not shift at the edge of the range. names: { strategies, emotions, tags }.
   */
  function build(trades, contexts, s, names, mcEdges) {
    var ctx = function (t) { return contexts[t.key] || null; };
    var size = B.sizeQuintiles(trades.filter(function (t) { return t.outcome !== null; }));
    var named = function (prefix, map, id) { return id ? B.value(prefix, id, map[id] || "Unknown") : null; };
    var tags = function (polarity, prefix) {
      return function (t) {
        return ((t.review && t.review.tagIds) || []).filter(function (id) { return names.tags[id] && names.tags[id].polarity === polarity; })
          .map(function (id) { return B.value(prefix, id, names.tags[id].name); });
      };
    };
    var withCtx = function (fn) { return function (t) { return ctx(t) ? fn(ctx(t)) : null; }; };
    var grade = function (t) { return t.review && t.review.grade ? B.value("grade", t.review.grade, t.review.grade, 4 - M.GRADE_SCORE[t.review.grade]) : null; };
    var specs = [
      ["hour", "Hour of day", "time", function (t) { return B.hourBucket(t, s); }],
      ["weekday", "Day of week (trading day)", "time", withCtx(B.weekdayBucket)],
      ["day-number", "Trade # in the day", "session", withCtx(function (c) { return B.countBucket(c.numberInDay, "day#"); })],
      ["session-number", "Trade # in the session", "session", withCtx(function (c) { return B.countBucket(c.numberInSession, "session#"); })],
      ["already-taken", "Trades already taken that day", "session", withCtx(function (c) { return B.countBucket(c.alreadyTaken, "taken"); })],
      ["streak", "Streak before entry", "session", withCtx(function (c) { return B.streakBucket(c.streakBefore); })],
      ["hold", "Holding duration", "shape", B.hold],
      ["size", "Position size (SOL in, quintiles)", "shape", size],
      ["confidence", "Confidence", "reflection", function (t) { var c = t.review ? t.review.confidence : null; return B.value("conf", c, undefined, c || 0); }, true],
      ["emotion", "Emotional state", "reflection", function (t) { return named("emotion", names.emotions, t.review && t.review.emotionId); }, true],
      ["strategy", "Strategy", "reflection", function (t) { return named("strategy", names.strategies, t.review && t.review.strategyId); }, true],
      ["mistakes", "Mistake tags", "reflection", tags("mistake", "mistake"), true],
      ["positives", "Strength tags", "reflection", tags("positive", "positive"), true],
      ["grade", "Execution grade", "reflection", grade, true],
      ["terminal", "Terminal", "reflection", B.terminal, true],
      ["venue", "Entry venue", "context", B.venue],
      ["mc", "Entry market cap (SOL)", "context", function (t) { return mcEdges ? B.entryMcBucket(t, mcEdges) : null; }],
      ["age", "Token age at entry", "context", B.age],
    ];
    return specs.map(function (spec) {
      var fn = spec[3];
      var rows = A.groupBy(trades, function (t) { var b = fn(t); return Array.isArray(b) ? b : B.one(b); }, !!spec[4]);
      return {
        id: spec[0], title: spec[1], section: spec[2], reviewedOnly: !!spec[4], rows: rows, comparison: bestVsWorst(rows),
        emptyMessage: spec[0] === "mc" && !mcEdges ? B.NOT_ENOUGH_MC : null,
      };
    });
  }

  // ---- Weekly heatmap (§7): calendar weekday and clock time of entry, not the trading day.

  function slot(at, tz) {
    var date = M.tradingDay(at, tz, 0);
    return { day: M.weekdayOf(date) - 1, block: Math.floor(M.localHour(at, tz) / 2) };
  }

  function heatmap(trades, tz) {
    var groups = B.WEEKDAYS.map(function () { return Array.apply(null, Array(BLOCKS)).map(function () { return []; }); });
    trades.forEach(function (t) {
      if (t.outcome === null) return;
      var p = slot(t.openedAt, tz);
      groups[p.day][p.block].push(t);
    });
    return groups.map(function (row) {
      return row.map(function (members) {
        var s = M.summarize(members);
        return { n: s.trades, netPnl: Number(s.netPnl) / 1e9, winRate: s.winRate, avgScore: s.avgExecutionScore };
      });
    });
  }

  // ---- After a loss (T43): the previous decided trade on the same trading day, closed at or before the entry.

  function previousDecided(trades, s) {
    var byDay = {};
    trades.forEach(function (t) { var d = M.tradingDay(t.openedAt, s.timeZone, s.dayStartHour); (byDay[d] = byDay[d] || []).push(t); });
    var out = {};
    Object.keys(byDay).forEach(function (d) {
      var closed = byDay[d].filter(function (t) { return t.outcome !== null && t.closedAt; })
        .sort(function (a, b) { return b.closedAt - a.closedAt || (a.key < b.key ? 1 : -1); });
      byDay[d].forEach(function (t) {
        out[t.key] = closed.filter(function (c) { return c.key !== t.key && c.closedAt <= t.openedAt; })[0] || null;
      });
    });
    return out;
  }

  function median(sorted, half) {
    if (!sorted.length) return null;
    var mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : half(sorted[mid - 1], sorted[mid]);
  }

  function tiltGroup(id, label, members, prev) {
    var s = M.summarize(members);
    var gaps = members.map(function (t) { var p = prev[t.key]; return p && p.closedAt ? (t.openedAt - p.closedAt) / 1000 : null; })
      .filter(function (g) { return g !== null; }).sort(function (a, b) { return a - b; });
    var sizes = members.map(function (t) { return t.solIn; }).sort(function (a, b) { return a < b ? -1 : a > b ? 1 : 0; });
    return {
      id: id, label: label, n: s.trades, enoughData: s.trades >= MIN_SAMPLE, winRate: s.winRate, avgRoi: s.avgRoi,
      medianSize: median(sizes, function (a, b) { return (a + b) / 2n; }), medianGapSeconds: median(gaps, function (a, b) { return (a + b) / 2; }),
    };
  }

  /** Decided trades whose previous decided trade was a loss, against every other decided trade. */
  function afterLoss(trades, prev) {
    var decided = trades.filter(function (t) { return t.outcome !== null; });
    var lost = function (t) { return !!prev[t.key] && prev[t.key].outcome === "loss"; };
    return [tiltGroup("after-loss", "After a loss", decided.filter(lost), prev), tiltGroup("other", "All other trades", decided.filter(function (t) { return !lost(t); }), prev)];
  }

  SJ.breakdowns = {
    MIN_SAMPLE: MIN_SAMPLE, HEATMAP_MIN_N: HEATMAP_MIN_N, build: build, bestVsWorst: bestVsWorst, slot: slot, heatmap: heatmap,
    previousDecided: previousDecided, afterLoss: afterLoss,
  };
})();
