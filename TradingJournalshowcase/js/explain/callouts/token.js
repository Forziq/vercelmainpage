// Callouts for the token page (#/tokens/<mint>). Conventions: see the header of js/explain/engine.js.
(function () {
  window.SJ.explain.define([
    {
      id: "token-mint",
      screen: "token",
      anchor: "token-mint",
      title: "One page per token",
      plain: "A token is identified by its mint address. Every token, name and address in this demo is invented.",
      live: "the name, supply and creation time come from the data provider the first time a token is seen; missing details show placeholders, never an error.",
    },
    {
      id: "token-combined",
      screen: "token",
      anchor: "token-combined",
      title: "Everything in this token, combined",
      plain: "The combined result adds up every position the owner has had in this token, in all of their wallets. Only decided positions count towards the P&L, as everywhere else.",
      technical: {
        text: "The combined net P&L stays empty until at least one position is decided. The EUR figure is only shown when every decided position has one.",
        code: { label: "lib/positions/token-summary.ts", lines: [
          "/** The combined result of every position in one token (all of the owner's wallets). */",
          "export function tokenTotals(rows: readonly TokenPositionTotalsInput[]): TokenTotals {",
          "  const decided = rows.filter((r) => r.outcome !== null);",
          "// …",
          "    netPnl: decided.length === 0 ? null : sumBig(decided.map((r) => r.netPnl)),",
          "    eurNetPnl: decided.length === 0 ? null : sumEur(decided.map((r) => r.eurNetPnl)),",
        ] },
      },
    },
    {
      id: "token-timeline",
      screen: "token",
      anchor: "token-timeline",
      title: "Positions in order",
      plain: "Each position in the token is listed oldest first, with its outcome, review grade and result. Open trade goes to its full page.",
      technical: {
        text: "Positions from more than one wallet would carry a wallet badge here; in this demo every token was traded from a single wallet.",
      },
    },
    {
      id: "token-reentry",
      screen: "token",
      anchor: "token-reentry",
      title: "Coming back to a token",
      plain: "A re-entry is a new position opened after the previous one in the same token closed. The link jumps to the position it followed.",
      technical: {
        text: "The engine records the previous position's key when it opens a new one. If that position has since been merged or removed, the line reads an earlier position, without a link.",
        code: { label: "lib/positions/engine.ts", lines: [
          "keys.add(key);",
          "acc = newAcc(key, e, prev?.key ?? null);",
          "// Dust left over from the previous position moves into the new one at zero cost.",
        ] },
      },
    },
    {
      id: "token-takeaway",
      screen: "token",
      anchor: "token-takeaway",
      title: "Your own notes, side by side",
      plain: "The takeaway and tags written in each review appear under the position, so earlier lessons about the same token are in one place.",
      technical: {
        text: "Reviews are stored against the position key rather than a database row, so they stay attached when positions are rebuilt.",
      },
    },
  ]);
})();
