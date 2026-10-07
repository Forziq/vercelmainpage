// Text and code excerpts for the overview page (docs/showcase.md §1, §6, §8). Every statement describes the app as of
// SJ.meta.asOf. Code excerpts are copied line for line from the app's source (paths relative to its source folder,
// or to the repository for migrations); a "// …" line marks skipped lines. tests/showcase-overview.test.ts checks
// that every excerpt line still exists in the named file and that no excerpt is longer than 15 lines.
(function () {
  var SJ = (window.SJ = window.SJ || {});

  SJ.overviewContent = {
    pitch:
      "A private, single-user web app that imports one public wallet's trades, rebuilds them into positions, " +
      "computes honest statistics and gives its owner a fast place to review each decision. It never recommends " +
      "trades and never touches private keys.",
    domain:
      "The trades are Pump.fun token swaps on the Solana blockchain, placed through trading terminals. The app only " +
      "reads them, from the wallet's public history.",

    problems: [
      { title: "History shows fills, not decisions", text: "A wallet's history is a list of swaps. It does not say which swaps form one position, what that position cost, or why it was taken." },
      { title: "Costs hide in many places", text: "Network fees, priority fees, tips, platform fees, failed attempts and account rent all change the real result of a position." },
      { title: "Without review, patterns repeat", text: "The same mistakes come back when nobody writes down what happened and checks it against the numbers later." },
    ],
    answer:
      "The app imports the history automatically, rebuilds positions exactly, asks for a short review of each closed " +
      "position (20 to 60 seconds) and turns the reviews into breakdowns, calendars and weekly and monthly reviews.",

    // The data flow, in order. `note` is the small second line in the diagram.
    flow: [
      { title: "Wallet", note: "public address only" },
      { title: "Data provider", note: "read-only API" },
      { title: "Raw transactions", note: "stored, never edited" },
      { title: "Parser", note: "balance changes to events" },
      { title: "Positions", note: "rebuilt by a pure engine" },
      { title: "Corrections", note: "owner's fixes, replayed" },
      { title: "Analytics", note: "metrics, sample gating" },
      { title: "Reflection", note: "the owner's review" },
      { title: "Reviews", note: "day, week, month" },
      { title: "Coach and export", note: "critique, workbook" },
    ],
    flowCaption:
      "Data moves one way through fixed layers. Raw transactions are kept as received; everything after them can be " +
      "rebuilt from them plus the owner's corrections.",

    decisions: [
      {
        id: "money",
        title: "Money as whole numbers and exact decimals",
        plain: "Amounts are stored in lamports, the smallest unit of SOL, so totals never drift through rounding.",
        technical:
          "Lamports and raw token amounts are bigint everywhere. Prices and ratios use exact decimals (decimal.js). All " +
          "money maths lives in two pure modules. When an amount is split, the remainder goes to the largest share, so " +
          "the parts always add up to the total.",
        code: { label: "lib/finance/allocate.ts", lines: [
          "export function allocateProRata(total: bigint, weights: readonly bigint[]): bigint[] {",
          "  if (weights.length === 0) return [];",
          "  const sum = weights.reduce((a, w) => a + (w > 0n ? w : 0n), 0n);",
          "  const shares = weights.map((w) => (sum > 0n && w > 0n ? (total * w) / sum : 0n));",
          "  const target = sum > 0n ? largestIndex(weights) : 0;",
          "  shares[target] = shares[target]! + total - shares.reduce((a, s) => a + s, 0n);",
          "  return shares;",
          "}",
        ] },
      },
      {
        id: "immutable",
        title: "Raw data is never edited; fixes are replayed",
        plain: "What came from the blockchain stays as it was. A manual fix is saved as a correction and applied again every time positions are rebuilt.",
        technical:
          "The layers are raw transactions (immutable), parsed events (re-parsed when the parser improves) and positions " +
          "(derived, rebuildable). Corrections such as merge, split, exclude an event, write off and void are " +
          "directives replayed in the order they were made, so fixes survive every rebuild and can be undone.",
        code: { label: "server/services/rebuild.ts", lines: [
          "/**",
          " * Rebuilds the derived positions and links of `mints` from raw events plus corrections. The engine gets those mints'",
          " * events and the wallet's mint-less events (rent); every correction is passed, and only positions of `mints` are",
          " * written. Call inside the step's transaction so nothing is half-replaced.",
          " */",
          "export function rebuildMints(db: AnyPgDb, walletId: string, mints: readonly string[]): Promise<RebuildSummary> {",
          "  return rebuild(db, walletId, mints, false);",
          "}",
        ] },
      },
      {
        id: "key",
        title: "A stable key for everything the owner writes",
        plain: "Each position has a readable key made from its wallet, token and first fill, so a review stays attached to the same position after a rebuild.",
        technical:
          "Reviews, tags, rule results and screenshots point at this key, never at a database row id. A rebuild replaces " +
          "the position rows and leaves the owner's notes alone. A merge keeps the older key; a review on the absorbed " +
          "position is offered for relinking.",
        code: { label: "lib/positions/engine.ts", lines: [
          "function keyFor(walletId: string, e: EngineEvent, keys: ReadonlySet<string>): string {",
          "  const key = `${walletId}:${e.mint}:${e.signature}`;",
          "  return keys.has(key) ? `${key}:${e.eventIndex}` : key;",
          "}",
        ] },
      },
      {
        id: "validated",
        title: "Nothing from outside is trusted",
        plain: "Every response from the data provider and every form the owner submits is checked against a schema before it is used.",
        technical:
          "zod schemas describe the provider's responses and every server action and route input. A response with an " +
          "unexpected shape stops that sync step with a provider error instead of writing bad data.",
        code: { label: "lib/solana/helius/schemas.ts", lines: [
          "export const rawTransactionSchema = z.object({",
          "  slot: z.number().int(),",
          "  blockTime: z.number().int().nullable(),",
          "  transaction: z.object({",
          "    signatures: z.array(z.string()).min(1),",
          "// …",
          "  meta: z.object({",
          "    err: z.unknown(),",
          "    fee: z.number(),",
          "    preBalances: z.array(z.number()),",
          "    postBalances: z.array(z.number()),",
          "    preTokenBalances: z.array(tokenBalance).nullish(),",
          "    postTokenBalances: z.array(tokenBalance).nullish(),",
        ] },
      },
      {
        id: "secrets",
        title: "Secrets stay on the server",
        plain: "Keys for the database, the data provider and the AI service exist only on the server. The browser never receives them.",
        technical:
          "Server modules begin with import \"server-only\", so the build fails if one is pulled into browser code. " +
          "Environment variables are read through one schema-checked module, on first use, so a build needs no secrets.",
        code: { label: "server/env.ts", lines: [
          "import \"server-only\";",
          "import { z } from \"zod\";",
          "const serverEnvSchema = z.object({",
          "  DATABASE_URL: z.string().min(1),",
          "  HELIUS_API_KEY: z.string().min(1),",
          "  SUPABASE_SECRET_KEY: z.string().min(1),",
          "  ALLOWED_EMAIL: z.email(),",
          "// …",
          "/** Validates on first call, not at import, so `next build` needs no secrets. */",
          "export function getServerEnv(): ServerEnv {",
          "  cached ??= serverEnvSchema.parse(process.env);",
          "  return cached;",
          "}",
        ] },
      },
      {
        id: "auth",
        title: "One user, by design",
        plain: "Sign-ups are switched off and only one email address is accepted, so the app has exactly one user.",
        technical:
          "Email and password sign-in through Supabase Auth. Each request's session token is verified on the server, and " +
          "a valid session for any other email is refused. Every route except the sign-in page and the scheduled sync " +
          "is protected; the scheduled sync needs its own secret.",
        code: { label: "server/auth.ts", lines: [
          "export const getAuthorizedUserId = cache(async (): Promise<string | null> => {",
          "  const supabase = await createSupabaseServerClient();",
          "  const { data } = await supabase.auth.getClaims();",
          "  const claims = data?.claims;",
          "  if (!claims?.sub || claims.email?.toLowerCase() !== getServerEnv().ALLOWED_EMAIL.toLowerCase()) return null;",
          "  return claims.sub;",
          "});",
        ] },
      },
      {
        id: "rls",
        title: "The database's public API is closed",
        plain: "The app's own server is the only way into the data. The database's built-in public API cannot read any table.",
        technical:
          "Row-level security is switched on for every table with no policies. All reads and writes go through the server " +
          "over a direct database connection, so the public key that the browser uses for sign-in opens no data.",
        code: { label: "drizzle/0000_windy_red_ghost.sql", lines: [
          "ALTER TABLE \"parsed_events\" ENABLE ROW LEVEL SECURITY;",
          "ALTER TABLE \"raw_transactions\" ENABLE ROW LEVEL SECURITY;",
          "ALTER TABLE \"sync_runs\" ENABLE ROW LEVEL SECURITY;",
          "ALTER TABLE \"sync_state\" ENABLE ROW LEVEL SECURITY;",
        ] },
      },
    ],

    guardrails: {
      plain:
        "The optional AI Coach reads the owner's own review and the position's data, then points out contradictions " +
        "and suggests tags. It runs only when the owner presses Generate, and nothing it says is saved until the owner " +
        "confirms it.",
      rules: [
        "No trade advice, signals or predictions.",
        "No judgement of the token itself.",
        "No judgement of exit timing: the app has no price path between entry and exit.",
        "Every point cites the input fields it relies on.",
        "Tags and rule flags come only from the owner's own lists.",
        "\"Not enough information\" instead of a guess.",
      ],
      technical:
        "The model must answer in a strict JSON schema. Code then drops any suggested tag or rule that is not one of the " +
        "owner's, and any point whose cited fields are missing or not part of the input.",
      code: { label: "lib/ai/coach/filter.ts", lines: [
        "export function filterCoachOutput(",
        "  output: CoachOutput,",
        "  vocab: CoachVocab,",
        "  paths: ReadonlySet<string>,",
        "): { output: CoachOutput; dropped: number } {",
        "  let dropped = 0;",
        "  const cites = (fields: readonly string[]) => fields.length > 0 && fields.every((f) => validField(f, paths));",
      ] },
    },

    // Labels for SJ.stats (generated by scripts/showcase/generate-stats.mjs), in display order.
    quality: [
      { key: "sourceLines", label: "Source lines" },
      { key: "sourceFiles", label: "Source files" },
      { key: "testCases", label: "Test cases" },
      { key: "testFiles", label: "Test files" },
      { key: "tables", label: "Database tables" },
      { key: "migrations", label: "Migrations" },
      { key: "tasksShipped", label: "Tasks shipped" },
      { key: "docs", label: "Design docs" },
    ],

    stack: [
      { group: "App", items: ["Next.js (App Router)", "React", "TypeScript (strict)", "Tailwind CSS"] },
      { group: "Data", items: ["Postgres on Supabase", "Supabase Auth and Storage", "Drizzle ORM", "zod", "decimal.js"] },
      { group: "Outside services", items: ["Helius (chain data, read-only)", "OpenRouter (optional AI Coach)", "Coinbase (SOL/EUR rates)"] },
      { group: "Quality and hosting", items: ["Vitest", "PGlite (Postgres in tests)", "Playwright", "GitHub Actions", "Vercel and Vercel Cron"] },
    ],

    // Only ideas listed as backlog in the project's progress notes: proposed, not built.
    roadmap: [
      { title: "Sync-failure alert", text: "A banner when no sync has succeeded for two days, optionally an email." },
      { title: "Sign-in hardening", text: "Two-factor sign-in and a \"sign out everywhere\" button." },
      { title: "Install as a phone app", text: "So the Inbox opens full screen on a phone." },
      { title: "Re-entry analysis", text: "How re-entries into the same token perform; the token page is the first step." },
    ],
  };
})();
