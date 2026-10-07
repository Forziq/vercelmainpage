// The full reflection behind "Expand full reflection" (components/reflection/FullReflection.tsx): pre-trade plan with
// target and stop as market cap or % from entry (planned R:R and realised R update as you type) and the post-trade
// review. Part of the quick review form on trade detail; the Inbox leaves it out.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var R = SJ.reflection;
  var TEXT = ["entryReason", "confirmation", "invalidation", "preNotes", "wentWell", "wentBadly", "wouldChange"];
  var SCALE = ["1", "2", "3", "4", "5"].map(function (v) { return { value: v, label: v }; });
  var YES_NO = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }];
  var MODES = [{ value: "mc", label: "MC" }, { value: "pct", label: "%" }];
  var DRIVERS = [{ value: "good_execution", label: "Good execution" }, { value: "luck", label: "Luck" }, { value: "poor_execution", label: "Poor execution" }, { value: "mixed", label: "Mixed" }];

  var level = function (mc, pct) { return mc === null && pct !== null ? { mode: "pct", value: pct } : { mode: "mc", value: mc || "" }; };
  var blank = function (s) { return String(s).trim() === "" ? null : String(s).trim(); };

  function toDraft(full) {
    var f = full || {};
    var d = { planned: f.planned === undefined ? null : f.planned, entryQuality: f.entryQuality || null, exitQuality: f.exitQuality || null,
      takeAgain: f.takeAgain === undefined ? null : f.takeAgain, outcomeDriver: f.outcomeDriver || null,
      target: level(f.plannedTargetMc || null, f.plannedTargetPct || null), stop: level(f.plannedStopMc || null, f.plannedStopPct || null) };
    TEXT.forEach(function (k) { d[k] = f[k] || ""; });
    return d;
  }

  /** The draft in the stored shape: a level keeps either its market cap or its %, never both. */
  function fromDraft(d) {
    var out = { planned: d.planned, entryQuality: d.entryQuality, exitQuality: d.exitQuality, takeAgain: d.takeAgain, outcomeDriver: d.outcomeDriver,
      plannedTargetMc: d.target.mode === "mc" ? blank(d.target.value) : null, plannedTargetPct: d.target.mode === "pct" ? blank(d.target.value) : null,
      plannedStopMc: d.stop.mode === "mc" ? blank(d.stop.value) : null, plannedStopPct: d.stop.mode === "pct" ? blank(d.stop.value) : null };
    TEXT.forEach(function (k) { out[k] = blank(d[k]); });
    return out;
  }
  var hasContent = function (d) { var f = fromDraft(d); return Object.keys(f).some(function (k) { return f[k] !== null; }); };

  function field(label, control) {
    return h("div", { class: "rv-group" }, h("span", { class: "text-label-sm text-muted uppercase", text: label }), control);
  }

  /** A segmented control whose selected option clears it when chosen again. */
  function choice(label, options, get, set) {
    var holder = h("div");
    var paint = function () {
      SJ.dom.clear(holder).appendChild(ui.segmented({ label: label, options: options, value: get(), className: "segmented-full", onChange: function (v) {
        if (get() === v) { set(null); paint(); holder.querySelector('[role="radio"]').focus(); } else set(v);
      } }));
    };
    paint();
    return field(label, holder);
  }

  function render(t, d, state) {
    var open = state.fullOpen === undefined ? hasContent(d) : state.fullOpen;
    var panelId = SJ.dom.uid("full");
    var text = function (key, label, rows) {
      return ui.textarea({ label: label, rows: rows || 2, value: d[key], attrs: { maxlength: key === "preNotes" ? "5000" : "2000" }, oninput: function (e) { d[key] = e.target.value; } });
    };
    var yesNo = function (key, label) {
      return choice(label, YES_NO, function () { return d[key] === null ? null : d[key] ? "yes" : "no"; }, function (v) { d[key] = v === null ? null : v === "yes"; });
    };
    var scale = function (key, label) {
      return choice(label, SCALE, function () { return d[key] === null ? null : String(d[key]); }, function (v) { d[key] = v === null ? null : Number(v); });
    };

    var planned = h("dd", { class: "font-mono text-data-md text-fg" });
    var realised = h("dd", { class: "font-mono text-data-md text-fg" });
    function paintR() {
      var r = R.rr(d.target, d.stop, t.entryMcSol, t.roi);
      planned.textContent = R.fmtR(r.planned, false);
      realised.textContent = R.fmtR(r.realised, true);
    }
    function levelInput(key, label, hint) {
      var input = h("input", { class: "input", inputmode: "decimal", "aria-label": label, placeholder: d[key].mode === "mc" ? "Market cap in SOL" : hint,
        oninput: function (e) { d[key].value = e.target.value; paintR(); } });
      input.value = d[key].value;
      return h("div", { class: "rv-group" },
        h("div", { class: "rv-group-head" }, h("span", { class: "text-label-sm text-muted uppercase", text: label }),
          ui.segmented({ label: label + " unit", size: "sm", options: MODES, value: d[key].mode, onChange: function (mode) {
            d[key] = { mode: mode, value: "" };
            input.value = "";
            input.placeholder = mode === "mc" ? "Market cap in SOL" : hint;
            paintR();
          } })),
        input);
    }
    paintR();

    var body = h("div", { id: panelId, class: "full-body", hidden: !open },
      h("section", { class: "full-section", "aria-label": "Pre-trade" },
        h("h3", { class: "text-title-sm text-fg", text: "Pre-trade" }),
        yesNo("planned", "Planned trade"), text("entryReason", "Reason for entry"), text("confirmation", "Confirmation used"), text("invalidation", "Invalidation point"),
        h("div", { class: "rv-grid" }, levelInput("target", "Planned target", "% from entry, e.g. 100"), levelInput("stop", "Planned stop", "% from entry, e.g. -30")),
        SJ.explain.anchor(h("dl", { class: "full-r" },
          h("div", null, h("dt", { class: "text-label-sm text-muted uppercase", text: "Planned R:R" }), planned),
          h("div", null, h("dt", { class: "text-label-sm text-muted uppercase", text: "Realised R" }), realised)), "rf-rr"),
        text("preNotes", "Pre-trade notes", 3)),
      h("section", { class: "full-section is-post", "aria-label": "Post-trade" },
        h("h3", { class: "text-title-sm text-fg", text: "Post-trade" }),
        text("wentWell", "What went well"), text("wentBadly", "What went badly"),
        h("div", { class: "rv-grid" }, scale("entryQuality", "Entry quality (1–5)"), scale("exitQuality", "Exit quality (1–5)")),
        text("wouldChange", "What I'd change"),
        h("div", { class: "rv-grid" }, yesNo("takeAgain", "Take the same trade again"),
          ui.select({ label: "Outcome driver", placeholder: "—", value: d.outcomeDriver || "", options: DRIVERS, onchange: function (e) { d.outcomeDriver = e.target.value || null; } }))));

    var label = h("span", { text: open ? "Hide full reflection" : "Expand full reflection" });
    var button = h("button", { type: "button", class: "full-toggle text-body-md", "aria-expanded": String(open), "aria-controls": panelId, "data-refocus": "full-toggle", onclick: function () {
      open = !open;
      state.fullOpen = open;
      body.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
      label.textContent = open ? "Hide full reflection" : "Expand full reflection";
    } }, h("span", { class: "full-toggle-label" }, SJ.dom.icon("chevron-right", "full-chevron"), label), h("span", { class: "font-mono text-data-xs text-muted", text: "Pre- & post-trade" }));
    return SJ.explain.anchor(h("div", { class: "full" }, button, body), "rf-full");
  }

  SJ.fullReflection = { toDraft: toDraft, fromDraft: fromDraft, hasContent: hasContent, render: render };
})();
