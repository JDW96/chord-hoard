#!/usr/bin/env node
// serve.js — a static file server for local development.
// Run: node tools/serve.js [port]   then open http://localhost:8080/
//
// The app cannot be opened from the filesystem: ES module imports and fetch()
// are both blocked on file:// URLs, so index.html needs a real HTTP origin.
// localhost counts as a secure context, so the service worker registers here
// exactly as it does on GitHub Pages.
//
// Node standard library only, per the repo rules. No dependencies, no build.

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.argv[2]) || 8080;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".md": "text/plain; charset=utf-8",
};

/**
 * Resolve a request path to a file inside ROOT, or null if it escapes the
 * directory. Directory requests fall through to index.html.
 */
function resolvePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  const target = path.resolve(ROOT, "." + decoded);
  // path.resolve collapses "..", so this catches traversal after the fact.
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) return null;
  return target;
}

const server = createServer(async (req, res) => {
  let target = resolvePath(req.url || "/");
  if (!target) {
    res.writeHead(403, { "content-type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  try {
    let info = await stat(target);
    if (info.isDirectory()) {
      target = path.join(target, "index.html");
      info = await stat(target);
    }

    // No caching at all: the service worker is confusing enough to debug
    // without the browser holding a second stale copy behind it.
    res.writeHead(200, {
      "content-type": TYPES[path.extname(target).toLowerCase()] || "application/octet-stream",
      "content-length": info.size,
      "cache-control": "no-store, max-age=0",
    });
    createReadStream(target).pipe(res);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found: " + req.url);
  }
});

server.listen(PORT, () => {
  console.log(`Chord Hoard serving ${ROOT}`);
  console.log(`  http://localhost:${PORT}/`);
  console.log("Press Ctrl+C to stop.");
});
