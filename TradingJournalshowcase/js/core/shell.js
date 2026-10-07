// The app shell: sidebar, top bar, mobile bottom nav and its More sheet. Navigation items mirror the app's
// nav-items.ts (labels, order, groups, the four phone slots); the router marks the active one.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var icon = SJ.dom.icon;

  var NAV_GROUPS = [
    {
      label: "Workstation",
      items: [
        { href: "/dashboard", label: "Dashboard", short: "Dash", icon: "layout-dashboard" },
        { href: "/inbox", label: "Inbox", icon: "inbox" },
        { href: "/trades", label: "Trades", icon: "arrow-left-right" },
        { href: "/journal", label: "Journal", icon: "book-open" },
        { href: "/calendar", label: "Calendar", icon: "calendar-days" },
      ],
    },
    {
      label: "Discipline & Intel",
      items: [
        { href: "/reviews", label: "Reviews", icon: "clipboard-check" },
        { href: "/analytics", label: "Analytics", icon: "bar-chart" },
        { href: "/strategies", label: "Strategies", icon: "workflow" },
        { href: "/mistakes", label: "Mistakes", icon: "alert-triangle" },
        { href: "/rules", label: "Rules", icon: "list-checks" },
        { href: "/exports", label: "Exports", icon: "file-spreadsheet" },
      ],
    },
  ];
  var SETTINGS_ITEM = { href: "/settings", label: "Settings", icon: "settings" };
  var ALL = NAV_GROUPS.reduce(function (acc, g) { return acc.concat(g.items); }, []);
  var MOBILE_PRIMARY = ["/dashboard", "/inbox", "/trades", "/calendar"].map(function (href) {
    return ALL.filter(function (i) { return i.href === href; })[0];
  });
  var MOBILE_MORE = ALL.filter(function (i) { return MOBILE_PRIMARY.indexOf(i) < 0; }).concat([SETTINGS_ITEM]);

  var inboxCount = 0;
  var lastFocus = null;

  function isActive(path, href) {
    return path === href || path.indexOf(href + "/") === 0;
  }
  function countLabel(n) {
    return n > 999 ? "999+" : String(n);
  }
  function linkLabel(item) {
    return item.href === "/inbox" && inboxCount > 0 ? item.label + ", " + inboxCount + " to review" : item.label;
  }

  function sidebarLink(item) {
    var badge = item.href === "/inbox" && inboxCount > 0;
    return h(
      "a",
      { class: "nav-link", href: "#" + item.href, "data-href": item.href, title: item.label, "aria-label": linkLabel(item) },
      icon(item.icon),
      h("span", { class: "nav-label", text: item.label }),
      badge && h("span", { class: "nav-count", "aria-hidden": "true", text: countLabel(inboxCount) })
    );
  }

  function renderSidebar() {
    var aside = SJ.dom.clear(document.getElementById("sidebar"));
    aside.appendChild(
      h("a", { class: "sidebar-brand", href: "#/", title: "Overview" },
        h("span", { class: "brand-dot", "aria-hidden": "true" }),
        h("span", { class: "brand-name", text: SJ.meta.appName }))
    );
    aside.appendChild(
      h("nav", { class: "sidebar-nav", "aria-label": "Main" },
        NAV_GROUPS.map(function (g) {
          return h("div", { class: "nav-group" }, h("h2", { class: "text-label-sm", text: g.label }), g.items.map(sidebarLink));
        }))
    );
    aside.appendChild(h("div", { class: "sidebar-foot" }, sidebarLink(SETTINGS_ITEM)));
  }

  function renderBottomNav() {
    var nav = SJ.dom.clear(document.getElementById("bottom-nav"));
    var slots = MOBILE_PRIMARY.map(function (item) {
      var badge = item.href === "/inbox" && inboxCount > 0;
      return h("li", null,
        h("a", { class: "bottom-slot", href: "#" + item.href, "data-href": item.href, "aria-label": linkLabel(item) },
          h("span", { class: "bottom-icon" }, icon(item.icon),
            badge && h("span", { class: "nav-count", "aria-hidden": "true", text: countLabel(inboxCount) })),
          h("span", { "aria-hidden": "true", text: item.short || item.label })));
    });
    slots.push(h("li", null,
      h("button", { type: "button", id: "more-button", class: "bottom-slot", "aria-haspopup": "dialog", "aria-expanded": "false", onclick: openMore },
        icon("menu"), "More")));
    nav.appendChild(h("ul", null, slots));
  }

  function renderTopBar() {
    var actions = SJ.dom.clear(document.getElementById("topbar-actions"));
    var later = "Not active yet in this demo";
    actions.appendChild(h("span", { class: "badge", title: "Every number and name in this demo is invented", text: "Demo data" }));
    actions.appendChild(
      h("button", { type: "button", class: "btn btn-ghost btn-icon btn-wide-md", disabled: true, "aria-label": "Search", title: later },
        icon("search"), h("span", { class: "hide-sm", text: "Search" }), h("kbd", { class: "kbd hide-sm", "aria-hidden": "true", text: "⌘K" }))
    );
    actions.appendChild(
      h("button", { type: "button", id: "explain-toggle", class: "btn btn-ghost btn-icon btn-wide-md", "aria-pressed": String(SJ.explain.isOn()), "aria-label": "Explain", title: "Show numbered explanations on this screen", onclick: SJ.explain.toggle },
        icon("lightbulb"), h("span", { class: "hide-sm", text: "Explain" }))
    );
    actions.appendChild(
      h("button", { type: "button", class: "btn btn-ghost btn-icon", "aria-label": "Reset demo", title: "Reset demo: undo every change you made", onclick: resetDemo }, icon("rotate-ccw"))
    );
    actions.appendChild(
      h("button", { type: "button", class: "btn btn-secondary btn-sm btn-sync", disabled: true, "aria-label": "Sync", title: later },
        icon("refresh-cw"), h("span", { class: "hide-sm", text: "Sync" }))
    );
  }

  /** Restores the generated data: stops simulations, closes any explanation and redraws the current screen. */
  function resetDemo() {
    SJ.sim.cancelAll();
    SJ.explain.close();
    SJ.store.reset();
    if (SJ.router) SJ.router.refresh();
    SJ.overlay.toast({ title: "Demo reset", body: "Every change you made is undone; the invented data is back as generated.", tone: "success" });
  }

  function renderFooter() {
    var footer = document.getElementById("shell-footer");
    footer.textContent = "Demo with invented data. Reflects the app as of " + SJ.meta.asOfLabel + ".";
  }

  /** Marks the links of the current route: aria-current on links, the More slot when the page lives in More. */
  function setActive(path) {
    var links = document.querySelectorAll("[data-href]");
    Array.prototype.forEach.call(links, function (a) {
      if (isActive(path, a.getAttribute("data-href"))) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    var more = document.getElementById("more-button");
    var inMore = MOBILE_MORE.some(function (i) { return isActive(path, i.href); });
    if (more) more.classList.toggle("is-active", inMore);
  }

  function openMore() {
    var backdrop = document.getElementById("more-sheet");
    lastFocus = document.activeElement;
    var list = SJ.dom.clear(backdrop.querySelector(".sheet-list"));
    MOBILE_MORE.forEach(function (item) {
      list.appendChild(h("li", null,
        h("a", { class: "btn btn-ghost", href: "#" + item.href, "data-href": item.href, onclick: closeMore }, icon(item.icon), item.label)));
    });
    backdrop.hidden = false;
    document.getElementById("more-button").setAttribute("aria-expanded", "true");
    setActive(SJ.router ? SJ.router.currentPath() : "");
    list.querySelector("a").focus();
  }

  function closeMore() {
    var backdrop = document.getElementById("more-sheet");
    if (backdrop.hidden) return;
    backdrop.hidden = true;
    document.getElementById("more-button").setAttribute("aria-expanded", "false");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function init() {
    renderSidebar();
    renderBottomNav();
    renderTopBar();
    renderFooter();
    SJ.explain.init();
    // The Inbox count in the nav follows the store (a review, a void or Reset demo changes it).
    var count = function () { if (SJ.store.needsReview() !== inboxCount) setInboxCount(SJ.store.needsReview()); };
    SJ.store.on(count);
    count();
    var backdrop = document.getElementById("more-sheet");
    backdrop.addEventListener("click", function (e) { if (e.target === backdrop) closeMore(); });
    backdrop.querySelector(".sheet-close").addEventListener("click", closeMore);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMore(); });
    // The skip link must not change the hash (the router owns it), so it moves focus itself.
    document.getElementById("skip-link").addEventListener("click", function (e) {
      e.preventDefault();
      document.getElementById("main").focus();
    });
  }

  /** Later tasks call this when the demo's Inbox changes. */
  function setInboxCount(n) {
    inboxCount = n;
    renderSidebar();
    renderBottomNav();
    if (SJ.router) setActive(SJ.router.currentPath());
  }

  SJ.shell = { init: init, setActive: setActive, setInboxCount: setInboxCount, closeMore: closeMore, resetDemo: resetDemo, NAV_GROUPS: NAV_GROUPS, SETTINGS_ITEM: SETTINGS_ITEM };
})();
