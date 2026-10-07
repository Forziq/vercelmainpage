// Token page (#/tokens/<mint>, app/(app)/tokens/[mint]): the combined result of every position in one token across
// all of the owner's wallets, and a timeline of those positions with re-entry links, grades, takeaways and tags.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var f = SJ.format;
  var L = SJ.tradeList;
  var A = SJ.explain.anchor;
  var SHORT = "MMM d, HH:mm";

  var plural = function (n, word) { return n + " " + word + (n === 1 ? "" : "s"); };

  /** tokenTotals: decided positions only for P&L (null when none is decided); EUR null if any decided figure lacks a rate. */
  function totals(list) {
    var decided = list.filter(function (t) { return t.outcome !== null; });
    var count = function (o) { return decided.filter(function (t) { return t.outcome === o; }).length; };
    return {
      positions: list.length, open: list.filter(function (t) { return t.status === "open"; }).length,
      wins: count("win"), losses: count("loss"), breakevens: count("breakeven"),
      solIn: f.sum(list, function (t) { return t.solIn; }), fees: f.sum(list, function (t) { return t.feesTotal; }),
      netPnl: decided.length ? f.sum(decided, function (t) { return t.netPnl; }) : null,
      eurNetPnl: decided.length ? SJ.fiat.sum(decided.map(SJ.fiat.pnlOf)) : null,
    };
  }

  function stat(label, children) {
    return h("div", { class: "dl-item" }, h("dt", { class: "text-label-sm text-muted uppercase", text: label }), h("dd", null, children));
  }

  function header(mint, token, tot, tz) {
    var ticker = token ? "$" + token.symbol : "Unknown token";
    var record = [tot.wins + "W", tot.losses + "L"].concat(tot.breakevens > 0 ? [tot.breakevens + "BE"] : []).join(" / ");
    return ui.card({ labelledby: "token-title", padding: "lg" }, [
      h("div", { class: "detail-head" },
        ui.tokenAvatar({ symbol: token ? token.symbol : null, size: "lg" }),
        h("div", { class: "detail-title" },
          h("div", { class: "detail-title-row" }, h("h1", { id: "token-title", tabindex: "-1", text: ticker }), h("span", { class: "text-body-md text-muted", text: token ? token.name : "Name unknown" })),
          A(h("div", null, ui.address({ value: mint, label: "mint", explorer: function () {
            SJ.overlay.toast({ title: "Block explorer", body: "In the live app this opens the token on a public block explorer. Every address in this demo is invented." });
          } })), "token-mint"),
          h("p", { class: "text-body-sm text-muted", text: token && token.createdAt ? "Created " + f.localTime(token.createdAt, tz, SHORT) : "Creation time unknown" }))),
      A(h("dl", { class: "stat-dl" },
        stat("Combined net P&L", h("span", null,
          ui.pnlValue({ value: tot.netPnl === null ? f.DASH : f.sol(tot.netPnl, { signed: true }), sign: tot.netPnl === null ? null : f.signOf(tot.netPnl), className: "text-data-lg" }),
          ui.fiatSub(SJ.fiat.label(tot.eurNetPnl, true), ui.toneOf(SJ.fiat.sign(tot.eurNetPnl))))),
        stat("Positions", h("span", null, String(tot.positions), tot.open > 0 && h("span", { class: "block text-body-sm text-muted", text: tot.open + " open" }))),
        stat("Record", record),
        stat("SOL in", ui.solText(f.sol(tot.solIn) + " SOL")),
        stat("Fees", ui.solText(f.sol(tot.fees, { decimals: 6 }) + " SOL"))), "token-combined"),
    ]);
  }

  function result(t) {
    var be = t.outcome === "breakeven";
    var eur = SJ.fiat.pnlOf(t);
    var cell = function (label, value) { return h("div", { class: "dl-item" }, h("dt", { class: "text-label-sm text-muted uppercase", text: label }), h("dd", null, value)); };
    return h("dl", { class: "timeline-result" },
      // Open positions have no final P&L yet, so they show "—" rather than a breakeven.
      cell("Net P&L", h("span", null, ui.pnlValue({ value: f.sol(t.netPnl, { signed: true }), sign: t.outcome ? f.signOf(t.netPnl) : null, neutral: be }),
        ui.fiatSub(SJ.fiat.label(eur, true), be ? "neutral" : ui.toneOf(SJ.fiat.sign(eur))))),
      cell("ROI", ui.pnlValue({ value: f.pct(t.roi), sign: SJ.tradeTable.roiSign(t), unit: "", neutral: be })),
      cell("Held", t.status === "open" ? "Open" : f.duration(t.holdingSeconds)));
  }

  /** One row per position, oldest first, numbered so a re-entry can point back at the position it followed. */
  function timeline(list, multiWallet, tz) {
    var number = {};
    list.forEach(function (t, i) { number[t.key] = i + 1; });
    var tagNames = {};
    SJ.store.vocab("tags", { includeArchived: true }).forEach(function (v) { tagNames[v.id] = v; });
    var marked = { reentry: false, takeaway: false };
    return A(h("ol", { class: "timeline" }, list.map(function (t, i) {
      var r = t.reflection || {};
      var previous = t.reentryOf ? number[t.reentryOf] : undefined;
      var wallet = SJ.store.wallets().filter(function (w) { return w.id === t.walletId; })[0];
      var reentry = t.reentryOf && h("p", { class: "text-body-sm text-muted" }, "Re-entry of ",
        previous ? h("a", { class: "link-under", href: L.tradeHref(t.reentryOf), text: "#" + previous }) : "an earlier position");
      if (reentry && !marked.reentry) { marked.reentry = true; A(reentry, "token-reentry"); }
      var lesson = r.lesson && r.lesson.trim() && h("blockquote", { class: "takeaway text-body-md" }, h("span", { class: "sr-only", text: "Takeaway: " }), r.lesson.trim());
      var tags = (r.tagIds || []).map(function (id) { return tagNames[id]; }).filter(Boolean);
      var notes = (lesson || tags.length) && h("div", { class: "timeline-notes" }, lesson,
        tags.length > 0 && h("ul", { class: "tag-row", "aria-label": "Tags" }, tags.map(function (g) { return h("li", null, ui.tag({ label: g.name, kind: g.polarity === "mistake" ? "mistake" : "strength" })); })));
      if (notes && !marked.takeaway) { marked.takeaway = true; A(notes, "token-takeaway"); }
      return h("li", { "aria-label": "Position " + (i + 1) },
        h("div", { class: "timeline-rail", "aria-hidden": "true" }, h("span", { class: SJ.dom.cx("timeline-dot", t.outcome && "is-" + t.outcome) }), i < list.length - 1 && h("span", { class: "timeline-line" })),
        h("div", { class: "timeline-body" },
          h("div", { class: "timeline-meta" },
            h("span", { class: "font-mono text-data-sm text-muted", text: "#" + (i + 1) }),
            h("span", { class: "font-mono text-data-sm text-fg", text: f.localTime(t.openedAt, tz, SHORT) }),
            t.outcome ? ui.outcomeBadge(t.outcome) : ui.badge(L.STATUS[t.status]),
            t.outcome && t.status !== "closed" && ui.badge(L.STATUS[t.status]),
            ui.gradeBadge(r.grade || null),
            r.reviewedAt ? ui.statusDot("Reviewed", "profit") : t.status !== "open" && ui.statusDot("Needs review", "warning"),
            multiWallet && wallet && ui.badge(f.shortAddress(wallet.address), null, "Wallet " + wallet.address)),
          reentry,
          h("div", { class: "timeline-foot" }, result(t), h("a", { class: "btn btn-secondary btn-sm", href: L.tradeHref(t.key) }, "Open trade", h("span", { class: "sr-only", text: " #" + (i + 1) }))),
          notes));
    })), "token-timeline");
  }

  function render(params) {
    SJ.router.watch(SJ.router.refresh);
    var token = SJ.store.token(params.mint);
    var list = SJ.store.trades({ allWallets: true }).filter(function (t) { return t.mint === params.mint; }).sort(SJ.metrics.byEntry);
    // A mint the owner never traded is not found, like the app's not-found view.
    if (!list.length) return SJ.router.notFound("tokens/" + params.mint);
    var tz = SJ.store.settings().timeZone;
    var wallets = {};
    list.forEach(function (t) { wallets[t.walletId] = true; });
    return h("div", { class: "page page-tight" },
      h("nav", { class: "breadcrumbs", "aria-label": "Breadcrumb" }, h("a", { href: "#/trades" }, SJ.dom.icon("arrow-left"), "Back to Trades"),
        h("span", { "aria-hidden": "true", text: "·" }), h("span", { text: "Tokens" }), h("span", { "aria-hidden": "true", text: "/" }), h("span", { class: "text-fg", text: token ? "$" + token.symbol : "Unknown token" })),
      header(params.mint, token, totals(list), tz),
      ui.card({ labelledby: "timeline-title", padding: "lg" }, [
        ui.cardHeader({ id: "timeline-title", title: "Your positions", meta: plural(list.length, "position") + ", oldest first" }),
        timeline(list, Object.keys(wallets).length > 1, tz)]));
  }

  SJ.screens = SJ.screens || {};
  SJ.screens.token = { render: render, totals: totals };
})();
