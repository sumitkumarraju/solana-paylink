-- Hosted Postgres such as Supabase exposes the public schema through a REST API
-- with a public key. Row-level security with no policies blocks that path.
-- The app connects as the table owner, which RLS does not restrict.
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
