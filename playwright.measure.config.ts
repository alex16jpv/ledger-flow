import { defineConfig } from "@playwright/test";

import base from "./playwright.config";

// F-72: kept out of `tests/e2e` — it prints numbers, it does not assert them.
export default defineConfig({
  ...base,
  testDir: "./tests/measure",
  fullyParallel: false,
  workers: 1,
  timeout: 5 * 60_000,
  outputDir: "test-results/measure",
  reporter: [["list"]],
});
