// Callouts for Trades (#/trades). Conventions: see the header of js/explain/engine.js.
(function () {
  window.SJ.explain.define([
    {
      id: "trades-count",
      screen: "trades",
      anchor: "trades-count",
      title: "Positions, rebuilt from events",
      plain: "A position is one round trip in one token: from the first buy until the holding is sold down to dust. Each row is rebuilt from the wallet's parsed transactions, never typed in.",
      live: "a sync stores new transactions, parses them and rebuilds the positions of the tokens they touched.",
      technical: {
        text: "The engine replays a token's events in chain order. A buy adds tokens and their cost to the open position; a sell removes tokens at the average cost and books the difference as realised P&L.",
        code: { label: "lib/positions/engine.ts", lines: [
          "function applyBuy(acc: PositionAcc, e: EngineEvent): void {",
          "  const q = e.tokenAmountRaw ?? 0n;",
          "  const cost = absBig(e.swapSol);",
          "  acc.qty += q;",
          "  acc.basis += cost;",
          "  acc.qtyBought += q;",
          "  acc.solIn += cost;",
        ] },
      },
    },
    {
      id: "trades-filters",
      screen: "trades",
      anchor: "trades-filters",
      title: "Filters live in the address",
      plain: "Apply writes the filters into the page address, so a filtered list can be bookmarked and paging keeps them. A value that does not make sense is ignored instead of breaking the page.",
      live: "the server checks every filter against a schema before it builds the database query.",
      technical: {
        text: "Each parameter has its own rule: dates must be real days, P&L bounds plain SOL amounts, strategy and tag well-formed ids. Dates are whole calendar days in the owner's time zone, and the end date is included.",
        code: { label: "lib/validation/trades.ts", lines: [
          "// Search params arrive as `string | string[] | undefined`; take the first value and treat junk as absent.",
          "const param = <T extends z.ZodType>(schema: T) =>",
          "  z.preprocess((v) => (Array.isArray(v) ? v[0] : v === \"\" ? undefined : v), schema.optional()).catch(undefined);",
        ] },
      },
    },
    {
      id: "trades-strip",
      screen: "trades",
      anchor: "trades-strip",
      title: "Totals for the current filters",
      plain: "The strip sums every trade that matches the filters, across all pages. Win rate uses decided trades, and rule compliance is the share of reviewed trades with no broken rule.",
      technical: {
        text: "The live app computes the strip in one SQL query with the same filter conditions as the list, so the two can never disagree.",
        code: { label: "server/repositories/positions.ts", lines: [
          "netPnl: sql<string>`coalesce(sum(${positions.netPnl}) filter (where ${positions.outcome} is not null), 0)::text`,",
          "wins: sql<number>`(count(*) filter (where ${positions.outcome} = 'win'))::int`,",
          "losses: sql<number>`(count(*) filter (where ${positions.outcome} = 'loss'))::int`,",
        ] },
      },
    },
    {
      id: "trades-table",
      screen: "trades",
      anchor: "trades-table",
      title: "Reading a row",
      plain: "Net P&L is after every fee, and the small line under it is the same result in EUR at the time of each transaction. Times are shown in the owner's time zone, named once in the column header.",
      technical: {
        text: "A dash means unknown, never zero: an open position has no ROI or outcome yet. Green and red are kept for P&L, ROI and outcomes; fees and amounts stay neutral.",
      },
    },
    {
      id: "trades-paging",
      screen: "trades",
      anchor: "trades-paging",
      title: "Sorting and paging",
      plain: "Column headers sort the list, and a second click flips the direction. Rows without a value, such as the ROI of an open position, always go last.",
      technical: {
        text: "Fifty rows per page. Equal values fall back to the newest entry first, so the order is stable from one page to the next.",
        code: { label: "server/repositories/positions.ts", lines: [
          "return [sql`${SORT_COLUMN[key]} ${sql.raw(dir === \"asc\" ? \"asc\" : \"desc\")} nulls last`, desc(positions.openedAt), desc(positions.positionKey)];",
        ] },
      },
    },
    {
      id: "trades-export",
      screen: "trades",
      anchor: "trades-export",
      title: "CSV of exactly this list",
      plain: "Export CSV downloads every trade that matches the current filters, in the current order. In this demo the download is simulated.",
      live: "the file is built on request from the same query as the list and is never stored.",
      technical: {
        text: "The export route reuses the page's own parameter parser, so junk values are dropped in the same way and the file holds exactly the rows the list shows.",
        code: { label: "app/api/export/trades/route.ts", lines: [
          "// The page's own parser: junk values are dropped, so the CSV holds exactly what the list shows.",
          "const params = tradeListParamsSchema.parse(Object.fromEntries(new URL(request.url).searchParams));",
        ] },
      },
    },
    {
      id: "trades-fix",
      screen: "trades",
      anchor: "trades-fix",
      title: "Wrong position? Correct it",
      plain: "If the engine split or joined trades differently from how they were meant, the trade page offers Merge, Split, Exclude and Write off. Each one shows a preview of the affected positions before anything is saved.",
      technical: {
        text: "The preview runs the real save and rebuild inside a database transaction that is always rolled back, so it shows exactly what saving would do and writes nothing.",
        code: { label: "server/services/correctionPreview.ts", lines: [
          "await db.transaction(async (tx) => {",
          "  let before: SnapshotRow[] = [];",
          "  let scope: CorrectionScope = \"all\";",
          "  await stageCorrection(tx, walletId, req, async (s) => {",
          "    scope = s;",
          "    before = await snapshot(tx, walletId, s);",
          "  });",
          "  throw new Rollback(diffPositions(before, await snapshot(tx, walletId, scope)));",
          "});",
        ] },
      },
    },
  ]);
})();
