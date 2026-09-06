import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

// Budgets exclude the shared Next/React runtime (reported separately): only route-owned JS counts.
const BUDGETS = [
  { name: "landing", route: /^(?:\/\(public\))?(?:\/\[locale\])?\/page$/, limitKb: 60 },
  { name: "app shell", route: /^(?:\/\[locale\])?\/\(app\)\/page$/, limitKb: 200 },
];

// The gate builds into its own directory so it never overwrites the `.next` a running app serves (F-56).
const NEXT_DIR = process.env.NEXT_DIST_DIR ?? ".next";
const gzipKb = (files) =>
  files.reduce((sum, file) => sum + gzipSync(readFileSync(join(NEXT_DIR, file))).length, 0) / 1024;

function routeManifests(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) routeManifests(path, out);
    else if (entry === "page_client-reference-manifest.js") out.push(path);
  }
  return out;
}

const routeOf = (manifestPath) =>
  manifestPath
    .replace(new RegExp(`^${NEXT_DIR}/server/app`), "")
    .replace(/\/page_client-reference-manifest\.js$/, "/page")
    .replace(/^\/page$/, "/page");

function chunksOf(manifestPath) {
  const source = readFileSync(manifestPath, "utf8");
  return [...new Set(source.match(/static\/chunks\/[^"'\\]+\.js/g) ?? [])];
}

if (!existsSync(join(NEXT_DIR, "build-manifest.json"))) {
  console.error("size-limit: run `next build` first");
  process.exit(1);
}

const buildManifest = JSON.parse(readFileSync(join(NEXT_DIR, "build-manifest.json"), "utf8"));
const runtime = new Set(buildManifest.rootMainFiles);
console.log(
  `size-limit: framework runtime ${gzipKb([...runtime]).toFixed(1)} kB gz (not budgeted)`,
);

let failed = false;
for (const manifestPath of routeManifests(join(NEXT_DIR, "server", "app"))) {
  const route = routeOf(manifestPath);
  const budget = BUDGETS.find((candidate) => candidate.route.test(route));
  if (!budget) continue;
  const kb = gzipKb(chunksOf(manifestPath).filter((file) => !runtime.has(file)));
  const ok = kb <= budget.limitKb;
  failed ||= !ok;
  console.log(
    `size-limit: ${ok ? "ok  " : "FAIL"} ${budget.name} ${route} ${kb.toFixed(1)} kB gz (limit ${budget.limitKb} kB)`,
  );
}
process.exit(failed ? 1 : 0);
