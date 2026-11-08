import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/paylink_test",
      SOLANA_CLUSTER: "devnet",
    },
    // Database tests share one schema; run files one at a time.
    fileParallelism: false,
  },
});
