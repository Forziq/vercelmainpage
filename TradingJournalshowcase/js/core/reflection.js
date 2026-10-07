// Review helpers shared by the Inbox and trade detail: the review keyboard map (lib/keyboard.ts), the rule
// auto-checks (lib/rules/autoChecks.ts), planned R:R and realised R (lib/finance/risk.ts), and per-trade form drafts
// that survive the page redraws a store change causes (cleared by Reset demo).
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var GRADES = ["A", "B", "C", "D", "F"];
  var TEXT_TAGS = { INPUT: 1, TEXTAREA: 1, SELECT: 1 };
  var LETTERS = { s: "skip", j: "next", k: "prev" };

  var isTextEntry = function (el) { return !!el && (el.isContentEditable === true || !!TEXT_TAGS[el.tagName]); };

  /**
   * 1–5 → grades A–F, Enter → save, S → skip, J/K → next/previous. Nothing fires while typing, with Cmd/Ctrl/Alt held
   * or inside an open dialog; Enter on a link does nothing. Returns { type, grade? } or null.
   */
  function keyAction(e) {
    var target = e.target && e.target.nodeType === 1 ? e.target : null;
    var inDialog = !!(target && target.closest && target.closest('[aria-modal="true"]'));
    if (e.metaKey || e.ctrlKey || e.altKey || inDialog || isTextEntry(target)) return null;
    var i = "12345".indexOf(e.key);
    if (e.key.length === 1 && i >= 0) return { type: "grade", grade: GRADES[i] };
    if (e.key === "Enter") return target && target.tagName === "A" ? null : { type: "save" };
    var letter = LETTERS[String(e.key).toLowerCase()];
    return letter ? { type: letter } : null;
  }

  // ---- Rule auto-checks (reflection-analytics.md §4): suggestions only, never saved without "Mark broken".

  /** "0.5" SOL as lamports (fractions of a lamport dropped). */
  function solToLamports(text) {
    var parts = String(text).split(".");
    return BigInt(parts[0] || "0") * 1000000000n + BigInt(((parts[1] || "") + "000000000").slice(0, 9));
  }

  function evaluate(rule, t, ctx) {
    var limit = rule.threshold === null ? NaN : Number(rule.threshold);
    if (!(limit > 0)) return null;
    if (rule.type === "MAX_TRADES_PER_SESSION") {
      return ctx.numberInSession > limit ? "Trade " + ctx.numberInSession + " of its session (limit " + rule.threshold + ")" : null;
    }
    if (rule.type === "NO_ENTRY_AFTER_N_LOSSES") {
      var losses = ctx.streakBefore && ctx.streakBefore.kind === "loss" ? ctx.streakBefore.length : 0;
      return losses > 0 && limit <= losses ? "Entered after " + losses + " loss" + (losses === 1 ? "" : "es") + " in a row that day (limit " + rule.threshold + ")" : null;
    }
    if (rule.type === "MAX_LOSS_PER_TRADE" && t.outcome !== null) {
      if (rule.thresholdUnit === "pct") return t.roi !== null && t.roi < -limit / 100 ? "ROI " + SJ.format.pct(t.roi) + " is below −" + rule.threshold + "%" : null;
      return t.netPnl < -solToLamports(rule.threshold) ? "Net P&L " + SJ.format.sol(t.netPnl, { signed: true }) + " SOL is below −" + rule.threshold + " SOL" : null;
    }
    return null;
  }

  /** Every active auto-checked rule that looks broken on `t`: [{ ruleId, reason }]. */
  function suggestions(t) {
    var ctx = SJ.store.contexts(t.walletId)[t.key];
    if (!ctx) return [];
    return SJ.store.vocab("rules").map(function (r) { var reason = evaluate(r, t, ctx); return reason && { ruleId: r.id, reason: reason }; }).filter(Boolean);
  }

  // ---- Planned R:R and realised R, from the draft's levels (plain numbers, display only)

  /** level { mode: "mc" | "pct", value: text } → { mc, pct } with numbers or null. */
  function planLevel(level) {
    var text = String(level.value).trim().replace(/^\+/, "");
    var n = /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : null;
    return { mc: level.mode === "mc" ? n : null, pct: level.mode === "pct" ? n : null };
  }

  /** { planned, realised } for the draft levels; either is null when it cannot be computed. */
  function rr(target, stop, entryMc, roi) {
    var A = SJ.analytics;
    var s = planLevel(stop);
    var stopPct = A.levelPct(s, entryMc);
    var risk = stopPct !== null && stopPct < 0 ? -stopPct / 100 : null;
    return { planned: A.plannedRR(planLevel(target), s, entryMc), realised: roi === null || risk === null ? null : roi / risk };
  }
  var fmtR = function (r, signed) { return r === null ? SJ.format.DASH : (signed && r > 0 ? "+" : "") + r.toFixed(2) + "R"; };

  // ---- Drafts and small UI state per trade, kept until saved or until Reset demo replaces the data

  var bag = {};
  var bagFor = null;
  function stateOf(key) {
    if (bagFor !== SJ.store.data()) { bag = {}; bagFor = SJ.store.data(); }
    return bag[key] || (bag[key] = {});
  }

  SJ.reflection = {
    GRADES: GRADES, keyAction: keyAction, isTextEntry: isTextEntry, solToLamports: solToLamports,
    evaluate: evaluate, suggestions: suggestions, planLevel: planLevel, rr: rr, fmtR: fmtR, stateOf: stateOf,
  };
})();
