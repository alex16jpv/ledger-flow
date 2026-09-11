import { defineConfig } from "@playwright/test";

import base from "./playwright.config";

// Slow enough to follow with the eye when the run is watched headed (npm run demo:offline:watch).
const slowMo = Number(process.env.DEMO_SLOW_MS ?? 0);

// Plan §8: kept out of `tests/e2e` so it never joins the suite the baseline is compared against.
export default defineConfig({
  ...base,
  testDir: "./tests/gate",
  fullyParallel: false,
  workers: 1,
  timeout: 6 * 60_000,
  outputDir: "test-results/gate",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-gate" }]],
  use: {
    ...base.use,
    video: "on",
    trace: "on",
    launchOptions: { slowMo },
  },
});
