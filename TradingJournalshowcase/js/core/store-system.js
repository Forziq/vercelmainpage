// System actions of the demo store: one sync step (wallet-sync.md §7), the Rent & cashback screen's writes (§6, T27)
// and the reads behind Settings. Like store-actions.js, every write changes the in-memory rows and calls changed().
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var S = SJ.store;
  var A = SJ.actions;
  var iso = function (d) { return d.toISOString(); };
  function fail(message) { var e = new Error(message); e.demo = true; throw e; }
  var find = function (list, pred) { return list.filter(pred)[0]; };

  // ---- Sync

  /** Distinct transactions stored for a wallet (raw_transactions: parsed events plus parse failures). */
  function transactionCount(walletId) {
    var d = S.data();
    var sigs = {};
    d.events.forEach(function (e) { if (e.walletId === walletId) sigs[e.signature] = true; });
    d.rawFailures.forEach(function (f) { if (f.walletId === walletId) sigs[f.signature] = true; });
    return Object.keys(sigs).length;
  }

  /**
   * One incremental step: re-reads from `newest_block_time − 60 s` and inserts what is new (ON CONFLICT DO NOTHING),
   * here the generated transactions made after the last sync; their tokens and SOL/EUR minutes come along.
   * Returns { done, progressPct, fetched, new, failures } like POST /api/sync/step.
   */
  /** `beforeNotify(result)` runs after the import and before the store tells the screens (the sync loop's counter). */
  function syncStep(walletId, beforeNotify) {
    var d = S.data();
    var w = find(d.wallets, function (x) { return x.id === walletId; });
    if (!w) fail("Wallet not found.");
    var started = iso(S.now());
    var now = S.now().getTime();
    var from = w.sync && w.sync.newestBlockTime ? Date.parse(w.sync.newestBlockTime) - 60000 : 0;
    var arriving = d.pending.events.filter(function (e) { return e.walletId === walletId && Date.parse(e.blockTime) <= now; });
    var overlap = {};
    d.events.forEach(function (e) { if (e.walletId === walletId && Date.parse(e.blockTime) >= from) overlap[e.signature] = true; });
    var fresh = {};
    arriving.forEach(function (e) { fresh[e.signature] = true; });
    d.pending.events = d.pending.events.filter(function (e) { return arriving.indexOf(e) < 0; });
    arriving.forEach(function (e) {
      d.events.push(e);
      if (e.mint && !S.token(e.mint)) d.tokens.push(find(d.pending.tokens, function (t) { return t.mint === e.mint; }));
      var minute = e.blockTime.slice(0, 16);
      if (d.pending.rates[minute] !== undefined) d.rates[minute] = d.pending.rates[minute];
    });
    var newest = d.events.filter(function (e) { return e.walletId === walletId; }).reduce(function (m, e) { return e.blockTime > m ? e.blockTime : m; }, "");
    var at = iso(S.tick());
    w.sync = Object.assign({}, w.sync || { backfillComplete: true, lastError: null }, { newestBlockTime: newest || null, lastSuccessAt: at, lastError: null });
    var result = { done: true, progressPct: 100, fetched: Object.keys(overlap).length + Object.keys(fresh).length, new: Object.keys(fresh).length, failures: 0 };
    d.syncRuns.unshift({ walletId: walletId, kind: "incremental", status: "done", startedAt: started, finishedAt: at, fetched: result.fetched, inserted: result.new, failures: 0 });
    if (beforeNotify) beforeNotify(result);
    S.changed();
    return result;
  }

  /** Records a replayed import run: every page was already stored, so nothing new arrives (the sync is idempotent). */
  function recordImport(walletId, pages) {
    var d = S.data();
    var w = find(d.wallets, function (x) { return x.id === walletId; });
    var started = iso(S.now());
    var at = iso(S.tick());
    w.sync = Object.assign({}, w.sync, { lastSuccessAt: at, backfillComplete: true });
    d.syncRuns.unshift({ walletId: walletId, kind: "backfill", status: "done", startedAt: started, finishedAt: at, fetched: Math.min(transactionCount(walletId), pages * 100), inserted: 0, failures: 0 });
    S.changed();
  }

  // ---- Unlinked SOL, senders and rent links

  var labelOf = function (walletId, address) {
    return find(S.data().counterparties, function (c) { return c.walletId === walletId && c.address === address; }) || null;
  };
  var solIns = function (walletId) { return S.data().events.filter(function (e) { return e.walletId === walletId && e.kind === "SOL_IN"; }); };

  /** Incoming payments whose sender has no label, and rent no position holds (the Unlinked SOL queue). */
  function unlinked(walletId) {
    var payments = solIns(walletId).filter(function (e) { return !labelOf(walletId, e.counterparty); });
    var rentIds = {};
    S.derive().wallets[walletId].unlinkedRent.forEach(function (r) { rentIds[r.eventId] = true; });
    var rent = S.data().events.filter(function (e) { return rentIds[e.id]; });
    return { payments: payments, rent: rent };
  }

  /** Labelled senders with their payment count and total. */
  function senders(walletId) {
    return S.data().counterparties.filter(function (c) { return c.walletId === walletId; }).map(function (c) {
      var paid = solIns(walletId).filter(function (e) { return e.counterparty === c.address; });
      return { address: c.address, kind: c.label, name: c.name || null, payments: paid.length, total: SJ.format.sum(paid, function (e) { return e.swapSol; }) };
    });
  }

  /** Labels a sender for every past and future payment; moving away from cashback removes its claims' allocations. */
  function labelSender(walletId, address, kind, name) {
    var old = labelOf(walletId, address);
    if (old && old.label === "cashback" && kind !== "cashback") dropAllocations(walletId, address);
    A.setCounterpartyLabel(walletId, address, kind, name);
  }
  function removeSender(walletId, address) {
    var old = labelOf(walletId, address);
    if (old && old.label === "cashback") dropAllocations(walletId, address);
    A.setCounterpartyLabel(walletId, address, null);
  }
  function dropAllocations(walletId, address) {
    var claims = {};
    solIns(walletId).forEach(function (e) { if (e.counterparty === address) claims[e.id] = true; });
    var d = S.data();
    d.allocations = d.allocations.filter(function (a) { return !claims[a.claimEventId]; });
  }

  /** Rent events of a wallet with the position holding them (rent links list), newest first. */
  function rentLinks(walletId) {
    var owner = {};
    S.trades({ walletId: walletId }).forEach(function (t) {
      t.links.forEach(function (l) { if (l.role === "rent_paid" || l.role === "rent_refund") owner[l.eventId] = t; });
    });
    var manual = {};
    S.data().corrections.forEach(function (c) { if (c.walletId === walletId && (c.type === "RENT_LINK" || c.type === "RENT_UNLINK")) manual[c.payload.parsedEventId] = c; });
    return S.data().events.filter(function (e) { return e.walletId === walletId && (e.rentPaid > 0n || e.rentRefunded > 0n) && owner[e.id]; })
      .map(function (e) { return { event: e, owner: owner[e.id], manual: !!manual[e.id] }; })
      .sort(function (a, b) { return b.event.blockTime.localeCompare(a.event.blockTime) || b.event.id - a.event.id; });
  }

  /** Positions a rent event can be linked to: the same token, else any position opened before it. */
  function rentCandidates(walletId, e) {
    var list = S.trades({ walletId: walletId });
    return (e.mint ? list.filter(function (t) { return t.mint === e.mint; }) : list.filter(function (t) { return t.openedAt <= new Date(e.blockTime); }))
      .sort(function (a, b) { return b.openedAt - a.openedAt; });
  }

  /** setRentLink: replaces any earlier RENT_* correction of the event (undo stays in the Corrections list). */
  function setRentLink(walletId, eventId, positionKey) {
    var d = S.data();
    d.corrections = d.corrections.filter(function (c) { return !(c.walletId === walletId && (c.type === "RENT_LINK" || c.type === "RENT_UNLINK") && c.payload.parsedEventId === eventId); });
    return A.applyCorrection(walletId, positionKey ? "RENT_LINK" : "RENT_UNLINK", positionKey ? { parsedEventId: eventId, positionKey: positionKey } : { parsedEventId: eventId });
  }

  // ---- Cashback claims and allocation (lib/finance/allocate.ts)

  /** Shares of `total` by weight, toward zero; leftover lamports one each to the highest weights (ties by key). */
  function allocate(total, targets, method) {
    if (!targets.length) return [];
    var raw = targets.map(function (t) { return method === "even" ? 1n : t.weight > 0n ? t.weight : 0n; });
    var weights = raw.every(function (w) { return w === 0n; }) ? raw.map(function () { return 1n; }) : raw;
    var sum = weights.reduce(function (a, w) { return a + w; }, 0n);
    var shares = weights.map(function (w) { return (total * w) / sum; });
    var left = total - shares.reduce(function (a, s) { return a + s; }, 0n);
    var order = targets.map(function (_, i) { return i; }).sort(function (a, b) {
      return weights[b] > weights[a] ? 1 : weights[b] < weights[a] ? -1 : targets[a].key < targets[b].key ? -1 : targets[a].key > targets[b].key ? 1 : 0;
    });
    for (var i = 0; left > 0n; i = (i + 1) % order.length, left--) shares[order[i]] += 1n;
    return shares;
  }

  /** SOL_IN payments from cashback senders, newest first, with what is allocated. */
  function claims(walletId) {
    var cash = {};
    S.data().counterparties.forEach(function (c) { if (c.walletId === walletId && c.label === "cashback") cash[c.address] = c; });
    return solIns(walletId).filter(function (e) { return cash[e.counterparty]; }).map(function (e) {
      var rows = S.data().allocations.filter(function (a) { return a.claimEventId === e.id; });
      var allocated = SJ.format.sum(rows, function (a) { return a.lamports; });
      return { event: e, sender: cash[e.counterparty], allocated: allocated, positions: rows.length, state: allocated === 0n ? "none" : allocated < e.swapSol ? "partial" : "full" };
    }).sort(function (a, b) { return b.event.blockTime.localeCompare(a.event.blockTime); });
  }

  /** The allocation dialog's form: positions closed since the previous claim pre-selected, plus 50 older ones. */
  function allocationForm(walletId, claimId) {
    var claim = find(S.data().events, function (e) { return e.id === claimId; });
    if (!claim) fail("Claim not found.");
    var at = new Date(claim.blockTime);
    var earlier = solIns(walletId).filter(function (e) { return e.counterparty === claim.counterparty && e.blockTime < claim.blockTime; })
      .sort(function (a, b) { return b.blockTime.localeCompare(a.blockTime); })[0];
    var prev = earlier ? new Date(earlier.blockTime) : null;
    var closed = S.trades({ walletId: walletId }).filter(function (t) { return t.closedAt && t.closedAt <= at; }).sort(function (a, b) { return b.closedAt - a.closedAt; });
    var since = closed.filter(function (t) { return !prev || t.closedAt > prev; }).slice(0, 500);
    var older = closed.filter(function (t) { return prev && t.closedAt <= prev; }).slice(0, 50);
    var current = S.data().allocations.filter(function (a) { return a.claimEventId === claimId; });
    return {
      claim: claim, previousAt: prev, current: current,
      candidates: since.map(function (t) { return { trade: t, sinceLast: true }; }).concat(older.map(function (t) { return { trade: t, sinceLast: false }; })),
    };
  }

  /** Stores a claim's split; zero shares are not stored. `amounts` (lamports) only for `manual`, and must sum to the claim. */
  function saveAllocation(walletId, claimId, method, keys, amounts) {
    var form = allocationForm(walletId, claimId);
    var total = form.claim.swapSol;
    if (!keys.length) fail("Pick at least one trade.");
    var byKey = {};
    form.candidates.forEach(function (c) { byKey[c.trade.key] = c.trade; });
    if (keys.some(function (k) { return !byKey[k]; })) fail("A trade is not a candidate for this claim.");
    var shares = method === "manual" ? amounts.slice() : allocate(total, keys.map(function (k) { return { key: k, weight: byKey[k].feePlatform }; }), method);
    if (shares.some(function (s) { return s === null || s < 0n; }) || SJ.format.sum(shares) !== total) fail("The amounts must add up to the claim.");
    var d = S.data();
    d.allocations = d.allocations.filter(function (a) { return a.claimEventId !== claimId; }).concat(keys.map(function (k, i) {
      return { claimEventId: claimId, positionKey: k, lamports: shares[i], method: method };
    }).filter(function (a) { return a.lamports > 0n; }));
    S.changed();
  }

  function clearAllocation(claimId) {
    var d = S.data();
    d.allocations = d.allocations.filter(function (a) { return a.claimEventId !== claimId; });
    S.changed();
  }

  // ---- Needs relinking: reflections whose key no longer names a position (after a merge, split or void)

  function orphans() {
    var d = S.data();
    var byKey = S.derive().byKey;
    return d.reflections.filter(function (r) { return !byKey[r.positionKey]; }).map(function (r) {
      var walletId = r.positionKey.split(":")[0];
      var mint = r.positionKey.split(":")[1];
      var taken = {};
      d.reflections.forEach(function (x) { taken[x.positionKey] = true; });
      return { reflection: r, walletId: walletId, mint: mint, candidates: S.trades({ walletId: walletId }).filter(function (t) { return t.mint === mint && !taken[t.key]; }) };
    });
  }

  /** relinkReflection: moves the review (tags and rule results ride along) to a position without one. */
  function relinkReflection(fromKey, toKey) {
    var d = S.data();
    var r = find(d.reflections, function (x) { return x.positionKey === fromKey; });
    if (!r) fail("Reflection not found.");
    if (!S.trade(toKey)) fail("Trade not found.");
    if (find(d.reflections, function (x) { return x.positionKey === toKey; })) fail("That trade already has a reflection.");
    r.positionKey = toKey;
    S.changed();
  }

  // ---- Reads for Settings

  /** Coach runs and spend in the current local month (trade, day and period critiques). */
  function coachUsage() {
    var s = S.settings();
    var month = SJ.format.localTime(S.now(), s.timeZone, "yyyy-MM");
    var start = SJ.metrics.zonedInstant(month + "-01T00:00", s.timeZone).getTime();
    var c = S.data().coach;
    var rows = c.trade.concat(c.day, c.period).filter(function (r) { return r.status === "done" && r.finishedAt && Date.parse(r.finishedAt) >= start; });
    var micro = rows.reduce(function (sum, r) { return sum + Math.round(Number(r.costUsd || 0) * 1e6); }, 0);
    return { runs: rows.length, spendUsd: (micro / 1e6).toFixed(4), model: (rows[0] || c.trade[0] || {}).model || null };
  }

  Object.assign(SJ.actions, {
    syncStep: syncStep, recordImport: recordImport, labelSender: labelSender, removeSender: removeSender, setRentLink: setRentLink,
    saveAllocation: saveAllocation, clearAllocation: clearAllocation, relinkReflection: relinkReflection,
  });
  SJ.system = {
    transactionCount: transactionCount, unlinked: unlinked, senders: senders, rentLinks: rentLinks, rentCandidates: rentCandidates,
    allocate: allocate, claims: claims, allocationForm: allocationForm, coachUsage: coachUsage, labelOf: labelOf, orphans: orphans,
  };
})();
