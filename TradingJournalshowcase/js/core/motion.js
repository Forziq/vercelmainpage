// Motion helpers (UI rules §7), the vanilla twins of the app's useReducedMotion, Ticker (lib/format/ticker.ts),
// useSlidingMarker, the heatmap's revealDelay and useChangeFlash. CSS does the animating; these only decide when.
(function () {
  var SJ = (window.SJ = window.SJ || {});

  /** First-load count-up (--duration-slower) and the recount after a range change. */
  var COUNT_UP_MS = 600;
  var RECOUNT_MS = 300;
  /** Dashboard card entrance stagger, per card. */
  var ENTER_STAGGER_MS = 40;
  /** Chart draw-in window (--duration-slower); later data appears at once. */
  var DRAW_IN_MS = 600;
  /** The heatmap's diagonal sweep is spread over at most this; with the 200 ms fade it ends within 600 ms. */
  var REVEAL_SPREAD_MS = 400;
  /** How long a re-rendered control may take over its predecessor's marker position, so it still slides. */
  var CARRY_MS = 500;

  function reduced() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  // ---- Ticker (port of lib/format/ticker.ts: display only, the last frame is exactly the formatted string)

  var NUMBER = /^([^\d+-]*)([+-]?)(\d+)(?:\.(\d+))?(\D*)$/;

  /** Splits `+1.2345`, `55.0`, `12.5%` or `3 trades` into its parts; null when the text is not one plain number. */
  function parseTicker(text) {
    var m = NUMBER.exec(text);
    if (!m) return null;
    var value = Number((m[2] || "") + m[3] + (m[4] ? "." + m[4] : ""));
    if (!isFinite(value)) return null;
    return { prefix: m[1] || "", value: value, decimals: m[4] ? m[4].length : 0, signed: m[2] === "+", suffix: m[5] || "" };
  }

  /** The same curve as the `--ease-out` token, cubic-bezier(0.25, 1, 0.5, 1) (an ease-out quart). */
  var easeOut = function (t) { return 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 4); };

  /** The text at `progress` (0–1, eased) of a count from `from` (null or not numeric: 0) to `to`. */
  function tickerFrame(from, to, progress) {
    var target = parseTicker(to);
    if (!target || progress >= 1) return to;
    var source = from === null ? null : parseTicker(from);
    var start = source ? source.value : 0;
    var current = start + (target.value - start) * Math.max(progress, 0);
    var text = Math.abs(current).toFixed(target.decimals);
    // Like formatSol: no sign on a frame that rounds to zero, never `-0.0000`.
    var sign = /^0(\.0*)?$/.test(text) ? "" : current < 0 ? "-" : target.signed || (source && source.signed) ? "+" : "";
    return target.prefix + sign + text + target.suffix;
  }

  /**
   * A count-up of `text`. o: { from (the previous value; null counts from 0 over COUNT_UP_MS), delay }. A value that
   * is not one plain number, an unchanged value or reduced motion gives the plain text. Screen readers read the final
   * value from the start; an invisible copy keeps the width at the final one, so the unit never moves.
   */
  function ticker(text, o) {
    var from = o && o.from !== undefined ? o.from : null;
    var h = SJ.dom.h;
    if (reduced() || parseTicker(text) === null || from === text) return h("span", { text: text });
    var frame = h("span", { class: "ticker-frame", "aria-hidden": "true", text: tickerFrame(from, text, 0) });
    var duration = from === null ? COUNT_UP_MS : RECOUNT_MS;
    var wait = from === null ? (o && o.delay) || 0 : 0;
    var start = null;
    function draw(now) {
      if (start === null) start = now;
      var t = (now - start - wait) / duration;
      frame.textContent = tickerFrame(from, text, t >= 1 ? 1 : easeOut(t));
      if (t < 1) requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
    return h("span", { class: "ticker" }, h("span", { class: "sr-only", text: text }), h("span", { class: "ticker-final", "aria-hidden": "true", text: text }), frame);
  }

  // ---- Sliding marker (useSlidingMarker)

  var carried = {};

  /**
   * One marker in `container` that slides with `transform` to the item matching `selector`. o: { className, scale
   * (a 1 px bar scaled to the item's width: the tab underline), fixed (keeps its CSS size: the sidebar bar; otherwise
   * width and height follow the item at once), key (lets the control that replaces this one after a redraw slide on
   * from where this marker was) }. The first placement, resizes and reduced motion jump. Until it is measured the
   * container lacks `has-marker`, so the selected item keeps drawing its own background or bar.
   * Returns { update(animate), carry() (call before a navigation that re-renders the control), node }.
   */
  function slidingMarker(container, selector, o) {
    var marker = document.createElement("span");
    marker.className = "slide-marker" + (o.className ? " " + o.className : "");
    marker.setAttribute("aria-hidden", "true");
    container.insertBefore(marker, container.firstChild);
    var last = null;

    function measure() {
      var item = container.querySelector(selector);
      if (!item || !marker.isConnected) return null;
      var c = container.getBoundingClientRect();
      var r = item.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return {
        x: r.left - c.left - container.clientLeft + container.scrollLeft,
        y: r.top - c.top - container.clientTop + container.scrollTop,
        w: r.width,
        h: r.height,
      };
    }
    function apply(p) {
      var round = function (n) { return Math.round(n * 100) / 100; };
      marker.style.transform = o.scale ? "translateX(" + round(p.x) + "px) scaleX(" + round(p.w) + ")" : "translate(" + round(p.x) + "px, " + round(p.y) + "px)";
      if (!o.scale && !o.fixed) {
        marker.style.width = round(p.w) + "px";
        marker.style.height = round(p.h) + "px";
      }
    }
    function jump(p) {
      marker.classList.add("is-jump");
      apply(p);
      marker.getBoundingClientRect(); // commits the jump before the transition comes back
      marker.classList.remove("is-jump");
    }
    function update(animate) {
      var p = measure();
      if (!p) {
        container.classList.remove("has-marker");
        last = null;
        return;
      }
      // Nothing moved (a ResizeObserver's first call, the same item again): leave a running slide alone.
      if (last && p.x === last.x && p.y === last.y && p.w === last.w && p.h === last.h) return;
      var from = !last && o.key && carried[o.key] && Date.now() - carried[o.key].at < CARRY_MS ? carried[o.key].p : null;
      if (o.key) delete carried[o.key];
      if (from) jump(from);
      var slide = (animate || from) && (last || from) && !reduced();
      if (slide) {
        if (animate) carry();
        apply(p);
      } else jump(p);
      last = p;
      container.classList.add("has-marker");
    }
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(function () { update(false); }).observe(container);
    if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(function () { if (!last) update(false); });
    function carry() {
      if (o.key && last) carried[o.key] = { p: last, at: Date.now() };
    }
    return { update: update, carry: carry, node: marker };
  }

  // ---- Heatmap reveal

  /** Delay of a heatmap cell: a diagonal sweep by row + column, scaled so the last cell starts at REVEAL_SPREAD_MS. */
  function revealDelay(row, col, rows, cols) {
    var steps = rows + cols - 2;
    return steps > 0 ? Math.round(((row + col) / steps) * REVEAL_SPREAD_MS) : 0;
  }

  // ---- Change flash (useChangeFlash)

  var seen = {};

  /**
   * True when `value` of the surface `key` changed in the same render as a sync step that imported data. `mounted`
   * says the surface stayed on screen (a redraw); a fresh render (navigation), the first render, a range, filter or
   * sort change (the value changes, the import counter does not) and reduced motion never flash.
   */
  function changed(key, value, mounted) {
    var seq = SJ.sync ? SJ.sync.state().seq : 0;
    var prev = seen[key];
    seen[key] = { seq: seq, value: value };
    return !!prev && !!mounted && prev.seq !== seq && prev.value !== value && !reduced();
  }

  /** The neutral tint drawn behind a changed value; the host needs the `flash-host` class. */
  function flashTint() {
    return SJ.dom.h("span", { class: "change-flash", "aria-hidden": "true", "data-change-flash": "" });
  }

  SJ.motion = {
    COUNT_UP_MS: COUNT_UP_MS, RECOUNT_MS: RECOUNT_MS, ENTER_STAGGER_MS: ENTER_STAGGER_MS, DRAW_IN_MS: DRAW_IN_MS, REVEAL_SPREAD_MS: REVEAL_SPREAD_MS,
    reduced: reduced, parseTicker: parseTicker, easeOut: easeOut, tickerFrame: tickerFrame, ticker: ticker,
    slidingMarker: slidingMarker, revealDelay: revealDelay, changed: changed, flashTint: flashTint,
  };
})();
