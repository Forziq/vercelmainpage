// EUR figures (lib/finance/fiat.ts): display only. Every SOL leg is converted at the SOL/EUR rate of its own
// transaction minute; a figure with any unknown rate is null, never a partial sum. Amounts are exact BigInts in
// units of 1e-11 EUR (lamports × rate in cents), turned into decimal text only for SJ.format.eur.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var S = SJ.store;
  var SCALE = 11;

  /** "143.68" → 14368n (rates carry at most two decimals). */
  function cents(rate) {
    var parts = String(rate).split(".");
    return BigInt(parts[0] + ((parts[1] || "") + "00").slice(0, 2));
  }

  /** Lamports at the rate of the minute `at`, or null when that minute has no rate. */
  function toEur(lamports, at) {
    var rate = S.rate(at);
    return rate === null ? null : lamports * cents(rate);
  }

  /** Sum of EUR amounts; null when any of them is unknown. */
  function sum(values) {
    var total = 0n;
    for (var i = 0; i < values.length; i++) {
      if (values[i] === null) return null;
      total += values[i];
    }
    return total;
  }

  /** Amounts each at its own minute; zero amounts need no rate. */
  var amounts = function (items) { return sum(items.map(function (i) { return i.amount === 0n ? 0n : toEur(i.amount, i.at); })); };

  /** Converts the items; null if a rate is missing or the lamports do not add up to `expected`. */
  function convert(items, expected) {
    var lamports = 0n;
    var eur = 0n;
    for (var i = 0; i < items.length; i++) {
      if (items[i].amount === 0n) continue;
      var v = toEur(items[i].amount, items[i].at);
      if (v === null) return null;
      lamports += items[i].amount;
      eur += v;
    }
    return lamports === expected ? eur : null;
  }

  /** { solIn, solOut, fees, netPnl } of one position in EUR units (positionEur in the app). */
  function position(t) {
    var events = S.positionEvents(t.key);
    var fills = events.filter(function (e) { return e.role === "fill"; });
    var leg = function (kind, sign) {
      return fills.filter(function (e) { return e.kind === kind; }).map(function (e) { return { amount: e.swapSol * sign, at: e.blockTime }; });
    };
    var solIn = convert(leg("BUY", -1n), t.solIn);
    var solOut = convert(leg("SELL", 1n), t.solOut);
    var fees = convert(events.filter(function (e) { return e.role === "fill" || e.role === "failed"; })
      .map(function (e) { return { amount: S.eventFees(e), at: e.blockTime }; }), t.feesTotal);
    // Only when the P&L is exactly proceeds − cost − fees (not after a transfer out) does the EUR P&L follow.
    var decided = t.outcome !== null && t.netPnl === t.solOut - t.solIn - t.feesTotal;
    var netPnl = decided && solIn !== null && solOut !== null && fees !== null ? solOut - solIn - fees : null;
    return { solIn: solIn, solOut: solOut, fees: fees, netPnl: netPnl };
  }

  var cache = { key: null, map: {} };
  /** EUR net P&L of a position, memoised until the store changes. */
  function pnlOf(t) {
    var d = S.derive();
    if (cache.key !== d) cache = { key: d, map: {} };
    if (!(t.key in cache.map)) cache.map[t.key] = position(t).netPnl;
    return cache.map[t.key];
  }

  /** Decimal text of an EUR amount, for SJ.format.eur / eurSign (null stays null). */
  function text(units) {
    if (units === null || units === undefined) return null;
    var neg = units < 0n;
    var digits = (neg ? -units : units).toString().padStart(SCALE + 1, "0");
    return (neg ? "-" : "") + digits.slice(0, -SCALE) + "." + digits.slice(-SCALE);
  }

  /** "(€12.30)" line value, or null. */
  var label = function (units, signed) { return units === null ? null : SJ.format.eur(text(units), { signed: signed }); };
  var sign = function (units) { return units === null ? null : SJ.format.eurSign(text(units)); };

  SJ.fiat = { cents: cents, toEur: toEur, sum: sum, amounts: amounts, position: position, pnlOf: pnlOf, text: text, label: label, sign: sign };
})();
