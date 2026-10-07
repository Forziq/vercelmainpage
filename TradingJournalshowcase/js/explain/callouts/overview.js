// Callouts for the overview page (#/). Conventions: see the header of js/explain/engine.js.
(function () {
  window.SJ.explain.define([
    {
      id: "ov-demo",
      screen: "overview",
      anchor: "ov-demo",
      title: "Invented data, real rules",
      plain: "Every wallet, token, trade and review in this demo is invented. The positions, statistics and charts are worked out in your browser by copies of the app's own rules.",
      live: "the same rules run on the server, over the owner's imported wallet history.",
      technical: {
        text: "A script generates the dataset from a fixed seed, so every visit shows the same numbers. Tests run the app's own engine and analytics on the same rows and check that the demo gets identical results. What you change stays in memory; Reset demo or a reload brings the generated data back.",
      },
    },
    {
      id: "ov-flow",
      screen: "overview",
      anchor: "ov-flow",
      title: "Data moves one way",
      plain: "Each layer reads only from the one before it. Raw transactions are stored once and never changed, so everything after them can be rebuilt.",
      live: "new transactions arrive through the Sync button, an automatic sync when the app opens, and a daily scheduled job.",
      technical: {
        text: "A sync step fetches one page of transactions, stores the ones it has not seen (a repeat is ignored), parses only those, and rebuilds positions for the tokens they touched inside one database transaction. Running a sync twice leaves the database the same.",
        code: { label: "server/repositories/ingest.ts", lines: [
          "export async function insertRawTransactions(db: AnyPgDb, rows: readonly RawRow[]): Promise<Set<string>> {",
          "  const inserted = new Set<string>();",
          "  for (const part of chunks(rows)) {",
          "    const got = await db",
          "      .insert(rawTransactions)",
          "      .values(part)",
          "      .onConflictDoNothing()",
          "      .returning({ signature: rawTransactions.signature });",
          "    for (const r of got) inserted.add(r.signature);",
          "  }",
          "  return inserted;",
          "}",
        ] },
      },
    },
    {
      id: "ov-decisions",
      screen: "overview",
      anchor: "ov-decisions",
      title: "Plain first, detail on request",
      plain: "Each card starts in plain English. Open Under the hood for the technical detail and a short excerpt of the real code.",
      technical: {
        text: "Excerpts are copied line for line from the app's source, and a test checks that every line still exists in the file named above it. Each is at most 15 lines and is scanned for secrets, addresses and personal details before the demo is published.",
      },
    },
    {
      id: "ov-quality",
      screen: "overview",
      anchor: "ov-quality",
      title: "Counted, not typed",
      plain: "A script counts these numbers from the repository when the demo is built. Nobody types them in.",
      technical: {
        text: "Source counts cover the app's TypeScript and CSS files, ignoring blank lines. Test cases count each written test block once, tables count the schema's table definitions, and tasks count the finished items on the project's task list.",
      },
    },
  ]);
})();
