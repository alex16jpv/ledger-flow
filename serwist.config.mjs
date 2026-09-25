import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { serwist } from "@serwist/next/config";

// The manifest only globs the build output, so these need a revision of their own.
const OFFLINE_DOCUMENTS = ["/offline.html", "/offline.es.html"];

const revisionOf = (url) =>
  createHash("sha256")
    .update(readFileSync(`public${url}`))
    .digest("hex")
    .slice(0, 16);

// F-56: the e2e build writes its worker beside this one so `public/sw.js` stays the app's.
const swDest = process.env.SERWIST_SW_DEST ?? "public/sw.js";

// T-195: each build stages its shell under its own name, so two installs never share one.
const buildId = readFileSync(`${process.env.NEXT_DIST_DIR ?? ".next"}/BUILD_ID`, "utf8").trim();

export default await serwist({
  swSrc: "app/sw.ts",
  swDest,
  // A worker left in `public/` by the other build is a file, not an asset: it never gets precached.
  globIgnores: ["public/sw*.js", "public/sw*.js.map"],
  // @serwist/next strips `.html` before `public/`, so a document there 404s as `/public/offline`.
  manifestTransforms: [
    (entries) => ({
      manifest: entries.filter(
        (entry) => !(entry.url.startsWith("public/") && entry.url.endsWith(".html")),
      ),
      warnings: [],
    }),
  ],
  additionalPrecacheEntries: OFFLINE_DOCUMENTS.map((url) => ({ url, revision: revisionOf(url) })),
  esbuildOptions: { define: { "self.__BUILD_ID": JSON.stringify(buildId) } },
});
