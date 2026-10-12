// Guided tour (docs/showcase.md §6): the steps in callouts/tour.js, started only by the overview's "Take the
// 2-minute tour" button. A step opens its screen, sets Explain, highlights its callout's anchor and shows one
// paragraph with a link to the callout's Under the hood note. The panel is a floating, non-modal region outside
// #view, so it survives navigation and never traps focus: the rest of the page stays usable and Exit is always there.
// ← / → move between steps and Esc exits, except while typing, inside a dialog or when a control used the key.
// State is in memory only; Reset demo exits the tour.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;

  var active = false;
  var ready = false;
  var index = 0;
  var panel = null;
  var live = null;
  var content = null;
  var target = null;
  var settled = -1;
  var pendingFocus = null;
  var explainBefore = false;

  var steps = function () { return SJ.tourSteps || []; };
  var pathOf = function (step) { return typeof step.path === "function" ? step.path() : step.path; };
  var calloutOf = function (step) { return SJ.explain.all().filter(function (c) { return c.id === step.callout; })[0] || null; };

  /** True while the screen on display is the current step's. */
  function onStep() {
    return active && "#" + SJ.router.currentPath() === pathOf(steps()[index]).split("?")[0];
  }

  function focusAction(action) {
    var el = panel && (panel.querySelector('[data-tour="' + action + '"]:not([disabled])') || panel.querySelector('[data-tour="next"], [data-tour="finish"]'));
    if (el) el.focus({ preventScroll: true });
  }

  /**
   * Highlights the step's anchor whenever the view changes (navigation, a redraw after a store change, a tab).
   * The first time the step's screen is on display it also sets Explain, scrolls the anchor into view and gives
   * focus back to the panel button that was used (the router has just moved it to the new page's heading).
   */
  function apply() {
    if (!active) return;
    var here = onStep();
    var c = calloutOf(steps()[index]);
    var el = here && c ? document.querySelector('#view [data-explain="' + c.anchor + '"]') : null;
    if (target && target !== el) target.classList.remove("tour-target");
    target = el;
    if (el) el.classList.add("tour-target");
    panel.querySelector(".tour-return").hidden = here;
    if (!here || settled === index) return;
    settled = index;
    SJ.explain.setOn(!!steps()[index].explain);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "start", behavior: SJ.motion.reduced() ? "auto" : "smooth" });
    if (pendingFocus) focusAction(pendingFocus);
    pendingFocus = null;
  }

  function button(action, label, variant, onclick, disabled) {
    return ui.button({ label: label, variant: variant, size: "sm", onclick: onclick, disabled: disabled, attrs: { "data-tour": action } });
  }

  function paint() {
    var n = steps().length;
    var step = steps()[index];
    var c = calloutOf(step);
    live.textContent = "Step " + (index + 1) + " of " + n + ": " + step.title;
    SJ.dom.append(SJ.dom.clear(content), [
      h("div", { class: "tour-body" },
        h("h2", { class: "text-title-sm", text: step.title }),
        h("p", { class: "text-body-md", text: step.text }),
        h("div", { class: "tour-links" },
          c && h("button", { type: "button", class: "tour-link text-body-sm", "data-tour": "hood", onclick: openHood }, SJ.dom.icon("lightbulb"), "Under the hood: " + c.title),
          h("button", { type: "button", class: "tour-link tour-return text-body-sm", "data-tour": "return", hidden: true, onclick: function () { go(index); } }, SJ.dom.icon("rotate-ccw"), "Back to this step"))),
      h("div", { class: "tour-pill" },
        h("span", { class: "tour-step text-data-xs", "aria-hidden": "true", text: "Step " + (index + 1) + " of " + n }),
        h("div", { class: "tour-actions" },
          button("back", "Back", "ghost", back, index === 0),
          index === n - 1 ? button("finish", "Explore freely", "primary", finish) : button("next", "Next", "primary", next),
          button("exit", "Exit", "ghost", exit))),
    ]);
    document.body.style.setProperty("--tour-space", panel.offsetHeight + "px");
  }

  /** Opens step i. Focus stays on the panel button that was used, so Next can be pressed again and again. */
  function go(i) {
    if (!active || i < 0 || i >= steps().length) return;
    var used = panel.contains(document.activeElement) ? document.activeElement.getAttribute("data-tour") : null;
    SJ.explain.close();
    index = i;
    settled = -1;
    paint();
    // The repaint removed the used button: focus its twin now (or Next when Back is disabled on step 1), and again
    // in apply() once a navigation has moved focus to the new page's heading.
    if (used) focusAction(used);
    pendingFocus = used;
    if (onStep()) apply();
    else window.location.hash = pathOf(steps()[i]);
  }

  function next() { go(index + 1); }
  function back() { go(index - 1); }

  function openHood(e) {
    // The explain popover closes on any click outside it, so this click must not reach the document.
    if (e) e.stopPropagation();
    var c = calloutOf(steps()[index]);
    if (!c || !onStep()) return;
    if (target && target.scrollIntoView) target.scrollIntoView({ block: "start", behavior: "auto" });
    SJ.explain.reveal(c.id);
  }

  function onKey(e) {
    if (!active || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    var t = e.target && e.target.nodeType === 1 ? e.target : null;
    if (t && (SJ.reflection.isTextEntry(t) || t.closest('[aria-modal="true"], .explain-pop'))) return;
    if (e.key === "Escape") exit();
    else if (e.key === "ArrowRight" && index < steps().length - 1) next();
    else if (e.key === "ArrowLeft" && index > 0) back();
    else return;
    e.preventDefault();
  }

  function start() {
    if (!steps().length) return;
    if (!ready) {
      ready = true;
      // Window, bubbling: overlays, the explain popover and controls that use these keys handle them first.
      window.addEventListener("keydown", onKey);
      new MutationObserver(apply).observe(document.getElementById("view"), { childList: true, subtree: true });
    }
    if (!active) {
      explainBefore = SJ.explain.isOn();
      active = true;
      live = h("p", { class: "sr-only", "aria-live": "polite" });
      content = h("div", { class: "tour-content" });
      panel = h("section", { class: "tour", role: "region", "aria-label": "Guided tour" }, live, content);
      document.body.appendChild(panel);
      document.body.classList.add("has-tour");
    }
    go(0);
    focusAction("next");
  }

  /** Ends the tour: removes the panel and the highlight and puts Explain back as it was before the tour. */
  function exit() {
    if (!active) return;
    var hadFocus = panel.contains(document.activeElement);
    active = false;
    if (target) target.classList.remove("tour-target");
    target = null;
    settled = -1;
    pendingFocus = null;
    panel.remove();
    panel = live = content = null;
    document.body.classList.remove("has-tour");
    document.body.style.removeProperty("--tour-space");
    SJ.explain.close();
    SJ.explain.setOn(explainBefore);
    if (hadFocus) document.getElementById("main").focus();
  }

  function finish() {
    exit();
    window.location.hash = "#/dashboard";
    SJ.overlay.toast({ title: "Tour finished", body: "Everything here is clickable. Explain in the top bar shows the notes on any screen.", tone: "success" });
  }

  SJ.tour = {
    start: start, exit: exit, next: next, back: back, go: go,
    isActive: function () { return active; },
    index: function () { return index; },
    steps: steps, pathOf: pathOf, calloutOf: calloutOf,
  };
})();
