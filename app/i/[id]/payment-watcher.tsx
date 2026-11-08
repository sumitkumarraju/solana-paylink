"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const POLL_MS = 4_000;
const RETRY_MS = 10_000;

// Polls the status endpoint while the page is visible. When the payment is
// confirmed it re-renders the server page, which then shows the paid state.
export function PaymentWatcher({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [trouble, setTrouble] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    async function poll() {
      if (stopped) return;
      if (document.visibilityState !== "visible") {
        timer = setTimeout(poll, POLL_MS);
        return;
      }
      let next = POLL_MS;
      try {
        const res = await fetch(`/api/invoices/${invoiceId}/status`, { cache: "no-store" });
        const body = (await res.json()) as { status?: string };
        if (body.status && body.status !== "unpaid") {
          router.refresh();
          return;
        }
        setTrouble(!res.ok);
        if (!res.ok) next = RETRY_MS;
      } catch {
        setTrouble(true);
        next = RETRY_MS;
      }
      timer = setTimeout(poll, next);
    }

    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [invoiceId, router]);

  return (
    <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
      <span className="size-2 animate-pulse rounded-full bg-amber-500 motion-reduce:animate-none" aria-hidden />
      {trouble ? "Having trouble reaching Solana. Still checking…" : "Waiting for payment. This page updates on its own."}
    </p>
  );
}
