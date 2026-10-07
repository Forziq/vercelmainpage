// Reviews (app/(app)/reviews): Weekly | Monthly lists (#/reviews, #/reviews/monthly) and one week or month
// (#/reviews/2026-09-21, #/reviews/monthly/2026-09). Opening an ended period creates its draft with frozen stats;
// Recalculate replaces the snapshot and keeps the text; the period Coach runs only from its button.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var f = SJ.format;
  var A = SJ.explain.anchor;
  var M = SJ.metrics;
  var P = SJ.periods;
  var R = SJ.reviewStats;
  var TABS = [["#/reviews", "Weekly", "week"], ["#/reviews/monthly", "Monthly", "month"]];
  var LIVE_COACH = "the frozen stats, your three review texts and the day critiques of the period (never the wallet, token names or addresses) go to an AI model; the answer must match a strict schema and cite its input fields.";
  var LIVE_RECALC = "the server rebuilds the snapshot from the current positions and reviews; your text is stored separately and stays as it is.";

  var utc = function (day, opts) { return new Date(day + "T00:00:00Z").toLocaleDateString("en-GB", Object.assign({ timeZone: "UTC" }, opts)); };
  /** "22 – 28 Sep 2026", or "29 Sep – 5 Oct 2026" across a month. */
  function weekTitle(start) {
    var end = M.shiftDay(start, 6);
    var same = start.slice(0, 7) === end.slice(0, 7);
    return utc(start, same ? { day: "numeric" } : { day: "numeric", month: "short" }) + " – " + utc(end, { day: "numeric", month: "short", year: "numeric" });
  }
  var monthRange = function (start) { return "1 – " + utc(P.monthEndOf(start), { day: "numeric", month: "short", year: "numeric" }); };
  var isDraft = function (r) { return !r.keyLessons && !r.patternsNoticed && !r.notes; };
  var KIND = {
    week: { list: function () { return SJ.store.data().weeklyReviews; }, start: function (r) { return r.weekStart; }, href: function (s) { return "#/reviews/" + s; },
      title: weekTitle, current: function () { return P.weekStartOf(SJ.calendar.today()); }, shift: function (s, n) { return M.shiftDay(s, 7 * n); }, noun: "week", Noun: "Weekly" },
    month: { list: function () { return SJ.store.data().monthlyReviews; }, start: function (r) { return r.monthStart; }, href: function (s) { return "#/reviews/monthly/" + s.slice(0, 7); },
      title: R.monthTitle, current: function () { return P.monthStartOf(SJ.calendar.today()); }, shift: P.shiftMonth, noun: "month", Noun: "Monthly" },
  };
  var settings = function () { return SJ.store.settings(); };
  var startAt = function (day) { return M.tradingDayStart(day, settings().timeZone, settings().dayStartHour); };
  var when = function (at, pattern) { return f.localTime(at, settings().timeZone, pattern); };

  function tabs(active) {
    return h("nav", { class: "tablist", "aria-label": "Review period" }, TABS.map(function (t) {
      return h("a", { class: "tab text-body-md", href: t[0], "aria-current": t[2] === active ? "page" : null, text: t[1] });
    }));
  }
  var heading = function (title, description, actions, meta) {
    return h("header", { class: "page-header" }, h("div", null, h("div", { class: "rv-title-row" }, h("h1", { class: "text-headline-lg", tabindex: "-1", text: title }), meta),
      description && h("p", { class: "text-body-sm text-muted" }, description)), actions && h("div", { class: "rv-actions-row" }, actions));
  };
  var heatmap = function (cls) { return h("a", { class: "btn btn-" + cls + " btn-sm", href: "#/analytics" }, SJ.dom.icon("grid-3x3"), "Weekly heatmap"); };

  function list(kind) {
    var K = KIND[kind];
    SJ.router.watch(SJ.router.refresh);
    var current = K.current();
    // Like loadWeeklyReviews: the index makes sure the last ended period has its draft.
    SJ.actions.openPeriodReview(kind, K.shift(current, -1));
    var rows = K.list().slice().sort(function (a, b) { return K.start(a) < K.start(b) ? 1 : -1; });
    var description = (kind === "week" ? "Monday–Sunday weeks. This week's" : "Calendar months. This month's") + " draft is created on your first visit after " + when(startAt(K.shift(current, 1)), "EEEE d MMM, HH:mm") + ".";
    var last = h("a", { class: "btn btn-primary btn-sm", href: K.href(K.shift(current, -1)), text: kind === "week" ? "Last week" : "Last month" });
    var body = rows.length === 0 ? ui.emptyState({ icon: "clipboard-check", title: "No " + K.noun + "ly reviews yet", body: "Your first draft appears once a " + K.noun + " has ended." }) :
      A(ui.card({ labelledby: "past-" + kind, padding: "lg", className: "rv-list-card" }, [
        h("h2", { id: "past-" + kind, class: "text-headline-md rv-list-title", text: kind === "week" ? "Past weeks" : "Past months" }),
        h("ul", { class: "rv-list" }, rows.map(function (r) {
          var t = r.stats.totals;
          return h("li", null, h("a", { class: "rv-list-row", href: K.href(K.start(r)) },
            h("span", { class: "rv-list-name text-body-md text-fg", text: K.title(K.start(r)) }), ui.badge(isDraft(r) ? "Draft" : "Written", isDraft(r) ? "warning" : null),
            h("span", { class: "font-mono text-data-xs text-muted", text: t.trades + (t.trades === 1 ? " trade" : " trades") + " · win " + (t.winRate === null ? "—" : f.rate(t.winRate, 0) + "%") }),
            ui.pnlValue({ value: f.sol(BigInt(t.netPnl), { signed: true }), sign: t.trades > 0 ? f.signOf(BigInt(t.netPnl)) : null, className: "rv-list-pnl text-data-md" }),
            SJ.dom.icon("chevron-right", "text-muted")));
        })),
        h("p", { class: "text-body-sm text-muted rv-list-foot", text: "Older " + K.noun + "s: open any review and use the arrows to step back; a draft is created when you open it." }),
      ]), "rv-list");
    return h("div", { class: "page" }, heading("Reviews", description, kind === "week" ? [last, heatmap("secondary")] : [last]), tabs(kind), body);
  }

  /** EUR of the period, computed live and shown only while the frozen SOL totals still match (loadWeekEur). */
  function periodEur(stats, from, to) {
    var wallet = SJ.store.activeWallet().id;
    var trades = SJ.store.trades({ walletId: wallet, from: from, to: to });
    var input = SJ.store.periodInput(wallet, from, to);
    var t = stats.totals;
    var same = M.summarize(trades).netPnl.toString() === t.netPnl && f.sum(trades, function (x) { return x.feesTotal; }).toString() === t.fees &&
      input.rebates.toString() === t.rebates && input.reclaimFees.toString() === (t.reclaimFees || "0");
    return same ? SJ.analytics.rangeEur(wallet, trades, from, [], to) : null;
  }

  function form(kind, start, row) {
    var state = SJ.reflection.stateOf(kind + ":" + start);
    var d = state.draft || (state.draft = { keyLessons: row.keyLessons || "", patternsNoticed: row.patternsNoticed || "", notes: row.notes || "" });
    var field = function (key, label, rows) {
      return ui.textarea({ label: label, rows: rows, value: d[key], attrs: { maxlength: "5000", "data-refocus": "rv-" + key }, oninput: function (e) { d[key] = e.target.value; } });
    };
    var status = h("p", { class: "text-body-sm text-muted", role: "status", hidden: !state.flash, text: state.flash || "" });
    state.flash = null;
    var el = h("form", { class: "rv-text-form", "aria-label": KIND[kind].Noun + " review", novalidate: true },
      h("div", { class: "day-form-head" }, h("h2", { class: "text-headline-md", text: "Your review" }),
        !isDraft(row) && h("span", { class: "font-mono text-data-xs text-muted", text: "Saved " + when(row.updatedAt) })),
      field("keyLessons", "Key lessons", 4), field("patternsNoticed", "Patterns noticed", 4), field("notes", "Notes", 6),
      h("div", { class: "rv-actions" }, status, ui.button({ label: "Save review", variant: "primary", attrs: { type: "submit", "data-refocus": "rv-save" } })));
    el.addEventListener("submit", function (e) {
      e.preventDefault();
      delete state.draft;
      state.flash = KIND[kind].Noun + " review saved.";
      SJ.actions.savePeriodText(kind, start, { keyLessons: d.keyLessons.trim() || null, patternsNoticed: d.patternsNoticed.trim() || null, notes: d.notes.trim() || null });
    });
    return A(ui.card({ label: KIND[kind].Noun + " review", padding: "lg" }, el), "rv-text");
  }

  /** Recalculate stats (simulated round trip): replaces the snapshot; the saved text and any unsaved draft stay. */
  function recalculate(kind, start) {
    var state = SJ.reflection.stateOf(kind + ":" + start);
    var busy = !!state.recalculating;
    var holder = h("span", { class: "rv-recalc" },
      state.recalcFlash && h("span", { role: "status", class: "text-body-sm text-muted", text: state.recalcFlash }),
      ui.button({ label: busy ? "Recalculating…" : "Recalculate stats", size: "sm", icon: "refresh-cw", disabled: busy, attrs: { "data-refocus": "rv-recalc" }, onclick: function () {
        state.recalculating = true;
        state.recalcFlash = null;
        SJ.router.refresh();
        SJ.sim.run({ action: "Recalculate", toast: false, ms: 900, live: LIVE_RECALC, steps: ["Reading positions", "Freezing the snapshot"] }).then(function (r) {
          state.recalculating = false;
          if (r.cancelled) return;
          state.recalcFlash = "Stats updated.";
          SJ.actions.recalculate(kind, start);
        });
      } }));
    if (busy) holder.querySelector(".icon").classList.add("spin");
    return A(holder, "rv-recalc");
  }

  function detail(kind, start) {
    var K = KIND[kind];
    SJ.router.watch(SJ.router.refresh);
    var current = K.current();
    var next = K.shift(start, 1);
    var arrow = function (target, label, icon, off) {
      return off ? h("span", { class: "btn btn-secondary btn-sm btn-square is-disabled", "aria-disabled": "true", "aria-label": label }, SJ.dom.icon(icon))
        : h("a", { class: "btn btn-secondary btn-sm btn-square", href: K.href(target), "aria-label": label, "data-refocus": "rv-" + icon }, SJ.dom.icon(icon));
    };
    var nav = h("nav", { class: "cal-nav", "aria-label": kind === "week" ? "Week" : "Month" },
      arrow(K.shift(start, -1), "Previous " + K.noun, "chevron-left"), arrow(next, "Next " + K.noun, "chevron-right", next >= current), kind === "week" && heatmap("ghost"));
    var title = K.title(start);
    if (start >= current) {
      return h("div", { class: "page" }, heading(title, null, nav), ui.emptyState({ icon: "calendar-clock", title: "This " + K.noun + " is not over yet",
        body: "The draft review is created on your first visit after " + when(startAt(next), "EEEE d MMM, HH:mm") + ".",
        action: h("a", { class: "btn btn-primary", href: TABS[kind === "week" ? 0 : 1][0], text: "All " + K.noun + "ly reviews" }) }));
    }
    var row = SJ.actions.openPeriodReview(kind, start);
    var stats = row.stats;
    var draft = isDraft(row);
    var C = SJ.critiques;
    var coach = SJ.critiquePanel.render({
      id: "period-coach", ref: { kind: kind, periodStart: start }, state: C.periodState(kind, start), row: C.periodRow(kind, start), live: LIVE_COACH, anchor: "rv-coach",
      text: { start: "Generate", running: "Reviewing the " + K.noun + "…", stale: "The stats, your review or the day critiques changed since this critique.", prompt: "period prompt" },
    });
    var description = (kind === "month" ? monthRange(start) + " · " : "") + "Stats frozen " + when(row.statsAt || row.createdAt) + " · trades belong to the " + K.noun + " of their entry";
    var left = kind === "week" ? [R.trades(stats), R.patterns(stats), R.recurring(stats), R.lessons(stats, "week")]
      : [R.comparison(stats), R.trades(stats), R.patterns(stats), R.lessons(stats, "month")];
    return h("div", { class: "page" },
      heading(title, A(h("span", null, description), "rv-frozen"), [nav, recalculate(kind, start)], ui.badge(draft ? "Draft" : "Written", draft ? "warning" : null)),
      R.totals({ stats: stats, eur: periodEur(stats, startAt(start), startAt(next)), period: kind }),
      h("div", { class: "rv-layout" }, h("div", { class: "rv-col" }, left),
        h("div", { class: "rv-col" }, form(kind, start, row), coach && ui.card({ label: "Coach", padding: "lg" }, coach))));
  }

  var notFound = function (path) { return SJ.router.notFound(path); };
  var MONDAY = function (s) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s && M.weekdayOf(s) === 1; };

  SJ.screens = SJ.screens || {};
  SJ.screens.reviews = { render: function () { return list("week"); } };
  SJ.screens["reviews-monthly"] = { render: function () { return list("month"); } };
  SJ.screens["review-week"] = { render: function (p) { return MONDAY(p.week) ? detail("week", p.week) : notFound("reviews/" + p.week); } };
  SJ.screens["review-month"] = { render: function (p) {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(p.month) ? detail("month", p.month + "-01") : notFound("reviews/monthly/" + p.month);
  } };
  SJ.reviews = { weekTitle: weekTitle, isDraft: isDraft, periodEur: periodEur };
})();
