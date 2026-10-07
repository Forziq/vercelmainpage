// DOM helpers and the control builders (the app's Button, Card, StatCard, Badge, Chip, GradePicker,
// SegmentedControl, Tabs, CheckRow and Field). Classes live in css/components.css. Data parts are in widgets.js.
(function () {
  var SJ = (window.SJ = window.SJ || {});

  /**
   * h("a", { href: "#/x", class: "nav-link", "aria-current": "page", onclick: fn }, child, ...)
   * Children may be strings, nodes, arrays or null/false (skipped). Attributes with null/false are left out.
   */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value === null || value === undefined || value === false) return;
        if (key.slice(0, 2) === "on" && typeof value === "function") el.addEventListener(key.slice(2), value);
        else if (key === "text") el.textContent = value;
        else el.setAttribute(key, value === true ? "" : String(value));
      });
    }
    append(el, Array.prototype.slice.call(arguments, 2));
    return el;
  }

  function append(el, children) {
    children.forEach(function (child) {
      if (child === null || child === undefined || child === false) return;
      if (Array.isArray(child)) append(el, child);
      else el.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
  }

  /** An outline icon (24 px grid, drawn at 16 px unless the CSS says otherwise), hidden from screen readers. */
  function icon(name, className) {
    // The HTML parser puts <svg> in the SVG namespace by itself, so no namespace URL is needed.
    var holder = document.createElement("template");
    holder.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="icon' +
      (className ? " " + className : "") +
      '">' +
      ((SJ.ICONS && SJ.ICONS[name]) || "") +
      "</svg>";
    return holder.content.firstChild;
  }

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  }

  /** Joins class names, skipping falsy values (the app's `cx`). */
  function cx() {
    return Array.prototype.filter.call(arguments, Boolean).join(" ");
  }

  var nextId = 0;
  var uid = function (prefix) { return (prefix || "sj") + "-" + ++nextId; };

  var TONE_TEXT = { profit: "text-profit", loss: "text-loss", neutral: "text-neutral", default: "text-fg" };
  /** Tone for a signed amount: > 0 profit, < 0 loss, 0 neutral, unknown default. */
  function toneOf(sign) {
    if (sign === null || sign === undefined || isNaN(sign)) return "default";
    return sign > 0 ? "profit" : sign < 0 ? "loss" : "neutral";
  }

  // ---- Button, Card, StatCard

  /** o: { label, variant (primary|secondary|ghost|danger), size (md|sm), icon, kbd, onclick, disabled, attrs } */
  function button(o) {
    var attrs = Object.assign({ type: "button", class: cx("btn", "btn-" + (o.variant || "secondary"), o.size === "sm" && "btn-sm", o.className), onclick: o.onclick, disabled: o.disabled }, o.attrs);
    return h("button", attrs, o.icon && icon(o.icon), o.label, o.kbd && h("kbd", { class: "kbd", "aria-hidden": "true", text: o.kbd }));
  }

  /** Square icon-only button; the label is its accessible name and tooltip. */
  function iconButton(o) {
    return h("button", Object.assign({ type: "button", class: cx("btn btn-icon", "btn-" + (o.variant || "ghost"), o.className), "aria-label": o.label, title: o.label, onclick: o.onclick, disabled: o.disabled }, o.attrs), icon(o.icon));
  }

  /** Surface panel. o: { label | labelledby, padding (md|lg|none), className } */
  function card(o, children) {
    var pad = o.padding === "lg" ? "card-lg" : o.padding === "none" ? "card-flush" : null;
    return h("section", { class: cx("card", pad, o.className), "aria-label": o.label, "aria-labelledby": o.labelledby }, children);
  }

  /** o: { id, title, description, meta, actions, size (md|label) } */
  function cardHeader(o) {
    var side = (o.meta || o.actions) && h("div", { class: "card-head-side" }, o.meta && h("span", { class: "text-data-xs text-muted" }, o.meta), o.actions);
    return h("header", { class: "card-head" },
      h("div", null,
        h("h2", { id: o.id, class: o.size === "label" ? "text-label-sm text-muted" : "card-title" }, o.title),
        o.description && h("p", { class: "text-body-sm" }, o.description)),
      side);
  }

  /** o: { label, value ("—" when unknown), unit ("SOL" draws the mark), tone, delta, deltaTone, sub, hero, compact } */
  function statCard(o) {
    var unit = o.unit === "SOL" ? SJ.ui.solIcon({ className: "text-body-sm" }) : o.unit && h("span", { class: "text-body-sm text-muted", text: o.unit });
    return h("div", { role: "group", "aria-label": o.label, class: cx(o.compact ? "stat-compact" : "stat", o.hero && "stat-hero", o.className) },
      h("div", { class: "text-label-sm text-muted", text: o.label }),
      h("div", { class: "stat-value" }, h("span", { class: cx("font-mono", TONE_TEXT[o.tone || "default"]) }, o.value), unit),
      o.sub,
      o.delta && h("div", { class: cx("stat-delta text-data-xs", TONE_TEXT[o.deltaTone || "default"]) }, o.delta));
  }

  // ---- Badges

  var OUTCOME = { win: ["Win", "badge-profit"], loss: ["Loss", "badge-loss"], breakeven: ["BE", "badge-neutral"] };
  var muted = function (srText) {
    return h("span", { class: "text-data-xs text-muted" }, h("span", { "aria-hidden": "true", text: "—" }), h("span", { class: "sr-only", text: srText }));
  };

  /** WIN / LOSS / BE; "—" when the outcome is unknown (open or transferred). */
  function outcomeBadge(outcome) {
    if (!outcome) return muted("No outcome");
    return h("span", { class: cx("badge badge-upper", OUTCOME[outcome][1]) },
      h("span", { "aria-hidden": "true", text: OUTCOME[outcome][0] }), h("span", { class: "sr-only", text: "Outcome: " + outcome }));
  }

  var GRADE_TEXT = { A: "text-profit", B: "text-profit", C: "text-warning", D: "text-loss", F: "text-loss" };
  function gradeBadge(grade) {
    if (!grade) return muted("Not graded");
    return h("span", { class: cx("grade", GRADE_TEXT[grade]) }, h("span", { class: "sr-only", text: "Grade " }), grade);
  }

  /** Meta / status / count badge. tone: default | accent | warning | loss | profit */
  function badge(content, tone, srText) {
    return h("span", { class: cx("badge", tone && tone !== "default" && "badge-" + tone) },
      h("span", { "aria-hidden": srText ? "true" : null }, content), srText && h("span", { class: "sr-only", text: srText }));
  }

  function statusDot(text, tone) {
    return h("span", { class: "status-dot" }, h("span", { class: cx("dot", tone && "dot-" + tone), "aria-hidden": "true" }), text);
  }

  // ---- Chips and tags

  /** Toggle chip. o: { label, selected, kind (plain|mistake|strength), onToggle(selected), disabled } */
  function chip(o) {
    var el = h("button", { type: "button", class: cx("chip", o.kind && o.kind !== "plain" && "chip-" + o.kind), "aria-pressed": String(!!o.selected), disabled: o.disabled });
    function paint(on) {
      clear(el);
      el.setAttribute("aria-pressed", String(on));
      append(el, [on && icon("check"), o.label]);
    }
    paint(!!o.selected);
    el.addEventListener("click", function () {
      var on = el.getAttribute("aria-pressed") !== "true";
      paint(on);
      if (o.onToggle) o.onToggle(on);
    });
    return el;
  }

  /** Static label chip, optionally removable (active filters). o: { label, kind, onRemove, removeLabel } */
  function tag(o) {
    return h("span", { class: cx("tag", o.kind && o.kind !== "plain" && "tag-" + o.kind) }, o.label,
      o.onRemove && h("button", { type: "button", class: "tag-remove", "aria-label": o.removeLabel || "Remove", onclick: o.onRemove }, icon("x")));
  }

  // ---- Grade picker, segmented control, tabs

  var CAPTION = { A: "Flawless", B: "Solid", C: "Mediocre", D: "Sloppy", F: "Tilted" };

  /** A–F squares. o: { value, onChange(grade), label } */
  function gradePicker(o) {
    var value = o.value || null;
    var group = h("div", { role: "group", "aria-label": o.label || "Execution grade", class: "grade-picker" });
    ["A", "B", "C", "D", "F"].forEach(function (g) {
      group.appendChild(h("button", { type: "button", class: "grade-option", "data-grade": g, "aria-pressed": String(value === g), onclick: function () { set(g); if (o.onChange) o.onChange(g); } },
        h("span", { class: cx("grade", GRADE_TEXT[g]), text: g }), h("span", { class: "grade-caption text-data-xs", text: CAPTION[g] })));
    });
    function set(g) {
      value = g;
      group.querySelectorAll(".grade-option").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-grade") === g)); });
    }
    group.setValue = set;
    return group;
  }

  /** Radio group styled as a segmented bar; arrow keys move the selection. o: { label, options [{value,label}], value, onChange, size } */
  function segmented(o) {
    var value = o.value;
    var group = h("div", { role: "radiogroup", "aria-label": o.label, class: cx("segmented", o.size === "sm" && "segmented-sm", o.className) });
    var buttons = o.options.map(function (opt) {
      return h("button", { type: "button", role: "radio", class: "segment", "data-value": opt.value, onclick: function () { choose(opt.value, false); } }, opt.label);
    });
    function paint() {
      var current = o.options.map(function (x) { return x.value; }).indexOf(value);
      buttons.forEach(function (b, i) {
        b.setAttribute("aria-checked", String(i === current));
        b.tabIndex = i === current || (current === -1 && i === 0) ? 0 : -1;
      });
    }
    function choose(v, focus) {
      value = v;
      paint();
      if (focus) buttons[o.options.map(function (x) { return x.value; }).indexOf(v)].focus();
      if (o.onChange) o.onChange(v);
    }
    group.addEventListener("keydown", function (e) {
      var step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      var i = Math.max(0, o.options.map(function (x) { return x.value; }).indexOf(value));
      choose(o.options[(i + step + o.options.length) % o.options.length].value, true);
    });
    append(group, buttons);
    paint();
    return group;
  }

  /** Underline tabs (WAI-ARIA tabs). o: { label, items [{id, label, content: node | function}], value, onChange } */
  function tabs(o) {
    var base = uid("tabs");
    var active = o.value || o.items[0].id;
    var list = h("div", { role: "tablist", "aria-label": o.label, class: "tablist" });
    var panels = h("div");
    var buttons = o.items.map(function (t) {
      return h("button", { type: "button", role: "tab", class: "tab text-body-md", id: base + "-tab-" + t.id, "aria-controls": base + "-panel-" + t.id, onclick: function () { select(t.id, false); } }, t.label);
    });
    function select(id, focus, silent) {
      active = id;
      clear(panels);
      o.items.forEach(function (t, i) {
        var on = t.id === id;
        buttons[i].setAttribute("aria-selected", String(on));
        buttons[i].tabIndex = on ? 0 : -1;
        if (on && focus) buttons[i].focus();
        if (on) panels.appendChild(h("div", { role: "tabpanel", class: "tabpanel", id: base + "-panel-" + t.id, "aria-labelledby": buttons[i].id }, typeof t.content === "function" ? t.content() : t.content));
      });
      if (o.onChange && !silent) o.onChange(id);
    }
    list.addEventListener("keydown", function (e) {
      var ids = o.items.map(function (t) { return t.id; });
      var i = ids.indexOf(active);
      var next = e.key === "ArrowRight" ? (i + 1) % ids.length : e.key === "ArrowLeft" ? (i - 1 + ids.length) % ids.length : e.key === "Home" ? 0 : e.key === "End" ? ids.length - 1 : -1;
      if (next < 0) return;
      e.preventDefault();
      select(ids[next], true);
    });
    append(list, buttons);
    var root = h("div", null, list, panels);
    select(active, false, true);
    return root;
  }

  // ---- Check row and fields

  /** Rule checklist row. o: { label, checked, onChange(checked), alert (tint loss when unchecked), meta } */
  function checkRow(o) {
    var el = h("button", { type: "button", role: "checkbox", class: "check-row text-body-md" });
    function paint(on) {
      clear(el);
      el.setAttribute("aria-checked", String(on));
      el.classList.toggle("is-broken", !!o.alert && !on);
      append(el, [h("span", { class: "check-label" }, o.label), o.meta && h("span", { class: "text-data-xs" }, o.meta), h("span", { class: "check-box", "aria-hidden": "true" }, on && icon("check"))]);
    }
    paint(!!o.checked);
    el.addEventListener("click", function () {
      var on = el.getAttribute("aria-checked") !== "true";
      paint(on);
      if (o.onChange) o.onChange(on);
    });
    return el;
  }

  /** Label + control + hint or error; the control gets the id, aria-describedby and aria-invalid. */
  function field(o, control, decorations) {
    var id = uid("field");
    var desc = o.error || o.hint ? id + "-desc" : null;
    control.id = id;
    if (desc) control.setAttribute("aria-describedby", desc);
    if (o.error) control.setAttribute("aria-invalid", "true");
    return h("div", { class: cx("field", o.className) },
      h("label", { for: id, class: o.hideLabel ? "sr-only" : "field-label text-label-sm", text: o.label }),
      h("div", { class: "field-control" }, decorations, control),
      desc && h("p", { id: desc, class: cx("text-body-sm", o.error ? "field-error" : "text-muted"), text: o.error || o.hint }));
  }

  /** o: { label, hint, error, hideLabel, search, value, placeholder, oninput, attrs } */
  function input(o) {
    var el = h("input", Object.assign({ type: o.search ? "search" : "text", class: cx("input", o.search && "input-search"), placeholder: o.placeholder, oninput: o.oninput }, o.attrs));
    if (o.value !== undefined) el.value = o.value;
    return field(o, el, o.search && icon("search", "field-search-icon"));
  }

  function textarea(o) {
    var el = h("textarea", Object.assign({ class: "input", rows: o.rows || 4, placeholder: o.placeholder, oninput: o.oninput }, o.attrs));
    if (o.value !== undefined) el.value = o.value;
    return field(o, el);
  }

  /** o: { label, options [{value, label, disabled}], placeholder, value, onchange } */
  function select(o) {
    var el = h("select", Object.assign({ class: "input", onchange: o.onchange }, o.attrs),
      o.placeholder && h("option", { value: "", text: o.placeholder }),
      o.options.map(function (opt) { return h("option", { value: opt.value, disabled: opt.disabled, text: opt.label }); }));
    if (o.value !== undefined) el.value = o.value;
    return field(o, el, icon("chevron-down", "field-chevron"));
  }

  SJ.dom = { h: h, icon: icon, clear: clear, append: append, cx: cx, uid: uid };
  SJ.ui = Object.assign(SJ.ui || {}, {
    TONE_TEXT: TONE_TEXT, toneOf: toneOf, GRADE_TEXT: GRADE_TEXT,
    button: button, iconButton: iconButton, card: card, cardHeader: cardHeader, statCard: statCard,
    outcomeBadge: outcomeBadge, gradeBadge: gradeBadge, badge: badge, statusDot: statusDot, chip: chip, tag: tag,
    gradePicker: gradePicker, segmented: segmented, tabs: tabs, checkRow: checkRow, input: input, textarea: textarea, select: select,
  });
})();
