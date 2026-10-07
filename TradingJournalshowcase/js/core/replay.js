// Replays one wallet's events into positions (wallet-sync.md §8–§9), on top of the parts in engine.js.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var P = SJ.engineParts;

  /**
   * `events` are one wallet's parsed events (Dates and bigints already decoded), `corrections` that wallet's rows.
   * `settings`: { walletId, breakevenPct, dustPct, dustSolLamports, tokens: { [mint]: { supplyRaw, createdAt } } }.
   */
  function build(events, corrections, settings) {
    var s = {
      walletId: settings.walletId, band: P.pctParts(settings.breakevenPct), dust: P.pctParts(settings.dustPct),
      dustSolLamports: settings.dustSolLamports, tokens: settings.tokens || {},
    };
    var d = P.compile(corrections);
    var sorted = events.filter(function (e) {
      var id = d.excluded[e.id];
      if (id) d.applied[id] = true;
      return id === undefined;
    }).sort(P.compareEvents);

    var byMint = {};
    var mints = [];
    var orphans = [];
    sorted.forEach(function (e) {
      if (e.mint === null) { if (e.kind === "FAILED_SWAP") orphans.push(e); return; }
      if (!byMint[e.mint]) { byMint[e.mint] = []; mints.push(e.mint); }
      byMint[e.mint].push(e);
    });

    var keys = {};
    var accs = [];
    mints.forEach(function (m) { accs = accs.concat(replayMint(byMint[m], s, d, keys, orphans)); });
    accs.sort(function (a, b) { return P.compareEvents(a.openEvent, b.openEvent); });
    var unlinkedRent = linkRent(accs, sorted.filter(function (e) { return e.rentPaid > 0n || e.rentRefunded > 0n; }), d);
    var kept = accs.filter(function (acc) { return !P.isVoided(d, acc); });

    return {
      positions: kept.map(function (acc) { return finalise(acc, s); }),
      unlinkedRent: unlinkedRent,
      skippedCorrections: P.creationOrder(corrections).filter(function (c) { return !d.applied[c.id]; }).map(function (c) { return c.id; }),
    };
  }

  function replayMint(events, s, d, keys, orphans) {
    var positions = [];
    var open = null;
    var pendingFailed = [];
    var stock = { qty: 0n, events: [] };

    function openAt(e) {
      var prev = positions.length ? positions[positions.length - 1] : null;
      var key = s.walletId + ":" + e.mint + ":" + e.signature;
      if (keys[key]) key += ":" + e.eventIndex;
      var acc;
      if (prev && P.mergesInto(d, prev, key)) {
        P.reopen(prev, key);
        acc = prev;
      } else {
        keys[key] = true;
        acc = P.newAcc(key, e, prev ? prev.key : null);
        if (prev && prev.qty > 0n) {
          acc.qty = prev.qty;
          acc.peakQty = prev.qty;
          acc.flags.dust_carried_in = prev.qty.toString();
          prev.qty = 0n;
        }
        positions.push(acc);
      }
      if (stock.events.length) {
        acc.qty += stock.qty;
        acc.peakQty = P.maxBig(acc.peakQty, acc.qty);
        if (stock.qty > 0n) P.addFlag(acc.flags, "zero_cost_in", stock.qty);
        stock.events.forEach(function (x) { P.record(acc, x); });
      }
      stock = { qty: 0n, events: [] };
      pendingFailed.forEach(function (f) {
        if (P.time(e) - P.time(f) <= P.FAILED_ATTACH_WINDOW_MS) P.attachFailed(acc, f);
        else orphans.push(f);
      });
      pendingFailed = [];
      return acc;
    }

    function closeIfDust(acc, e, status) {
      if (!P.isDust(acc, s)) return;
      P.close(acc, e.blockTime, status);
      open = null;
    }

    events.forEach(function (e) {
      var writeOffAt = open && P.dueWriteOff(d, open, e.blockTime);
      if (open && writeOffAt) { P.close(open, writeOffAt, "written_off"); open = null; }
      if (open && P.QTY_KINDS[e.kind] && P.splitsAt(d, open, e.signature)) {
        var splitFrom = open;
        P.close(splitFrom, e.blockTime, "closed");
        open = openAt(e);
        if (open !== splitFrom) open.flags.split_from = splitFrom.key;
      }
      var prev = positions[positions.length - 1];
      var dustHolder = !open && prev && prev.qty > 0n ? prev : null;

      switch (e.kind) {
        case "BUY":
          if (!open) open = openAt(e);
          P.applyBuy(open, e);
          break;
        case "SELL":
          if (dustHolder) { P.applySell(dustHolder, e); dustHolder.flags.sold_after_close = true; break; }
          if (!open) {
            open = openAt(e);
            if (open.buyCount === 0) open.flags.zero_cost_basis = true;
          }
          P.applySell(open, e);
          closeIfDust(open, e, "closed");
          break;
        case "TOKEN_IN":
          if (open) P.applyTokenIn(open, e);
          else { stock.qty += e.tokenAmountRaw || 0n; stock.events.push(e); }
          break;
        case "TOKEN_OUT":
          if (open) { P.applyTokenOut(open, e); closeIfDust(open, e, "transferred"); }
          else if (dustHolder) P.applyTokenOut(dustHolder, e);
          else { stock.qty -= P.minBig(stock.qty, e.tokenAmountRaw || 0n); stock.events.push(e); }
          break;
        case "FAILED_SWAP":
          if (open) P.attachFailed(open, e);
          else pendingFailed.push(e);
          break;
      }
    });
    var finalWriteOff = open && P.dueWriteOff(d, open, null);
    if (open && finalWriteOff) P.close(open, finalWriteOff, "written_off");
    pendingFailed.forEach(function (f) { orphans.push(f); });
    return positions;
  }

  // ---- Rent (wallet-sync.md §6)

  var sameAccount = function (a, b) { return a.tokenAccount === null || b.tokenAccount === null || a.tokenAccount === b.tokenAccount; };

  function payerOf(own, e) {
    for (var i = 0; i < own.length; i++) {
      if (own[i].events.some(function (f) { return sameAccount(f, e) && P.compareEvents(f, e) >= 0; })) return own[i];
    }
    return null;
  }
  function refunderOf(own, e) {
    var before = own.filter(function (a) { return P.compareEvents(a.openEvent, e) <= 0; });
    for (var i = before.length - 1; i >= 0; i--) {
      if (before[i].events.some(function (f) { return sameAccount(f, e) && P.compareEvents(f, e) <= 0; })) return before[i];
    }
    return before.length ? before[before.length - 1] : null;
  }

  function linkRent(accs, rentEvents, d) {
    var byKey = {};
    var byMint = {};
    accs.forEach(function (acc) {
      acc.aliases.forEach(function (k) { byKey[k] = acc; });
      (byMint[acc.mint] = byMint[acc.mint] || []).push(acc);
    });
    var unlinked = [];
    rentEvents.forEach(function (e) {
      var forced = d.rent[e.id];
      var target = forced && forced.positionKey ? byKey[forced.positionKey] : undefined;
      if (forced && (forced.positionKey === null || target)) d.applied[forced.id] = true;
      if (forced && forced.positionKey === null) {
        unlinked.push({ eventId: e.id, mint: e.mint, blockTime: e.blockTime, rentPaid: e.rentPaid, rentRefunded: e.rentRefunded, reason: "unlinked" });
        return;
      }
      var own = (e.mint && byMint[e.mint]) || [];
      var payer = target || (e.rentPaid > 0n ? payerOf(own, e) : null);
      var refunder = target || (e.rentRefunded > 0n ? refunderOf(own, e) : null);
      if (payer && e.rentPaid > 0n) { payer.rentPaid += e.rentPaid; P.link(payer, e, "rent_paid"); }
      if (refunder && e.rentRefunded > 0n) { refunder.rentRefunded += e.rentRefunded; P.link(refunder, e, "rent_refund"); }
      var paidLeft = payer ? 0n : e.rentPaid;
      var refundLeft = refunder ? 0n : e.rentRefunded;
      if (paidLeft > 0n || refundLeft > 0n) {
        unlinked.push({ eventId: e.id, mint: e.mint, blockTime: e.blockTime, rentPaid: paidLeft, rentRefunded: refundLeft, reason: "no_position" });
      }
    });
    return unlinked;
  }

  // ---- Finalise (wallet-sync.md §8 metrics)

  function finalise(acc, s) {
    var token = s.tokens[acc.mint] || {};
    var openedAt = acc.openEvent.blockTime;
    var feesTotal = acc.feeNetwork + acc.feePriority + acc.feeTip + acc.feePlatform + acc.feeFailed;
    var netPnl = acc.realised - feesTotal;
    var hasRoi = acc.status !== "open" && acc.status !== "transferred" && acc.solIn !== 0n;
    var outcome = null;
    if (hasRoi) {
      var scaled = netPnl * s.band.den;
      var band = s.band.num * acc.solIn;
      outcome = scaled > band ? "win" : scaled < -band ? "loss" : "breakeven";
    }
    var supply = token.supplyRaw === undefined ? null : token.supplyRaw;
    var mc = function (sol, qty) { return supply === null || qty === 0n ? null : (Number(sol) * Number(supply)) / (Number(qty) * 1e9); };
    var created = token.createdAt ? new Date(token.createdAt) : null;
    return {
      key: acc.key, walletId: s.walletId, mint: acc.mint, status: acc.status, reentryOf: acc.reentryOf,
      openedAt: openedAt, closedAt: acc.closedAt,
      holdingSeconds: acc.closedAt ? Math.floor((acc.closedAt - openedAt) / 1000) : null,
      buyCount: acc.buyCount, sellCount: acc.sellCount, failedCount: acc.failedCount,
      qtyBoughtRaw: acc.qtyBought, qtySoldRaw: acc.qtySold, qtyHeldRaw: acc.qty, decimals: acc.decimals,
      solIn: acc.solIn, solOut: acc.solOut, basisRemaining: acc.basis, peakCapital: acc.peakCapital,
      entryMcSol: mc(acc.solIn, acc.qtyBought), exitMcSol: mc(acc.solOut, acc.qtySold),
      feeNetwork: acc.feeNetwork, feePriority: acc.feePriority, feeTip: acc.feeTip, feePlatform: acc.feePlatform,
      feeFailed: acc.feeFailed, feesTotal: feesTotal, grossPnl: acc.realised, netPnl: netPnl,
      // ROI is a display ratio (a plain number); the outcome above is decided on exact lamports.
      roi: hasRoi ? Number(netPnl) / Number(acc.solIn) : null,
      roiParts: hasRoi ? { num: netPnl, den: acc.solIn } : null,
      outcome: outcome, rentPaid: acc.rentPaid, rentRefunded: acc.rentRefunded, entryVenue: acc.entryVenue,
      tokenAgeAtEntrySeconds: created ? Math.floor((openedAt - created) / 1000) : null,
      flags: acc.flags, links: acc.links,
    };
  }

  SJ.engine = { build: build, compareEvents: P.compareEvents, eventFee: P.eventFee };
})();
