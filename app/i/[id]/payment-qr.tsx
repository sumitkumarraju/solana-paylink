"use client";

import { useEffect, useRef, useState } from "react";
import { createQR } from "@solana/pay";

export function PaymentQr({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Light background and dark modules in both themes: phone cameras read that most reliably.
    const qr = createQR(url, 280, "white", "black");
    el.replaceChildren();
    qr.append(el);
    return () => el.replaceChildren();
  }, [url]);

  return (
    <div
      ref={ref}
      role="img"
      aria-label="Solana Pay QR code. Scan with a Solana wallet to pay."
      className="size-[280px] overflow-hidden rounded-lg bg-white"
    />
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
