import postgres from "postgres";
import { getConfig } from "./config";

// One pool per server process. Kept on globalThis so dev hot reloads reuse it
// instead of opening a new pool on every edit.
const globalForDb = globalThis as unknown as { paylinkSql?: postgres.Sql };

export function getSql(): postgres.Sql {
  globalForDb.paylinkSql ??= postgres(getConfig().databaseUrl, {
    max: 5,
    idle_timeout: 20,
    // Transaction-mode poolers (Supabase, Neon, PgBouncer) do not support
    // named prepared statements.
    prepare: false,
  });
  return globalForDb.paylinkSql;
}
