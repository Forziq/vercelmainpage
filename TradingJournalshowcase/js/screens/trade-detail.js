// Trade detail (#/trades/<key>, app/(app)/trades/[key]): header with key metrics and the correction actions,
// execution metrics, fees & rent, flags, re-entries and the linked events, then the quick review with the full
// reflection, the Coach panel and screenshots (review-form.js, coach-panel.js, screenshots.js). Corrections live in
// trade-corrections.js.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var f = SJ.format;
  var L = SJ.tradeList;
  var A = SJ.explain.anchor;
  var TIME = "MMM d, HH:mm:ss";
  var KIND_TONE = { BUY: "profit", SELL: "loss", FAILED_SWAP: "warning", UNSUPPORTED: "warning" };
  var KIND_LABEL = { FAILED_SWAP: "FAILED", RENT_RECLAIM: "RENT" };
  var ROLE_LABEL = { fill: "Fill", failed: "Failed attempt", rent_paid: "Rent paid", rent_refund: "Rent refund" };
  var FLAGS = {
    oversold: ["Sold more than was bought"], zero_cost_basis: ["Opened by a sell with no recorded buy (zero cost basis)"],
    zero_cost_in: ["Tokens received at zero cost", "tokens"], zero_cost_sale: ["Sold tokens that were received at zero cost"],
    transferred: ["Tokens transferred out", "tokens"], transferred_basis: ["Cost basis transferred out", "lamports"],
    dust_carried_in: ["Dust carried in from the previous position", "tokens"], dust_written_off: ["Dust basis written off", "lamports"],
    written_off_basis: ["Basis written off", "lamports"], sold_after_close: ["Dust sold after the position closed"],
    split_from: ["Split from position", "keys"], merged: ["Merged positions", "keys"],
  };

  var sol6 = function (v) { return f.sol(v, { decimals: 6 }) + " SOL"; };
  var keyLabel = function (key) { return f.shortAddress(key.split(":")[2] || key, 6); };
  var eventFees = function (e) { return SJ.store.eventFees(e); };
  var explorerNote = function () {
    SJ.overlay.toast({ title: "Block explorer", body: "In the live app this opens the token on a public block explorer. Every address in this demo is invented." });
  };

  /** dt/dd pair; a string value ending in " SOL" gets the SOL mark. */
  function item(label, value, sub) {
    return h("div", { class: "dl-item" },
      h("dt", { class: "text-label-sm text-muted uppercase", text: label }),
      h("dd", null, typeof value === "string" ? ui.solText(value) : value),
      sub && h("dd", { class: "dl-sub" }, sub));
  }
  var metricCard = function (id, title, meta, items) {
    return ui.card({ labelledby: id, padding: "lg" }, [ui.cardHeader({ id: id, title: title, meta: meta }), h("dl", { class: "metric-dl" }, items)]);
  };

  /** Average price in SOL per whole token: lamports ÷ raw quantity, scaled by the token's decimals. */
  function avgPrice(lamports, qtyRaw, decimals) {
    if (qtyRaw === 0n || decimals === null) return null;
    return (Number(lamports) / 1e9) / (Number(qtyRaw) / Math.pow(10, decimals));
  }

  function breadcrumbs(ticker) {
    return h("nav", { class: "breadcrumbs", "aria-label": "Breadcrumb" },
      h("a", { href: "#/trades" }, SJ.dom.icon("arrow-left"), "Back to Trades"),
      h("span", { "aria-hidden": "true", text: "·" }), h("span", { text: "Trades" }), h("span", { "aria-hidden": "true", text: "/" }), h("span", { class: "text-fg", text: ticker }));
  }

  function header(t, token, eur, rebate, tz) {
    var ticker = t.symbol ? "$" + t.symbol : "Unknown token";
    var be = t.outcome === "breakeven";
    var r = t.reflection;
    return ui.card({ labelledby: "trade-title", padding: "lg" }, [
      h("div", { class: "detail-head" },
        ui.tokenAvatar({ symbol: t.symbol, outcome: t.outcome, size: "lg" }),
        h("div", { class: "detail-title" },
          h("div", { class: "detail-title-row" },
            h("h1", { id: "trade-title", tabindex: "-1" }, h("a", { class: "link-quiet", href: L.tokenHref(t.mint) }, ticker, h("span", { class: "sr-only", text: " (token page)" }))),
            token && token.name && h("span", { class: "text-body-md text-muted", text: token.name }),
            t.outcome ? ui.outcomeBadge(t.outcome) : ui.badge(L.STATUS[t.status]),
            t.outcome && t.status !== "closed" && ui.badge(L.STATUS[t.status]),
            t.entryVenue && ui.badge(L.VENUE[t.entryVenue])),
          ui.address({ value: t.mint, label: "mint", explorer: explorerNote })),
        h("div", { class: "detail-status" }, r && r.reviewedAt ? ui.statusDot("Reviewed " + f.localTime(r.reviewedAt, tz, "MMM d, HH:mm"), "profit") : ui.statusDot("Not reviewed", t.status === "open" ? null : "warning"))),
      h("div", { class: "detail-actions" }, SJ.tradeCorrections.menu(t, tz)),
      A(h("dl", { class: "stat-dl" },
        item("Net P&L", h("span", null,
          ui.pnlValue({ value: f.sol(t.netPnl, { signed: true }), sign: f.signOf(t.netPnl), neutral: be, className: "text-data-lg" }),
          ui.fiatSub(SJ.fiat.label(eur.netPnl, true), be ? "neutral" : ui.toneOf(SJ.fiat.sign(eur.netPnl)))),
          rebate > 0n ? f.sol(t.netPnl + rebate, { signed: true }) + " after rebate" : null),
        item("ROI", ui.pnlValue({ value: f.pct(t.roi, 2), sign: SJ.tradeTable.roiSign(t), unit: "", neutral: be })),
        item("Execution", ui.gradeBadge(r ? r.grade || null : null)),
        item("Held", t.status === "open" ? "Open" : f.duration(t.holdingSeconds)),
        item("SOL in", h("span", null, ui.solText(sol6(t.solIn)), ui.fiatSub(SJ.fiat.label(eur.solIn))))), "td-metrics"),
    ]);
  }

  function execution(t, token, eur, tz) {
    var dec = t.decimals;
    var eurOf = function (v) { return ui.fiatSub(SJ.fiat.label(v)); };
    return A(metricCard("exec-title", "Execution", t.entryVenue ? L.VENUE[t.entryVenue] : null, [
      item("Entry MC", f.marketCap(t.entryMcSol)), item("Exit MC", f.marketCap(t.exitMcSol)),
      item("Token age @ entry", f.duration(t.tokenAgeAtEntrySeconds), "Created " + f.localTime(token ? token.createdAt : null, tz, "MMM d, HH:mm")),
      item("Avg entry price", f.price(avgPrice(t.solIn, t.qtyBoughtRaw, dec)), t.buyCount + " buy" + (t.buyCount === 1 ? "" : "s")),
      item("Avg exit price", f.price(avgPrice(t.solOut, t.qtySoldRaw, dec)), t.sellCount + " sell" + (t.sellCount === 1 ? "" : "s") + ", " + t.failedCount + " failed"),
      item("Peak capital", sol6(t.peakCapital)),
      item("SOL in", h("span", null, ui.solText(sol6(t.solIn)), eurOf(eur.solIn))), item("SOL out", h("span", null, ui.solText(sol6(t.solOut)), eurOf(eur.solOut))),
      item("Gross P&L", ui.pnlValue({ value: f.sol(t.grossPnl, { signed: true, decimals: 6 }), sign: f.signOf(t.grossPnl), neutral: t.outcome === "breakeven" })),
      item("Tokens bought", f.tokenQty(t.qtyBoughtRaw, dec)), item("Tokens sold", f.tokenQty(t.qtySoldRaw, dec)),
      item("Tokens held", f.tokenQty(t.qtyHeldRaw, dec), "Basis " + sol6(t.basisRemaining)),
      item("Opened (" + SJ.tradeTable.zoneLabel(tz) + ")", f.localTime(t.openedAt, tz, TIME)), item("Closed", f.localTime(t.closedAt, tz, TIME)),
      item("Status", L.STATUS[t.status]),
    ]), "td-execution");
  }

  function fees(t, eur, rebate) {
    var rows = [["Network base fee", t.feeNetwork], ["Priority fee", t.feePriority], ["Tip", t.feeTip], ["Platform fee", t.feePlatform],
      ["Failed attempts", t.feeFailed], ["Rent paid", t.rentPaid], ["Rent refunded", t.rentRefunded], ["Cashback rebate (not a fee)", rebate]];
    return A(ui.card({ labelledby: "fees-title", padding: "lg" }, [ui.cardHeader({ id: "fees-title", title: "Fees & rent" }),
      h("dl", { class: "fee-rows" },
        rows.map(function (r) { return h("div", null, h("dt", { class: "text-body-md text-fg", text: r[0] }), h("dd", null, ui.solText(sol6(r[1])))); }),
        h("div", { class: "is-total" }, h("dt", { class: "text-body-md text-fg", text: "Total fees" }), h("dd", null, ui.solText(sol6(t.feesTotal)), ui.fiatSub(SJ.fiat.label(eur.fees)))))]), "td-fees");
  }

  function flags(t) {
    var names = Object.keys(t.flags);
    if (!names.length) return null;
    return ui.card({ labelledby: "flags-title" }, [ui.cardHeader({ id: "flags-title", title: "Flags", size: "label", meta: String(names.length) }),
      h("ul", { class: "flag-list" }, names.map(function (name) {
        var def = FLAGS[name] || [name];
        var raw = t.flags[name];
        var keys = def[1] === "keys" ? [].concat(raw) : [];
        var value = def[1] === "lamports" ? sol6(BigInt(raw)) : def[1] === "tokens" ? f.tokenQty(BigInt(raw), t.decimals) : null;
        return h("li", null, h("span", { class: "text-body-md text-warning", text: def[0] }),
          value && ui.solText(value, "font-mono text-data-sm text-fg"),
          keys.map(function (k) { return h("a", { class: "font-mono text-data-xs link-under", href: L.tradeHref(k), text: keyLabel(k) }); }),
          h("span", { class: "flag-name font-mono text-data-xs text-muted", text: name }));
      }))]);
  }

  function reentries(t, tz) {
    var previous = t.reentryOf ? SJ.store.trade(t.reentryOf) : null;
    var next = SJ.store.trades({ walletId: t.walletId }).filter(function (x) { return x.reentryOf === t.key; });
    if (!previous && !next.length) return null;
    return A(ui.card({ labelledby: "reentry-title" }, [ui.cardHeader({ id: "reentry-title", title: "Re-entries", size: "label" }),
      h("ul", { class: "plain-list text-body-md" },
        previous && h("li", null, "Re-entry of ", h("a", { class: "link-under", href: L.tradeHref(previous.key), text: "the position opened " + f.localTime(previous.openedAt, tz, "MMM d, HH:mm") })),
        next.map(function (n) { return h("li", null, "Re-entered ", h("a", { class: "link-under", href: L.tradeHref(n.key), text: f.localTime(n.openedAt, tz, "MMM d, HH:mm") })); }))]), "td-reentry");
  }

  function kind(e) {
    return h("span", { class: "trade-token" }, ui.badge(KIND_LABEL[e.kind] || e.kind, KIND_TONE[e.kind]), e.role !== "fill" && h("span", { class: "text-body-sm text-muted", text: ROLE_LABEL[e.role] }));
  }
  function rent(e) {
    var parts = [e.rentPaid > 0n ? "-" + f.sol(e.rentPaid, { decimals: 6 }) : null, e.rentRefunded > 0n ? f.sol(e.rentRefunded, { decimals: 6, signed: true }) : null].filter(Boolean);
    return parts.length ? parts.join(" ") : f.DASH;
  }
  var tokens = function (e) { return e.tokenAmountRaw === null || e.tokenAmountRaw === 0n ? f.DASH : f.tokenQty(e.tokenAmountRaw, e.tokenDecimals); };
  var feeText = function (e) { return eventFees(e) === 0n ? f.DASH : f.sol(eventFees(e), { decimals: 6 }); };
  var swap = function (e) { return e.swapSol === 0n ? f.DASH : f.sol(e.swapSol, { signed: true }); };
  var tx = function (e) { return h("span", { class: "font-mono text-data-xs text-muted", title: "In the live app this links to the block explorer", text: f.shortAddress(e.signature) }); };

  /** Every event linked to the position, in chain order; fees are the event's four fee parts, rent paid (−) and refunded (+). */
  function events(t, tz) {
    var list = SJ.store.positionEvents(t.key);
    return A(h("section", { class: "detail-col", "aria-labelledby": "events-title" },
      h("div", { class: "section-head" }, h("h2", { id: "events-title", class: "text-headline-md", text: "Events" }),
        h("span", { class: "font-mono text-data-xs text-muted", text: t.buyCount + t.sellCount + " fills, " + t.failedCount + " failed" })),
      ui.dataTable({
        caption: "Linked events", rows: list, rowKey: function (e) { return String(e.id); }, highlight: function (e) { return e.kind === "FAILED_SWAP"; },
        empty: h("p", { class: "text-body-sm text-muted", text: "No linked events." }),
        columns: [
          { key: "time", header: "Time (" + SJ.tradeTable.zoneLabel(tz) + ")", cell: function (e) { return h("span", { class: "font-mono text-data-sm", text: f.localTime(e.blockTime, tz, TIME) }); } },
          { key: "kind", header: "Type", cell: kind }, { key: "tokens", header: "Tokens", numeric: true, cell: tokens },
          { key: "sol", header: "Swap SOL", numeric: true, cell: swap }, { key: "fees", header: "Fees", numeric: true, cell: feeText },
          { key: "rent", header: "Rent", numeric: true, cell: rent },
          { key: "venue", header: "Venue", cell: function (e) { return h("span", { class: "text-body-sm text-muted", text: L.VENUE[e.venue] }); } },
          { key: "tx", header: "Signature", cell: tx },
        ],
        mobileCard: function (e) {
          return h("div", { class: "trade-card" },
            h("div", { class: "trade-card-row" }, kind(e), h("span", { class: "font-mono text-data-xs text-muted", text: f.localTime(e.blockTime, tz, TIME) })),
            h("div", { class: "trade-card-row font-mono text-data-sm text-fg" }, h("span", { text: tokens(e) }), ui.solText(e.swapSol === 0n ? f.DASH : swap(e) + " SOL")),
            h("div", { class: "trade-card-row font-mono text-data-xs text-muted" }, h("span", { text: "Fees " + feeText(e) }), tx(e)));
        },
      })), "td-events");
  }

  function notFound(key) {
    return h("div", { class: "page" }, breadcrumbs("Not found"),
      ui.emptyState({ icon: "search-x", title: "This trade does not exist (any more)", body: "A correction may have merged or removed it. Position key " + key + ".", action: h("a", { class: "btn btn-secondary", href: "#/trades", text: "Back to Trades" }) }));
  }

  function render(params) {
    var t = SJ.store.trade(params.key);
    SJ.router.watch(SJ.router.refresh);
    if (!t) return notFound(params.key);
    var tz = SJ.store.settings().timeZone;
    var token = SJ.store.token(t.mint);
    var eur = SJ.fiat.position(t);
    var rebate = SJ.store.rebateOf(t.key);
    var events_ = SJ.store.positionEvents(t.key).length;
    return h("div", { class: "page page-tight" },
      breadcrumbs(t.symbol ? "$" + t.symbol : "Unknown token"),
      header(t, token, eur, rebate, tz),
      h("div", { class: "detail-grid" },
        h("div", { class: "detail-col" }, execution(t, token, eur, tz), fees(t, eur, rebate), flags(t), reentries(t, tz), events(t, tz)),
        h("div", { class: "detail-col" }, A(SJ.reviewForm.render({ trade: t, full: true }), "rf-review"), SJ.coachPanel.render(t), SJ.screenshots.render(t), SJ.tradeCorrections.list(t, tz))),
      A(h("p", { class: "key-line font-mono text-data-xs text-muted" }, "Position key ", h("span", { text: t.key }), " · rebuilt in this browser from " + events_ + " linked events"), "td-key"));
  }

  SJ.screens = SJ.screens || {};
  SJ.screens["trade-detail"] = { render: render };
})();
