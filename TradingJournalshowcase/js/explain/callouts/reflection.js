// Callouts for the review parts of trade detail (#/trades/<key>): quick review, full reflection, R:R, screenshots.
(function () {
  window.SJ.explain.define([
    {
      id: "rf-review",
      screen: "trade-detail",
      anchor: "rf-review",
      title: "The review lives with the trade",
      plain: "The same quick review as the Inbox, open to edits at any time. The first save marks the trade as reviewed.",
      technical: {
        text: "Reviews, tags, rule results and screenshots are stored against the position key, not a database row, so they stay attached when positions are rebuilt. A later save updates the review and keeps the first reviewed time.",
      },
    },
    {
      id: "rf-full",
      screen: "trade-detail",
      anchor: "rf-full",
      title: "Full reflection",
      plain: "Behind Expand full reflection: the plan you had before the trade and an honest look after it. Every field is optional.",
      technical: {
        text: "Pre-trade: whether the trade was planned, the reason, the confirmation, the invalidation point and the planned target and stop. Post-trade: what went well and badly, entry and exit quality 1 to 5, what to change, whether you would take it again and what drove the outcome.",
      },
    },
    {
      id: "rf-rr",
      screen: "trade-detail",
      anchor: "rf-rr",
      title: "Planned R:R and realised R",
      plain: "Enter the target and stop as a market cap or as a % from entry. The reward-to-risk ratio, and the result measured in units of that risk, update as you type.",
      technical: {
        text: "Both levels are turned into a % move from the entry market cap first, so a target in market cap and a stop in % still compare. Without a stop below entry there is no risk to divide by, and both values show a dash.",
        code: { label: "lib/finance/risk.ts", lines: [
          "export function plannedRR(target: PlanLevel, stop: PlanLevel, entryMc: Decimal | null): Decimal | null {",
          "  const reward = levelPct(target, entryMc);",
          "  const risk = plannedRiskFraction(stop, entryMc);",
          "  if (reward === null || risk === null) return null;",
          "  return reward.div(100).div(risk);",
          "}",
        ] },
      },
    },
    {
      id: "rf-screenshots",
      screen: "trade-detail",
      anchor: "rf-screenshots",
      title: "Screenshots",
      plain: "Attach chart screenshots from before the entry, at the exit or any other time. Click one to see it full screen.",
      live: "the image is compressed to WebP in your browser (up to 1600 px) and stored in a private bucket; the page shows it through links that expire after an hour.",
      technical: {
        text: "The viewer fits the image to the screen, and a click shows it at actual size, where a mouse drag pans. The arrow keys browse without wrapping round. Delete needs a second click within 4 seconds.",
      },
    },
  ]);
})();
