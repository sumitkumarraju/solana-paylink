import { randomBytes } from "node:crypto";
import { generateKeyPairSigner, isAddress, isOffCurveAddress } from "@solana/kit";
import { getConfig } from "./config";
import { getSql } from "./db";

export type InvoiceStatus = "unpaid" | "paid" | "expired";

export type Invoice = {
  id: string;
  recipient: string;
  amount: string; // decimal USDC, kept as a string so no float rounding
  mint: string;
  cluster: string;
  reference: string;
  clientName: string;
  description: string;
  dueDate: string | null;
  status: InvoiceStatus;
  signature: string | null;
  createdAt: string;
  paidAt: string | null;
};

export type NewInvoiceInput = {
  recipient: unknown;
  amount: unknown;
  clientName: unknown;
  description: unknown;
  dueDate?: unknown;
};

export class ValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super("Invalid invoice");
  }
}

const MAX_AMOUNT = 1_000_000; // USDC
const USDC_DECIMALS = 6;
const AMOUNT_PATTERN = new RegExp(`^\\d+(\\.\\d{1,${USDC_DECIMALS}})?$`);

// A wallet address is on the ed25519 curve; program-derived addresses are not
// and cannot receive a normal wallet payment.
function isWalletAddress(value: string): boolean {
  return isAddress(value) && !isOffCurveAddress(value);
}

// "0012.500000" -> "12.5". Assumes the string already matches AMOUNT_PATTERN.
export function normalizeAmount(amount: string): string {
  const [whole, fraction = ""] = amount.split(".");
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed ? `${BigInt(whole)}.${trimmed}` : `${BigInt(whole)}`;
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// The server does not know the freelancer's time zone. The earliest "today"
// on Earth (UTC-12) is at most one day behind the UTC date, so accept that.
function earliestTodayAnywhere(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function validateInvoiceInput(input: NewInvoiceInput) {
  const errors: Record<string, string> = {};

  const recipient = typeof input.recipient === "string" ? input.recipient.trim() : "";
  if (!isWalletAddress(recipient)) {
    errors.recipient = "Enter a valid Solana wallet address.";
  }

  const rawAmount = typeof input.amount === "string" ? input.amount.trim() : "";
  let amount = "";
  if (!AMOUNT_PATTERN.test(rawAmount) || Number(rawAmount) <= 0) {
    errors.amount = `Enter an amount above 0 with at most ${USDC_DECIMALS} decimals.`;
  } else if (Number(rawAmount) > MAX_AMOUNT) {
    errors.amount = `Amount must be ${MAX_AMOUNT.toLocaleString("en-US")} USDC or less.`;
  } else {
    amount = normalizeAmount(rawAmount);
  }

  const clientName = typeof input.clientName === "string" ? input.clientName.trim() : "";
  if (clientName.length < 1 || clientName.length > 100) {
    errors.clientName = "Client name must be 1 to 100 characters.";
  }

  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (description.length < 1 || description.length > 500) {
    errors.description = "Description must be 1 to 500 characters.";
  }

  let dueDate: string | null = null;
  if (input.dueDate !== undefined && input.dueDate !== null && input.dueDate !== "") {
    const raw = typeof input.dueDate === "string" ? input.dueDate : "";
    if (!isCalendarDate(raw)) {
      errors.dueDate = "Due date must be a real date (YYYY-MM-DD).";
    } else if (raw < earliestTodayAnywhere()) {
      errors.dueDate = "Due date cannot be in the past.";
    } else {
      dueDate = raw;
    }
  }

  if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  return { recipient, amount, clientName, description, dueDate };
}

type InvoiceRow = {
  id: string;
  recipient: string;
  amount: string;
  mint: string;
  cluster: string;
  reference: string;
  client_name: string;
  description: string;
  due_date: string | null;
  status: InvoiceStatus;
  signature: string | null;
  created_at: Date;
  paid_at: Date | null;
};

function fromRow(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    recipient: row.recipient,
    amount: normalizeAmount(row.amount),
    mint: row.mint,
    cluster: row.cluster,
    reference: row.reference,
    clientName: row.client_name,
    description: row.description,
    dueDate: row.due_date,
    status: row.status,
    signature: row.signature,
    createdAt: row.created_at.toISOString(),
    paidAt: row.paid_at ? row.paid_at.toISOString() : null,
  };
}

// Every read goes through these columns so types are the same everywhere:
// numeric and date come back as text, timestamps as Date.
function selectInvoices(sql: ReturnType<typeof getSql>) {
  return sql`
    SELECT id, recipient, amount::text AS amount, mint, cluster, reference, client_name,
           description, to_char(due_date, 'YYYY-MM-DD') AS due_date, status, signature,
           created_at, paid_at
    FROM invoices`;
}

export type InvoiceFields = ReturnType<typeof validateInvoiceInput>;

// Takes fields that already passed validateInvoiceInput.
export async function createInvoice(fields: InvoiceFields): Promise<Invoice> {
  const { cluster, usdcMint } = getConfig();
  // A fresh address that only this invoice's payment will include, so the
  // payment can be found on-chain without trusting the payer.
  const reference = (await generateKeyPairSigner()).address;
  const id = randomBytes(9).toString("base64url");

  const sql = getSql();
  const [row] = await sql<InvoiceRow[]>`
    INSERT INTO invoices (id, recipient, amount, mint, cluster, reference, client_name, description, due_date)
    VALUES (${id}, ${fields.recipient}, ${fields.amount}, ${usdcMint}, ${cluster}, ${reference},
            ${fields.clientName}, ${fields.description}, ${fields.dueDate})
    RETURNING id, recipient, amount::text AS amount, mint, cluster, reference, client_name,
              description, to_char(due_date, 'YYYY-MM-DD') AS due_date, status, signature,
              created_at, paid_at`;
  return fromRow(row);
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const sql = getSql();
  const [row] = await sql<InvoiceRow[]>`${selectInvoices(sql)} WHERE id = ${id}`;
  return row ? fromRow(row) : null;
}

// Claims the right to run an on-chain check for this invoice. Returns false if
// the invoice is no longer unpaid or another request checked it within
// minIntervalMs. The claim lives in the database, so it holds across server
// instances.
export async function claimPaymentCheck(id: string, minIntervalMs: number): Promise<boolean> {
  const sql = getSql();
  const result = await sql`
    UPDATE invoices SET checked_at = now()
    WHERE id = ${id} AND status = 'unpaid'
      AND (checked_at IS NULL OR checked_at <= now() - ${minIntervalMs} * interval '1 millisecond')`;
  return result.count === 1;
}

// Only an unpaid invoice changes, so two checks finding the same payment at
// once cannot overwrite the first signature or paid time.
export async function markInvoicePaid(id: string, signature: string): Promise<Invoice> {
  const sql = getSql();
  await sql`
    UPDATE invoices SET status = 'paid', signature = ${signature}, paid_at = now()
    WHERE id = ${id} AND status = 'unpaid'`;
  const invoice = await getInvoice(id);
  if (!invoice) throw new Error(`Invoice ${id} disappeared while being marked paid`);
  return invoice;
}

export async function listInvoicesForRecipient(recipient: string): Promise<Invoice[]> {
  const sql = getSql();
  const rows = await sql<InvoiceRow[]>`${selectInvoices(sql)} WHERE recipient = ${recipient} ORDER BY created_at DESC`;
  return rows.map(fromRow);
}
