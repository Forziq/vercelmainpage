// Callouts for trade detail (#/trades/<key>). Conventions: see the header of js/explain/engine.js.
(function () {
  window.SJ.explain.define([
    {
      id: "td-metrics",
      screen: "trade-detail",
      anchor: "td-metrics",
      title: "The result of one round trip",
      plain: "Net P&L is what the sells brought in minus what the sold tokens cost, minus every fee. ROI divides that by the SOL spent buying.",
      technical: {
        text: "A position stores its fee parts separately, including the fees of failed attempts attached to it. Rent is kept out of P&L because it comes back when the token account is closed.",
        code: { label: "lib/positions/metrics.ts", lines: [
          "const feesTotal = acc.feeNetwork + acc.feePriority + acc.feeTip + acc.feePlatform + acc.feeFailed;",
          "const netPnl = acc.realised - feesTotal;",
          "// Tokens transferred out left without a price, so a transferred position has no ROI or outcome.",
          "const roi = acc.status === \"open\" || acc.status === \"transferred\" ? null : ratio(netPnl, acc.solIn);",
        ] },
      },
    },
    {
      id: "td-execution",
      screen: "trade-detail",
      anchor: "td-execution",
      title: "Entry and exit, measured",
      plain: "Average prices are the SOL paid or received per whole token. Market cap at entry and exit is that price times the token's supply, in SOL.",
      technical: {
        text: "Token age at entry compares the first buy with the token's creation time. Peak capital is the largest cost basis the position held at any moment.",
      },
    },
    {
      id: "td-fees",
      screen: "trade-detail",
      anchor: "td-fees",
      title: "Every fee, taken apart",
      plain: "Fees are split into the network base fee, priority fee, tip, platform fee and failed attempts. Rent paid and refunded are listed, but they never count as a cost.",
      live: "the platform fee is whatever the trading tool took on top; the protocol's own fees count in the price instead.",
      technical: {
        text: "The base fee is 5,000 lamports per signature and the rest of the network fee is priority. Outgoing transfers to known tip accounts are tips, and transfers to anyone outside the swap are platform fees.",
        code: { label: "lib/solana/parser/fees.ts", lines: [
          "export function networkFee(tx: TrimmedTx, wallet: string): NetworkFee {",
          "  if (tx.accountKeys[0]?.pubkey !== wallet) return { base: 0n, priority: 0n };",
          "  const fee = BigInt(tx.fee);",
          "  const signatures = BigInt(tx.accountKeys.filter((k) => k.signer).length);",
          "  const expectedBase = LAMPORTS_PER_SIGNATURE * signatures;",
          "  const base = fee < expectedBase ? fee : expectedBase;",
          "  return { base, priority: fee - base };",
          "}",
        ] },
      },
    },
    {
      id: "td-events",
      screen: "trade-detail",
      anchor: "td-events",
      title: "Read from balance changes",
      plain: "Each event comes from one transaction: the parser compares the wallet's balances before and after it. Whatever SOL change the fees and rent do not explain is the swap itself.",
      technical: {
        text: "The parser never guesses from instruction names. It adds the wallet's SOL change, the fees, tips and rent back together; a negative result with tokens coming in is a buy, a positive one with tokens going out is a sell.",
        code: { label: "lib/solana/parser/swap.ts", lines: [
          "const swapSol =",
          "  walletSolChange(tx, wallet) + fee.base + fee.priority + tip + platformFee + rent.paid - rent.refunded;",
          "",
          "const isBuy = change.delta > 0n && swapSol < 0n;",
          "const isSell = change.delta < 0n && swapSol > 0n;",
        ] },
      },
    },
    {
      id: "td-corrections",
      screen: "trade-detail",
      anchor: "td-corrections",
      title: "Corrections, not edits",
      plain: "Raw transactions are never changed. A correction is a small instruction, such as merge these two positions, that is replayed every time positions are rebuilt.",
      live: "each dialog previews the affected positions with a dry run of the real save, rolled back so nothing is written.",
      technical: {
        text: "Merge, Split, Exclude and Write off are stored as rows and applied in creation order. A correction that would change nothing is refused, and only neighbouring positions of a token can merge.",
        code: { label: "server/services/correctionPreview.ts", lines: [
          " * A dry run of `applyCorrection`: the same plan, save and rebuild run in a transaction that is always rolled back, so",
          " * nothing is written. Returns the positions the correction would change. Throws `CorrectionError` like a save would.",
        ] },
      },
    },
    {
      id: "td-undo",
      screen: "trade-detail",
      anchor: "td-undo",
      title: "Undo is deleting the row",
      plain: "Because positions are always rebuilt from raw data plus corrections, undoing a correction just deletes it. The positions go back to how they were.",
      live: "the full list of corrections and the Undo buttons live in Settings → Corrections.",
      technical: {
        text: "Undo deletes the row and rebuilds what it touched inside one database transaction.",
        code: { label: "server/services/corrections.ts", lines: [
          "export async function undoCorrection(db: AnyPgDb, walletId: string, id: string): Promise<void> {",
          "  await db.transaction(async (tx) => {",
          "    const [row] = await tx",
          "      .delete(corrections)",
          "      .where(and(eq(corrections.id, id), eq(corrections.walletId, walletId)))",
          "      .returning({ type: corrections.type, payload: corrections.payload });",
          "    if (!row) throw new CorrectionError(\"That correction was already undone.\");",
          "    await rebuildScope(tx, walletId, await undoScope(tx, walletId, row.type, row.payload));",
          "  });",
          "}",
        ] },
      },
    },
    {
      id: "td-reentry",
      screen: "trade-detail",
      anchor: "td-reentry",
      title: "Re-entries are linked",
      plain: "When a position closes and the same token is bought again, the new buy opens a new position. It is linked to the one before, so a return to the same token stays visible.",
      technical: {
        text: "A position closes when what is left is dust: at most 1% of the peak holding, or worth less than 0.001 SOL at the last fill price. Dust left over moves into the next position at zero cost.",
      },
    },
    {
      id: "td-key",
      screen: "trade-detail",
      anchor: "td-key",
      title: "A key that survives rebuilds",
      plain: "Each position is named by its wallet, its token and the transaction that opened it. Reviews, tags and screenshots point at that key, so a rebuild never loses them.",
      technical: {
        text: "Database row ids change on every rebuild, so nothing refers to them. If a correction removes a key, its review is kept and listed for relinking instead of being deleted.",
        code: { label: "lib/positions/engine.ts", lines: [
          "function keyFor(walletId: string, e: EngineEvent, keys: ReadonlySet<string>): string {",
          "  const key = `${walletId}:${e.mint}:${e.signature}`;",
          "  return keys.has(key) ? `${key}:${e.eventIndex}` : key;",
          "}",
        ] },
      },
    },
  ]);
})();
