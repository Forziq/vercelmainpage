// Explain mode (docs/showcase.md §6): the top-bar toggle puts a numbered marker on every visible [data-explain]
// anchor of the current screen that has a callout; a marker opens a small popover. The screen's markers live in one
// layer at the top of <main>, so they follow the page when it scrolls and come before the content in the tab order.
// The shell's own callouts (screen "shell": search, sync) get a second layer in the sticky top bar, numbered first,
// on every app screen but the overview. When Explain is off the layers are removed, so nothing covers the page.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var X = SJ.explain;
  var raf = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function (fn) { return setTimeout(fn, 16); };

  var on = false;
  var layer = null;
  var shellLayer = null;
  var markers = {};
  var pop = null;
  var frame = 0;

  var screenName = function () { var r = SJ.router && SJ.router.current().route; return r ? r.name : null; };
  var toggleButton = function () { return document.getElementById("explain-toggle"); };

  function schedule() {
    if (!on || frame) return;
    frame = raf(function () { frame = 0; sync(); });
  }

  function marker(c) {
    return h("button", { type: "button", class: "explain-marker", "aria-haspopup": "dialog", "aria-expanded": "false", onclick: function (e) { openPopover(c, e.currentTarget); } });
  }

  /** Adds, numbers, places and removes markers to match the anchors now visible. Returns the marker count. */
  function sync() {
    if (!on || !layer) return 0;
    var seen = {};
    var n = 0;
    var screen = screenName();
    var scopes = [
      { layer: shellLayer, selector: ".topbar [data-explain]", callouts: screen && screen !== "overview" ? X.forScreen("shell") : {} },
      { layer: layer, selector: "#view [data-explain]", callouts: X.forScreen(screen) },
    ];
    scopes.forEach(function (scope) {
      if (!scope.layer) return;
      var origin = scope.layer.getBoundingClientRect();
      var width = scope.layer.parentNode.clientWidth;
      var count = 0;
      Array.prototype.forEach.call(document.querySelectorAll(scope.selector), function (el) {
        var c = scope.callouts[el.getAttribute("data-explain")];
        if (!c || seen[c.id] || el.getClientRects().length === 0) return;
        seen[c.id] = true;
        var m = markers[c.id] || (markers[c.id] = marker(c));
        m.textContent = String(++n);
        m.setAttribute("aria-label", "Explanation " + n + ": " + c.title);
        var at = X.place(el.getBoundingClientRect(), origin, width);
        m.style.left = at.left + "px";
        m.style.top = at.top + "px";
        // Re-inserting only when out of order keeps a focused marker focused.
        if (scope.layer.children[count] !== m) scope.layer.insertBefore(m, scope.layer.children[count] || null);
        count++;
      });
    });
    Object.keys(markers).forEach(function (id) {
      if (seen[id]) return;
      if (pop && pop.id === id) closePopover(false);
      markers[id].remove();
      delete markers[id];
    });
    if (pop) placePopover();
    return n;
  }

  function placePopover() {
    if (!pop) return;
    var r = pop.marker.getBoundingClientRect();
    var at = X.popoverPlace(r, pop.el.offsetWidth, pop.el.offsetHeight, document.documentElement.clientWidth, window.innerHeight);
    pop.el.style.left = at.left + "px";
    pop.el.style.top = at.top + "px";
  }

  function openPopover(c, m) {
    var same = pop && pop.id === c.id;
    closePopover(same);
    if (same) return;
    var titleId = SJ.dom.uid("explain");
    var el = h("div", { class: "explain-pop", role: "dialog", "aria-labelledby": titleId, tabindex: "-1" },
      h("header", { class: "explain-pop-head" },
        h("h2", { id: titleId, class: "text-title-sm text-fg", text: c.title }),
        SJ.ui.iconButton({ label: "Close", icon: "x", className: "btn-sm", onclick: function () { closePopover(true); } })),
      h("p", { class: "text-body-md", text: c.plain }),
      c.live && SJ.sim.liveNote(c.live),
      c.technical && SJ.ui.hood(c.technical.text, c.technical.code));
    document.body.appendChild(el);
    pop = { id: c.id, el: el, marker: m };
    // Opening Under the hood makes the popover taller, so it is placed again whenever its size changes.
    if (window.ResizeObserver) (pop.resize = new ResizeObserver(placePopover)).observe(el);
    m.setAttribute("aria-expanded", "true");
    placePopover();
    el.focus();
  }

  /** returnFocus: true sends focus back to the marker; "auto" only when nothing else took it. */
  function closePopover(returnFocus) {
    if (!pop) return;
    var p = pop;
    pop = null;
    if (p.resize) p.resize.disconnect();
    p.el.remove();
    p.marker.setAttribute("aria-expanded", "false");
    var idle = !document.activeElement || document.activeElement === document.body;
    if (p.marker.isConnected && (returnFocus === true || (returnFocus === "auto" && idle))) p.marker.focus();
  }

  function setOn(next) {
    if (!!next === on) return on;
    on = !!next;
    var btn = toggleButton();
    if (btn) btn.setAttribute("aria-pressed", String(on));
    if (on) {
      layer = h("div", { class: "explain-layer" });
      var main = document.getElementById("main");
      main.insertBefore(layer, main.firstChild);
      var bar = document.querySelector(".topbar");
      if (bar) shellLayer = bar.appendChild(h("div", { class: "explain-layer" }));
      if (sync() === 0) SJ.overlay.toast({ title: "No explanations on this screen yet", body: "Try the overview: its numbered markers explain the project.", tone: "info" });
    } else {
      closePopover(false);
      if (layer) layer.remove();
      if (shellLayer) shellLayer.remove();
      layer = null;
      shellLayer = null;
      markers = {};
    }
    return on;
  }

  /** Turns Explain on and opens one callout's popover with Under the hood open (the tour's link). False when its anchor is not on screen. */
  function reveal(id) {
    setOn(true);
    sync();
    var m = markers[id];
    if (!m) return false;
    if (!pop || pop.id !== id) openPopover(X.all().filter(function (c) { return c.id === id; })[0], m);
    var details = pop && pop.el.querySelector("details");
    if (details) details.open = true;
    return true;
  }

  function init() {
    var view = document.getElementById("view");
    new MutationObserver(schedule).observe(view, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-explain", "hidden", "open"] });
    if (window.ResizeObserver) new ResizeObserver(schedule).observe(view);
    window.addEventListener("resize", schedule);
    document.addEventListener("scroll", schedule, true);
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || !pop) return;
      e.stopPropagation();
      closePopover(true);
    });
    document.addEventListener("click", function (e) {
      if (!pop || pop.el.contains(e.target) || (e.target.closest && e.target.closest(".explain-marker"))) return;
      closePopover("auto");
    });
  }

  Object.assign(X, {
    init: init, sync: sync, isOn: function () { return on; }, setOn: setOn, toggle: function () { return setOn(!on); },
    close: function () { closePopover(false); }, reveal: reveal,
  });
})();
