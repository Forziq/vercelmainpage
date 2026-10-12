// Guided tour steps (docs/showcase.md §6, tour outline), in story order. Each step names a callout: the tour opens
// that callout's screen, highlights its anchor and links to its Under the hood note, so a step can never point at an
// element or a note that does not exist (tests/showcase-tour.test.ts renders every step).
//   path     the hash to open; a function when it depends on the data (the trade with a sample critique)
//   callout  the id of a callout with a technical note, on the screen that path opens
//   explain  true turns Explain on for the step, false turns it off (the tour puts it back as it was on exit)
//   title    a few words; text one plain-English paragraph
(function () {
  var SJ = (window.SJ = window.SJ || {});

  /** The latest trade of the active wallet (else any wallet) with a finished sample critique, so the Coach step has output. */
  function coachTrade() {
    var done = function (o) { return SJ.store.trades(o).filter(function (t) { return SJ.coach.state(t) === "done"; }); };
    var list = done();
    if (!list.length) list = done({ allWallets: true });
    var pick = list.sort(function (a, b) { return a.closedAt < b.closedAt ? 1 : a.closedAt > b.closedAt ? -1 : 0; })[0];
    return pick ? SJ.tradeList.tradeHref(pick.key) : "#/trades";
  }

  SJ.tourSteps = [
    {
      path: "#/", callout: "ov-flow", explain: false, title: "One way through the data",
      text: "The journal imports one public wallet's trades and helps its owner reflect on them; it never suggests a trade. Data moves one way: raw transactions are stored once and never changed, so positions, statistics and reviews can always be rebuilt from them.",
    },
    {
      path: "#/dashboard", callout: "dash-net", explain: true, title: "What the numbers mean",
      text: "Explain is now on: each numbered marker opens a short note about the part it sits on. Net P&L adds up finished positions after every fee, and the Data health card lists anything that could make a total wrong.",
    },
    {
      path: "#/inbox", callout: "ib-review", explain: false, title: "A review in under a minute",
      text: "Every finished position waits here, one at a time, for a short review. Only the execution grade is required; strategy, tags, rules and a one-line takeaway are a tap each, and the keyboard alone is enough.",
    },
    {
      path: coachTrade, callout: "td-events", explain: false, title: "From events to a position",
      text: "A position is one round trip in one token, rebuilt from events the parser reads from balance changes. Fees are split by type, and a wrong position is fixed with a correction that can be undone, never by editing the raw data.",
    },
    {
      path: coachTrade, callout: "co-panel", explain: false, title: "A coach with guardrails",
      text: "The AI Coach checks a review against the trade's numbers and the owner's own rules, and only when asked. It gives no trade advice, does not judge the token and cites the input behind every point; this demo shows sample output.",
    },
    {
      path: "#/analytics", callout: "an-gating", explain: true, title: "Small samples stay grey",
      text: "Every breakdown greys out groups with fewer than 10 closed trades, so a thin sample never shows as green or red. The heatmap on this tab shows results by weekday and time of entry, with cells under 3 trades hatched.",
    },
    {
      path: "#/calendar", callout: "cal-day-start", explain: false, title: "Trading days and frozen reviews",
      text: "A trading day starts at 04:00, so a late session stays on the day it began; the calendar, limits and reviews all use that day. Weekly and monthly reviews freeze their numbers the first time they are opened, so later edits do not rewrite what was reflected on.",
    },
    {
      path: "#/rules", callout: "vr-auto", explain: false, title: "Rules, limits, after a loss",
      text: "Rules are the owner's own: each review records them as followed or broken, and automatic checks only suggest. Daily limits from Settings appear on the dashboard, and Analytics sets trades taken right after a loss next to the rest, without advice.",
    },
    {
      path: "#/exports", callout: "x-recon", explain: true, title: "An export an accountant can check",
      text: "The tax-year workbook matches sales first in, first out, and says plainly that FIFO is an assumption to confirm with an accountant. Its reconciliation explains, line by line, why its total differs from the journal's.",
    },
    {
      path: "#/settings", callout: "set-status", explain: false, title: "Sync, security and backup",
      text: "Sync fetches the wallet's transactions a page at a time and rebuilds only the tokens they touched. The app reads a public address and never a key, its own keys stay on the server, and a backup keeps what the chain cannot give back.",
    },
  ];
})();
