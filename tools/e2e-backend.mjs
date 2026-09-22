import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Starts the sibling backend against the local Docker Mongo (test database) and seeds it, for local e2e runs.
const backendDir = resolve(process.env.E2E_BACKEND_DIR ?? "../lag-money-manager");
const port = process.env.E2E_BACKEND_PORT ?? "3200";
const appUrl = process.env.E2E_APP_URL ?? "http://localhost:3002";
// The seed reads SEED_TODAY in its own user's zone and refuses a day that is future there.
const SEED_ZONE = "America/Bogota";
// It describes the month in progress from the 22nd on, and the specs read the seed as lastMonth.
const firstOfThisMonth = `${new Intl.DateTimeFormat("en-CA", { timeZone: SEED_ZONE, year: "numeric", month: "2-digit" }).format(new Date())}-01`;

const env = {
  ...process.env,
  NODE_ENV: "development",
  PORT: port,
  CORS_ORIGIN: appUrl,
  MONGO_URI:
    process.env.E2E_MONGO_URI ??
    "mongodb://localhost:27017/lag_money_test?replicaSet=rs0&directConnection=true",
  JWT_SECRET: process.env.E2E_JWT_SECRET ?? "e2e-only-secret",
  AUTH_RATE_LIMIT_MAX: "1000",
  // Register and login are capped per IP, and every run of this suite is the same one address.
  AUTH_IP_RATE_LIMIT_MAX: "10000",
  REFRESH_RATE_LIMIT_MAX: "1000",
  RATE_LIMIT_MAX: "10000",
};

if (!existsSync(backendDir)) {
  console.error(`e2e-backend: backend not found at ${backendDir}`);
  process.exit(1);
}

const seed = spawnSync("npm", ["run", "seed:test"], {
  cwd: backendDir,
  env: { ...env, SEED_TODAY: process.env.SEED_TODAY ?? firstOfThisMonth },
  stdio: "inherit",
});
if (seed.status !== 0) process.exit(seed.status ?? 1);

const server = spawn("npx", ["tsx", "src/server.ts"], { cwd: backendDir, env, stdio: "inherit" });
server.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.kill(signal);
  });
}
