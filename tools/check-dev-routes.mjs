import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

// W-39: the development-only screens are switched off by the `componentCatalog` and `devLogin`
// flags, which are read from the environment at request time — a build alone never proves they are
// off. This starts the production build the gate just made, with no NEXT_PUBLIC_APP_ENV to reopen
// them, and asks the server.
const DIST_DIR = process.env.NEXT_DIST_DIR ?? ".next";
const PORT = process.env.DEV_ROUTES_PORT ?? "3004";
const ORIGIN = `http://localhost:${PORT}`;

// The public routes are the control: a server that answered 404 to everything would pass a check
// made only of 404s.
const EXPECTED = [
  { path: "/dev/ui", status: 404 },
  // `en` is the default locale: next-intl redirects `/en/x` to `/x`, so this one is followed.
  { path: "/en/dev/ui", status: 404 },
  { path: "/es/dev/ui", status: 404 },
  { path: "/dev/frame?url=/home", status: 404 },
  { path: "/dev/pickers", status: 404 },
  { path: "/es/dev/pickers", status: 404 },
  { path: "/api/dev/login?email=a@b.test&password=x", status: 404 },
  { path: "/login", status: 200 },
  { path: "/es/login", status: 200 },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // not up yet
    }
    await sleep(500);
  }
  throw new Error(`check-dev-routes: the server never answered at ${url}`);
}

if (!existsSync(join(DIST_DIR, "build-manifest.json"))) {
  console.error(`check-dev-routes: ${DIST_DIR} holds no build; run \`next build\` first`);
  process.exit(1);
}

// A server already on the port would answer for us, and a stale one from another build would say
// whatever it was built with: the check has to measure the build it was pointed at, or nothing.
try {
  await fetch(ORIGIN, { redirect: "manual", signal: AbortSignal.timeout(2000) });
  console.error(`check-dev-routes: something already answers at ${ORIGIN}; free the port first`);
  process.exit(1);
} catch {
  // nothing there, which is what this check needs
}

const env = { ...process.env, NODE_ENV: "production", NEXT_DIST_DIR: DIST_DIR };
delete env.NEXT_PUBLIC_APP_ENV;

// Detached so the whole group can be stopped: killing `npx` alone leaves the server it started
// listening, and the next run would measure that one.
const server = spawn("npx", ["next", "start", "--port", PORT], {
  env,
  stdio: "ignore",
  detached: true,
});
const stopped = new Promise((resolve) => server.once("exit", resolve));
let failures = 0;

try {
  await waitFor(`${ORIGIN}/login`);
  for (const { path, status } of EXPECTED) {
    const response = await fetch(`${ORIGIN}${path}`);
    const ok = response.status === status;
    if (!ok) failures += 1;
    console.log(
      `check-dev-routes: ${ok ? "ok  " : "FAIL"} ${path} → ${response.status} (want ${status})`,
    );
  }
} finally {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
  await Promise.race([stopped, sleep(5000)]);
}

if (failures > 0) {
  console.error(`check-dev-routes: ${failures} route(s) answered something else`);
  process.exit(1);
}
console.log(`check-dev-routes: the ${EXPECTED.length} routes answer what a production build must`);
