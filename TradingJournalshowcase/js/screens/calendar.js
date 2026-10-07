// Calendar (#/calendar?month=yyyy-MM&day=yyyy-MM-dd, app/(app)/calendar): month summary, the month grid with the P&L
// tint and review dots (a week list on phones), week totals, and the day panel: an inline inspector from 1280 px, a
// drawer below. Changing month slides the grid in the direction of travel (fades for a jump).
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var f = SJ.format;
  var A = SJ.explain.anchor;
  var C = SJ.calendar;
  var WIDE = "(min-width: 1280px)";
  var WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var KIND_TEXT = { profit: "profit", loss: "loss", breakeven: "breakeven" };
  var shownMonth = null;
  var drawer = null;

  var wide = function () { return !window.matchMedia || window.matchMedia(WIDE).matches; };
  var utc = function (day, opts) { return new Date(day + "T00:00:00Z").toLocaleDateString("en-GB", Object.assign({ timeZone: "UTC" }, opts)); };
  var monthTitle = function (m) { return utc(m + "-01", { month: "long", year: "numeric" }); };
  var dayTitle = function (d) { return utc(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" }); };
  var dayLabel = function (d) { return utc(d, { weekday: "short", day: "numeric", month: "short" }); };
  var pnl = function (v, cls) { return ui.pnlValue({ value: f.sol(v, { signed: true }), sign: f.signOf(v), unit: "", className: cls }); };

  /** How the grid moves between two months: one step either way slides, anything else fades. */
  function monthMove(from, to) {
    if (!from || from === to) return null;
    return to === C.shiftMonth(from, 1) ? "next" : to === C.shiftMonth(from, -1) ? "prev" : "jump";
  }

  function params() {
    var q = new URLSearchParams(SJ.router.query());
    var today = C.today();
    var month = /^\d{4}-(0[1-9]|1[0-2])$/.test(q.get("month") || "") ? q.get("month") : today.slice(0, 7);
    var day = /^\d{4}-\d{2}-\d{2}$/.test(q.get("day") || "") && q.get("day").slice(0, 7) === month && !isNaN(Date.parse(q.get("day"))) ? q.get("day") : null;
    return { month: month, day: day, today: today };
  }

  function cellLabel(c) {
    var parts = [dayLabel(c.day)];
    if (c.stats) parts.push(f.sol(c.stats.netPnl, { signed: true }) + " SOL", KIND_TEXT[c.stats.kind], c.stats.entered + " trades");
    else parts.push("no trading");
    if (c.reviewed) parts.push("reviewed");
    return parts.join(", ");
  }
  var tint = function (s, step) { return s ? "cal-" + s.kind + " step-" + step : "cal-empty"; };

  function cell(c, p) {
    var n = String(Number(c.day.slice(8)));
    if (!c.inMonth) return h("div", { class: "cal-cell is-outside", "aria-hidden": "true" }, h("span", { class: "font-mono text-data-xs", text: n }));
    var s = c.stats;
    return h("a", { href: C.href(p.month, c.day), class: SJ.dom.cx("cal-cell", tint(s, c.step), c.day === p.day && "is-selected"), "aria-label": cellLabel(c),
      "aria-current": c.day === p.day ? "date" : null, "data-day": c.day, "data-refocus": "cal-" + c.day },
      h("span", { class: "cal-cell-head font-mono text-data-xs" }, h("span", { class: c.day === p.today ? "cal-today" : "text-muted", text: n }),
        c.reviewed && h("span", { class: "cal-dot", "aria-hidden": "true" })),
      s ? [pnl(s.netPnl, "cal-pnl text-data-xs"), h("span", { class: "cal-count font-mono text-data-xs text-muted", text: s.entered + (s.entered === 1 ? " trade" : " trades") })]
        : h("span", { class: "cal-count text-data-xs text-muted", text: "—" }));
  }

  function weekRange(cells) {
    var own = cells.filter(function (c) { return c.inMonth; });
    var fmt = function (d) { return utc(d, { day: "numeric", month: "short" }); };
    return fmt(own[0].day) + " – " + fmt(own[own.length - 1].day);
  }

  function grid(m, p) {
    var table = A(h("div", { role: "table", "aria-label": "Month", class: "cal-table" },
      h("div", { role: "row", class: "cal-row" }, WEEKDAYS.map(function (d) { return h("div", { role: "columnheader", class: "cal-weekday text-label-sm text-muted uppercase", text: d }); })),
      m.weeks.map(function (w) { return h("div", { role: "row", class: "cal-row" }, w.cells.map(function (c) { return h("div", { role: "cell", class: "cal-slot" }, cell(c, p)); })); })), "cal-grid");
    var totals = A(h("ul", { class: "cal-week-totals", "aria-label": "Week totals" }, m.weeks.map(function (w) {
      return h("li", { class: "text-body-sm text-muted" }, h("span", { text: weekRange(w.cells) + ":" }), w.active ? pnl(w.netPnl, "text-data-xs") : h("span", { class: "font-mono text-data-xs", text: "—" }));
    })), "cal-weeks");
    var phone = h("div", { class: "cal-phone" }, m.weeks.map(function (w) {
      var days = w.cells.filter(function (c) { return c.inMonth && (c.stats || c.reviewed); });
      return h("section", { "aria-label": "Week " + weekRange(w.cells) },
        h("h3", { class: "cal-phone-head text-label-sm text-muted uppercase" }, h("span", { text: weekRange(w.cells) }), w.active && pnl(w.netPnl, "text-data-xs")),
        days.length === 0 ? h("p", { class: "cal-phone-empty text-body-sm text-muted", text: "No trading" }) :
          h("ul", { class: "cal-phone-days" }, days.map(function (c) {
            return h("li", null, h("a", { href: C.href(p.month, c.day), class: SJ.dom.cx("cal-phone-day", tint(c.stats, c.step)), "aria-current": c.day === p.day ? "date" : null },
              h("span", { class: "cal-phone-label text-body-md text-fg", text: dayLabel(c.day) }),
              c.reviewed && h("span", { class: "cal-dot" }, h("span", { class: "sr-only", text: "Reviewed" })),
              h("span", { class: "cal-phone-side" }, c.stats && h("span", { class: "font-mono text-data-xs text-muted", text: c.stats.entered + "×" }),
                c.stats ? pnl(c.stats.netPnl, "text-data-md") : h("span", { class: "text-muted", text: "—" }))));
          })));
    }));
    var move = monthMove(shownMonth, m.month);
    shownMonth = m.month;
    return h("div", { class: SJ.dom.cx("cal-month", move && "move-" + move) }, h("div", { class: "cal-desktop" }, table, totals), phone);
  }

  function summary(m) {
    var decisive = m.profitDays + m.lossDays;
    var stat = function (o) { return ui.statCard(Object.assign({ compact: true }, o)); };
    var active = m.activeDays > 0;
    return A(ui.card({ label: "Month summary", padding: "none", className: "summary-strip summary-5" }, [
      stat({ label: "Net P&L", value: f.sol(m.netPnl, { signed: true }), unit: "SOL", tone: ui.toneOf(f.signOf(m.netPnl)), sub: active && ui.fiatSub(SJ.fiat.label(m.eur.netPnl, true), ui.toneOf(SJ.fiat.sign(m.eur.netPnl))) }),
      stat({ label: "Active days", value: String(m.activeDays) }),
      stat({ label: "Win / loss days", value: m.profitDays + " / " + m.lossDays, delta: decisive > 0 ? Math.round((m.profitDays / decisive) * 100) + "% green · " + m.breakevenDays + " flat" : null }),
      stat({ label: "Fees", value: f.sol(m.fees, { decimals: 6 }), unit: "SOL", sub: active && ui.fiatSub(SJ.fiat.label(m.eur.fees)) }),
      stat({ label: "Reviewed days", value: m.reviewedDays + " / " + m.activeDays }),
    ]), "cal-summary");
  }

  function header(p) {
    var s = SJ.store.settings();
    var nav = h("nav", { "aria-label": "Month", class: "cal-nav" },
      h("a", { class: "btn btn-secondary btn-sm btn-square", href: C.href(C.shiftMonth(p.month, -1)), "aria-label": "Previous month", "data-refocus": "cal-prev" }, SJ.dom.icon("chevron-left")),
      h("span", { class: "cal-nav-month font-mono text-data-md text-fg", text: monthTitle(p.month) }),
      h("a", { class: "btn btn-secondary btn-sm btn-square", href: C.href(C.shiftMonth(p.month, 1)), "aria-label": "Next month", "data-refocus": "cal-next" }, SJ.dom.icon("chevron-right")),
      h("a", { class: "btn btn-ghost btn-sm", href: C.href(p.today.slice(0, 7), p.today), text: "Today" }));
    return h("header", { class: "page-header" },
      h("div", null, h("h1", { class: "text-headline-lg", tabindex: "-1", text: "Calendar" }),
        A(h("p", { class: "text-body-sm text-muted", text: "Trading days start at " + String(s.dayStartHour).padStart(2, "0") + ":00 (" + SJ.tradeTable.zoneLabel(s.timeZone) + ") · days are coloured by the net P&L of trades entered that day" }), "cal-day-start")),
      nav);
  }

  /** The panel's title and body; the inline inspector or the drawer holds them. */
  function panelParts(p) {
    var sel = C.day(p.day);
    return { title: dayTitle(p.day), description: sel.stats ? sel.stats.entered + " trades entered" : "No trades entered", body: SJ.dayDetail.render(sel) };
  }

  function inspector(p) {
    var parts = panelParts(p);
    return A(h("aside", { class: "cal-inspector", "aria-label": parts.title },
      h("header", { class: "cal-inspector-head" }, h("div", null, h("h2", { class: "text-title-sm text-fg", text: parts.title }), h("p", { class: "text-body-sm text-muted", text: parts.description })),
        h("a", { class: "btn btn-ghost btn-sm btn-square", href: C.href(p.month), "aria-label": "Close day" }, SJ.dom.icon("x"))),
      h("div", { class: "cal-inspector-body" }, parts.body)), "cal-panel");
  }

  function closeDrawer(silent) {
    if (!drawer) return;
    var d = drawer;
    drawer = null;
    d.silent = silent;
    d.handle.close();
  }

  /** Below 1280 px the day opens in the drawer; a redraw (a save, a Coach run) swaps its body and keeps focus. */
  function syncDrawer(p) {
    if (!p.day || wide()) return closeDrawer(true);
    var parts = panelParts(p);
    if (drawer && drawer.day === p.day && drawer.handle.panel.isConnected) {
      var body = drawer.handle.panel.querySelector(".overlay-body");
      var focused = document.activeElement && body.contains(document.activeElement) ? document.activeElement.getAttribute("data-refocus") : null;
      SJ.dom.clear(body).appendChild(parts.body);
      var again = focused && body.querySelector('[data-refocus="' + focused + '"]');
      if (again) again.focus();
      return;
    }
    closeDrawer(true);
    var entry = { day: p.day, silent: false };
    entry.handle = SJ.overlay.drawer({ title: parts.title, description: parts.description, body: parts.body, onClose: function () {
      if (drawer === entry) drawer = null;
      if (!entry.silent) window.location.hash = C.href(p.month).slice(1);
    } });
    drawer = entry;
  }

  function render() {
    var p = params();
    // Arriving from another page shows the month without a slide; only a change of month on this page moves it.
    if (!SJ.router.current().redraw) shownMonth = null;
    SJ.router.watch(SJ.router.refresh);
    var m = C.month(p.month);
    var inline = p.day && wide();
    var page = h("div", { class: "page" }, header(p), summary(m),
      h("div", { class: SJ.dom.cx("cal-layout", inline && "has-panel") }, grid(m, p), inline && inspector(p)));
    // The drawer lives outside the page, so it is opened once the page is on screen.
    setTimeout(function () { if (page.isConnected) syncDrawer(p); }, 0);
    return page;
  }

  // Leaving the calendar (or its day) closes the drawer without navigating again; crossing 1280 px redraws.
  // This listener runs before the router's, so it reads the new hash itself.
  window.addEventListener("hashchange", function () {
    if (window.location.hash.replace(/^#\/?/, "").split("?")[0].replace(/\/+$/, "") !== "calendar") closeDrawer(true);
  });
  if (window.matchMedia) {
    var query = window.matchMedia(WIDE);
    var onWidth = function () { var r = SJ.router.current().route; if (r && r.name === "calendar" && params().day) SJ.router.refresh(); };
    if (query.addEventListener) query.addEventListener("change", onWidth);
  }

  SJ.screens = SJ.screens || {};
  SJ.screens.calendar = { render: render, monthMove: monthMove, params: params };
})();
