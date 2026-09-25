// Writes app/favicon.ico (16, 32 and 48 px PNGs) from the brand mark. Usage: npm run build:favicon
import { writeFileSync } from "node:fs";

import { ImageResponse } from "next/og.js";
import { createElement as h } from "react";

import { BRAND_GREEN, BRAND_MARK_PATHS } from "../lib/pwa/brand-mark.ts";

const SIZES = [16, 32, 48];
const ICO_HEADER = 6;
const ICO_ENTRY = 16;

const render = async (size) => {
  const mark = size * 0.84 * 0.62;
  const svg = h(
    "svg",
    {
      width: mark,
      height: mark,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#ffffff",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    ...BRAND_MARK_PATHS.map((d) => h("path", { key: d, d })),
  );
  const tile = h(
    "div",
    {
      style: {
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND_GREEN,
        borderRadius: size * 0.22,
      },
    },
    svg,
  );
  return Buffer.from(await new ImageResponse(tile, { width: size, height: size }).arrayBuffer());
};

const pngs = await Promise.all(SIZES.map(render));
const header = Buffer.alloc(ICO_HEADER);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(SIZES.length, 4);
let offset = ICO_HEADER + ICO_ENTRY * SIZES.length;
const entries = pngs.map((png, index) => {
  const entry = Buffer.alloc(ICO_ENTRY);
  entry.writeUInt8(SIZES[index], 0);
  entry.writeUInt8(SIZES[index], 1);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += png.length;
  return entry;
});
writeFileSync(
  new URL("../app/favicon.ico", import.meta.url),
  Buffer.concat([header, ...entries, ...pngs]),
);
console.log(`build-favicon: app/favicon.ico, ${SIZES.join(", ")} px, ${offset} bytes`);
