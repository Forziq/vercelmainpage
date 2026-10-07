// Write actions of the demo store. Each one changes the in-memory rows and calls changed(), so every derived view
// (Inbox count, dashboard "needs review", positions after a correction) is recomputed from the rows, as in the app.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var S = SJ.store;
  var M = SJ.metrics;
  var P = SJ.periods;
  var seq = 0;
  var newId = function (prefix) { seq++; return prefix + "-demo0" + seq; };
  var iso = function (d) { return d.toISOString(); };

  function fail(message) { var e = new Error(message); e.demo = true; throw e; }
  var find = function (list, pred) { return list.filter(pred)[0]; };

  /**
   * Quick review (reflection-analytics.md §1): grade is the only required field. Every active rule gets a result
   * (followed unless marked broken); results of inactive rules from an earlier save are kept.
   */
  function saveQuickReview(key, input) {
    var t = S.trade(key);
    if (!t) fail("Trade not found.");
    if (!input || ["A", "B", "C", "D", "F"].indexOf(input.grade) < 0) fail("Pick a grade.");
    var d = S.data();
    var at = iso(S.tick());
    var broken = input.brokenRuleIds || [];
    var auto = input.autoConfirmedRuleIds || [];
    var r = find(d.reflections, function (x) { return x.positionKey === key; });
    if (!r) { r = { positionKey: key, createdAt: at, full: null, ruleResults: [] }; d.reflections.push(r); }
    var active = S.vocab("rules").map(function (x) { return x.id; });
    var kept = r.ruleResults.filter(function (x) { return active.indexOf(x.ruleId) < 0; });
    r.ruleResults = kept.concat(active.map(function (id) {
      var isBroken = broken.indexOf(id) >= 0 || auto.indexOf(id) >= 0;
      return { ruleId: id, followed: !isBroken, source: auto.indexOf(id) >= 0 ? "auto_confirmed" : "manual" };
    }));
    ["grade", "strategyId", "emotionId", "confidence", "terminal", "lesson", "notes"].forEach(function (f) {
      r[f] = input[f] === undefined ? (f === "grade" ? null : r[f] === undefined ? null : r[f]) : input[f];
    });
    r.tagIds = (input.tagIds || []).slice();
    // The Inbox omits `full`, which leaves the stored pre/post fields untouched.
    if (input.full) r.full = input.full;
    var f = r.full || {};
    r.plannedTarget = { mc: f.plannedTargetMc || null, pct: f.plannedTargetPct || null };
    r.plannedStop = { mc: f.plannedStopMc || null, pct: f.plannedStopPct || null };
    r.reviewedAt = r.reviewedAt || at;
    r.updatedAt = at;
    S.changed();
    return r;
  }

  // ---- Vocabularies (strategies, tags, rules, emotions): names unique per kind; delete archives an item in use.

  function inUse(kind, id) {
    var refl = S.data().reflections;
    if (kind === "strategies") return refl.some(function (r) { return r.strategyId === id; });
    if (kind === "tags") return refl.some(function (r) { return r.tagIds.indexOf(id) >= 0; });
    if (kind === "rules") return refl.some(function (r) { return r.ruleResults.some(function (x) { return x.ruleId === id; }); });
    return refl.some(function (r) { return r.emotionId === id; });
  }

  function saveVocab(kind, fields, id) {
    var list = S.data().vocab[kind];
    var name = String(fields.name || "").trim();
    if (!name) fail("Enter a name.");
    var clash = find(list, function (v) { return v.id !== id && v.name.toLowerCase() === name.toLowerCase(); });
    if (clash) fail("That name already exists.");
    var item = id ? find(list, function (v) { return v.id === id; }) : null;
    if (id && !item) fail("Item not found.");
    if (!item) { item = { id: newId(kind.slice(0, 3)), archived: false }; list.push(item); }
    Object.keys(fields).forEach(function (k) { item[k] = k === "name" ? name : fields[k]; });
    S.changed();
    return item;
  }

  function deleteVocab(kind, id) {
    var list = S.data().vocab[kind];
    var item = find(list, function (v) { return v.id === id; });
    if (!item) fail("Item not found.");
    if (inUse(kind, id)) item.archived = true;
    else list.splice(list.indexOf(item), 1);
    S.changed();
    return item.archived ? "archived" : "deleted";
  }

  // ---- Corrections (wallet-sync.md §9): previewed by replaying the wallet with the new row, refused if skipped.

  function previewCorrection(walletId, type, payload) {
    var draft = { id: "preview", walletId: walletId, type: type, payload: payload, createdAt: iso(S.now()) };
    var current = S.data().corrections.filter(function (c) { return c.walletId === walletId; });
    var before = S.buildWallet(walletId, current);
    var after = S.buildWallet(walletId, current.concat([draft]));
    var rows = function (res) {
      var out = {};
      res.positions.forEach(function (p) { out[p.key] = p; });
      return out;
    };
    var b = rows(before);
    var a = rows(after);
    var keys = Object.keys(b).concat(Object.keys(a).filter(function (k) { return !b[k]; }));
    var diff = keys.filter(function (k) {
      return !a[k] || !b[k] || a[k].status !== b[k].status || a[k].netPnl !== b[k].netPnl || a[k].feesTotal !== b[k].feesTotal;
    }).map(function (k) { return { key: k, before: b[k] || null, after: a[k] || null }; });
    var skipped = after.skippedCorrections.indexOf("preview") >= 0;
    return { rows: diff, error: skipped ? "This correction would change nothing, so it cannot be saved." : null };
  }

  function applyCorrection(walletId, type, payload) {
    var preview = previewCorrection(walletId, type, payload);
    if (preview.error) fail(preview.error);
    var row = { id: newId("cor"), walletId: walletId, type: type, payload: payload, createdAt: iso(S.tick()) };
    S.data().corrections.push(row);
    S.changed();
    return row;
  }

  function undoCorrection(id) {
    var list = S.data().corrections;
    var row = find(list, function (c) { return c.id === id; });
    if (!row) fail("Correction not found.");
    list.splice(list.indexOf(row), 1);
    S.changed();
  }

  // ---- Daily, weekly and monthly reviews

  function saveDailyReview(day, fields) {
    var list = S.data().dailyReviews;
    var row = find(list, function (r) { return r.day === day; });
    if (!row) { row = { day: day, createdAt: iso(S.now()) }; list.push(row); }
    Object.keys(fields).forEach(function (k) { row[k] = fields[k]; });
    row.updatedAt = iso(S.tick());
    S.changed();
    return row;
  }

  var periodList = function (kind) { return kind === "week" ? S.data().weeklyReviews : S.data().monthlyReviews; };
  var startField = function (kind) { return kind === "week" ? "weekStart" : "monthStart"; };

  /** Fresh frozen stats for a week or month of the active wallet (what "Recalculate stats" stores). */
  function periodStats(kind, start) {
    var s = S.settings();
    var wallet = S.activeWallet().id;
    var first = kind === "week" ? M.shiftDay(start, -21) : P.shiftMonth(start, -1);
    var end = kind === "week" ? M.shiftDay(start, 7) : P.shiftMonth(start, 1);
    var bound = function (day) { return M.tradingDayStart(day, s.timeZone, s.dayStartHour); };
    var all = S.trades({ walletId: wallet, from: bound(first), to: bound(end) });
    var input = S.periodInput(wallet, bound(start), bound(end));
    return kind === "week" ? P.buildWeeklyStats(start, all, s, input) : P.buildMonthlyStats(start, all, s, input);
  }

  function savePeriodText(kind, start, fields) {
    var row = find(periodList(kind), function (r) { return r[startField(kind)] === start; });
    if (!row) fail("Review not found.");
    ["keyLessons", "patternsNoticed", "notes"].forEach(function (k) { if (fields[k] !== undefined) row[k] = fields[k]; });
    row.updatedAt = iso(S.tick());
    S.changed();
    return row;
  }

  /** Replaces the frozen snapshot and keeps the text. */
  function recalculate(kind, start) {
    var row = find(periodList(kind), function (r) { return r[startField(kind)] === start; });
    if (!row) fail("Review not found.");
    row.stats = periodStats(kind, start);
    // Like replaceWeeklyStats: only the snapshot and its time change; the text and its saved time stay.
    row.statsAt = iso(S.tick());
    S.changed();
    return row;
  }

  /**
   * The review of an ended week or month, created as a draft with frozen stats on the first visit (openWeeklyReview).
   * Called while the page renders, so it does not notify subscribers; nothing derived depends on review rows.
   */
  function openPeriodReview(kind, start) {
    var row = find(periodList(kind), function (r) { return r[startField(kind)] === start; });
    if (row) return row;
    var at = iso(S.tick());
    row = { stats: periodStats(kind, start), keyLessons: null, patternsNoticed: null, notes: null, createdAt: at, updatedAt: at };
    row[startField(kind)] = start;
    periodList(kind).push(row);
    return row;
  }

  // ---- Wallet, settings, Unlinked SOL labels

  /** Change wallet: re-activates an earlier wallet by address, or adds a new (empty) one. Nothing is deleted. */
  function changeWallet(address) {
    var a = String(address || "").trim();
    if (a.length < 32 || a.length > 44) fail("Enter a wallet address (32 to 44 characters).");
    var d = S.data();
    var w = find(d.wallets, function (x) { return x.address === a; });
    var at = iso(S.tick());
    if (!w) { w = { id: newId("wallet"), address: a, label: "New wallet", createdAt: at, historyStart: at, sync: null }; d.wallets.push(w); }
    w.activatedAt = at;
    S.changed();
    return w;
  }

  function saveSettings(patch) {
    var s = S.data().settings;
    Object.keys(patch).forEach(function (k) { s[k] = patch[k]; });
    S.changed();
    return s;
  }

  function setCounterpartyLabel(walletId, address, label, name) {
    var list = S.data().counterparties;
    var row = find(list, function (c) { return c.walletId === walletId && c.address === address; });
    if (row) list.splice(list.indexOf(row), 1);
    if (label) list.push({ walletId: walletId, address: address, label: label, name: name || (row && row.name) || "" });
    S.changed();
  }

  // ---- Screenshots, Coach critiques and confirmed Coach tags (in memory, like everything in the demo)

  /** o: { kind, width, height, url (a local object URL) | svg }. Nothing is uploaded anywhere. */
  function addScreenshot(key, o) {
    if (!S.trade(key)) fail("Trade not found.");
    if (["pre_entry", "exit", "other"].indexOf(o.kind) < 0) fail("Pick a screenshot kind.");
    var row = { id: newId("shot"), positionKey: key, kind: o.kind, width: o.width, height: o.height, createdAt: iso(S.tick()), url: o.url || null, svg: o.svg || null };
    S.data().screenshots.push(row);
    S.changed();
    return row;
  }

  function deleteScreenshot(id) {
    var list = S.data().screenshots;
    var row = find(list, function (x) { return x.id === id; });
    if (!row) fail("Screenshot not found.");
    list.splice(list.indexOf(row), 1);
    S.changed();
  }

  /** Writes the trade's critique; only the latest one per position is kept (ai-coach.md §2). */
  function saveCoachRow(key, fields) {
    var list = S.data().coach.trade;
    var old = find(list, function (c) { return c.positionKey === key; });
    if (old) list.splice(list.indexOf(old), 1);
    var row = Object.assign({ positionKey: key, startedAt: iso(S.tick()) }, fields);
    list.push(row);
    S.changed();
    return row;
  }

  /** A confirmed Coach tag becomes an ordinary tag on the review; the review's reviewed time does not change. */
  function confirmCoachTag(key, name, polarity) {
    var r = find(S.data().reflections, function (x) { return x.positionKey === key && x.reviewedAt; });
    if (!r) fail("Save the review first.");
    var tag = find(S.vocab("tags"), function (v) { return v.polarity === polarity && v.name.toLowerCase() === name.toLowerCase(); });
    if (!tag) fail("That tag is not in your list.");
    if (r.tagIds.indexOf(tag.id) < 0) r.tagIds = r.tagIds.concat(tag.id);
    S.changed();
    return tag;
  }

  SJ.actions = {
    saveQuickReview: saveQuickReview, saveVocab: saveVocab, deleteVocab: deleteVocab, inUse: inUse,
    previewCorrection: previewCorrection, applyCorrection: applyCorrection, undoCorrection: undoCorrection,
    saveDailyReview: saveDailyReview, periodStats: periodStats, savePeriodText: savePeriodText, recalculate: recalculate, openPeriodReview: openPeriodReview,
    changeWallet: changeWallet, saveSettings: saveSettings, setCounterpartyLabel: setCounterpartyLabel,
    addScreenshot: addScreenshot, deleteScreenshot: deleteScreenshot, saveCoachRow: saveCoachRow, confirmCoachTag: confirmCoachTag,
  };
})();
