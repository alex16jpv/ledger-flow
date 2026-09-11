#!/usr/bin/env node
// Vendored because CI checks out this repo alone; `parity.test.ts` fails on drift side by side.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const SOURCE = resolve(process.env.OFFLINE_FIXTURES_DIR ?? "../lag-money-manager/fixtures/offline");
const TARGET = resolve("lib/local/derive/fixtures");

if (!existsSync(SOURCE)) {
  console.error(
    `No fixtures at ${SOURCE}. Check out lag-money-manager next to this repo, or set OFFLINE_FIXTURES_DIR.`,
  );
  process.exit(1);
}

mkdirSync(TARGET, { recursive: true });
for (const name of readdirSync(TARGET)) rmSync(join(TARGET, name));
const names = readdirSync(SOURCE);
for (const name of names) copyFileSync(join(SOURCE, name), join(TARGET, name));
console.log(`Copied ${names.length} files from ${SOURCE}`);
