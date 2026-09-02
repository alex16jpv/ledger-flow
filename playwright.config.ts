import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);
const appPort = process.env.E2E_APP_PORT ?? (isCI ? "3001" : "3002");
const baseURL = process.env.E2E_APP_URL ?? `http://localhost:${appPort}`;
const backendPort = process.env.E2E_BACKEND_PORT ?? "3200";
const apiUrl =
  process.env.E2E_API_URL ?? (isCI ? "http://localhost:3000" : `http://localhost:${backendPort}`);

const frontEnv = {
  ...process.env,
  API_URL: apiUrl,
  NEXT_PUBLIC_APP_URL: baseURL,
  NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "ledgerflow@alexpiral.com",
  E2E_APP_URL: baseURL,
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  // Locally the suite runs against its own backend and test database; CI starts the backend itself.
  webServer: [
    ...(isCI
      ? []
      : [
          {
            command: "node tools/e2e-backend.mjs",
            url: `${apiUrl}/health/db`,
            reuseExistingServer: true,
            timeout: 180_000,
            env: { ...process.env, E2E_APP_URL: baseURL, E2E_BACKEND_PORT: backendPort },
          },
        ]),
    {
      // Next 16 allows one dev server per directory, so the e2e front is a production build on its own port.
      command: `npm run build && npx next start --port ${appPort}`,
      url: baseURL,
      reuseExistingServer: !isCI,
      timeout: 180_000,
      env: frontEnv,
    },
  ],
});
