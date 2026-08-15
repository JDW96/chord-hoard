#!/usr/bin/env node
// validate.js — validates every data/progressions/*.json file against the
// CLAUDE.md schema and rules. Run: node tools/validate.js
// Exits 0 with a summary if clean; exits 1 listing every problem otherwise.
// If data/vocab.json or the progressions directory is missing/empty it warns
// and exits 0 (data is built in parallel and may not exist yet).

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseNumeral, format as formatNumeral } from "../js/engine/numeral.js";
import { render, beatsPerBar } from "../js/engine/progression.js";
import { parseNote } from "../js/engine/theory.js";
import { realize } from "../js/engine/chords.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROG_DIR = join(ROOT, "data", "progressions");
const VOCAB_PATH = join(ROOT, "data", "vocab.json");

// Supported tonics (spelling choices locked — see CLAUDE.md).
const MAJOR_TONICS = ["C", "G", "D", "A", "E", "B", "F#", "F", "Bb", "Eb", "Ab", "Db"];
const MINOR_TONICS = ["A", "E", "B", "F#", "C#", "G#", "D", "G", "C", "F", "Bb", "Eb"];

const MAJOR_FAMILY = new Set(["major", "lydian", "mixolydian"]);
const MINOR_FAMILY = new Set(["minor", "dorian", "phrygian"]);
const MODES = new Set([...MAJOR_FAMILY, ...MINOR_FAMILY]);
const TEMPOS = new Set(["slow", "mid", "fast"]);
const INSTRUMENTS = new Set(["guitar", "piano", "both"]);
const SECTIONS = new Set([
  "intro", "verse", "prechorus", "chorus", "bridge", "outro", "throughout",
]);
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const problems = [];
const warnings = [];

function problem(where, message) {
  problems.push(`${where}: ${message}`);
}

// ---------------------------------------------------------------- load vocab

let moodsVocab = null;
let genresVocab = null;
if (existsSync(VOCAB_PATH)) {
  try {
    const vocab = JSON.parse(readFileSync(VOCAB_PATH, "utf8"));
    // Accept arrays of strings or of objects with an id field.
    const toSet = (arr) =>
      new Set((arr || []).map((v) => (typeof v === "string" ? v : v && v.id)));
    if (Array.isArray(vocab.moods)) moodsVocab = toSet(vocab.moods);
    if (Array.isArray(vocab.genres)) genresVocab = toSet(vocab.genres);
    if (!moodsVocab || !genresVocab) {
      warnings.push(
        "data/vocab.json is missing a moods/genres array — vocab checks skipped"
      );
    }
  } catch (err) {
    problem("data/vocab.json", `unreadable JSON: ${err.message}`);
  }
} else {
  warnings.push("data/vocab.json not found — vocab checks skipped");
}

// --------------------------------------------------------- load progressions

if (!existsSync(PROG_DIR)) {
  console.warn("Warning: data/progressions/ does not exist yet — nothing to validate.");
  process.exit(0);
}
const files = readdirSync(PROG_DIR).filter((f) => f.endsWith(".json")).sort();
if (files.length === 0) {
  console.warn("Warning: data/progressions/ has no *.json files yet — nothing to validate.");
  process.exit(0);
}

