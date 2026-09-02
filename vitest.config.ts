import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
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
    coverage: {
      provider: "v8",
      include: ["lib/**/*.{ts,tsx}", "features/*/hooks.ts"],
      exclude: ["**/*.test.{ts,tsx}", "lib/env.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
