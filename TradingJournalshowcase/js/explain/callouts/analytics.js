// Callouts for Analytics. Each tab's anchor exists only while that tab is open; the screen test walks every tab.
// Conventions: see js/explain/engine.js.
(function () {
  var a = function (anchor, c) { return Object.assign({ id: anchor, screen: "analytics", anchor: anchor }, c); };

  window.SJ.explain.define([
    a("an-gating", {
      title: "Why some groups are grey",
      plain: "A group with fewer than 10 closed trades is still listed with its numbers, but greyed out and without green or red. Ten trades is the least the journal will let a group speak from.",
      technical: {
        text: "Every breakdown row carries an enoughData flag. Below the threshold the row is drawn neutral, and it can never be one side of a comparison.",
        code: { label: "lib/analytics/groupBy.ts", lines: [
          "export const MIN_SAMPLE = 10;",
          "// …",
          "      const s = summarize(members);",
          "      return {",
          "        bucket,",
          "        n: s.trades,",
          "        enoughData: s.trades >= MIN_SAMPLE,",
        ] },
      },
    }),
    a("an-range", {
      title: "One period for every tab",
      plain: "The period picks which entries count: the last 30, 90 or 180 days, or everything. All tabs read the same set of trades.",
      technical: { text: "Session numbers, streaks and market-cap groups are worked out over all trades first and then filtered, so a trade near the start of the range keeps the same context it had before." },
    }),
    a("an-heatmap", {
      title: "When you trade, on the clock",
      plain: "Seven weekdays by twelve two-hour blocks of entry time in your timezone, showing net result, win rate or average grade. Cells with fewer than 3 trades are hatched, so one lucky trade does not light up a block.",
      technical: {
        text: "The grid uses the calendar weekday and wall-clock hour, not the trading day: a 02:30 Saturday entry sits in Saturday 02–04 even when the trading day starts at 04:00.",
        code: { label: "lib/analytics/heatmap.ts", lines: [
          "export function heatmapSlot(at: Date, timeZone: string): { day: number; block: number } {",
          "  const [isoDay, hour] = formatInTimeZone(at, timeZone, \"i H\").split(\" \").map(Number) as [number, number];",
          "  return { day: isoDay - 1, block: Math.floor(hour / 2) };",
          "}",
        ] },
      },
    }),
    a("an-time", {
      title: "Time and session breakdowns",
      plain: "Hour of day, day of week, the trade's number in the day and in its session, and the streak you were on when you entered.",
      technical: { text: "The weekday here is the trading day's, unlike the heatmap, so it matches the calendar. A session ends after a gap set in Settings." },
    }),
    a("an-reflection", {
      title: "Only from reviewed trades",
      plain: "Confidence, emotion, strategy, tags, grade and terminal come from your own reviews, so these tables count reviewed trades only. A trade with two tags counts in both.",
      technical: { text: "These dimensions pass reviewedOnly, which drops unreviewed trades before grouping instead of putting them in an Unknown row." },
    }),
    a("an-shape", {
      title: "Facts, not insights",
      plain: "Each table shows its numbers and, when two groups both have 10 trades, a plain line comparing the best and worst average. The journal never writes a conclusion or a tip like \"trade less on Fridays\": it reports and you decide what it means.",
      technical: {
        text: "The comparison is between the groups with the highest and lowest average net result among those with enough data, and returns nothing otherwise.",
        code: { label: "lib/analytics/breakdowns.ts", lines: [
          "export function bestVsWorst(rows: readonly GroupRow[]): Comparison | null {",
          "  const ok = rows.filter((r) => r.enoughData && r.avgNetPnl !== null);",
          "  if (ok.length < 2) return null;",
          "// …",
          "  return best === worst ? null : compareGroups(best, worst);",
        ] },
      },
    }),
    a("an-extension", {
      title: "What the browser extension saw",
      plain: "In the live app, a companion Chrome extension records what was on screen at each buy, and this tab groups trades by those captures. The demo has none, so it shows the empty state.",
      technical: { text: "A capture is linked to the closest buy of the same token within 30 seconds before to 5 minutes after it, and each breakdown here uses the same 10-trade rule." },
    }),
    a("an-after-loss", {
      title: "After a loss",
      plain: "Trades entered right after a losing trade on the same day, next to all the others: how many, their median size, how soon after the loss, and how they went. It shows the numbers side by side and leaves the reading to you.",
      technical: {
        text: "The previous trade is the last one closed at or before the entry on the same trading day, found across all trades, so the range edge does not hide it.",
        code: { label: "lib/analytics/tilt.ts", lines: [
          "const decided = trades.filter(isDecided);",
          "const afterLoss = decided.filter((t) => prev.get(t.key)?.outcome === \"loss\");",
          "const other = decided.filter((t) => prev.get(t.key)?.outcome !== \"loss\");",
        ] },
      },
    }),
  ]);
})();
