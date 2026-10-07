// The day and period Coach panel (components/reflection/CritiquePanel.tsx, docs/ai-coach.md §8–§9): open unless no
// critique exists yet; states not run → pending → ready, out of date (Regenerate) and failed (Retry), driven by
// SJ.critiques.run. Output is the pre-written "Sample output". It never changes a review.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var BADGE = { none: ["Not run"], pending: ["Generating", "accent"], done: ["Ready"], stale: ["Out of date", "warning"], failed: ["Failed", "loss"] };

  function items(title, list) {
    if (!list.length) return null;
    return h("section", { class: "coach-section" }, h("h4", { class: "text-label-sm text-muted uppercase", text: title }),
      h("ul", { class: "coach-items" }, list.map(function (x) {
        return h("li", null, h("p", { class: "text-body-md text-fg", text: x.title }), h("p", { class: "text-body-sm text-muted", text: x.evidence }),
          h("p", { class: "coach-fields font-mono text-data-xs text-muted", text: x.fields.join(" · ") }));
      })));
  }
  function bullets(title, list) {
    if (!list.length) return null;
    return h("section", { class: "coach-section" }, h("h4", { class: "text-label-sm text-muted uppercase", text: title }),
      h("ul", { class: "coach-bullets text-body-md text-fg" }, list.map(function (q) { return h("li", { text: q }); })));
  }

  /**
   * o: { id (unique on the page), ref ({ day } | { kind, periodStart }), state, row, live, anchor,
   *      text: { start, running, stale, prompt } }. Returns null when the Coach is hidden.
   */
  function render(o) {
    if (o.state === "hidden") return null;
    var ui_ = SJ.reflection.stateOf("critique:" + o.id);
    var open = ui_.open === undefined ? o.state !== "none" : ui_.open;
    var state = o.state;
    var row = o.row;
    var action = state === "stale" ? ["Regenerate", "rotate-ccw"] : state === "failed" ? ["Retry", "rotate-ccw"] : state === "none" ? [o.text.start, "sparkles"] : null;
    var out = row && row.output;
    var tz = SJ.store.settings().timeZone;
    var body = open && h("div", { id: o.id + "-body", class: "coach-body" },
      state === "pending" && h("p", { role: "status", class: "coach-pending text-body-sm text-muted" }, SJ.dom.icon("loader-circle", "spin"), o.text.running),
      state === "failed" && h("p", { role: "alert", class: "coach-error text-body-sm", text: row.error }),
      state === "none" && h("p", { class: "text-body-sm text-muted", text: "No critique yet. It runs only when you start it." }),
      state === "stale" && h("p", { class: "text-body-sm text-warning", text: o.text.stale }),
      action && h("div", null, ui.button({ label: action[0], icon: action[1], attrs: { "data-refocus": o.id + "-run" }, onclick: function () {
        ui_.open = true;
        SJ.critiques.run(o.ref, o.live);
      } })),
      out && (state === "done" || state === "stale") && h("div", { class: "coach-output" },
        row.sample && h("div", null, ui.badge("Sample output", "accent")),
        h("p", { class: "text-body-md text-fg", text: out.summary }),
        items("Patterns", out.patterns.map(function (p) { return Object.assign({ title: p.pattern }, p); })),
        items("Contradictions", out.contradictions.map(function (c) { return Object.assign({ title: c.claim }, c); })),
        items("Rule flags", out.rule_flags.map(function (r) { return Object.assign({ title: r.rule }, r); })),
        bullets("Questions for you", out.questions_for_you), bullets("Data gaps", out.data_gaps)),
      row && row.status === "done" && row.finishedAt && h("p", { class: "coach-meta font-mono text-data-xs text-muted",
        text: row.model + " · " + o.text.prompt + " v" + row.promptVersion + " · " + SJ.format.localTime(row.finishedAt, tz, "MMM d, HH:mm") + (row.costUsd ? " · $" + String(Number(Number(row.costUsd).toFixed(4))) : "") }),
      SJ.sim.liveNote(o.live),
      h("p", { class: "text-body-sm text-muted", text: "Suggestions only. The coach never changes your reviews." }));

    var toggle = h("button", { type: "button", class: "coach-toggle", "aria-expanded": String(!!open), "aria-controls": o.id + "-body", "data-refocus": o.id + "-toggle", onclick: function () {
      ui_.open = !open;
      SJ.router.refresh();
    } }, SJ.dom.icon("chevron-right", SJ.dom.cx("coach-chevron", open && "is-open")), h("h3", { id: o.id + "-title", class: "text-title-sm text-fg", text: "Coach" }));
    var badge = BADGE[state];
    return SJ.explain.anchor(h("section", { class: "critique", "aria-labelledby": o.id + "-title" },
      h("header", { class: "coach-head" }, toggle, ui.badge(badge[0], badge[1])), body), o.anchor);
  }

  SJ.critiquePanel = { render: render };
})();
