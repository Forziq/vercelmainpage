// Calendar, day panel and Journal data (lib/analytics/calendar.ts, services/calendar.ts). A trade belongs to the
// trading day of its entry (reflection-analytics.md §10); P&L counts decided trades, fees and "entered" count all.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var M = SJ.metrics;
  var S = SJ.store;
  var JOURNAL_DAYS_PER_PAGE = 20;

  var dayOf = function (t, s) { return M.tradingDay(t.openedAt, s.timeZone, s.dayStartHour); };
  var abs = function (v) { return v < 0n ? -v : v; };

  /** Per trading day: entered, decided, wins, losses, net P&L, fees, average execution score and the day's kind. */
  function aggregateDays(trades, s) {
    var groups = {};
    trades.forEach(function (t) { (groups[dayOf(t, s)] = groups[dayOf(t, s)] || []).push(t); });
    var out = {};
    Object.keys(groups).forEach(function (day) {
      var group = groups[day];
      var decided = group.filter(M.isDecided);
      var net = SJ.format.sum(decided, function (t) { return t.netPnl; });
      out[day] = {
        day: day, entered: group.length, decided: decided.length,
        wins: decided.filter(function (t) { return t.outcome === "win"; }).length,
        losses: decided.filter(function (t) { return t.outcome === "loss"; }).length,
        netPnl: net, fees: SJ.format.sum(group, function (t) { return t.feesTotal; }),
        avgScore: M.asNumber(M.executionParts(group)),
        kind: net > 0n ? "profit" : net < 0n ? "loss" : "breakeven",
      };
    });
    return out;
  }

  /** 0–4 tint step for |net P&L| relative to the largest |net P&L| of the month. */
  function intensityStep(netPnl, maxAbs) {
    if (maxAbs === 0n || netPnl === 0n) return 0;
    return Math.min(4, Math.max(0, Math.ceil((Number(abs(netPnl)) / Number(maxAbs)) * 5) - 1));
  }

  /** `yyyy-MM` shifted by whole months. */
  function shiftMonth(month, by) {
    var parts = month.split("-").map(Number);
    return new Date(Date.UTC(parts[0], parts[1] - 1 + by, 1)).toISOString().slice(0, 7);
  }

  function monthDays(month) {
    var days = [];
    for (var d = month + "-01"; d.slice(0, 7) === month; d = M.shiftDay(d, 1)) days.push(d);
    return days;
  }

  /** Monday-first month grid with padding days from the neighbouring months (they carry no stats). */
  function buildMonth(month, days, reviewed) {
    var inMonth = monthDays(month);
    var first = inMonth[0];
    var last = inMonth[inMonth.length - 1];
    var stats = inMonth.filter(function (d) { return days[d]; }).map(function (d) { return days[d]; });
    var maxAbs = stats.reduce(function (m, d) { return abs(d.netPnl) > m ? abs(d.netPnl) : m; }, 0n);
    var weeks = [];
    for (var d = M.shiftDay(first, 1 - M.weekdayOf(first)); d <= M.shiftDay(last, 7 - M.weekdayOf(last)); d = M.shiftDay(d, 7)) {
      var cells = [];
      for (var i = 0; i < 7; i++) {
        var day = M.shiftDay(d, i);
        var own = day.slice(0, 7) === month;
        var s = own ? days[day] || null : null;
        cells.push({ day: day, inMonth: own, stats: s, step: s ? intensityStep(s.netPnl, maxAbs) : 0, reviewed: own && !!reviewed[day] });
      }
      var active = cells.filter(function (c) { return c.stats; });
      weeks.push({ cells: cells, netPnl: SJ.format.sum(active, function (c) { return c.stats.netPnl; }), active: active.length > 0 });
    }
    var count = function (kind) { return stats.filter(function (x) { return x.kind === kind; }).length; };
    return {
      month: month, weeks: weeks, netPnl: SJ.format.sum(stats, function (x) { return x.netPnl; }), activeDays: stats.length,
      profitDays: count("profit"), lossDays: count("loss"), breakevenDays: count("breakeven"),
      fees: SJ.format.sum(stats, function (x) { return x.fees; }), reviewedDays: inMonth.filter(function (x) { return reviewed[x]; }).length,
    };
  }

  // ---- Loaders over the store (active wallet; daily reviews belong to the owner, not to a wallet)

  var settings = function () { return S.settings(); };
  var today = function () { var s = settings(); return M.tradingDay(S.now(), s.timeZone, s.dayStartHour); };
  function reviewedDays() {
    var out = {};
    S.data().dailyReviews.forEach(function (r) { out[r.day] = true; });
    return out;
  }
  var dailyReview = function (day) { return S.data().dailyReviews.filter(function (r) { return r.day === day; })[0] || null; };

  /** Trades entered on one trading day, in entry order. */
  function dayTrades(day) {
    var s = settings();
    return S.trades({ from: M.tradingDayStart(day, s.timeZone, s.dayStartHour), to: M.tradingDayStart(M.shiftDay(day, 1), s.timeZone, s.dayStartHour) }).slice().sort(M.byEntry);
  }

  /** EUR net P&L of the decided trades and EUR fees of all of them; null when any rate is missing. */
  function eurOf(trades) {
    return {
      netPnl: SJ.fiat.sum(trades.filter(M.isDecided).map(SJ.fiat.pnlOf)),
      fees: SJ.fiat.sum(trades.map(function (t) { return SJ.fiat.position(t).fees; })),
    };
  }

  function month(m) {
    var s = settings();
    var all = S.trades();
    var built = buildMonth(m, aggregateDays(all, s), reviewedDays());
    var inMonth = all.filter(function (t) { return dayOf(t, s).slice(0, 7) === m; });
    built.eur = eurOf(inMonth);
    return built;
  }

  function day(d) {
    var s = settings();
    var trades = dayTrades(d);
    var stats = trades.length ? aggregateDays(trades, s)[d] : null;
    var limits = SJ.analytics.limitsOf(s);
    return {
      day: d, trades: trades, stats: stats, review: dailyReview(d), eur: eurOf(trades),
      limits: SJ.analytics.hasLimits(limits) ? SJ.analytics.checkDay(d, stats, limits) : null,
    };
  }

  /** Journal feed: trading days with a daily review or a trade lesson, newest first, 20 days a page. */
  function journal(page) {
    var s = settings();
    var trades = S.trades();
    var stats = aggregateDays(trades, s);
    var feed = {};
    var entry = function (d) { return feed[d] || (feed[d] = { day: d, stats: stats[d] || null, review: null, lessons: [] }); };
    S.data().dailyReviews.forEach(function (r) { entry(r.day).review = r; });
    trades.slice().sort(M.byEntry).forEach(function (t) { if (t.reflection && t.reflection.lesson) entry(dayOf(t, s)).lessons.push(t); });
    var days = Object.keys(feed).sort().reverse().map(function (d) { return feed[d]; });
    var pageCount = Math.max(1, Math.ceil(days.length / JOURNAL_DAYS_PER_PAGE));
    var current = Math.min(Math.max(1, page || 1), pageCount);
    var shown = days.slice((current - 1) * JOURNAL_DAYS_PER_PAGE, current * JOURNAL_DAYS_PER_PAGE);
    shown.forEach(function (x) { x.eur = x.stats ? eurOf(trades.filter(function (t) { return dayOf(t, s) === x.day; })).netPnl : null; });
    return { total: days.length, page: current, pageCount: pageCount, days: shown };
  }

  /** "#/calendar?month=2026-09&day=2026-09-14" */
  var href = function (m, d) { return "#/calendar?month=" + m + (d ? "&day=" + d : ""); };

  SJ.calendar = {
    JOURNAL_DAYS_PER_PAGE: JOURNAL_DAYS_PER_PAGE, aggregateDays: aggregateDays, intensityStep: intensityStep, shiftMonth: shiftMonth,
    monthDays: monthDays, buildMonth: buildMonth, today: today, dailyReview: dailyReview, dayTrades: dayTrades, month: month,
    day: day, journal: journal, href: href,
  };
})();
