// Callouts for the trade Coach panel on trade detail.
(function () {
  window.SJ.explain.define([
    {
      id: "co-panel",
      screen: "trade-detail",
      anchor: "co-panel",
      title: "AI Coach: a critic, not an adviser",
      plain: "An optional check of your review against the trade's numbers and your own rules. It runs only when you press Generate, and it never changes your review.",
      live: "an AI model gets the trade's numbers and your review, never the wallet, token name or address; this demo shows pre-written sample output.",
      technical: {
        text: "The Coach gives no trade advice, does not judge the token or the exit timing, and cites the input fields behind every point. Suggested tags come only from your own lists and are saved only when you confirm them. When the review or the trade changes, the critique shows as out of date.",
        code: { label: "lib/ai/coach/panel.ts", lines: [
          "export function coachPanelState({ configured, eligible, row, stale, now, pendingLimitMs }: CoachPanelInput): CoachPanelState {",
          "  if (!configured || !eligible) return \"hidden\";",
          "  if (!row) return \"none\";",
          "  if (row.status === \"pending\") return now.getTime() - row.startedAt.getTime() > pendingLimitMs ? \"failed\" : \"pending\";",
          "  if (row.status === \"failed\") return \"failed\";",
          "  return stale ? \"stale\" : \"done\";",
          "}",
        ] },
      },
    },
  ]);
})();
