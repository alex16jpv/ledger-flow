import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// F-12: run under WSL, `chrome-launcher` finds the Windows browser through `/mnt/c` and asks it for a
// profile directory whose Linux path it cannot translate, so the browser creates one literally named
// `C:\Users\…` in the directory the command was run from — the repo root, where it then waits to be
// committed by mistake. Two things keep it out: a browser that is Linux all the way down (the one
// Playwright already installs, when nothing else names one), and a profile under the system temp dir.
// On CI (Ubuntu) there is a real Chrome and `CHROME_PATH`, so only the temp profile applies.
async function linuxChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  try {
    const { chromium } = await import("playwright");
    const path = chromium.executablePath();
    return existsSync(path) ? path : null;
  } catch {
    return null;
  }
}

const APP_MODE = process.argv.includes("--app");
const REST = process.argv.slice(2).filter((argument) => argument !== "--app");

const APP_PORT = process.env.LH_APP_PORT ?? "3003";
const APP_URL = process.env.LH_APP_URL ?? `http://localhost:${APP_PORT}`;
const BACKEND_PORT = process.env.E2E_BACKEND_PORT ?? "3200";
const API_URL = process.env.E2E_API_URL ?? `http://localhost:${BACKEND_PORT}`;
const DIST_DIR = ".next-lh";
const SEED = {
  email: process.env.LH_EMAIL ?? "seed@ledgerflow.test",
  password: process.env.LH_PASSWORD ?? "LedgerFlow!2026",
};
// The access cookie lives 15 minutes and a run of 25 screens takes longer: each batch signs in again.
const BATCH_SIZE = 5;

const STATIC_SCREENS = [
  "/home",
  "/transactions",
  "/transactions/new",
  "/transactions/review",
  "/accounts",
  "/accounts/new",
  "/categories",
  "/categories/new",
  "/budgets",
  "/budgets/new",
  "/budgets/past",
  "/stats",
  "/sync",
  "/settings",
  "/settings/profile",
  "/settings/appearance",
  "/settings/sessions",
  "/settings/sync",
];

const DYNAMIC_SCREENS = [
  { list: "/transactions?limit=1", paths: ["/transactions/:id", "/transactions/:id/edit"] },
  { list: "/accounts", paths: ["/accounts/:id", "/accounts/:id/edit"] },
  { list: "/categories", paths: ["/categories/:id/edit"] },
  { list: "/budgets", paths: ["/budgets/:id", "/budgets/:id/edit"] },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(url, what, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await sleep(1000);
  }
  throw new Error(`lighthouse: ${what} never answered at ${url}`);
}

function run(command, args, env = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", env: { ...process.env, ...env } });
  if (result.status !== 0) throw new Error(`lighthouse: \`${command} ${args.join(" ")}\` failed`);
}

async function signIn() {
  const response = await fetch(`${APP_URL}/api/auth/login`, {
    method: "POST",
    redirect: "manual",
    headers: { origin: APP_URL, "content-type": "application/json" },
    body: JSON.stringify(SEED),
  });
  if (!response.ok) throw new Error(`lighthouse: sign-in answered ${response.status}`);
  const cookies = response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter((pair) => !pair.endsWith("="));
  if (cookies.length === 0) throw new Error("lighthouse: sign-in returned no cookies");
  return cookies.join("; ");
}

// The screens with an `[id]` need a row that exists: the seeded database provides them, and the app's
// own BFF answers with the session it just handed out.
async function firstId(path, cookie) {
  const response = await fetch(`${APP_URL}/api${path}`, { headers: { cookie } });
  if (!response.ok) throw new Error(`lighthouse: ${path} answered ${response.status}`);
  const body = await response.json();
  const rows = Array.isArray(body) ? body : (body.data ?? body.items ?? []);
  const id = rows[0]?.id;
  if (!id) throw new Error(`lighthouse: ${path} returned no row to open`);
  return id;
}

async function screens(cookie) {
  const paths = [...STATIC_SCREENS];
  for (const { list, paths: templates } of DYNAMIC_SCREENS) {
    const id = await firstId(list, cookie);
    for (const template of templates) paths.push(template.replace(":id", id));
  }
  // No locale prefix: `en` is the default and next-intl redirects `/en/x` to `/x` — and Lighthouse's
  // extra headers do not survive that redirect, so the session would be lost on the way in.
  return paths.map((path) => `${APP_URL}${path}`);
}

function lhciConfig(urls, cookie, flags) {
  const config = JSON.parse(readFileSync("lighthouserc.app.json", "utf8"));
  config.ci.collect = {
    ...config.ci.collect,
    url: urls,
    settings: { ...config.ci.collect?.settings, chromeFlags: flags, extraHeaders: { cookie } },
  };
  return config;
}

