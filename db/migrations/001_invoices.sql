CREATE TABLE invoices (
  id           text PRIMARY KEY,
  recipient    text NOT NULL,
  amount       numeric(16, 6) NOT NULL CHECK (amount > 0 AND amount <= 1000000),
  mint         text NOT NULL,
  cluster      text NOT NULL CHECK (cluster IN ('devnet', 'mainnet-beta')),
  reference    text NOT NULL UNIQUE,
  client_name  text NOT NULL CHECK (char_length(client_name) BETWEEN 1 AND 100),
  description  text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 500),
  due_date     date,
  status       text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'expired')),
  -- One on-chain transaction can settle at most one invoice.
  signature    text UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  paid_at      timestamptz,
  -- Last time a request claimed an on-chain check; spaces out RPC calls across server instances.
  checked_at   timestamptz,
  CHECK ((status = 'paid') = (signature IS NOT NULL AND paid_at IS NOT NULL))
);

CREATE INDEX invoices_recipient_created ON invoices (recipient, created_at DESC);
