// Callouts for the hidden UI kit gallery (#/kit), which shows the engine on shared parts. Removed with the kit in SH13.
(function () {
  window.SJ.explain.define([
    {
      id: "kit-money",
      screen: "kit",
      anchor: "kit-money",
      title: "Amounts are whole lamports",
      plain: "Money is kept as whole lamports, a billionth of a SOL, and only turned into SOL text when it is shown.",
      technical: {
        text: "Formatting divides by one billion with exact decimals and rounds to four places. A value that rounds to zero never shows a minus sign.",
        code: { label: "lib/format/sol.ts", lines: [
          "/** Lamports as SOL, e.g. `1.2345`, `+0.0800`, `-0.2750`. Never shows `-0.0000`. */",
          "export function formatSol(lamports: bigint, { decimals = 4, signed = false }: SolOptions = {}): string {",
          "  const text = lamportsToSol(lamports).toFixed(decimals);",
          "  if (/^-?0(\\.0*)?$/.test(text)) return text.replace(\"-\", \"\");",
          "  return signed && lamports > 0n ? `+${text}` : text;",
          "}",
        ] },
      },
    },
    {
      id: "kit-calendar",
      screen: "kit",
      anchor: "kit-calendar",
      title: "A trading day starts at 04:00",
      plain: "A trade placed between midnight and 04:00 counts towards the day before. The day starts at the hour chosen in Settings, 04:00 in this demo.",
      technical: {
        text: "The day is read from the local wall-clock time in the owner's time zone, not from a shifted UTC time, so the 23-hour and 25-hour days around clock changes stay correct.",
        code: { label: "lib/analytics/sessions.ts", lines: [
          "export function tradingDay(at: Date, timeZone: string, dayStartHour: number): string {",
          "  const [day, hour] = formatInTimeZone(at, timeZone, \"yyyy-MM-dd HH\").split(\" \") as [string, string];",
          "  return Number(hour) < dayStartHour ? previousDay(day) : day;",
          "}",
        ] },
      },
    },
    {
      id: "kit-sim",
      screen: "kit",
      anchor: "kit-sim",
      title: "Simulated server actions",
      plain: "Actions that need a server run a short simulation in this demo. Each one says what the live app does instead.",
      live: "these actions run on the app's own server, which calls the data provider, file storage or the AI service.",
      technical: {
        text: "One helper runs every simulation: a delay split into steps, then success or a sample failure, so states such as Retry can be shown. Reset demo stops any simulation that is still running.",
      },
    },
  ]);
})();
