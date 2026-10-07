// Callouts for the Dashboard (#/dashboard). Conventions: see the header of js/explain/engine.js.
(function () {
  window.SJ.explain.define([
    {
      id: "dash-range",
      screen: "dashboard",
      anchor: "dash-range",
      title: "Ranges count trading days",
      plain: "The range picker recomputes every card and chart from the stored positions. A range covers that many trading days back from today, and a position counts on the trading day it was entered.",
      technical: {
        text: "A trading day starts at the owner's day-start hour (04:00 here) in their time zone, so a trade at 02:00 belongs to the day before. The range start is the beginning of the first trading day in the range.",
        code: { label: "server/services/dashboard.ts", lines: [
          "export function rangeStart(range: DashboardRange, now: Date, s: AnalyticsSettings): Date | null {",
          "  if (range === \"all\") return null;",
          "  const first = shiftDay(tradingDay(now, s.timeZone, s.dayStartHour), 1 - RANGE_DAYS[range]);",
          "  return tradingDayStart(first, s.timeZone, s.dayStartHour);",
          "}",
        ] },
      },
    },
    {
      id: "dash-net",
      screen: "dashboard",
      anchor: "dash-net",
      title: "Net P&L: decided trades only",
      plain: "Net P&L adds up what finished positions earned or lost after every fee. Open positions are left out until they close, because they have no final result yet.",
      live: "the EUR line under it converts each transaction at the SOL/EUR rate of its own minute; it stays blank if any rate is missing.",
      technical: {
        text: "A position's net P&L is SOL out minus its cost basis minus fees, kept as whole lamports. The total is a plain sum of those integers, so no rounding builds up.",
        code: { label: "lib/analytics/metrics.ts", lines: [
          "netPnl: decided.reduce((sum, t) => sum + t.netPnl, 0n),",
        ] },
      },
    },
    {
      id: "dash-winrate",
      screen: "dashboard",
      anchor: "dash-winrate",
      title: "Win rate leaves breakevens out",
      plain: "Win rate is wins divided by wins plus losses; a trade with an ROI within ±1% is a breakeven and counts as neither. Profit factor is the total won divided by the total lost.",
      technical: {
        text: "Outcomes are decided on exact lamports against the breakeven band from Settings. Profit factor shows ∞ with wins and no losses, and a dash when nothing is decided.",
        code: { label: "lib/analytics/metrics.ts", lines: [
          "for (const t of trades) {",
          "  if (t.outcome === \"win\") [won, wins] = [won + t.netPnl, wins + 1];",
          "  else if (t.outcome === \"loss\") [lost, losses] = [lost - t.netPnl, losses + 1];",
          "}",
          "if (losses === 0) return wins === 0 ? null : toDecimal(Infinity);",
        ] },
      },
    },
    {
      id: "dash-countup",
      screen: "dashboard",
      anchor: "dash-countup",
      title: "Numbers count up once",
      plain: "On the first visit the headline numbers count up from zero, and the last frame is exactly the formatted value. Trades counts every position entered in the range, open ones included.",
      technical: {
        text: "The count-up only changes what is drawn: screen readers get the final value at once, and with reduced motion switched on the numbers appear immediately. Needs review does not count up, at the owner's request.",
        code: { label: "lib/format/ticker.ts", lines: [
          "/** First-load count-up; must equal `--transition-duration-slower` in globals.css. */",
          "export const COUNT_UP_MS = 600;",
        ] },
      },
    },
    {
      id: "dash-review",
      screen: "dashboard",
      anchor: "dash-review",
      title: "Needs review opens the Inbox",
      plain: "This counts finished positions that have no review yet, across every wallet and all time. It is the same number the Inbox shows.",
      technical: {
        text: "Every status except open counts: closed, written off and transferred. The count ignores the range picker on purpose, because the Inbox is not ranged.",
        code: { label: "server/repositories/inbox.ts", lines: [
          "const unreviewed = and(ne(positions.status, \"open\"), isNull(reflections.reviewedAt));",
        ] },
      },
    },
    {
      id: "dash-fees",
      screen: "dashboard",
      anchor: "dash-fees",
      title: "Fees, reclaims and cashback",
      plain: "Total fees include failed attempts that no position claimed. Rent-reclaim fees belong to no trade, so they get their own line; Net after rebates adds cashback and subtracts them.",
      technical: {
        text: "Cashback never changes a trade's P&L or outcome; it is reported next to it. Net after rebates is decided net P&L plus cashback allocated to the range's positions minus the range's reclaim fees.",
        code: { label: "server/services/dashboard.ts", lines: [
          "feesTotal: trades.reduce((sum, t) => sum + t.feesTotal, 0n) + input.orphanFailedFees,",
          "rebates: input.rebates,",
          "reclaimFees: input.reclaimFees,",
          "netAfterRebates: summary.netPnl + input.rebates - input.reclaimFees,",
        ] },
      },
    },
    {
      id: "dash-discipline",
      screen: "dashboard",
      anchor: "dash-discipline",
      title: "Limits you set yourself",
      plain: "Days within your limits counts the traded days that stayed inside the daily trade count and loss limit from Settings. It reports what happened and never blocks or advises.",
      technical: {
        text: "A day is the same trading day the calendar uses. Every position entered counts towards the trade limit; only decided trades count towards the loss. Reaching a limit exactly is still within it.",
        code: { label: "lib/analytics/discipline.ts", lines: [
          "const trades =",
          "  limits.maxTradesPerDay === null",
          "    ? null",
          "    : { value: entered, limit: limits.maxTradesPerDay, within: entered <= limits.maxTradesPerDay };",
          "const loss =",
          "  limits.maxDailyLossLamports === null",
          "    ? null",
          "    : { value: net, limit: limits.maxDailyLossLamports, within: net >= -limits.maxDailyLossLamports };",
        ] },
      },
    },
    {
      id: "dash-health",
      screen: "dashboard",
      anchor: "dash-health",
      title: "What could make a total wrong",
      plain: "Data health lists everything that could make a figure or an export wrong, such as a transaction the parser could not read. Each row links to the place where it is fixed.",
      live: "these counts cover every wallet the owner has added, and the same list warns on the accountant export.",
      technical: {
        text: "The checks are counted from the stored rows: parse failures, unsupported events, missing EUR rates, unlinked rent, unlabelled incoming SOL, orphan fees, written-off trades and the review backlog. All zero shows a calm complete state.",
        code: { label: "lib/health.ts", lines: [
          "/** Every check in a fixed order, with its count and link. */",
          "export const healthRows = (h: DataHealth): HealthRow[] => ORDER.map((key) => ({ key, count: h[key], ...ROWS[key] }));",
        ] },
      },
    },
    {
      id: "dash-cumulative",
      screen: "dashboard",
      anchor: "dash-cumulative",
      title: "One point per trading day",
      plain: "The line is the running total of net P&L, one point for every trading day in the range. Days without a trade keep the line flat instead of skipping it.",
      technical: {
        text: "Charts receive SOL as plain numbers because they are only drawn, never added up again. The totals on the cards are summed from lamports first and only then formatted.",
      },
    },
    {
      id: "dash-roi",
      screen: "dashboard",
      anchor: "dash-roi",
      title: "Return on what went in",
      plain: "ROI is a position's net P&L divided by the SOL spent buying. The histogram counts decided trades per ROI range, with the bins below zero drawn as losses.",
      technical: {
        text: "Each bin includes its lower edge. The bin is chosen on the exact ratio, so a trade at exactly 10% lands in the 10 to 25% bin.",
        code: { label: "lib/analytics/buckets.ts", lines: [
          "export function roiBucket(t: AnalyticsTrade, edges: readonly number[] = ROI_EDGES): Bucket | null {",
          "  if (t.roi === null) return null;",
          "  const pct = toDecimal(t.roi).mul(100);",
          "  const index = edges.reduce((found, edge, i) => (pct.gte(edge) ? i + 1 : found), 0);",
        ] },
      },
    },
    {
      id: "dash-gating",
      screen: "dashboard",
      anchor: "dash-gating",
      title: "Thin groups stay grey",
      plain: "A group with fewer than 10 decided trades is drawn grey instead of green or red. Small samples get no colour-coded judgement.",
      technical: {
        text: "Strategy and mistake groups use reviewed trades only, since both come from the owner's own reviews. A trade with two mistake tags counts in both groups.",
        code: { label: "lib/analytics/groupBy.ts", lines: [
          "/** §6: groups below this size are \"not enough data\", and comparisons need it on both sides. */",
          "export const MIN_SAMPLE = 10;",
        ] },
      },
    },
    {
      id: "dash-recent",
      screen: "dashboard",
      anchor: "dash-recent",
      title: "Latest positions",
      plain: "The five most recently entered positions, with the same columns as Trades. Grade opens a finished trade that still needs a review; Inspect opens the rest.",
    },
  ]);
})();
