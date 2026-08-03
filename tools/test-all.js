#!/usr/bin/env node
// test-all.js — run every check in order, stop at the first failure.
// Run: node tools/test-all.js
//
// Exists because Windows PowerShell 5.1 has no `&&` operator, so the obvious
// one-liner does not work there. This does the same job on any platform and
// gives a single exit code, which is what a pre-push check wants.
//
// Node standard library only, per the repo rules.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

const CHECKS = [
  ["validate.js", "data: schema, numerals, beats, vocab, dupes, all 12 keys"],
  ["test-engine.js", "engine: theory, numerals, chords, capo, complexity"],
  ["test-copy.js", "copy: chord-copy.js structure and coverage"],
  ["test-diagrams.js", "diagrams: guitar voicings and SVG builders"],
];

let failed = null;

for (const [script, blurb] of CHECKS) {
  console.log(`\n── ${script} — ${blurb}`);
  const result = spawnSync(process.execPath, [path.join(here, script)], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    failed = script;
    break;
  }
}

console.log("");
if (failed) {
  console.error(`FAILED at ${failed}. Nothing after it was run.`);
  process.exit(1);
}
console.log("All checks passed. Safe to commit.");
