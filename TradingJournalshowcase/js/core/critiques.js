// Day and period Coach in the demo (docs/ai-coach.md §8–§9). There is no AI here: the generator stores a few
// pre-written critiques ("Sample output") made with the templates below, and Review this day / Generate builds one
// the same way. A critique goes out of date when its input changes, like the app's input hash: for a day, its trades
// and their reviews, the daily review and the rules; for a week or month, the frozen stats, the review text, the
// day critiques inside it and the rules.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var M = SJ.metrics;
  var S = SJ.store;
  var PROMPT_VERSION = 1;

  /** The sample day critique: descriptive, citing input fields. `review` is the daily review or null. */
  function dayOutput(trades, review) {
    var sum = M.summarize(trades);
    return {
      summary: trades.length + " trade(s) entered, " + sum.wins + " win(s) and " + sum.losses + " loss(es). " +
        (review ? "The daily review says the plan was followed \"" + review.followedPlan + "\" and rates discipline " + review.discipline + " of 5." : "There is no daily review for this day."),
      patterns: sum.losses >= 2
        ? [{ pattern: "Losses came after the first loss of the day.", evidence: sum.losses + " losses on the day; later entries followed a loss.", fields: ["day.losses", "trades[].streak_before_entry"] }]
        : [],
      contradictions: review && review.followedPlan === "yes" && sum.losses > sum.wins
        ? [{ claim: "The review says the plan was followed on a day with more losses than wins.", evidence: "followed_plan = yes; wins " + sum.wins + ", losses " + sum.losses + ".", fields: ["review.followed_plan", "day.wins", "day.losses"] }]
        : [],
      rule_flags: [],
      questions_for_you: ["What was different about the first trade of the day compared with the last one?"],
      data_gaps: (trades.some(function (t) { return !(t.review && t.review.reviewed); }) ? ["Some of the day's trades are not reviewed yet."] : [])
        .concat(review ? [] : ["No daily review was written for this day."]),
    };
  }

  /** The sample week or month critique, from its frozen stats. */
  function periodOutput(stats) {
    var t = stats.totals;
    var top = stats.patterns.topMistake;
    return {
      summary: t.trades + " decided trade(s) and " + t.entered + " entered. Net P&L " + (Number(t.netPnl) / 1e9).toFixed(4) + " SOL with a win rate of " +
        (t.winRate === null ? "—" : (Number(t.winRate) * 100).toFixed(0) + "%") + ".",
      patterns: top ? [{ pattern: "\"" + top.name + "\" was the most frequent mistake tag.", evidence: top.count + " tagged trade(s).", fields: ["period.top_mistake"] }] : [],
      contradictions: [],
      rule_flags: [],
      questions_for_you: ["Which single habit from this period is worth keeping next period?"],
      data_gaps: stats.patterns.reviewed < t.entered ? ["Not every trade of the period is reviewed."] : [],
    };
  }

  // ---- Input fingerprints (the demo's input hash)

  var json = function (v) { return JSON.stringify(v, function (k, x) { return typeof x === "bigint" ? String(x) : x; }); };
  var rules = function (d) { return d.vocab.rules.filter(function (r) { return !r.archived; }).map(function (r) { return [r.id, r.name, r.type, r.threshold]; }); };
  var periodList = function (d, kind) { return kind === "week" ? d.weeklyReviews : d.monthlyReviews; };
  var startOf = function (row, kind) { return kind === "week" ? row.weekStart : row.monthStart; };

  function dayFingerprint(d, day) {
    var trades = SJ.calendar.dayTrades(day).map(function (t) {
      var r = t.reflection;
      return [t.key, t.status, t.outcome, t.netPnl, r && [r.reviewedAt && true, r.grade, r.strategyId, r.emotionId, r.confidence, r.terminal, r.lesson, r.tagIds, r.ruleResults]];
    });
    var review = d.dailyReviews.filter(function (r) { return r.day === day; })[0] || null;
    var earlier = d.dailyReviews.filter(function (r) { return r.day < day; }).sort(function (a, b) { return a.day < b.day ? 1 : -1; })[0];
    return json([trades, review && [review.wentWell, review.biggestMistake, review.followedPlan, review.repeat, review.avoid, review.executionGrade, review.discipline, review.journal],
      earlier ? [earlier.repeat, earlier.avoid] : null, rules(d)]);
  }

  function periodFingerprint(d, kind, start) {
    var row = periodList(d, kind).filter(function (r) { return startOf(r, kind) === start; })[0];
    if (!row) return null;
    var end = kind === "week" ? M.shiftDay(start, 6) : SJ.periods.monthEndOf(start);
    var days = d.coach.day.filter(function (c) { return c.status === "done" && c.day >= start && c.day <= end; })
      .sort(function (a, b) { return a.day < b.day ? -1 : 1; }).map(function (c) { return [c.day, c.output.summary]; });
    return json([row.stats, row.keyLessons, row.patternsNoticed, row.notes, days, rules(d)]);
  }

  /** Marks every stored critique with the input it was made from (the store calls this whenever it loads data). */
  function stamp(d) {
    d.coach.day.forEach(function (c) { c.fingerprint = dayFingerprint(d, c.day); });
    d.coach.period.forEach(function (c) { c.fingerprint = periodFingerprint(d, c.kind, c.periodStart); });
  }

  // ---- Rows and panel state (lib/ai/coach/panel.ts)

  var dayRow = function (day) { return S.data().coach.day.filter(function (c) { return c.day === day; })[0] || null; };
  var periodRow = function (kind, start) { return S.data().coach.period.filter(function (c) { return c.kind === kind && c.periodStart === start; })[0] || null; };

  function stateOf(row, eligible, fingerprint) {
    if (!S.settings().coachEnabled || !eligible) return "hidden";
    if (!row) return "none";
    if (row.status !== "done") return row.status;
    return row.fingerprint === fingerprint() ? "done" : "stale";
  }

  /** A day with at least one entry can be critiqued. */
  function dayState(day) {
    return stateOf(dayRow(day), SJ.calendar.dayTrades(day).length > 0, function () { return dayFingerprint(S.data(), day); });
  }

  /** A week or month that has ended and has its review (the draft with frozen stats). */
  function periodState(kind, start) {
    var review = periodList(S.data(), kind).filter(function (r) { return startOf(r, kind) === start; })[0];
    var ended = kind === "week" ? start < SJ.periods.weekStartOf(SJ.calendar.today()) : start < SJ.periods.monthStartOf(SJ.calendar.today());
    return stateOf(periodRow(kind, start), !!review && ended, function () { return periodFingerprint(S.data(), kind, start); });
  }

  /** Writes the critique of a day ({ day }) or period ({ kind, periodStart }); one row each, the latest wins. */
  function save(ref, fields) {
    var list = ref.day ? S.data().coach.day : S.data().coach.period;
    var old = list.filter(function (c) { return ref.day ? c.day === ref.day : c.kind === ref.kind && c.periodStart === ref.periodStart; })[0];
    if (old) list.splice(list.indexOf(old), 1);
    var row = Object.assign({}, ref, { trigger: "manual", startedAt: S.tick().toISOString() }, fields);
    list.push(row);
    S.changed();
    return row;
  }

  // The first run of each kind in a demo session fails on purpose, so Retry can be tried.
  var failedFor = { day: null, period: null };

  /**
   * Review this day / Generate, Regenerate and Retry: a pending row at once, then the sample critique or the sample
   * failure. ref: { day } or { kind, periodStart }. Resolves the SJ.sim result.
   */
  function run(ref, live) {
    var kind = ref.day ? "day" : "period";
    var first = !(ref.day ? dayRow(ref.day) : periodRow(ref.kind, ref.periodStart));
    var fail = first && failedFor[kind] !== S.data();
    if (fail) failedFor[kind] = S.data();
    save(ref, { status: "pending" });
    return SJ.sim.run({
      action: "Coach", toast: false, ms: 1800, fail: fail, live: live, steps: ["Building the input", "Waiting for the model", "Checking the answer"],
      error: "The model did not answer within 45 seconds (a sample failure, so you can try Retry). Your reviews are unchanged.",
    }).then(function (r) {
      if (r.cancelled) return r;
      var at = S.now().toISOString();
      if (!r.ok) { save(ref, { status: "failed", error: r.error, finishedAt: at }); return r; }
      var d = S.data();
      var output;
      if (ref.day) output = dayOutput(SJ.calendar.dayTrades(ref.day), SJ.calendar.dailyReview(ref.day));
      else output = periodOutput(periodList(d, ref.kind).filter(function (x) { return startOf(x, ref.kind) === ref.periodStart; })[0].stats);
      var fingerprint = ref.day ? dayFingerprint(d, ref.day) : periodFingerprint(d, ref.kind, ref.periodStart);
      save(ref, { status: "done", finishedAt: at, model: SJ.coach.MODEL, promptVersion: PROMPT_VERSION, costUsd: "0.000500", sample: true, output: output, fingerprint: fingerprint });
      return r;
    });
  }

  SJ.critiques = {
    PROMPT_VERSION: PROMPT_VERSION, dayOutput: dayOutput, periodOutput: periodOutput, dayFingerprint: dayFingerprint,
    periodFingerprint: periodFingerprint, stamp: stamp, dayRow: dayRow, periodRow: periodRow, dayState: dayState,
    periodState: periodState, save: save, run: run,
  };
})();
