import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getInvoice, type Invoice } from "@/lib/invoices";
import { paymentUrl } from "@/lib/pay";
import { CopyButton, PaymentQr } from "./payment-qr";
import { PaymentWatcher } from "./payment-watcher";

export const metadata: Metadata = {
  title: "Pay invoice · PayLink",
  // Invoice links are private to whoever has them.
  robots: { index: false, follow: false },
};

export default function InvoicePage(props: PageProps<"/i/[id]">) {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-12">
      <Suspense fallback={<p className="text-zinc-500">Loading invoice…</p>}>
        <InvoiceDetails params={props.params} />
      </Suspense>
    </main>
  );
}

async function InvoiceDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  return (
    <>
      <p className="text-sm text-zinc-500">Invoice for {invoice.clientName}</p>
      <h1 className="mt-1 text-4xl font-semibold tracking-tight">
        {formatAmount(invoice.amount)} <span className="text-2xl text-zinc-500">USDC</span>
      </h1>
      <p className="mt-3 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{invoice.description}</p>

      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-zinc-500">Status</dt>
        <dd>
          <StatusBadge status={invoice.status} />
        </dd>
        {invoice.dueDate && (
          <>
            <dt className="text-zinc-500">Due</dt>
            <dd>{formatDate(invoice.dueDate)}</dd>
          </>
        )}
        <dt className="text-zinc-500">Pays to</dt>
        <dd className="break-all font-mono text-xs leading-5">{invoice.recipient}</dd>
        <dt className="text-zinc-500">Network</dt>
        <dd>{invoice.cluster === "devnet" ? "Solana devnet (test money)" : "Solana"}</dd>
      </dl>

      {invoice.status === "unpaid" ? <PaySection invoice={invoice} /> : <ClosedNotice invoice={invoice} />}
    </>
  );
}

function PaySection({ invoice }: { invoice: Invoice }) {
  const url = paymentUrl(invoice);
  return (
    <section className="mt-8 flex flex-col items-center gap-5 rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
      <h2 className="self-start font-medium">Pay with a Solana wallet</h2>
      <PaymentQr url={url} />
      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        Scan with Phantom, Solflare or another Solana Pay wallet. On your phone, tap the button instead.
      </p>
      <a
        href={url}
        className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-center font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Open in wallet
      </a>
      <div className="flex w-full items-center gap-2">
        <input
          readOnly
          value={url}
          aria-label="Solana Pay link"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 font-mono text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        />
        <CopyButton value={url} label="Copy" />
      </div>
      <PaymentWatcher invoiceId={invoice.id} />
    </section>
  );
}

function ClosedNotice({ invoice }: { invoice: Invoice }) {
  if (invoice.status === "expired") {
    return (
      <p className="mt-8 rounded-xl border border-zinc-200 p-6 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
        This invoice has expired. Ask the sender for a new link.
      </p>
    );
  }
  return (
    <div className="mt-8 rounded-xl border border-emerald-300 bg-emerald-50 p-6 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
      <p className="font-medium">
        Paid{invoice.paidAt ? ` on ${formatDate(invoice.paidAt)}` : ""}. Nothing more to do.
      </p>
      {invoice.signature && (
        <a
          href={explorerTxUrl(invoice.signature, invoice.cluster)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm underline"
        >
          View the transaction on Solana Explorer
        </a>
      )}
    </div>
  );
}

function explorerTxUrl(signature: string, cluster: string): string {
  const url = new URL(`https://explorer.solana.com/tx/${signature}`);
  if (cluster !== "mainnet-beta") url.searchParams.set("cluster", cluster);
  return url.toString();
}

function StatusBadge({ status }: { status: Invoice["status"] }) {
  const styles = {
    unpaid: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
    paid: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
    expired: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  } as const;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles[status]}`}>{status}</span>
  );
}

function formatAmount(amount: string): string {
  const [whole, fraction] = amount.split(".");
  const grouped = BigInt(whole).toLocaleString("en-US");
  return fraction ? `${grouped}.${fraction}` : grouped;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" });
}
