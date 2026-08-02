import { PrismaClient } from "@prisma/client"

// On Vercel serverless + the Supabase pooler, a cold start (or a pooler recycling
// a connection) can make a query fail to even reach the database — surfacing as a
// random 500 ("Something went wrong") on register, an empty jobs list, etc. These
// errors happen BEFORE the query runs, so retrying them briefly is safe (no risk of
// double-writes) and turns a flaky cold start into a normal request.
//
// We deliberately retry ONLY connection-establishment failures — never a mid-query
// error that might have partially applied.
const RETRIABLE = /P1001|P1002|P2024|can't reach database|timed out fetching a new connection|connection pool|ECONNREFUSED/i
const isTransient = (e: any) => RETRIABLE.test(`${e?.code ?? ""} ${e?.message ?? ""}`)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function makeClient() {
  return new PrismaClient({ log: ["error"] }).$extends({
    query: {
      async $allOperations({ args, query }) {
        let lastErr: any
        for (let attempt = 0; attempt < 4; attempt++) {
          try { return await query(args) }
          catch (e) {
            lastErr = e
            if (!isTransient(e)) throw e
            await sleep(120 * 2 ** attempt) // 120 → 240 → 480ms
          }
        }
        throw lastErr
      },
    },
  })
}

const globalForPrisma = globalThis as unknown as { prisma: ReturnType<typeof makeClient> }
export const prisma = globalForPrisma.prisma ?? makeClient()
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
