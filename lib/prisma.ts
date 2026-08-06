import { PrismaClient } from "@prisma/client"

// On Vercel serverless + the Supabase pooler, a cold start (or a pooler recycling
// a connection) can make a query fail to even reach the database — surfacing as a
// random 500 ("Something went wrong") on register, an empty jobs list, etc. These
// errors happen BEFORE the query runs, so retrying them briefly is safe (no risk of
// double-writes) and turns a flaky cold start into a normal request.
//
// We deliberately retry ONLY connection-establishment/pool-exhaustion failures — never a
// mid-query error that might have partially applied. "max clients reached in session
// mode" (Supabase session pooler at :5432, cap 15) is transient: connections free up
// within a moment, so a short backoff lets sign-in succeed instead of hard-failing.
const RETRIABLE = /P1001|P1002|P2024|can't reach database|timed out fetching a new connection|connection pool|ECONNREFUSED|EMAXCONNSESSION|max clients reached|MaxClientsInSessionMode/i
const isTransient = (e: any) => RETRIABLE.test(`${e?.code ?? ""} ${e?.message ?? ""}`)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Cap each serverless instance to a SINGLE pooled connection so a burst of lambdas can't
// exhaust the pool (critical on the session pooler's 15-client cap). Prisma reads these
// as query params on the datasource URL. The definitive fix remains pointing DATABASE_URL
// at the Supabase TRANSACTION pooler (:6543 + pgbouncer=true), which supports far more
// concurrent clients — this only softens the failure until then.
function datasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL
  if (!raw || !/^postgres/i.test(raw)) return undefined // sqlite/local: leave untouched
  try {
    const u = new URL(raw)
    if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "1")
    if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "20")
    // Supabase transaction pooler (:6543) requires pgbouncer mode; declare it if present.
    if (u.port === "6543" && !u.searchParams.has("pgbouncer")) u.searchParams.set("pgbouncer", "true")
    return u.toString()
  } catch { return raw }
}

function makeClient() {
  const url = datasourceUrl()
  return new PrismaClient({ log: ["error"], ...(url ? { datasources: { db: { url } } } : {}) }).$extends({
    query: {
      async $allOperations({ args, query }) {
        let lastErr: any
        for (let attempt = 0; attempt < 5; attempt++) {
          try { return await query(args) }
          catch (e) {
            lastErr = e
            if (!isTransient(e)) throw e
            await sleep(150 * 2 ** attempt) // 150 → 300 → 600 → 1200 → 2400ms
          }
        }
        throw lastErr
      },
    },
  })
}

// Reuse one client per instance (in prod too) so warm invocations never open extra pools.
const globalForPrisma = globalThis as unknown as { prisma: ReturnType<typeof makeClient> }
export const prisma = globalForPrisma.prisma ?? makeClient()
globalForPrisma.prisma = prisma
