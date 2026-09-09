// Builds preview/assets/icons.js from lucide-static. Usage: node design/build-icons.mjs <lucide-static/icons dir>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const src = process.argv[2];
if (!src) {
  console.error("usage: node design/build-icons.mjs <path to lucide-static/icons>");
  process.exit(1);
}
const list = readFileSync(new URL("./icons.txt", import.meta.url), "utf8")
  .split(/\s+/)
  .filter(Boolean);
const symbols = list
  .map((n) => {
    const svg = readFileSync(join(src, `${n}.svg`), "utf8");
    const inner = svg
      .replace(/^[\s\S]*?<svg[^>]*>/, "")
      .replace(/<\/svg>\s*$/, "")
      .replace(/\s+/g, " ")
      .trim();
    return `<symbol id="i-${n}" viewBox="0 0 24 24">${inner}</symbol>`;
  })
  .join("");
const js = `// Lucide ${list.length} icons (ISC). Injects a sprite into the document; use <svg class="icon"><use href="#i-name"/></svg>
document.addEventListener("DOMContentLoaded",()=>{const s=document.createElement("div");s.setAttribute("style","position:absolute;width:0;height:0;overflow:hidden");s.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${symbols.replace(/'/g, "\\'")}</svg>';document.body.prepend(s);});
window.LF_ICONS=${JSON.stringify(list)};`;
writeFileSync(new URL("./preview/assets/icons.js", import.meta.url), js);
console.log(`icons.js: ${list.length} icons`);
