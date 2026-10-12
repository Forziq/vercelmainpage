// The New / Edit dialog of Strategies, Mistakes and Rules (components/vocab/VocabEditor.tsx). An item used by a
// review can be archived but not deleted; an archived one can be restored. Writes go through SJ.actions.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var NOUN = { strategies: "strategy", tags: "tag", rules: "rule" };
  var AUTO = [{ value: "MAX_TRADES_PER_SESSION", label: "Max trades per session" }, { value: "MAX_LOSS_PER_TRADE", label: "Max loss per trade" }, { value: "NO_ENTRY_AFTER_N_LOSSES", label: "No entry after N losses (same day)" }];
  var UNITS = [{ value: "sol", label: "SOL" }, { value: "pct", label: "% ROI" }];
  var POLARITY = [{ value: "mistake", label: "Mistake" }, { value: "positive", label: "Strength" }];

  /** Reviews that use the item; > 0 means it can only be archived. */
  function uses(kind, id) {
    return SJ.store.data().reflections.filter(function (r) {
      if (kind === "strategies") return r.strategyId === id;
      if (kind === "tags") return r.tagIds.indexOf(id) >= 0;
      return r.ruleResults.some(function (x) { return x.ruleId === id; });
    }).length;
  }

  /** item: an existing vocab row, or null for a new one; defaults: fields of a new one (a tag's polarity). */
  function open(kind, item, defaults) {
    var isNew = !item;
    var d = Object.assign({ name: "", description: "", polarity: "mistake", active: true, type: "MANUAL", threshold: "", thresholdUnit: "sol" }, defaults, item || {});
    if (d.threshold === null) d.threshold = "";
    var used = isNew ? 0 : uses(kind, item.id);
    var error = h("p", { role: "alert", class: "text-body-sm text-loss", hidden: true });
    var auto = h("div");
    function paintAuto() {
      SJ.dom.clear(auto);
      if (d.type === "MANUAL") return;
      auto.appendChild(h("div", { class: "rv-grid" },
        ui.input({ label: d.type === "MAX_LOSS_PER_TRADE" ? "Max loss" : d.type === "MAX_TRADES_PER_SESSION" ? "Max trades" : "Losses in a row", value: d.threshold, attrs: { inputmode: "decimal" }, oninput: function (e) { d.threshold = e.target.value; } }),
        d.type === "MAX_LOSS_PER_TRADE" && h("div", { class: "rv-group" }, h("span", { class: "text-label-sm text-muted uppercase", text: "Unit" }),
          ui.segmented({ label: "Unit", options: UNITS, value: d.thresholdUnit || "sol", onChange: function (v) { d.thresholdUnit = v; } }))));
    }
    var fields = [ui.input({ label: "Name", value: d.name, attrs: { maxlength: "60", "data-autofocus": "" }, oninput: function (e) { d.name = e.target.value; } })];
    if (kind === "tags") fields.push(h("div", { class: "rv-group" }, h("span", { class: "text-label-sm text-muted uppercase", text: "Type" }),
      ui.segmented({ label: "Type", options: POLARITY, value: d.polarity, onChange: function (v) { d.polarity = v; } })));
    else fields.push(ui.textarea({ label: "Description", value: d.description || "", rows: 3, attrs: { maxlength: "1000" }, oninput: function (e) { d.description = e.target.value; } }));
    if (kind === "rules") {
      fields.push(ui.checkRow({ label: "Active (shown on the review checklist)", checked: d.active !== false, onChange: function (on) { d.active = on; } }));
      fields.push(ui.select({ label: "Automatic check", hint: "Pre-flags likely breaks in the review form. You always confirm them.", placeholder: "None (manual only)",
        value: d.type === "MANUAL" ? "" : d.type, options: AUTO, onchange: function (e) { d.type = e.target.value || "MANUAL"; paintAuto(); } }));
      paintAuto();
      fields.push(auto);
    }

    function act(work, message) {
      try { work(); } catch (e) { error.textContent = e.message; error.hidden = false; return; }
      modal.close();
      SJ.overlay.toast({ title: message, tone: "success" });
    }
    function save() {
      var out = { name: d.name };
      if (kind === "tags") out.polarity = d.polarity;
      else out.description = String(d.description || "").trim() || null;
      if (kind === "rules") {
        var n = Number(d.threshold);
        if (d.type !== "MANUAL" && !(n > 0)) { error.textContent = "Enter a threshold above 0."; error.hidden = false; return; }
        Object.assign(out, { active: d.active !== false, type: d.type, threshold: d.type === "MANUAL" ? null : String(d.threshold).trim(), thresholdUnit: d.type === "MAX_LOSS_PER_TRADE" ? d.thresholdUnit || "sol" : null });
      }
      act(function () { SJ.actions.saveVocab(kind, out, isNew ? undefined : item.id); }, (isNew ? "Created " : "Saved ") + NOUN[kind]);
    }

    var footer = [];
    if (!isNew) {
      if (item.archived) footer.push(ui.button({ label: "Restore", variant: "ghost", onclick: function () { act(function () { SJ.actions.saveVocab(kind, { name: item.name, archived: false }, item.id); }, "Restored " + NOUN[kind]); } }));
      else if (used > 0) footer.push(ui.button({ label: "Archive", variant: "ghost", onclick: function () { act(function () { SJ.actions.deleteVocab(kind, item.id); }, "Archived " + NOUN[kind]); } }));
      else footer.push(ui.button({ label: "Delete", variant: "danger", onclick: function () { act(function () { SJ.actions.deleteVocab(kind, item.id); }, "Deleted " + NOUN[kind]); } }));
    }
    footer.push(ui.button({ label: "Cancel", variant: "ghost", onclick: function () { modal.close(); } }), ui.button({ label: "Save", variant: "primary", onclick: save }));
    var form = h("form", { class: "vocab-form" }, fields, error);
    form.addEventListener("submit", function (e) { e.preventDefault(); save(); });
    var modal = SJ.overlay.modal({
      title: (isNew ? "New " : "Edit ") + NOUN[kind],
      description: !isNew && used > 0 ? "Used by " + used + " review" + (used === 1 ? "" : "s") + ". It can be archived but not deleted." : null,
      body: form, footer: footer,
    });
    return modal;
  }

  SJ.vocabEditor = { open: open, uses: uses };
})();
