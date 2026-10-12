// Strategies, Mistakes and Rules (app/(app)/{strategies,mistakes,rules}): the owner's own lists with their numbers.
// Stats come from reviewed, closed trades of the active wallet (all time); groups under 10 trades are greyed out.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var f = SJ.format;
  var S = SJ.store;
  var M = SJ.metrics;
  var G = SJ.groupTable;
  var A = SJ.explain.anchor;
  var E = SJ.vocabEditor;
  var SAMPLE_NOTE = "Closed, reviewed trades · groups with fewer than 10 are greyed out (not enough data).";
  var AUTO_LABEL = { MAX_TRADES_PER_SESSION: "Max trades per session", MAX_LOSS_PER_TRADE: "Max loss per trade", NO_ENTRY_AFTER_N_LOSSES: "No entry after N losses (same day)" };

  /** §6 group rows keyed by id: `idsOf(t)` gives the ids a reviewed, decided trade counts for. */
  function statsBy(trades, idsOf) {
    var out = {};
    SJ.analytics.groupBy(trades, function (t) { return idsOf(t).map(function (id) { return { key: id, label: "", order: 0 }; }); }, true)
      .forEach(function (r) { out[r.bucket.key] = r; });
    return out;
  }

  function header(title, description, actions, anchor) {
    return h("header", { class: "page-header" },
      h("div", null, h("h1", { class: "text-headline-lg", tabindex: "-1", text: title }), A(h("p", { class: "text-body-sm text-muted", text: description }), anchor)),
      h("div", { class: "btn-row" }, actions));
  }
  var newButton = function (label, kind, defaults) { return ui.button({ label: label, icon: "plus", variant: "primary", attrs: { "data-refocus": "new-" + label }, onclick: function () { E.open(kind, null, defaults); } }); };
  var editButton = function (kind, item) { return ui.iconButton({ label: "Edit " + item.name, icon: "settings", attrs: { "data-refocus": "edit-" + item.id }, onclick: function () { E.open(kind, item); } }); };
  function nameCell(name, detail, archived) {
    return h("div", { class: "vocab-name" },
      h("span", { class: "vocab-name-row" }, h("span", { class: archived ? "text-muted" : "text-fg", text: name }), archived && ui.badge("Archived")),
      detail && h("span", { class: "text-body-sm text-muted", text: detail }));
  }

  function table(o) {
    return ui.dataTable({
      caption: o.caption, rows: o.rows, rowKey: function (r) { return r.id; },
      columns: [{ key: "name", header: o.noun, cell: function (r) { return nameCell(r.name, o.detail && o.detail(r), r.archived); } }]
        .concat(o.columns).concat([{ key: "edit", header: "", align: "right", cell: function (r) { return editButton(o.kind, r); } }]),
      mobileCard: function (r) {
        return h("div", { class: "vocab-card" }, h("div", { class: "vocab-card-head" }, nameCell(r.name, o.detail && o.detail(r), r.archived), editButton(o.kind, r)), o.mobile(r));
      },
      empty: ui.emptyState({ icon: o.icon, title: o.emptyTitle, body: o.emptyBody }),
    });
  }

  function strategies() {
    SJ.router.watch(SJ.router.refresh);
    var stats = statsBy(S.trades(), function (t) { return t.review.strategyId ? [t.review.strategyId] : []; });
    return h("div", { class: "page" },
      header("Strategies", SAMPLE_NOTE, newButton("New strategy", "strategies"), "vo-sample"),
      A(table({
        caption: "Strategies with statistics", noun: "Strategy", kind: "strategies", rows: S.vocab("strategies", { includeArchived: true }),
        detail: function (r) { return r.description; }, columns: G.columns(function (r) { return stats[r.id]; }), mobile: function (r) { return G.grid(stats[r.id]); },
        icon: "workflow", emptyTitle: "No strategies yet", emptyBody: "Create the setups you trade, then pick one on each review to compare them.",
      }), "vo-strategies"));
  }

  /** "FOMO: -1.8000 SOL this month, win rate 28% (n=14)", only from 10 reviewed, closed trades. */
  function tagSentence(name, row) {
    if (!row || !row.enoughData) return null;
    var win = row.summary.winRate === null ? "no wins or losses" : "win rate " + f.rate(row.summary.winRate, 0) + "%";
    return name + ": " + f.sol(row.summary.netPnl, { signed: true }) + " SOL this month, " + win + " (n=" + row.n + ")";
  }

  function mistakes() {
    SJ.router.watch(SJ.router.refresh);
    var s = S.settings();
    var today = M.tradingDay(S.now(), s.timeZone, s.dayStartHour);
    var since = M.tradingDayStart(today.slice(0, 7) + "-01", s.timeZone, s.dayStartHour);
    var tagIds = function (t) { return t.review.tagIds; };
    var all = statsBy(S.trades(), tagIds);
    var month = statsBy(S.trades({ from: since }), tagIds);
    var rows = S.vocab("tags", { includeArchived: true });
    var sentences = rows.map(function (t) { return { tag: t, text: t.archived ? null : tagSentence(t.name, month[t.id]) }; }).filter(function (x) { return x.text; });
    var tagTable = function (title, polarity) {
      return h("section", { class: "vocab-section", "aria-label": title },
        h("h2", { class: "text-headline-md", text: title + " · all time" }),
        table({
          caption: title + " with statistics", noun: title.slice(0, -1), kind: "tags", rows: rows.filter(function (t) { return t.polarity === polarity; }),
          columns: G.columns(function (r) { return all[r.id]; }), mobile: function (r) { return G.grid(all[r.id]); },
          icon: "alert-triangle", emptyTitle: "No " + title.toLowerCase() + " yet", emptyBody: "Create one here or while reviewing a trade.",
        }));
    };
    return h("div", { class: "page" },
      header("Mistakes", "Mistake and strength tags. " + SAMPLE_NOTE, [newButton("New strength", "tags", { polarity: "positive" }), newButton("New mistake", "tags", { polarity: "mistake" })], "vo-sample"),
      A(ui.card({ labelledby: "tags-month" }, [ui.cardHeader({ id: "tags-month", title: "This month", meta: "shown from 10 reviewed trades" }),
        sentences.length
          ? h("ul", { class: "vocab-sentences font-mono text-body-sm" }, sentences.map(function (x) { return h("li", { class: x.tag.polarity === "mistake" ? "text-fg" : "text-muted", text: x.text }); }))
          : h("p", { class: "text-body-sm text-muted", text: "No tag has 10 reviewed, closed trades this month yet." })]), "vo-month"),
      A(tagTable("Mistakes", "mistake"), "vo-tags"), tagTable("Strengths", "positive"));
  }

  function autoDetail(r) {
    if (!AUTO_LABEL[r.type]) return r.description || null;
    var value = r.type === "MAX_LOSS_PER_TRADE" ? (r.thresholdUnit === "pct" ? r.threshold + "% ROI" : r.threshold + " SOL") : r.threshold;
    return "Auto · " + AUTO_LABEL[r.type] + ": " + value;
  }

  function rules() {
    SJ.router.watch(SJ.router.refresh);
    var trades = S.trades();
    var sum = M.summarize(trades);
    var byRule = {};
    M.adherenceByRule(trades).forEach(function (a) { byRule[a.ruleId] = a; });
    var status = function (r) { return r.archived ? null : ui.badge(r.active === false ? "Inactive" : "Active"); };
    var adherence = function (r) {
      var a = byRule[r.id];
      if (!a) return h("span", { class: "font-mono text-muted", text: "No reviews" });
      return h("div", { class: "vocab-adherence" }, ui.progress({ label: "Followed", value: a.adherence * 100 }),
        h("span", { class: SJ.dom.cx("font-mono tabular", a.n < 10 && "text-muted") }, f.rate(a.adherence, 0) + "% ", h("span", { class: "text-muted", text: "(" + a.followed + "/" + a.n + ")" })));
    };
    var waiting = S.inbox().filter(function (t) { return SJ.reflection.suggestions(t).length > 0; }).length;
    return h("div", { class: "page" },
      header("Rules", "Adherence = reviewed trades with no broken rule ÷ reviewed trades. Automatic checks only suggest; you confirm on the review.", newButton("New rule", "rules"), "vo-adherence"),
      h("div", { class: "vocab-stats" },
        ui.statCard({ label: "Rule adherence", value: f.rate(sum.ruleAdherence), unit: sum.ruleAdherence === null ? null : "%", delta: sum.reviewed + " reviewed trade" + (sum.reviewed === 1 ? "" : "s") }),
        A(ui.card({ label: "Automatic checks", className: "vocab-auto" }, [
          h("p", { class: "text-label-sm text-muted uppercase", text: "Automatic checks" }),
          h("p", { class: "text-body-sm", text: waiting + " trade" + (waiting === 1 ? "" : "s") + " in the Inbox " + (waiting === 1 ? "has" : "have") + " a likely broken rule. The review form shows it with Mark broken and Dismiss; nothing changes until you choose." }),
          h("a", { class: "btn btn-secondary btn-sm", href: "#/inbox", text: "Open the Inbox" })]), "vo-auto")),
      A(table({
        caption: "Rules with adherence", noun: "Rule", kind: "rules", rows: S.vocab("rules", { includeArchived: true }), detail: autoDetail,
        columns: [{ key: "status", header: "Status", cell: status }, { key: "followed", header: "Followed", cell: adherence }],
        mobile: function (r) { return h("div", { class: "vocab-card-row" }, status(r), adherence(r)); },
        icon: "list-checks", emptyTitle: "No rules yet", emptyBody: "Write down the rules you trade by; each review checks them off.",
      }), "vo-rules"));
  }

  SJ.screens = SJ.screens || {};
  SJ.screens.strategies = { render: strategies };
  SJ.screens.mistakes = { render: mistakes };
  SJ.screens.rules = { render: rules };
  SJ.vocabStats = { statsBy: statsBy, tagSentence: tagSentence, autoDetail: autoDetail };
})();
