// Accounting ledger for the Exports preview (docs/accounting-export.md; lib/accounting/{fifo,journal,reconcile,cgt}.ts):
// FIFO lots pooled per token across every wallet, disposals, fees, receipts and the reconciliation with the journal.
// EUR amounts are exact BigInts in units of 1e-11 EUR (lamports × rate in cents), rounded to cents only for display.
// The generator builds `DEMO.exports` with this same file, so the committed preview and the browser agree.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var S = SJ.store;
  var M = SJ.metrics;
  var TAX_TZ = "Europe/Dublin";
  var EUR_UNIT = 100000000000n;
  var KINDS = { BUY: 1, SELL: 1, TOKEN_IN: 1, TOKEN_OUT: 1, FAILED_SWAP: 1, RENT_RECLAIM: 1 };
  var METHOD = {
    name: "fifo", label: "FIFO (first in, first out)",
    assumption: "FIFO applied as an assumption — confirm with your accountant. Revenue's crypto-asset manual says gains are computed on a disposal-by-disposal basis and prescribes no matching method.",
  };
  var EXEMPTION_EUR = 1270;

  var unitsOf = function (lamports, rate) { return lamports === 0n ? 0n : rate === null ? null : lamports * BigInt(Math.round(Number(rate) * 100)); };
  var addUnits = function (values) { return values.some(function (v) { return v === null; }) ? null : values.reduce(function (a, b) { return a + b; }, 0n); };
  var fee = function (e) { return e.networkBaseFee + e.priorityFee + e.tip + e.platformFee; };

  /** Units as a EUR string with 2 decimals, half to even. */
  function eurText(units) {
    if (units === null) return null;
    var neg = units < 0n;
    var abs = neg ? -units : units;
    var per = EUR_UNIT / 100n;
    var cents = abs / per;
    var rest = (abs % per) * 2n;
    if (rest > per || (rest === per && cents % 2n === 1n)) cents += 1n;
    var s = cents.toString().padStart(3, "0");
    return (neg && cents > 0n ? "-" : "") + s.slice(0, -2) + "." + s.slice(-2);
  }
  var centsOf = function (text) { return BigInt(text.replace(".", "")); };

  /**
   * journalMarks: what each wallet's corrections did to its events. The engine is replayed without the VOIDs, so a
   * voided position's fills can still be named; its failed attempts become unlinked, like any orphan.
   */
  function marks() {
    var d = S.data();
    var out = {};
    var mark = function (id, k) { (out[id] = out[id] || {})[k] = true; };
    d.corrections.forEach(function (c) { if (c.type === "EXCLUDE_EVENT") mark(c.payload.parsedEventId, "excluded"); });
    d.wallets.forEach(function (w) {
      var own = d.corrections.filter(function (c) { return c.walletId === w.id; });
      var voids = {};
      own.forEach(function (c) { if (c.type === "VOID") voids[c.payload.positionKey] = true; });
      var kinds = {};
      d.events.forEach(function (e) { if (e.walletId === w.id) kinds[e.id] = e.kind; });
      S.buildWallet(w.id, own.filter(function (c) { return c.type !== "VOID"; })).positions.forEach(function (p) {
        var voided = [p.key].concat(p.flags.merged || []).some(function (k) { return voids[k]; });
        p.links.forEach(function (l) {
          if (l.role === "fill" && voided) mark(l.eventId, "voided");
          if (l.role === "fill" && p.status === "written_off" && kinds[l.eventId] === "BUY") mark(l.eventId, "writtenOff");
          if (l.role === "failed" && !voided) mark(l.eventId, "failedLinked");
        });
      });
    });
    return out;
  }

  // ---- Periods (always Dublin calendar days, whatever the display timezone)

  var dayStart = function (day) { return M.zonedInstant(day + "T00:00", TAX_TZ); };
  /** { year } or { from, to } (yyyy-MM-dd, `to` inclusive) → [from, to) instants with the app's label. */
  function period(o) {
    if (o.from && o.to) return { from: dayStart(o.from), to: dayStart(M.shiftDay(o.to, 1)), label: o.from + " – " + o.to, year: null, fromDay: o.from, toDay: o.to };
    return { from: dayStart(o.year + "-01-01"), to: dayStart(o.year + 1 + "-01-01"), label: String(o.year), year: o.year, fromDay: o.year + "-01-01", toDay: o.year + "-12-31" };
  }
  var dublin = function (at) { return SJ.format.localTime(new Date(at), TAX_TZ, "yyyy-MM-dd HH:mm:ss"); };
  /** CGT payment period of a disposal by its Dublin date: 1 Jan–30 Nov or December. */
  function cgtPeriod(at) {
    var day = dublin(at);
    var year = Number(day.slice(0, 4));
    return day.slice(5, 7) === "12"
      ? { year: year, part: "later", label: year + " Dec", paymentDue: year + 1 + "-01-31" }
      : { year: year, part: "initial", label: year + " Jan–Nov", paymentDue: year + "-12-15" };
  }

  // ---- FIFO over the events before `to`, all wallets pooled (later events never change earlier matches)

  function run(to, m) {
    var d = S.data();
    var flagsOf = function (e) { var x = m[e.id] || {}; return (x.voided ? ["voided_in_journal"] : []).concat(x.excluded ? ["excluded_in_journal"] : []); };
    var events = d.events.filter(function (e) { return KINDS[e.kind] && Date.parse(e.blockTime) < to; }).slice().sort(function (a, b) {
      return a.blockTime.localeCompare(b.blockTime) || a.slot - b.slot || (a.signature < b.signature ? -1 : a.signature > b.signature ? 1 : 0) || a.eventIndex - b.eventIndex;
    });
    var pools = {};
    var L = { acquisitions: [], disposals: [], transfers: [], fees: [], warnings: [] };
    function take(mint, qty) {
      var pool = pools[mint] || [];
      var matches = [];
      var left = qty;
      while (left > 0n && pool.length) {
        var p = pool[0];
        var n = left < p.qty - p.used ? left : p.qty - p.used;
        // Slices are differences of the cumulative cost, so a lot's cost is conserved exactly.
        var before = p.cost === null ? null : (p.cost * p.used) / p.qty;
        var after = p.cost === null ? null : (p.cost * (p.used + n)) / p.qty;
        matches.push({ lotEventId: p.eventId, qty: n, cost: before === null ? null : after - before });
        p.used += n;
        left -= n;
        if (p.used === p.qty) pool.shift();
      }
      if (left > 0n) matches.push({ lotEventId: null, qty: left, cost: 0n });
      return matches;
    }
    events.forEach(function (e) {
      var f = fee(e);
      var x = m[e.id] || {};
      var rate = S.rate(e.blockTime);
      var ref = function () { return { eventId: e.id, walletId: e.walletId, at: e.blockTime }; };
      var row = function (fields) { return Object.assign(ref(), fields); };
      if ((f > 0n || ((e.kind === "BUY" || e.kind === "SELL") && e.swapSol !== 0n)) && rate === null) L.warnings.push(row({ code: "missing_rate" }));
      if (f > 0n) {
        var allocation = { BUY: "acquisition", SELL: "disposal", TOKEN_IN: "transfer", TOKEN_OUT: "transfer", RENT_RECLAIM: "unallocated" }[e.kind] || (x.failedLinked ? "failed_attempt" : "unallocated");
        var eur = unitsOf(f, rate);
        L.fees.push(row({ lamports: f, eur: eur, allocation: allocation, flags: flagsOf(e).concat(eur === null ? ["missing_rate"] : []) }));
      }
      if (e.kind === "BUY") {
        var cost = unitsOf(-e.swapSol + f, rate);
        L.acquisitions.push(row({ qty: e.tokenAmountRaw, solSpent: -e.swapSol, fees: f, cost: cost, flags: flagsOf(e).concat(x.writtenOff ? ["written_off_in_journal"] : [], cost === null ? ["missing_rate"] : []) }));
        (pools[e.mint] = pools[e.mint] || []).push({ eventId: e.id, qty: e.tokenAmountRaw, used: 0n, cost: cost });
      } else if (e.kind === "SELL") {
        var matches = take(e.mint, e.tokenAmountRaw);
        var proceeds = unitsOf(e.swapSol - f, rate);
        var matched = addUnits(matches.map(function (q) { return q.cost; }));
        var gain = proceeds === null || matched === null ? null : proceeds - matched;
        var unknownLot = matches.some(function (q) { return q.lotEventId === null; });
        if (unknownLot) L.warnings.push(row({ code: "no_known_cost" }));
        matches.filter(function (q) { return q.cost === null; }).forEach(function (q) { L.warnings.push(row({ code: "missing_lot_rate", lotEventId: q.lotEventId })); });
        L.disposals.push(row({ qty: e.tokenAmountRaw, solReceived: e.swapSol, fees: f, proceeds: proceeds, cost: matched, gain: gain,
          flags: flagsOf(e).concat(unknownLot ? ["no_known_cost"] : [], gain === null ? ["missing_rate"] : []), cgtPeriod: cgtPeriod(e.blockTime).part }));
      } else if (e.kind === "TOKEN_OUT") {
        L.transfers.push(row({ direction: "out", qty: e.tokenAmountRaw, cost: addUnits(take(e.mint, e.tokenAmountRaw).map(function (q) { return q.cost; })), flags: flagsOf(e).concat(["transfer_out_review"]) }));
        L.warnings.push(row({ code: "transfer_out_review" }));
      }
    });
    return L;
  }

  /** accounting-export.md §7: app − method, split into lines that add up to the shown difference. */
  function reconcile(walletId, p, disposals) {
    var events = {};
    S.data().events.forEach(function (e) { events[e.id] = e; });
    var journal = S.trades({ walletId: walletId }).filter(function (t) { return t.outcome !== null && t.closedAt && t.closedAt >= p.from && t.closedAt < p.to; }).map(function (t) {
      var legs = t.links.filter(function (l) { return l.role === "fill" || l.role === "failed"; }).map(function (l) { return events[l.eventId]; });
      var eurOf = function (e, lamports) { return unitsOf(lamports, S.rate(e.blockTime)); };
      var net = addUnits(legs.map(function (e) { return e.kind === "FAILED_SWAP" ? eurOf(e, -fee(e)) : eurOf(e, e.swapSol - fee(e)); }));
      var failed = addUnits(legs.filter(function (e) { return e.kind === "FAILED_SWAP"; }).map(function (e) { return eurOf(e, fee(e)); }));
      var solInEur = addUnits(legs.filter(function (e) { return e.kind === "BUY"; }).map(function (e) { return eurOf(e, -e.swapSol); }));
      var writtenOff = BigInt(t.flags.written_off_basis || t.flags.dust_written_off || "0");
      var woEur = writtenOff === 0n || t.solIn === 0n ? 0n : solInEur === null ? null : (solInEur * writtenOff) / t.solIn;
      return { net: net, failed: failed, woEur: woEur };
    });
    var known = journal.filter(function (j) { return j.net !== null && j.failed !== null && j.woEur !== null; });
    var gains = disposals.filter(function (x) { return x.gain !== null; });
    var has = function (x, flag) { return x.flags.indexOf(flag) >= 0; };
    // Sums are rounded to cents first, so the shown lines add up to the shown difference exactly.
    var cents = function (vs) { return centsOf(eurText(vs.reduce(function (a, b) { return a + b; }, 0n))); };
    var text = function (c) { return eurText(c * (EUR_UNIT / 100n)); };
    var pick = function (rows, k) { return rows.map(function (r) { return r[k]; }); };
    var app = cents(pick(known, "net"));
    var method = cents(pick(gains, "gain"));
    var lines = {
      voided: -cents(pick(gains.filter(function (x) { return has(x, "voided_in_journal"); }), "gain")),
      excluded: -cents(pick(gains.filter(function (x) { return has(x, "excluded_in_journal") && !has(x, "voided_in_journal"); }), "gain")),
      failedFees: -cents(pick(known, "failed")),
      writtenOffBasis: -cents(pick(known, "woEur")),
    };
    lines.methodAndTiming = app - method - lines.voided - lines.excluded - lines.failedFees - lines.writtenOffBasis;
    var out = {};
    Object.keys(lines).forEach(function (k) { out[k] = text(lines[k]); });
    return {
      appNetPnlEur: text(app), methodGainEur: text(method), difference: text(app - method), lines: out,
      missingRates: { positions: journal.length - known.length, disposals: disposals.length - gains.length },
    };
  }

  function gainTotals(disposals) {
    var t = { disposals: disposals.length, gains: 0n, losses: 0n, unknown: 0 };
    disposals.forEach(function (x) {
      if (x.gain === null) t.unknown++;
      else if (x.gain < 0n) t.losses += x.gain;
      else t.gains += x.gain;
    });
    return { disposals: t.disposals, gains: eurText(t.gains), losses: eurText(t.losses), net: eurText(t.gains + t.losses), unknown: t.unknown };
  }

  /**
   * The workbook for one period and listed wallet. Rows keep EUR as units (null = unknown); `walletId` only picks
   * whose rows are listed and reconciled, the lots stay pooled.
   */
  function build(o) {
    var p = o.period;
    var L = run(p.to.getTime(), marks());
    var listed = function (rows) { return rows.filter(function (r) { var at = Date.parse(r.at); return r.walletId === o.walletId && at >= p.from.getTime() && at < p.to.getTime(); }); };
    var d = S.data();
    var disposals = listed(L.disposals);
    var receipts = d.events.filter(function (e) {
      var at = Date.parse(e.blockTime);
      return e.walletId === o.walletId && e.kind === "SOL_IN" && at >= p.from.getTime() && at < p.to.getTime();
    }).map(function (e) {
      var label = d.counterparties.filter(function (c) { return c.walletId === o.walletId && c.address === e.counterparty; })[0];
      return { eventId: e.id, walletId: e.walletId, at: e.blockTime, label: label ? label.label : null, name: label ? label.name : null, lamports: e.swapSol, eur: unitsOf(e.swapSol, S.rate(e.blockTime)) };
    });
    var cgt = {};
    disposals.forEach(function (x) {
      var c = cgtPeriod(x.at);
      var g = (cgt[c.year + c.part] = cgt[c.year + c.part] || { period: c, rows: [] });
      g.rows.push(x);
    });
    return {
      method: METHOD, period: p, walletId: o.walletId, wallets: d.wallets.map(function (w) { return w.id; }),
      acquisitions: listed(L.acquisitions), disposals: disposals, transfers: listed(L.transfers), fees: listed(L.fees),
      receipts: receipts, warnings: listed(L.warnings), totals: gainTotals(disposals),
      cgt: Object.keys(cgt).sort().map(function (k) { return { period: cgt[k].period, totals: gainTotals(cgt[k].rows) }; }),
      reconciliation: reconcile(o.walletId, p, disposals),
    };
  }

  /** The ledger's warnings plus receipts without a rate (exportWarnings), in time order. */
  function warnings(x) {
    return x.warnings.concat(x.receipts.filter(function (r) { return r.eur === null; }).map(function (r) { return { eventId: r.eventId, walletId: r.walletId, at: r.at, code: "missing_rate" }; }))
      .sort(function (a, b) { return Date.parse(a.at) - Date.parse(b.at); });
  }

  /** Rows per sheet (sheetCounts). */
  function counts(x) {
    return { disposals: x.disposals.length, acquisitions: x.acquisitions.length, fees: x.fees.length, receipts: x.receipts.length, warnings: warnings(x).length };
  }

  SJ.ledger = {
    METHOD: METHOD, EXEMPTION_EUR: EXEMPTION_EUR, TAX_TZ: TAX_TZ, eurText: eurText, marks: marks, period: period, cgtPeriod: cgtPeriod,
    dublin: dublin, returnDue: function (year) { return year + 1 + "-10-31"; }, build: build, warnings: warnings, counts: counts,
  };
})();
