# Migration history

Until now the schema evolved with `prisma db push`, which leaves **no history**: there was
no way to reproduce a database from scratch, no review of what a deploy would do to
production, and no drift detection. `0_init` is the baseline that fixes that.

## Provider: these migrations are POSTGRES

Local development runs SQLite (`prisma/schema.prisma` has `provider = "sqlite"`, flipped by
`scripts/use-db.mjs`). Migration SQL is **provider-specific**, and migration history only
matters for the deployed database, so this directory is generated against **PostgreSQL**.

Consequence, stated plainly: **do not run `prisma migrate` against your local SQLite DB.**
Local stays on `npm run db:push`. Migrations are for staging/production Postgres.

## Adopting the baseline on an EXISTING database (production/staging)

The tables already exist, so the baseline must be recorded as applied — **never re-run**,
which would fail on existing tables or, worse, be "fixed" with a reset that destroys data.

```bash
# 1. Point DATABASE_URL at the target and switch the schema provider
export DATABASE_URL="postgresql://..."
node scripts/use-db.mjs postgres

# 2. Verify the baseline matches what is actually deployed (expect: no difference)
npm run db:drift

# 3. Record the baseline as already applied — this only writes _prisma_migrations
npx prisma migrate resolve --applied 0_init

# 4. Confirm
npx prisma migrate status
```

## A fresh database

```bash
export DATABASE_URL="postgresql://..."
node scripts/use-db.mjs postgres
npx prisma migrate deploy      # runs 0_init and every later migration in order
```

## Adding a migration from here on

```bash
node scripts/use-db.mjs postgres      # against a scratch/staging Postgres, never prod
npx prisma migrate dev --name add_something
node scripts/use-db.mjs sqlite        # back to local dev before committing
```

Commit the generated folder. Review the SQL before it reaches production — in particular
any `DROP`, `NOT NULL` added to a populated column, or a type change, each of which needs a
backfill step rather than a bare column alteration.

## Deploying

`npx prisma migrate deploy` is the only command that should touch production. It is
forward-only and never resets.

**Never run `prisma migrate reset` against a production URL** — it drops every table.

## Drift detection

`npm run db:drift` diffs the live database against the schema and prints the SQL that would
be required to reconcile them. Empty output means no drift. Run it before every deploy and
in CI; non-empty output on production means something changed outside migration history and
must be reconciled deliberately.

## Rollback

Prisma has no automatic down-migrations. To roll back, write a new forward migration that
reverses the change, and restore from backup for destructive changes. Take a backup before
any migration that drops or rewrites data.
