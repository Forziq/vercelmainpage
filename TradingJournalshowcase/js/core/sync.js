// The one client sync loop (the app's SyncProvider), shared by the header Sync button and the Settings panels. Each
// step is a short simulation (SJ.sim) followed by the store's sync step, so the data really changes: the transactions
// made after the last sync arrive, and every screen redraws from the store. Reset demo cancels a running loop.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var STEP_MS = 1500;
  var PAGE_MS = 700;
  var IMPORT_PAGES = 5;
  var LIVE_SYNC = "each step is POST /api/sync/step: one page of up to 100 transactions from Helius, parsed and stored in one database transaction under a per-wallet lock, then the touched tokens' positions are rebuilt.";
  var LIVE_IMPORT = "the first import loops the same step from the history start; the cursor is saved after every page, so pause, a refresh or an error resumes where it stopped.";

  var state = { phase: "idle", mode: null, pct: 0, step: null, message: null, page: 0, seq: 0 };
  var listeners = [];
  var emit = function () { listeners.slice().forEach(function (fn) { fn(state); }); };
  var set = function (patch) { state = Object.assign({}, state, patch); emit(); };
  function on(fn) {
    listeners.push(fn);
    return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
  }
  var busy = function () { return state.phase === "running"; };

  /** Incremental sync of the active wallet: one simulated step, then the store imports what is new. */
  function sync() {
    if (busy()) return Promise.resolve(null);
    var walletId = SJ.store.activeWallet().id;
    set({ phase: "running", mode: "incremental", pct: 0, step: "Fetching new transactions", message: null });
    return SJ.sim.run({
      action: "Sync", live: LIVE_SYNC, ms: STEP_MS, toast: false,
      steps: ["Fetching new transactions", "Parsing balance changes", "Rebuilding touched positions"],
      onProgress: function (fraction, step) { set({ pct: Math.round(fraction * 100), step: step }); },
    }).then(function (res) {
      if (!res.ok) { set({ phase: "idle", mode: null, pct: 0, step: null }); return null; }
      // The counter rises only for a step that imported something, before the store redraws the screens, so the
      // redraw that shows the new values also sees the new counter (SJ.motion.changed flashes what changed).
      var out = SJ.actions.syncStep(walletId, function (result) {
        if (result.new > 0) state = Object.assign({}, state, { seq: state.seq + 1 });
      });
      set({ phase: "idle", mode: null, pct: 100, step: null, message: out.new ? out.new + " new transaction" + (out.new === 1 ? "" : "s") + " imported." : "Already up to date." });
      SJ.overlay.toast({ title: out.new ? "Sync finished · " + out.new + " new" : "Sync finished · up to date", body: "Simulated. " + SJ.sim.LIVE_PREFIX + LIVE_SYNC, tone: "success" });
      return out;
    });
  }

  /**
   * Replays the first import page by page with pause and resume. Every page is already stored, so nothing new is
   * inserted: running a sync twice gives the same database state.
   */
  function startImport() {
    if (busy()) return;
    var walletId = SJ.store.activeWallet().id;
    var page = state.mode === "backfill" && state.phase === "paused" ? state.page : 0;
    set({ phase: "running", mode: "backfill", page: page, pct: Math.round((page / IMPORT_PAGES) * 100), step: null, message: null });
    (function next() {
      if (state.phase !== "running" || state.mode !== "backfill") return;
      SJ.sim.run({ action: "Import page", live: LIVE_IMPORT, ms: PAGE_MS, toast: false }).then(function (res) {
        if (!res.ok) { set({ phase: "idle", mode: null, page: 0, pct: 0 }); return; }
        var done = state.page + 1;
        var paused = state.phase === "paused";
        set({ page: done, pct: Math.round((done / IMPORT_PAGES) * 100) });
        if (done >= IMPORT_PAGES) {
          SJ.actions.recordImport(walletId, IMPORT_PAGES);
          set({ phase: "idle", mode: null, page: 0, pct: 100, message: "Import complete. " + IMPORT_PAGES + " pages read again, 0 new transactions." });
          SJ.overlay.toast({ title: "Import finished · 0 new", body: "Simulated. " + SJ.sim.LIVE_PREFIX + LIVE_IMPORT, tone: "success" });
        } else if (!paused) next();
      });
    })();
  }

  /** Stops after the page in flight; Resume continues from the next page (the saved cursor). */
  function pause() {
    if (state.mode === "backfill" && state.phase === "running") set({ phase: "paused", message: "Import paused." });
  }

  /** Reset demo: the loop forgets everything (its simulations are cancelled by SJ.sim.cancelAll). */
  function reset() { state = { phase: "idle", mode: null, pct: 0, step: null, message: null, page: 0, seq: 0 }; emit(); }

  /** shouldAutoSync (lib/sync/auto-sync.ts) for a wallet whose import is complete: on app open, only when the last success is older than auto_sync_minutes. */
  function shouldAutoSync(lastSuccessAt, minutes, now) {
    return !lastSuccessAt || now.getTime() - Date.parse(lastSuccessAt) >= minutes * 60000;
  }

  SJ.sync = {
    STEP_MS: STEP_MS, PAGE_MS: PAGE_MS, IMPORT_PAGES: IMPORT_PAGES, LIVE_SYNC: LIVE_SYNC, LIVE_IMPORT: LIVE_IMPORT,
    state: function () { return state; }, on: on, sync: sync, startImport: startImport, pause: pause, reset: reset, shouldAutoSync: shouldAutoSync,
  };
})();
