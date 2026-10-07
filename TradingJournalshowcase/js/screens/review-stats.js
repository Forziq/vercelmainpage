// The frozen snapshot sections of a weekly or monthly review (app/(app)/reviews/week-stats.tsx, month-stats.tsx):
// totals, best and worst trades, patterns, recurring mistakes (weeks), trade lessons and versus the previous month.
// Every figure is read from the stored snapshot strings, never recomputed here.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var f = SJ.format;
  var A = SJ.explain.anchor;

  var big = function (v) { return BigInt(v); };
  var rate = function (v) { return v === null ? f.DASH : f.rate(v, 0) + "%"; };
  var grade = function (v) { return v === null ? f.DASH : Number(v).toFixed(1) + " / 4"; };
  var title = function (id, text, description, meta) { return ui.cardHeader({ id: id, title: text, description: description, meta: meta }); };
  var monthTitle = function (start) { return new Date(start + "T00:00:00Z").toLocaleDateString("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }); };

  /** "+3" / "-0.4" / "0": a change already rounded to text, with a plus when positive and no minus on zero. */
  function signedText(text) {
    if (/^-?0(\.0*)?$/.test(text)) return text.replace("-", "");
    return text.charAt(0) === "-" ? text : "+" + text;
  }
  var signed = function (value, decimals) { return signedText(Number(value).toFixed(decimals)); };

  /** o: { stats, eur (null when unknown or out of date), period ("week" | "month") } */
  function totals(o) {
    var t = o.stats.totals;
    var eur = o.eur;
    var any = t.trades > 0;
    var fiat = function (units) { return any && eur ? ui.fiatSub(SJ.fiat.label(units, true), ui.toneOf(SJ.fiat.sign(units))) : null; };
    var stat = function (x) { return ui.statCard(Object.assign({ compact: true }, x)); };
    var fees6 = function (v) { return f.sol(big(v), { decimals: 6 }); };
    return A(ui.card({ label: o.period === "week" ? "Week totals" : "Month totals", padding: "none", className: "summary-strip summary-5" }, [
      stat({ label: "Net P&L", value: f.sol(big(t.netPnl), { signed: true }), unit: "SOL", tone: ui.toneOf(f.signOf(big(t.netPnl))), sub: fiat(eur && eur.netPnl) }),
      stat({ label: "Net after rebates", value: f.sol(big(t.netAfterRebates), { signed: true }), unit: "SOL", tone: ui.toneOf(f.signOf(big(t.netAfterRebates))), sub: fiat(eur && eur.netAfterRebates),
        delta: t.reclaimFees === undefined ? "Reclaim fees not recorded · Recalculate" : h("span", null, "+ cashback ", ui.solText(fees6(t.rebates) + " SOL"), " − reclaim fees ", ui.solText(fees6(t.reclaimFees) + " SOL")) }),
      stat({ label: "Win rate", value: rate(t.winRate), delta: any ? t.wins + "W · " + t.losses + "L · " + t.breakevens + "BE" : null }),
      stat({ label: "Trades", value: String(t.trades), delta: t.entered !== t.trades ? t.entered + " entered" : null }),
      stat({ label: "Fees", value: fees6(t.fees), unit: "SOL", sub: t.entered > 0 && eur ? ui.fiatSub(SJ.fiat.label(eur.fees)) : null }),
    ]), "rv-totals");
  }

  function tradeRow(label, t, empty) {
    return h("li", { class: "rv-trade" }, h("span", { class: "text-label-sm text-muted uppercase", text: label }),
      t ? h("span", { class: "rv-trade-row" },
        h("a", { class: "link-quiet text-body-md", href: SJ.tradeList.tradeHref(t.key), text: t.label }), ui.outcomeBadge(t.outcome), ui.gradeBadge(t.grade),
        h("span", { class: "rv-trade-side" }, t.roi !== null && h("span", { class: "font-mono text-data-xs text-muted", text: f.pct(t.roi) }),
          ui.pnlValue({ value: f.sol(big(t.netPnl), { signed: true }), sign: f.signOf(big(t.netPnl)), neutral: t.outcome === "breakeven", className: "text-data-xs" })))
        : h("span", { class: "text-body-sm text-muted", text: empty }));
  }

  function trades(stats) {
    var x = stats.trades;
    return ui.card({ labelledby: "rv-trades", padding: "lg" }, [title("rv-trades", "Best & worst trades", "Executed = by grade, ties broken by P&L"),
      h("ul", { class: "rv-trades" }, tradeRow("Best trade", x.best, "No closed trades"), tradeRow("Worst trade", x.worst, "No closed trades"),
        tradeRow("Best executed", x.bestExecuted, "No graded trades"), tradeRow("Worst executed", x.worstExecuted, "No graded trades"))]);
  }

  var fact = function (label, value) { return h("div", { class: "rv-fact" }, h("dt", { class: "text-label-sm text-muted uppercase", text: label }), h("dd", { class: "text-body-md text-fg" }, value)); };
  function strategy(s) {
    if (!s) return h("span", { class: "text-muted", text: "Not enough data" });
    return h("span", { class: "rv-inline" }, s.name, ui.pnl(big(s.netPnl), { className: "text-data-xs" }), h("span", { class: "font-mono text-data-xs text-muted", text: "n=" + s.n + " · win " + rate(s.winRate) }));
  }

  function patterns(stats) {
    var p = stats.patterns;
    var top = p.topMistake;
    return A(ui.card({ labelledby: "rv-patterns", padding: "lg" }, [title("rv-patterns", "Patterns", p.reviewed + " reviewed " + (p.reviewed === 1 ? "trade" : "trades")),
      h("dl", null,
        fact("Most common mistake", top ? h("span", { class: "rv-inline" }, top.name, h("span", { class: "font-mono text-data-xs text-muted", text: "×" + top.count }), ui.pnl(big(top.netPnl), { className: "text-data-xs" }))
          : h("span", { class: "text-muted", text: "None tagged" })),
        fact("Most profitable strategy", strategy(p.bestStrategy)),
        fact("Least profitable strategy", strategy(p.worstStrategy)),
        fact("Rule adherence", h("span", { class: "font-mono", text: rate(p.ruleAdherence) })),
        fact("Avg execution score", h("span", { class: "font-mono", text: grade(p.avgExecutionScore) })))]), "rv-patterns");
  }

  function recurring(stats) {
    return A(ui.card({ labelledby: "rv-recurring", padding: "lg" }, [title("rv-recurring", "Recurring patterns", "Mistakes tagged in 2 or more of the last 4 weeks"),
      stats.recurring.length === 0 ? h("p", { class: "text-body-sm text-muted", text: "No mistake came back across weeks." }) :
        h("ul", { class: "rv-recurring" }, stats.recurring.map(function (r) {
          return h("li", { class: "text-body-md text-fg" }, r.name, h("span", { class: "font-mono text-data-xs text-muted", text: r.weeks + " of 4 weeks" }));
        }))]), "rv-recurring");
  }

  function lessons(stats, period) {
    var list = stats.lessons;
    return ui.card({ labelledby: "rv-lessons", padding: "lg" }, [title("rv-lessons", "Trade lessons", null, String(list.length)),
      list.length === 0 ? h("p", { class: "text-body-sm text-muted", text: "No key takeaways on this " + period + "'s trades." }) :
        h("ul", { class: "lesson-list" }, list.map(function (l) {
          return h("li", { class: "lesson" }, h("span", { class: "lesson-head" }, h("a", { class: "link-quiet text-body-md", href: SJ.tradeList.tradeHref(l.key), text: l.label }), ui.gradeBadge(l.grade)),
            h("span", { class: "text-body-md text-fg pre-wrap", text: l.lesson }));
        }))]);
  }

  /** This month against the previous one (descriptive only). An empty previous month shows 0 trades and "—". */
  function comparison(stats) {
    var t = stats.totals;
    var prev = stats.previous;
    var change = stats.change;
    var pnl = function (v, n) { return ui.pnlValue({ value: f.sol(big(v), { signed: true }), sign: n > 0 ? f.signOf(big(v)) : null, className: "text-data-sm" }); };
    var row = function (label, cur, before, diff) {
      return h("tr", null, h("th", { scope: "row", class: "text-label-sm text-muted uppercase", text: label }),
        h("td", { class: "num text-fg" }, cur), h("td", { class: "num text-muted" }, before), h("td", { class: "num text-fg" }, diff));
    };
    return A(ui.card({ labelledby: "rv-versus", padding: "lg" }, [
      title("rv-versus", "Versus the previous month", prev.trades === 0 ? "No closed trades in " + monthTitle(prev.monthStart) : null),
      h("div", { class: "table-scroll" }, h("table", { class: "rv-compare font-mono text-data-sm" },
        h("thead", null, h("tr", { class: "text-label-sm text-muted uppercase" }, h("th", { scope: "col" }, h("span", { class: "sr-only", text: "Metric" })),
          h("th", { scope: "col", text: monthTitle(stats.monthStart) }), h("th", { scope: "col", text: monthTitle(prev.monthStart) }), h("th", { scope: "col", text: "Change" }))),
        h("tbody", null,
          row("Net P&L", pnl(t.netPnl, t.trades), pnl(prev.netPnl, prev.trades), ui.pnl(big(change.netPnl), { className: "text-data-sm" })),
          row("Win rate", rate(t.winRate), rate(prev.winRate), change.winRate === null ? f.DASH : signedText(f.rate(change.winRate, 0)) + " pp"),
          row("Trades", String(t.trades), String(prev.trades), signed(change.trades, 0)),
          row("Avg grade", grade(stats.patterns.avgExecutionScore), grade(prev.avgExecutionScore), change.avgExecutionScore === null ? f.DASH : signed(change.avgExecutionScore, 1)))))]), "rv-versus");
  }

  SJ.reviewStats = { totals: totals, trades: trades, patterns: patterns, recurring: recurring, lessons: lessons, comparison: comparison, signed: signed, monthTitle: monthTitle };
})();
