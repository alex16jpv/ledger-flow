// Usage: node design/shoot.mjs [--page=settings] [--device=mobile] [--mode=dark] [--palette=brisa]
import { mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const PREVIEW = fileURLToPath(new URL("./preview/", import.meta.url));
const PAGES = readdirSync(PREVIEW)
  .filter((f) => f.endsWith(".html"))
  .map((f) => f.replace(/\.html$/, ""))
  .sort();
const DEVICES = { mobile: 460, tablet: 900, desktop: 1400 };

const arg = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const only = arg("page");
const devices = arg("device") ? [arg("device")] : ["mobile", "desktop"];
const modes = arg("mode") ? [arg("mode")] : ["light", "dark"];
const palette = arg("palette", "tinta");

const OUT = fileURLToPath(new URL("./captures/", import.meta.url));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
let n = 0;
for (const page of PAGES.filter((p) => !only || p.includes(only))) {
  for (const device of devices) {
    for (const mode of modes) {
      const context = await browser.newContext({
        viewport: { width: DEVICES[device], height: 1200 },
        deviceScaleFactor: 1,
      });
      const tab = await context.newPage();
      await tab.goto(
        `file://${PREVIEW}${page}.html?device=${device}&mode=${mode}&palette=${palette}&frame=tall`,
      );
      await tab.waitForLoadState("networkidle");
      const name = `${page}-${device}-${mode}${palette === "tinta" ? "" : `-${palette}`}.png`;
      await tab.screenshot({ path: `${OUT}${name}`, fullPage: true });
      await context.close();
      n += 1;
      console.log(name);
    }
  }
}
await browser.close();
console.log(`${n} captures in design/captures/`);