function reportScores() {
  const files = readdirSync(".lighthouseci").filter(
    (name) => name.startsWith("lhr-") && name.endsWith(".json"),
  );
  const rows = files
    .map((name) => JSON.parse(readFileSync(join(".lighthouseci", name), "utf8")))
    .map((lhr) => ({
      route: new URL(lhr.finalDisplayedUrl ?? lhr.finalUrl).pathname,
      scores: Object.fromEntries(
        Object.entries(lhr.categories).map(([key, category]) => [key, category.score]),
      ),
    }))
    .sort((left, right) => left.route.localeCompare(right.route));
  const percent = (score) => (score == null ? "  - " : `${Math.round(score * 100)}`.padStart(4));
  console.log("\nroute                              perf  a11y   bp");
  for (const { route, scores } of rows) {
    console.log(
      `${route.padEnd(34)}${percent(scores.performance)}${percent(scores.accessibility)}${percent(scores["best-practices"])}`,
    );
  }
}

async function collectAuthenticated(flags, chrome) {
  const cookie = await signIn();
  const urls = await screens(cookie);
  console.log(`lighthouse: ${urls.length} authenticated screens, ${BATCH_SIZE} per sign-in`);
  const directory = mkdtempSync(join(tmpdir(), "ledger-flow-lhrc-"));
  const temporary = join(directory, "lighthouserc.json");
  const env = chrome ? { CHROME_PATH: chrome } : {};
  try {
    for (let index = 0; index < urls.length; index += BATCH_SIZE) {
      const batch = urls.slice(index, index + BATCH_SIZE);
      const fresh = index === 0 ? cookie : await signIn();
      writeFileSync(temporary, JSON.stringify(lhciConfig(batch, fresh, flags)));
      run(
        "npx",
        ["lhci", "collect", `--config=${temporary}`, ...(index ? ["--additive"] : [])],
        env,
      );
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  reportScores();
  const assertion = spawnSync("npx", ["lhci", "assert", "--config=lighthouserc.app.json"], {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  return assertion.status ?? 1;
}

async function authenticatedRun(flags, chrome) {
  const started = [];
  try {
    let backendUp = true;
    try {
      backendUp = (await fetch(`${API_URL}/health/db`)).ok;
    } catch {
      backendUp = false;
    }
    if (!backendUp) {
      started.push(spawn("node", ["tools/e2e-backend.mjs"], { stdio: "inherit", detached: true }));
      await waitFor(`${API_URL}/health/db`, "the backend");
    }

    const buildEnv = {
      NEXT_DIST_DIR: DIST_DIR,
      SERWIST_SW_DEST: "public/sw-lh.js",
      NEXT_PUBLIC_SW_PATH: "/sw-lh.js",
      NEXT_PUBLIC_APP_URL: APP_URL,
      NEXT_PUBLIC_CONTACT_EMAIL:
        process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "ledgerflow@alexpiral.com",
      API_URL,
    };
    if (REST.includes("--no-build") && existsSync(join(DIST_DIR, "build-manifest.json"))) {
      console.log(`lighthouse: reusing the build in ${DIST_DIR}`);
    } else {
      run("npm", ["run", "build"], buildEnv);
    }

    started.push(
      spawn("npx", ["next", "start", "--port", APP_PORT], {
        stdio: "inherit",
        detached: true,
        env: { ...process.env, ...buildEnv, NODE_ENV: "production" },
      }),
    );
    await waitFor(`${APP_URL}/en/login`, "the app");
    return await collectAuthenticated(flags, chrome);
  } finally {
    // `npx next start` and the backend runner both leave a grandchild holding the port: the whole
    // process group has to go, not the child this process spawned.
    for (const child of started) {
      if (child.pid) {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch {
          child.kill("SIGTERM");
        }
      }
    }
  }
}

const profile = mkdtempSync(join(tmpdir(), "ledger-flow-lighthouse-"));
const chrome = await linuxChrome();
const flags = `--no-sandbox --headless=new --user-data-dir=${profile}`;
// `--user-data-dir` is not enough: under WSL `chrome-launcher` still makes a profile of its own out
// of `TEMP`, and with the Windows value it lands in the working directory as `C:\Users\…`, which the
// next Turbopack build dies reading (F-12). The trailing slash keeps its `\lighthouse.n` inside.
process.env.TEMP = `${profile}/`;
process.env.TMP = process.env.TEMP;

try {
  if (APP_MODE) {
    process.exit(await authenticatedRun(flags, chrome));
  }
  const result = spawnSync(
    "npx",
    ["lhci", "autorun", `--collect.settings.chromeFlags=${flags}`, ...REST],
    {
      stdio: "inherit",
      env: { ...process.env, ...(chrome ? { CHROME_PATH: chrome } : {}) },
    },
  );
  process.exit(result.status ?? 1);
} finally {
  rmSync(profile, { recursive: true, force: true });
}
