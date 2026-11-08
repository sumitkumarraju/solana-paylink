import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">PayLink</h1>
      <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">
        Get paid in USDC on Solana. Create an invoice, send the link, and your client pays
        straight to your wallet in seconds.
      </p>
      <Link
        href="/new"
        className="mt-8 self-start rounded-md bg-zinc-900 px-5 py-2.5 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Create an invoice
      </Link>
    </main>
  );
}
