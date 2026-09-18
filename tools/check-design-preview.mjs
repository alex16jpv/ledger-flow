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

  const BAR =
    /<div class="progress thin"><span class="fill" style="width:(\d+)%"><\/span><\/div><span class="xs faint">([^<]*)<\/span>/g;
  const figure = (text) => Number(text.replace(/[$,]/g, ""));
  const wrong = [];
  let bars = 0;
  for (const name of files(PREVIEW).filter((file) => file.endsWith(".html"))) {
    const html = readFileSync(join(PREVIEW, name), "utf8");
    for (const [, percent, caption] of html.matchAll(BAR)) {
      bars += 1;
      // A caption may add a clause after a middle dot (T-101); what the bar fills with is the first one.
      const head = caption.split(" \u00b7 ")[0];
      const parts =
        /^\$([\d,]+) (?:owed|paid) of \$([\d,]+)$/.exec(head) ??
        /^\$([\d,]+) of \$([\d,]+) used$/.exec(head);
      const expected = parts
        ? Math.round((figure(parts[1]) / figure(parts[2])) * 100)
        : /of your own money sitting on it$/.test(head)
          ? 0
          : null;
      if (expected === null || expected !== Number(percent))
        wrong.push(`  ${name}: bar at ${percent}% under “${caption}”`);
    }
  }
  if (wrong.length > 0) {
    console.error(
      "check-design-preview: a bar disagrees with the line under it. The line says what the bar fills with, never its complement (design/spec/screens/accounts.md).",
    );
    console.error(wrong.join("\n"));
    process.exit(1);
  }
  console.log(`check-design-preview: ${bars} bars agree with their caption`);
} finally {
  rmSync(out, { recursive: true, force: true });
}
