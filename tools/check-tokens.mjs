import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SCAN_ROOTS = ["app", "components", "features", "lib", "tests"];
const EXTENSIONS = /\.(tsx?|css)$/;
const EXEMPT_PREFIXES = ["tokens" + sep, "types" + sep];

const TAILWIND_PREFIXES =
  "bg|text|border|ring|fill|stroke|from|to|via|outline|decoration|accent|caret|shadow|divide|placeholder|inset-ring";
const TAILWIND_COLORS =
  "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|white|black";

const RULES = [
  {
    name: "hex color",
    pattern: /(?<![\w&])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g,
  },
  { name: "raw color function", pattern: /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\(/g },
  {
    name: "tailwind palette class",
    pattern: new RegExp(
      `(?<![\\w-])(?:${TAILWIND_PREFIXES})-(?:${TAILWIND_COLORS})(?:-\\d{2,3})?(?:/\\d{1,3})?(?![\\w-])`,
      "g",
    ),
  },
];

function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry !== "node_modules") walk(path, out);
    } else if (EXTENSIONS.test(entry)) {
      out.push(path);
    }
  }
  return out;
}

function targets(args) {
  if (args.length > 0) return args.filter((file) => EXTENSIONS.test(file));
  const files = [];
  for (const root of SCAN_ROOTS) {
    try {
      walk(root, files);
    } catch {
      continue;
    }
  }
  return files;
}

const failures = [];
for (const file of targets(process.argv.slice(2))) {
  const rel = relative(process.cwd(), file);
  if (EXEMPT_PREFIXES.some((prefix) => rel.startsWith(prefix))) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, index) => {
    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      const match = rule.pattern.exec(line);
      if (match) failures.push(`${rel}:${index + 1}: ${rule.name} "${match[0]}"`);
    }
  });
}

if (failures.length > 0) {
  console.error("Colors must come from tokens (bg-surface, text-c-red-text, var(--f-soft)):");
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("check-tokens: no raw colors found");
