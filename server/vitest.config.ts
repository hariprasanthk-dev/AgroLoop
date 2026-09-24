import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
    setupFiles: ["src/tests/setup-env.ts"],
    // Tests share one in-memory MongoDB per file; run files one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    // First run downloads a MongoDB binary for mongodb-memory-server.
    hookTimeout: 300_000,
  },
});
