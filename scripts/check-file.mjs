import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const payload = JSON.parse(readFileSync(0, "utf8"));
const file = payload?.tool_input?.file_path;
if (!file || !/\.(ts|tsx|mjs|cjs|js|json|css|md)$/.test(file) || file.includes("node_modules")) {
  process.exit(0);
}

const run = (cmd) => execSync(cmd, { stdio: "pipe", encoding: "utf8" });
const problems = [];

try {
  run(`npx prettier --write "${file}"`);
} catch (error) {
  problems.push(`prettier: ${error.stderr || error.stdout}`);
}
if (/\.(ts|tsx|mjs|cjs|js)$/.test(file)) {
  try {
    run(`npx eslint --fix --max-warnings=0 "${file}"`);
  } catch (error) {
    problems.push(`eslint: ${error.stdout || error.stderr}`);
  }
}
if (/\.(tsx?|css)$/.test(file)) {
  try {
    run(`node tools/check-tokens.mjs "${file}"`);
  } catch (error) {
    problems.push(`check-tokens: ${error.stdout || error.stderr}`);
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(2);
}
