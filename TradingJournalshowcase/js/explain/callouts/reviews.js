// Callouts for Reviews: the weekly and monthly lists and one week or month. The detail callouts exist once per
// screen (review-week, review-month) because each screen has its own anchors. Conventions: see js/explain/engine.js.
(function () {
  var FROZEN = {
    title: "A frozen snapshot",
    plain: "When a period ends, its numbers are frozen into the review the first time you open it. Later edits to trades do not quietly rewrite what you reflected on.",
    technical: {
      text: "The snapshot is stored as JSON with a version number (weeks are version 2 since rent-reclaim fees were added; months are version 1). Amounts are kept as strings so they round-trip exactly, and names are copied in, so renaming a strategy later does not change history.",
      code: { label: "lib/validation/weekly-review.ts", lines: [
        "const weeklyStatsObject = z.object({",
        "  version: z.literal([1, 2]),",
        "  weekStart: dayString,",
        "  weekEnd: dayString,",
        "  ...periodStatsShape,",
        "// …",
        "  (s) => s.version === 1 || s.totals.reclaimFees !== undefined,",
      ] },
    },
  };
  var RECALC = {
    title: "Recalculate keeps your text",
    plain: "If you reviewed more trades or fixed one after the period ended, Recalculate stats freezes a fresh snapshot. Your three text fields stay exactly as they are.",
    live: "the server rebuilds the snapshot from the current positions; this demo does the same in your browser.",
    technical: {
      text: "Only the stats and their time are replaced; the text is saved separately. EUR figures are computed live and hidden while the frozen SOL totals no longer match the trades, so a stale snapshot never shows mismatched EUR.",
      code: { label: "server/repositories/weekly-reviews.ts", lines: [
        "export async function replaceWeeklyStats(db: AnyPgDb, userId: string, stats: WeeklyStats, at: Date): Promise<boolean> {",
        "  const rows = await db",
        "    .update(weeklyReviews)",
        "    .set({ stats, statsAt: at })",
      ] },
    },
  };
  var TOTALS = {
    title: "Totals after cashback and fees",
    plain: "Net result of the period's decided trades, the same after cashback and rent-reclaim fees, win rate, trade count and fees.",
    technical: { text: "A trade belongs to the period of its entry's trading day. Cashback counts when it is allocated to a trade of the period; reclaim fees are a wallet-level line by block time." },
  };
  var PATTERNS = {
    title: "Patterns from your own tags",
    plain: "The most used mistake tag and what those trades made, the best and worst strategy, rule adherence and the average execution grade.",
    technical: { text: "A strategy needs at least 3 decided, reviewed trades in the period to be called best or worst; otherwise it says \"not enough data\" instead of drawing a conclusion from one or two trades." },
  };
  var TEXT = {
    title: "Your words",
    plain: "Key lessons, patterns noticed and notes. A review without any text is a draft; once you save text it shows as written.",
  };
  var COACH = {
    title: "Period Coach, on request only",
    plain: "Generate asks the AI Coach to read the frozen stats, your three texts and the day critiques of the period, and to point out patterns and contradictions. It never runs by itself.",
    live: "the snapshot and your texts go to the model, never the wallet or token names; this demo shows sample output and fails the first run on purpose so you can try Retry.",
    technical: {
      text: "The critique stores a hash of its input, the prompt version and the model. Recalculate stats, an edited review, a new day critique or a rule change makes it out of date, shown with a Regenerate button.",
      code: { label: "server/services/periodCoach.ts", lines: [
        "const periodHash = (input: CoachInput, model: string) => coachInputHash(input, PERIOD_PROMPT_VERSION, model);",
        "// …",
        "  return { row, stale: current !== row.inputHash };",
      ] },
    },
  };
  var on = function (screen, prefix, anchor, c) { return Object.assign({ id: prefix + "-" + anchor.slice(3), screen: screen, anchor: anchor }, c); };

  window.SJ.explain.define([
    {
      id: "rl-list", screen: "reviews", anchor: "rv-list", title: "A review every week",
      plain: "Weeks run Monday to Sunday by trading day. When a week ends, its draft appears here with the numbers frozen; you add the words.",
      technical: { text: "Opening the list makes sure last week's draft exists; opening any older week creates its draft on the spot. Nothing is created for a week that has not ended." },
    },
    {
      id: "rml-list", screen: "reviews-monthly", anchor: "rv-list", title: "And one every month",
      plain: "The monthly review covers the 1st to the last day of the month by trading day, with the same frozen numbers plus a comparison with the month before.",
      technical: { text: "A trade belongs to the month of its entry's trading day. Like weeks, a month's draft is created on the first visit after it ends." },
    },
    on("review-week", "rw", "rv-frozen", FROZEN), on("review-week", "rw", "rv-recalc", RECALC), on("review-week", "rw", "rv-totals", TOTALS),
    on("review-week", "rw", "rv-patterns", PATTERNS),
    on("review-week", "rw", "rv-recurring", {
      title: "Mistakes that come back",
      plain: "A mistake tag used in 2 or more of the last 4 weeks is listed here, so a habit shows up even when each week looks different.",
      technical: { text: "Counted from the tags on reviewed trades of this week and the three before it, when the snapshot is frozen." },
    }),
    on("review-week", "rw", "rv-text", TEXT), on("review-week", "rw", "rv-coach", COACH),
    on("review-month", "rm", "rv-frozen", FROZEN), on("review-month", "rm", "rv-recalc", RECALC), on("review-month", "rm", "rv-totals", TOTALS),
    on("review-month", "rm", "rv-versus", {
      title: "Versus the previous month",
      plain: "Net result, win rate, number of decided trades and average grade, next to last month's and the change. It describes; it does not judge.",
      technical: {
        text: "The previous month is computed from its trades when the snapshot is frozen, not read from its own review. An empty previous month shows 0 trades and a dash for the rates, and their change is a dash too.",
        code: { label: "lib/analytics/monthly.ts", lines: [
          "change: {",
          "  trades: current.trades - prev.trades,",
          "  netPnl: (current.netPnl - prev.netPnl).toString(),",
          "  winRate: diff(current.winRate, prev.winRate),",
          "  avgExecutionScore: diff(current.avgExecutionScore, prev.avgExecutionScore),",
          "},",
        ] },
      },
    }),
    on("review-month", "rm", "rv-patterns", PATTERNS), on("review-month", "rm", "rv-text", TEXT), on("review-month", "rm", "rv-coach", COACH),
  ]);
})();
