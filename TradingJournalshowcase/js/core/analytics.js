// Analytics helpers beyond SJ.metrics (ports of lib/analytics: ROI bins, groupBy with sample gating, planned R:R,
// calendar days, discipline limits) and the dashboard assembler (server/services/dashboard.ts), all reading SJ.store.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var M = SJ.metrics;
  var S = SJ.store;
  var MIN_SAMPLE = 10;
  var ROI_EDGES = [-50, -25, -10, 0, 10, 25, 50, 100, 200];
  var RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90, all: null };

  var sol = function (lamports) { return Number(lamports) / 1e9; };
  var dayOf = function (t, s) { return M.tradingDay(t.openedAt, s.timeZone, s.dayStartHour); };

  // ---- ROI bins (lib/analytics/buckets.ts)

  function roiBinLabel(index) {
    var lo = ROI_EDGES[index - 1];
    var hi = ROI_EDGES[index];
    if (lo === undefined) return "<" + hi + "%";
    return hi === undefined ? "≥" + lo + "%" : lo + " to " + hi + "%";
  }

  /** Index of the ROI bin, lower bound inclusive, decided exactly on the lamport ratio; null without ROI. */
  function roiBin(t) {
    if (!t.roiParts) return null;
    var num = t.roiParts.num * 100n;
    var den = t.roiParts.den;
    return ROI_EDGES.reduce(function (found, edge, i) { return num >= BigInt(edge) * den ? i + 1 : found; }, 0);
  }

  // ---- Groups with sample gating (§6)

  /**
   * Decided trades split by `bucketsOf(t)` → [{ key, label, order }]; a trade may sit in several groups. Rows come in
   * bucket order with n, enoughData (n ≥ 10) and the §11 summary of the group.
   */
  function groupBy(trades, bucketsOf, reviewedOnly) {
    var groups = {};
    trades.forEach(function (t) {
      if (!M.isDecided(t) || (reviewedOnly && !M.isReviewed(t))) return;
      bucketsOf(t).forEach(function (b) { (groups[b.key] = groups[b.key] || { bucket: b, trades: [] }).trades.push(t); });
    });
    return Object.keys(groups).map(function (k) { return groups[k]; })
      .sort(function (a, b) { return a.bucket.order - b.bucket.order || a.bucket.label.localeCompare(b.bucket.label); })
      .map(function (g) {
        var s = M.summarize(g.trades);
        return { bucket: g.bucket, n: s.trades, enoughData: s.trades >= MIN_SAMPLE, summary: s, totalNetPnl: s.netPnl };
      });
  }

  // ---- Planned R:R (lib/finance/risk.ts), as plain numbers for display

  function levelPct(level, entryMc) {
    if (level.pct !== null) return Number(level.pct);
    if (level.mc === null || entryMc === null || !(entryMc > 0)) return null;
    return ((Number(level.mc) - entryMc) / entryMc) * 100;
  }
  function plannedRR(target, stop, entryMc) {
    var reward = levelPct(target, entryMc);
    var stopPct = levelPct(stop, entryMc);
    if (reward === null || stopPct === null || !(stopPct < 0)) return null;
    return reward / 100 / (-stopPct / 100);
  }
  /** Mean planned R:R of reviewed trades with both levels; null when none has them. */
  function avgPlannedRR(trades) {
    var rr = trades.filter(function (t) { return t.review; })
      .map(function (t) { return plannedRR(t.review.plannedTarget, t.review.plannedStop, t.entryMcSol); })
      .filter(function (v) { return v !== null; });
    return rr.length ? rr.reduce(function (a, b) { return a + b; }, 0) / rr.length : null;
  }

  // ---- Calendar days and discipline limits (lib/analytics/calendar.ts, discipline.ts)

  /** Per trading day of entry: entered (every position), decided, wins, losses, net P&L (decided), fees. */
  function aggregateDays(trades, s) {
    var out = {};
    trades.forEach(function (t) {
      var d = out[dayOf(t, s)] = out[dayOf(t, s)] || { day: dayOf(t, s), entered: 0, decided: 0, wins: 0, losses: 0, netPnl: 0n, fees: 0n };
      d.entered++;
      d.fees += t.feesTotal;
      if (!M.isDecided(t)) return;
      d.decided++;
      d.netPnl += t.netPnl;
      if (t.outcome === "win") d.wins++;
      if (t.outcome === "loss") d.losses++;
    });
    return out;
  }

  var limitsOf = function (s) { return { maxTradesPerDay: s.maxTradesPerDay === undefined ? null : s.maxTradesPerDay, maxDailyLossLamports: s.maxDailyLossLamports === undefined ? null : s.maxDailyLossLamports }; };
  var hasLimits = function (l) { return l.maxTradesPerDay !== null || l.maxDailyLossLamports !== null; };

  /** One day against the limits; reaching a limit exactly is still within it. `within` is null with no limit set. */
  function checkDay(day, stats, limits) {
    var entered = stats ? stats.entered : 0;
    var net = stats ? stats.netPnl : 0n;
    var trades = limits.maxTradesPerDay === null ? null : { value: entered, limit: limits.maxTradesPerDay, within: entered <= limits.maxTradesPerDay };
    var loss = limits.maxDailyLossLamports === null ? null : { value: net, limit: limits.maxDailyLossLamports, within: net >= -limits.maxDailyLossLamports };
    var checks = [trades, loss].filter(Boolean);
    return { day: day, trades: trades, loss: loss, within: checks.length ? checks.every(function (c) { return c.within; }) : null };
  }

  /** "Days within your limits: N of M" over days with an entry; null when no limit is set. */
  function summarizeLimits(days, limits) {
    if (!hasLimits(limits)) return null;
    var within = days.filter(function (d) { return checkDay(d.day, d, limits).within; }).length;
    return { days: days.length, within: within };
  }

  function describeLimits(l) {
    var parts = [
      l.maxTradesPerDay === null ? null : l.maxTradesPerDay + " " + (l.maxTradesPerDay === 1 ? "trade" : "trades"),
      l.maxDailyLossLamports === null ? null : SJ.format.sol(l.maxDailyLossLamports) + " SOL loss",
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") + " per day" : null;
  }

  // ---- Dashboard (reflection-analytics.md §5)

  /** Failed swaps no position holds, in the wallet since `from`. */
  function orphanFailed(walletId, from) {
    var linked = S.derive().linked;
    return S.data().events.filter(function (e) {
      return e.walletId === walletId && e.kind === "FAILED_SWAP" && !linked[e.id] && (!from || Date.parse(e.blockTime) >= from);
    });
  }

  function named(rows, names) {
    return rows.map(function (r) { return { label: (names[r.bucket.key] || "Unknown") + " (" + r.n + ")", name: names[r.bucket.key] || "Unknown", n: r.n, value: sol(r.totalNetPnl), enough: r.enoughData }; })
      .sort(function (a, b) { return b.value - a.value; });
  }

  /** The headline totals in EUR at each transaction's rate (loadRangeEur); `to` (exclusive) is optional. */
  function rangeEur(walletId, trades, from, orphans, to) {
    var F = SJ.fiat;
    var d = S.data();
    var all = trades.map(F.position);
    var netPnl = F.sum(all.filter(function (p, i) { return trades[i].outcome !== null; }).map(function (p) { return p.netPnl; }));
    var fees = F.sum([F.sum(all.map(function (p) { return p.fees; })), F.amounts(orphans.map(function (e) { return { amount: S.eventFees(e), at: e.blockTime }; }))]);
    var keys = {};
    trades.forEach(function (t) { keys[t.key] = true; });
    var aliases = S.derive().aliases;
    var claimAt = {};
    d.events.forEach(function (e) { claimAt[e.id] = e.blockTime; });
    var rebates = F.amounts(d.allocations.filter(function (a) { var t = aliases[a.positionKey]; return t && keys[t.key]; })
      .map(function (a) { return { amount: a.lamports, at: claimAt[a.claimEventId] }; }));
    var excluded = {};
    d.corrections.forEach(function (c) { if (c.type === "EXCLUDE_EVENT") excluded[c.payload.parsedEventId] = true; });
    var reclaim = F.amounts(d.events.filter(function (e) {
      var at = Date.parse(e.blockTime);
      return e.walletId === walletId && e.kind === "RENT_RECLAIM" && !excluded[e.id] && (!from || at >= from) && (!to || at < to);
    }).map(function (e) { return { amount: S.eventFees(e), at: e.blockTime }; }));
    return { netPnl: netPnl, fees: fees, rebates: rebates, reclaimFees: reclaim, netAfterRebates: F.sum([netPnl, rebates, reclaim === null ? null : -reclaim]) };
  }

  /** Everything the dashboard shows for a range ("7d" | "30d" | "90d" | "all") of the active wallet. */
  function dashboard(range) {
    var s = S.settings();
    var walletId = S.activeWallet().id;
    var from = S.rangeStart(RANGE_DAYS[range]);
    var trades = S.trades({ walletId: walletId, from: from });
    var decided = trades.filter(M.isDecided);
    var today = M.tradingDay(S.now(), s.timeZone, s.dayStartHour);
    var firstDay = from ? M.tradingDay(from, s.timeZone, s.dayStartHour) : trades.reduce(function (min, t) { return min === null || dayOf(t, s) < min ? dayOf(t, s) : min; }, null);

    var pnlByDay = {};
    M.dailyNetPnl(trades, s).forEach(function (d) { pnlByDay[d[0]] = d[1]; });
    var countByDay = {};
    trades.forEach(function (t) { countByDay[dayOf(t, s)] = (countByDay[dayOf(t, s)] || 0) + 1; });
    var running = 0n;
    var daily = [];
    for (var day = firstDay; day !== null && day <= today; day = M.shiftDay(day, 1)) {
      running += pnlByDay[day] || 0n;
      daily.push({ day: day, netPnl: sol(pnlByDay[day] || 0n), cumulative: sol(running), trades: countByDay[day] || 0 });
    }
    var weeks = {};
    var weekOrder = [];
    daily.forEach(function (d) {
      var week = M.shiftDay(d.day, 1 - M.weekdayOf(d.day));
      if (!(week in weeks)) { weeks[week] = 0n; weekOrder.push(week); }
      weeks[week] += pnlByDay[d.day] || 0n;
    });

    var roiCounts = {};
    decided.forEach(function (t) { var b = roiBin(t); if (b !== null) roiCounts[b] = (roiCounts[b] || 0) + 1; });
    var hours = {};
    decided.forEach(function (t) {
      var hr = M.localHour(t.openedAt, s.timeZone);
      hours[hr] = hours[hr] || { pnl: 0n, n: 0 };
      hours[hr].pnl += t.netPnl;
      hours[hr].n++;
    });

    var mistakes = S.names("tags", function (v) { return v.polarity === "mistake"; });
    var byStrategy = groupBy(trades, function (t) { return t.review.strategyId ? [{ key: t.review.strategyId, label: t.review.strategyId, order: 0 }] : []; }, true);
    var byMistake = groupBy(trades, function (t) {
      return t.review.tagIds.filter(function (id) { return mistakes[id] !== undefined; }).map(function (id) { return { key: id, label: id, order: 0 }; });
    }, true);

    var orphans = orphanFailed(walletId, from);
    var summary = M.summarize(trades);
    var rebates = SJ.format.sum(trades, function (t) { return S.rebateOf(t.key); });
    var reclaimFees = S.reclaimFees(walletId, from, null);
    var limits = limitsOf(s);
    var days = aggregateDays(trades, s);
    return {
      range: range, from: from, trades: trades, needsReview: S.needsReview(), entered: trades.length,
      open: trades.filter(function (t) { return t.status === "open"; }).length,
      summary: summary, avgPlannedRR: avgPlannedRR(trades),
      feesTotal: SJ.format.sum(trades, function (t) { return t.feesTotal; }) + SJ.format.sum(orphans, S.eventFees),
      rebates: rebates, reclaimFees: reclaimFees, netAfterRebates: summary.netPnl + rebates - reclaimFees,
      days: M.bestWorstDay(trades, s), streak: M.currentStreak(trades), daily: daily,
      weekly: weekOrder.map(function (w) { return { week: w, netPnl: sol(weeks[w]) }; }),
      roiDistribution: ROI_EDGES.concat([null]).map(function (edge, order) {
        return { label: roiBinLabel(order), count: roiCounts[order] || 0, sign: order === 0 || ROI_EDGES[order - 1] < 0 ? -1 : 1 };
      }),
      byStrategy: named(byStrategy, S.names("strategies")), byMistake: named(byMistake, mistakes),
      byHour: Array.from({ length: 24 }, function (_, hr) { return { hour: hr, netPnl: sol(hours[hr] ? hours[hr].pnl : 0n), n: hours[hr] ? hours[hr].n : 0 }; }),
      limits: limits, daysWithinLimits: summarizeLimits(Object.keys(days).map(function (k) { return days[k]; }), limits),
      eur: rangeEur(walletId, trades, from, orphans),
    };
  }

  SJ.analytics = {
    MIN_SAMPLE: MIN_SAMPLE, ROI_EDGES: ROI_EDGES, RANGE_DAYS: RANGE_DAYS, roiBinLabel: roiBinLabel, roiBin: roiBin,
    groupBy: groupBy, levelPct: levelPct, plannedRR: plannedRR, avgPlannedRR: avgPlannedRR, aggregateDays: aggregateDays,
    limitsOf: limitsOf, hasLimits: hasLimits, checkDay: checkDay, summarizeLimits: summarizeLimits,
    describeLimits: describeLimits, orphanFailed: orphanFailed, rangeEur: rangeEur, dashboard: dashboard,
  };
})();
