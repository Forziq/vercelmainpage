// Screenshots card on trade detail (components/reflection/Screenshots.tsx): kind picker, thumbnail grid, upload by
// file picker or paste, and the lightbox. The demo's images are generated SVG charts; an "uploaded" file is only
// previewed from memory in this browser tab and is gone after Reset demo or a reload.
(function () {
  var SJ = (window.SJ = window.SJ || {});
  var h = SJ.dom.h;
  var ui = SJ.ui;
  var S = SJ.store;
  var KINDS = [{ value: "pre_entry", label: "Pre-entry" }, { value: "exit", label: "Exit" }, { value: "other", label: "Other" }];
  var KIND_LABEL = { pre_entry: "Pre-entry", exit: "Exit", other: "Other" };
  var LIVE = "the image is compressed to WebP in the browser (up to 1600 px) and uploaded to a private storage bucket through a short-lived signed URL.";
  var current = null;

  var shotsOf = function (key) { return S.data().screenshots.filter(function (s) { return s.positionKey === key; }); };

  /** The image as a node: inline SVG for the generated charts, <img> for a local file; null when it has neither. */
  function media(s) {
    if (s.url) return h("img", { src: s.url, alt: KIND_LABEL[s.kind] + " screenshot", width: s.width, height: s.height });
    if (!s.svg) return null;
    var holder = document.createElement("template");
    holder.innerHTML = s.svg;
    return holder.content.firstChild;
  }

  /** Reads a chosen or pasted file into memory and adds it through the upload simulation. */
  function upload(t, state, file, done) {
    if (!file || !/^image\//.test(file.type)) return done("Choose an image file.");
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onerror = function () { URL.revokeObjectURL(url); done("That image could not be read."); };
    img.onload = function () {
      SJ.sim.run({ action: "Upload", success: "Screenshot added", steps: ["Compressing to WebP", "Uploading"], ms: 900, live: LIVE }).then(function (r) {
        if (r.cancelled) return URL.revokeObjectURL(url);
        SJ.actions.addScreenshot(t.key, { kind: state.shotKind || "pre_entry", width: img.naturalWidth, height: img.naturalHeight, url: url });
        done(null);
      });
    };
    img.src = url;
  }

  function openViewer(t, index) {
    var list = shotsOf(t.key);
    var images = function (rows) { return rows.map(function (s) { return { caption: KIND_LABEL[s.kind], width: s.width, height: s.height, media: function () { return media(s); } }; }); };
    var viewer = SJ.lightbox.open({
      label: "Screenshots", images: images(list), index: index, fallbackFocus: '[data-refocus="shot-add"]',
      actions: function (i) {
        return SJ.lightbox.confirmDelete(function () {
          try {
            SJ.actions.deleteScreenshot(list[i].id);
          } catch (e) { return viewer.error(e.message); }
          list = shotsOf(t.key);
          viewer.setImages(images(list), i);
        });
      },
    });
    return viewer;
  }

  function render(t) {
    var state = SJ.reflection.stateOf(t.key);
    var list = shotsOf(t.key);
    var error = h("p", { role: "alert", class: "text-body-sm text-loss", hidden: !state.shotError, text: state.shotError || "" });
    state.shotError = null;
    var busy = !!state.uploading;
    var finish = function (message) {
      state.uploading = false;
      state.shotError = message;
      SJ.router.refresh();
    };
    var file = h("input", { type: "file", accept: "image/*", class: "sr-only", tabindex: "-1", "aria-label": "Choose a screenshot" });
    file.addEventListener("change", function () {
      var chosen = file.files && file.files[0];
      file.value = "";
      if (!chosen) return;
      state.uploading = true;
      SJ.router.refresh();
      upload(t, state, chosen, finish);
    });
    current = { trade: t, busy: busy, add: function (blob) { state.uploading = true; SJ.router.refresh(); upload(t, state, blob, finish); } };

    var tiles = list.map(function (s, i) {
      var m = media(s);
      return h("button", { type: "button", class: "shot-tile", "data-refocus": "shot-" + s.id, onclick: function () { openViewer(t, i); } },
        m ? h("span", { class: "shot-thumb" }, m) : h("span", { class: "shot-thumb is-missing text-body-sm text-muted", text: "Unavailable" }),
        h("span", { class: "shot-kind font-mono text-data-xs text-muted", text: KIND_LABEL[s.kind] }));
    });
    tiles.push(h("button", { type: "button", class: "shot-tile shot-add", disabled: busy, "data-refocus": "shot-add", onclick: function () { file.click(); } },
      SJ.dom.icon("image-plus"), h("span", { class: "font-mono text-data-xs", text: busy ? "Uploading…" : "+ Upload" })));

    return SJ.explain.anchor(ui.card({ labelledby: "screenshots-title", padding: "lg" }, [
      ui.cardHeader({ id: "screenshots-title", title: "Screenshots", meta: list.length + " attached" }),
      h("div", { class: "shots" },
        ui.segmented({ label: "Screenshot kind", options: KINDS, value: state.shotKind || "pre_entry", className: "segmented-full", onChange: function (v) { state.shotKind = v; } }),
        h("div", { class: "shot-grid" }, tiles), file,
        h("p", { class: "text-body-sm text-muted" }, h("span", { class: "hide-sm", text: "Paste with Ctrl+V / ⌘V or choose a file. " }), "Saved as WebP, up to 1600 px. In this demo the file stays in your browser."),
        error),
    ]), "rf-screenshots");
  }

  // Desktop: paste an image from the clipboard anywhere on the trade page.
  document.addEventListener("paste", function (e) {
    if (!current || current.busy || !document.querySelector(".shot-grid")) return;
    var items = e.clipboardData ? Array.prototype.slice.call(e.clipboardData.items) : [];
    var item = items.filter(function (x) { return x.kind === "file" && /^image\//.test(x.type); })[0];
    if (!item) return;
    e.preventDefault();
    current.add(item.getAsFile());
  });

  SJ.screenshots = { render: render, media: media, openViewer: openViewer };
})();
