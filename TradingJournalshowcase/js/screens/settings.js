// Settings (#/settings, app/(app)/settings): wallet with Change wallet, the import and sync status panels driven by the
// shared sync loop (SJ.sync), the Rent & cashback link, then the forms in settings-panels.js. Everything is in memory.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var f = SJ.format;
  var A = function (el, id) { return SJ.explain.anchor(el, id); };
  var SHORT = "MMM d, HH:mm";
  var B58 = /^[1-9A-HJ-NP-Za-km-z]+$/;
  var SECRET_WARNING = "That looks like a private key or recovery phrase. It was cleared and not sent anywhere. Never share it — enter your public wallet address instead.";
  var PRESETS = [{ value: "all", label: "All history" }, { value: "30d", label: "Last 30 days" }, { value: "90d", label: "Last 90 days" }, { value: "custom", label: "From a date" }];
  // Page state that survives the redraw after a save (the store change redraws the whole page).
  var view = { changing: false, notice: {} };

  /** looksLikeSecret (lib/validation/wallet.ts): a keypair (87–88 base58 characters or a byte array), a hex key or a 12–24 word phrase. */
  function looksLikeSecret(raw) {
    var input = raw.trim();
    if (!input) return false;
    var words = input.split(/\s+/);
    if (words.length >= 12 && words.length <= 24 && words.every(function (w) { return /^[a-z]+$/i.test(w); })) return true;
    if (/^\[\s*\d{1,3}(\s*,\s*\d{1,3}){31,}\s*,?\s*\]$/.test(input)) return true;
    if (/^(0x)?([0-9a-f]{64}|[0-9a-f]{128})$/i.test(input)) return true;
    return B58.test(input) && (input.length === 87 || input.length === 88);
  }

  /** ok | secret | invalid | real (a well-formed address that is not one of the demo's invented wallets). */
  function checkAddress(raw) {
    var a = raw.trim();
    if (looksLikeSecret(a)) return { kind: "secret" };
    var demo = SJ.store.wallets().filter(function (w) { return w.address === a; })[0];
    if (demo) return { kind: "ok", wallet: demo };
    return a.length >= 32 && a.length <= 44 && B58.test(a) ? { kind: "real" } : { kind: "invalid" };
  }

  var notice = function (key) {
    var n = view.notice[key];
    delete view.notice[key];
    return n ? h("p", { role: n.ok ? "status" : "alert", class: SJ.dom.cx("text-body-sm", n.ok ? "text-muted" : "text-loss"), text: n.text }) : null;
  };
  var dl = function (items, cols) {
    return h("dl", { class: "set-grid set-grid-" + (cols || 2) }, items.map(function (x) {
      return h("div", { class: "set-item" }, h("dt", { class: "text-label-sm text-muted", text: x[0] }), h("dd", { class: SJ.dom.cx("font-mono text-data-md", x[2] ? "text-warning" : "text-fg") }, x[1]));
    }));
  };

  // ---- Wallet

  function walletCard() {
    var w = SJ.store.activeWallet();
    var tz = SJ.store.settings().timeZone;
    if (!view.changing) {
      return A(ui.card({ labelledby: "wallet-title" }, [
        ui.cardHeader({ id: "wallet-title", title: "Wallet", description: "The public address trades are imported from.",
          actions: ui.button({ label: "Change wallet", onclick: function () { view.changing = true; SJ.router.refresh(); var el = document.querySelector("[data-refocus='wallet-input']"); if (el) el.focus(); }, attrs: { "data-refocus": "change-wallet" } }) }),
        dl([["Public address", ui.address({ value: w.address, label: "wallet address", full: true, explorer: explorerToast })],
          ["History from", f.localTime(w.historyStart, tz, "yyyy-MM-dd")]]),
        h("p", { class: "text-body-sm text-muted set-note" }, ui.badge(w.label), " Read-only: the address is public, and the app never asks for a key."),
        notice("wallet"),
      ]), "set-wallet");
    }
    var warning = h("p", { role: "alert", class: "set-warning text-body-sm", hidden: true }, SJ.dom.icon("alert-triangle"), h("span", { text: SECRET_WARNING }));
    var error = h("p", { role: "alert", class: "text-body-sm text-loss", hidden: true });
    var preset = "all";
    var dateField = ui.input({ label: "Start date", attrs: { type: "date" }, className: "set-date" });
    dateField.hidden = true;
    var addr = ui.input({ label: "Public wallet address", placeholder: "e.g. Dem0…", attrs: { autocomplete: "off", spellcheck: "false", class: "input font-mono", "data-refocus": "wallet-input" },
      oninput: function (e) {
        if (!looksLikeSecret(e.target.value)) return;
        // Secret-looking input is dropped on entry, so it never sits in state or reaches anything.
        e.target.value = "";
        warning.hidden = false;
      } });
    var input = addr.querySelector("input");
    var picks = h("div", { class: "chip-row" }, SJ.store.wallets().map(function (x) {
      return h("button", { type: "button", class: "chip", onclick: function () { input.value = x.address; input.focus(); } }, x.label);
    }));
    function submit(e) {
      e.preventDefault();
      error.hidden = true;
      var check = checkAddress(input.value);
      var show = function (text) { error.textContent = text; error.hidden = false; };
      if (check.kind === "secret") { input.value = ""; warning.hidden = false; return; }
      if (check.kind === "invalid") return show("That is not a valid Solana wallet address.");
      if (check.kind === "real") return show("That looks like a valid address. In the live app saving it starts a new import; this demo only knows its two invented wallets.");
      if (preset === "custom" && !dateField.querySelector("input").value) return show("Pick a start date.");
      var switched = check.wallet.id !== SJ.store.activeWallet().id;
      view.changing = false;
      view.notice.wallet = { ok: true, text: switched ? "Switched to " + check.wallet.label + ". Its trades, reviews and history start are back; nothing was deleted." : "This wallet is already active." };
      // The earlier wallet's history start is fixed once a transaction is imported, so the preset changes nothing here.
      SJ.actions.changeWallet(check.wallet.address);
      SJ.sync.sync();
    }
    return A(ui.card({ labelledby: "wallet-title" }, [
      ui.cardHeader({ id: "wallet-title", title: "Wallet", description: "Public address only. Never enter a private key or recovery phrase." }),
      h("form", { class: "set-form", onsubmit: submit },
        addr, warning,
        h("div", { class: "field" }, h("span", { class: "field-label text-label-sm", "aria-hidden": "true", text: "Demo wallets (fictional)" }), picks),
        h("div", { class: "field" }, h("span", { class: "field-label text-label-sm", "aria-hidden": "true", text: "Import history from" }),
          ui.segmented({ label: "Import history from", options: PRESETS, value: preset, onChange: function (v) { preset = v; dateField.hidden = v !== "custom"; } })),
        dateField,
        h("p", { class: "text-body-sm text-muted", text: "Your current wallet's trades and reflections are kept, not deleted. Enter its address again later to switch back; its history start stays as it was." }),
        error,
        h("div", { class: "form-foot" },
          ui.button({ label: "Cancel", variant: "ghost", onclick: function () { view.changing = false; SJ.router.refresh(); var b = document.querySelector("[data-refocus='change-wallet']"); if (b) b.focus(); } }),
          h("button", { type: "submit", class: "btn btn-primary", text: "Save and start import" }))),
    ]), "set-wallet");
  }

  function explorerToast() {
    SJ.overlay.toast({ title: "Explorer link", body: "In the live app this opens the address on a block explorer. The demo's addresses are invented, so it stays here." });
  }

  // ---- Import and sync status (redrawn in place while the loop runs)

  function importCard() {
    var meta = h("span");
    var bar = h("div");
    var text = h("p", { class: "text-body-sm text-muted set-note" });
    var actions = h("div", { class: "card-head-side" });
    function paint() {
      var s = SJ.sync.state();
      var importing = s.mode === "backfill" && s.phase === "running";
      var paused = s.mode === "backfill" && s.phase === "paused";
      var pct = s.mode === "backfill" ? s.pct : 100;
      meta.textContent = pct.toFixed(1) + "%";
      SJ.dom.clear(bar).appendChild(ui.progress({ label: "Import progress", value: pct }));
      text.textContent = importing ? "Importing… page " + (s.page + 1) + " of " + SJ.sync.IMPORT_PAGES + ". " + pct.toFixed(1) + "% of the time range covered."
        : paused ? "Import paused. " + pct.toFixed(1) + "% of the time range covered; Resume continues from the next page."
          : (s.mode === null && s.message && /Import/.test(s.message) ? s.message : "Import complete.") + " Replay it to watch the page loop: every page is already stored, so nothing is added twice.";
      SJ.dom.clear(actions).appendChild(importing
        ? ui.button({ label: "Pause", icon: "pause", size: "sm", onclick: SJ.sync.pause, attrs: { "data-refocus": "import-toggle" } })
        : ui.button({ label: paused ? "Resume" : "Replay import", icon: "play", size: "sm", disabled: s.phase === "running", onclick: SJ.sync.startImport, attrs: { "data-refocus": "import-toggle" } }));
    }
    var card = A(ui.card({ labelledby: "import-title" }, [
      h("header", { class: "card-head" }, h("div", null, h("h2", { id: "import-title", class: "card-title", text: "Import" })), h("div", { class: "card-head-side" }, h("span", { class: "text-data-xs text-muted" }, meta), actions)),
      bar, text,
    ]), "set-import");
    paint();
    follow(card, paint);
    return card;
  }

  /** Keeps a card in step with the sync loop until it leaves the page. */
  function follow(node, paint) {
    var stop = SJ.sync.on(function () {
      if (!node.isConnected) { stop(); return; }
      var focused = document.activeElement && node.contains(document.activeElement) ? document.activeElement.getAttribute("data-refocus") : null;
      paint();
      var again = focused && node.querySelector("[data-refocus='" + focused + "']");
      if (again) again.focus();
    });
  }

  function statusCard() {
    var w = SJ.store.activeWallet();
    var tz = SJ.store.settings().timeZone;
    var d = SJ.store.data();
    var badge = h("span");
    var since = h("span");
    var failures = d.rawFailures.filter(function (x) { return x.walletId === w.id; });
    var unsupported = d.events.filter(function (e) { return e.walletId === w.id && e.kind === "UNSUPPORTED"; }).length;
    var q = SJ.system.unlinked(w.id);
    var unlinked = q.payments.length + q.rent.length;
    var txs = SJ.system.transactionCount(w.id);
    var month = f.localTime(SJ.store.now(), tz, "yyyy-MM");
    var pages = d.syncRuns.filter(function (r) { return r.walletId === w.id && f.localTime(r.startedAt, tz, "yyyy-MM") === month; }).length;
    var newTokens = d.tokens.filter(function (t) { return f.localTime(t.createdAt, tz, "yyyy-MM") === month; }).length;
    // About 3 KB per stored transaction; about 10 credits per history page and per token-age lookup (wallet-sync.md §2).
    var mb = (txs * 3 / 1024).toFixed(1);
    function paint() {
      var s = SJ.sync.state();
      var running = s.phase === "running";
      SJ.dom.clear(badge).appendChild(running ? ui.badge("Running · " + s.mode, "accent") : ui.badge("Idle"));
      since.textContent = running ? (s.step || "Working") + " · " + s.pct + "%" : "—";
    }
    var card = A(ui.card({ labelledby: "sync-status-title" }, [
      ui.cardHeader({ id: "sync-status-title", title: "Sync status", actions: badge }),
      dl([
        ["Last successful sync", w.sync && w.sync.lastSuccessAt ? f.localTime(w.sync.lastSuccessAt, tz, SHORT) : "Never"],
        ["Running", since],
        ["Transactions", String(txs)],
        ["Parse failures", String(failures.length), failures.length > 0],
        ["Unsupported", String(unsupported), unsupported > 0],
        ["Unlinked SOL", String(unlinked), unlinked > 0],
        ["Database size (est.)", "≈ " + mb + " MB / 500 MB"],
        ["Helius credits (month, est.)", "≈ " + ((pages + newTokens) * 10).toLocaleString("en-US")],
      ], 3),
      h("p", { class: "text-body-sm text-muted set-note", text: "Credits are estimated from history pages and token lookups this month. The live panel reads the real database size." }),
      failures.length > 0 && h("details", { class: "set-details" },
        h("summary", { class: "text-body-sm text-muted" }, SJ.dom.icon("chevron-right", "hood-chevron"), "Parse failures"),
        h("ul", null, failures.map(function (x) {
          return h("li", { class: "set-failure" }, h("span", { class: "font-mono text-data-xs text-muted", text: f.localTime(x.blockTime, tz, SHORT) }),
            h("span", { class: "font-mono text-data-xs text-fg", text: f.shortAddress(x.signature, 8) }), h("span", { class: "text-body-sm text-muted", text: x.error }));
        }))),
    ]), "set-status");
    paint();
    follow(card, paint);
    return card;
  }

  function solCard() {
    var q = SJ.system.unlinked(SJ.store.activeWallet().id);
    var n = q.payments.length + q.rent.length;
    return ui.card({ labelledby: "sol-title" }, [
      ui.cardHeader({ id: "sol-title", title: "Rent & cashback", actions: h("a", { class: "btn btn-secondary btn-sm", href: "#/settings/sol", text: "Open" + (n > 0 ? " · " + n + " unlinked" : "") }) }),
      h("p", { class: "text-body-sm text-muted", text: "Label incoming SOL, allocate cashback to trades as rebates, and relink or unlink rent." }),
    ]);
  }

  function render() {
    SJ.router.watch(SJ.router.refresh);
    var P = SJ.settingsPanels;
    return h("div", { class: "page page-narrow" },
      SJ.router.pageHeader("Settings", "Wallet, import and how trades are bucketed and classified."),
      walletCard(), importCard(), statusCard(), solCard(),
      P.preferences(notice), P.limits(notice), P.coach(), P.backup(), P.relink(), P.corrections());
  }

  SJ.screens = SJ.screens || {};
  SJ.screens.settings = { render: render, view: view };
  SJ.settings = { looksLikeSecret: looksLikeSecret, checkAddress: checkAddress, view: view, dl: dl };
})();
