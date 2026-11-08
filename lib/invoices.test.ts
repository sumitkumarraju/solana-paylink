import { address, generateKeyPairSigner, getProgramDerivedAddress } from "@solana/kit";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getSql } from "./db";
import {
  claimPaymentCheck,
  createInvoice,
  getInvoice,
  markInvoicePaid,
  normalizeAmount,
  validateInvoiceInput,
  ValidationError,
} from "./invoices";

async function wallet() {
  return (await generateKeyPairSigner()).address;
}

function fieldErrors(fn: () => unknown): Record<string, string> {
  try {
    fn();
  } catch (error) {
    if (error instanceof ValidationError) return error.fields;
    throw error;
  }
  return {};
}

describe("normalizeAmount", () => {
  it.each([
    ["12.500000", "12.5"],
    ["0012", "12"],
    ["1.000000", "1"],
    ["0.000001", "0.000001"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeAmount(input)).toBe(expected);
  });
});

describe("validateInvoiceInput", () => {
  it("accepts a valid invoice and normalises the amount", async () => {
    const recipient = await wallet();
    const result = validateInvoiceInput({
      recipient,
      amount: " 0100.50 ",
      clientName: " Acme ",
      description: "Work",
      dueDate: "2099-12-01",
    });
    expect(result).toEqual({ recipient, amount: "100.5", clientName: "Acme", description: "Work", dueDate: "2099-12-01" });
  });

  it("rejects every bad field at once", () => {
    const errors = fieldErrors(() =>
      validateInvoiceInput({ recipient: "nope", amount: "1.2345678", clientName: "", description: "", dueDate: "2026-02-30" }),
    );
    expect(Object.keys(errors).sort()).toEqual(["amount", "clientName", "description", "dueDate", "recipient"]);
  });

  it("rejects a due date in the past but accepts today", async () => {
    const recipient = await wallet();
    const base = { recipient, amount: "1", clientName: "a", description: "b" };
    expect(fieldErrors(() => validateInvoiceInput({ ...base, dueDate: "2020-01-01" }))).toEqual({
      dueDate: "Due date cannot be in the past.",
    });
    const today = new Date().toISOString().slice(0, 10);
    expect(validateInvoiceInput({ ...base, dueDate: today }).dueDate).toBe(today);
  });

  it.each(["0", "0.0", "-1", "1e3", "1,000", "1000000.000001", ""])("rejects amount %j", async (amount) => {
    const recipient = await wallet();
    expect(fieldErrors(() => validateInvoiceInput({ recipient, amount, clientName: "a", description: "b" }))).toHaveProperty("amount");
  });

  it("rejects a program-derived (off-curve) address", async () => {
    const [pda] = await getProgramDerivedAddress({
      programAddress: address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      seeds: ["paylink-test"],
    });
    const errors = fieldErrors(() => validateInvoiceInput({ recipient: pda, amount: "1", clientName: "a", description: "b" }));
    expect(errors).toHaveProperty("recipient");
  });
});

describe("invoice storage", () => {
  beforeEach(async () => {
    await getSql()`TRUNCATE invoices`;
  });
  afterAll(async () => {
    await getSql().end();
  });

  async function newInvoice() {
    return createInvoice(
      validateInvoiceInput({ recipient: await wallet(), amount: "25.10", clientName: "Acme", description: "Logo", dueDate: "2099-12-31" }),
    );
  }

  it("stores and reads back an invoice with exact types", async () => {
    const created = await newInvoice();
    expect(created).toMatchObject({ amount: "25.1", dueDate: "2099-12-31", status: "unpaid", cluster: "devnet", signature: null });
    expect(await getInvoice(created.id)).toEqual(created);
    expect(await getInvoice("missing")).toBeNull();
  });

  it("lets only one caller claim a check inside the interval", async () => {
    const { id } = await newInvoice();
    const claims = await Promise.all([1, 2, 3, 4, 5].map(() => claimPaymentCheck(id, 60_000)));
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(await claimPaymentCheck(id, 0)).toBe(true);
  });

  it("marks paid once and keeps the first signature", async () => {
    const { id } = await newInvoice();
    const first = await markInvoicePaid(id, "sig-one");
    const second = await markInvoicePaid(id, "sig-two");
    expect(first.status).toBe("paid");
    expect(second.signature).toBe("sig-one");
    expect(second.paidAt).toBe(first.paidAt);
    expect(await claimPaymentCheck(id, 0)).toBe(false);
  });

  it("refuses to use one transaction for two invoices", async () => {
    const a = await newInvoice();
    const b = await newInvoice();
    await markInvoicePaid(a.id, "same-sig");
    await expect(markInvoicePaid(b.id, "same-sig")).rejects.toThrow(/unique/i);
  });
});
