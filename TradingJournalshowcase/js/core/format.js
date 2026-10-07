// Formatters ported from the app's format modules: same strings, same rounding (half to even, like the app's
// Decimal). Money arrives as BigInt lamports and is summed as BigInt; ratios arrive as plain numbers and are only
// rounded here, through exact decimal strings, so 0.035 × 100 never turns into 3.5000000000000004.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var DASH = "—";
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var WEEKDAYS = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
  var ZERO = /^-?0(\.0*)?$/;

  // ---- Exact decimals: { neg, int, scale } is ±int / 10^scale, with int a non-negative BigInt and scale ≥ 0.
  function pow10(n) {
    return BigInt(10) ** BigInt(n);
  }

  function dec(value) {
    if (typeof value === "bigint") return { neg: value < 0n, int: value < 0n ? -value : value, scale: 0 };
    var m = /^([+-])?(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(String(value));
    if (!m) throw new Error("Not a decimal: " + value);
    var frac = m[3] || "";
    var d = { neg: m[1] === "-", int: BigInt((m[2] || "") + frac || "0"), scale: frac.length - Number(m[4] || 0) };
    return shift(d, 0);
  }

  /** × 10^n (n may be negative). */
  function shift(d, n) {
    var scale = d.scale - n;
    if (scale >= 0) return { neg: d.neg, int: d.int, scale: scale };
    return { neg: d.neg, int: d.int * pow10(-scale), scale: 0 };
  }

  /** Drops the last k digits of a non-negative BigInt, rounding half to even. */
  function dropDigits(int, k) {
    var p = pow10(k);
    var q = int / p;
    var twice = (int % p) * 2n;
    if (twice > p || (twice === p && q % 2n === 1n)) q += 1n;
    return q;
  }

  function roundTo(d, dp) {
    if (d.scale <= dp) return { neg: d.neg, int: d.int * pow10(dp - d.scale), scale: dp };
    return { neg: d.neg, int: dropDigits(d.int, d.scale - dp), scale: dp };
  }

  function trim(d) {
    var int = d.int;
    var scale = d.scale;
    while (scale > 0 && int % 10n === 0n) {
      int /= 10n;
      scale -= 1;
    }
    return { neg: d.neg, int: int, scale: scale };
  }

  function sigDigits(d, sd) {
    var len = d.int.toString().length;
    if (d.int === 0n || len <= sd) return trim(d);
    var k = len - sd;
    return trim({ neg: d.neg, int: dropDigits(d.int, k) * pow10(k), scale: d.scale });
  }

  /** Plain notation with exactly `scale` decimals; keeps a minus on values that rounded to zero, like Decimal. */
  function text(d) {
    var digits = d.int.toString();
    while (digits.length <= d.scale) digits = "0" + digits;
    var cut = digits.length - d.scale;
    return (d.neg ? "-" : "") + digits.slice(0, cut) + (d.scale ? "." + digits.slice(cut) : "");
  }

  var fixed = function (d, dp) { return text(roundTo(d, dp)); };
  var plain = function (d) { return text(trim(d)); };
  var group = function (digits) { return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ","); };

  // ---- SOL, ratios, market data

  /** Lamports as SOL, e.g. `1.2345`, `+0.0800`, `-0.2750`. Never shows `-0.0000`. */
  function sol(lamports, opts) {
    var decimals = opts && opts.decimals !== undefined ? opts.decimals : 4;
    var out = fixed({ neg: lamports < 0n, int: lamports < 0n ? -lamports : lamports, scale: 9 }, decimals);
    if (ZERO.test(out)) return out.replace("-", "");
    return opts && opts.signed && lamports > 0n ? "+" + out : out;
  }

  /** A ratio such as ROI `0.04` as `+4.0%`. */
  function pct(fraction, decimals) {
    if (fraction === null || fraction === undefined) return DASH;
    var d = shift(dec(fraction), 2);
    var out = fixed(d, decimals === undefined ? 1 : decimals);
    if (ZERO.test(out)) return out.replace("-", "") + "%";
    return (d.neg ? "" : "+") + out + "%";
  }

  /** A fraction as an unsigned percentage without the sign, e.g. win rate `0.55` → `55.0`. */
  function rate(fraction, decimals) {
    if (fraction === null || fraction === undefined) return DASH;
    return fixed(shift(dec(fraction), 2), decimals === undefined ? 1 : decimals);
  }

  /** Profit factor to 2 dp; infinite (wins, no losses) as "∞". */
  function profitFactor(pf) {
    if (pf === null || pf === undefined) return DASH;
    return isFinite(pf) ? fixed(dec(pf), 2) : "∞";
  }

  /** A market cap in SOL to 3 significant digits: `28.5 SOL`, `1.23K SOL`, `457K SOL`, `1M SOL`. */
  function marketCap(mcSol) {
    if (mcSol === null || mcSol === undefined) return DASH;
    var value = dec(mcSol);
    var units = [[9, "B"], [6, "M"], [3, "K"]];
    for (var i = 0; i < units.length; i++) {
      // Round before comparing, so 999,600 becomes "1M" rather than "1000K".
      var scaled = sigDigits(shift(value, -units[i][0]), 3);
      if (scaled.int >= pow10(scaled.scale)) return plain(scaled) + units[i][1] + " SOL";
    }
    return plain(sigDigits(value, 3)) + " SOL";
  }

  /** A price in SOL per whole token, to 4 significant digits without exponent notation. */
  function price(p) {
    return p === null || p === undefined ? DASH : plain(sigDigits(dec(p), 4)) + " SOL";
  }

  /** A raw token amount (BigInt) in whole tokens with thousands separators, e.g. `1,250,000.5`. */
  function tokenQty(raw, decimals) {
    if (decimals === null || decimals === undefined) return group(raw.toString()) + " raw";
    var parts = plain(roundTo({ neg: raw < 0n, int: raw < 0n ? -raw : raw, scale: decimals }, 2)).split(".");
    return group(parts[0]) + (parts[1] ? "." + parts[1] : "");
  }

  /** `7xKX…gAsU` style short form of an address, mint or signature. */
  function shortAddress(value, edge) {
    var e = edge || 4;
    return value.length <= e * 2 + 1 ? value : value.slice(0, e) + "…" + value.slice(-e);
  }

  // ---- EUR

  /** A EUR amount to 2 dp with separators: `€1,234.56`, `+€12.30`, `-€0.40`. Never shows `-€0.00`. */
  function eur(amount, opts) {
    if (amount === null || amount === undefined) return DASH;
    var r = roundTo(dec(amount), 2);
    var parts = text({ neg: false, int: r.int, scale: 2 }).split(".");
    var out = "€" + group(parts[0]) + "." + parts[1];
    if (r.int === 0n) return out;
    if (r.neg) return "-" + out;
    return opts && opts.signed ? "+" + out : out;
  }

  /** Sign of a EUR amount after rounding to cents, for P&L colours. */
  function eurSign(amount) {
    if (amount === null || amount === undefined) return null;
    var r = roundTo(dec(amount), 2);
    return r.int === 0n ? 0 : r.neg ? -1 : 1;
  }

  // ---- Time

  /** `45s`, `12m 5s`, `3h 4m`, `2d 5h`: the two largest units. */
  function duration(seconds) {
    if (seconds === null || seconds === undefined) return DASH;
    var s = Math.max(0, Math.floor(seconds));
    var parts = [[Math.floor(s / 86400), "d"], [Math.floor((s % 86400) / 3600), "h"], [Math.floor((s % 3600) / 60), "m"], [s % 60, "s"]];
    var first = -1;
    for (var i = 0; i < parts.length && first < 0; i++) if (parts[i][0] > 0) first = i;
    if (first === -1) return "0s";
    return parts
      .slice(first, first + 2)
      .filter(function (p, j) { return j === 0 || p[0] > 0; })
      .map(function (p) { return p[0] + p[1]; })
      .join(" ");
  }

  var zoneFormats = {};
  /** Wall-clock parts of an instant in `timeZone`. */
  function zoned(date, timeZone) {
    var f = zoneFormats[timeZone];
    if (!f) {
      f = zoneFormats[timeZone] = new Intl.DateTimeFormat("en-US", {
        timeZone: timeZone, hourCycle: "h23", weekday: "short",
        year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",
      });
    }
    var out = {};
    f.formatToParts(date).forEach(function (p) { out[p.type] = p.value; });
    return out;
  }

  var pad = function (v) { return String(v).padStart(2, "0"); };

  /**
   * A UTC instant in the owner's timezone (default Europe/Dublin), with the date-fns pattern letters the app uses:
   * `yyyy-MM-dd HH:mm` (default), `MMM d, HH:mm`, `MMM d, HH:mm:ss`, `EEEE d MMM, HH:mm`, `EEEE`, `HH:mm`.
   */
  function localTime(date, timeZone, pattern) {
    if (date === null || date === undefined) return DASH;
    var p = zoned(date instanceof Date ? date : new Date(date), timeZone || "Europe/Dublin");
    var tokens = {
      yyyy: p.year, MMM: MONTHS[Number(p.month) - 1], MM: pad(p.month), dd: pad(p.day), d: String(Number(p.day)),
      HH: pad(p.hour), mm: pad(p.minute), ss: pad(p.second), EEEE: WEEKDAYS[p.weekday], EEE: p.weekday,
    };
    return (pattern || "yyyy-MM-dd HH:mm").replace(/yyyy|MMM|MM|dd|d|HH|mm|ss|EEEE|EEE/g, function (t) { return tokens[t]; });
  }

  // ---- BigInt helpers

  /** Sign of a lamport amount (−1, 0, 1), for P&L colours. */
  var signOf = function (v) { return v > 0n ? 1 : v < 0n ? -1 : 0; };

  /** Sum of BigInt lamports, optionally picked from objects: `sum(rows, function (r) { return r.netPnl; })`. */
  function sum(items, pick) {
    return items.reduce(function (acc, item) { return acc + (pick ? pick(item) : item); }, 0n);
  }

  SJ.format = {
    DASH: DASH,
    sol: sol,
    pct: pct,
    rate: rate,
    profitFactor: profitFactor,
    marketCap: marketCap,
    price: price,
    tokenQty: tokenQty,
    shortAddress: shortAddress,
    eur: eur,
    eurSign: eurSign,
    duration: duration,
    localTime: localTime,
    signOf: signOf,
    sum: sum,
  };
})();
