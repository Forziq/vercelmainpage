// The quick review (components/reflection/QuickReview.tsx), used by the Inbox and on trade detail: grade (the only
// required field), strategy, mistake and strength chips, the rules checklist with auto-check suggestions, emotion,
// confidence, terminal, takeaway and notes, plus the full reflection on trade detail. The draft lives in
// SJ.reflection.stateOf(key), so a page redraw (any store change) keeps what was typed.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var R = SJ.reflection;
  var S = SJ.store;
  var CONFIDENCE = ["1", "2", "3", "4", "5"].map(function (v) { return { value: v, label: v }; });
  var TERMINALS = [{ value: "axiom", label: "Axiom" }, { value: "padre", label: "Padre" }, { value: "other", label: "Other" }];
  var active = null;

  var toggle = function (ids, id) { return ids.indexOf(id) >= 0 ? ids.filter(function (x) { return x !== id; }) : ids.concat(id); };

  function draftOf(t) {
    var r = t.reflection;
    var results = r ? r.ruleResults : [];
    return {
      grade: r ? r.grade : null, strategyId: r ? r.strategyId : null, tagIds: r ? r.tagIds.slice() : [],
      brokenRuleIds: results.filter(function (x) { return !x.followed; }).map(function (x) { return x.ruleId; }),
      confirmedRuleIds: results.filter(function (x) { return !x.followed && x.source === "auto_confirmed"; }).map(function (x) { return x.ruleId; }),
      dismissed: [], emotionId: r ? r.emotionId : null, confidence: r ? r.confidence : null, terminal: r ? r.terminal : null,
      lesson: (r && r.lesson) || "", notes: (r && r.notes) || "", full: SJ.fullReflection.toDraft(r && r.full),
    };
  }

  function group(label, hint, children) {
    return h("div", { class: "rv-group" },
      h("div", { class: "rv-group-head" }, h("span", { class: "text-label-sm text-muted uppercase", text: label }),
        typeof hint === "string" ? h("span", { class: "font-mono text-data-xs text-muted", text: hint }) : hint),
      children);
  }

  /** Inline "+ New": an input with Add / Cancel. `create(name)` returns an error message or null. */
  function addOption(label, noun, create) {
    var wrap = h("span", { class: "rv-add" });
    function closed() {
      SJ.dom.clear(wrap).appendChild(h("button", { type: "button", class: "chip chip-add", onclick: opened }, SJ.dom.icon("plus"), label, h("span", { class: "sr-only", text: " " + noun })));
    }
    function opened() {
      var error = h("p", { class: "text-body-sm field-error", role: "alert", hidden: true });
      var field = h("input", { class: "input rv-add-input", maxlength: "60", placeholder: "Name", "aria-label": "New " + noun + " name" });
      var submit = function () {
        if (!field.value.trim()) return;
        var err = create(field.value);
        if (err) { error.textContent = err; error.hidden = false; }
      };
      field.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); submit(); }
        if (e.key === "Escape") { e.stopPropagation(); closed(); }
      });
      SJ.dom.clear(wrap).append(field, ui.button({ label: "Add", size: "sm", variant: "primary", onclick: submit }), ui.button({ label: "Cancel", size: "sm", variant: "ghost", onclick: closed }), error);
      field.focus();
    }
    closed();
    return wrap;
  }

  /** o: { trade, submitLabel, enterSaves, extra (node), full (bool), onSaved } */
  function render(o) {
    var t = o.trade;
    var state = R.stateOf(t.key);
    var d = state.draft || (state.draft = draftOf(t));
    var reviewed = !!(t.reflection && t.reflection.reviewedAt);
    var redraw = function () { SJ.router.refresh(); };

    /** Adds a vocabulary item (or picks the existing one with that name) and selects it in the draft. */
    function create(kind, fields, select) {
      var name = fields.name.trim();
      var existing = S.vocab(kind, { includeArchived: true }).filter(function (v) { return v.name.toLowerCase() === name.toLowerCase() && (!fields.polarity || v.polarity === fields.polarity); })[0];
      if (!existing && kind === "tags" && S.vocab("tags").some(function (v) { return v.name.toLowerCase() === name.toLowerCase(); })) return "That tag exists as the other kind.";
      try {
        var item = existing || SJ.actions.saveVocab(kind, fields);
        if (existing && existing.archived) SJ.actions.saveVocab(kind, { name: existing.name, archived: false }, existing.id);
        select(item.id);
        redraw();
        return null;
      } catch (e) { return e.message; }
    }

    var grade = ui.gradePicker({ value: d.grade, onChange: function (g) { d.grade = g; submitButton.disabled = false; } });

    var strategies = h("div", { class: "chip-row" });
    function paintStrategies() {
      SJ.dom.clear(strategies);
      S.vocab("strategies").forEach(function (s) {
        strategies.appendChild(ui.chip({ label: s.name, selected: d.strategyId === s.id, onToggle: function () { d.strategyId = d.strategyId === s.id ? null : s.id; paintStrategies(); } }));
      });
      strategies.appendChild(addOption("New", "strategy", function (name) { return create("strategies", { name: name }, function (id) { d.strategyId = id; }); }));
    }
    paintStrategies();

    var tagRow = function (polarity, kind, noun) {
      return h("div", { class: "chip-row" }, S.vocab("tags").filter(function (v) { return v.polarity === polarity; }).map(function (v) {
        return ui.chip({ label: v.name, kind: kind, selected: d.tagIds.indexOf(v.id) >= 0, onToggle: function () { d.tagIds = toggle(d.tagIds, v.id); } });
      }), addOption("New", noun, function (name) {
        return create("tags", { name: name, polarity: polarity }, function (id) { if (d.tagIds.indexOf(id) < 0) d.tagIds = d.tagIds.concat(id); });
      }));
    };

    var rules = h("div", { class: "rv-rules" });
    var rulesHint = h("span", { class: "font-mono text-data-xs text-muted" });
    var reasons = {};
    R.suggestions(t).forEach(function (s) { reasons[s.ruleId] = s.reason; });
    function paintRules() {
      var list = S.vocab("rules");
      var broken = list.filter(function (r) { return d.brokenRuleIds.indexOf(r.id) >= 0; }).length;
      rulesHint.textContent = list.length ? list.length - broken + " / " + list.length + " followed" : "";
      SJ.dom.clear(rules);
      list.forEach(function (r) {
        var isBroken = d.brokenRuleIds.indexOf(r.id) >= 0;
        var confirmed = isBroken && d.confirmedRuleIds.indexOf(r.id) >= 0;
        rules.appendChild(h("div", { class: "rv-rule" },
          ui.checkRow({ label: r.name, checked: !isBroken, alert: true, meta: isBroken ? (confirmed ? "Broken · auto-check" : "Broken") : null, onChange: function () {
            d.brokenRuleIds = toggle(d.brokenRuleIds, r.id);
            d.confirmedRuleIds = d.confirmedRuleIds.filter(function (x) { return x !== r.id; });
            paintRules();
            rules.querySelector('[data-rule="' + r.id + '"] .check-row').focus();
          } }),
          reasons[r.id] && !isBroken && d.dismissed.indexOf(r.id) < 0 && h("div", { role: "note", class: "rv-suggestion text-body-sm" }, SJ.dom.icon("alert-triangle"),
            h("span", { text: "Likely broken: " + reasons[r.id] }),
            ui.button({ label: "Mark broken", size: "sm", onclick: function () { d.brokenRuleIds = d.brokenRuleIds.concat(r.id); d.confirmedRuleIds = d.confirmedRuleIds.concat(r.id); paintRules(); } }),
            ui.button({ label: "Dismiss", size: "sm", variant: "ghost", onclick: function () { d.dismissed = d.dismissed.concat(r.id); paintRules(); } }))));
        rules.lastChild.setAttribute("data-rule", r.id);
      });
      rules.appendChild(h("div", null, addOption("New rule", "rule", function (name) {
        return create("rules", { name: name, type: "MANUAL", threshold: null, thresholdUnit: null }, function (id) { d.brokenRuleIds = d.brokenRuleIds.concat(id); });
      })));
    }
    paintRules();

    /** A segmented control where choosing the selected option again clears it. */
    function clearable(label, options, get, set) {
      var holder = h("div");
      var paint = function () {
        SJ.dom.clear(holder).appendChild(ui.segmented({ label: label, options: options, value: get() === null ? null : String(get()), className: "segmented-full", onChange: function (v) {
          if (String(get()) === v) { set(null); paint(); holder.querySelector('[role="radio"]').focus(); } else set(v);
        } }));
      };
      paint();
      return holder;
    }

    var status = h("p", { class: "text-body-sm", hidden: true });
    function say(ok, message) {
      status.hidden = false;
      status.textContent = message;
      status.className = "text-body-sm " + (ok ? "text-muted" : "text-loss");
      status.setAttribute("role", ok ? "status" : "alert");
    }
    var flash = state.flash;
    state.flash = null;
    if (flash) say(true, flash);

    function submit(e) {
      if (e) e.preventDefault();
      if (!d.grade) return say(false, "Pick an execution grade (keys 1–5).");
      var input = {
        grade: d.grade, strategyId: d.strategyId, tagIds: d.tagIds, brokenRuleIds: d.brokenRuleIds,
        autoConfirmedRuleIds: d.confirmedRuleIds.filter(function (id) { return d.brokenRuleIds.indexOf(id) >= 0; }),
        emotionId: d.emotionId, confidence: d.confidence, terminal: d.terminal, lesson: d.lesson.trim() || null, notes: d.notes.trim() || null,
      };
      if (o.full) input.full = SJ.fullReflection.fromDraft(d.full);
      // The save redraws the page at once, so the draft is cleared and the message set before it.
      delete state.draft;
      state.flash = "Saved.";
      try {
        SJ.actions.saveQuickReview(t.key, input);
      } catch (err) {
        state.draft = d;
        state.flash = null;
        return say(false, err.message);
      }
      if (o.onSaved) o.onSaved();
    }

    var submitButton = ui.button({ label: o.submitLabel || (reviewed ? "Update review" : "Save review"), variant: "primary", kbd: o.enterSaves ? "Enter" : null, disabled: !d.grade, attrs: { type: "submit", "data-refocus": "review-save" } });
    var form = h("form", { class: "rv-form", novalidate: true },
      group("Execution grade", "Required · keys 1–5", grade),
      group("Strategy", null, strategies),
      group("Mistakes", null, tagRow("mistake", "mistake", "mistake")),
      group("Strengths", null, tagRow("positive", "strength", "strength")),
      group("Rules checklist", rulesHint, rules),
      h("div", { class: "rv-grid" },
        ui.select({ label: "Emotional state", placeholder: "—", value: d.emotionId || "", options: S.vocab("emotions").map(function (v) { return { value: v.id, label: v.name }; }), onchange: function (e) { d.emotionId = e.target.value || null; } }),
        group("Confidence (1–5)", null, clearable("Confidence", CONFIDENCE, function () { return d.confidence; }, function (v) { d.confidence = v === null ? null : Number(v); })),
        group("Terminal", null, clearable("Terminal", TERMINALS, function () { return d.terminal; }, function (v) { d.terminal = v; }))),
      ui.input({ label: "Key takeaway", value: d.lesson, placeholder: "One line", attrs: { maxlength: "300" }, oninput: function (e) { d.lesson = e.target.value; } }),
      ui.textarea({ label: "Notes", value: d.notes, rows: 3, attrs: { maxlength: "5000" }, oninput: function (e) { d.notes = e.target.value; } }),
      o.full && SJ.fullReflection.render(t, d.full, state),
      h("div", { class: "rv-actions" }, status, h("div", { class: "rv-buttons" }, o.extra, submitButton)));
    form.addEventListener("submit", submit);

    active = { form: form, enterSaves: !!o.enterSaves, setGrade: function (g) { d.grade = g; grade.setValue(g); submitButton.disabled = false; }, submit: submit };
    return ui.card({ labelledby: "review-" + t.key, padding: "lg", className: "rv-card" }, [
      ui.cardHeader({ id: "review-" + t.key, title: "Quick review", meta: reviewed ? "Editing saved review" : null }), form]);
  }

  // One listener for the form on screen: 1–5 set the grade; Enter saves where the form allows it (the Inbox).
  document.addEventListener("keydown", function (e) {
    if (!active || !active.form.isConnected) return;
    var action = R.keyAction(e);
    if (!action) return;
    if (action.type === "grade") active.setGrade(action.grade);
    else if (action.type === "save" && active.enterSaves && !e.repeat) {
      e.preventDefault();
      active.submit();
    }
  });

  SJ.reviewForm = { render: render, draftOf: draftOf };
})();
