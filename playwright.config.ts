import { defineConfig, devices } from "@playwright/test";

const appPort = process.env.E2E_APP_PORT ?? "3002";
const baseURL = process.env.E2E_APP_URL ?? `http://localhost:${appPort}`;
const backendPort = process.env.E2E_BACKEND_PORT ?? "3200";
const apiUrl = process.env.E2E_API_URL ?? `http://localhost:${backendPort}`;

// F-56: set on this process too — the specs register the worker of THIS build, not `public/sw.js`.
process.env.NEXT_DIST_DIR ??= ".next-e2e";
process.env.SERWIST_SW_DEST ??= "public/sw-e2e.js";
process.env.NEXT_PUBLIC_SW_PATH ??= "/sw-e2e.js";
// `tests/offline.ts` reads it for the `origin` header: a wrong origin is a 403 UNTRUSTED_ORIGIN.
process.env.E2E_APP_URL ??= baseURL;

const frontEnv = {
  ...process.env,
  API_URL: apiUrl,
  NEXT_PUBLIC_APP_URL: baseURL,
  NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "ledgerflow@alexpiral.com",
  NEXT_PUBLIC_APP_ENV: "test",
  E2E_APP_URL: baseURL,
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  // T-34: nothing runs this but a person, so a stray `.only` has to fail the run itself.
  forbidOnly: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  // The suite brings up its own backend and test database.
  webServer: [
    {
      command: "node tools/e2e-backend.mjs",
      url: `${apiUrl}/health/db`,
      reuseExistingServer: true,
      timeout: 180_000,
      env: { ...process.env, E2E_APP_URL: baseURL, E2E_BACKEND_PORT: backendPort },
    },
    {
      // Next 16 allows one dev server per directory, so the e2e front is a production build on its own port.
      // H-08: Node closes an idle socket at 5 s, and a client reusing it right then loses the request.
      command: `npm run build && npx next start --port ${appPort} --keepAliveTimeout 120000`,
      url: baseURL,
      reuseExistingServer: true,
      timeout: 180_000,
      env: frontEnv,
    },
  ],
});
