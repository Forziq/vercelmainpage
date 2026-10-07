// In-memory store for the demo (docs/showcase.md §6–§7): the generated rows, plus everything the app derives from them
// (positions, trading days, sessions, Inbox, health), recomputed after every write. Nothing is persisted; reset()
// or a reload restores the generated data.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var M = SJ.metrics;
  var RATED = { BUY: 1, SELL: 1, FAILED_SWAP: 1, SOL_IN: 1, RENT_RECLAIM: 1 };
  var RATE_SETTLED_MS = 65 * 60000;
  var state = null;
  var cache = null;
  var listeners = [];

  function clone(v) {
    if (Array.isArray(v)) return v.map(clone);
    if (v && typeof v === "object") {
      var out = {};
      Object.keys(v).forEach(function (k) { out[k] = clone(v[k]); });
      return out;
    }
    return v;
  }

  // data.js leaves zero and null event fields out to stay small; they are filled back in on load.
  var EVENT_DEFAULTS = {
    mint: null, tokenAccount: null, tokenAmountRaw: null, swapSol: 0n, networkBaseFee: 0n, priorityFee: 0n, tip: 0n,
    platformFee: 0n, rentPaid: 0n, rentRefunded: 0n, venue: "unknown", counterparty: null, eventIndex: 0,
  };
  function load() {
    var d = clone(window.DEMO);
    var decimals = {};
    d.tokens.forEach(function (t) { decimals[t.mint] = t.decimals; });
    d.events.forEach(function (e) {
      Object.keys(EVENT_DEFAULTS).forEach(function (k) { if (e[k] === undefined) e[k] = EVENT_DEFAULTS[k]; });
      e.tokenDecimals = e.tokenAmountRaw === null ? null : decimals[e.mint];
    });
    d.reflections.forEach(function (r) {
      var f = r.full || {};
      r.plannedTarget = { mc: f.plannedTargetMc || null, pct: f.plannedTargetPct || null };
      r.plannedStop = { mc: f.plannedStopMc || null, pct: f.plannedStopPct || null };
    });
    // coach.js marks each generated critique with the review it was made from (its "out of date" check).
    if (SJ.coach) SJ.coach.stamp(d);
    return d;
  }

  /** Loads the generated rows; critiques.js then stamps the day and period critiques, which needs the derived views. */
  function fresh() {
    state = load();
    cache = null;
    if (SJ.critiques) SJ.critiques.stamp(state);
  }
  function data() {
    if (!state) fresh();
    return state;
  }
  /** Drops derived views and tells subscribers (screens re-render on it). */
  function changed() {
    cache = null;
    listeners.slice().forEach(function (fn) { fn(); });
  }
  function reset() { writes = 0; fresh(); changed(); }
  function on(fn) {
    listeners.push(fn);
    return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
  }

  /** The demo's frozen clock: the snapshot time, nudged forward by each write so new rows keep their order. */
  var writes = 0;
  function now() { return new Date(Date.parse(data().meta.now) + writes * 1000); }
  function tick() { writes++; return now(); }

  var settings = function () { return data().settings; };
  var activeWallet = function () {
    return data().wallets.slice().sort(function (a, b) { return Date.parse(b.activatedAt) - Date.parse(a.activatedAt); })[0];
  };

  function decode(e) {
    var out = {};
    Object.keys(e).forEach(function (k) { out[k] = e[k]; });
    out.blockTime = new Date(e.blockTime);
    return out;
  }

  function reviewOf(r) {
    if (!r) return null;
    return {
      reviewed: !!r.reviewedAt, grade: r.grade, strategyId: r.strategyId, emotionId: r.emotionId, confidence: r.confidence,
      terminal: r.terminal, tagIds: r.tagIds, ruleResults: r.ruleResults, plannedTarget: r.plannedTarget, plannedStop: r.plannedStop,
    };
  }

  /** Engine run for one wallet with the given corrections (used by derive and by the correction preview). */
  function buildWallet(walletId, corrections) {
    var d = data();
    var tokens = {};
    d.tokens.forEach(function (t) { tokens[t.mint] = { supplyRaw: t.supplyRaw, createdAt: t.createdAt }; });
    var events = d.events.filter(function (e) { return e.walletId === walletId; }).map(decode);
    return SJ.engine.build(events, corrections, {
      walletId: walletId, breakevenPct: d.settings.breakevenPct, dustPct: d.settings.dustPct,
      dustSolLamports: d.settings.dustSolLamports, tokens: tokens,
    });
  }

  function derive() {
    if (cache) return cache;
    var d = data();
    var reflections = {};
    d.reflections.forEach(function (r) { reflections[r.positionKey] = r; });
    var symbols = {};
    d.tokens.forEach(function (t) { symbols[t.mint] = t.symbol; });
    var byKey = {};
    var aliases = {};
    var wallets = {};
    var linked = {};
    var all = [];
    d.wallets.forEach(function (w) {
      var res = buildWallet(w.id, d.corrections.filter(function (c) { return c.walletId === w.id; }));
      var trades = res.positions.map(function (p) {
        var t = Object.assign({}, p, { symbol: symbols[p.mint], label: "$" + symbols[p.mint], review: reviewOf(reflections[p.key]), reflection: reflections[p.key] || null });
        byKey[t.key] = t;
        aliases[t.key] = t;
        (t.flags.merged || []).forEach(function (k) { aliases[k] = t; });
        t.links.forEach(function (l) { linked[l.eventId] = true; });
        return t;
      });
      wallets[w.id] = { trades: trades, unlinkedRent: res.unlinkedRent, skipped: res.skippedCorrections, contexts: M.tradeContexts(trades, d.settings) };
      all = all.concat(trades);
    });
    var inbox = all.filter(function (t) { return t.status !== "open" && !(t.reflection && t.reflection.reviewedAt); }).sort(function (a, b) {
      return (a.closedAt || a.openedAt) - (b.closedAt || b.openedAt) || a.openedAt - b.openedAt || (a.key < b.key ? -1 : 1);
    });
    cache = { trades: all, byKey: byKey, aliases: aliases, wallets: wallets, linked: linked, inbox: inbox };
    return cache;
  }

  // ---- Reads

  function trades(opts) {
    var o = opts || {};
    var list = o.allWallets ? derive().trades : derive().wallets[o.walletId || activeWallet().id].trades;
    return list.filter(function (t) {
      return (!o.from || t.openedAt >= o.from) && (!o.to || t.openedAt < o.to);
    });
  }
  var trade = function (key) { return derive().byKey[key] || null; };
  var contexts = function (walletId) { return derive().wallets[walletId || activeWallet().id].contexts; };
  var inbox = function () { return derive().inbox; };
  var needsReview = function () { return derive().inbox.length; };

  /** Start of the range "last N trading days, today included" (`days` null = all history). */
  function rangeStart(days) {
    if (days === null) return null;
    var s = settings();
    var today = M.tradingDay(now(), s.timeZone, s.dayStartHour);
    return M.tradingDayStart(M.shiftDay(today, 1 - days), s.timeZone, s.dayStartHour);
  }

  /** A position's events with their role (fill, failed, rent_paid, rent_refund), in chain order. */
  function positionEvents(key) {
    var t = trade(key);
    if (!t) return [];
    var role = {};
    t.links.forEach(function (l) { role[l.eventId] = l.role; });
    return data().events.filter(function (e) { return role[e.id] !== undefined; }).map(function (e) {
      return Object.assign(decode(e), { role: role[e.id] });
    }).sort(SJ.engine.compareEvents);
  }

  function vocab(kind, opts) {
    var list = data().vocab[kind];
    return opts && opts.includeArchived ? list : list.filter(function (v) { return !v.archived; });
  }
  var names = function (kind, filter) {
    var out = {};
    data().vocab[kind].forEach(function (v) { if (!filter || filter(v)) out[v.id] = v.name; });
    return out;
  };

  function rate(at) {
    var key = new Date(at).toISOString().slice(0, 16);
    var r = data().rates[key];
    return r === undefined ? null : r;
  }

  var excludedIds = function () {
    var ids = {};
    data().corrections.forEach(function (c) { if (c.type === "EXCLUDE_EVENT") ids[c.payload.parsedEventId] = true; });
    return ids;
  };
  var eventFees = function (e) { return e.networkBaseFee + e.priorityFee + e.tip + e.platformFee; };

  /** Fees of RENT_RECLAIM events in [from, to): a wallet-level line, never part of a trade (wallet-sync.md §6). */
  function reclaimFees(walletId, from, to) {
    var excluded = excludedIds();
    return SJ.format.sum(data().events.filter(function (e) {
      var at = Date.parse(e.blockTime);
      return e.walletId === walletId && e.kind === "RENT_RECLAIM" && !excluded[e.id] && (!from || at >= from) && (!to || at < to);
    }), eventFees);
  }

  /** Cashback allocated to `key`, resolved through merges (an allocation keeps the key it was saved with). */
  function rebateOf(key) {
    var aliases = derive().aliases;
    return SJ.format.sum(data().allocations.filter(function (a) { var t = aliases[a.positionKey]; return t && t.key === key; }), function (a) { return a.lamports; });
  }

  /** Everything the period snapshot needs besides its trades (reflection-analytics.md §8). */
  function periodInput(walletId, from, to) {
    var period = trades({ walletId: walletId, from: from, to: to });
    var lessons = {};
    var labels = {};
    period.forEach(function (t) {
      labels[t.key] = t.label;
      if (t.reflection && t.reflection.lesson) lessons[t.key] = t.reflection.lesson;
    });
    return {
      rebates: SJ.format.sum(period, function (t) { return rebateOf(t.key); }), reclaimFees: reclaimFees(walletId, from, to),
      strategyNames: names("strategies"), mistakeNames: names("tags", function (v) { return v.polarity === "mistake"; }),
      labels: labels, lessons: lessons,
    };
  }

  /** Data-health counts across every wallet (lib/health.ts); `unreviewed` is the Inbox. */
  function health() {
    var d = data();
    var der = derive();
    var settled = now().getTime() - RATE_SETTLED_MS;
    var unlinkedIds = {};
    d.corrections.forEach(function (c) { if (c.type === "RENT_UNLINK") unlinkedIds[c.payload.parsedEventId] = true; });
    var labelled = {};
    d.counterparties.forEach(function (c) { labelled[c.walletId + ":" + c.address] = true; });
    var orphans = d.events.filter(function (e) { return e.kind === "FAILED_SWAP" && !der.linked[e.id]; });
    return {
      parseFailures: d.rawFailures.length,
      unsupportedEvents: d.events.filter(function (e) { return e.kind === "UNSUPPORTED"; }).length,
      missingRates: d.events.filter(function (e) { return RATED[e.kind] && Date.parse(e.blockTime) < settled && rate(e.blockTime) === null; }).length,
      unlinkedRent: d.events.filter(function (e) { return (e.rentPaid > 0n || e.rentRefunded > 0n) && (!der.linked[e.id] || unlinkedIds[e.id]); }).length,
      unlabelledSolIn: d.events.filter(function (e) { return e.kind === "SOL_IN" && !labelled[e.walletId + ":" + e.counterparty]; }).length,
      orphanFees: orphans.length,
      orphanFeeLamports: SJ.format.sum(orphans, eventFees),
      writtenOff: der.trades.filter(function (t) { return t.status === "written_off"; }).length,
      unreviewed: der.inbox.length,
    };
  }

  function corrections(walletIds) {
    return data().corrections.filter(function (c) { return !walletIds || walletIds.indexOf(c.walletId) >= 0; })
      .sort(function (a, b) { return Date.parse(b.createdAt) - Date.parse(a.createdAt); });
  }

  SJ.store = {
    reset: reset, on: on, data: data, changed: changed, now: now, tick: tick, buildWallet: buildWallet, derive: derive,
    settings: settings, wallets: function () { return data().wallets; }, activeWallet: activeWallet,
    token: function (mint) { return data().tokens.filter(function (t) { return t.mint === mint; })[0] || null; },
    trades: trades, trade: trade, contexts: contexts, inbox: inbox, needsReview: needsReview, rangeStart: rangeStart,
    positionEvents: positionEvents, vocab: vocab, names: names, rate: rate, reclaimFees: reclaimFees, rebateOf: rebateOf,
    periodInput: periodInput, health: health, corrections: corrections, eventFees: eventFees,
    summary: function (list) { return M.summarize(list); },
  };
})();
