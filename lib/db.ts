// Database portability helpers.
//
// SQLite's LIKE is case-insensitive for ASCII; Postgres's LIKE is case-SENSITIVE.
// Prisma exposes `mode: "insensitive"` for Postgres but the option doesn't exist
// on the SQLite client, so we add it only when actually running on Postgres.
// Returning `any` keeps this valid whether the client was generated for SQLite
// (dev) or Postgres (prod) — the `mode` key is simply absent on SQLite at runtime.

export const IS_POSTGRES = (process.env.DATABASE_URL || "").startsWith("postgres")

// Case-insensitive `contains` filter that works on both providers.
export function ci(term: string): any {
  return IS_POSTGRES ? { contains: term, mode: "insensitive" } : { contains: term }
}
