// One trading day in the calendar's day panel (app/(app)/calendar/day-detail.tsx): stats, the neutral limits line, the
// day's trades, the day Coach and the daily review form (reflection-analytics.md §9). The form's draft lives in
// SJ.reflection.stateOf("day:<day>"), so a redraw keeps what was typed.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var f = SJ.format;
  var A = SJ.explain.anchor;
  var PLAN = [{ value: "yes", label: "Yes" }, { value: "partly", label: "Partly" }, { value: "no", label: "No" }];
  var DISCIPLINE = ["1", "2", "3", "4", "5"].map(function (v) { return { value: v, label: v }; });
  var TEXT = ["wentWell", "biggestMistake", "repeat", "avoid", "journal"];
  var LIVE_COACH = "the day's numbers, your trade reviews and your daily review (never the wallet, token names or addresses) go to an AI model; the answer must match a strict schema and cite its input fields.";

  /** "7 trades · limit 5 · over" and "Net P&L … · loss limit … · within": factual, never advice. */
  function limitLines(l) {
    var verdict = function (within) { return within ? "within" : "over"; };
    var lines = [];
    if (l.trades) lines.push(l.trades.value + " " + (l.trades.value === 1 ? "trade" : "trades") + " · limit " + l.trades.limit + " · " + verdict(l.trades.within));
    if (l.loss) lines.push("Net P&L " + f.sol(l.loss.value, { signed: true }) + " SOL · loss limit " + f.sol(l.loss.limit) + " SOL · " + verdict(l.loss.within));
    return lines;
  }

  function stats(sel) {
    var s = sel.stats;
    var eurTone = function (units) { return ui.toneOf(SJ.fiat.sign(units)); };
    return A(h("div", { class: "day-stats" },
      ui.statCard({ label: "Net P&L", value: s ? f.sol(s.netPnl, { signed: true }) : f.DASH, unit: s ? "SOL" : null, tone: s ? ui.toneOf(f.signOf(s.netPnl)) : "default",
        sub: s && ui.fiatSub(SJ.fiat.label(sel.eur.netPnl, true), eurTone(sel.eur.netPnl)) }),
      ui.statCard({ label: "Fees", value: s ? f.sol(s.fees, { decimals: 6 }) : f.DASH, unit: s ? "SOL" : null, sub: s && ui.fiatSub(SJ.fiat.label(sel.eur.fees)) }),
      ui.statCard({ label: "Trades", value: String(s ? s.entered : 0), delta: s && s.decided > 0 ? s.wins + "W · " + s.losses + "L · " + (s.decided - s.wins - s.losses) + "BE" : null }),
      ui.statCard({ label: "Avg execution", value: s && s.avgScore !== null ? s.avgScore.toFixed(1) : f.DASH, unit: s && s.avgScore !== null ? "/ 4" : null })), "cal-day-stats");
  }

  function trades(sel, tz) {
    return h("section", { class: "day-section", "aria-label": "Trades this day" },
      h("h3", { class: "text-label-sm text-muted uppercase", text: "Trades (" + sel.trades.length + ")" }),
      sel.trades.length === 0 ? h("p", { class: "text-body-sm text-muted", text: "No trades entered this day." }) :
        h("ul", { class: "day-trades" }, sel.trades.map(function (t) {
          var eur = t.status === "open" ? null : SJ.fiat.pnlOf(t);
          return h("li", null, h("a", { class: "day-trade", href: SJ.tradeList.tradeHref(t.key) },
            ui.tokenAvatar({ symbol: t.symbol, outcome: t.outcome }),
            h("span", { class: "day-trade-text" }, h("span", { class: "text-body-md text-fg", text: t.label }),
              h("span", { class: "font-mono text-data-xs text-muted", text: f.localTime(t.openedAt, tz, "HH:mm") })),
            h("span", { class: "day-trade-side" },
              ui.pnlValue({ value: f.sol(t.netPnl, { signed: true }), sign: t.status === "open" ? null : f.signOf(t.netPnl), neutral: t.outcome === "breakeven", className: "text-data-xs" }),
              ui.fiatSub(SJ.fiat.label(eur, true), t.outcome === "breakeven" ? "neutral" : ui.toneOf(SJ.fiat.sign(eur))),
              h("span", { class: "trade-card-badges" }, ui.outcomeBadge(t.outcome), ui.gradeBadge(t.reflection && t.reflection.grade)))));
        })));
  }

  function draftOf(review) {
    var d = { followedPlan: null, executionGrade: null, discipline: null };
    TEXT.forEach(function (k) { d[k] = ""; });
    if (review) Object.keys(d).forEach(function (k) { if (review[k] !== null && review[k] !== undefined) d[k] = review[k]; });
    return d;
  }

  /** A control where choosing the selected option again clears it (`make(value, onChange)` builds it). */
  function clearable(make, get, set) {
    var holder = h("div");
    var paint = function () {
      SJ.dom.clear(holder).appendChild(make(get(), function (v) {
        if (get() === v) { set(null); paint(); var first = holder.querySelector("button"); if (first) first.focus(); } else set(v);
      }));
    };
    paint();
    return holder;
  }
  var group = function (label, control) { return h("div", { role: "group", "aria-label": label, class: "rv-group" }, h("span", { class: "text-label-sm text-muted uppercase", text: label }), control); };

  function reviewForm(sel, tz) {
    var state = SJ.reflection.stateOf("day:" + sel.day);
    var d = state.draft || (state.draft = draftOf(sel.review));
    var text = function (key, label, rows) {
      return ui.textarea({ label: label, rows: rows || 2, value: d[key], attrs: { maxlength: "2000", "data-refocus": "day-" + key }, oninput: function (e) { d[key] = e.target.value; } });
    };
    var status = h("p", { class: "text-body-sm text-muted", role: "status", hidden: !state.flash, text: state.flash || "" });
    state.flash = null;
    var form = h("form", { class: "day-form", "aria-label": "Daily review", novalidate: true },
      h("div", { class: "day-form-head" }, h("h3", { class: "text-title-sm text-fg", text: "Daily review" }),
        sel.review && h("span", { class: "font-mono text-data-xs text-muted", text: "Saved " + f.localTime(sel.review.updatedAt, tz, "MMM d, HH:mm") })),
      group("Did I follow my plan?", clearable(function (v, on) { return ui.segmented({ label: "Did I follow my plan?", options: PLAN, value: v, onChange: on }); },
        function () { return d.followedPlan; }, function (v) { d.followedPlan = v; })),
      text("wentWell", "What went well"), text("biggestMistake", "Biggest mistake"), text("repeat", "What to repeat"), text("avoid", "What to avoid tomorrow"),
      group("Overall execution grade", clearable(function (v, on) { return ui.gradePicker({ label: "Overall execution grade", value: v, onChange: on }); },
        function () { return d.executionGrade; }, function (v) { d.executionGrade = v; })),
      group("Discipline (1–5)", clearable(function (v, on) { return ui.segmented({ label: "Discipline (1–5)", options: DISCIPLINE, value: v === null ? null : String(v), onChange: on }); },
        function () { return d.discipline === null ? null : String(d.discipline); }, function (v) { d.discipline = v === null ? null : Number(v); })),
      text("journal", "Journal", 5),
      h("div", { class: "rv-actions" }, status, ui.button({ label: "Save review", variant: "primary", attrs: { type: "submit", "data-refocus": "day-save" } })));
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var fields = { followedPlan: d.followedPlan, executionGrade: d.executionGrade, discipline: d.discipline };
      TEXT.forEach(function (k) { fields[k] = d[k].trim() || null; });
      // The save redraws the panel at once, so the draft is dropped and the message set before it.
      delete state.draft;
      state.flash = "Daily review saved.";
      SJ.actions.saveDailyReview(sel.day, fields);
    });
    return A(form, "cal-review");
  }

  function render(sel) {
    var tz = SJ.store.settings().timeZone;
    var C = SJ.critiques;
    var coach = SJ.critiquePanel.render({
      id: "day-coach", ref: { day: sel.day }, state: C.dayState(sel.day), row: C.dayRow(sel.day), live: LIVE_COACH, anchor: "cal-coach",
      text: { start: "Review this day", running: "Reviewing the day…", stale: "The trades or your reviews changed since this critique.", prompt: "day prompt" },
    });
    return h("div", { class: "day-detail" },
      stats(sel),
      sel.limits && A(h("section", { class: "day-section", "aria-label": "Your limits" }, h("h3", { class: "text-label-sm text-muted uppercase", text: "Your limits" }),
        limitLines(sel.limits).map(function (line) { return h("p", { class: "text-body-sm text-muted", text: line }); })), "cal-limits"),
      trades(sel, tz),
      coach && h("div", { class: "day-divided" }, coach),
      h("div", { class: "day-divided" }, reviewForm(sel, tz)));
  }

  SJ.dayDetail = { render: render, limitLines: limitLines, LIVE_COACH: LIVE_COACH };
})();
