import { serwist } from "@serwist/next/config";

// Next builds with Turbopack, so the worker is bundled by the Serwist CLI after `next build` (see package.json).
export default await serwist({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
});
