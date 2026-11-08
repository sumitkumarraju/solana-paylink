// Tests the on-chain payment check against real, signed Solana transactions
// built in memory. Only the RPC is faked: it serves those transactions and
// their token balance changes the way a node would.
import {
  AccountRole,
  appendTransactionMessageInstructions,
  type Address,
  type Blockhash,
  createTransactionMessage,
  generateKeyPairSigner,
  getBase64EncodedWireTransaction,
  getCompiledTransactionMessageCodec,
  getSignatureFromTransaction,
  type Instruction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type TransactionSigner,
} from "@solana/kit";
import { findAssociatedTokenPda, getTransferCheckedInstruction, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { describe, expect, it } from "vitest";
import type { Invoice } from "./invoices";
import { findValidPayment, paymentUrl, recipientCanReceiveUsdc } from "./pay";

type FakeTx = { signature: string; err: unknown; response: unknown };

const BLOCKHASH = "EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N" as Blockhash;

async function ata(owner: Address, mint: Address) {
  const [pda] = await findAssociatedTokenPda({ owner, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  return pda;
}

// A USDC-style transfer as a wallet builds it from a Solana Pay link: one
// TransferChecked instruction with the reference appended as a read-only key.
async function buildTransfer(opts: {
  payer: TransactionSigner;
  recipient: Address;
  mint: Address;
  reference: Address | null;
  baseUnits: bigint;
  err?: unknown;
}): Promise<FakeTx> {
  const source = await ata(opts.payer.address, opts.mint);
  const destination = await ata(opts.recipient, opts.mint);
  const transfer = getTransferCheckedInstruction({
    source,
    mint: opts.mint,
    destination,
    authority: opts.payer,
    amount: opts.baseUnits,
    decimals: 6,
  });
  const instruction: Instruction = opts.reference
    ? { ...transfer, accounts: [...transfer.accounts, { address: opts.reference, role: AccountRole.READONLY }] }
    : transfer;

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(opts.payer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash({ blockhash: BLOCKHASH, lastValidBlockHeight: 1n }, m),
    (m) => appendTransactionMessageInstructions([instruction], m),
  );
  const signed = await signTransactionMessageWithSigners(message);
  const { staticAccounts } = getCompiledTransactionMessageCodec().decode(signed.messageBytes);
  const accountIndex = staticAccounts.indexOf(destination);
  const balance = (amount: bigint) => ({
    accountIndex,
    mint: opts.mint,
    uiTokenAmount: { amount: amount.toString(), decimals: 6, uiAmount: null, uiAmountString: "" },
  });

  return {
    signature: getSignatureFromTransaction(signed),
    err: opts.err ?? null,
    response: {
      slot: 1n,
      blockTime: null,
      version: 0,
      meta: {
        err: opts.err ?? null,
        fee: 5000n,
        preBalances: [],
        postBalances: [],
        preTokenBalances: [balance(1_000_000n)],
        postTokenBalances: [balance(1_000_000n + opts.baseUnits)],
        logMessages: [],
        rewards: [],
        status: opts.err ? { Err: opts.err } : { Ok: null },
      },
      transaction: [getBase64EncodedWireTransaction(signed), "base64"],
    },
  };
}

// Newest first, as getSignaturesForAddress returns them.
function fakeRpc(newestFirst: FakeTx[]) {
  const send = <T>(value: T) => ({ send: async () => value });
  return {
    getSignaturesForAddress: () =>
      send(newestFirst.map((t) => ({ signature: t.signature, err: t.err, slot: 1n, memo: null, blockTime: null, confirmationStatus: "confirmed" }))),
    getTransaction: (signature: string) => send(newestFirst.find((t) => t.signature === signature)?.response ?? null),
  } as unknown as Parameters<typeof findValidPayment>[0];
}

async function setup(amount = "12.345678") {
  const payer = await generateKeyPairSigner();
  const recipient = (await generateKeyPairSigner()).address;
  const mint = (await generateKeyPairSigner()).address;
  const reference = (await generateKeyPairSigner()).address;
  const invoice: Invoice = {
    id: "inv1",
    recipient,
    amount,
    mint,
    cluster: "devnet",
    reference,
    clientName: "Acme",
    description: "Logo",
    dueDate: null,
    status: "unpaid",
    signature: null,
    createdAt: new Date().toISOString(),
    paidAt: null,
  };
  return { payer, recipient, mint, reference, invoice };
}

describe("findValidPayment", () => {
  it("accepts an exact payment", async () => {
    const s = await setup();
    const tx = await buildTransfer({ ...s, baseUnits: 12_345_678n });
    expect(await findValidPayment(fakeRpc([tx]), s.invoice)).toBe(tx.signature);
  });

  it("accepts an overpayment", async () => {
    const s = await setup();
    const tx = await buildTransfer({ ...s, baseUnits: 13_000_000n });
    expect(await findValidPayment(fakeRpc([tx]), s.invoice)).toBe(tx.signature);
  });

  it("rejects a payment one base unit short", async () => {
    const s = await setup();
    const tx = await buildTransfer({ ...s, baseUnits: 12_345_677n });
    expect(await findValidPayment(fakeRpc([tx]), s.invoice)).toBeNull();
  });

  it("rejects a different token", async () => {
    const s = await setup();
    const otherMint = (await generateKeyPairSigner()).address;
    const tx = await buildTransfer({ ...s, mint: otherMint, baseUnits: 12_345_678n });
    expect(await findValidPayment(fakeRpc([tx]), s.invoice)).toBeNull();
  });

  it("rejects a payment to a different wallet that carries the reference", async () => {
    const s = await setup();
    const attacker = (await generateKeyPairSigner()).address;
    const tx = await buildTransfer({ ...s, recipient: attacker, baseUnits: 12_345_678n });
    expect(await findValidPayment(fakeRpc([tx]), s.invoice)).toBeNull();
  });

  it("skips failed transactions", async () => {
    const s = await setup();
    const failed = await buildTransfer({ ...s, baseUnits: 12_345_678n, err: { InstructionError: [0, "Custom"] } });
    expect(await findValidPayment(fakeRpc([failed]), s.invoice)).toBeNull();
  });

  it("finds the real payment after junk transactions that mention the reference", async () => {
    const s = await setup();
    const junkShort = await buildTransfer({ ...s, baseUnits: 1n });
    const junkFailed = await buildTransfer({ ...s, baseUnits: 12_345_678n, err: { InstructionError: [0, "Custom"] } });
    const real = await buildTransfer({ ...s, baseUnits: 12_345_678n });
    // Oldest junk first, real payment newest.
    expect(await findValidPayment(fakeRpc([real, junkFailed, junkShort]), s.invoice)).toBe(real.signature);
  });

  it("returns null when nothing references the invoice", async () => {
    const s = await setup();
    expect(await findValidPayment(fakeRpc([]), s.invoice)).toBeNull();
  });
});

describe("paymentUrl", () => {
  it("encodes the exact transfer the checker expects", async () => {
    const s = await setup("1250.5");
    const url = new URL(paymentUrl(s.invoice));
    expect(url.protocol).toBe("solana:");
    expect(url.pathname).toBe(s.recipient);
    expect(url.searchParams.get("amount")).toBe("1250.5");
    expect(url.searchParams.get("spl-token")).toBe(s.mint);
    expect(url.searchParams.get("reference")).toBe(s.reference);
    expect(url.searchParams.get("label")).toBe("PayLink");
  });
});

describe("recipientCanReceiveUsdc", () => {
  function accountRpc(owner: string | null) {
    return {
      getAccountInfo: () => ({ send: async () => ({ value: owner === null ? null : { owner } }) }),
    } as unknown as Parameters<typeof recipientCanReceiveUsdc>[0];
  }

  it("is true when the USDC token account exists", async () => {
    const s = await setup();
    expect(await recipientCanReceiveUsdc(accountRpc(TOKEN_PROGRAM_ADDRESS), s.recipient, s.mint)).toBe(true);
  });

  it("is false when the wallet has no USDC account", async () => {
    const s = await setup();
    expect(await recipientCanReceiveUsdc(accountRpc(null), s.recipient, s.mint)).toBe(false);
  });

  it("is false when the address holds some other kind of account", async () => {
    const s = await setup();
    expect(await recipientCanReceiveUsdc(accountRpc("11111111111111111111111111111111"), s.recipient, s.mint)).toBe(false);
  });
});
