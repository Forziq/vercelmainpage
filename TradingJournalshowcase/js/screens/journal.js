// Journal (#/journal?page=n, app/(app)/journal): trading days that have a daily review or a trade lesson, newest
// first, 20 days a page. A lesson belongs to the trading day of its trade's entry, like the calendar.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var f = SJ.format;
  var A = SJ.explain.anchor;
  var PLAN = { yes: "Yes", partly: "Partly", no: "No" };
  var TEXT = [["wentWell", "Went well"], ["biggestMistake", "Biggest mistake"], ["repeat", "Repeat"], ["avoid", "Avoid tomorrow"], ["journal", "Journal"]];

  var dayTitle = function (d) { return new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }); };

  function reviewBody(r) {
    var meta = [r.followedPlan && "Followed plan: " + PLAN[r.followedPlan], r.discipline && "Discipline " + r.discipline + "/5"].filter(Boolean);
    var texts = TEXT.filter(function (x) { return r[x[0]]; });
    return h("section", { "aria-label": "Daily review", class: "journal-review" },
      (r.executionGrade || meta.length) && h("p", { class: "journal-meta text-body-sm text-muted" },
        r.executionGrade && h("span", { class: "journal-grade" }, "Day grade ", ui.gradeBadge(r.executionGrade)),
        meta.map(function (m) { return h("span", { text: m }); })),
      texts.length > 0 && h("dl", { class: "journal-texts" }, texts.map(function (x) {
        return h("div", null, h("dt", { class: "text-label-sm text-muted uppercase", text: x[1] }), h("dd", { class: "text-body-md text-fg pre-wrap", text: r[x[0]] }));
      })));
  }

  function lessons(list, divided) {
    return h("section", { "aria-label": "Trade lessons", class: SJ.dom.cx("journal-lessons", divided && "day-divided") },
      h("h3", { class: "text-label-sm text-muted uppercase", text: "Trade lessons" }),
      h("ul", { class: "lesson-list" }, list.map(function (t) {
        var eur = t.status === "open" ? null : SJ.fiat.pnlOf(t);
        return h("li", { class: "lesson" },
          h("span", { class: "lesson-head" }, h("a", { class: "link-quiet text-body-md", href: SJ.tradeList.tradeHref(t.key), text: t.label }), ui.gradeBadge(t.reflection.grade),
            h("span", { class: "pnl-stack lesson-pnl" },
              ui.pnlValue({ value: f.sol(t.netPnl, { signed: true }), sign: t.status === "open" ? null : f.signOf(t.netPnl), neutral: t.outcome === "breakeven", className: "text-data-xs" }),
              ui.fiatSub(SJ.fiat.label(eur, true), t.outcome === "breakeven" ? "neutral" : ui.toneOf(SJ.fiat.sign(eur))))),
          h("span", { class: "text-body-md text-fg pre-wrap", text: t.reflection.lesson }));
      })));
  }

  function entry(e, i) {
    var id = "journal-" + e.day;
    var card = ui.card({ labelledby: id, padding: "lg", className: "journal-day" }, [
      h("header", { class: "journal-head" },
        h("h2", { id: id, class: "text-headline-md" }, h("a", { class: "link-quiet", href: SJ.calendar.href(e.day.slice(0, 7), e.day), text: dayTitle(e.day) })),
        e.stats && h("span", { class: "journal-day-side font-mono text-data-xs text-muted" }, e.stats.entered + (e.stats.entered === 1 ? " trade" : " trades"),
          h("span", { class: "pnl-stack" }, ui.pnl(e.stats.netPnl, { className: "text-data-md" }), ui.fiatSub(SJ.fiat.label(e.eur, true), ui.toneOf(SJ.fiat.sign(e.eur)))))),
      e.review && reviewBody(e.review),
      e.lessons.length > 0 && lessons(e.lessons, !!e.review),
    ]);
    return i === 0 ? A(card, "jr-entry") : card;
  }

  function render() {
    SJ.router.watch(SJ.router.refresh);
    var page = Number(new URLSearchParams(SJ.router.query()).get("page")) || 1;
    var j = SJ.calendar.journal(page);
    var head = h("header", { class: "page-header" }, h("div", null, h("h1", { class: "text-headline-lg", tabindex: "-1", text: "Journal" }),
      A(h("p", { class: "text-body-sm text-muted", text: "Daily reviews and trade lessons, newest first" }), "jr-feed")));
    if (j.total === 0) {
      return h("div", { class: "page" }, head, ui.emptyState({ icon: "book-open", title: "Nothing written yet", body: "Write a daily review from the Calendar, or add a key takeaway when you review a trade.",
        action: h("a", { class: "btn btn-primary", href: "#/calendar", text: "Open Calendar" }) }));
    }
    return h("div", { class: "page" }, head,
      h("div", { class: "journal-feed" }, j.days.map(entry)),
      ui.pagination({ page: j.page, pageCount: j.pageCount, pageSize: SJ.calendar.JOURNAL_DAYS_PER_PAGE, total: j.total, noun: "days",
        onPage: function (p) { window.location.hash = p === 1 ? "#/journal" : "#/journal?page=" + p; } }));
  }

  SJ.screens = SJ.screens || {};
  SJ.screens.journal = { render: render };
})();
