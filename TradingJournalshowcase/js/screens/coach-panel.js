// The trade Coach panel (components/reflection/CoachPanel.tsx, docs/ai-coach.md §7): collapsed by default, shown
// once the quick review is saved. States not run → pending → ready, out of date (Regenerate) and failed (Retry) are
// driven by SJ.sim; the first Generate of a demo session fails on purpose so Retry can be tried. Output is the
// pre-written "Sample output"; a confirmed tag is saved to the review like any other tag.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var S = SJ.store;
  var C = SJ.coach;
  var BADGE = { none: ["Not run"], pending: ["Generating", "accent"], done: ["Ready"], stale: ["Out of date", "warning"], failed: ["Failed", "loss"] };
  var LIVE = "the position's numbers and your review (never the wallet, token name or address) go to an AI model; the answer must match a strict schema, and tags or rules that are not in your own lists are dropped.";
  var failedFor = null;

  /** Generate, Regenerate and Retry: a pending row at once, then the sample critique or the sample failure. */
  function run(key, first) {
    var fail = first && failedFor !== S.data();
    if (fail) failedFor = S.data();
    SJ.actions.saveCoachRow(key, { status: "pending" });
    return SJ.sim.run({
      action: "Coach", toast: false, ms: 1800, fail: fail, live: LIVE, steps: ["Building the input", "Waiting for the model", "Checking the answer"],
      error: "The model did not answer within 45 seconds (a sample failure, so you can try Retry). Your review is unchanged.",
    }).then(function (r) {
      var t = S.trade(key);
      if (r.cancelled || !t) return r;
      var at = S.now().toISOString();
      if (!r.ok) SJ.actions.saveCoachRow(key, { status: "failed", error: r.error, finishedAt: at });
      else {
        var vocab = { tags: S.data().vocab.tags, rules: S.data().vocab.rules };
        SJ.actions.saveCoachRow(key, {
          status: "done", finishedAt: at, model: C.MODEL, promptVersion: C.PROMPT_VERSION, costUsd: "0.000500", sample: true,
          output: C.tradeOutput(t, S.contexts(t.walletId)[key], vocab), fingerprint: C.fingerprint(S.data(), key),
        });
      }
      return r;
    });
  }

  function evidence(item) {
    return [h("p", { class: "text-body-sm text-muted", text: item.evidence }), h("p", { class: "coach-fields font-mono text-data-xs text-muted", text: item.fields.join(" · ") })];
  }
  function section(title, items) {
    if (!items.length) return null;
    return h("section", { class: "coach-section" }, h("h3", { class: "text-label-sm text-muted uppercase", text: title }),
      h("ul", { class: "coach-items" }, items.map(function (x) { return h("li", null, h("p", { class: "text-body-md text-fg", text: x.title }), evidence(x)); })));
  }
  function list(title, items) {
    if (!items.length) return null;
    return h("section", { class: "coach-section" }, h("h3", { class: "text-label-sm text-muted uppercase", text: title }),
      h("ul", { class: "coach-bullets text-body-md text-fg" }, items.map(function (q) { return h("li", { text: q }); })));
  }

  function suggestedTags(t, row, state) {
    var applied = (t.reflection ? t.reflection.tagIds : []).map(function (id) { return (S.names("tags")[id] || "").toLowerCase(); });
    var dismissed = (state.coachDismissed || {})[row.finishedAt] || [];
    var out = row.output;
    var tags = out.suggested_mistake_tags.map(function (x) { return Object.assign({ polarity: "mistake" }, x); })
      .concat(out.suggested_positive_tags.map(function (x) { return Object.assign({ polarity: "positive" }, x); }))
      .filter(function (x) { return dismissed.indexOf(x.polarity + ":" + x.tag.toLowerCase()) < 0; });
    if (!tags.length) return null;
    return SJ.explain.anchor(h("section", { class: "coach-section" }, h("h3", { class: "text-label-sm text-muted uppercase", text: "Suggested tags" }),
      h("ul", { class: "coach-items" }, tags.map(function (x) {
        var kind = x.polarity === "mistake" ? "mistake" : "strength";
        var isApplied = applied.indexOf(x.tag.toLowerCase()) >= 0;
        var id = x.polarity + ":" + x.tag.toLowerCase();
        return h("li", null, h("div", { class: "coach-tag-row" },
          ui.tag({ label: x.tag, kind: isApplied ? kind : "plain" }),
          isApplied ? h("span", { class: "text-body-sm text-muted", text: "Applied" }) : [
            ui.button({ label: "Confirm", icon: "check", variant: "ghost", attrs: { "aria-label": "Add tag " + x.tag, "data-refocus": "coach-confirm-" + id }, onclick: function () {
              // Like the app's remount of the review form: the saved tags replace any unsaved edits.
              delete state.draft;
              try { SJ.actions.confirmCoachTag(t.key, x.tag, x.polarity); } catch (e) { SJ.overlay.toast({ title: "Coach", body: e.message, tone: "error" }); }
            } }),
            ui.button({ label: "Dismiss", icon: "x", variant: "ghost", attrs: { "aria-label": "Dismiss " + x.tag }, onclick: function () {
              var all = state.coachDismissed || (state.coachDismissed = {});
              all[row.finishedAt] = dismissed.concat(id);
              SJ.router.refresh();
            } }),
          ]), evidence(x));
      }))), "co-tags");
  }

  function render(t) {
    var view = C.state(t);
    if (view === "hidden") return null;
    var state = SJ.reflection.stateOf(t.key);
    var row = C.row(t.key);
    var badge = BADGE[view];
    var open = !!state.coachOpen;
    var tz = S.settings().timeZone;
    var action = view === "stale" ? ["Regenerate", "rotate-ccw"] : view === "failed" ? ["Retry", "rotate-ccw"] : view === "none" ? ["Generate", "sparkles"] : null;
    var body = open && h("div", { id: "coach-body", class: "coach-body" },
      view === "pending" && h("p", { role: "status", class: "coach-pending text-body-sm text-muted" }, SJ.dom.icon("loader-circle", "spin"), "Generating a critique of your review…"),
      view === "failed" && h("p", { role: "alert", class: "coach-error text-body-sm", text: row.error }),
      view === "none" && h("p", { class: "text-body-sm text-muted", text: "No critique yet for this review." }),
      view === "stale" && h("p", { class: "text-body-sm text-warning", text: "Your review or the trade changed since this critique was generated." }),
      action && h("div", null, ui.button({ label: action[0], icon: action[1], attrs: { "data-refocus": "coach-run" }, onclick: function () { run(t.key, view === "none"); } })),
      row && row.output && (view === "done" || view === "stale") && h("div", { class: "coach-output" },
        row.sample && h("div", null, ui.badge("Sample output", "accent")),
        h("p", { class: "text-body-md text-fg", text: row.output.summary }),
        section("Contradictions", row.output.contradictions.map(function (c) { return Object.assign({ title: c.claim }, c); })),
        suggestedTags(t, row, state),
        section("Rule flags", row.output.rule_flags.map(function (c) { return Object.assign({ title: c.rule }, c); })),
        list("Questions for you", row.output.questions_for_you), list("Data gaps", row.output.data_gaps)),
      row && row.finishedAt && row.model && h("p", { class: "coach-meta font-mono text-data-xs text-muted", text: row.model + " · prompt v" + row.promptVersion + " · " + SJ.format.localTime(row.finishedAt, tz, "MMM d, HH:mm") + (row.costUsd ? " · $" + row.costUsd : "") }),
      SJ.sim.liveNote(LIVE),
      h("p", { class: "text-body-sm text-muted", text: "Suggestions only. The coach never changes your review; a tag is added only when you confirm it." }));

    var toggle = h("button", { type: "button", class: "coach-toggle", "aria-expanded": String(open), "aria-controls": "coach-body", "data-refocus": "coach-toggle", onclick: function () {
      state.coachOpen = !open;
      SJ.router.refresh();
    } }, SJ.dom.icon("chevron-right", SJ.dom.cx("coach-chevron", open && "is-open")), h("h2", { id: "coach-title", class: "text-headline-md text-fg", text: "Coach" }));
    return SJ.explain.anchor(ui.card({ labelledby: "coach-title", padding: "lg", className: "coach-card" }, [
      h("header", { class: "coach-head" }, toggle, ui.badge(badge[0], badge[1])), body]), "co-panel");
  }

  SJ.coachPanel = { render: render, run: run, LIVE: LIVE };
})();
