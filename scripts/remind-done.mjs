import { execSync } from "node:child_process";

const dirty = execSync("git status --porcelain", { encoding: "utf8" }).trim();
if (dirty.length === 0) process.exit(0);

console.error(
  [
    "Uncommitted changes detected. Before reporting this as done:",
    "  1. npm run ci must be green (typecheck, lint, format:check, check-tokens, test, build).",
    "  2. The flow was exercised against the running backend.",
    "  3. The screen matches its design capture in both modes and sizes.",
    "  4. messages/en.json and messages/es.json, README and DECISIONS.md are updated.",
    "  5. One commit per W-nn item, describing only what was actually done.",
  ].join("\n"),
);
process.exit(0);
