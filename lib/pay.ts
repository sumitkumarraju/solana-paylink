import {
  address,
  createSolanaRpc,
  type GetAccountInfoApi,
  type GetSignaturesForAddressApi,
  type GetTransactionApi,
  type Rpc,
  type Signature,
} from "@solana/kit";
import { encodeURL, type TransferFields, validateTransfer, ValidateTransferError } from "@solana/pay";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { getConfig } from "./config";
import { claimPaymentCheck, type Invoice, markInvoicePaid } from "./invoices";

const MESSAGE_MAX = 120;
const SIGNATURES_TO_SCAN = 25;
const MIN_CHECK_INTERVAL_MS = 3_000;

// The exact transfer an invoice asks for. The payment link and the on-chain
// check both use this, so they can never disagree.
function transferFields(invoice: Invoice): TransferFields {
  return {
    recipient: address(invoice.recipient),
    // Validated on create: at most 6 decimals and 1,000,000, which a JS number
    // holds exactly enough for @solana/pay's toFixed formatting.
    amount: Number(invoice.amount),
    splToken: address(invoice.mint),
    reference: address(invoice.reference),
  };
}

// Builds the Solana Pay transfer request a wallet opens to pay this invoice.
export function paymentUrl(invoice: Invoice): string {
  const message =
    invoice.description.length > MESSAGE_MAX
      ? `${invoice.description.slice(0, MESSAGE_MAX - 1)}…`
      : invoice.description;

  return encodeURL({ ...transferFields(invoice), label: "PayLink", message }).toString();
}

let sharedRpc: ReturnType<typeof createSolanaRpc> | undefined;
function getRpc() {
  sharedRpc ??= createSolanaRpc(getConfig().rpcUrl);
  return sharedRpc;
}

// Looks on-chain for a transaction that carries this invoice's reference and
// pays the right amount of the right token to the right wallet. Anyone can
// add the reference to some other transaction, so every candidate is checked,
// oldest first, rather than trusting the first one found.
export async function findValidPayment(
  rpc: Rpc<GetSignaturesForAddressApi & GetTransactionApi>,
  invoice: Invoice,
): Promise<Signature | null> {
  const fields = transferFields(invoice);
  const signatures = await rpc
    .getSignaturesForAddress(address(invoice.reference), {
      commitment: "confirmed",
      limit: SIGNATURES_TO_SCAN,
    })
    .send();

  for (const info of [...signatures].reverse()) {
    if (info.err) continue;
    try {
      await validateTransfer(rpc, info.signature, fields, { commitment: "confirmed" });
      return info.signature;
    } catch (error) {
      if (error instanceof ValidateTransferError) continue;
      throw error;
    }
  }
  return null;
}

// Solana Pay wallets send tokens only to an existing token account; they do
// not create one for the recipient. A wallet that has never held USDC has no
// USDC account, so its invoices could never be paid. Returns true when the
// recipient's USDC account exists.
export async function recipientCanReceiveUsdc(
  rpc: Rpc<GetAccountInfoApi>,
  recipient: string,
  mint: string,
): Promise<boolean> {
  const [tokenAccount] = await findAssociatedTokenPda({
    owner: address(recipient),
    mint: address(mint),
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const { value } = await rpc.getAccountInfo(tokenAccount, { encoding: "base64", commitment: "confirmed" }).send();
  return value !== null && value.owner === TOKEN_PROGRAM_ADDRESS;
}

export function checkRecipientCanReceiveUsdc(recipient: string): Promise<boolean> {
  return recipientCanReceiveUsdc(getRpc(), recipient, getConfig().usdcMint);
}

// Returns the invoice, marking it paid first if a valid payment is on-chain.
// At most one check per invoice runs every few seconds, however many pay pages
// or server instances ask, so polling cannot flood the RPC provider.
export async function refreshPaymentStatus(invoice: Invoice): Promise<Invoice> {
  if (invoice.status !== "unpaid") return invoice;
  if (!(await claimPaymentCheck(invoice.id, MIN_CHECK_INTERVAL_MS))) return invoice;

  const signature = await findValidPayment(getRpc(), invoice);
  return signature ? await markInvoicePaid(invoice.id, signature) : invoice;
}
