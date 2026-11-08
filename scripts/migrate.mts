// Applies db/migrations/*.sql in name order, each once, each in its own
// transaction. Run with: DATABASE_URL=... node scripts/migrate.mts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const dir = join(import.meta.dirname, "..", "db", "migrations");
const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;
  const applied = new Set((await sql<{ name: string }[]>`SELECT name FROM schema_migrations`).map((r) => r.name));

  for (const name of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (applied.has(name)) continue;
    await sql.begin(async (tx) => {
      // Serialises concurrent deploys running migrations at the same time.
      await tx`SELECT pg_advisory_xact_lock(727274)`;
      const [done] = await tx`SELECT 1 FROM schema_migrations WHERE name = ${name}`;
      if (done) return;
      await tx.unsafe(readFileSync(join(dir, name), "utf8"));
      await tx`INSERT INTO schema_migrations (name) VALUES (${name})`;
    });
    console.log(`applied ${name}`);
  }
  console.log("migrations up to date");
} finally {
  await sql.end();
}
