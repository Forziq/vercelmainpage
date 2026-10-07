// Hand-written SVG charts in the app's chart theme (cumulative line/area, bars, histogram, horizontal bar list).
// The builders are pure: (data, options with a width) → SVG markup, so the same input always gives the same SVG.
// `render` mounts one in a figure, redraws it when the width changes and drives the tooltip (pointer and arrow keys).
(function () {
  var SJ = (window.SJ = window.SJ || {});

  // The app's chart colours (they mirror the :root tokens).
  var COLORS = {
    surface: "#111317", raised: "#171a1f", grid: "#22262d", baseline: "#343a46", axis: "#8b929c",
    fg: "#e6e8eb", profit: "#2fd07b", loss: "#f0525b", neutral: "#9aa3ae", warning: "#f2b84b",
  };
  var CHAR_W = 7.2; // JetBrains Mono at 12 px
  var MAX_BAR = 24;

  var pnlColor = function (v) { return v > 0 ? COLORS.profit : v < 0 ? COLORS.loss : COLORS.neutral; };
  var r2 = function (n) { return Math.round(n * 100) / 100; };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  };
  var solTick = function (v) { return v.toFixed(2); };
  var solTip = function (v) { return v.toFixed(4) + " SOL"; };
  /** `2026-03-14` → `14 Mar` (the app's chart day label). */
  var shortDay = function (day) {
    return new Date(day + "T00:00:00Z").toLocaleDateString("en-GB", { month: "short", day: "numeric", timeZone: "UTC" });
  };

  /** Round axis ticks around [min, max], always including 0. `integer` keeps steps whole (counts). */
  function niceTicks(min, max, count, integer) {
    var lo = Math.min(0, min);
    var hi = Math.max(0, max);
    if (hi === lo) hi = lo + 1;
    var raw = (hi - lo) / Math.max(1, (count || 5) - 1);
    var pow = Math.pow(10, Math.floor(Math.log10(raw)));
    var f = raw / pow;
    var step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
    if (integer) step = Math.max(1, Math.ceil(step));
    var start = Math.floor(lo / step) * step;
    var ticks = [];
    for (var v = start; v <= hi + step * 1e-9; v += step) ticks.push(Number(v.toFixed(10)));
    if (ticks[ticks.length - 1] < hi) ticks.push(Number((ticks[ticks.length - 1] + step).toFixed(10)));
    return ticks;
  }

  /** Every n-th category label so labels keep a 24 px gap (Recharts' minTickGap). */
  function labelEvery(labels, slot) {
    var widest = labels.reduce(function (m, l) { return Math.max(m, l.length); }, 0) * CHAR_W;
    return Math.max(1, Math.ceil((widest + 24) / Math.max(slot, 1)));
  }

  function text(x, y, value, anchor, extra) {
    return '<text x="' + r2(x) + '" y="' + r2(y) + '" text-anchor="' + anchor + '"' + (extra || "") + ">" + esc(value) + "</text>";
  }
  var line = function (x1, y1, x2, y2, color) {
    return '<line x1="' + r2(x1) + '" y1="' + r2(y1) + '" x2="' + r2(x2) + '" y2="' + r2(y2) + '" stroke="' + color + '" stroke-width="1"/>';
  };
  /** A hover/keyboard slot: the tooltip text rides on data attributes, the cursor shows while active. */
  function slot(i, tip, inner) {
    return '<g class="chart-slot" data-i="' + i + '" data-tip-label="' + esc(tip.label) + '" data-tip-name="' + esc(tip.name) + '" data-tip-value="' + esc(tip.value) + '">' + inner + "</g>";
  }
  function svg(width, height, body) {
    return '<svg class="chart" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + " " + height + '" aria-hidden="true" focusable="false">' + body + "</svg>";
  }

  /** Y axis + horizontal grid for a vertical-value chart. Returns { y(v), body, plot: {left, top, right, bottom} } */
  function valueFrame(values, o, bottomPad) {
    var ticks = niceTicks(Math.min.apply(null, values), Math.max.apply(null, values), 5, o.integer);
    var plot = { left: o.yWidth, top: 8, right: o.width - 8, bottom: o.height - bottomPad };
    var lo = ticks[0];
    var hi = ticks[ticks.length - 1];
    var y = function (v) { return plot.bottom - ((v - lo) / (hi - lo)) * (plot.bottom - plot.top); };
    var body = ticks.map(function (t) { return line(plot.left, y(t), plot.right, y(t), COLORS.grid); }).join("");
    body += ticks.map(function (t) { return text(plot.left - 6, y(t) + 4, (o.yFormat || solTick)(t), "end"); }).join("");
    body += line(plot.left, plot.top, plot.left, plot.bottom, COLORS.grid) + line(plot.left, plot.bottom, plot.right, plot.bottom, COLORS.grid);
    return { y: y, body: body, plot: plot };
  }

  function xLabels(labels, centres, slotW, plot, angle) {
    var every = angle ? 1 : labelEvery(labels, slotW);
    return labels.map(function (l, i) {
      if (i % every !== 0) return "";
      if (!angle) return text(centres[i], plot.bottom + 18, l, "middle");
      var x = r2(centres[i]);
      var y = r2(plot.bottom + 14);
      return text(x, y, l, "end", ' transform="rotate(' + angle + " " + x + " " + y + ')"');
    }).join("");
  }

  var defaults = function (o, extra) { return Object.assign({ width: 600, height: 240, yWidth: 56 }, extra, o); };

  /**
   * Cumulative line. data: [{ x (label), y (number) }]. o: { width, height, xFormat, yFormat, tipName, tipValue,
   * area (flat 8 % fill to zero), color (default: P&L colour of the last value) }
   */
  function lineChart(data, opts) {
    if (!data.length) return "";
    var o = defaults(opts, { tipName: "Net P&L", tipValue: solTip });
    var f = valueFrame(data.map(function (d) { return d.y; }), o, 28);
    var p = f.plot;
    var n = data.length;
    var step = n > 1 ? (p.right - p.left) / (n - 1) : 0;
    var xs = data.map(function (d, i) { return n > 1 ? p.left + i * step : (p.left + p.right) / 2; });
    var color = o.color || pnlColor(n ? data[n - 1].y : 0);
    var points = data.map(function (d, i) { return r2(xs[i]) + "," + r2(f.y(d.y)); });
    var body = f.body + line(p.left, f.y(0), p.right, f.y(0), COLORS.baseline);
    if (o.area && n > 1) {
      body += '<polygon points="' + r2(xs[0]) + "," + r2(f.y(0)) + " " + points.join(" ") + " " + r2(xs[n - 1]) + "," + r2(f.y(0)) + '" fill="' + color + '" fill-opacity="0.08"/>';
    }
    body += '<polyline class="chart-line" points="' + points.join(" ") + '" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-linejoin="round"/>';
    var labels = data.map(function (d) { return (o.xFormat || String)(d.x); });
    body += xLabels(labels, xs, step || p.right - p.left, p, 0);
    body += data.map(function (d, i) {
      var half = (step || p.right - p.left) / 2;
      return slot(i, { label: labels[i], name: o.tipName, value: o.tipValue(d.y) },
        '<rect x="' + r2(xs[i] - half) + '" y="' + p.top + '" width="' + r2(half * 2) + '" height="' + r2(p.bottom - p.top) + '" fill="transparent"/>' +
        '<g class="chart-cursor">' + line(xs[i], p.top, xs[i], p.bottom, COLORS.baseline) +
        '<circle cx="' + r2(xs[i]) + '" cy="' + r2(f.y(d.y)) + '" r="3" fill="' + color + '"/></g>');
    }).join("");
    return svg(o.width, o.height, body);
  }

  /**
   * Vertical bars. data: [{ x, y, color? }]. o: { colorMode ("pnl" | "neutral"), integer, angle (label rotation),
   * zeroLine (default on for P&L), xFormat, yFormat, tipName, tipValue, tipLabel }
   */
  function barChart(data, opts) {
    if (!data.length) return "";
    var o = defaults(opts, { colorMode: "pnl", tipName: "Net P&L", tipValue: solTip });
    var f = valueFrame(data.map(function (d) { return d.y; }), o, o.angle ? 56 : 28);
    var p = f.plot;
    var slotW = (p.right - p.left) / Math.max(1, data.length);
    var barW = Math.min(MAX_BAR, slotW * 0.8);
    var centres = data.map(function (d, i) { return p.left + slotW * (i + 0.5); });
    var labels = data.map(function (d) { return (o.xFormat || String)(d.x); });
    var body = f.body;
    if (o.zeroLine !== undefined ? o.zeroLine : o.colorMode === "pnl") body += line(p.left, f.y(0), p.right, f.y(0), COLORS.baseline);
    body += data.map(function (d, i) {
      var top = Math.min(f.y(d.y), f.y(0));
      var color = d.color || (o.colorMode === "pnl" ? pnlColor(d.y) : COLORS.neutral);
      return slot(i, { label: o.tipLabel ? o.tipLabel(d) : labels[i], name: o.tipName, value: o.tipValue(d.y) },
        '<rect class="chart-cursor" x="' + r2(p.left + slotW * i) + '" y="' + p.top + '" width="' + r2(slotW) + '" height="' + r2(p.bottom - p.top) + '" fill="#ffffff" fill-opacity="0.03"/>' +
        '<rect x="' + r2(p.left + slotW * i) + '" y="' + p.top + '" width="' + r2(slotW) + '" height="' + r2(p.bottom - p.top) + '" fill="transparent"/>' +
        '<rect class="chart-bar" x="' + r2(centres[i] - barW / 2) + '" y="' + r2(top) + '" width="' + r2(barW) + '" height="' + r2(Math.abs(f.y(d.y) - f.y(0))) + '" fill="' + color + '"/>');
    }).join("");
    body += xLabels(labels, centres, slotW, p, o.angle || 0);
    return svg(o.width, o.height, body);
  }

  /** ROI distribution: bins [{ label, count, sign }] as count bars coloured by the bin's sign, labels at −35°. */
  function histogram(bins, opts) {
    var data = bins.map(function (b) { return { x: b.label, y: b.count, color: pnlColor(b.sign) }; });
    return barChart(data, Object.assign({ integer: true, angle: -35, yWidth: 32, zeroLine: false, tipName: "Trades", tipValue: String, yFormat: String }, opts));
  }

  /**
   * Horizontal P&L bars per named group. rows: [{ label, value, enough (false draws neutral: thin data) }].
   * Height grows with the rows like the app (max(120, rows × 32 + 24)).
   */
  function barList(rows, opts) {
    if (!rows.length) return "";
    var o = Object.assign({ width: 600, labelWidth: 140, tipName: "Net P&L", tipValue: solTip }, opts);
    var height = o.height || Math.max(120, rows.length * 32 + 24);
    var ticks = niceTicks(Math.min.apply(null, rows.map(function (r) { return r.value; })), Math.max.apply(null, rows.map(function (r) { return r.value; })), 5);
    var p = { left: o.labelWidth, top: 4, right: o.width - 12, bottom: height - 24 };
    var lo = ticks[0];
    var hi = ticks[ticks.length - 1];
    var x = function (v) { return p.left + ((v - lo) / (hi - lo)) * (p.right - p.left); };
    var slotH = (p.bottom - p.top) / Math.max(1, rows.length);
    var barH = Math.min(MAX_BAR, slotH * 0.8);
    var maxChars = Math.floor((o.labelWidth - 8) / CHAR_W);
    var every = labelEvery(ticks.map(solTick), (p.right - p.left) / Math.max(1, ticks.length - 1));
    var body = ticks.map(function (t, i) { return line(x(t), p.top, x(t), p.bottom, COLORS.grid) + (i % every === 0 ? text(x(t), p.bottom + 16, solTick(t), "middle") : ""); }).join("");
    body += line(p.left, p.bottom, p.right, p.bottom, COLORS.grid) + line(x(0), p.top, x(0), p.bottom, COLORS.baseline);
    body += rows.map(function (r, i) {
      var cy = p.top + slotH * (i + 0.5);
      var label = r.label.length > maxChars ? r.label.slice(0, maxChars - 1) + "…" : r.label;
      var color = r.enough === false ? COLORS.neutral : pnlColor(r.value);
      return slot(i, { label: r.label, name: o.tipName, value: o.tipValue(r.value) },
        '<rect class="chart-cursor" x="' + p.left + '" y="' + r2(p.top + slotH * i) + '" width="' + r2(p.right - p.left) + '" height="' + r2(slotH) + '" fill="#ffffff" fill-opacity="0.03"/>' +
        '<rect x="0" y="' + r2(p.top + slotH * i) + '" width="' + r2(p.right) + '" height="' + r2(slotH) + '" fill="transparent"/>' +
        text(p.left - 8, cy + 4, label, "end") +
        '<rect class="chart-bar" x="' + r2(Math.min(x(r.value), x(0))) + '" y="' + r2(cy - barH / 2) + '" width="' + r2(Math.abs(x(r.value) - x(0))) + '" height="' + r2(barH) + '" fill="' + color + '"/>');
    }).join("");
    return svg(o.width, height, body);
  }

  var BUILDERS = { line: lineChart, bars: barChart, histogram: histogram, barList: barList };

  /**
   * Mounts a chart: a figure (role img, `label` as its name) that redraws at its own width and shows the tooltip
   * on pointer hover or with the arrow keys once focused. Empty data shows `empty` instead.
   * o: { label, empty, height, ...builder options }
   */
  function render(kind, data, o) {
    var h = SJ.dom.h;
    if (!data.length) return h("p", { class: "chart-empty text-body-sm text-muted", text: o.empty || "No data in this range." });
    var tip = h("div", { class: "chart-tooltip", hidden: true });
    var holder = h("div", { class: "chart-holder" });
    var fig = h("figure", { class: "chart-figure", role: "img", "aria-label": o.label, tabindex: "0" }, holder, tip);
    var width = 0;
    var active = -1;

    function draw() {
      var w = Math.floor(fig.clientWidth) || 600;
      if (w === width) return;
      width = w;
      holder.innerHTML = BUILDERS[kind](data, Object.assign({}, o, { width: w }));
      show(active);
    }
    function slots() { return holder.querySelectorAll(".chart-slot"); }
    function show(i) {
      var all = slots();
      Array.prototype.forEach.call(all, function (s) { s.classList.remove("is-active"); });
      active = i;
      if (i < 0 || !all[i]) return (tip.hidden = true);
      var s = all[i];
      s.classList.add("is-active");
      SJ.dom.clear(tip).appendChild(h("p", { class: "chart-tooltip-label", text: s.getAttribute("data-tip-label") }));
      tip.appendChild(h("p", null, s.getAttribute("data-tip-name") + " : " + s.getAttribute("data-tip-value")));
      tip.hidden = false;
      var box = s.getBBox();
      var x = box.x + box.width / 2 + 12;
      if (x + tip.offsetWidth > width) x = Math.max(0, box.x + box.width / 2 - tip.offsetWidth - 12);
      tip.style.transform = "translate(" + Math.round(x) + "px, " + Math.round(box.y) + "px)";
    }

    holder.addEventListener("pointermove", function (e) {
      var s = e.target.closest && e.target.closest(".chart-slot");
      if (s) show(Number(s.getAttribute("data-i")));
    });
    fig.addEventListener("pointerleave", function () { show(-1); });
    fig.addEventListener("blur", function () { show(-1); });
    fig.addEventListener("keydown", function (e) {
      var last = data.length - 1;
      var next = e.key === "ArrowRight" || e.key === "ArrowDown" ? Math.min(last, active + 1) : e.key === "ArrowLeft" || e.key === "ArrowUp" ? Math.max(0, active - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : e.key === "Escape" ? -1 : null;
      if (next === null) return;
      e.preventDefault();
      show(next);
    });
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(draw).observe(fig);
    requestAnimationFrame(draw);
    return fig;
  }

  SJ.charts = Object.assign(SJ.charts || {}, {
    COLORS: COLORS, pnlColor: pnlColor, niceTicks: niceTicks, shortDay: shortDay, esc: esc,
    line: lineChart, bars: barChart, histogram: histogram, barList: barList, render: render,
  });
})();
