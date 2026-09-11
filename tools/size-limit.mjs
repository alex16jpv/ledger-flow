import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

// F-10: budgets exclude the shared runtime, and a pattern matching no route watches nothing.
const BUDGETS = [
  { name: "landing", route: /^(?:\/\(public\))?(?:\/\[locale\])?\/page$/, limitKb: 60 },
  // F-70 took Zod's locales out, so the heaviest is 183.5 kB gz and 200 kB is a real limit.
  { name: "app screen", route: /^(?:\/\[locale\])?\/\(app\)\/(?!dev\/).+\/page$/, limitKb: 200 },
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

const measured = routeManifests(join(NEXT_DIR, "server", "app")).map((manifestPath) => ({
  route: routeOf(manifestPath),
  kb: gzipKb(chunksOf(manifestPath).filter((file) => !runtime.has(file))),
}));

let failed = false;
for (const budget of BUDGETS) {
  const matching = measured.filter((entry) => budget.route.test(entry.route));
  if (matching.length === 0) {
    // F-10: a budget that matches nothing used to say so by printing no line at all.
    failed = true;
    console.log(`size-limit: FAIL ${budget.name} matches no route`);
    continue;
  }
  const worst = matching.reduce((left, right) => (right.kb > left.kb ? right : left));
  const ok = worst.kb <= budget.limitKb;
  failed ||= !ok;
  const of = matching.length > 1 ? ` (heaviest of ${matching.length})` : "";
  console.log(
    `size-limit: ${ok ? "ok  " : "FAIL"} ${budget.name} ${worst.route} ${worst.kb.toFixed(1)} kB gz (limit ${budget.limitKb} kB)${of}`,
  );
}
process.exit(failed ? 1 : 0);
