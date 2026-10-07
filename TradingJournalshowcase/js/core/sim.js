// Simulated server actions (docs/showcase.md §6). Every action that needs the server in the live app (sync, Coach
// Generate/Regenerate/Retry, screenshot upload, backup and Exports downloads, CSV export, Recalculate) goes through
// run(): a short delay with progress steps, then success or a sample failure. Each run must carry its
// "In the live app: …" note, which its result toast shows. Nothing leaves the browser.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var DEFAULT_MS = 1200;
  var LIVE_PREFIX = "In the live app: ";
  var pending = [];

  /** The "In the live app: …" line, for toasts, popovers and screens that show a simulated result. */
  function liveNote(text) {
    return h("p", { class: "live-note text-body-sm" }, SJ.dom.icon("info"), h("span", null, h("strong", { text: LIVE_PREFIX }), text));
  }

  function notify(o, result) {
    if (o.toast === false) return;
    if (result.ok) SJ.overlay.toast({ title: o.success || o.action + " finished", body: "Simulated. " + LIVE_PREFIX + o.live, tone: "success" });
    else SJ.overlay.toast({ title: o.failure || o.action + " failed", body: result.error + " " + LIVE_PREFIX + o.live, tone: "error" });
  }

  /**
   * o: { action, live (required), steps ([labels]), ms (total, default 1200), fail (true gives the sample failure),
   *      error (its message), success / failure (toast titles), toast (false when the screen shows the result),
   *      onProgress(fraction, step) }
   * Resolves { ok: true }, { ok: false, error } or, after cancelAll(), { ok: false, cancelled: true }; never rejects.
   */
  function run(o) {
    if (!o || typeof o.live !== "string" || !o.live.trim()) throw new Error("SJ.sim.run needs its In the live app note (o.live)");
    if (!o.action) throw new Error("SJ.sim.run needs an action name");
    var steps = o.steps && o.steps.length ? o.steps : [o.action];
    var each = (o.ms === undefined ? DEFAULT_MS : o.ms) / steps.length;
    var progress = function (fraction, step) { if (o.onProgress) o.onProgress(fraction, step); };
    return new Promise(function (resolve) {
      var job = { timer: null };
      var i = 0;
      job.finish = function (result) {
        clearTimeout(job.timer);
        pending = pending.filter(function (j) { return j !== job; });
        resolve(result);
      };
      function next() {
        if (i < steps.length) {
          progress(i / steps.length, steps[i]);
          i += 1;
          job.timer = setTimeout(next, each);
          return;
        }
        var result = o.fail ? { ok: false, error: o.error || "This is a sample failure." } : { ok: true };
        if (result.ok) progress(1, null);
        notify(o, result);
        job.finish(result);
      }
      pending.push(job);
      next();
    });
  }

  /** Stops every running simulation (Reset demo); their callers get { cancelled: true } and change nothing. */
  function cancelAll() {
    pending.slice().forEach(function (job) { job.finish({ ok: false, cancelled: true }); });
  }

  SJ.sim = {
    DEFAULT_MS: DEFAULT_MS, LIVE_PREFIX: LIVE_PREFIX, run: run, cancelAll: cancelAll, liveNote: liveNote,
    running: function () { return pending.length; },
  };
})();
