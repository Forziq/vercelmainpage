// Position engine: a plain-JS port of the app's replay (events + corrections → positions), so the demo rebuilds
// positions from raw events in the browser exactly as the app does on every sync.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var FAILED_ATTACH_WINDOW_MS = 10 * 60 * 1000;
  var QTY_KINDS = { BUY: 1, SELL: 1, TOKEN_IN: 1, TOKEN_OUT: 1 };

  var absBig = function (v) { return v < 0n ? -v : v; };
  var maxBig = function (a, b) { return a > b ? a : b; };
  var minBig = function (a, b) { return a < b ? a : b; };
  var time = function (e) { return e.blockTime.getTime(); };

  /** "1" or "0.5" (a percent) as an exact fraction num / den of 100. */
  function pctParts(value) {
    var parts = String(value).split(".");
    var frac = parts[1] || "";
    return { num: BigInt(parts[0] + frac), den: 10n ** BigInt(frac.length) * 100n };
  }

  /** Chain order: (slot, signature, event_index). */
  function compareEvents(a, b) {
    if (a.slot !== b.slot) return a.slot < b.slot ? -1 : 1;
    if (a.signature !== b.signature) return a.signature < b.signature ? -1 : 1;
    return a.eventIndex - b.eventIndex;
  }

  var eventFee = function (e) { return e.networkBaseFee + e.priorityFee + e.tip + e.platformFee; };

  // ---- Corrections (wallet-sync.md §9), compiled into lookups by key; a later one on the same target wins.

  function compile(corrections) {
    var d = { excluded: {}, splits: {}, merges: {}, writeOffs: {}, rent: {}, voids: {}, applied: {} };
    var nested = function (map, outer, inner, id) { (map[outer] = map[outer] || {})[inner] = id; };
    creationOrder(corrections).forEach(function (c) {
      var p = c.payload || {};
      switch (c.type) {
        case "MERGE": if (p.keep && p.absorb && p.keep !== p.absorb) { nested(d.merges, p.keep, p.absorb, c.id); nested(d.merges, p.absorb, p.keep, c.id); } break;
        case "SPLIT_AT": if (p.positionKey && p.signature) nested(d.splits, p.positionKey, p.signature, c.id); break;
        case "EXCLUDE_EVENT": if (p.parsedEventId != null) d.excluded[p.parsedEventId] = c.id; break;
        case "WRITE_OFF": if (p.positionKey && p.at) d.writeOffs[p.positionKey] = { at: new Date(p.at), id: c.id }; break;
        case "RENT_LINK": if (p.parsedEventId != null && p.positionKey) d.rent[p.parsedEventId] = { positionKey: p.positionKey, id: c.id }; break;
        case "RENT_UNLINK": if (p.parsedEventId != null) d.rent[p.parsedEventId] = { positionKey: null, id: c.id }; break;
        case "VOID": if (p.positionKey) d.voids[p.positionKey] = c.id; break;
      }
    });
    return d;
  }

  function creationOrder(corrections) {
    return corrections.slice().sort(function (a, b) {
      return new Date(a.createdAt) - new Date(b.createdAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
  }

  /** First directive stored under any of the position's keys, marked as applied. */
  function lookup(acc, pick, idOf, d) {
    for (var i = 0; i < acc.aliases.length; i++) {
      var v = pick(acc.aliases[i]);
      if (v !== undefined) { d.applied[idOf(v)] = true; return v; }
    }
    return undefined;
  }
  var same = function (id) { return id; };
  var splitsAt = function (d, acc, sig) { return lookup(acc, function (k) { return d.splits[k] && d.splits[k][sig]; }, same, d) !== undefined; };
  var isVoided = function (d, acc) { return lookup(acc, function (k) { return d.voids[k]; }, same, d) !== undefined; };
  var mergesInto = function (d, prev, key) { return lookup(prev, function (k) { return d.merges[key] && d.merges[key][k]; }, same, d) !== undefined; };
  function dueWriteOff(d, acc, now) {
    var w = lookup(acc, function (k) { var x = d.writeOffs[k]; return x && (now === null || x.at < now) ? x : undefined; }, function (x) { return x.id; }, d);
    return w ? w.at : null;
  }

  // ---- Position accumulator

  function newAcc(key, open, reentryOf) {
    return {
      key: key, aliases: [key], events: [], writtenOff: 0n, closeQty: 0n, mint: open.mint, openEvent: open,
      reentryOf: reentryOf, status: "open", closedAt: null, qty: 0n, basis: 0n, peakQty: 0n, peakCapital: 0n,
      realised: 0n, buyCount: 0, sellCount: 0, failedCount: 0, qtyBought: 0n, qtySold: 0n, solIn: 0n, solOut: 0n,
      feeNetwork: 0n, feePriority: 0n, feeTip: 0n, feePlatform: 0n, feeFailed: 0n, rentPaid: 0n, rentRefunded: 0n,
      entryVenue: open.venue, decimals: open.tokenDecimals, lastFill: null, flags: {}, links: [],
    };
  }

  function addFees(acc, e) {
    acc.feeNetwork += e.networkBaseFee;
    acc.feePriority += e.priorityFee;
    acc.feeTip += e.tip;
    acc.feePlatform += e.platformFee;
  }
  function link(acc, e, role) {
    if (!acc.links.some(function (l) { return l.eventId === e.id; })) acc.links.push({ eventId: e.id, role: role });
  }
  function addFlag(flags, name, amount) {
    flags[name] = ((typeof flags[name] === "string" ? BigInt(flags[name]) : 0n) + amount).toString();
  }

  /** Removes `q` tokens at average cost; removing everything takes the whole basis, so no lamport is lost. */
  function removeAtCost(acc, q) {
    var costOut;
    if (q >= acc.qty) {
      if (q > acc.qty && !acc.flags.zero_cost_basis) acc.flags.oversold = true;
      costOut = acc.basis;
      acc.qty = 0n;
    } else {
      costOut = (acc.basis * q) / acc.qty;
      acc.qty -= q;
    }
    acc.basis -= costOut;
    return costOut;
  }

  function isDust(acc, s) {
    if (acc.qty <= 0n) return true;
    if (acc.qty * s.dust.den <= s.dust.num * acc.peakQty) return true;
    var f = acc.lastFill;
    return f !== null && f.qty > 0n && acc.qty * f.sol < s.dustSolLamports * f.qty;
  }

  function record(acc, e) { addFees(acc, e); acc.events.push(e); link(acc, e, "fill"); }
  function addFill(acc, e, q) {
    addFees(acc, e);
    if (acc.decimals === null) acc.decimals = e.tokenDecimals;
    acc.lastFill = { sol: absBig(e.swapSol), qty: q };
    acc.events.push(e);
    link(acc, e, "fill");
  }
  function applyBuy(acc, e) {
    var q = e.tokenAmountRaw || 0n;
    var cost = absBig(e.swapSol);
    acc.qty += q; acc.basis += cost; acc.qtyBought += q; acc.solIn += cost; acc.buyCount += 1;
    acc.peakQty = maxBig(acc.peakQty, acc.qty);
    acc.peakCapital = maxBig(acc.peakCapital, acc.basis);
    addFill(acc, e, q);
  }
  function applySell(acc, e) {
    var q = e.tokenAmountRaw || 0n;
    if (acc.flags.zero_cost_in !== undefined) acc.flags.zero_cost_sale = true;
    acc.realised += e.swapSol - removeAtCost(acc, q);
    acc.qtySold += q; acc.solOut += e.swapSol; acc.sellCount += 1;
    addFill(acc, e, q);
  }
  function applyTokenIn(acc, e) {
    var q = e.tokenAmountRaw || 0n;
    acc.qty += q;
    acc.peakQty = maxBig(acc.peakQty, acc.qty);
    addFlag(acc.flags, "zero_cost_in", q);
    record(acc, e);
  }
  function applyTokenOut(acc, e) {
    var q = e.tokenAmountRaw || 0n;
    addFlag(acc.flags, "transferred_basis", removeAtCost(acc, q));
    addFlag(acc.flags, "transferred", q);
    record(acc, e);
  }
  function attachFailed(acc, e) { acc.failedCount += 1; acc.feeFailed += eventFee(e); link(acc, e, "failed"); }

  /** Closes the position at `at`, writing any remaining basis off into realised P&L. */
  function close(acc, at, status) {
    acc.writtenOff = acc.basis;
    acc.closeQty = acc.qty;
    if (acc.basis > 0n) {
      acc.realised -= acc.basis;
      acc.flags[status === "written_off" ? "written_off_basis" : "dust_written_off"] = acc.basis.toString();
      acc.basis = 0n;
    }
    acc.status = status;
    acc.closedAt = at > acc.openEvent.blockTime ? at : acc.openEvent.blockTime;
  }

  /** Undoes `prev`'s close so a merged position continues in it. */
  function reopen(prev, mergedKey) {
    var restored = prev.closeQty > 0n ? (prev.writtenOff * minBig(prev.qty, prev.closeQty)) / prev.closeQty : 0n;
    prev.basis += restored;
    prev.realised += restored;
    var left = prev.writtenOff - restored;
    delete prev.flags.written_off_basis;
    if (left > 0n) prev.flags.dust_written_off = left.toString();
    else delete prev.flags.dust_written_off;
    prev.writtenOff = 0n;
    prev.status = "open";
    prev.closedAt = null;
    prev.aliases.push(mergedKey);
    prev.flags.merged = (prev.flags.merged || []).concat([mergedKey]);
  }

  SJ.engineParts = {
    absBig: absBig, maxBig: maxBig, minBig: minBig, time: time, pctParts: pctParts, compareEvents: compareEvents,
    eventFee: eventFee, compile: compile, creationOrder: creationOrder, splitsAt: splitsAt, isVoided: isVoided,
    mergesInto: mergesInto, dueWriteOff: dueWriteOff, newAcc: newAcc, isDust: isDust, applyBuy: applyBuy,
    applySell: applySell, applyTokenIn: applyTokenIn, applyTokenOut: applyTokenOut, attachFailed: attachFailed,
    close: close, reopen: reopen, record: record, link: link, addFlag: addFlag,
    FAILED_ATTACH_WINDOW_MS: FAILED_ATTACH_WINDOW_MS, QTY_KINDS: QTY_KINDS,
  };
})();
