export type Cluster = "devnet" | "mainnet-beta";

// Circle's official USDC mints.
const USDC_MINT: Record<Cluster, string> = {
  devnet: "4zMMC9srt5Ri5X14GAgXhaHii3GfHRaWTUEbPnHKXn6Y",
  "mainnet-beta": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
};

const PUBLIC_RPC: Record<Cluster, string> = {
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
};

const isProduction = process.env.NODE_ENV === "production";

function readCluster(): Cluster {
  const value = process.env.SOLANA_CLUSTER ?? (isProduction ? undefined : "devnet");
  if (value !== "devnet" && value !== "mainnet-beta") {
    throw new Error(`SOLANA_CLUSTER must be "devnet" or "mainnet-beta", got "${value}"`);
  }
  return value;
}

function readRpcUrl(cluster: Cluster): string {
  const value = process.env.SOLANA_RPC_URL;
  if (value) return value;
  // The public mainnet RPC is rate limited and not meant for apps; payments
  // would silently stop confirming under load.
  if (isProduction && cluster === "mainnet-beta") {
    throw new Error("SOLANA_RPC_URL must be set to a dedicated RPC provider for mainnet.");
  }
  return PUBLIC_RPC[cluster];
}

function readDatabaseUrl(): string {
  const value = process.env.DATABASE_URL ?? (isProduction ? undefined : "postgres://localhost:5432/paylink");
  if (!value) throw new Error("DATABASE_URL must be set.");
  return value;
}

export type Config = {
  cluster: Cluster;
  usdcMint: string;
  rpcUrl: string;
  databaseUrl: string;
};

let config: Config | undefined;

// Read on first use, not at import, so `next build` works without runtime
// secrets while a misconfigured server still fails on its first request.
export function getConfig(): Config {
  if (config) return config;
  const cluster = readCluster();
  config = {
    cluster,
    usdcMint: USDC_MINT[cluster],
    rpcUrl: readRpcUrl(cluster),
    databaseUrl: readDatabaseUrl(),
  };
  return config;
}
