// Overview (#/): the landing page in front of the demo (docs/showcase.md §5, Overview row). Text and code excerpts
// live in overview-content.js; quality numbers come from SJ.stats and demo figures from SJ.store, never typed here.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var C = SJ.overviewContent;

  function section(id, title, intro, children) {
    return h("section", { class: "ov-section", "aria-labelledby": id },
      h("header", { class: "ov-section-head" },
        h("h2", { id: id, class: "text-headline-md", text: title }),
        intro && h("p", { class: "text-body-md text-muted", text: intro })),
      children);
  }

  function hero() {
    return h("section", { class: "ov-hero card card-lg", "aria-labelledby": "ov-title" },
      h("div", { class: "ov-hero-meta", "data-explain": "ov-demo" },
        ui.badge("Interactive demo", "accent"),
        ui.badge("Invented data"),
        h("span", { class: "text-data-xs text-muted", text: "Reflects the app as of " + SJ.meta.asOfLabel })),
      h("h1", { id: "ov-title", class: "text-headline-lg", tabindex: "-1", text: SJ.meta.appName }),
      h("p", { class: "ov-pitch text-title-sm", text: C.pitch }),
      h("p", { class: "text-body-md text-muted", text: C.domain }),
      h("div", { class: "ov-actions" },
        ui.button({ label: "Take the 2-minute tour", variant: "secondary", disabled: true, attrs: { title: "The guided tour is added in a later step" } }),
        h("a", { class: "btn btn-primary", href: "#/dashboard", text: "Explore freely" })));
  }

  function problem() {
    return section("ov-problem", "The problem it solves", null, [
      h("div", { class: "ov-grid ov-grid-3" }, C.problems.map(function (p) {
        return ui.card({ label: p.title }, [h("h3", { class: "text-title-sm", text: p.title }), h("p", { class: "text-body-sm text-muted", text: p.text })]);
      })),
      h("p", { class: "ov-answer text-body-md", text: C.answer }),
    ]);
  }

  /** The flow as a snake of boxes: left to right, then right to left, so it fits `cols` columns (one column on phones). */
  function flowSvg(cols, w, nodeH, gapX, gapY) {
    var n = C.flow.length;
    var rows = Math.ceil(n / cols);
    var at = function (i) {
      var row = Math.floor(i / cols);
      var c = i % cols;
      return { x: (row % 2 ? cols - 1 - c : c) * (w + gapX), y: row * (nodeH + gapY), row: row };
    };
    var width = cols * w + (cols - 1) * gapX;
    var height = rows * nodeH + (rows - 1) * gapY;
    var body = "";
    for (var i = 0; i + 1 < n; i++) {
      var a = at(i), b = at(i + 1), x1, y1, x2, y2, head;
      if (a.row === b.row) {
        var right = b.x > a.x;
        x1 = right ? a.x + w : a.x; x2 = right ? b.x - 4 : b.x + w + 4; y1 = y2 = a.y + nodeH / 2;
        head = right ? [x2, y2, x2 - 6, y2 - 4, x2 - 6, y2 + 4] : [x2, y2, x2 + 6, y2 - 4, x2 + 6, y2 + 4];
      } else {
        x1 = x2 = a.x + w / 2; y1 = a.y + nodeH; y2 = b.y - 4;
        head = [x2, y2, x2 - 4, y2 - 6, x2 + 4, y2 - 6];
      }
      body += '<line class="flow-edge" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>';
      body += '<polygon class="flow-head" points="' + head.join(" ") + '"/>';
    }
    C.flow.forEach(function (node, i) {
      var p = at(i);
      body += '<g class="flow-node"><rect x="' + p.x + '" y="' + p.y + '" width="' + w + '" height="' + nodeH + '" rx="8"/>' +
        '<text class="flow-step" x="' + (p.x + 12) + '" y="' + (p.y + 20) + '">' + (i + 1) + "</text>" +
        '<text class="flow-title" x="' + (p.x + 30) + '" y="' + (p.y + 20) + '">' + SJ.charts.esc(node.title) + "</text>" +
        '<text class="flow-note" x="' + (p.x + 12) + '" y="' + (p.y + nodeH - 14) + '">' + SJ.charts.esc(node.note) + "</text></g>";
    });
    var holder = document.createElement("template");
    holder.innerHTML = '<svg viewBox="0 0 ' + width + " " + height + '" aria-hidden="true" focusable="false" class="flow-svg">' + body + "</svg>";
    return holder.content.firstChild;
  }

  function flow() {
    return section("ov-flow", "How data flows", null, SJ.explain.anchor(ui.card({ label: "Data flow diagram", padding: "lg" }, [
      h("div", { class: "flow-wide" }, flowSvg(5, 184, 64, 32, 44)),
      h("div", { class: "flow-narrow" }, flowSvg(1, 300, 52, 0, 22)),
      h("ol", { class: "sr-only" }, C.flow.map(function (n) { return h("li", { text: n.title + ": " + n.note }); })),
      h("p", { class: "text-body-sm text-muted", text: C.flowCaption }),
    ]), "ov-flow"));
  }

  function decisions() {
    return section("ov-decisions", "Key engineering decisions", "Each card has one plain sentence; open Under the hood for the detail and a real excerpt of the code.",
      h("div", { class: "ov-grid ov-grid-2", "data-explain": "ov-decisions" }, C.decisions.map(function (d) {
        return ui.card({ label: d.title, className: "ov-decision" }, [
          h("h3", { class: "text-title-sm", text: d.title }),
          h("p", { class: "text-body-md text-muted", text: d.plain }),
          ui.hood(d.technical, d.code),
        ]);
      })));
  }

  function guardrails() {
    var g = C.guardrails;
    return section("ov-guardrails", "AI guardrails", null, ui.card({ label: "AI guardrails", padding: "lg" }, [
      h("p", { class: "text-body-md", text: g.plain }),
      h("ul", { class: "ov-rules" }, g.rules.map(function (r) { return h("li", { class: "text-body-sm" }, SJ.dom.icon("check"), r); })),
      ui.hood(g.technical, g.code),
    ]));
  }

  function quality() {
    var stats = SJ.stats || {};
    return section("ov-quality", "Engineering in numbers", "Counted from the repository when this demo was built.",
      h("div", { class: "ov-grid ov-grid-stats", "data-explain": "ov-quality" }, C.quality.map(function (q) {
        var n = stats[q.key];
        return ui.statCard({ label: q.label, value: typeof n === "number" ? n.toLocaleString("en-GB") : "—" });
      })));
  }

  function stack() {
    return section("ov-stack", "Stack", "Runs on free tiers: one web app, one database, no queues or extra servers.",
      h("div", { class: "ov-grid ov-grid-4" }, C.stack.map(function (s) {
        return ui.card({ label: s.group }, [
          h("h3", { class: "text-label-sm text-muted", text: s.group }),
          h("ul", { class: "ov-stack-list" }, s.items.map(function (item) { return h("li", null, ui.tag({ label: item })); })),
        ]);
      })));
  }

  function tile(title, caption, href, linkLabel, body, className) {
    return ui.card({ label: title, className: SJ.dom.cx("ov-tile", className) }, [
      h("header", { class: "ov-tile-head" }, h("h3", { class: "text-title-sm", text: title }), h("a", { class: "btn btn-ghost btn-sm", href: href, text: linkLabel })),
      body,
      h("p", { class: "text-body-sm text-muted", text: caption }),
    ]);
  }

  /** Live renders of the demo's own data, so the gallery always matches the screens behind it. */
  function gallery() {
    var s = SJ.store.settings();
    var trades = SJ.store.trades();
    var total = 0n;
    var cumulative = SJ.metrics.dailyNetPnl(trades, s).map(function (d) {
      total += d[1];
      return { x: d[0], y: Number(SJ.format.sol(total)) };
    });
    var days = {};
    trades.forEach(function (t) {
      var day = SJ.metrics.tradingDay(t.openedAt, s.timeZone, s.dayStartHour);
      var cell = days[day] || (days[day] = { netPnl: 0n, entered: 0 });
      cell.entered += 1;
      if (SJ.metrics.isDecided(t)) cell.netPnl += t.netPnl;
    });
    var month = SJ.meta.asOf.slice(0, 7);
    var prev = SJ.metrics.shiftDay(month + "-01", -1).slice(0, 7);
    var reviewed = SJ.store.data().dailyReviews.map(function (r) { return r.day; });
    var shot = SJ.store.data().screenshots[0];
    var holder = document.createElement("template");
    holder.innerHTML = shot ? shot.svg : "";

    return section("ov-gallery", "Screens in this demo", "Drawn live from the demo's invented data, like every screen behind them. The calendar is on wider screens.",
      h("div", { class: "ov-grid ov-grid-2" }, [
        tile("Cumulative net P&L", "Decided positions of the active wallet, by trading day.", "#/dashboard", "Dashboard",
          SJ.charts.render("line", cumulative, { label: "Cumulative net P&L of the demo wallet", area: true, height: 220, xFormat: SJ.charts.shortDay })),
        tile("A screenshot on a review", "Images attach to a position's review; this one is a generated chart.", "#/trades", "Trades",
          h("div", { class: "ov-shot" }, holder.content.firstChild)),
        tile("A month in the calendar", "Each trading day tinted by its net result; a dot marks a written daily review.", "#/calendar", "Calendar",
          SJ.charts.calendar(SJ.charts.buildMonth(prev, days, reviewed), { href: function (day) { return "#/calendar?day=" + day; } }), "ov-tile-wide"),
      ]));
  }

  function roadmap() {
    return section("ov-roadmap", "On the roadmap", "Ideas on the project's backlog. None of them is built, so the demo does not show them.",
      ui.card({ label: "Backlog ideas" }, h("ul", { class: "ov-roadmap" }, C.roadmap.map(function (r) {
        return h("li", null, h("p", { class: "text-body-md", text: r.title }), h("p", { class: "text-body-sm text-muted", text: r.text }));
      }))));
  }

  SJ.screens = SJ.screens || {};
  SJ.screens.overview = {
    render: function () {
      return h("div", { class: "page ov" }, hero(), problem(), flow(), decisions(), guardrails(), quality(), stack(), gallery(), roadmap());
    },
  };
})();
