// test-copy.js — guards js/ui/chord-copy.js.
//
//   node tools/test-copy.js
//
// The copy tables are the only place in the app where prose and music theory
// sit in the same object, so they can rot in two directions at once: a numeral
// the engine cannot parse, or a sentence that breaks the voice rules in
// CLAUDE.md. This checks both, plus the wiring between the tables, the display
// orders and the mode overrides.

import {
  TABLES,
  OVERRIDE_KEYS,
  orderFor,
  copyFor,
  borrowedFor,
  HEAD_COUNT,
} from "../js/ui/chord-copy.js";
import { parse } from "../js/engine/numeral.js";
import { realize } from "../js/engine/chords.js";

const MAJOR_TONICS = ["C", "G", "D", "A", "E", "B", "F#", "F", "Bb", "Eb", "Ab", "Db"];
const MINOR_TONICS = ["A", "E", "B", "F#", "C#", "G#", "D", "G", "C", "F", "Bb", "Eb"];
const MODES = ["major", "minor", "dorian", "mixolydian", "lydian", "phrygian"];

let failures = 0;
let checks = 0;

function check(condition, message) {
  checks++;
  if (!condition) {
    failures++;
    console.error("  FAIL " + message);
  }
}

// ---------------------------------------------------------------------------
// 1. Every numeral in the tables is legal, and realises in all 12 tonics
// ---------------------------------------------------------------------------

for (const [family, table] of Object.entries(TABLES)) {
  const tonics = family === "minor" ? MINOR_TONICS : MAJOR_TONICS;
  for (const numeral of Object.keys(table)) {
    let parsed = true;
    try {
      parse(numeral);
    } catch (err) {
      parsed = false;
      check(false, `${family}.${numeral} does not parse: ${err.message}`);
    }
    if (!parsed) continue;
    for (const tonic of tonics) {
      let ok = true;
      try {
        const realized = realize(numeral, tonic);
        ok = Boolean(realized && realized.symbol && realized.pitchClasses.length);
      } catch (err) {
        ok = false;
        check(false, `${family}.${numeral} throws in ${tonic}: ${err.message}`);
      }
      if (ok) checks++;
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Every entry has all three lines, and they obey the voice rules
// ---------------------------------------------------------------------------

const BANNED = [
  { pattern: /—/, why: "em-dash (CLAUDE.md voice rules)" },
  { pattern: /\bit'?s not\b/i, why: '"it\'s not X, it\'s Y" construction' },
  { pattern: /\bnot [a-z]+, (it|that)'?s\b/i, why: "contradictory-conclusion construction" },
  { pattern: /\s{2,}/, why: "double space" },
  { pattern: /^\s|\s$/, why: "leading or trailing whitespace" },
];

for (const [family, table] of Object.entries(TABLES)) {
  for (const [numeral, entry] of Object.entries(table)) {
    for (const field of ["tension", "theory", "next"]) {
      const text = entry[field];
      check(
        typeof text === "string" && text.length > 0,
        `${family}.${numeral}.${field} is missing`
      );
      if (typeof text !== "string") continue;
      for (const { pattern, why } of BANNED) {
        check(!pattern.test(text), `${family}.${numeral}.${field} contains ${why}: "${text}"`);
      }
    }
    check(
      entry.theory.length <= 200,
      `${family}.${numeral}.theory is ${entry.theory.length} chars, over the 200 budget`
    );
    check(
      entry.tension.length <= 40,
      `${family}.${numeral}.tension is ${entry.tension.length} chars, over the 40 budget`
    );
  }
}

// ---------------------------------------------------------------------------
// 3. Display orders match the tables exactly, both ways
// ---------------------------------------------------------------------------

for (const family of ["major", "minor"]) {
  const order = orderFor(family);
  const keys = Object.keys(TABLES[family]);
  check(
    order.length === keys.length,
    `${family} order has ${order.length} entries, table has ${keys.length}`
  );
  check(new Set(order).size === order.length, `${family} order repeats a numeral`);
  for (const numeral of order) {
    check(keys.includes(numeral), `${family} order lists ${numeral}, which is not in the table`);
  }
  for (const numeral of keys) {
    check(order.includes(numeral), `${family} table holds ${numeral}, which the order omits`);
  }
  check(order.length > HEAD_COUNT, `${family} order should be longer than the ${HEAD_COUNT} shown`);
}

// ---------------------------------------------------------------------------
// 4. Overrides point at numerals that exist, and actually change something
// ---------------------------------------------------------------------------

const MODE_FAMILY = {
  major: "major",
  mixolydian: "major",
  lydian: "major",
  minor: "minor",
  dorian: "minor",
  phrygian: "minor",
};

for (const key of OVERRIDE_KEYS) {
  const [mode, numeral] = key.split("|");
  check(MODES.includes(mode), `override "${key}" names an unknown mode`);
  const family = MODE_FAMILY[mode];
  const base = copyFor(numeral, family);
  check(Boolean(base), `override "${key}" has no base entry in the ${family} table`);
  if (!base) continue;
  const overridden = copyFor(numeral, family, mode);
  check(
    overridden.theory !== base.theory || overridden.next !== base.next,
    `override "${key}" is identical to the base entry`
  );
  check(overridden.tension === base.tension, `override "${key}" should keep the base tension`);
}

// ---------------------------------------------------------------------------
// 5. copyFor is total over the orders, and unknown numerals return null
// ---------------------------------------------------------------------------

for (const mode of MODES) {
  const family = MODE_FAMILY[mode];
  for (const numeral of orderFor(family)) {
    check(Boolean(copyFor(numeral, family, mode)), `copyFor(${numeral}, ${family}, ${mode}) is empty`);
  }
}
check(copyFor("bVvii", "major") === null, "copyFor should return null for an unknown numeral");

// ---------------------------------------------------------------------------
// 6. borrowedFor filters by the callback and keeps display order
// ---------------------------------------------------------------------------

const all = borrowedFor("major", "major", () => false);
check(all.length === orderFor("major").length, "borrowedFor should keep everything when nothing is in scale");
check(all[0] === orderFor("major")[0], "borrowedFor should preserve display order");
check(
  borrowedFor("major", "major", () => true).length === 0,
  "borrowedFor should drop everything when everything is in scale"
);

// ---------------------------------------------------------------------------

if (failures) {
  console.error(`\ntest-copy: ${failures} failure(s) across ${checks} checks`);
  process.exit(1);
}
console.log(`test-copy: ${checks} checks passed`);
