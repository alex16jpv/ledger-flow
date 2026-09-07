import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
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

const profile = mkdtempSync(join(tmpdir(), "ledger-flow-lighthouse-"));
const chrome = await linuxChrome();
const flags = `--no-sandbox --headless=new --user-data-dir=${profile}`;

try {
  const result = spawnSync(
    "npx",
    ["lhci", "autorun", `--collect.settings.chromeFlags=${flags}`, ...process.argv.slice(2)],
    {
      stdio: "inherit",
      env: { ...process.env, ...(chrome ? { CHROME_PATH: chrome } : {}) },
    },
  );
  process.exit(result.status ?? 1);
} finally {
  rmSync(profile, { recursive: true, force: true });
}
