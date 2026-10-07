// Callouts for the Journal (#/journal). Conventions: see the header of js/explain/engine.js.
(function () {
  window.SJ.explain.define([
    {
      id: "jr-feed",
      screen: "journal",
      anchor: "jr-feed",
      title: "Everything you wrote, in one place",
      plain: "The Journal is a reading view: every day with a daily review or a trade lesson, newest first. Nothing here is computed advice; it is your own words next to the day's result.",
      technical: {
        text: "The feed is built from two sources, daily reviews and the key takeaways of trade reviews, merged by trading day. A trade's lesson belongs to the trading day of its entry, as in the Calendar. Twenty days a page.",
        code: { label: "server/services/calendar.ts", lines: [
          "for (const r of reviews) entry(r.day).review = r;",
          "for (const l of lessons) entry(tradingDay(l.openedAt, settings.timeZone, settings.dayStartHour)).lessons.push(l);",
        ] },
      },
    },
    {
      id: "jr-entry",
      screen: "journal",
      anchor: "jr-entry",
      title: "One day",
      plain: "The date opens that day in the Calendar. Below it: the daily review, then the lessons from that day's trades with their grade and result.",
      technical: { text: "The day's result counts decided trades only, like the Calendar. EUR is shown when every transaction of the day has a SOL/EUR rate; otherwise it is left out rather than guessed." },
    },
  ]);
})();
