"use client";

import { useState } from "react";

type Fields = Record<string, string>;
type Created = { id: string; amount: string; clientName: string };

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export default function NewInvoicePage() {
  const [errors, setErrors] = useState<Fields>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setFormError(null);

    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (res.status === 201) {
        setCreated(json.invoice);
      } else {
        setErrors(json.fields ?? {});
        setFormError(json.error ?? "Could not create the invoice.");
      }
    } catch {
      setFormError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    const link = `${window.location.origin}/i/${created.id}`;
    return (
      <main className="mx-auto w-full max-w-lg px-4 py-12">
        <h1 className="text-2xl font-semibold">Invoice created</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {created.amount} USDC for {created.clientName}. Send this link to your client:
        </p>
        <div className="mt-4 flex gap-2">
          <input readOnly value={link} className={inputClass} aria-label="Payment link" />
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(link)}
            className="rounded-md bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Copy
          </button>
        </div>
        <button
          type="button"
          onClick={() => setCreated(null)}
          className="mt-6 text-sm underline"
        >
          Create another invoice
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-12">
      <h1 className="text-2xl font-semibold">New invoice</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Your client pays in USDC on Solana, straight to your wallet.
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5" noValidate>
        <Field label="Your Solana wallet address" name="recipient" error={errors.recipient}>
          <input id="recipient" name="recipient" className={inputClass} autoComplete="off" required />
        </Field>
        <Field label="Amount (USDC)" name="amount" error={errors.amount}>
          <input id="amount" name="amount" inputMode="decimal" className={inputClass} required />
        </Field>
        <Field label="Client name" name="clientName" error={errors.clientName}>
          <input id="clientName" name="clientName" maxLength={100} className={inputClass} required />
        </Field>
        <Field label="What is this invoice for?" name="description" error={errors.description}>
          <textarea id="description" name="description" maxLength={500} rows={3} className={inputClass} required />
        </Field>
        <Field label="Due date (optional)" name="dueDate" error={errors.dueDate}>
          <input id="dueDate" name="dueDate" type="date" className={inputClass} />
        </Field>

        {formError && (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {submitting ? "Creating…" : "Create invoice"}
        </button>
      </form>
    </main>
  );
}

function Field({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${name}-error`} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
