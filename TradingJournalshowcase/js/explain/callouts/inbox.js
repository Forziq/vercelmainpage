// Callouts for the Reflection Inbox (#/inbox). Conventions: see the header of js/explain/engine.js.
(function () {
  window.SJ.explain.define([
    {
      id: "ib-progress",
      screen: "inbox",
      anchor: "ib-progress",
      title: "One trade at a time",
      plain: "The Inbox holds every finished trade that has no review yet, oldest first. A review takes 20 to 60 seconds, so the queue stays short.",
      technical: {
        text: "A trade is listed when its position is closed, written off or transferred and has no saved review. The count in the menu comes from the same rule. The card on screen is tracked by its position key, so after a save the next card takes its place.",
      },
    },
    {
      id: "ib-outcome",
      screen: "inbox",
      anchor: "ib-outcome",
      title: "Outcome is not execution",
      plain: "The badge says how the trade ended in money. The grade you give below rates how well you traded, so a winning trade can still be a D and a losing one an A.",
      technical: {
        text: "The outcome comes from the ROI: a win above +1%, a loss below −1% and breakeven in between (the band is a setting). The execution grade A to F is stored separately; analytics score it A = 4 down to F = 0. Lists show the two side by side.",
      },
    },
    {
      id: "ib-corrections",
      screen: "inbox",
      anchor: "ib-corrections",
      title: "Fix the trade before you review it",
      plain: "Merge joins this position with its neighbour in the same token. Void removes a trade that should not count at all.",
      technical: {
        text: "Both are saved as corrections that the position engine replays on every rebuild, so the raw transactions stay untouched. Void drops the position after the rebuild: its fills, fees and rent leave every total, and its failed attempts count as orphan fees. Undo deletes the correction and rebuilds again.",
      },
    },
    {
      id: "ib-review",
      screen: "inbox",
      anchor: "ib-review",
      title: "The 20-second review",
      plain: "Only the execution grade is required. Strategy, tags, rules, emotion, confidence, terminal and a one-line takeaway are a tap each.",
      technical: {
        text: "Saving marks the trade as reviewed and writes a result for every active rule: followed, unless you marked it broken. Rules the app can check itself show a Likely broken note, which changes nothing until you press Mark broken.",
        code: { label: "server/repositories/reflections.ts", lines: [
          "const broken = new Set(input.brokenRuleIds);",
          "const confirmed = new Set(input.autoConfirmedRuleIds.filter((id) => broken.has(id)));",
          "const ruleIds = new Set([...ruleRows.map((r) => r.id), ...broken]);",
          "// …",
          "[...ruleIds].map((ruleId) => ({",
          "  positionKey: input.positionKey,",
          "  ruleId,",
          "  result: broken.has(ruleId) ? (\"broken\" as const) : (\"followed\" as const),",
          "  source: confirmed.has(ruleId) ? (\"auto_confirmed\" as const) : (\"manual\" as const),",
          "})),",
        ] },
      },
    },
    {
      id: "ib-keys",
      screen: "inbox",
      anchor: "ib-keys",
      title: "Keyboard first",
      plain: "On a computer, 1 to 5 pick the grade, Enter saves and moves on, S skips, and J and K step through the queue.",
      technical: {
        text: "The keys never fire while you type in a field, while Cmd, Ctrl or Alt is held, or inside an open dialog. Enter on a focused button saves too; Space still presses the button.",
        code: { label: "lib/keyboard.ts", lines: [
          "export function reviewKeyAction(e: KeyInput): ReviewKeyAction | null {",
          "  if (e.metaKey || e.ctrlKey || e.altKey || e.inDialog || isTextEntry(e.target)) return null;",
          "  const i = \"12345\".indexOf(e.key);",
          "  if (e.key.length === 1 && i >= 0) return { type: \"grade\", grade: GRADES[i]! };",
          "  if (e.key === \"Enter\") return e.target?.tagName === \"A\" ? null : { type: \"save\" };",
          "  return LETTERS[e.key.toLowerCase()] ?? null;",
          "}",
        ] },
      },
    },
  ]);
})();
