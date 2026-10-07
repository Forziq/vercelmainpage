// Corrections on trade detail (components/trades/CorrectionsMenu, CorrectionPreview, CorrectionsList): Merge, Split,
// Exclude and Write off open a dialog with a dry-run preview of the affected positions; saving adds a correction row
// to the store, which rebuilds the positions. The live app lists them for undo in Settings → Corrections; the demo
// shows that list on the trade itself.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var f = SJ.format;
  var L = SJ.tradeList;
  var S = SJ.store;
  var QTY = { BUY: 1, SELL: 1, TOKEN_IN: 1, TOKEN_OUT: 1 };
  var SHORT = "MMM d, HH:mm";
  var COPY = {
    merge: ["Merge with…", "Both positions become one under the older key. A reflection on the newer one moves to Needs relinking in Settings.", "Merge positions", "combine", "MERGE"],
    split: ["Split here", "A new position starts at this event. This position keeps its key and its reflection.", "Split position", "scissors", "SPLIT_AT"],
    exclude: ["Exclude event", "The engine ignores this event when it rebuilds the position. Raw data is not changed; undo it under Corrections.", "Exclude event", "ban", "EXCLUDE_EVENT"],
    write_off: ["Write off position", "The remaining basis is booked as a realised loss now and the position closes as written off.", "Write off", "trash-2", "WRITE_OFF"],
    void: ["Void trade", "The trade is removed from Trades, P&L and analytics, along with its fees and rent. Raw data is not changed; undo it right after in the Inbox or under Corrections on a trade of this token.", "Void trade", "circle-slash", "VOID"],
  };
  var DETAIL_KINDS = ["merge", "split", "exclude", "write_off"];

  var sig = function (key) { return f.shortAddress(key.split(":")[2] || key); };
  var mintOf = function (key) { return key.split(":")[1]; };
  var opened = function (p, tz) { return "opened " + f.localTime(p.openedAt, tz, SHORT); };

  /** Events offered by Exclude and Split; the opening fill cannot start a split (the position already starts there). */
  function eventOptions(t, tz) {
    var list = S.positionEvents(t.key);
    var first = list.filter(function (e) { return e.role === "fill" && QTY[e.kind]; })[0];
    return list.map(function (e) {
      return { id: String(e.id), event: e, label: f.localTime(e.blockTime, tz, "MMM d, HH:mm:ss") + " · " + e.kind + " · " + f.shortAddress(e.signature), splittable: e.role === "fill" && !!QTY[e.kind] && e !== first };
    });
  }

  /** The other positions of this token in this wallet; only direct neighbours can merge (an engine limit). */
  function mergeCandidates(t, tz) {
    var all = S.trades({ walletId: t.walletId }).filter(function (x) { return x.mint === t.mint; }).sort(M_byEntry);
    var at = all.indexOf(t);
    return all.filter(function (x) { return x !== t; }).map(function (x) {
      return {
        trade: x, label: L.STATUS[x.status] + " · " + opened(x, tz),
        detail: x.buyCount + " buys, " + x.sellCount + " sells · " + f.sol(x.netPnl, { signed: true }) + " SOL · " + sig(x.key),
        blocked: Math.abs(all.indexOf(x) - at) === 1 ? null : "Not next to this position. Merge the ones in between first.",
      };
    });
  }
  var M_byEntry = function (a, b) { return SJ.metrics.byEntry(a, b); };

  /** The correction row a dialog would save, or null until the choice is complete. */
  function request(kind, t, choice) {
    if (kind === "write_off") return { type: "WRITE_OFF", payload: { positionKey: t.key, at: S.now().toISOString() } };
    if (kind === "void") return { type: "VOID", payload: { positionKey: t.key } };
    if (kind === "merge") {
      if (!choice.other) return null;
      var pair = [t, choice.other].sort(M_byEntry);
      return { type: "MERGE", payload: { keep: pair[0].key, absorb: pair[1].key } };
    }
    if (!choice.event) return null;
    return kind === "split" ? { type: "SPLIT_AT", payload: { positionKey: t.key, signature: choice.event.signature } } : { type: "EXCLUDE_EVENT", payload: { parsedEventId: choice.event.id } };
  }

  // ---- Preview table: value alone when unchanged, otherwise before → after; New / Removed for created or dropped rows.

  function state(p) {
    return { status: L.STATUS[p.status], solIn: f.sol(p.solIn), solOut: f.sol(p.solOut), netPnl: f.sol(p.netPnl, { signed: true }), sign: f.signOf(p.netPnl), breakeven: p.outcome === "breakeven" };
  }
  function change(row, field, draw) {
    var show = draw || function (s) { return s[field]; };
    var b = row.before, a = row.after;
    if (b && a && b[field] === a[field]) return show(a);
    return h("span", { class: "change" },
      b ? show(b) : h("span", { class: "text-muted", text: field === "status" ? "New" : f.DASH }),
      h("span", { class: "text-muted", "aria-label": "becomes", text: "→" }),
      a ? show(a) : h("span", { class: "text-muted", text: field === "status" ? "Removed" : f.DASH }));
  }
  function previewTable(rows, tz) {
    var view = rows.map(function (r) {
      var p = r.after || r.before;
      var token = S.token(p.mint);
      return { key: r.key, label: (token ? "$" + token.symbol : f.shortAddress(p.mint)) + " · " + opened(p, tz), detail: sig(r.key), before: r.before && state(r.before), after: r.after && state(r.after) };
    });
    var pnl = function (s) { return ui.pnlValue({ value: s.netPnl, sign: s.sign, neutral: s.breakeven }); };
    return ui.dataTable({
      caption: "Positions this correction changes", rows: view, rowKey: function (r) { return r.key; },
      columns: [
        { key: "position", header: "Position", cell: function (r) { return h("span", { class: "corr-text" }, h("span", { class: "text-body-sm text-fg", text: r.label }), h("span", { class: "font-mono text-data-xs text-muted", text: r.detail })); } },
        { key: "status", header: "Status", cell: function (r) { return change(r, "status"); } },
        { key: "in", header: "SOL in", numeric: true, cell: function (r) { return change(r, "solIn"); } },
        { key: "out", header: "SOL out", numeric: true, cell: function (r) { return change(r, "solOut"); } },
        { key: "pnl", header: "Net P&L", numeric: true, cell: function (r) { return change(r, "netPnl", pnl); } },
      ],
    });
  }

  /** After a save or undo: stay when the position still exists, else follow it to the key that now holds it. */
  function follow(key) {
    if (S.trade(key)) return;
    var alias = S.derive().aliases[key];
    window.location.hash = alias ? L.tradeHref(alias.key) : "#/trades";
  }

  /** `onSaved(row)` replaces following the position (the Inbox stays where it is). */
  function open(kind, t, tz, onSaved) {
    var copy = COPY[kind];
    var choice = { event: null, other: null };
    var events = eventOptions(t, tz).filter(function (e) { return kind !== "split" || e.splittable; });
    var preview = h("section", { class: "corr-dialog", "aria-label": "Preview" });
    var error = h("p", { role: "alert", class: "text-body-sm text-loss", hidden: true });
    var fields = [];
    if (kind === "split" || kind === "exclude") {
      choice.event = events[0] ? events[0].event : null;
      fields.push(ui.select({ label: kind === "split" ? "New position starts at" : "Event", value: events[0] ? events[0].id : "", options: events.map(function (e) { return { value: e.id, label: e.label }; }),
        onchange: function (e) { choice.event = events.filter(function (x) { return x.id === e.target.value; })[0].event; update(); } }));
    }
    if (kind === "merge") {
      var candidates = mergeCandidates(t, tz);
      var listEl = h("fieldset", { class: "corr-options" });
      var draw = function (query) {
        var q = query.trim().toLowerCase();
        var found = candidates.filter(function (c) { return (c.label + " " + c.detail + " " + c.trade.key).toLowerCase().indexOf(q) >= 0; });
        SJ.dom.clear(listEl).appendChild(h("legend", { class: "sr-only", text: "Position to merge with" }));
        if (!found.length) listEl.appendChild(h("p", { class: "text-body-sm text-muted", text: "No matching positions." }));
        found.forEach(function (c) {
          var radio = h("input", { type: "radio", name: "merge-with", value: c.trade.key, disabled: c.blocked !== null, checked: choice.other === c.trade });
          radio.addEventListener("change", function () { choice.other = c.trade; draw(query); update(); });
          listEl.appendChild(h("label", { class: SJ.dom.cx("corr-option", c.blocked && "is-blocked", choice.other === c.trade && "is-chosen") }, radio,
            h("span", { class: "corr-option-text" }, h("span", { class: "text-body-md text-fg", text: c.label }), h("span", { class: "font-mono text-data-xs text-muted", text: c.blocked || c.detail }))));
        });
      };
      fields.push(ui.input({ label: "Search positions of this token", search: true, placeholder: "Date, status, signature…", oninput: function (e) { draw(e.target.value); } }), listEl);
      draw("");
    }

    function update() {
      var req = request(kind, t, choice);
      SJ.dom.clear(preview);
      if (!req) return;
      var res = SJ.actions.previewCorrection(t.walletId, req.type, req.payload);
      preview.appendChild(h("h3", { class: "text-label-sm text-muted uppercase", text: "Preview · nothing is saved yet" }));
      preview.appendChild(res.error ? h("p", { class: "text-body-sm text-warning", text: res.error }) : previewTable(res.rows, tz));
    }

    function submit() {
      var req = request(kind, t, choice);
      if (!req) return show(kind === "merge" ? "Pick a position to merge with." : "Pick an event.");
      var check = SJ.actions.previewCorrection(t.walletId, req.type, req.payload);
      if (check.error) return show(check.error);
      // Close first so focus is back on the button before the page redraws around it.
      modal.close();
      var row = SJ.actions.applyCorrection(t.walletId, req.type, req.payload);
      if (onSaved) return onSaved(row);
      SJ.overlay.toast({ title: copy[0] + ": saved", body: "Positions were rebuilt. Undo it under Corrections on this page.", tone: "success" });
      follow(t.key);
    }
    function show(message) { error.textContent = message; error.hidden = false; }

    var modal = SJ.overlay.modal({
      title: copy[0], description: copy[1], body: h("div", { class: "corr-dialog" }, fields, preview, error),
      footer: [ui.button({ label: "Cancel", variant: "ghost", onclick: function () { modal.close(); } }),
        ui.button({ label: copy[2], variant: kind === "write_off" || kind === "void" ? "danger" : "primary", onclick: submit })],
    });
    update();
  }

  /**
   * The action buttons (the app shows Write off only while the position is open). `kinds` picks the buttons (the
   * Inbox card has Merge and Void) and `onSaved` keeps the caller in place after a save.
   */
  function menu(t, tz, kinds, onSaved) {
    var events = eventOptions(t, tz);
    var show = kinds || DETAIL_KINDS;
    var disabled = {
      merge: mergeCandidates(t, tz).length === 0, split: !events.some(function (e) { return e.splittable; }), exclude: events.length === 0, write_off: false, void: false,
    };
    var group = h("div", { class: "btn-row", role: "group", "aria-label": "Corrections" }, show.filter(function (k) { return k !== "write_off" || t.status === "open"; }).map(function (kind) {
      return ui.button({ label: COPY[kind][0], icon: COPY[kind][3], size: "sm", disabled: disabled[kind], onclick: function () { open(kind, t, tz, onSaved); }, attrs: { "data-refocus": "corr-" + kind } });
    }));
    return kinds ? group : SJ.explain.anchor(group, "td-corrections");
  }

  /** What a correction points at, in words. */
  function target(c, tz) {
    var p = c.payload;
    var key = p.positionKey || p.keep;
    var event = p.parsedEventId !== undefined ? S.data().events.filter(function (e) { return e.id === p.parsedEventId; })[0] : null;
    var mint = key ? mintOf(key) : event && event.mint;
    var token = mint && S.token(mint);
    var name = token ? "$" + token.symbol : "Unknown token";
    if (c.type === "MERGE") return name + " · " + sig(p.absorb) + " merged into " + sig(p.keep);
    if (c.type === "SPLIT_AT") return name + " · split at " + f.shortAddress(p.signature);
    if (c.type === "WRITE_OFF") return name + " · written off " + f.localTime(p.at, tz, SHORT);
    if (c.type === "VOID") return name + " · position " + sig(p.positionKey) + " voided";
    return name + " · " + (event ? event.kind + " at " + f.localTime(event.blockTime, tz, SHORT) : "event") + " excluded";
  }

  /** Saved corrections that touch this token, newest first; Undo deletes one and the store rebuilds. */
  function list(t, tz) {
    var mine = S.corrections([t.walletId]).filter(function (c) {
      var p = c.payload;
      var keys = [p.positionKey, p.keep, p.absorb].filter(Boolean);
      if (keys.some(function (k) { return mintOf(k) === t.mint; })) return true;
      var e = p.parsedEventId !== undefined && S.data().events.filter(function (x) { return x.id === p.parsedEventId; })[0];
      return !!e && e.mint === t.mint;
    });
    var title = h("h2", { id: "corrections-title", class: "card-title", tabindex: "-1", "data-refocus": "corrections-title", text: "Corrections" });
    return SJ.explain.anchor(ui.card({ labelledby: "corrections-title", padding: "lg" }, [
      h("header", { class: "card-head" }, h("div", null, title, h("p", { class: "text-body-sm", text: "Manual fixes for this token, replayed on every rebuild. Raw data is never changed." }))),
      mine.length === 0
        ? h("p", { class: "text-body-sm text-muted", text: "No corrections on this token. Use Merge, Split, Exclude or Write off above to add one." })
        : h("ul", { class: "corr-list" }, mine.map(function (c) {
          return h("li", null, ui.badge(c.type), h("span", { class: "corr-text" }, h("span", { class: "text-body-md text-fg", text: target(c, tz) }), h("span", { class: "font-mono text-data-xs text-muted", text: f.localTime(c.createdAt, tz, SHORT) })),
            ui.button({ label: "Undo", variant: "ghost", size: "sm", onclick: function () {
              title.focus();
              SJ.actions.undoCorrection(c.id);
              SJ.overlay.toast({ title: "Correction undone", body: "Positions were rebuilt.", tone: "success" });
              follow(t.key);
            } }));
        })),
    ]), "td-undo");
  }

  SJ.tradeCorrections = { menu: menu, list: list, request: request, mergeCandidates: mergeCandidates, eventOptions: eventOptions, target: target };
})();
