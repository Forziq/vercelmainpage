// Reflection Inbox (#/inbox, app/(app)/inbox): closed positions without a review, oldest first, one card at a time
// with the quick review under it. Save & next, Skip, J/K and the Merge and Void corrections, as in the app. The
// current card is tracked by key; after a save it leaves the list and the next card takes its place.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var f = SJ.format;
  var L = SJ.tradeList;
  var S = SJ.store;
  var A = SJ.explain.anchor;
  var flow = { key: null, index: 0, moved: false, shown: null, undo: null };

  var plural = function (n, word) { return n + " " + word + (n === 1 ? "" : "s"); };

  function card(t, tz, entering, actions) {
    var be = t.outcome === "breakeven";
    var sol = function (v, dp) { return ui.solText(f.sol(v, dp ? { decimals: dp } : undefined) + " SOL"); };
    var facts = [["SOL in", sol(t.solIn)], ["SOL out", sol(t.solOut)], ["Fees", sol(t.feesTotal, 6)], ["Venue", t.entryVenue ? L.VENUE[t.entryVenue] : f.DASH]];
    var token = S.token(t.mint);
    return ui.card({ labelledby: "card-title", padding: "lg", className: SJ.dom.cx("inbox-card", entering && "card-enter") }, [
      h("div", { class: "inbox-card-head" },
        ui.tokenAvatar({ symbol: t.symbol, outcome: t.outcome, size: "lg" }),
        h("div", { class: "inbox-card-title" },
          A(h("h2", { id: "card-title", class: "text-headline-md text-fg" }, t.symbol ? "$" + t.symbol : "Unknown token", t.status === "closed" ? ui.outcomeBadge(t.outcome) : ui.badge(L.STATUS[t.status])), "ib-outcome"),
          h("p", { class: "font-mono text-data-xs text-muted" }, token && token.name && h("span", { class: "text-body-sm", text: token.name + " · " }), f.shortAddress(t.mint) + " · closed " + f.localTime(t.closedAt, tz, "MMM d, HH:mm"))),
        ui.badge("Hold " + f.duration(t.holdingSeconds))),
      h("div", { class: "inbox-card-numbers" },
        h("div", { class: "inbox-stat" }, h("span", { class: "text-label-sm text-muted uppercase", text: "Net realised P&L" }),
          h("span", { class: "inbox-pnl" }, ui.pnlValue({ value: f.sol(t.netPnl, { signed: true }), sign: f.signOf(t.netPnl), neutral: be, className: "text-headline-lg" }),
            ui.pnlValue({ value: f.pct(t.roi, 1), sign: SJ.tradeTable.roiSign(t), unit: "", neutral: be, className: "text-data-sm" }))),
        h("div", { class: "inbox-stat is-end" }, h("span", { class: "text-label-sm text-muted uppercase", text: "Market cap shift" }),
          h("span", { class: "font-mono text-data-md text-fg" }, ui.solText(f.marketCap(t.entryMcSol)), " → ", ui.solText(f.marketCap(t.exitMcSol))))),
      h("dl", { class: "inbox-facts" }, facts.map(function (x) {
        return h("div", null, h("dt", { class: "text-label-sm text-muted uppercase", text: x[0] }), h("dd", { class: "font-mono text-data-sm text-fg" }, x[1]));
      })),
      h("div", { class: "inbox-card-foot text-body-sm text-muted" },
        h("span", { class: "font-mono text-data-xs", text: plural(t.buyCount, "buy") + " / " + plural(t.sellCount, "sell") }),
        A(actions, "ib-corrections"),
        h("a", { class: "inbox-link", href: L.tradeHref(t.key) }, "Full trade", SJ.dom.icon("arrow-right"))),
    ]);
  }

  function render() {
    SJ.router.watch(SJ.router.refresh);
    // Reset demo starts the queue again from its first card.
    if (flow.data !== S.data()) flow = { data: S.data(), key: null, index: 0, moved: false, shown: null, undo: null };
    var cards = S.inbox();
    var tz = S.settings().timeZone;
    var total = cards.length;
    var found = cards.map(function (c) { return c.key; }).indexOf(flow.key);
    var index = found >= 0 ? found : Math.max(0, Math.min(flow.index, total - 1));
    var t = cards[index];
    var header = h("header", { class: "page-header" }, h("div", { class: "inbox-title" },
      h("h1", { class: "text-headline-lg", tabindex: "-1", text: "Reflection Inbox" }), total > 0 && ui.badge(total + " to review", "accent")));
    var undo = flow.undo && h("p", { role: "status", class: "inbox-undo text-body-sm" }, flow.undo.text,
      ui.button({ label: "Undo", size: "sm", variant: "ghost", attrs: { "data-refocus": "inbox-undo" }, onclick: function () {
        var id = flow.undo.id;
        flow.undo = null;
        try { SJ.actions.undoCorrection(id); } catch (e) { SJ.overlay.toast({ title: "Undo", body: e.message, tone: "error" }); }
      } }));
    if (!t) {
      flow.shown = null;
      return h("div", { class: "page inbox" }, header, undo, ui.emptyState({ icon: "check-check", title: "Nothing to review", body: "Every closed trade has a review. New trades appear here once they close.",
        action: h("a", { class: "btn btn-secondary", href: "#/trades", text: "Browse all trades" }) }));
    }

    // Only a different card plays the enter animation (a redraw of the same card must not replay it).
    var entering = flow.moved && flow.shown !== t.key && !SJ.overlay.reducedMotion();
    flow.shown = t.key;
    var move = function (key, i) {
      flow.undo = null;
      flow.moved = flow.moved || (key || (cards[0] && cards[0].key)) !== t.key;
      flow.key = key;
      flow.index = i;
      SJ.router.refresh();
    };
    var go = function (i) { move(cards[i] ? cards[i].key : null, i); };
    var position = index + 1;
    var pct = Math.round((position / Math.max(total, 1)) * 100);
    var actions = SJ.tradeCorrections.menu(t, tz, ["merge", "void"], function (row) {
      flow.undo = { id: row.id, text: (row.type === "VOID" ? "Voided " : "Merged ") + (t.symbol ? "$" + t.symbol : "the trade") + ". " };
      SJ.router.refresh();
    });
    nav = {
      skip: function () { go(index + 1 < total ? index + 1 : 0); },
      next: function () { go(Math.min(index + 1, total - 1)); },
      prev: function () { go(Math.max(index - 1, 0)); },
    };

    var form = SJ.reviewForm.render({
      trade: t, submitLabel: "Save & next", enterSaves: true,
      extra: ui.button({ label: "Skip", kbd: "S", onclick: nav.skip, attrs: { "data-refocus": "inbox-skip" } }),
      // After a save the card leaves the list; the next one takes its index, and the last one wraps to the first.
      onSaved: function () { if (index + 1 < total) move(cards[index + 1].key, index); else move(null, 0); },
    });

    return h("div", { class: "page inbox" }, header, undo,
      A(h("div", { class: "inbox-progress" },
        ui.progress({ label: "Review progress", value: (position / Math.max(total, 1)) * 100 }),
        h("span", { class: "font-mono text-data-xs text-muted", text: position + " of " + total + " (" + pct + "%)" }),
        h("div", { class: "btn-row" },
          ui.iconButton({ label: "Previous trade (K)", icon: "chevron-left", variant: "secondary", disabled: index === 0, onclick: nav.prev, attrs: { "data-refocus": "inbox-prev" } }),
          ui.iconButton({ label: "Next trade (J)", icon: "chevron-right", variant: "secondary", disabled: index === total - 1, onclick: nav.next, attrs: { "data-refocus": "inbox-next" } }))), "ib-progress"),
      card(t, tz, entering, actions),
      A(form, "ib-review"),
      A(h("p", { class: "inbox-keys hide-sm font-mono text-data-xs text-muted", text: "1–5 grade · Enter save & next · S skip · J / K next / previous" }), "ib-keys"));
  }

  // S, J and K while the Inbox is on screen (1–5 and Enter belong to the review form).
  var nav = null;
  document.addEventListener("keydown", function (e) {
    if (!nav || !document.querySelector(".inbox-progress")) return;
    var action = SJ.reflection.keyAction(e);
    if (!action || !nav[action.type]) return;
    e.preventDefault();
    nav[action.type]();
  });

  SJ.screens = SJ.screens || {};
  SJ.screens.inbox = { render: render, state: function () { return flow; } };
})();
