// Serves design/preview over http so the pages can be opened from any machine. The files also work from disk.
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("./preview/", import.meta.url));
const PORT = Number(process.env.DESIGN_PORT ?? 3005);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  // The pages load ../../tokens/*.css: everything outside preview/ resolves against the repo root.
  const base = path.startsWith("/tokens/") ? join(ROOT, "../..") : ROOT;
  const file = join(base, normalize(path === "/" ? "/index.html" : path));
  if (!file.startsWith(join(ROOT, "../.."))) {
    res.writeHead(403).end("forbidden");
    return;
  }
  try {
    statSync(file);
  } catch {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(PORT, () => {
  console.log(`design preview: http://localhost:${PORT}/`);
  console.log(`from disk:      file://${ROOT}index.html`);
});
