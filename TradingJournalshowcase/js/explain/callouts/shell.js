// Callouts for the shell's top bar, shown on every app screen (screen "shell"). Conventions: see js/explain/engine.js.
(function () {
  window.SJ.explain.define([
    {
      id: "shell-search",
      screen: "shell",
      anchor: "shell-search",
      title: "Search with Cmd+K or Ctrl+K",
      plain: "Search jumps to any page, token or trade by symbol, name or the start of a mint address. Arrow keys move through the results, Enter opens one and Esc closes it.",
      live: "the search runs on the server over every wallet of the owner, at most 8 results, with wildcards in the text escaped.",
      technical: {
        text: "The shortcut never fires while you type in a field or work in another dialog, so it cannot steal a keystroke from a review. The box is a combobox: the highlighted result is announced through aria-activedescendant while focus stays in the input.",
        code: { label: "lib/keyboard.ts", lines: [
          "/** Cmd+K / Ctrl+K opens global search, except while typing in a field or working in another dialog. */",
          "export function isPaletteShortcut(e: KeyInput): boolean {",
          "  return e.key === \"k\" && (e.metaKey === true || e.ctrlKey === true) && !e.altKey && !e.inDialog && !isTextEntry(e.target);",
          "}",
        ] },
      },
    },
    {
      id: "shell-sync",
      screen: "shell",
      anchor: "shell-sync",
      title: "One sync loop",
      plain: "Sync imports the wallet's new transactions page by page, parses them and rebuilds only the positions they touch. The header button and the Settings panels share one loop, so two syncs never race.",
      live: "the app also syncs on open when the last sync is older than the auto-sync setting, and once a day from a cron job.",
      technical: {
        text: "Each step is one request: fetch up to 100 transactions, store them, parse, rebuild. A per-wallet lock answers a second caller with 409; the loop waits and retries, and backs off on provider errors. Here the step imports the trade made after the last sync, so the Inbox and dashboard change.",
        code: { label: "components/sync/sync-provider.tsx", lines: [
          "while (!stopRequested.current) {",
          "  const res = await postSyncStep(m);",
          "  if (res.ok) {",
          "// …",
          "  if (res.error === \"locked\" && lockTries++ < LOCK_RETRIES) {",
          "    setPhase(\"waiting\");",
          "    setMessage(\"Another sync is running. Waiting…\");",
          "    await sleep(LOCK_RETRY_MS);",
          "    continue;",
          "  }",
        ] },
      },
    },
    {
      id: "shell-single",
      screen: "shell",
      anchor: "shell-single",
      title: "Built for one person",
      plain: "The journal has exactly one user: the owner. Every number and name in this demo is invented, and the demo runs entirely in your browser.",
      live: "only the one allowed email can sign in; any other account is turned away even if it exists.",
      technical: {
        text: "Every route checks the signed-in user against the allowed email on the server, including the sync step. Nothing in the browser can widen that.",
        code: { label: "server/auth.ts", lines: [
          "  if (!claims?.sub || claims.email?.toLowerCase() !== getServerEnv().ALLOWED_EMAIL.toLowerCase()) return null;",
        ] },
      },
    },
  ]);
})();
