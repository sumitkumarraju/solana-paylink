# PayLink: project plan

Stablecoin payment links for freelancers and small businesses in India, built on Solana.

Target grant: Solana Foundation India Grants via Superteam Earn (up to $10,000 USDG; applications currently paused). The plan is shaped to its stated heuristics: working product over pitch deck, proof of work, real user feedback, focus on Payments/Stablecoins.

## 1. Problem

Indian freelancers paid by foreign clients lose money and time:
- Wire transfers and platform payouts take days and charge fees on both ends.
- Payment platforms (Upwork, Contra, PayPal) take a cut and can hold funds or reject identity checks.
- Clients abroad want a simple "pay this invoice" link, not bank details.

Solana USDC settles in seconds for a fraction of a cent, but there is no simple invoice flow that a non-crypto client can use and that a freelancer can track.

## 2. Who it is for

- **Primary:** freelancers and agencies in India billing foreign clients (developers, designers, writers).
- **Secondary:** small Indian businesses selling to international customers.
- **Payer:** a client anywhere with a Solana wallet (Phantom, Solflare, Backpack) or a Solana Pay-compatible app.

## 3. MVP scope (what ships first)

Must have:
1. **Create invoice:** amount in USDC, client name, description, due date, recipient wallet.
2. **Shareable pay page:** `/i/{id}` with invoice details, a Solana Pay QR code and a "Pay with wallet" link.
3. **On-chain verification:** each invoice has a unique Solana Pay `reference` key; the server finds and validates the transfer (correct recipient, mint, amount).
4. **Status tracking:** unpaid, paid (with transaction signature and Solana Explorer link), expired.
5. **Freelancer dashboard:** list invoices, filter by status, copy link.
6. **Devnet and mainnet modes** via environment config (devnet USDC for testing).

Not in the MVP (later milestones):
- INR off-ramp (convert USDC to INR into a bank account) through a licensed partner.
- Accounts and login (MVP uses a wallet-signed message to prove invoice ownership).
- Recurring invoices, partial payments, multi-token support.
- Mobile app (Solana Seeker / Saga) and push notifications.

## 4. How it works

1. Freelancer creates an invoice. The server generates a fresh `reference` public key and stores the invoice.
2. The pay page builds a Solana Pay transfer request: `solana:{recipient}?amount={amount}&spl-token={USDC mint}&reference={reference}&label=PayLink&message={invoice}`.
3. The client scans the QR or taps the link and approves the transfer in their wallet.
4. The pay page polls a status endpoint. The server uses `findReference` and `validateTransfer` from `@solana/pay` to confirm the exact transfer, then marks the invoice paid and stores the signature.
5. Both sides see "Paid" with a link to the transaction on Solana Explorer.

## 5. Tech stack

- **App:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui.
- **Solana:** `@solana/web3.js`, `@solana/pay`, `@solana/spl-token`; wallet adapter for the dashboard sign-in.
- **QR codes:** `qrcode`.
- **Storage:** Postgres from day one (local Postgres in development, a hosted pooled Postgres in production), with SQL migrations in `db/migrations`.
- **RPC:** a public devnet RPC for testing; a paid RPC provider for mainnet.
- **Hosting:** Vercel.
- **Tests:** Playwright end-to-end tests for create, pay (devnet) and verify.

## 6. Milestones

| Week | Milestone | Done when |
|---|---|---|
| 1 | Scaffold, invoice model, create API | An invoice can be created and stored (done) |
| 2 | Pay page with Solana Pay QR and link | A devnet wallet can open the request (built; wallet scan still to test on a phone) |
| 3 | On-chain verification and status | A devnet USDC payment flips the invoice to Paid (built and unit-tested against real signed transactions; live devnet payment not yet run) |
| 4 | Dashboard and wallet-signed ownership | A freelancer sees only their own invoices |
| 5 | Deploy to production: hosted Postgres, dedicated RPC, mainnet | Live link takes a real mainnet USDC payment end to end |
| 6 | 10 real freelancers try it; collect feedback | Written feedback from at least 10 users |
| 7-8 | Mainnet launch with small real payments | First real invoices paid on mainnet |
| 9-12 | Off-ramp research and partner talks, mobile prototype | Off-ramp option chosen; mobile prototype |

## 7. How success is measured

- Number of invoices created and paid (devnet, then mainnet).
- Total USDC volume settled.
- Number of active freelancers and repeat use.
- Median time from invoice creation to payment.
- Feedback from users (what stops them using it).

## 8. Grant fit (Solana Foundation India)

- **Theme:** Payments/Stablecoins, the grant's named focus on stablecoin rails for fintech and money flowing in and out of India.
- **Working product:** a live devnet demo before applying, then mainnet.
- **Proof of work to cite (from CV):** Stealf (Solana privacy layer with Arcium), Superteam ecosystem work, six Adobe Express Marketplace add-ons, Adobe Fund for Design recipient, Lead Developer on a government project.
- **User insight:** the builder is the target user, a freelancer in India paid in USD.

## 9. Use of funds (fill in real numbers before applying)

| Item | Amount |
|---|---|
| Development time for 3 months | [your number] |
| Paid RPC and hosting | [your number] |
| Security review of payment verification | [your number] |
| User testing incentives (small USDC rewards) | [your number] |
| Off-ramp partner and legal research | [your number] |

## 10. Risks and how to handle them

- **Regulation:** crypto income and off-ramps in India carry tax and compliance rules. MVP only moves USDC between wallets; off-ramp waits for a licensed partner and legal advice.
- **Payer friction:** foreign clients may not have a wallet. Mitigation: clear wallet setup guide on the pay page; later, card-to-USDC on-ramp options.
- **Wrong payments:** a client sends the wrong amount or token. Mitigation: strict `validateTransfer` checks and a clear "underpaid" state.
- **Key safety:** the app never holds private keys; payments go straight to the freelancer's wallet.
- **Recipient without a USDC account:** Solana Pay wallets do not create the recipient's token account, so such invoices could never be paid. Mitigation: invoice creation checks the account exists and explains how to fix it.
- **Open invoice creation:** until wallet sign-in (week 4) anyone can create invoices. Mitigation before mainnet launch: wallet-signed creation and per-IP rate limiting.

## 11. Loom pitch outline (2-3 minutes)

1. Who I am and why I build this (I am the user).
2. The problem in one example: a $500 invoice from a US client, and what it costs today.
3. Live demo: create invoice, scan QR on devnet, watch it flip to Paid.
4. What the grant pays for and the milestones.
5. Proof of work: Stealf, Superteam, Adobe Marketplace add-ons.

## 12. Open questions for you

- Confirm the name "PayLink" or choose another.
- Your real numbers for the use of funds.
- Whether you want an off-ramp in scope at all, given tax and compliance.
- 10 freelancer contacts for week 6 feedback.
