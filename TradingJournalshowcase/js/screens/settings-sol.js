// Rent & cashback (#/settings/sol, app/(app)/settings/sol): the Unlinked SOL queue, cashback claims with the allocation
// dialog, labelled senders and rent links with Relink / Unlink (saved as corrections). Active wallet, in memory.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var f = SJ.format;
  var A = function (el, id) { return SJ.explain.anchor(el, id); };
  var SHORT = "MMM d, HH:mm";
  var PAGE = 25;
  var KINDS = [{ value: "cashback", label: "Cashback" }, { value: "deposit", label: "Deposit" }, { value: "withdrawal", label: "Withdrawal" }, { value: "ignore", label: "Ignore" }];
  var KIND_LABEL = { cashback: "Cashback", deposit: "Deposit", withdrawal: "Withdrawal", ignore: "Ignore" };
  var METHODS = [{ value: "fee_prorata", label: "By fees" }, { value: "even", label: "Even" }, { value: "manual", label: "Manual" }];
  var STATE = { none: ["Not allocated", "warning"], partial: ["Partly allocated", "warning"], full: ["Allocated", null] };

  var tz = function () { return SJ.store.settings().timeZone; };
  var when = function (at) { return f.localTime(at, tz(), SHORT); };
  var tokenName = function (mint) { var t = mint && SJ.store.token(mint); return t ? "$" + t.symbol : mint ? f.shortAddress(mint) : "unknown token"; };
  var amount = function (text) { return h("span", { class: "font-mono text-data-sm text-fg" }, ui.solText(text + " SOL")); };
  var rentWhat = function (e) { return (e.rentRefunded > 0n ? "Rent refund" : "Rent paid") + " · " + tokenName(e.mint) + " · " + e.kind.replace(/_/g, " ").toLowerCase(); };
  var rentAmount = function (e) { return f.sol(e.rentRefunded - e.rentPaid, { decimals: 6, signed: true }); };
  var positionOption = function (t) { return { value: t.key, label: tokenName(t.mint) + " · " + t.status.replace("_", " ") + " · opened " + when(t.openedAt) + " · " + f.sol(t.netPnl, { signed: true }) + " SOL" }; };
  var guard = function (fn, done) {
    try { fn(); if (done) SJ.overlay.toast({ title: done, tone: "success" }); } catch (e) { SJ.overlay.toast({ title: "Not saved", body: e.message, tone: "error" }); }
  };
  var list = function (rows) { return h("ul", { class: "sol-list" }, rows); };
  var empty = function (title, body) { return ui.emptyState({ title: title, body: body }); };

  function queue(walletId) {
    var q = SJ.system.unlinked(walletId);
    var by = {};
    var order = [];
    q.payments.slice().sort(function (a, b) { return b.blockTime.localeCompare(a.blockTime); }).forEach(function (e) {
      if (!by[e.counterparty]) { by[e.counterparty] = { address: e.counterparty, payments: 0, total: 0n, latest: e.blockTime }; order.push(e.counterparty); }
      by[e.counterparty].payments++;
      by[e.counterparty].total += e.swapSol;
    });
    var senderItem = function (s) {
      var kind = ui.select({ label: "Label as", options: KINDS, value: "cashback" });
      var name = ui.input({ label: "Name (optional)", placeholder: "e.g. Terminal cashback", attrs: { maxlength: "60" } });
      return h("li", { class: "sol-item" },
        h("div", { class: "sol-row" }, ui.address({ value: s.address, label: "sender" }), amount(f.sol(s.total))),
        h("p", { class: "text-body-sm text-muted", text: s.payments + " payment" + (s.payments === 1 ? "" : "s") + " · latest " + when(s.latest) }),
        h("div", { class: "sol-controls" }, kind, name, ui.button({ label: "Save label", variant: "primary", onclick: function () {
          guard(function () { SJ.actions.labelSender(walletId, s.address, kind.querySelector("select").value, name.querySelector("input").value.trim()); }, "Sender labelled");
        } })));
    };
    var rentItem = function (e) {
      var options = SJ.system.rentCandidates(walletId, e).map(positionOption);
      var pick = ui.select({ label: "Link to", options: options, value: options[0] ? options[0].value : "" });
      return h("li", { class: "sol-item" },
        h("div", { class: "sol-row" }, h("span", { class: "text-body-md text-fg", text: rentWhat(e) }), amount(rentAmount(e))),
        h("p", { class: "font-mono text-data-xs text-muted", text: when(e.blockTime) }),
        options.length ? h("div", { class: "sol-controls" }, pick, ui.button({ label: "Link", onclick: function () {
          guard(function () { SJ.actions.setRentLink(walletId, e.id, pick.querySelector("select").value); }, "Rent linked");
        } })) : h("p", { class: "text-body-sm text-muted", text: "No position to link it to." }));
    };
    var n = q.payments.length + q.rent.length;
    return A(ui.card({ labelledby: "unlinked-title" }, [
      ui.cardHeader({ id: "unlinked-title", title: "Unlinked SOL", description: "Label a sender once and it applies to all of its past and future payments.", meta: n ? n + " items" : null }),
      n === 0 ? empty("Nothing to sort", "Every incoming payment has a labelled sender and all rent is linked.") : h("div", { class: "sol-sections" },
        order.length > 0 && h("section", { "aria-label": "Unlabelled senders" }, h("h3", { class: "text-label-sm text-muted", text: "Incoming SOL" }), list(order.map(function (a) { return senderItem(by[a]); }))),
        q.rent.length > 0 && h("section", { "aria-label": "Unlinked rent" }, h("h3", { class: "text-label-sm text-muted", text: "Rent" }), list(q.rent.map(rentItem)))),
    ]), "sol-queue");
  }

  function claims(walletId) {
    var rows = SJ.system.claims(walletId);
    return A(ui.card({ labelledby: "claims-title" }, [
      ui.cardHeader({ id: "claims-title", title: "Cashback claims", description: "Split each claim across trades: by platform fee (default), evenly, or by hand." }),
      rows.length === 0 ? empty("No cashback yet", "Label a sender as Cashback and its payments appear here.") : list(rows.map(function (c) {
        return h("li", { class: "sol-item sol-claim" },
          h("span", { class: "sol-claim-text" },
            h("span", { class: "text-body-md text-fg" }, amount(f.sol(c.event.swapSol, { decimals: 6 })), " · " + (c.sender.name || KIND_LABEL[c.sender.label])),
            h("span", { class: "font-mono text-data-xs text-muted", text: when(c.event.blockTime) + (c.positions ? " · " + f.sol(c.allocated, { decimals: 6 }) + " SOL over " + c.positions + " trade" + (c.positions === 1 ? "" : "s") : "") })),
          ui.badge(STATE[c.state][0], STATE[c.state][1]),
          ui.button({ label: c.state === "none" ? "Allocate" : "Edit", size: "sm", variant: c.state === "full" ? "ghost" : "secondary", onclick: function () { allocate(walletId, c.event.id); } }));
      })),
    ]), "sol-claims");
  }

  /** The allocation dialog (allocation-dialog.tsx): pick trades, a split method, and see each share before saving. */
  function allocate(walletId, claimId) {
    var form = SJ.system.allocationForm(walletId, claimId);
    var total = form.claim.swapSol;
    var method = form.current.length ? form.current[0].method : "fee_prorata";
    var selected = {};
    (form.current.length ? form.current.map(function (a) { return a.positionKey; }) : form.candidates.filter(function (c) { return c.sinceLast; }).map(function (c) { return c.trade.key; }))
      .forEach(function (k) { selected[k] = true; });
    var manual = {};
    form.current.forEach(function (a) { manual[a.positionKey] = f.sol(a.lamports, { decimals: 9 }); });
    var sumLine = h("p", { class: "font-mono text-data-xs text-muted" });
    var rowsEl = h("ul", { class: "sol-alloc" });
    var error = h("p", { role: "alert", class: "text-body-sm text-loss", hidden: true });
    var save = ui.button({ label: "Save allocation", variant: "primary" });
    var lamportsOf = function (v) { return v !== undefined && /^\d{1,9}(\.\d{1,9})?$/.test(String(v).trim()) ? SJ.reflection.solToLamports(String(v).trim()) : null; };
    var keys = function () { return form.candidates.filter(function (c) { return selected[c.trade.key]; }).map(function (c) { return c.trade.key; }); };
    function shares() {
      var ks = keys();
      if (method === "manual") return ks.map(function (k) { return lamportsOf(manual[k]); });
      var byKey = {};
      form.candidates.forEach(function (c) { byKey[c.trade.key] = c.trade; });
      return SJ.system.allocate(total, ks.map(function (k) { return { key: k, weight: byKey[k].feePlatform }; }), method);
    }
    function paint() {
      var ks = keys();
      var s = shares();
      var share = {};
      ks.forEach(function (k, i) { share[k] = s[i]; });
      var sum = s.some(function (x) { return x === null; }) ? null : f.sum(s);
      sumLine.textContent = ks.length + " trade" + (ks.length === 1 ? "" : "s") + " · " + (sum === null ? "check the amounts" : f.sol(sum, { decimals: 9 }) + " of " + f.sol(total, { decimals: 9 }) + " SOL");
      save.disabled = !(ks.length > 0 && sum === total);
      SJ.dom.clear(rowsEl);
      form.candidates.forEach(function (c) {
        var on = !!selected[c.trade.key];
        var name = tokenName(c.trade.mint) + " · closed " + when(c.trade.closedAt);
        var row = ui.checkRow({ label: h("span", null, name, !c.sinceLast && h("span", { class: "text-muted", text: " · before previous claim" })), checked: on,
          meta: on && method !== "manual" ? f.sol(share[c.trade.key], { decimals: 6 }) : "fee " + f.sol(c.trade.feePlatform, { decimals: 6 }),
          onChange: function (v) { if (v) selected[c.trade.key] = true; else delete selected[c.trade.key]; paint(); focusRow(c.trade.key); } });
        row.setAttribute("data-key", c.trade.key);
        var li = h("li", null, row);
        if (on && method === "manual") {
          var amountField = ui.input({ label: "Amount for " + name + " (SOL)", hideLabel: true, value: manual[c.trade.key] || "", attrs: { inputmode: "decimal" },
            oninput: function (e) { manual[c.trade.key] = e.target.value; var pos = e.target.selectionStart; paintSum(); e.target.setSelectionRange(pos, pos); } });
          li.appendChild(amountField);
        }
        rowsEl.appendChild(li);
      });
    }
    function paintSum() {
      var s = shares();
      var sum = s.some(function (x) { return x === null; }) ? null : f.sum(s);
      sumLine.textContent = keys().length + " trades · " + (sum === null ? "check the amounts" : f.sol(sum, { decimals: 9 }) + " of " + f.sol(total, { decimals: 9 }) + " SOL");
      save.disabled = !(keys().length > 0 && sum === total);
    }
    function focusRow(key) { var el = rowsEl.querySelector('[data-key="' + key + '"]'); if (el) el.focus(); }
    var picker = ui.segmented({ label: "Split", options: METHODS, value: method, onChange: function (m) {
      // Manual editing starts from the current split, so the amounts already add up.
      if (m === "manual" && method !== "manual") { var s = shares(); keys().forEach(function (k, i) { manual[k] = f.sol(s[i] || 0n, { decimals: 9 }); }); }
      method = m;
      paint();
    } });
    var prev = form.previousAt ? "Trades closed since the previous claim (" + when(form.previousAt) + ") are pre-selected." : "This is the first claim from this sender, so every earlier closed trade is pre-selected.";
    var dialog = SJ.overlay.modal({
      title: "Allocate cashback", description: "Rebates never change a trade's P&L; they are reported as Net after rebates.",
      body: [h("p", { class: "text-body-sm text-muted", text: f.sol(total, { decimals: 6 }) + " SOL on " + when(form.claim.blockTime) + ". " + prev }), picker, sumLine,
        form.candidates.length ? rowsEl : h("p", { class: "text-body-sm text-muted", text: "No closed trades before this payment." }), error],
      footer: [form.current.length > 0 && ui.button({ label: "Remove allocation", variant: "ghost", onclick: function () { dialog.close(); guard(function () { SJ.actions.clearAllocation(claimId); }, "Allocation removed"); } }), save],
    });
    save.addEventListener("click", function () {
      try {
        SJ.actions.saveAllocation(walletId, claimId, method, keys(), method === "manual" ? shares() : null);
        dialog.close();
        SJ.overlay.toast({ title: "Cashback allocated", body: "The dashboard's Net after rebates and each trade's rebate now include it.", tone: "success" });
      } catch (e) { error.textContent = e.message; error.hidden = false; }
    });
    paint();
    return dialog;
  }

  function senders(walletId) {
    var rows = SJ.system.senders(walletId);
    return A(ui.card({ labelledby: "senders-title" }, [
      ui.cardHeader({ id: "senders-title", title: "Senders", description: "Labels apply to every payment from that address, past and future." }),
      rows.length === 0 ? empty("No labelled senders", "Label a sender from the Unlinked SOL queue.") : list(rows.map(function (r) {
        var kind = ui.select({ label: "Label", hideLabel: true, options: KINDS, value: r.kind });
        var warn = h("p", { class: "text-body-sm text-warning", hidden: true, text: "Changing away from cashback removes the allocations of its payments." });
        kind.querySelector("select").addEventListener("change", function (e) { warn.hidden = !(r.kind === "cashback" && e.target.value !== "cashback"); });
        return h("li", { class: "sol-item" },
          h("div", { class: "sol-row" }, h("span", { class: "sol-row-start" }, ui.badge(KIND_LABEL[r.kind]), r.name && h("span", { class: "text-body-md text-fg", text: r.name }), ui.address({ value: r.address, label: "sender" })), amount(f.sol(r.total))),
          h("p", { class: "text-body-sm text-muted", text: r.payments + " incoming payment" + (r.payments === 1 ? "" : "s") }),
          h("div", { class: "sol-controls" }, kind,
            ui.button({ label: "Change", onclick: function () { guard(function () { SJ.actions.labelSender(walletId, r.address, kind.querySelector("select").value, r.name); }, "Label changed"); } }),
            ui.button({ label: "Remove label", variant: "ghost", onclick: function () { guard(function () { SJ.actions.removeSender(walletId, r.address); }, "Label removed"); } })),
          warn);
      })),
    ]), "sol-senders");
  }

  function rentLinks(walletId, page) {
    var all = SJ.system.rentLinks(walletId);
    var pages = Math.max(1, Math.ceil(all.length / PAGE));
    var p = Math.min(Math.max(1, page), pages);
    var item = function (r) {
      var options = SJ.system.rentCandidates(walletId, r.event).map(positionOption);
      var editor = h("div", { class: "sol-controls", hidden: true });
      var others = options.filter(function (o) { return o.value !== r.owner.key; });
      var pick = ui.select({ label: "Move to", options: options, value: others[0] ? others[0].value : r.owner.key });
      SJ.dom.append(editor, [pick,
        ui.button({ label: "Save", variant: "primary", onclick: function () { guard(function () { SJ.actions.setRentLink(walletId, r.event.id, pick.querySelector("select").value); }, "Rent relinked"); } }),
        ui.button({ label: "Cancel", variant: "ghost", onclick: function () { editor.hidden = true; buttons.hidden = false; } })]);
      var buttons = h("div", { class: "btn-row" },
        ui.button({ label: "Relink", size: "sm", disabled: options.length < 2, onclick: function () { editor.hidden = false; buttons.hidden = true; pick.querySelector("select").focus(); } }),
        ui.button({ label: "Unlink", size: "sm", variant: "ghost", onclick: function () { guard(function () { SJ.actions.setRentLink(walletId, r.event.id, null); }, "Rent unlinked"); } }));
      return h("li", { class: "sol-item" },
        h("div", { class: "sol-row" }, h("span", { class: "sol-row-start" }, h("span", { class: "text-body-md text-fg", text: rentWhat(r.event) }), r.manual && ui.badge("Manual", "accent")), amount(rentAmount(r.event))),
        h("p", { class: "text-body-sm text-muted" }, h("span", { class: "font-mono text-data-xs", text: when(r.event.blockTime) }), " · linked to ",
          h("a", { class: "link-under", href: SJ.tradeList.tradeHref(r.owner.key), text: tokenName(r.owner.mint) + " · opened " + when(r.owner.openedAt) })),
        buttons, editor);
    };
    return A(ui.card({ labelledby: "rent-links-title" }, [
      ui.cardHeader({ id: "rent-links-title", title: "Rent links", description: "Rent paid links to the first position that used the account; refunds to the latest one before them." }),
      all.length === 0 ? empty("No linked rent", "Rent appears here once trades are imported.") : list(all.slice((p - 1) * PAGE, p * PAGE).map(item)),
      h("div", { class: "sol-pages" }, ui.pagination({ page: p, pageCount: pages, pageSize: PAGE, total: all.length, noun: "rent events", onPage: function (n) { window.location.hash = "#/settings/sol?rent=" + n; } })),
    ]), "sol-rent");
  }

  function render() {
    SJ.router.watch(SJ.router.refresh);
    var walletId = SJ.store.activeWallet().id;
    var page = Number(new URLSearchParams(SJ.router.query()).get("rent")) || 1;
    var header = SJ.router.pageHeader("Rent & cashback", "Sort incoming SOL, allocate cashback to trades and check where rent is linked.");
    header.appendChild(h("a", { class: "btn btn-ghost btn-sm", href: "#/settings" }, SJ.dom.icon("arrow-left"), "Settings"));
    return h("div", { class: "page page-narrow" }, header, queue(walletId), claims(walletId), senders(walletId), rentLinks(walletId, page));
  }

  SJ.screens = SJ.screens || {};
  SJ.screens["settings-sol"] = { render: render, allocate: allocate };
})();
