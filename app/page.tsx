import Link from "next/link";
import { getConfig } from "@/lib/config";

const REPO_URL = "https://github.com/sumitkumarraju/solana-paylink";

const STEPS = [
  {
    title: "Create an invoice",
    body: "Enter your Solana wallet, the amount in USDC and what the work was for. No sign-up.",
  },
  {
    title: "Send the link",
    body: "Your client opens it and scans the QR code with Phantom, Solflare or any Solana Pay wallet. Amount and token fill in for them.",
  },
  {
    title: "Get paid, verified on-chain",
    body: "USDC goes straight to your wallet. PayLink checks the transaction on Solana and marks the invoice paid within seconds, with a link to the proof.",
  },
];

export default function Home() {
  const devnet = getConfig().cluster === "devnet";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">PayLink</h1>
      <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
        Get paid in USDC on Solana with a link. Create an invoice, send it, and your client pays straight to
        your wallet. No middleman holds the money, and no card fees.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/new"
          className="rounded-md bg-zinc-900 px-5 py-2.5 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Create an invoice
        </Link>
        <a
          href={REPO_URL}
          className="rounded-md border border-zinc-300 px-5 py-2.5 font-medium dark:border-zinc-700"
        >
          Source code
        </a>
      </div>

      <h2 className="mt-14 text-sm font-semibold uppercase tracking-wide text-zinc-500">How it works</h2>
      <ol className="mt-4 flex flex-col gap-5">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
              {index + 1}
            </span>
            <div>
              <p className="font-medium">{step.title}</p>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      {devnet && (
        <section className="mt-14 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <p className="font-medium">This demo runs on Solana devnet, with test money.</p>
          <p className="mt-2">
            To try it: switch your wallet to devnet (Phantom: Settings, Developer Settings, Testnet Mode), then get
            free devnet USDC at{" "}
            <a href="https://faucet.circle.com" className="underline">
              faucet.circle.com
            </a>{" "}
            and a little devnet SOL for fees at{" "}
            <a href="https://faucet.solana.com" className="underline">
              faucet.solana.com
            </a>
            .
          </p>
        </section>
      )}
    </main>
  );
}
