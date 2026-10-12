// Callouts for Exports (#/exports). Conventions: see the header of js/explain/engine.js.
(function () {
  window.SJ.explain.define([
    {
      id: "x-period",
      screen: "exports",
      anchor: "x-period",
      title: "Tax years in Dublin time",
      plain: "Pick a tax year or any range of whole days; the days are Dublin calendar days whatever the display timezone. The wallet picker only chooses whose rows are listed, because token lots are matched across all your wallets.",
      technical: {
        text: "A period is [from, to). The ledger runs on every event before the end of the period, so a later trade can never change an earlier match, and rows are then kept by their own time.",
        code: { label: "lib/accounting/cgt.ts", lines: [
          "/** Dublin midnight of a `yyyy-MM-dd` day. */",
          "export const taxDayStart = (day: string): Date => fromZonedTime(`${day}T00:00:00`, TAX_TIME_ZONE);",
          "",
          "/** The tax year [1 Jan, next 1 Jan) in Dublin time. */",
          "export const taxYearPeriod = (year: number): Period => ({ from: taxDayStart(`${year}-01-01`), to: taxDayStart(`${year + 1}-01-01`) });",
        ] },
      },
    },
    {
      id: "x-counts",
      screen: "exports",
      anchor: "x-counts",
      title: "FIFO is an assumption, stated",
      plain: "Gains are worked out by matching each sale with the oldest tokens bought first (FIFO). The tax authority prescribes no method for crypto-assets, so every sheet says it is an assumption to confirm with an accountant, and no tax is computed.",
      technical: {
        text: "The method is a named entry in a small registry, so another one can be added without rewriting the sheets; every output carries its name and assumption.",
        code: { label: "lib/accounting/method.ts", lines: [
          "fifo: {",
          "  name: \"fifo\",",
          "  label: \"FIFO (first in, first out)\",",
          "  assumption:",
          "    \"FIFO applied as an assumption — confirm with your accountant. Revenue's crypto-asset manual says gains are computed \" +",
          "    \"on a disposal-by-disposal basis and prescribes no matching method.\",",
          "  run: runFifo,",
          "},",
        ] },
      },
    },
    {
      id: "x-health",
      screen: "exports",
      anchor: "x-health",
      title: "Warnings before you download",
      plain: "The same data-health checks as the dashboard, here because each one would make the workbook wrong or incomplete. Details explains every check and links to where it is fixed.",
    },
    {
      id: "x-download",
      screen: "exports",
      anchor: "x-download",
      title: "Built on request, never stored",
      plain: "The workbook is generated the moment you ask for it and handed straight to the browser. Nothing is kept on the server afterwards.",
      live: "the download is a real .xlsx with the six sheets shown below and EUR cells as numbers; here the download is simulated.",
      technical: {
        text: "The route checks the session, validates the query with zod (400 when invalid) and answers with no-store caching.",
        code: { label: "app/api/export/accounting/route.ts", lines: [
          "const query = accountingExportSchema.safeParse(firstValues(Object.fromEntries(new URL(request.url).searchParams)));",
          "if (!query.success) return Response.json({ error: \"invalid_query\" }, { status: 400 });",
          "// …",
          "    \"cache-control\": \"no-store\",",
        ] },
      },
    },
    {
      id: "x-sheets",
      screen: "exports",
      anchor: "x-sheets",
      title: "Raw events in, flagged rows out",
      plain: "The workbook is built from the raw on-chain events, not from the journal's positions. A trade voided or excluded in the journal still happened on chain, so it stays in every sheet with a flag instead of being dropped.",
      technical: {
        text: "A partly sold lot gives its cost pro rata by quantity. Each slice is the difference of the lot's cumulative cost, so the cost of a lot is conserved exactly across its sales and its open remainder. A missing SOL/EUR rate leaves the cell blank and adds a warning; nothing is guessed.",
        code: { label: "lib/accounting/fifo.ts", lines: [
          "/** Cost of the first `used` units of a lot. Taking slices as differences of this keeps the lot's cost exactly conserved. */",
          "function costOfUsed(lot: Lot, used: bigint): Decimal | null {",
          "  if (lot.costEur === null) return null;",
          "  if (used === lot.qty) return lot.costEur;",
          "  return lot.costEur.mul(used.toString()).div(lot.qty.toString());",
          "}",
        ] },
      },
    },
    {
      id: "x-recon",
      screen: "exports",
      anchor: "x-recon",
      title: "Why the workbook differs from the journal",
      plain: "The journal values a position at its average cost, the workbook matches lots first in, first out, so their totals differ. The reconciliation splits the difference into lines that add up to it exactly: voids, exclusions, failed-swap fees, written-off basis, and method and timing.",
      technical: {
        text: "Both sides leave out items with an unknown EUR figure and count them. The last line is the remainder, so the lines always sum to the difference to the cent.",
        code: { label: "lib/accounting/reconcile.ts", lines: [
          "const difference = appNetPnlEur.sub(methodGainEur);",
          "// …",
          "const failedFees = sum(known.map((p) => p.failedFeesEur!)).neg();",
          "const writtenOffBasis = sum(known.map((p) => p.writtenOffEur!)).neg();",
          "const methodAndTiming = difference.sub(voided).sub(excluded).sub(failedFees).sub(writtenOffBasis);",
        ] },
      },
    },
    {
      id: "x-notes",
      screen: "exports",
      anchor: "x-notes",
      title: "Notes say what is left out",
      plain: "The last sheet states every assumption: the method, the rate source, that SOL's own gains are excluded, how voided and written-off items appear, and that it is not tax advice.",
    },
  ]);
})();
