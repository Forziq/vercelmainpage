// Callouts for Strategies, Mistakes and Rules. The sample-size note sits on two screens, so it is defined once per
// screen. Conventions: see js/explain/engine.js.
(function () {
  var SAMPLE = {
    title: "Your own words, counted",
    plain: "These lists are yours: you name the strategies and tags, then pick them while reviewing. The numbers come from closed, reviewed trades, and a name used fewer than 10 times is greyed out.",
    technical: { text: "The same group rows as Analytics, keyed by id, so renaming an item keeps its history together." },
  };
  var ARCHIVE = {
    text: "Delete removes an item no review uses. An item already on a review is archived instead, so the reviews that named it keep it, and it can be restored.",
    code: { label: "server/repositories/vocab.ts", lines: [
      "export async function deleteOrArchive(db: AnyPgDb, userId: string, kind: VocabKind, id: string): Promise<\"deleted\" | \"archived\"> {",
      "  return db.transaction(async (tx) => {",
      "    if ((await uses(tx, userId, kind, id)) > 0) {",
      "      await setArchived(tx, userId, kind, id, true);",
      "      return \"archived\";",
      "    }",
    ] },
  };
  var on = function (screen, prefix, anchor, c) { return Object.assign({ id: prefix + "-" + anchor.slice(3), screen: screen, anchor: anchor }, c); };

  window.SJ.explain.define([
    on("strategies", "vs", "vo-sample", SAMPLE),
    on("strategies", "vs", "vo-strategies", {
      title: "Strategies side by side",
      plain: "Each strategy with its trades, win rate, net and average result, ROI, profit factor and execution grade. Use the gear to rename, archive or delete one.",
      technical: ARCHIVE,
    }),
    on("mistakes", "vm", "vo-sample", SAMPLE),
    on("mistakes", "vm", "vo-month", {
      title: "Sentences only with enough data",
      plain: "One plain line per tag used on at least 10 reviewed trades this month: what those trades made and their win rate. A tag with fewer gets no sentence at all, so the page never states a pattern it cannot back up.",
      technical: {
        text: "The sentence is built from the numbers alone; there is no generated wording, judgement or advice in it.",
        code: { label: "lib/analytics/vocab.ts", lines: [
          "export function tagSentence(name: string, row: GroupRow | undefined, period = \"this month\"): string | null {",
          "  if (!row?.enoughData) return null;",
          "  const win = row.winRate ? `win rate ${rate(row.winRate)}` : \"no wins or losses\";",
        ] },
      },
    }),
    on("mistakes", "vm", "vo-tags", {
      title: "Mistakes and strengths",
      plain: "Tags are either a mistake or a strength, and each list shows what trades with that tag did over all time. A trade with several tags counts once in each.",
      technical: ARCHIVE,
    }),
    on("rules", "vr", "vo-adherence", {
      title: "Did you follow your rules?",
      plain: "Adherence is the share of reviewed trades where you marked no rule as broken. It describes what you did; it does not tell you which rules to keep.",
      technical: { text: "Each review saves a result for every active rule: followed unless you marked it broken. Inactive rules leave the checklist but keep their past results." },
    }),
    on("rules", "vr", "vo-auto", {
      title: "Automatic checks only suggest",
      plain: "A rule can have an automatic check, such as a maximum number of trades per session; when a trade looks like it broke one, the review form shows why with Mark broken and Dismiss. Nothing is recorded until you choose.",
      technical: {
        text: "Three checks exist: trades per session, loss per trade (in SOL or % ROI) and entries after N losses on the same day.",
        code: { label: "lib/rules/autoChecks.ts", lines: [
          "export const AUTO_TYPES = [\"MAX_TRADES_PER_SESSION\", \"MAX_LOSS_PER_TRADE\", \"NO_ENTRY_AFTER_N_LOSSES\"] as const;",
        ] },
      },
    }),
    on("rules", "vr", "vo-rules", {
      title: "Each rule's record",
      plain: "How often each rule was followed on the trades where it was checked, with the count behind the percentage. Under 10 checks the number is greyed out.",
      technical: ARCHIVE,
    }),
  ]);
})();
