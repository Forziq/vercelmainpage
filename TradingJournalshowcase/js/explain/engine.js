// Explainer engine (docs/showcase.md §6). Callout files in explain/callouts/ call SJ.explain.define([...]) when they
// load. Each callout is checked against the schema below; an invalid one is left out, logged and listed in
// SJ.explain.errors, and the guard test fails on any entry there.
//
// Callout data conventions (one file per screen, named after the screen):
//   { id, screen, anchor, title, plain, live?, technical? }
//   id       unique lower-case slug, prefixed with the screen ("ov-flow")
//   screen   the route name the callout belongs to (router.js ROUTES)
//   anchor   the value of the data-explain attribute it points at; set it with SJ.explain.anchor(el, anchor)
//   title    a few words; plain one or two plain-English sentences, no jargon left undefined
//   live     optional "In the live app: …" note, written without that prefix (it is added when shown)
//   technical optional { text, code?: { label, lines } }: shown in the closed "Under the hood" disclosure. A code
//            excerpt is copied line for line from the app's source, at most 15 lines, labelled with its path in the
//            source folder ("lib/finance/allocate.ts"); "// …" marks skipped lines. Tests check every line still exists.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var MAX_CODE_LINES = 15;
  var SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  var FIELDS = { id: 1, screen: 1, anchor: 1, title: 1, plain: 1, live: 1, technical: 1 };
  var registry = {};
  var errors = [];

  var text = function (v, max) { return typeof v === "string" && v.trim().length > 0 && v.length <= max; };

  /** The schema problems of one callout; an empty list means it is valid. */
  function validate(c) {
    if (!c || typeof c !== "object" || Array.isArray(c)) return ["not an object"];
    var p = [];
    Object.keys(c).forEach(function (k) { if (!FIELDS[k]) p.push("unknown field " + k); });
    ["id", "screen", "anchor"].forEach(function (k) { if (typeof c[k] !== "string" || !SLUG.test(c[k])) p.push(k + " must be a lower-case slug"); });
    if (!text(c.title, 80)) p.push("title must be 1 to 80 characters");
    if (!text(c.plain, 320)) p.push("plain must be 1 to 320 characters");
    else if ((c.plain.match(/[.!?](\s|$)/g) || []).length > 2) p.push("plain must be one or two sentences");
    if (c.live !== undefined && (!text(c.live, 240) || /^in the live app/i.test(c.live))) p.push("live must be 1 to 240 characters, without the In the live app prefix");
    var t = c.technical;
    if (t === undefined) return p;
    if (!t || typeof t !== "object" || Array.isArray(t)) return p.concat("technical must be an object");
    Object.keys(t).forEach(function (k) { if (k !== "text" && k !== "code") p.push("unknown field technical." + k); });
    if (!text(t.text, 600)) p.push("technical.text must be 1 to 600 characters");
    if (t.code === undefined) return p;
    var code = t.code;
    if (!code || !text(code.label, 120) || !Array.isArray(code.lines)) p.push("technical.code needs a label and lines");
    else if (code.lines.length < 1 || code.lines.length > MAX_CODE_LINES) p.push("technical.code must have 1 to " + MAX_CODE_LINES + " lines");
    else if (!code.lines.every(function (l) { return typeof l === "string"; })) p.push("technical.code lines must be strings");
    return p;
  }

  function define(list) {
    list.forEach(function (c, i) {
      var id = c && typeof c.id === "string" ? c.id : "#" + i;
      var p = validate(c);
      if (!p.length && registry[id]) p.push("duplicate id");
      if (!p.length) return void (registry[id] = c);
      errors.push({ id: id, problems: p });
      if (typeof console !== "undefined") console.error("Invalid callout " + id + ": " + p.join("; "));
    });
  }

  /** The valid callouts of one screen, by anchor. */
  function forScreen(screen) {
    var out = {};
    Object.keys(registry).forEach(function (id) { if (registry[id].screen === screen) out[registry[id].anchor] = registry[id]; });
    return out;
  }

  function anchor(el, name) {
    el.setAttribute("data-explain", name);
    return el;
  }

  // ---- Placement (pure, so it can be tested without a layout engine)

  var MARKER = 22;
  var INSET = 6;
  var EDGE = 4;
  var GAP = 8;

  /** A marker sits on its anchor's top-right corner, in the layer's coordinates, and never past the layer's width. */
  function place(rect, origin, width) {
    var left = rect.right - origin.left - MARKER + INSET;
    var top = rect.top - origin.top - INSET;
    return { left: Math.max(EDGE, Math.min(left, width - MARKER - EDGE)), top: Math.max(0, top) };
  }

  /** The popover (position: fixed) goes below its marker, or above when it does not fit, inside the viewport. */
  function popoverPlace(marker, width, height, vw, vh) {
    var left = Math.max(GAP, Math.min(marker.right - width, vw - width - GAP));
    var below = marker.bottom + GAP;
    var top = below + height <= vh - GAP ? below : Math.max(GAP, marker.top - GAP - height);
    return { left: left, top: top };
  }

  SJ.explain = {
    MAX_CODE_LINES: MAX_CODE_LINES, MARKER: MARKER,
    validate: validate, define: define, errors: errors, forScreen: forScreen, anchor: anchor,
    all: function () { return Object.keys(registry).map(function (id) { return registry[id]; }); },
    place: place, popoverPlace: popoverPlace,
  };
})();
