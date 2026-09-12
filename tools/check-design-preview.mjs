import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const PREVIEW = "design/preview";
// Only the pages and this index are generated; the rest of assets/ (ui.css, the fonts, the icons) is written by hand.
const INDEX = join("assets", "plates.js");

function files(dir, root = dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? files(path, root) : [relative(root, path)];
  });
}

const out = mkdtempSync(join(tmpdir(), "design-preview-"));
try {
  execFileSync("node", ["design/build.mjs"], {
    stdio: "inherit",
    env: { ...process.env, DESIGN_OUT: out },
  });
  const fresh = files(out);
  const stale = [
    ...fresh.filter((name) => {
      const committed = join(PREVIEW, name);
      return (
        !statSync(committed, { throwIfNoEntry: false })?.isFile() ||
        !readFileSync(committed).equals(readFileSync(join(out, name)))
      );
    }),
    ...files(PREVIEW).filter(
      (name) => (name.endsWith(".html") || name === INDEX) && !fresh.includes(name),
    ),
  ];
  if (stale.length > 0) {
    console.error(
      "check-design-preview: design/preview is not what design/build.mjs produces. Run `npm run design:build` and commit the result; the pages are generated, so an edit made to the HTML by hand is lost on the next build.",
    );
    console.error(stale.map((name) => `  ${join(PREVIEW, name)}`).join("\n"));
    process.exit(1);
  }
  console.log(`check-design-preview: ${fresh.length} files match design/build.mjs`);
} finally {
  rmSync(out, { recursive: true, force: true });
}
