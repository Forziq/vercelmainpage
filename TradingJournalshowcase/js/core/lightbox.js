// Full-viewport screenshot viewer (components/ui/Lightbox.tsx): the image fitted to the screen, a click toggles
// actual size (1:1) where a mouse drag pans, ← / → and the arrow buttons browse without wrap-around, "2 of 4" and the
// kind as caption. Shares Escape, the focus trap, focus return and scroll lock with the modal.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;

  /**
   * o: { label, images [{ caption, width, height, media() → node | null }], index, actions(index, api) → node, onClose,
   *      fallbackFocus (selector, when the opener was redrawn away) }
   * Returns the api { close, show(i), setImages(list, i), error(text), index() }.
   */
  function open(o) {
    var opener = document.activeElement;
    var openerRef = opener && opener.getAttribute ? opener.getAttribute("data-refocus") : null;
    var images = o.images;
    var i = o.index;
    var closed = false;
    var title = h("h2", { class: "lb-title text-title-sm text-fg" });
    var counter = h("span", { class: "lb-counter font-mono text-data-xs text-muted", "aria-live": "polite" });
    var actions = h("div", { class: "lb-actions" });
    var message = h("p", { role: "alert", class: "lb-message text-body-sm text-loss", hidden: true });
    var stage = h("div", { class: "lb-stage" });
    var prev = ui.iconButton({ label: "Previous screenshot", icon: "chevron-left", variant: "secondary", className: "lb-prev", onclick: function () { show(i - 1); } });
    var next = ui.iconButton({ label: "Next screenshot", icon: "chevron-right", variant: "secondary", className: "lb-next", onclick: function () { show(i + 1); } });
    var root = h("div", { role: "dialog", "aria-modal": "true", "aria-label": o.label, tabindex: "-1", class: "lightbox", "data-state": "open" },
      h("header", { class: "lb-bar" }, title, counter, h("div", { class: "lb-bar-end" }, actions, ui.iconButton({ label: "Close", icon: "x", onclick: close }))),
      message,
      h("div", { class: "lb-body" }, stage, prev, next));
    var api = { close: close, show: show, setImages: setImages, error: error, index: function () { return i; } };

    function error(text) { message.textContent = text; message.hidden = !text; }

    /** One image, fitted; keyed by index, so the zoom resets when browsing. */
    function drawStage(img) {
      SJ.dom.clear(stage);
      var media = img.media();
      if (!media) return stage.appendChild(h("p", { class: "lb-unavailable text-body-md text-muted", text: "Unavailable" }));
      var actual = false;
      var drag = null;
      var dragged = false;
      media.classList.add("lb-media");
      media.setAttribute("draggable", "false");
      var button = h("button", { type: "button", class: "lb-image", "data-autofocus": "", "aria-pressed": "false", "aria-label": "Show actual size" }, media);
      var scroller = h("div", { class: "lb-scroller is-fit" }, button);
      function setActual(on) {
        actual = on;
        scroller.classList.toggle("is-fit", !on);
        scroller.classList.toggle("is-actual", on);
        button.setAttribute("aria-pressed", String(on));
        button.setAttribute("aria-label", on ? "Fit to screen" : "Show actual size");
        media.style.width = on ? img.width + "px" : "";
        media.style.height = on ? img.height + "px" : "";
      }
      button.addEventListener("click", function () { if (!dragged) setActual(!actual); });
      // Touch keeps native scrolling and pinch-zoom; only a mouse drags to pan.
      scroller.addEventListener("pointerdown", function (e) {
        dragged = false;
        if (!actual || e.pointerType !== "mouse" || e.button !== 0) return;
        drag = { x: e.clientX, y: e.clientY, left: scroller.scrollLeft, top: scroller.scrollTop };
      });
      scroller.addEventListener("pointermove", function (e) {
        if (!drag) return;
        var dx = e.clientX - drag.x;
        var dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) dragged = true;
        scroller.scrollLeft = drag.left - dx;
        scroller.scrollTop = drag.top - dy;
      });
      var end = function () { drag = null; };
      scroller.addEventListener("pointerup", end);
      scroller.addEventListener("pointerleave", end);
      scroller.addEventListener("click", function (e) { if (e.target === scroller && !dragged) close(); });
      stage.appendChild(scroller);
      return button;
    }

    function show(to) {
      if (to < 0 || to > images.length - 1) return;
      i = to;
      var img = images[i];
      title.textContent = img.caption;
      counter.textContent = i + 1 + " of " + images.length;
      prev.hidden = next.hidden = images.length < 2;
      prev.disabled = i === 0;
      next.disabled = i === images.length - 1;
      error("");
      SJ.dom.clear(actions);
      if (o.actions) actions.appendChild(o.actions(i, api));
      var focusable = drawStage(img);
      if (root.contains(document.activeElement) && !document.activeElement.isConnected) (focusable || root).focus();
    }

    /** After a delete: the next image, or the previous one when the last was removed; closes when none are left. */
    function setImages(list, at) {
      images = list;
      if (!images.length) return close();
      show(Math.min(at, images.length - 1));
      (stage.querySelector(".lb-image") || root).focus();
    }

    function onKey(e) {
      if (e.key === "Escape") { e.stopPropagation(); return close(); }
      if (e.key === "Tab") return SJ.overlay.trapTab(e, root);
      if (e.metaKey || e.ctrlKey || e.altKey || SJ.reflection.isTextEntry(e.target)) return;
      var to = e.key === "ArrowLeft" ? i - 1 : e.key === "ArrowRight" ? i + 1 : null;
      if (to === null) return;
      e.preventDefault();
      show(to);
    }

    var overflow = document.body.style.overflow;
    function close() {
      if (closed) return;
      closed = true;
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflow;
      SJ.overlay.exit(root);
      // A store change may have redrawn the page under the lightbox: find the opener again by its data-refocus.
      var back = opener && opener.isConnected ? opener : (openerRef && document.querySelector('[data-refocus="' + openerRef + '"]')) || (o.fallbackFocus && document.querySelector(o.fallbackFocus));
      if (back && back.focus) back.focus();
      if (o.onClose) o.onClose();
    }

    document.body.appendChild(root);
    document.body.style.overflow = "hidden";
    // Capture phase: the lightbox owns the keyboard while open (the page's review shortcuts never see these keys).
    document.addEventListener("keydown", onKey, true);
    show(i);
    (stage.querySelector("[data-autofocus]") || root).focus();
    return api;
  }

  /** Delete in two steps: the first press asks, the second deletes; reverts after 4 s or on any other click or key. */
  function confirmDelete(onConfirm) {
    var confirming = false;
    var timer = null;
    var button = ui.button({ label: "Delete", variant: "danger", size: "sm", icon: "trash-2" });
    var label = function (text) { button.lastChild.nodeType === 3 ? (button.lastChild.textContent = text) : button.appendChild(document.createTextNode(text)); };
    function reset() {
      confirming = false;
      clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey, true);
      label("Delete");
    }
    function onPointer(e) { if (!button.contains(e.target)) reset(); }
    function onKey(e) {
      if (!(e.target === button && (e.key === "Enter" || e.key === " ")) && e.key !== "Tab" && e.key !== "Shift") reset();
    }
    button.addEventListener("click", function () {
      if (!confirming) {
        confirming = true;
        label("Delete? Confirm");
        timer = setTimeout(reset, 4000);
        document.addEventListener("pointerdown", onPointer, true);
        document.addEventListener("keydown", onKey, true);
        return;
      }
      reset();
      onConfirm();
    });
    return button;
  }

  SJ.lightbox = { open: open, confirmDelete: confirmDelete };
})();
