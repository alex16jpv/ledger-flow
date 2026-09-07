import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // next ships no "exports" map, so bare subpaths need their .js file under strict ESM resolution.
    alias: [
      { find: /^next\/navigation$/, replacement: "next/navigation.js" },
      { find: /^next\/link$/, replacement: "next/link.js" },
      { find: /^next\/headers$/, replacement: "next/headers.js" },
      { find: "@", replacement: fileURLToPath(new URL(".", import.meta.url)) },
    ],
  },
  test: {
    environment: "jsdom",
    env: {
      API_URL: "http://backend.test",
      NEXT_PUBLIC_APP_URL: "http://localhost:3001",
      NEXT_PUBLIC_CONTACT_EMAIL: "ledgerflow@alexpiral.com",
    },
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", "tests/e2e/**"],
    passWithNoTests: true,
    // Under the pre-commit hook the machine is often still running Playwright's servers, and the
    // default 5 s made valid commits fail on timing alone (F-19).
    testTimeout: 15_000,
    server: { deps: { inline: ["next-intl"] } },
    coverage: {
      provider: "v8",
      include: ["lib/**/*.{ts,tsx}", "features/*/hooks.ts"],
      exclude: ["**/*.test.{ts,tsx}", "lib/env.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
