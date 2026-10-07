// Hash router (#/dashboard, #/trades/<key>, ...). Each route renders SJ.screens[name] when a later task has added
// that screen, otherwise a titled placeholder. Works over file:// and at any subpath because it only reads the hash.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  SJ.screens = SJ.screens || {};

  // Order matters: the first match wins (reviews/monthly before reviews/:week).
  var ROUTES = [
    { path: "", name: "overview", title: "Overview", description: "What this system is, how it works and how to explore it." },
    { path: "dashboard", name: "dashboard", title: "Dashboard", description: "Results, discipline and data health over a chosen range." },
    { path: "inbox", name: "inbox", title: "Reflection Inbox", description: "Finished positions waiting for a short review." },
    { path: "trades", name: "trades", title: "Trades", description: "Every rebuilt position, newest first." },
    { path: "trades/:key", name: "trade-detail", title: "Trade", description: "One position: its events, fees, reflection and corrections." },
    { path: "tokens/:mint", name: "token", title: "Token", description: "Every position in one token, across wallets." },
    { path: "journal", name: "journal", title: "Journal", description: "Daily reviews and trade takeaways, newest first." },
    { path: "calendar", name: "calendar", title: "Calendar", description: "Each trading day at a glance, with the day panel." },
    { path: "reviews", name: "reviews", title: "Reviews", description: "Weekly reviews with frozen stats." },
    { path: "reviews/monthly", name: "reviews-monthly", title: "Monthly reviews", description: "Monthly reviews with frozen stats." },
    { path: "reviews/monthly/:month", name: "review-month", title: "Monthly review", description: "One month: frozen stats, versus the previous month, and notes." },
    { path: "reviews/:week", name: "review-week", title: "Weekly review", description: "One week: frozen stats and notes." },
    { path: "analytics", name: "analytics", title: "Analytics", description: "Breakdowns by every dimension, with sample-size gating." },
    { path: "strategies", name: "strategies", title: "Strategies", description: "Your strategy names and how each performs." },
    { path: "mistakes", name: "mistakes", title: "Mistakes", description: "Mistake and positive tags and what they cost." },
    { path: "rules", name: "rules", title: "Rules", description: "Personal rules, adherence and auto-checks." },
    { path: "exports", name: "exports", title: "Exports", description: "The accountant workbook for a tax year or a range." },
    { path: "settings", name: "settings", title: "Settings", description: "Wallet, import and sync, preferences, limits and backup." },
    { path: "settings/sol", name: "settings-sol", title: "Rent & cashback", description: "Incoming SOL, cashback allocation and rent links." },
    // Hidden UI kit gallery, not in the navigation (removed in SH13).
    { path: "kit", name: "kit", title: "UI kit", description: "Every shared part of the demo." },
  ];

  var current = { path: "/", route: null, params: {} };
  var started = false;

  /** "#/trades/abc" → "trades/abc" (no leading or trailing slash). */
  function hashPath() {
    var raw = window.location.hash.replace(/^#\/?/, "").split("?")[0];
    return raw.replace(/\/+$/, "");
  }

  /** The query of the hash ("#/trades?outcome=win" → "outcome=win"), where screens keep filters, sort and page. */
  function hashQuery() {
    var at = window.location.hash.indexOf("?");
    return at < 0 ? "" : window.location.hash.slice(at + 1);
  }

  // Store subscriptions of the screen on display; dropped when the next page renders.
  var watchers = [];
  function watch(fn) { watchers.push(SJ.store.on(fn)); }

  function match(path) {
    var parts = path ? path.split("/") : [];
    for (var i = 0; i < ROUTES.length; i++) {
      var pattern = ROUTES[i].path ? ROUTES[i].path.split("/") : [];
      if (pattern.length !== parts.length) continue;
      var params = {};
      var ok = pattern.every(function (seg, j) {
        if (seg.charAt(0) === ":") {
          try {
            params[seg.slice(1)] = decodeURIComponent(parts[j]);
          } catch (e) {
            params[seg.slice(1)] = parts[j];
          }
          return parts[j].length > 0;
        }
        return seg === parts[j];
      });
      if (ok) return { route: ROUTES[i], params: params };
    }
    return null;
  }

  function pageHeader(title, description) {
    return h("header", { class: "page-header" },
      h("div", null,
        h("h1", { class: "text-headline-lg", tabindex: "-1", text: title }),
        description && h("p", { class: "text-body-sm text-muted", text: description })));
  }

  function placeholder(route) {
    return h("div", { class: "page" },
      pageHeader(route.title, route.description),
      h("section", { class: "placeholder", "aria-label": "Not built yet" },
        SJ.dom.icon("clipboard-check"),
        h("p", { class: "text-title-sm", text: "This screen is being added to the demo" }),
        h("p", { class: "text-body-sm text-muted", text: "The shell and navigation work already. The screen itself comes in a later step." })));
  }

  function notFound(path) {
    return h("div", { class: "page" },
      pageHeader("Page not found", "There is no page at #/" + path + " in this demo."),
      h("section", { class: "placeholder" },
        SJ.dom.icon("search"),
        h("p", { class: "text-title-sm", text: "Nothing here" }),
        h("a", { class: "btn btn-secondary", href: "#/", text: "Go to the overview" })));
  }

  /**
   * Draws the current route. `keepFocus` (a redraw of the same page, as after Reset demo or a store change) leaves
   * focus alone. A change of the query alone (filters, sort, range) is a redraw too: it keeps the scroll position, and
   * focus returns to the control with the same `data-refocus` value.
   */
  function render(keepFocus) {
    var path = hashPath();
    var found = match(path);
    var redraw = keepFocus === true || (started && current.path === "/" + path);
    var focused = document.activeElement && document.activeElement.getAttribute ? document.activeElement.getAttribute("data-refocus") : null;
    watchers.splice(0).forEach(function (stop) { stop(); });
    var main = SJ.dom.clear(document.getElementById("view"));
    current = { path: "/" + path, route: found ? found.route : null, params: found ? found.params : {}, query: hashQuery(), redraw: redraw };

    var screen = found && SJ.screens[found.route.name];
    var view = !found ? notFound(path) : screen ? screen.render(found.params, found.route) : placeholder(found.route);
    main.appendChild(view);

    var title = found ? found.route.title : "Page not found";
    document.title = title + " · " + SJ.meta.appName + " (demo)";
    SJ.shell.setActive(current.path);
    SJ.shell.closeMore();
    if (redraw) {
      var again = focused && main.querySelector('[data-refocus="' + focused + '"]');
      if (again) again.focus();
    } else {
      window.scrollTo(0, 0);
      // Move focus to the new page's heading so keyboard and screen-reader users land on it (not on first load).
      var heading = started && main.querySelector("h1");
      if (heading) heading.focus();
    }
    started = true;
  }

  function start() {
    SJ.shell.init();
    window.addEventListener("hashchange", render);
    render();
  }

  SJ.router = {
    start: start,
    render: render,
    refresh: function () { render(true); },
    currentPath: function () { return current.path; },
    current: function () { return current; },
    query: hashQuery,
    watch: watch,
    pageHeader: pageHeader,
    notFound: notFound,
    ROUTES: ROUTES,
  };

  // Classic deferred scripts run in order before DOMContentLoaded, so the shell and screens are all defined here.
  document.addEventListener("DOMContentLoaded", start);
})();
