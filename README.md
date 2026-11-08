# PayLink

Stablecoin invoices on Solana. A freelancer creates an invoice, sends the link,
and the client pays in USDC with any Solana Pay wallet. The server confirms the
payment on-chain and marks the invoice paid.

See [PLAN.md](PLAN.md) for the roadmap.

## How a payment is confirmed

1. Each invoice gets a fresh random **reference** address.
2. The pay page (`/i/{id}`) shows a Solana Pay transfer request with that
   reference, as a QR code and an "Open in wallet" link.
3. The page polls `GET /api/invoices/{id}/status`. The server lists
   transactions that mention the reference and checks each one with
   `validateTransfer` from `@solana/pay`: right recipient, right token, full
   amount, not failed. The first valid one marks the invoice paid.
4. Checks are claimed in the database (`checked_at`), so at most one RPC check
   per invoice runs every 3 seconds across all server instances.

Invoices can only be created for wallets that already have a USDC token
account, because Solana Pay wallets do not create one for the recipient.

## Requirements

- Node.js 24 or later
- PostgreSQL 14 or later

## Development

```bash
cp .env.example .env.local
createdb paylink
createdb paylink_test
npm install
DATABASE_URL=postgres://localhost:5432/paylink npm run db:migrate
DATABASE_URL=postgres://localhost:5432/paylink_test npm run db:migrate
npm run dev
```

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Tests use the `paylink_test` database (override with `TEST_DATABASE_URL`). The
payment-check tests run against real signed Solana transactions with a fake RPC.

## Production

Set `SOLANA_CLUSTER`, `DATABASE_URL` and, for mainnet, `SOLANA_RPC_URL` (see
[.env.example](.env.example)). Run `npm run db:migrate` against the production
database before each deploy that adds a migration.
