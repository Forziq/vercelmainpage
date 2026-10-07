// Analytics definitions (reflection-analytics.md §10–§11), ported from the app's lib/analytics so the demo's numbers
// follow the same rules: decided trades only, breakevens out of the win rate, trading day shifted by the day-start hour.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var GRADE_SCORE = { A: 4, B: 3, C: 2, D: 1, F: 0 };

  // ---- Days and time zones

  /** `yyyy-MM-dd` shifted by `days` calendar days. */
  function shiftDay(day, days) {
    var d = new Date(day + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  /** ISO weekday of a day, 1 = Monday … 7 = Sunday. */
  function weekdayOf(day) {
    var dow = new Date(day + "T00:00:00Z").getUTCDay();
    return dow === 0 ? 7 : dow;
  }

  /** The trading day of an instant: its local date, or the day before when the local hour is before `dayStartHour`. */
  function tradingDay(at, timeZone, dayStartHour) {
    var parts = SJ.format.localTime(at, timeZone, "yyyy-MM-dd HH").split(" ");
    return Number(parts[1]) < dayStartHour ? shiftDay(parts[0], -1) : parts[0];
  }

  var localHour = function (at, timeZone) { return Number(SJ.format.localTime(at, timeZone, "HH")); };

  /** The instant of a local wall-clock time (`yyyy-MM-ddTHH:mm`) in `timeZone`; DST comes from Intl, never a fixed offset. */
  function zonedInstant(wall, timeZone) {
    var target = Date.parse(wall + ":00Z");
    var guess = target;
    for (var i = 0; i < 3; i++) {
      var shown = Date.parse(SJ.format.localTime(new Date(guess), timeZone, "yyyy-MM-dd HH:mm:ss").replace(" ", "T") + "Z");
      guess += target - shown;
    }
    return new Date(guess);
  }

  /** The instant a trading day starts: `dayStartHour` local time on that date. */
  var tradingDayStart = function (day, timeZone, dayStartHour) {
    return zonedInstant(day + "T" + String(dayStartHour).padStart(2, "0") + ":00", timeZone);
  };

  // ---- Exact ratios as text (the app freezes ratios with 6 decimals, half to even)

  /** num / den (bigints, den > 0) rounded to 6 dp, half to even, printed like Decimal#toFixed() (no trailing zeros). */
  function ratioText(num, den) {
    if (den < 0n) { num = -num; den = -den; }
    var neg = num < 0n;
    var n = (neg ? -num : num) * 1000000n;
    var q = n / den;
    var twice = (n % den) * 2n;
    if (twice > den || (twice === den && q % 2n === 1n)) q += 1n;
    var digits = q.toString().padStart(7, "0");
    var out = (digits.slice(0, -6) + "." + digits.slice(-6)).replace(/\.?0+$/, "");
    return (neg ? "-" : "") + out;
  }

  /** a/b − c/d as a ratio. */
  var minus = function (a, b) { return { num: a.num * b.den - b.num * a.den, den: a.den * b.den }; };
  var parts = function (num, den) { return den === 0 ? null : { num: BigInt(num), den: BigInt(den) }; };
  var asNumber = function (r) { return r === null ? null : Number(r.num) / Number(r.den); };
  var asText = function (r) { return r === null ? null : ratioText(r.num, r.den); };

  // ---- Trades (a derived position plus its review)

  var isDecided = function (t) { return t.outcome !== null; };
  var isReviewed = function (t) { return !!(t.review && t.review.reviewed); };
  var byEntry = function (a, b) { return a.openedAt - b.openedAt || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0); };
  var meanLamports = function (vs) { return vs.length ? vs.reduce(function (s, v) { return s + v; }, 0n) / BigInt(vs.length) : null; };

  /** Σ wins ÷ |Σ losses|: Infinity with wins and no losses, null with neither. */
  function profitFactor(trades) {
    var won = 0n, lost = 0n, wins = 0, losses = 0;
    trades.forEach(function (t) {
      if (t.outcome === "win") { won += t.netPnl; wins++; }
      else if (t.outcome === "loss") { lost -= t.netPnl; losses++; }
    });
    if (losses === 0) return wins === 0 ? null : Infinity;
    return lost === 0n ? Infinity : Number(won) / Number(lost);
  }

  /** Mean §2 score over reviewed trades with a grade, as an exact ratio. */
  function executionParts(trades) {
    var scores = trades.filter(isReviewed).filter(function (t) { return t.review.grade; })
      .map(function (t) { return GRADE_SCORE[t.review.grade]; });
    return parts(scores.reduce(function (a, b) { return a + b; }, 0), scores.length);
  }

  var followedAll = function (t) { return t.review.ruleResults.every(function (r) { return r.followed; }); };

  /** §4: reviewed trades with no broken rule ÷ reviewed trades. */
  function adherenceParts(trades) {
    var reviewed = trades.filter(isReviewed);
    return parts(reviewed.filter(followedAll).length, reviewed.length);
  }

  /** §4 per rule: followed ÷ reviewed trades with a result for the rule. */
  function adherenceByRule(trades) {
    var out = {};
    trades.filter(isReviewed).forEach(function (t) {
      t.review.ruleResults.forEach(function (r) {
        var c = (out[r.ruleId] = out[r.ruleId] || { ruleId: r.ruleId, n: 0, followed: 0 });
        c.n++;
        if (r.followed) c.followed++;
      });
    });
    return Object.keys(out).map(function (k) { var c = out[k]; c.adherence = c.followed / c.n; return c; });
  }

  /** Every §11 aggregate over a set of trades. Ratios are numbers for display; `*Parts` keep them exact. */
  function summarize(trades) {
    var decided = trades.filter(isDecided);
    var wins = decided.filter(function (t) { return t.outcome === "win"; });
    var losses = decided.filter(function (t) { return t.outcome === "loss"; });
    var decisive = wins.length + losses.length;
    var holds = decided.filter(function (t) { return t.closedAt; }).map(function (t) { return t.holdingSeconds; });
    var rois = decided.filter(function (t) { return t.roi !== null; }).map(function (t) { return t.roi; });
    var winRate = parts(wins.length, decisive);
    var exec = executionParts(trades);
    var adherence = adherenceParts(trades);
    var net = function (t) { return t.netPnl; };
    return {
      trades: decided.length, wins: wins.length, losses: losses.length, breakevens: decided.length - decisive,
      winRate: asNumber(winRate), winRateParts: winRate,
      netPnl: decided.reduce(function (s, t) { return s + t.netPnl; }, 0n),
      avgWinner: meanLamports(wins.map(net)), avgLoser: meanLamports(losses.map(net)),
      profitFactor: profitFactor(decided), expectancy: meanLamports(decided.map(net)),
      avgRoi: rois.length ? rois.reduce(function (a, b) { return a + b; }, 0) / rois.length : null,
      avgHoldSeconds: holds.length ? holds.reduce(function (a, b) { return a + b; }, 0) / holds.length : null,
      reviewed: trades.filter(isReviewed).length,
      avgExecutionScore: asNumber(exec), avgExecutionParts: exec,
      ruleAdherence: asNumber(adherence), ruleAdherenceParts: adherence,
    };
  }

  /** The run of wins or losses at the start of `newestFirst` outcomes, skipping breakevens. */
  function streakFrom(newestFirst) {
    var streak = null;
    for (var i = 0; i < newestFirst.length; i++) {
      var o = newestFirst[i];
      if (o === null || o === "breakeven") continue;
      if (streak === null) streak = { kind: o, length: 1 };
      else if (o === streak.kind) streak.length++;
      else break;
    }
    return streak;
  }

  /** Consecutive wins or losses counting back from the latest closed trade. */
  function currentStreak(trades) {
    var closed = trades.filter(function (t) { return isDecided(t) && t.closedAt; }).sort(function (a, b) {
      return b.closedAt - a.closedAt || (a.key < b.key ? 1 : -1);
    });
    return streakFrom(closed.map(function (t) { return t.outcome; }));
  }

  /** Net P&L per trading day of entry, decided trades only, as [day, lamports] sorted by day. */
  function dailyNetPnl(trades, s) {
    var days = {};
    trades.filter(isDecided).forEach(function (t) {
      var day = tradingDay(t.openedAt, s.timeZone, s.dayStartHour);
      days[day] = (days[day] || 0n) + t.netPnl;
    });
    return Object.keys(days).sort().map(function (d) { return [d, days[d]]; });
  }

  /** Best and worst trading day by net P&L; the earlier day wins a tie. */
  function bestWorstDay(trades, s) {
    var days = dailyNetPnl(trades, s);
    if (!days.length) return null;
    var best = days[0], worst = days[0];
    days.forEach(function (d) { if (d[1] > best[1]) best = d; if (d[1] < worst[1]) worst = d; });
    return { best: { day: best[0], netPnl: best[1] }, worst: { day: worst[0], netPnl: worst[1] } };
  }

  /**
   * Day, session, trade numbers and streak before entry for every trade, keyed by position key (§10). Sessions are
   * runs of entries less than `sessionGapMinutes` apart and are not cut at the day boundary.
   */
  function tradeContexts(trades, s) {
    var sorted = trades.slice().sort(byEntry);
    var gapMs = s.sessionGapMinutes * 60000;
    var result = {};
    var dayTrades = {};
    var sessionIndex = -1, sessionStart = null, numberInSession = 0, prev = null;
    sorted.forEach(function (t) {
      if (prev === null || t.openedAt - prev.openedAt >= gapMs) { sessionIndex++; sessionStart = t.openedAt; numberInSession = 0; }
      numberInSession++;
      prev = t;
      var day = tradingDay(t.openedAt, s.timeZone, s.dayStartHour);
      var earlier = dayTrades[day] || (dayTrades[day] = []);
      var closedBefore = earlier.filter(function (e) { return e.closedAt && e.closedAt <= t.openedAt; })
        .sort(function (a, b) { return b.closedAt - a.closedAt; });
      result[t.key] = {
        tradingDay: day, sessionIndex: sessionIndex, sessionStart: sessionStart, numberInDay: earlier.length + 1,
        numberInSession: numberInSession, alreadyTaken: earlier.length,
        streakBefore: streakFrom(closedBefore.map(function (e) { return e.outcome; })),
      };
      earlier.push(t);
    });
    return result;
  }

  SJ.metrics = {
    GRADE_SCORE: GRADE_SCORE, shiftDay: shiftDay, weekdayOf: weekdayOf, tradingDay: tradingDay, localHour: localHour,
    zonedInstant: zonedInstant, tradingDayStart: tradingDayStart, ratioText: ratioText, minus: minus, parts: parts,
    asNumber: asNumber, asText: asText, isDecided: isDecided, isReviewed: isReviewed, byEntry: byEntry,
    profitFactor: profitFactor, executionParts: executionParts, adherenceParts: adherenceParts,
    adherenceByRule: adherenceByRule, summarize: summarize, streakFrom: streakFrom, currentStreak: currentStreak,
    dailyNetPnl: dailyNetPnl, bestWorstDay: bestWorstDay, tradeContexts: tradeContexts,
  };
})();
