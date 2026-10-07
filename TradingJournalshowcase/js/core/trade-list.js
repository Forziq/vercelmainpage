// The Trades list (server/repositories/positionFilters.ts, positions.ts and lib/validation/trades.ts): filters and
// sort live in the hash query (#/trades?outcome=win&sort=roi), junk values are ignored like the app's zod schema,
// and the summary strip uses the same filters as the list.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var M = SJ.metrics;
  var S = SJ.store;
  var PAGE_SIZE = 50;
  var HOLD = [{ min: 0, label: "<1m" }, { min: 60, label: "1–5m" }, { min: 300, label: "5–15m" }, { min: 900, label: "15–60m" }, { min: 3600, label: "1–4h" }, { min: 14400, label: ">4h" }];
  var SORT = { opened_at: "Opened", net_pnl: "Net P&L", roi: "ROI", fees: "Fees", hold: "Hold time", size: "Size (SOL in)", entry_mc: "Entry MC" };
  var DIR = { desc: "Largest / newest first", asc: "Smallest / oldest first" };
  var REVIEWED = { yes: "Reviewed", no: "Not reviewed" };
  var OUTCOME = { win: "Win", loss: "Loss", breakeven: "Breakeven", open: "Open" };
  var STATUS = { open: "Open", closed: "Closed", written_off: "Written off", transferred: "Transferred" };
  var VENUE = { pump_curve: "Pump.fun curve", pumpswap: "PumpSwap", unknown: "Unknown" };
  var RULES = { followed: "All followed", broken: "Any broken" };
  var GRADES = { A: "A", B: "B", C: "C", D: "D", F: "F" };
  var ORDER = ["q", "from", "to", "strategy", "tag", "grade", "outcome", "status", "hold", "venue", "reviewed", "rules", "pnlMin", "pnlMax", "sort", "dir", "page"];

  var DAY = /^\d{4}-\d{2}-\d{2}$/;
  var SOL = /^-?\d{1,9}(\.\d{1,9})?$/;
  var oneOf = function (labels) { return function (v) { return Object.prototype.hasOwnProperty.call(labels, v) ? v : undefined; }; };
  var vocabId = function (kind) { return function (v) { return S.data().vocab[kind].some(function (x) { return x.id === v; }) ? v : undefined; }; };
  var PARSE = {
    q: function (v) { var t = v.trim(); return t.length >= 1 && t.length <= 64 ? t : undefined; },
    from: function (v) { return DAY.test(v) && !isNaN(Date.parse(v + "T00:00:00Z")) ? v : undefined; },
    strategy: vocabId("strategies"), tag: vocabId("tags"), grade: oneOf(GRADES), outcome: oneOf(OUTCOME), status: oneOf(STATUS),
    hold: function (v) { return /^\d$/.test(v) && Number(v) < HOLD.length ? v : undefined; },
    venue: oneOf(VENUE), reviewed: oneOf(REVIEWED), rules: oneOf(RULES),
    pnlMin: function (v) { return SOL.test(v.trim()) ? v.trim() : undefined; },
    sort: oneOf(SORT), dir: oneOf(DIR),
    page: function (v) { return /^\d+$/.test(v) && Number(v) >= 1 ? Number(v) : undefined; },
  };
  PARSE.to = PARSE.from;
  PARSE.pnlMax = PARSE.pnlMin;

  /** The query part of the hash (or any query string) as validated params; unknown keys and junk values drop out. */
  function parse(query) {
    var raw = new URLSearchParams(query || "");
    var out = {};
    ORDER.forEach(function (k) {
      var v = raw.get(k);
      if (v === null || v === "") return;
      var parsed = PARSE[k](v);
      if (parsed !== undefined) out[k] = parsed;
    });
    return out;
  }

  /** "#/trades?…" with these params; undefined values and page 1 are dropped. */
  function href(params, patch) {
    var all = Object.assign({}, params, patch || {});
    var q = new URLSearchParams();
    ORDER.forEach(function (k) { if (all[k] !== undefined && !(k === "page" && all[k] === 1)) q.set(k, String(all[k])); });
    var text = q.toString();
    return "#/trades" + (text ? "?" + text : "");
  }

  var sortOf = function (p) { return { key: p.sort || "opened_at", dir: p.dir || "desc" }; };

  /** A header click: the sorted column flips, any other starts descending; the default order drops both params. */
  function sortHref(params, key) {
    var cur = sortOf(params);
    var dir = cur.key === key && cur.dir === "desc" ? "asc" : "desc";
    var isDefault = key === "opened_at" && dir === "desc";
    return href(params, { sort: isDefault ? undefined : key, dir: dir === "asc" ? "asc" : undefined, page: undefined });
  }

  /** "-0.5" SOL → lamports, exactly. */
  function lamports(text) {
    var neg = text.charAt(0) === "-";
    var parts = text.replace("-", "").split(".");
    var v = BigInt(parts[0]) * 1000000000n + BigInt(((parts[1] || "") + "000000000").slice(0, 9));
    return neg ? -v : v;
  }

  var reflectionOf = function (t) { return t.reflection || {}; };
  var reviewedAt = function (t) { return reflectionOf(t).reviewedAt || null; };
  var results = function (t) { return reflectionOf(t).ruleResults || []; };
  var anyBroken = function (t) { return results(t).some(function (r) { return !r.followed; }); };

  /** positionFilterConditions: every filter that is set must match. */
  function matches(t, p, tz) {
    var r = reflectionOf(t);
    if (p.q) {
      var token = S.token(t.mint) || {};
      var q = p.q.toLowerCase();
      var hit = (token.symbol || "").toLowerCase().indexOf(q) >= 0 || (token.name || "").toLowerCase().indexOf(q) >= 0 || t.mint.toLowerCase().indexOf(q) === 0;
      if (!hit) return false;
    }
    if (p.reviewed && (p.reviewed === "yes") !== !!reviewedAt(t)) return false;
    if (p.outcome === "open" ? t.status !== "open" : p.outcome && t.outcome !== p.outcome) return false;
    if (p.status && t.status !== p.status) return false;
    if (p.from && t.openedAt < M.zonedInstant(p.from + "T00:00", tz)) return false;
    if (p.to && t.openedAt >= M.zonedInstant(M.shiftDay(p.to, 1) + "T00:00", tz)) return false;
    if (p.strategy && r.strategyId !== p.strategy) return false;
    if (p.grade && r.grade !== p.grade) return false;
    if (p.tag && (r.tagIds || []).indexOf(p.tag) < 0) return false;
    if (p.hold) {
      var range = HOLD[Number(p.hold)];
      var next = HOLD[Number(p.hold) + 1];
      if (t.holdingSeconds === null || t.holdingSeconds < range.min || (next && t.holdingSeconds >= next.min)) return false;
    }
    if (p.venue && t.entryVenue !== p.venue) return false;
    if (p.rules === "broken" && !anyBroken(t)) return false;
    if (p.rules === "followed" && (results(t).length === 0 || anyBroken(t))) return false;
    // Open and transferred positions have no final P&L, so a P&L range only matches decided trades.
    if ((p.pnlMin || p.pnlMax) && t.outcome === null) return false;
    if (p.pnlMin && t.netPnl < lamports(p.pnlMin)) return false;
    if (p.pnlMax && t.netPnl > lamports(p.pnlMax)) return false;
    return true;
  }

  var VALUE = {
    opened_at: function (t) { return t.openedAt.getTime(); }, net_pnl: function (t) { return t.netPnl; }, roi: function (t) { return t.roi; },
    fees: function (t) { return t.feesTotal; }, hold: function (t) { return t.holdingSeconds; }, size: function (t) { return t.solIn; },
    entry_mc: function (t) { return t.entryMcSol; },
  };
  var cmp = function (a, b) { return a < b ? -1 : a > b ? 1 : 0; };

  /** ORDER BY: empty values last in both directions, then newest first, then key, so equal values keep their order. */
  function sortTrades(list, sort) {
    var get = VALUE[sort.key];
    var sign = sort.dir === "asc" ? 1 : -1;
    return list.slice().sort(function (a, b) {
      var x = get(a), y = get(b);
      if (x === null || y === null) { if (x !== y) return x === null ? 1 : -1; }
      else if (cmp(x, y) !== 0) return sign * cmp(x, y);
      return b.openedAt - a.openedAt || cmp(b.key, a.key);
    });
  }

  /** Net P&L and win rate of decided trades, rule compliance of reviewed ones (summarizeTrades). */
  function summary(list) {
    var decided = list.filter(M.isDecided);
    var wins = decided.filter(function (t) { return t.outcome === "win"; }).length;
    var losses = decided.filter(function (t) { return t.outcome === "loss"; }).length;
    var reviewed = list.filter(reviewedAt);
    var followed = reviewed.filter(function (t) { return !anyBroken(t); }).length;
    return {
      netPnl: SJ.format.sum(decided, function (t) { return t.netPnl; }), wins: wins, losses: losses,
      winRate: wins + losses ? wins / (wins + losses) : null, reviewed: reviewed.length,
      compliance: reviewed.length ? followed / reviewed.length : null,
    };
  }

  /** The list for these params: matching trades of the active wallet, sorted, one page of 50, plus the strip. */
  function query(params, pageSize) {
    var size = pageSize || PAGE_SIZE;
    var tz = S.settings().timeZone;
    var all = sortTrades(S.trades().filter(function (t) { return matches(t, params, tz); }), sortOf(params));
    var pageCount = Math.max(1, Math.ceil(all.length / size));
    var page = Math.min(params.page || 1, pageCount);
    return { all: all, rows: all.slice((page - 1) * size, page * size), total: all.length, page: page, pageCount: pageCount, pageSize: size, sort: sortOf(params), summary: summary(all) };
  }

  /** Chips for the filters that are set, each with the param it clears. */
  function activeFilters(p) {
    var name = function (kind, id) { return S.names(kind)[id] || "Unknown"; };
    return [
      p.q && ["q", "Search", p.q], p.from && ["from", "From", p.from], p.to && ["to", "To", p.to],
      p.strategy && ["strategy", "Strategy", name("strategies", p.strategy)], p.tag && ["tag", "Tag", name("tags", p.tag)],
      p.grade && ["grade", "Grade", p.grade], p.outcome && ["outcome", "Outcome", OUTCOME[p.outcome]],
      p.status && ["status", "Status", STATUS[p.status]], p.hold && ["hold", "Hold", HOLD[Number(p.hold)].label],
      p.venue && ["venue", "Venue", VENUE[p.venue]], p.reviewed && ["reviewed", "Review", REVIEWED[p.reviewed]],
      p.rules && ["rules", "Rules", RULES[p.rules]], p.pnlMin && ["pnlMin", "P&L min", p.pnlMin + " SOL"], p.pnlMax && ["pnlMax", "P&L max", p.pnlMax + " SOL"],
    ].filter(Boolean).map(function (f) { return { key: f[0], label: f[1], value: f[2] }; });
  }

  SJ.tradeList = {
    PAGE_SIZE: PAGE_SIZE, HOLD: HOLD, SORT: SORT, DIR: DIR, REVIEWED: REVIEWED, OUTCOME: OUTCOME, STATUS: STATUS, VENUE: VENUE,
    RULES: RULES, GRADES: GRADES, parse: parse, href: href, sortOf: sortOf, sortHref: sortHref, lamports: lamports,
    matches: matches, sortTrades: sortTrades, summary: summary, query: query, activeFilters: activeFilters,
    tradeHref: function (key) { return "#/trades/" + encodeURIComponent(key); },
    tokenHref: function (mint) { return "#/tokens/" + encodeURIComponent(mint); },
  };
})();
