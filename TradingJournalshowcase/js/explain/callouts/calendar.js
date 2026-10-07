// Callouts for the Calendar (#/calendar) and its day panel. Conventions: see the header of js/explain/engine.js.
(function () {
  window.SJ.explain.define([
    {
      id: "cal-day-start",
      screen: "calendar",
      anchor: "cal-day-start",
      title: "A trading day starts at 04:00",
      plain: "A late session belongs to the day it started. With the day start at 04:00, a trade entered at 02:30 counts as the previous day.",
      technical: {
        text: "Times are stored in UTC and turned into the owner's timezone (Europe/Dublin by default) first, then shifted back by the day-start hour, so summer and winter time are handled by the timezone library. The same rule decides the dashboard's days, the calendar, the limits and which week or month a review covers.",
        code: { label: "lib/analytics/sessions.ts", lines: [
          "export function tradingDay(at: Date, timeZone: string, dayStartHour: number): string {",
          "  const [day, hour] = formatInTimeZone(at, timeZone, \"yyyy-MM-dd HH\").split(\" \") as [string, string];",
          "  return Number(hour) < dayStartHour ? previousDay(day) : day;",
          "}",
        ] },
      },
    },
    {
      id: "cal-summary",
      screen: "calendar",
      anchor: "cal-summary",
      title: "The month in five numbers",
      plain: "Net result, how many days had trades, green against red days, fees, and how many of those days have a written review.",
      technical: {
        text: "A day's result counts only decided trades (closed with an outcome); fees and the trade count include every position entered that day, so a day with only open trades is grey. EUR is shown only when every transaction in it has a SOL/EUR rate.",
      },
    },
    {
      id: "cal-grid",
      screen: "calendar",
      anchor: "cal-grid",
      title: "Colour shows size, not just sign",
      plain: "Green days made money, red days lost it, grey days broke even. The stronger the tint, the bigger the day compared with the biggest day of the month.",
      technical: {
        text: "A small dot marks a day with a daily review. Each colour has five steps, set by the day's absolute net result divided by the month's largest one. Below 768 px the grid becomes a list of the weeks' active days.",
        code: { label: "lib/analytics/calendar.ts", lines: [
          "export function intensityStep(netPnl: bigint, maxAbs: bigint): number {",
          "  if (maxAbs === 0n || netPnl === 0n) return 0;",
          "  return Math.min(4, Math.max(0, Math.ceil((Number(absLamports(netPnl)) / Number(maxAbs)) * 5) - 1));",
          "}",
        ] },
      },
    },
    {
      id: "cal-weeks",
      screen: "calendar",
      anchor: "cal-weeks",
      title: "Week totals",
      plain: "Each row of the month adds up its own days, so a bad week stands out even when the month looks fine.",
      technical: { text: "Only the days inside the month count, so the first and last week of a month can be partial. A week with no trading shows a dash, not zero." },
    },
    {
      id: "cal-panel",
      screen: "calendar",
      anchor: "cal-panel",
      title: "The day panel",
      plain: "Click a day to see its trades, numbers, the Coach and your daily review side by side. On smaller screens it opens as a drawer instead.",
      technical: { text: "The selected day is part of the address (?month=…&day=…), so a day can be bookmarked and the back button closes it. From 1280 px it is a 380 px inspector next to the grid." },
    },
    {
      id: "cal-day-stats",
      screen: "calendar",
      anchor: "cal-day-stats",
      title: "One day at a glance",
      plain: "Net result, fees, trades entered with wins, losses and breakevens, and the average execution grade of the trades you reviewed.",
      technical: { text: "The average execution score maps grades A to F to 4 down to 0 and averages the reviewed trades of the day. Each trade below links to its detail page." },
    },
    {
      id: "cal-limits",
      screen: "calendar",
      anchor: "cal-limits",
      title: "Your limits, stated as facts",
      plain: "If you set a daily trade limit or a daily loss limit in Settings, the day is compared with it in plain words: within or over. It never tells you what to do.",
      technical: {
        text: "Reaching a limit exactly still counts as within. The loss limit is compared with the net result of the day's decided trades; the trade limit with every position entered that day, open ones too.",
        code: { label: "lib/format/limits.ts", lines: [
          "// Factual wording only (\"within\" / \"over\"); never advice.",
          "const verdict = (within: boolean) => (within ? \"within\" : \"over\");",
          "// …",
          "lines.push(`${n} ${n === 1 ? \"trade\" : \"trades\"} · limit ${d.trades.limit} · ${verdict(d.trades.within)}`);",
        ] },
      },
    },
    {
      id: "cal-coach",
      screen: "calendar",
      anchor: "cal-coach",
      title: "Day Coach, on request only",
      plain: "Review this day asks the AI Coach for a short critique of the whole day: patterns, contradictions with your own notes, and questions. It runs only when you press the button.",
      live: "the day's numbers and your reviews go to the model; this demo shows sample output and fails the first run on purpose so you can try Retry.",
      technical: {
        text: "The answer must match a strict schema with hard limits, and every point cites the input fields it is based on. When a trade, a trade review or the daily review changes, the critique is marked out of date; it is never regenerated by itself.",
        code: { label: "lib/ai/coach/day.ts", lines: [
          "export const dayCoachOutputSchema = z.object({",
          "  summary: z.string().max(500),",
          "  patterns: z.array(cited({ pattern: z.string().max(400) })).max(5),",
          "  contradictions: z.array(cited({ claim: z.string().max(400) })).max(5),",
          "  rule_flags: z.array(cited({ rule: z.string().max(200) })).max(5),",
          "  questions_for_you: z.array(z.string().max(300)).max(3),",
          "  data_gaps: z.array(z.string().max(300)).max(5),",
          "});",
        ] },
      },
    },
    {
      id: "cal-review",
      screen: "calendar",
      anchor: "cal-review",
      title: "The daily review",
      plain: "A few minutes at the end of the day: did you follow your plan, what went well, the biggest mistake, what to repeat and avoid, a day grade, discipline 1 to 5 and a free journal.",
      technical: { text: "Every field is optional and choosing a selected option again clears it. The review belongs to the owner, not to a wallet, and appears in the Journal. In this demo it is saved in memory only." },
    },
  ]);
})();
