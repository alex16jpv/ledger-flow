import { defineConfig } from "@playwright/test";

import base from "./playwright.config";

// F-72's measurement, kept out of `tests/e2e` so it never joins the suite the sessions compare their
// baseline against: it prints numbers, it does not assert them.
export default defineConfig({
  ...base,
  testDir: "./tests/measure",
  fullyParallel: false,
  workers: 1,
  timeout: 5 * 60_000,
  outputDir: "test-results/measure",
  reporter: [["list"]],
});
