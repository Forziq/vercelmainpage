// Overlays (the app's Modal, Drawer and Toast). They open at once with data-state="open"; closing hands focus
// back, unlocks scrolling and stops input at once, then keeps the node for the 150 ms exit (none under reduced motion).
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var icon = SJ.dom.icon;

  /** Overlay exit length; equals --duration-exit. */
  var EXIT_MS = 150;
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  /** Removes `node` after the exit animation, or at once under reduced motion. */
  function exit(node) {
    node.setAttribute("data-state", "closed");
    node.setAttribute("inert", "");
    if (reducedMotion()) node.remove();
    else setTimeout(function () { node.remove(); }, EXIT_MS);
  }

  /** Keeps Tab and Shift+Tab inside `panel` (the modal focus trap). */
  function trapTab(e, panel) {
    if (e.key !== "Tab") return;
    var items = panel.querySelectorAll(FOCUSABLE);
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  /**
   * o: { title, description, body (node | array), footer (node | array), onClose, kind ("modal" | "drawer") }
   * Escape and backdrop clicks close it; Tab is trapped; focus goes to [data-autofocus] or the first control.
   * Returns { close, panel }.
   */
  function open(o) {
    var id = SJ.dom.uid("dialog");
    var opener = document.activeElement;
    var closed = false;
    var panel = h("div", { role: "dialog", "aria-modal": "true", "aria-labelledby": id + "-title", "aria-describedby": o.description ? id + "-desc" : null, tabindex: "-1", class: "overlay-panel" },
      h("header", { class: "overlay-head" },
        h("div", null,
          h("h2", { id: id + "-title", class: "text-title-sm text-fg", text: o.title }),
          o.description && h("p", { id: id + "-desc", class: "text-body-sm" }, o.description)),
        SJ.ui.iconButton({ label: "Close", icon: "x", onclick: close })),
      h("div", { class: "overlay-body" }, o.body),
      o.footer && h("footer", { class: "overlay-foot" }, o.footer));
    var root = h("div", { class: "overlay overlay-" + (o.kind || "modal"), "data-state": "open" },
      h("div", { class: "overlay-backdrop", "aria-hidden": "true", onclick: close }), panel);

    function onKey(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      } else trapTab(e, panel);
    }

    var overflow = document.body.style.overflow;
    function close() {
      if (closed) return;
      closed = true;
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      exit(root);
      if (opener && opener.focus) opener.focus();
      if (o.onClose) o.onClose();
    }

    document.body.appendChild(root);
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    (panel.querySelector("[data-autofocus]") || panel.querySelector(FOCUSABLE) || panel).focus();
    return { close: close, panel: panel };
  }

  var modal = function (o) { return open(Object.assign({}, o, { kind: "modal" })); };
  /** Right-hand inspector from 768 px, a bottom sheet on phones. */
  var drawer = function (o) { return open(Object.assign({}, o, { kind: "drawer" })); };

  // ---- Toasts

  var TOAST_ICON = { info: ["info", "text-accent"], success: ["check-circle", "text-profit"], warning: ["alert-triangle", "text-warning"], error: ["x-circle", "text-loss"] };
  var TIMEOUT_MS = 5000;
  var MAX_OPEN = 3;
  var region = null;

  /** o: { title, body, tone (info|success|warning|error) }. A fourth toast sends the oldest out through its exit. */
  function toast(o) {
    if (!region) region = document.body.appendChild(h("div", { class: "toasts", "aria-live": "polite" }));
    var tone = TOAST_ICON[o.tone] ? o.tone : "info";
    var el = h("div", { role: tone === "error" ? "alert" : "status", class: "toast", "data-state": "open" },
      icon(TOAST_ICON[tone][0], TOAST_ICON[tone][1]),
      h("div", { class: "toast-text" }, h("p", { class: "text-body-md text-fg", text: o.title }), o.body && h("p", { class: "text-body-sm", text: o.body })),
      h("button", { type: "button", class: "icon-button-sm", "aria-label": "Dismiss", onclick: function () { dismiss(el); } }, icon("x")));
    var open = region.querySelectorAll('.toast[data-state="open"]');
    if (open.length >= MAX_OPEN) dismiss(open[0]);
    region.appendChild(el);
    setTimeout(function () { dismiss(el); }, TIMEOUT_MS);
    return el;
  }

  function dismiss(el) {
    if (el.getAttribute("data-state") === "open") exit(el);
  }

  SJ.overlay = { EXIT_MS: EXIT_MS, reducedMotion: reducedMotion, exit: exit, trapTab: trapTab, modal: modal, drawer: drawer, toast: toast };
})();
