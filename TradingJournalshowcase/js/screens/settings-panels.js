// The lower Settings cards: preferences, discipline limits, AI Coach status, backup, Needs relinking and the
// corrections list with Undo (app/(app)/settings/*). Forms validate like lib/validation/settings.ts and save in memory.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var f = SJ.format;
  var A = function (el, id) { return SJ.explain.anchor(el, id); };
  var SHORT = "MMM d, HH:mm";
  var LIVE_BACKUP = "GET /api/backup returns one JSON file (version 1) of the journal tables that cannot be re-imported from the chain: reflections, reviews, labels, corrections, allocations and settings. Raw transactions and positions are left out because a sync rebuilds them.";
  var RESTORE = [
    "Run pnpm backup:restore <file> --dry-run first: it validates the file with zod and refuses an unknown version.",
    "It refuses a target where you already have reflections, so nothing is overwritten.",
    "The real run inserts every table in one transaction, in dependency order.",
    "Then run a sync: the raw data is re-imported from the chain and positions are rebuilt.",
    "Reflections reference position keys, so they re-attach; missing screenshot files are listed.",
  ];
  var TYPE_LABEL = { MERGE: "Merge", SPLIT_AT: "Split", EXCLUDE_EVENT: "Exclude", WRITE_OFF: "Write off", RENT_LINK: "Rent link", RENT_UNLINK: "Rent unlink", VOID: "Void" };

  var int = function (v, min, max) { return /^\d+$/.test(v.trim()) && Number(v) >= min && Number(v) <= max; };
  var pct = function (v) { return /^\d{1,3}(\.\d{1,6})?$/.test(v.trim()) && Number(v) <= 100; };
  var isTimeZone = function (tz) {
    try { new Intl.DateTimeFormat("en", { timeZone: tz }); return tz.trim().length > 0; } catch (e) { return false; }
  };
  var solText = function (lamports) { return f.sol(lamports, { decimals: 9 }).replace(/\.?0+$/, ""); };

  /** A form card: fields from `spec`, checked on submit; the first error is shown and focused, a save redraws. */
  function formCard(o, notice) {
    var inputs = {};
    var error = h("p", { role: "alert", class: "text-body-sm text-loss", hidden: true });
    var grid = h("div", { class: "set-fields" }, o.fields.map(function (x) {
      var field = ui.input({ label: x.label, hint: x.hint, value: x.value, placeholder: x.placeholder, attrs: Object.assign({ name: x.name, inputmode: x.inputmode, list: x.list }, x.attrs) });
      inputs[x.name] = field.querySelector("input");
      return field;
    }));
    function submit(e) {
      e.preventDefault();
      var values = {};
      Object.keys(inputs).forEach(function (k) { values[k] = inputs[k].value.trim(); inputs[k].removeAttribute("aria-invalid"); });
      var bad = o.fields.filter(function (x) { return x.check && !x.check(values[x.name]); })[0];
      if (bad) {
        error.textContent = bad.message;
        error.hidden = false;
        inputs[bad.name].setAttribute("aria-invalid", "true");
        inputs[bad.name].focus();
        return;
      }
      // The save redraws the page, so its message is stored first and shown by the new card.
      SJ.screens.settings.view.notice[o.id] = { ok: true, text: o.message(values) };
      o.save(values);
    }
    return A(ui.card({ labelledby: o.id + "-title" }, [
      ui.cardHeader({ id: o.id + "-title", title: o.title }),
      h("form", { class: "set-form", onsubmit: submit, novalidate: true },
        o.intro && h("p", { class: "text-body-sm text-muted", text: o.intro }),
        grid, o.extra,
        h("div", { class: "form-foot" }, error, notice(o.id), h("button", { type: "submit", class: "btn btn-primary", "data-refocus": o.id + "-save", text: o.submit }))),
    ]), o.anchor);
  }

  function preferences(notice) {
    var s = SJ.store.settings();
    var zones = (Intl.supportedValuesOf ? Intl.supportedValuesOf("timeZone") : [s.timeZone]);
    return formCard({
      id: "prefs", anchor: "set-prefs", title: "Preferences", submit: "Save preferences",
      extra: h("datalist", { id: "set-timezones" }, zones.map(function (z) { return h("option", { value: z }); })),
      fields: [
        { name: "timezone", label: "Timezone", value: s.timeZone, list: "set-timezones", check: isTimeZone, message: "Unknown timezone." },
        { name: "dayStartHour", label: "Trading day starts at (hour)", hint: "Trades before this hour count toward the previous day.", value: String(s.dayStartHour), inputmode: "numeric", check: function (v) { return int(v, 0, 23); }, message: "Enter a whole hour from 0 to 23." },
        { name: "sessionGapMinutes", label: "Session gap (minutes)", hint: "A longer pause between trades starts a new session.", value: String(s.sessionGapMinutes), inputmode: "numeric", check: function (v) { return int(v, 1, 1440); }, message: "Enter 1 to 1440 minutes." },
        { name: "breakevenPct", label: "Breakeven band (%)", hint: "Closed trades within ± this ROI count as breakeven.", value: s.breakevenPct, inputmode: "decimal", check: pct, message: "Enter a percentage such as 1 or 0.5 (100 or less)." },
        { name: "dustPct", label: "Dust threshold (% of peak quantity)", value: s.dustPct, inputmode: "decimal", check: pct, message: "Enter a percentage such as 1 or 0.5 (100 or less)." },
        { name: "dustSol", label: "Dust threshold (SOL value)", value: solText(s.dustSolLamports), inputmode: "decimal", check: function (v) { return /^\d{1,4}(\.\d{1,9})?$/.test(v); }, message: "Enter a SOL amount such as 0.001." },
        { name: "autoSyncMinutes", label: "Auto-sync after (minutes)", hint: "Opening the app syncs if the last sync is older than this.", value: String(s.autoSyncMinutes), inputmode: "numeric", check: function (v) { return int(v, 1, 1440); }, message: "Enter 1 to 1440 minutes." },
      ],
      save: function (v) {
        SJ.actions.saveSettings({
          timeZone: v.timezone, dayStartHour: Number(v.dayStartHour), sessionGapMinutes: Number(v.sessionGapMinutes), breakevenPct: String(Number(v.breakevenPct)),
          dustPct: String(Number(v.dustPct)), dustSolLamports: SJ.reflection.solToLamports(v.dustSol), autoSyncMinutes: Number(v.autoSyncMinutes),
        });
      },
      message: function (v) { return "Saved. Positions were rebuilt with the new thresholds, and days are bucketed in " + v.timezone + "."; },
    }, notice);
  }

  function limits(notice) {
    var s = SJ.store.settings();
    return formCard({
      id: "limits", anchor: "set-limits", title: "Discipline limits", submit: "Save limits",
      intro: "Limits per trading day, shown on the dashboard and calendar as within or over. Leave a field blank for no limit.",
      fields: [
        { name: "maxTradesPerDay", label: "Max trades per day", placeholder: "No limit", value: s.maxTradesPerDay === null ? "" : String(s.maxTradesPerDay), inputmode: "numeric",
          check: function (v) { return v === "" || int(v, 1, 1000); }, message: "Enter a whole number from 1 to 1000, or leave it blank." },
        { name: "maxDailyLossSol", label: "Max daily loss (SOL)", hint: "Net P&L of the day's closed trades.", placeholder: "No limit", value: s.maxDailyLossLamports === null ? "" : solText(s.maxDailyLossLamports), inputmode: "decimal",
          check: function (v) { return v === "" || (/^\d{1,6}(\.\d{1,9})?$/.test(v) && Number(v) > 0); }, message: "Enter a SOL amount such as 1.5 (more than 0), or leave it blank." },
      ],
      save: function (v) {
        // Limits change no position, so nothing is rebuilt (saveLimits).
        SJ.actions.saveSettings({ maxTradesPerDay: v.maxTradesPerDay === "" ? null : Number(v.maxTradesPerDay), maxDailyLossLamports: v.maxDailyLossSol === "" ? null : SJ.reflection.solToLamports(v.maxDailyLossSol) });
      },
      message: function (v) { return v.maxTradesPerDay === "" && v.maxDailyLossSol === "" ? "Limits off." : "Saved. The calendar and the dashboard now count days against these limits."; },
    }, notice);
  }

  function coach() {
    var on = SJ.store.settings().coachEnabled;
    var u = SJ.system.coachUsage();
    return A(ui.card({ labelledby: "coach-status-title" }, [
      ui.cardHeader({ id: "coach-status-title", title: "AI Coach", actions: on ? ui.badge("On", "accent") : ui.badge("Off") }),
      on ? SJ.settings.dl([["Model", u.model || "—"], ["Runs this month", String(u.runs)], ["Spend this month", h("span", null, "$" + u.spendUsd + " ", h("span", { class: "text-body-sm text-muted", text: "USD" }))]], 3)
        : h("p", { class: "text-body-sm text-muted", text: "Not configured." }),
      h("p", { class: "text-body-sm text-muted set-note", text: "The Coach runs only when you press Generate. Runs and spend count this local month's critiques of trades, days, weeks and months (sample output in this demo)." }),
    ]), "set-coach");
  }

  function backup() {
    var button = ui.button({ label: "Download", icon: "download", size: "sm", attrs: { "data-refocus": "backup-download" }, onclick: function () {
      button.disabled = true;
      SJ.sim.run({ action: "Backup download", success: "Backup ready", live: LIVE_BACKUP, steps: ["Reading journal tables", "Writing the JSON file"] })
        .then(function () { button.disabled = false; });
    } });
    return A(ui.card({ labelledby: "backup-title" }, [
      ui.cardHeader({ id: "backup-title", title: "Backup", actions: button }),
      h("p", { class: "text-body-sm text-muted", text: "The file contains your private reflections, reviews and labels, so store it somewhere safe." }),
      h("details", { class: "set-details" },
        h("summary", { class: "text-body-sm text-muted" }, SJ.dom.icon("chevron-right", "hood-chevron"), "How restore works"),
        h("ol", { class: "set-steps text-body-sm" }, RESTORE.map(function (x) { return h("li", { text: x }); }))),
    ]), "set-backup");
  }

  function correctionText(c, tz) {
    if (c.type !== "RENT_LINK" && c.type !== "RENT_UNLINK") return SJ.tradeCorrections.target(c, tz);
    var e = SJ.store.data().events.filter(function (x) { return x.id === c.payload.parsedEventId; })[0];
    var token = e && e.mint && SJ.store.token(e.mint);
    var what = (token ? "$" + token.symbol : "Rent") + " · " + (e ? (e.rentRefunded > 0n ? "rent refund " : "rent paid ") + f.localTime(e.blockTime, tz, SHORT) : "event");
    return c.type === "RENT_LINK" ? what + " → linked by hand" : what + " → unlinked";
  }

  /** Every wallet's corrections, newest first, each undoable (the Inbox can void a trade of an earlier wallet). */
  function corrections() {
    var tz = SJ.store.settings().timeZone;
    var list = SJ.store.corrections();
    var title = h("h2", { id: "set-corr-title", class: "card-title", tabindex: "-1", "data-refocus": "set-corr-title", text: "Corrections" });
    return A(ui.card({ labelledby: "set-corr-title" }, [
      h("header", { class: "card-head" }, h("div", null, title, h("p", { class: "text-body-sm", text: "Manual fixes across all your wallets, replayed on every rebuild. Undo one and positions are rebuilt without it." }))),
      list.length === 0 ? h("p", { class: "text-body-sm text-muted", text: "No corrections yet." }) : h("ul", { class: "corr-list" }, list.map(function (c) {
        var key = c.payload.positionKey || c.payload.keep;
        return h("li", null, ui.badge(TYPE_LABEL[c.type] || c.type),
          h("span", { class: "corr-text" },
            key && c.type !== "VOID" && SJ.store.trade(key) ? h("a", { class: "link-under text-body-md", href: SJ.tradeList.tradeHref(key), text: correctionText(c, tz) }) : h("span", { class: "text-body-md text-fg", text: correctionText(c, tz) }),
            h("span", { class: "font-mono text-data-xs text-muted", text: "Added " + f.localTime(c.createdAt, tz, SHORT) })),
          ui.button({ label: "Undo", variant: "ghost", size: "sm", onclick: function () {
            title.focus();
            SJ.actions.undoCorrection(c.id);
            SJ.overlay.toast({ title: "Correction undone", body: "Positions were rebuilt.", tone: "success" });
          } }));
      })),
    ]), "set-corrections");
  }

  /** Reviews whose position no longer exists, with a target picker (relinkReflection). Hidden when there are none. */
  function relink() {
    var rows = SJ.system.orphans();
    if (!rows.length) return null;
    var tz = SJ.store.settings().timeZone;
    return ui.card({ labelledby: "relink-title" }, [
      ui.cardHeader({ id: "relink-title", title: "Needs relinking", description: "Reviews whose trade changed key after a merge, split or void. Move each to the right trade." }),
      h("ul", { class: "corr-list" }, rows.map(function (o) {
        var token = SJ.store.token(o.mint);
        var options = o.candidates.map(function (t) { return { value: t.key, label: t.status.replace("_", " ") + " · opened " + f.localTime(t.openedAt, tz, SHORT) + " · " + f.sol(t.netPnl, { signed: true }) + " SOL" }; });
        var pick = ui.select({ label: "Move to", options: options, value: options[0] ? options[0].value : "" });
        return h("li", { class: "set-relink" }, h("span", { class: "text-body-md text-fg", text: (token ? "$" + token.symbol : "Token") + " reflection" + (o.reflection.grade ? " · grade " + o.reflection.grade : "") }),
          options.length ? [pick, ui.button({ label: "Relink", size: "sm", onclick: function () { SJ.actions.relinkReflection(o.reflection.positionKey, pick.querySelector("select").value); } })]
            : h("span", { class: "text-body-sm text-muted", text: "No trade of this token without a review." }));
      })),
    ]);
  }

  SJ.settingsPanels = { preferences: preferences, limits: limits, coach: coach, backup: backup, corrections: corrections, relink: relink, LIVE_BACKUP: LIVE_BACKUP };
})();
