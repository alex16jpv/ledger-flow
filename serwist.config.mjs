import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { serwist } from "@serwist/next/config";

// The manifest only globs the build output, and the offline fallback documents live in `public/`:
// without a revision of their own a changed document would never reach an installed worker.
const OFFLINE_DOCUMENTS = ["/offline.html", "/offline.es.html"];

const revisionOf = (url) =>
  createHash("sha256")
    .update(readFileSync(`public${url}`))
    .digest("hex")
    .slice(0, 16);

// Next builds with Turbopack, so the worker is bundled by the Serwist CLI after `next build` (see package.json).
// The e2e build writes its worker beside this one so `public/sw.js` stays the running app's (F-56).
const swDest = process.env.SERWIST_SW_DEST ?? "public/sw.js";

export default await serwist({
  swSrc: "app/sw.ts",
  swDest,
  // A worker left in `public/` by the other build is a file, not an asset: it never gets precached.
  globIgnores: ["public/sw*.js", "public/sw*.js.map"],
  // @serwist/next strips `.html` before it strips the `public/` prefix, so a document there reaches
  // the manifest as `/public/offline`, which 404s and fails the install. Added by hand instead.
  manifestTransforms: [
    (entries) => ({
      manifest: entries.filter(
        (entry) => !(entry.url.startsWith("public/") && entry.url.endsWith(".html")),
      ),
      warnings: [],
    }),
  ],
  additionalPrecacheEntries: OFFLINE_DOCUMENTS.map((url) => ({ url, revision: revisionOf(url) })),
});
