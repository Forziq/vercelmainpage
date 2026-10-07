# Solana Journal: interactive demo

A static, self-contained demo of a private trading-reflection journal: a web app that imports a wallet's on-chain
trades, rebuilds them into positions, computes statistics and gives its owner a place to review each decision. This
folder rebuilds every screen of that app with **invented data**, so anyone can click through it and read how each
part works. It contains no personal information, no real wallet, no keys and no connection to the real app.

## What is in here

- Plain HTML, CSS and classic JavaScript. No build step, no dependencies, no network requests.
- `index.html`: the app shell; every page is a hash route such as `#/dashboard`.
- `css/`: the app's design tokens and styles, copied in. `fonts/`: self-hosted fonts and their licence.
- `js/`: `meta.js` holds the snapshot date shown on every page; `core/` has the router, shell and helpers.
- `js/explain/`: the Explain mode (numbered markers and popovers) and one callout file per screen; everything
  that needs a server in the real app is simulated by `js/core/sim.js`. **Reset demo** in the top bar undoes your changes.
- The demo data and any generated files are produced by scripts in the app's repository and committed here as
  plain JavaScript, so this folder never has to run them.

## Open it locally

Double-click `index.html`. It runs from the file system (`file://`); no server is needed.
If you prefer a server, any static one works, for example `python3 -m http.server` run inside this folder.

## Deploy it (Vercel)

1. Copy this whole folder into the repository that should host it: a dedicated repository, or a subfolder of
   another site's repository.
2. In Vercel, create a project for it with **Framework Preset: Other**, **no build command**, and the
   output/root directory set to the folder that contains `index.html`.
3. Open the deployed address and check that the page loads without console errors and that "View source" shows
   `<meta name="robots" content="noindex, nofollow">`.

All paths are relative and routing uses the URL hash, so the demo works at the root of a domain and at a subpath
such as `/journal-demo/`.

### If it lives in a subfolder of another site

Vercel only reads the `vercel.json` at the root of the deployed project. In that case:

- Check the host project's own `vercel.json`. A catch-all rewrite (for example every path to a single-page app's
  `index.html`) can swallow `/journal-demo/...`. Add an exception, or a rewrite that sends `/journal-demo` to
  `/journal-demo/index.html`, before the catch-all.
- Copy the `X-Robots-Tag: noindex` header from this folder's `vercel.json` into the host's `vercel.json`, limited
  to the demo's path, so search engines skip the demo there too.

## Not indexed

`index.html` carries a `noindex, nofollow` robots tag and `vercel.json` sends `X-Robots-Tag: noindex`. The demo is
meant to be opened from a link, not found by search.

## Credits and licences

- Fonts: Geist, Inter and JetBrains Mono, under the SIL Open Font License 1.1 (see `fonts/OFL.txt` for the
  copyright notices and full licence text).
- Icons: outline icons from Lucide (ISC licence), copied into `js/core/icons.js`.
