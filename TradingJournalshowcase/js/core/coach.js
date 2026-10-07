// Trade Coach in the demo (docs/ai-coach.md §2, §4, §7). There is no AI here: the generator stores a few pre-written
// critiques ("Sample output") and Generate builds one from the same template. A critique goes out of date when the
// review, its screenshots or a correction on the position change, like the app's input hash.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var MODEL = "google/gemini-3.1-flash-lite";
  var PROMPT_VERSION = 3;

  var pct = function (roi) { return (roi >= 0 ? "+" : "") + (roi * 100).toFixed(1) + "%"; };

  /**
   * The sample critique of a reviewed trade, in the app's output shape. Descriptive only and citing input fields, as
   * the guardrails require. `ctx` is the trade's session context; `vocab` the owner's tags and rules.
   */
  function tradeOutput(t, ctx, vocab) {
    var tagName = {};
    var ruleName = {};
    vocab.tags.forEach(function (x) { tagName[x.id] = x.name; });
    vocab.rules.forEach(function (x) { ruleName[x.id] = x.name; });
    var tags = t.review.tagIds.map(function (id) { return tagName[id]; });
    var broken = t.review.ruleResults.filter(function (x) { return !x.followed; }).map(function (x) { return ruleName[x.ruleId]; });
    var goodLoss = t.outcome === "loss" && "AB".indexOf(t.review.grade) >= 0;
    var lossStreak = ctx.streakBefore && ctx.streakBefore.kind === "loss";
    return {
      // The live Coach never receives the token's name, so the sample does not use it either.
      summary: "The position closed at " + pct(t.roi) + " after " + Math.round(t.holdingSeconds / 60) + " minutes. The review grades execution " + t.review.grade +
        (tags.length ? " and tags " + tags.join(", ") : " with no tags") + ". This was trade " + ctx.numberInDay + " of the trading day.",
      contradictions: goodLoss && broken.length
        ? [{ claim: "Execution is graded " + t.review.grade + ", but the review also marks \"" + broken[0] + "\" as broken.", evidence: "reflection.grade = " + t.review.grade + "; a rule result is broken.", fields: ["reflection.grade", "rules[].followed"] }]
        : [],
      suggested_mistake_tags: lossStreak && tags.indexOf("revenge trading") < 0
        ? [{ tag: "revenge trading", evidence: "Entered after " + ctx.streakBefore.length + " loss(es) earlier the same trading day.", fields: ["session.streak_before_entry"] }]
        : [],
      suggested_positive_tags: t.outcome === "loss" && t.roi > -0.15 && tags.indexOf("clean exit") < 0
        ? [{ tag: "clean exit", evidence: "The loss was kept to " + pct(t.roi) + ".", fields: ["position.roi_pct"] }]
        : [],
      rule_flags: ctx.numberInSession > 3
        ? [{ rule: "Max 3 trades per session", evidence: "This was trade " + ctx.numberInSession + " of its session.", fields: ["session.trade_number_in_session"] }]
        : [],
      questions_for_you: [
        t.outcome === "win" ? "Which part of this trade would you repeat on purpose, and which part was the market?" : "At what point did the trade stop matching the plan you had at entry?",
      ],
      data_gaps: t.review.plannedStop.mc === null && t.review.plannedStop.pct === null ? ["No planned stop was recorded, so realised R cannot be computed."] : [],
    };
  }

  /** What the app's input hash covers, as a comparable string: the review, its screenshots and corrections on the key. */
  function fingerprint(d, key) {
    var r = d.reflections.filter(function (x) { return x.positionKey === key; })[0] || null;
    var review = r && [r.grade, r.strategyId, r.tagIds.slice().sort(), r.ruleResults, r.emotionId, r.confidence, r.terminal, r.lesson, r.notes, r.full];
    var shots = d.screenshots.filter(function (s) { return s.positionKey === key; }).map(function (s) { return s.id; });
    var corrections = d.corrections.filter(function (c) {
      var p = c.payload;
      return p.positionKey === key || p.keep === key || p.absorb === key;
    }).map(function (c) { return c.id; });
    return JSON.stringify([review, shots, corrections], function (k, v) { return typeof v === "bigint" ? String(v) : v; });
  }

  /** Stamps the generated critiques with the fingerprint they were made from (the store calls this on every load). */
  function stamp(d) {
    d.coach.trade.forEach(function (c) { c.fingerprint = fingerprint(d, c.positionKey); });
  }

  var row = function (key) { return SJ.store.data().coach.trade.filter(function (c) { return c.positionKey === key; })[0] || null; };

  /** The panel state (lib/ai/coach/panel.ts): hidden unless the Coach is on and the trade is closed and reviewed. */
  function state(t) {
    var reviewed = t.reflection && t.reflection.reviewedAt;
    if (!SJ.store.settings().coachEnabled || t.status !== "closed" || !reviewed) return "hidden";
    var c = row(t.key);
    if (!c) return "none";
    if (c.status !== "done") return c.status;
    return c.fingerprint === fingerprint(SJ.store.data(), t.key) ? "done" : "stale";
  }

  SJ.coach = { MODEL: MODEL, PROMPT_VERSION: PROMPT_VERSION, tradeOutput: tradeOutput, fingerprint: fingerprint, stamp: stamp, row: row, state: state };
})();
