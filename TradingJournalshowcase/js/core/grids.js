// CSS-grid charts: the weekday × two-hour heatmap and the calendar month grid, with the app's tint rules
// (five opacity steps per colour, hatching for thin cells). Classes live in css/charts.css.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var cx = SJ.dom.cx;

  // ---- Heatmap

  var DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var BLOCKS = 12;
  /** Cells with fewer trades are hatched and dimmed. */
  var MIN_N = 3;
  var blockLabel = function (b) { return String(b * 2).padStart(2, "0") + "–" + String(b * 2 + 2).padStart(2, "0"); };
  var step = function (fraction) { return Math.min(4, Math.max(0, Math.ceil(fraction * 5) - 1)); };

  /** cell: { n, netPnl (SOL number), winRate (0–1 | null), avgScore (0–4 | null) } */
  function heatValue(cell, metric) {
    if (metric === "pnl") return cell.n > 0 ? cell.netPnl : null;
    return metric === "winRate" ? cell.winRate : cell.avgScore;
  }

  /** Tint class: P&L diverges around 0 (scaled to the largest |P&L|), win rate around 50 %, grade 0–4 is neutral. */
  function heatTint(v, metric, maxAbsPnl) {
    if (v === null || v === undefined) return "hm-empty";
    if (metric === "score") return "hm-n" + step(v / 4);
    var centred = metric === "pnl" ? v / (maxAbsPnl || 1) : (v - 0.5) * 2;
    if (centred === 0) return "hm-n0";
    return (centred > 0 ? "hm-p" : "hm-l") + step(Math.abs(centred));
  }

  function heatText(cell, metric) {
    var v = heatValue(cell, metric);
    if (v === null || v === undefined) return "";
    if (metric === "pnl") return (v > 0 ? "+" : "") + v.toFixed(2);
    return metric === "winRate" ? Math.round(v * 100) + "%" : v.toFixed(1);
  }

  function heatLabel(day, block, cell) {
    var win = cell.winRate === null ? "—" : (cell.winRate * 100).toFixed(1) + "%";
    var pnl = (cell.netPnl > 0 ? "+" : "") + cell.netPnl.toFixed(4) + " SOL";
    return day + " " + blockLabel(block) + " · n=" + cell.n + " · win rate " + win + " · net " + pnl + (cell.n < MIN_N ? " · not enough data" : "");
  }

  /** matrix[day][block] of cells → the grid (scrolls sideways below 640 px). metric: pnl | winRate | score */
  function heatmap(matrix, metric) {
    var maxAbs = matrix.reduce(function (m, row) {
      return row.reduce(function (mm, c) { return Math.max(mm, Math.abs(c.netPnl)); }, m);
    }, 0);
    var head = h("div", { role: "row", class: "hm-row" }, h("span", { role: "columnheader", class: "hm-corner" }),
      Array.apply(null, Array(BLOCKS)).map(function (_, b) { return h("span", { role: "columnheader", class: "hm-head", text: blockLabel(b) }); }));
    var rows = matrix.map(function (row, d) {
      return h("div", { role: "row", class: "hm-row" }, h("span", { role: "rowheader", class: "hm-head hm-day", text: DAYS[d] }),
        row.map(function (cell, b) {
          var thin = cell.n > 0 && cell.n < MIN_N;
          var label = heatLabel(DAYS[d], b, cell);
          return h("span", { role: "cell", title: cell.n > 0 ? label : null, class: cx("hm-cell", thin ? "is-thin" : heatTint(heatValue(cell, metric), metric, maxAbs)) },
            cell.n > 0 && h("span", { class: "sr-only", text: label }), h("span", { "aria-hidden": "true", text: thin ? "" : heatText(cell, metric) }));
        }));
    });
    return h("div", { class: "hm-scroll" }, h("div", { role: "table", "aria-label": "Trades by weekday and two-hour block", class: "hm-grid" }, head, rows));
  }

  // ---- Calendar

  var WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var DAY_MS = 86400000;
  var toDay = function (ms) { return new Date(ms).toISOString().slice(0, 10); };
  var dayMs = function (day) { return Date.parse(day + "T00:00:00Z"); };
  var weekdayOf = function (day) { return ((new Date(dayMs(day)).getUTCDay() + 6) % 7) + 1; }; // 1 = Mon … 7 = Sun
  var absBig = function (v) { return v < 0n ? -v : v; };

  /** 0–4 tint step for |net P&L| relative to the largest |net P&L| of the month. */
  function intensityStep(netPnl, maxAbs) {
    if (maxAbs === 0n || netPnl === 0n) return 0;
    return Math.min(4, Math.max(0, Math.ceil((Number(absBig(netPnl)) / Number(maxAbs)) * 5) - 1));
  }

  /**
   * Monday-first month grid with padding days (no stats). days: { "yyyy-MM-dd": { netPnl (BigInt), entered } },
   * reviewed: array of reviewed days. Same shape as the app's buildMonth (weeks only).
   */
  function buildMonth(month, days, reviewed) {
    var first = month + "-01";
    var last = toDay(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0));
    var start = dayMs(first) - (weekdayOf(first) - 1) * DAY_MS;
    var end = dayMs(last) + (7 - weekdayOf(last)) * DAY_MS;
    var maxAbs = Object.keys(days).filter(function (d) { return d.indexOf(month) === 0; }).reduce(function (m, d) {
      return absBig(days[d].netPnl) > m ? absBig(days[d].netPnl) : m;
    }, 0n);
    var weeks = [];
    for (var t = start; t <= end; t += 7 * DAY_MS) {
      var cells = [];
      for (var i = 0; i < 7; i++) {
        var day = toDay(t + i * DAY_MS);
        var own = day.indexOf(month) === 0;
        var raw = own ? days[day] : null;
        var stats = raw ? { netPnl: raw.netPnl, entered: raw.entered, kind: raw.netPnl > 0n ? "profit" : raw.netPnl < 0n ? "loss" : "breakeven" } : null;
        cells.push({ day: day, inMonth: own, stats: stats, step: stats ? intensityStep(stats.netPnl, maxAbs) : 0, reviewed: own && reviewed.indexOf(day) >= 0 });
      }
      var active = cells.filter(function (c) { return c.stats; });
      weeks.push({ cells: cells, netPnl: SJ.format.sum(active, function (c) { return c.stats.netPnl; }), active: active.length > 0 });
    }
    return { month: month, weeks: weeks };
  }

  var dayLabel = function (day) {
    return new Date(day + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  };
  var shortDate = function (day) { return new Date(day + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }); };
  var weekRange = function (cells) {
    var own = cells.filter(function (c) { return c.inMonth; });
    return shortDate(own[0].day) + " – " + shortDate(own[own.length - 1].day);
  };
  var tintOf = function (c) { return c.stats ? "cal-" + c.stats.kind + " cal-" + c.stats.kind + "-" + c.step : null; };

  function cellLabel(c) {
    var parts = [dayLabel(c.day)];
    if (c.stats) parts.push(SJ.format.sol(c.stats.netPnl, { signed: true }) + " SOL", c.stats.kind, c.stats.entered + " trades");
    else parts.push("no trading");
    if (c.reviewed) parts.push("reviewed");
    return parts.join(", ");
  }

  /** A day as a link (o.href) or a button (o.onSelect). */
  function dayControl(c, o, className, label, children) {
    var attrs = { class: className, "aria-label": label, "aria-current": c.day === o.selectedDay ? "date" : null };
    if (o.href) return h("a", Object.assign(attrs, { href: o.href(c.day) }), children);
    return h("button", Object.assign(attrs, { type: "button", onclick: function () { if (o.onSelect) o.onSelect(c.day); } }), children);
  }

  function gridCell(c, o) {
    var n = Number(c.day.slice(8));
    if (!c.inMonth) return h("div", { "aria-hidden": "true", class: "cal-cell cal-pad", text: String(n) });
    var s = c.stats;
    return dayControl(c, o, cx("cal-cell", tintOf(c)), cellLabel(c), [
      h("span", { class: "cal-cell-top" }, h("span", { class: c.day === o.today ? "cal-today" : "text-muted", text: String(n) }), c.reviewed && h("span", { class: "dot dot-accent", "aria-hidden": "true" })),
      s ? SJ.ui.pnl(s.netPnl, { unit: "", className: "cal-truncate" }) : null,
      h("span", { class: "cal-cell-foot text-muted", text: s ? s.entered + (s.entered === 1 ? " trade" : " trades") : "—" }),
    ]);
  }

  /** Month grid (≥ 768 px) with week totals, and a week list of active days on phones. o: { selectedDay, today, href | onSelect } */
  function calendar(month, opts) {
    var o = opts || {};
    var grid = h("div", { role: "table", "aria-label": "Month", class: "cal-grid" },
      h("div", { role: "row", class: "cal-row" }, WEEKDAYS.map(function (d) { return h("div", { role: "columnheader", class: "cal-weekday text-label-sm", text: d }); })),
      month.weeks.map(function (w) {
        return h("div", { role: "row", class: "cal-row" }, w.cells.map(function (c) { return h("div", { role: "cell", class: "cal-slot" }, gridCell(c, o)); }));
      }));
    var totals = h("ul", { "aria-label": "Week totals", class: "cal-totals" }, month.weeks.map(function (w) {
      return h("li", null, h("span", { text: weekRange(w.cells) + ":" }), w.active ? SJ.ui.pnl(w.netPnl, { unit: "", className: "text-data-xs" }) : h("span", { class: "text-data-xs", text: "—" }));
    }));
    var list = h("div", { class: "cal-weeks" }, month.weeks.map(function (w) {
      var days = w.cells.filter(function (c) { return c.inMonth && (c.stats || c.reviewed); });
      return h("section", { "aria-label": "Week " + weekRange(w.cells) },
        h("h3", { class: "cal-week-head text-label-sm" }, h("span", { text: weekRange(w.cells) }), w.active && SJ.ui.pnl(w.netPnl, { unit: "", className: "text-data-xs" })),
        days.length === 0
          ? h("p", { class: "cal-none text-body-sm", text: "No trading" })
          : h("ul", { class: "cal-day-list" }, days.map(function (c) {
            return h("li", null, dayControl(c, o, cx("cal-day", tintOf(c)), cellLabel(c), [
              h("span", { class: "cal-day-name text-body-md", text: dayLabel(c.day) }),
              c.reviewed && h("span", { class: "dot dot-accent", "aria-hidden": "true" }),
              h("span", { class: "cal-day-side" }, c.stats && h("span", { class: "text-data-xs text-muted", text: c.stats.entered + "×" }),
                c.stats ? SJ.ui.pnl(c.stats.netPnl, { unit: "", className: "text-data-md" }) : h("span", { class: "text-muted", text: "—" })),
            ]));
          })));
    }));
    return h("div", { class: "calendar" }, h("div", { class: "cal-desktop" }, grid, totals), list);
  }

  SJ.charts = Object.assign(SJ.charts || {}, {
    HEATMAP_DAYS: DAYS, HEATMAP_BLOCKS: BLOCKS, HEATMAP_MIN_N: MIN_N, blockLabel: blockLabel,
    heatTint: heatTint, heatText: heatText, heatmap: heatmap,
    intensityStep: intensityStep, buildMonth: buildMonth, calendar: calendar,
  });
})();
