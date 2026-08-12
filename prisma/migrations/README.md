# Migration history

`0_init` is the complete baseline: **202 tables, 346 indexes, 175 foreign keys**, generated
from `prisma/schema.prisma`.

## The rule that keeps this trustworthy

The schema used to evolve with `prisma db push` while the committed migration stayed
frozen. It silently fell **12 models behind**, so `prisma migrate deploy` against a fresh
database would have built the wrong schema and nothing would have complained until runtime.

That can no longer happen: **`npm run test:all` runs `db:check` first**, which fails the
whole suite if the committed migration does not match the schema exactly.

```bash
npm run db:check              # freshness + round-trip. Runs automatically in test:all.
npm run db:migrations:build   # regenerate after ANY schema change
npm run db:audit              # indexes + orphan risk (also in test:all)
npm run db:audit:fix          # add missing indexes
npm run db:drift              # compare a LIVE database to the schema
```

**Workflow after changing `schema.prisma`:**

```bash
npx prisma db push            # local sqlite
npm run db:migrations:build   # regenerate the migration  <-- do not skip
npm run test:all              # db:check will fail if you did skip it
```

## Provider: these migrations are POSTGRES

Local development runs SQLite; `scripts/use-db.mjs` flips the provider. Migration SQL is
provider-specific and only matters for the deployed database, so this directory is always
generated for **PostgreSQL** regardless of what the local schema is currently set to.

`db:migrations:build` handles that for you — it never edits `schema.prisma`.

**Do not run `prisma migrate` against local SQLite.** Local stays on `db push`.

`db:check` validates in two independent ways, neither needing a database server:
1. **Freshness** — regenerates the DDL and compares it to what is committed.
2. **Round-trip** — builds a throwaway SQLite migration, applies it to a shadow file, and
   diffs the result back at the schema. An empty diff proves the migrations actually
   reproduce the model graph. (SQLite is used because its shadow database is just a file.
   The Postgres DDL cannot be executed here without a server; it is generated from the same
   validated datamodel.)

## Deploying to an EXISTING database (production/staging)

The tables already exist, so the baseline must be recorded as applied — **never re-run**,
and never "fixed" with a reset, which destroys data.

```bash
export DATABASE_URL="postgresql://..."
node scripts/use-db.mjs postgres

npm run db:drift                              # expect: no difference
npx prisma migrate resolve --applied 0_init   # writes _prisma_migrations only
npx prisma migrate status
```

## A fresh database

```bash
export DATABASE_URL="postgresql://..."
node scripts/use-db.mjs postgres
npx prisma migrate deploy
```

## Adding a migration later

Once `0_init` is applied somewhere real, do **not** regenerate it — that would rewrite
history. Create an incremental migration instead:

```bash
node scripts/use-db.mjs postgres     # against a scratch/staging DB, never prod
npx prisma migrate dev --name add_something
node scripts/use-db.mjs sqlite       # back to local dev before committing
```

Review the SQL before it reaches production, especially any `DROP`, a `NOT NULL` added to a
populated column, or a type change — each needs a backfill step, not a bare alteration.

## Deletion policy (right to erasure)

22 models carry a `onDelete: Cascade` foreign key to `User`, so deleting a user erases their
personal data — assessments, career profile, coach transcript, consent records, saved jobs,
preferences, OTP challenges and quota counters. `scripts/test-db-integrity.mjs` proves this
against a real database.

Two deliberate exceptions:

- **`AnalyticsEvent` uses `SetNull`.** Deleting telemetry would corrupt historical metrics,
  so the anonymous event survives and only the personal link is severed.
- **`Employee`, `CouponRedemption`, `PlacementRequest` retain rows.** Employment, financial
  and placement records carry statutory retention obligations; cascade-deleting payroll
  history would be worse than keeping it. Erasure for these is a documented
  anonymisation process, not an automatic cascade. Recorded in the `db:audit` allowlist.

## Rollback

Prisma has no automatic down-migrations. Roll back with a new forward migration that
reverses the change, and restore from backup for anything destructive. Take a backup before
any migration that drops or rewrites data.

**Never run `prisma migrate reset` against production** — it drops every table.