// ------------------------------------------------------------------- checks

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function validateEntry(where, entry) {
  // id
  if (!isNonEmptyString(entry.id)) problem(where, "missing/empty id");
  else if (!KEBAB.test(entry.id)) problem(where, `id "${entry.id}" is not kebab-case`);

  if (!isNonEmptyString(entry.name)) problem(where, "missing/empty name");

  // mode — family-dependent checks (homeKey, realisation) need a valid one,
  // but everything else is still checked so one bad field doesn't hide others.
  let tonics = null;
  if (!MODES.has(entry.mode)) {
    problem(where, `mode "${entry.mode}" not one of ${[...MODES].join("/")}`);
  } else {
    tonics = MAJOR_FAMILY.has(entry.mode) ? MAJOR_TONICS : MINOR_TONICS;
  }

  // numerals
  const canonical = [];
  if (!Array.isArray(entry.numerals) || entry.numerals.length === 0) {
    problem(where, "numerals must be a non-empty array");
  } else {
    entry.numerals.forEach((item, i) => {
      if (!item || typeof item !== "object") {
        problem(where, `numerals[${i}] is not an object`);
        return;
      }
      try {
        canonical.push(formatNumeral(parseNumeral(item.numeral)));
      } catch (err) {
        problem(where, `numerals[${i}] "${item.numeral}": ${err.message}`);
      }
      if (!Number.isInteger(item.beats) || item.beats < 1) {
        problem(where, `numerals[${i}].beats must be a positive integer, got ${item.beats}`);
      }
    });
  }

  // bars + timeSig + beats arithmetic
  if (!Number.isInteger(entry.bars) || entry.bars < 2 || entry.bars > 16) {
    problem(where, `bars must be an integer 2–16, got ${entry.bars}`);
  }
  let perBar = null;
  let beatsOk = false;
  try {
    perBar = beatsPerBar(entry.timeSig);
  } catch (err) {
    problem(where, err.message);
  }
  if (perBar !== null && Array.isArray(entry.numerals) && Number.isInteger(entry.bars)) {
    const total = entry.numerals.reduce(
      (sum, n) => sum + (Number.isInteger(n && n.beats) ? n.beats : 0), 0
    );
    if (total !== entry.bars * perBar) {
      problem(
        where,
        `beats total ${total} ≠ ${entry.bars} bars × ${perBar} beats (${entry.timeSig})`
      );
    } else {
      beatsOk = true;
    }
  }

  // homeKey must be a supported tonic for the mode family
  if (tonics && !tonics.includes(entry.homeKey)) {
    problem(
      where,
      `homeKey "${entry.homeKey}" not a supported ${entry.mode}-family tonic (${tonics.join(" ")})`
    );
  }

  // tempo / instrument
  if (!TEMPOS.has(entry.tempo)) problem(where, `tempo "${entry.tempo}" not slow/mid/fast`);
  if (!INSTRUMENTS.has(entry.instrument)) {
    problem(where, `instrument "${entry.instrument}" not guitar/piano/both`);
  }

  // moods / genres
  for (const [field, vocabSet] of [["moods", moodsVocab], ["genres", genresVocab]]) {
    const values = entry[field];
    if (!Array.isArray(values) || values.length === 0) {
      problem(where, `${field} must be a non-empty array`);
    } else if (vocabSet) {
      for (const v of values) {
        if (!vocabSet.has(v)) problem(where, `${field} value "${v}" not in data/vocab.json`);
      }
    }
  }

  // notes
  if (!isNonEmptyString(entry.notes)) problem(where, "missing/empty notes");
  else if (entry.notes.length < 20 || entry.notes.length > 400) {
    problem(where, `notes length ${entry.notes.length} outside 20–400 characters`);
  }

  // songs
  if (!Array.isArray(entry.songs)) {
    problem(where, "songs must be an array (may be empty)");
  } else {
    if (entry.songs.length > 3) problem(where, `songs has ${entry.songs.length} entries (max 3)`);
    entry.songs.forEach((song, i) => {
      if (!song || typeof song !== "object") {
        problem(where, `songs[${i}] is not an object`);
        return;
      }
      if (!isNonEmptyString(song.title)) problem(where, `songs[${i}] missing title`);
      if (!isNonEmptyString(song.artist)) problem(where, `songs[${i}] missing artist`);
      if (!SECTIONS.has(song.section)) {
        problem(where, `songs[${i}] section "${song.section}" not in ${[...SECTIONS].join("/")}`);
      }
      // Key: a note name, optionally with a trailing "m" for minor keys.
      if (!isNonEmptyString(song.key)) {
        problem(where, `songs[${i}] missing key`);
      } else {
        const bare = song.key.endsWith("m") ? song.key.slice(0, -1) : song.key;
        try {
          const note = parseNote(bare);
          if (Math.abs(note.accidental) > 1) throw new Error("double accidental");
        } catch {
          problem(where, `songs[${i}] key "${song.key}" is not a valid note name`);
        }
      }
    });
  }

  // Realise in every supported tonic of the mode family (spelling checks;
  // skipped when the numerals or beats already failed, to avoid double reports).
  if (tonics && beatsOk && Array.isArray(entry.numerals) &&
      canonical.length === entry.numerals.length) {
    for (const tonic of tonics) {
      try {
        render(entry, tonic);
      } catch (err) {
        problem(where, `fails to realise in ${tonic}: ${err.message}`);
        break; // one report per entry is enough
      }
    }
  }

  return canonical;
}

// --------------------------------------------------------------------- main

const seenIds = new Map(); // id → where first seen
const seenShapes = new Map(); // dedupe key → where first seen
let entryCount = 0;

