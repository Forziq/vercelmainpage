// Weekly and monthly review snapshots (reflection-analytics.md §8), ported from the app's weekly.ts / monthly.ts so a
// demo "Recalculate" freezes the same figures, in the same string form, as the app stores.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var M = SJ.metrics;
  var WEEK_MIN_STRATEGY_N = 3;
  var RECURRING_WEEKS = 4;
  var RECURRING_MIN_WEEKS = 2;

  var weekStartOf = function (day) { return M.shiftDay(day, 1 - M.weekdayOf(day)); };
  var monthStartOf = function (day) { return day.slice(0, 7) + "-01"; };
  function shiftMonth(monthStart, months) {
    var d = new Date(monthStart + "T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + months, 1);
    return d.toISOString().slice(0, 10);
  }
  var monthEndOf = function (monthStart) { return M.shiftDay(shiftMonth(monthStart, 1), -1); };
  var dayOf = function (t, s) { return M.tradingDay(t.openedAt, s.timeZone, s.dayStartHour); };
  var weekOfTrade = function (t, s) { return weekStartOf(dayOf(t, s)); };
  var monthOfTrade = function (t, s) { return monthStartOf(dayOf(t, s)); };
  var cmpBig = function (a, b) { return a < b ? -1 : a > b ? 1 : 0; };

  function tradeRef(t, labels) {
    return {
      key: t.key, label: labels[t.key] || t.key, outcome: t.outcome, netPnl: t.netPnl.toString(),
      roi: t.roiParts ? M.ratioText(t.roiParts.num, t.roiParts.den) : null, grade: (t.review && t.review.grade) || null,
    };
  }

  /** The first trade `better` prefers over every other one (the earliest entry wins a tie). */
  function pick(trades, better) {
    var best = null;
    trades.slice().sort(M.byEntry).forEach(function (t) { if (best === null || better(t, best)) best = t; });
    return best;
  }
  var score = function (t) { return M.GRADE_SCORE[t.review.grade]; };
  var mistakeIds = function (t, names) {
    return M.isReviewed(t) ? t.review.tagIds.filter(function (id) { return names[id] !== undefined; }) : [];
  };

  function topMistake(trades, names) {
    var counts = {};
    trades.forEach(function (t) {
      mistakeIds(t, names).forEach(function (id) {
        var c = (counts[id] = counts[id] || { count: 0, netPnl: 0n });
        c.count++;
        if (M.isDecided(t)) c.netPnl += t.netPnl;
      });
    });
    var ids = Object.keys(counts).sort(function (a, b) {
      return counts[b].count - counts[a].count || cmpBig(counts[a].netPnl, counts[b].netPnl) || names[a].localeCompare(names[b]);
    });
    if (!ids.length) return null;
    var top = counts[ids[0]];
    return { id: ids[0], name: names[ids[0]], count: top.count, netPnl: top.netPnl.toString() };
  }

  /** Per strategy over reviewed decided trades; best/worst need n ≥ 3, worst needs two such strategies. */
  function strategies(trades, names) {
    var groups = {};
    trades.forEach(function (t) {
      if (!M.isDecided(t) || !M.isReviewed(t) || !t.review.strategyId) return;
      (groups[t.review.strategyId] = groups[t.review.strategyId] || []).push(t);
    });
    var rows = Object.keys(groups).map(function (id) {
      var s = M.summarize(groups[id]);
      return { total: s.netPnl, ref: { id: id, name: names[id] || "Unknown strategy", n: s.trades, netPnl: s.netPnl.toString(), winRate: M.asText(s.winRateParts) } };
    }).filter(function (r) { return r.ref.n >= WEEK_MIN_STRATEGY_N; }).sort(function (a, b) {
      return cmpBig(b.total, a.total) || a.ref.name.localeCompare(b.ref.name);
    });
    return { best: rows.length ? rows[0].ref : null, worst: rows.length >= 2 ? rows[rows.length - 1].ref : null };
  }

  /**
   * Totals, best/worst trades, patterns and lessons of one period. `trades` carry `feesTotal`; `input` holds
   * { rebates, reclaimFees (bigints), strategyNames, mistakeNames, labels, lessons (objects by id/key) }.
   */
  function buildPeriodStats(trades, input) {
    var period = trades.slice().sort(M.byEntry);
    var decided = period.filter(M.isDecided);
    var graded = decided.filter(function (t) { return M.isReviewed(t) && t.review.grade; });
    var s = M.summarize(period);
    var ref = function (t) { return t ? tradeRef(t, input.labels) : null; };
    var strat = strategies(period, input.strategyNames);
    return {
      totals: {
        entered: period.length, trades: s.trades, wins: s.wins, losses: s.losses, breakevens: s.breakevens,
        winRate: M.asText(s.winRateParts), netPnl: s.netPnl.toString(), rebates: input.rebates.toString(),
        netAfterRebates: (s.netPnl + input.rebates - input.reclaimFees).toString(),
        fees: period.reduce(function (sum, t) { return sum + t.feesTotal; }, 0n).toString(),
        reclaimFees: input.reclaimFees.toString(),
      },
      trades: {
        best: ref(pick(decided, function (a, b) { return a.netPnl > b.netPnl; })),
        worst: ref(pick(decided, function (a, b) { return a.netPnl < b.netPnl; })),
        bestExecuted: ref(pick(graded, function (a, b) { return score(a) > score(b) || (score(a) === score(b) && a.netPnl > b.netPnl); })),
        worstExecuted: ref(pick(graded, function (a, b) { return score(a) < score(b) || (score(a) === score(b) && a.netPnl < b.netPnl); })),
      },
      patterns: {
        topMistake: topMistake(period, input.mistakeNames), bestStrategy: strat.best, worstStrategy: strat.worst,
        reviewed: s.reviewed, ruleAdherence: M.asText(s.ruleAdherenceParts), avgExecutionScore: M.asText(s.avgExecutionParts),
      },
      lessons: period.filter(function (t) { return input.lessons[t.key]; }).map(function (t) {
        return { key: t.key, label: input.labels[t.key] || t.key, grade: (t.review && t.review.grade) || null, lesson: input.lessons[t.key] };
      }),
    };
  }

  function recurring(trades, weekStart, s, names) {
    var first = M.shiftDay(weekStart, -7 * (RECURRING_WEEKS - 1));
    var weeksOf = {};
    trades.forEach(function (t) {
      var week = weekOfTrade(t, s);
      if (week < first || week > weekStart) return;
      mistakeIds(t, names).forEach(function (id) { (weeksOf[id] = weeksOf[id] || {})[week] = true; });
    });
    return Object.keys(weeksOf).map(function (id) { return { id: id, name: names[id], weeks: Object.keys(weeksOf[id]).length }; })
      .filter(function (r) { return r.weeks >= RECURRING_MIN_WEEKS; })
      .sort(function (a, b) { return b.weeks - a.weeks || a.name.localeCompare(b.name); });
  }

  /** Frozen weekly stats, version 2. `trades` may include earlier weeks (used for recurring patterns). */
  function buildWeeklyStats(weekStart, trades, s, input) {
    var week = trades.filter(function (t) { return weekOfTrade(t, s) === weekStart; });
    var p = buildPeriodStats(week, input);
    return {
      version: 2, weekStart: weekStart, weekEnd: M.shiftDay(weekStart, 6), totals: p.totals, trades: p.trades,
      patterns: p.patterns, recurring: recurring(trades, weekStart, s, input.mistakeNames), lessons: p.lessons,
    };
  }

  function compared(monthStart, sum) {
    return {
      monthStart: monthStart, trades: sum.trades, netPnl: sum.netPnl.toString(), winRate: M.asText(sum.winRateParts),
      avgExecutionScore: M.asText(sum.avgExecutionParts),
    };
  }
  var diff = function (a, b) { return a === null || b === null ? null : M.asText(M.minus(a, b)); };

  /** Frozen monthly stats, version 1, with the change against the previous month (computed live). */
  function buildMonthlyStats(monthStart, trades, s, input) {
    var prevStart = shiftMonth(monthStart, -1);
    var month = trades.filter(function (t) { return monthOfTrade(t, s) === monthStart; });
    var before = trades.filter(function (t) { return monthOfTrade(t, s) === prevStart; });
    var p = buildPeriodStats(month, input);
    var cur = M.summarize(month);
    var prev = M.summarize(before);
    return {
      version: 1, monthStart: monthStart, monthEnd: monthEndOf(monthStart), totals: p.totals, trades: p.trades,
      patterns: p.patterns, lessons: p.lessons, previous: compared(prevStart, prev),
      change: {
        trades: cur.trades - prev.trades, netPnl: (cur.netPnl - prev.netPnl).toString(),
        winRate: diff(cur.winRateParts, prev.winRateParts), avgExecutionScore: diff(cur.avgExecutionParts, prev.avgExecutionParts),
      },
    };
  }

  SJ.periods = {
    weekStartOf: weekStartOf, monthStartOf: monthStartOf, shiftMonth: shiftMonth, monthEndOf: monthEndOf,
    weekOfTrade: weekOfTrade, monthOfTrade: monthOfTrade, buildPeriodStats: buildPeriodStats,
    buildWeeklyStats: buildWeeklyStats, buildMonthlyStats: buildMonthlyStats,
  };
})();