for (const file of files) {
  const path = join(PROG_DIR, file);
  let data;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    problem(`data/progressions/${file}`, `unreadable JSON: ${err.message}`);
    continue;
  }
  // A batch file is an array of entries (also accept {progressions:[…]} or a
  // single entry object, to be forgiving about batch wrappers).
  let entries;
  if (Array.isArray(data)) entries = data;
  else if (data && Array.isArray(data.progressions)) entries = data.progressions;
  else if (data && typeof data === "object" && data.id) entries = [data];
  else {
    problem(`data/progressions/${file}`, "expected an array of progression entries");
    continue;
  }

  entries.forEach((entry, i) => {
    entryCount += 1;
    const where = `data/progressions/${file} [${entry && entry.id ? entry.id : `#${i}`}]`;

    // id uniqueness across all files
    if (entry && isNonEmptyString(entry.id)) {
      if (seenIds.has(entry.id)) {
        problem(where, `duplicate id (first seen in ${seenIds.get(entry.id)})`);
      } else {
        seenIds.set(entry.id, where);
      }
    }

    const canonical = validateEntry(where, entry) || [];

    // Dedupe: same mode + canonical numeral sequence + timeSig is a duplicate.
    if (canonical.length > 0 && MODES.has(entry.mode)) {
      const key = `${entry.mode}|${canonical.join(" ")}|${entry.timeSig}`;
      if (seenShapes.has(key)) {
        problem(where, `duplicate progression shape (same as ${seenShapes.get(key)})`);
      } else {
        seenShapes.set(key, where);
      }
    }
  });
}

// ------------------------------------------------- data/moves.json (builder)
// Every numeral in the suggestion rules must parse and realise in a
// representative key of its family, transitions must be ranked lists of
// degrees 1–7 for all seven degrees, and (because slash-bass digits read
// against the tonic's MAJOR scale) no minor-family rule may use a slash bass.

const MOVES_PATH = join(ROOT, "data", "moves.json");
if (existsSync(MOVES_PATH)) {
  const where = "data/moves.json";
  try {
    const moves = JSON.parse(readFileSync(MOVES_PATH, "utf8"));

    if (!moves.transitions || typeof moves.transitions !== "object") {
      problem(where, "missing transitions object");
    } else {
      for (let d = 1; d <= 7; d += 1) {
        const list = moves.transitions[String(d)];
        if (!Array.isArray(list) || list.length === 0) {
          problem(where, `transitions["${d}"] must be a non-empty array`);
          continue;
        }
        for (const dest of list) {
          if (!Number.isInteger(dest) || dest < 1 || dest > 7) {
            problem(where, `transitions["${d}"] contains "${dest}" (want degrees 1–7)`);
          }
        }
        if (new Set(list).size !== list.length) {
          problem(where, `transitions["${d}"] has duplicate degrees`);
        }
      }
    }

    const checkNumeral = (numeral, family, context) => {
      const testTonic = family === "major" ? "C" : "A";
      try {
        const parsed = parseNumeral(numeral);
        realize(parsed, testTonic);
        if (family === "minor" && parsed.bass !== null) {
          problem(
            where,
            `${context} "${numeral}": slash bass in a minor-family rule (bass digits read against the MAJOR scale)`
          );
        }
      } catch (err) {
        problem(where, `${context} "${numeral}": ${err.message}`);
      }
    };

    for (const family of ["major", "minor"]) {
      const colours = moves.colours && moves.colours[family];
      if (!colours || typeof colours !== "object") {
        problem(where, `missing colours.${family}`);
      } else {
        for (const [degree, list] of Object.entries(colours)) {
          if (!Array.isArray(list)) {
            problem(where, `colours.${family}["${degree}"] must be an array`);
            continue;
          }
          for (const n of list) checkNumeral(n, family, `colours.${family}["${degree}"]`);
        }
      }
      const borrowed = moves.borrowed && moves.borrowed[family];
      if (!Array.isArray(borrowed) || borrowed.length === 0) {
        problem(where, `borrowed.${family} must be a non-empty array`);
      } else {
        for (const n of borrowed) checkNumeral(n, family, `borrowed.${family}`);
      }
    }
  } catch (err) {
    problem(where, `unreadable JSON: ${err.message}`);
  }
} else {
  warnings.push("data/moves.json not found — builder rule checks skipped");
}

for (const w of warnings) console.warn(`Warning: ${w}`);
if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s) in ${entryCount} entries:`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log(
  `OK: ${entryCount} progression entr${entryCount === 1 ? "y" : "ies"} across ${files.length} file(s) validated clean.`
);
