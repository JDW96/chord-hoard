#!/usr/bin/env node
// gen-guitar-chords.js — generates data/guitar-chords.json from CAGED shape
// templates. Run: node tools/gen-guitar-chords.js
//
// Zero dependencies, Node standard library only. Every voicing passes a
// correctness gate before anything is written: the sounding pitch classes
// (frets + standard tuning) must equal the chord formula's pitch-class set
// exactly — no missing tones, no extras. Doubled tones and muted strings are
// fine. If any voicing fails, the script throws and refuses to write.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Standard tuning E2 A2 D3 G3 B3 E4 as pitch classes, string 6 (low E) first.
const TUNING = [4, 9, 2, 7, 11, 4];

// Chord formulas: semitones from the root, per CLAUDE.md.
// Power chord = root + perfect fifth only.
const FORMULAS = {
  "": [0, 4, 7],
  m: [0, 3, 7],
  7: [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  "7sus4": [0, 5, 7, 10],
  6: [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  add9: [0, 2, 4, 7], // 14 semitones ≡ 2 mod 12
  madd9: [0, 2, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  5: [0, 7],
};

// Suffix order for stable JSON output.
const SUFFIXES = [
  "", "m", "7", "m7", "maj7", "sus2", "sus4", "7sus4",
  "6", "m6", "add9", "madd9", "dim", "aug", "5",
];

const NOTE_PC = { C: 0, "C#": 1, D: 2, Eb: 3, E: 4, F: 5, "F#": 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };

function mod(n, m) {
  return ((n % m) + m) % m;
}

// ---------------------------------------------------------------------------
// Open shapes — the canonical open chords a guitarist actually plays, curated
// honestly (nothing invented; every one is a standard chart shape that also
// happens to contain the complete formula, which our gate demands).
// Frets are string 6 → string 1; -1 = muted, 0 = open.
//
// Curation notes:
//  * F is the common mini-barre voicing xx3211 (barre across strings 2–1),
//    labelled "mini-barre". The full 133211 barre arrives via the E-shape.
//  * C7 is x32313 (pinky adds the G) rather than the fifth-less x32310,
//    because the gate requires the complete formula.
//  * D7sus4 is x00213 — the open-A fifth fills out the formula that the
//    bare xx0213 grip lacks.
//  * Esus2 has no genuinely open standard voicing, so it is omitted.
//  * Open 6th chords (C6 x32210 etc.) commonly drop the fifth, so only the
//    complete Dm6/Em6 grips make the cut on the minor side; major 6ths come
//    from the movable shapes instead.
const OPEN_SHAPES = [
  // Major triads
  { root: "C", suffix: "", frets: [-1, 3, 2, 0, 1, 0] },
  { root: "A", suffix: "", frets: [-1, 0, 2, 2, 2, 0] },
  { root: "G", suffix: "", frets: [3, 2, 0, 0, 0, 3] },
  { root: "E", suffix: "", frets: [0, 2, 2, 1, 0, 0] },
  { root: "D", suffix: "", frets: [-1, -1, 0, 2, 3, 2] },
  { root: "F", suffix: "", frets: [-1, -1, 3, 2, 1, 1], barre: { fret: 1, from: 2, to: 1 }, label: "mini-barre" },
  // Minor triads
  { root: "A", suffix: "m", frets: [-1, 0, 2, 2, 1, 0] },
  { root: "E", suffix: "m", frets: [0, 2, 2, 0, 0, 0] },
  { root: "D", suffix: "m", frets: [-1, -1, 0, 2, 3, 1] },
  // Dominant 7ths
  { root: "A", suffix: "7", frets: [-1, 0, 2, 0, 2, 0] },
  { root: "B", suffix: "7", frets: [-1, 2, 1, 2, 0, 2] },
  { root: "C", suffix: "7", frets: [-1, 3, 2, 3, 1, 3] },
  { root: "D", suffix: "7", frets: [-1, -1, 0, 2, 1, 2] },
  { root: "E", suffix: "7", frets: [0, 2, 0, 1, 0, 0] },
  { root: "G", suffix: "7", frets: [3, 2, 0, 0, 0, 1] },
  // Minor 7ths
  { root: "A", suffix: "m7", frets: [-1, 0, 2, 0, 1, 0] },
  { root: "D", suffix: "m7", frets: [-1, -1, 0, 2, 1, 1] },
  { root: "E", suffix: "m7", frets: [0, 2, 0, 0, 0, 0] },
  // Major 7ths
  { root: "C", suffix: "maj7", frets: [-1, 3, 2, 0, 0, 0] },
  { root: "A", suffix: "maj7", frets: [-1, 0, 2, 1, 2, 0] },
  { root: "D", suffix: "maj7", frets: [-1, -1, 0, 2, 2, 2] },
  { root: "E", suffix: "maj7", frets: [0, 2, 1, 1, 0, 0] },
  { root: "F", suffix: "maj7", frets: [-1, -1, 3, 2, 1, 0] }, // thumbless, no barre
  // sus2
  { root: "A", suffix: "sus2", frets: [-1, 0, 2, 2, 0, 0] },
  { root: "D", suffix: "sus2", frets: [-1, -1, 0, 2, 3, 0] },
  // sus4
  { root: "A", suffix: "sus4", frets: [-1, 0, 2, 2, 3, 0] },
  { root: "D", suffix: "sus4", frets: [-1, -1, 0, 2, 3, 3] },
  { root: "E", suffix: "sus4", frets: [0, 2, 2, 2, 0, 0] },
  // 7sus4
  { root: "A", suffix: "7sus4", frets: [-1, 0, 2, 0, 3, 0] },
  { root: "D", suffix: "7sus4", frets: [-1, 0, 0, 2, 1, 3] },
  { root: "E", suffix: "7sus4", frets: [0, 2, 0, 2, 0, 0] },
  // add9
  { root: "C", suffix: "add9", frets: [-1, 3, 2, 0, 3, 0] },
  // m6
  { root: "D", suffix: "m6", frets: [-1, -1, 0, 2, 0, 1] },
  { root: "E", suffix: "m6", frets: [0, 2, 2, 0, 2, 0] },
];

// ---------------------------------------------------------------------------
// Movable CAGED templates. `string` is the root string (6 = E-shape,
// 5 = A-shape, 4 = D-shape); `offsets` are frets relative to the root fret r
// (null = muted). `barre`, when present, sits at r + offset covering strings
// from..to and is dropped when it would land on the nut (fret 0).
//
// Honest omissions (no standard movable shape — better fewer voicings than
// invented contortions):
//  * sus2 E-shape (only the A-shape x-r-(r+2)-(r+2)-r-r is standard)
//  * add9 E-shape (the A-shape stretch grip x-r-(r+2)-(r+4)-(r+2)-x is real;
//    nothing comparable exists off the sixth string)
//  * madd9 entirely — no standard movable grip
//  * aug E/A full-barre forms — the four-string D-shape is the one
//    guitarists actually use (aug is symmetric, so it covers every root)
const OPEN_PC_OF_STRING = { 6: 4, 5: 9, 4: 2 };

const MOVABLE_TEMPLATES = [
  // E-shapes (root on string 6)
  { suffix: "", form: "E-shape", string: 6, offsets: [0, 2, 2, 1, 0, 0], barre: { offset: 0, from: 6, to: 1 } },
  { suffix: "m", form: "E-shape", string: 6, offsets: [0, 2, 2, 0, 0, 0], barre: { offset: 0, from: 6, to: 1 } },
  { suffix: "7", form: "E-shape", string: 6, offsets: [0, 2, 0, 1, 0, 0], barre: { offset: 0, from: 6, to: 1 } },
  { suffix: "m7", form: "E-shape", string: 6, offsets: [0, 2, 0, 0, 0, 0], barre: { offset: 0, from: 6, to: 1 } },
  { suffix: "maj7", form: "E-shape", string: 6, offsets: [0, 2, 1, 1, 0, 0], barre: { offset: 0, from: 6, to: 1 } },
  { suffix: "sus4", form: "E-shape", string: 6, offsets: [0, 2, 2, 2, 0, 0], barre: { offset: 0, from: 6, to: 1 } },
  { suffix: "7sus4", form: "E-shape", string: 6, offsets: [0, 2, 0, 2, 0, 0], barre: { offset: 0, from: 6, to: 1 } },
  { suffix: "6", form: "E-shape", string: 6, offsets: [0, 2, 2, 1, 2, 0], barre: { offset: 0, from: 6, to: 1 } },
  { suffix: "m6", form: "E-shape", string: 6, offsets: [0, 2, 2, 0, 2, 0], barre: { offset: 0, from: 6, to: 1 } },
  { suffix: "5", form: "E-shape", string: 6, offsets: [0, 2, 2, null, null, null], barre: null },
  // A-shapes (root on string 5)
  { suffix: "", form: "A-shape", string: 5, offsets: [null, 0, 2, 2, 2, 0], barre: { offset: 0, from: 5, to: 1 } },
  { suffix: "m", form: "A-shape", string: 5, offsets: [null, 0, 2, 2, 1, 0], barre: { offset: 0, from: 5, to: 1 } },
  { suffix: "7", form: "A-shape", string: 5, offsets: [null, 0, 2, 0, 2, 0], barre: { offset: 0, from: 5, to: 1 } },
  { suffix: "m7", form: "A-shape", string: 5, offsets: [null, 0, 2, 0, 1, 0], barre: { offset: 0, from: 5, to: 1 } },
  { suffix: "maj7", form: "A-shape", string: 5, offsets: [null, 0, 2, 1, 2, 0], barre: { offset: 0, from: 5, to: 1 } },
  { suffix: "sus2", form: "A-shape", string: 5, offsets: [null, 0, 2, 2, 0, 0], barre: { offset: 0, from: 5, to: 1 } },
  { suffix: "sus4", form: "A-shape", string: 5, offsets: [null, 0, 2, 2, 3, 0], barre: { offset: 0, from: 5, to: 1 } },
  { suffix: "7sus4", form: "A-shape", string: 5, offsets: [null, 0, 2, 0, 3, 0], barre: { offset: 0, from: 5, to: 1 } },
  { suffix: "6", form: "A-shape", string: 5, offsets: [null, 0, 2, 2, 2, 2], barre: { offset: 2, from: 4, to: 1 } },
  { suffix: "m6", form: "A-shape", string: 5, offsets: [null, 0, 2, 2, 1, 2], barre: null },
  { suffix: "add9", form: "A-shape", string: 5, offsets: [null, 0, 2, 4, 2, null], barre: null },
  { suffix: "dim", form: "A-shape", string: 5, offsets: [null, 0, 1, 2, 1, null], barre: null },
  { suffix: "5", form: "A-shape", string: 5, offsets: [null, 0, 2, 2, null, null], barre: null },
  // D-shapes (root on string 4)
  { suffix: "dim", form: "D-shape", string: 4, offsets: [null, null, 0, 1, 3, 1], barre: null },
  { suffix: "aug", form: "D-shape", string: 4, offsets: [null, null, 0, 3, 3, 2], barre: null },
];

// ---------------------------------------------------------------------------
// The correctness gate: sounding pitch classes must equal the formula set.

function soundingPitchClasses(frets) {
  const pcs = new Set();
  frets.forEach((f, i) => {
    if (f >= 0) pcs.add(mod(TUNING[i] + f, 12));
  });
  return pcs;
}

function assertVoicingCorrect(rootPc, suffix, frets, description) {
  const expected = new Set(FORMULAS[suffix].map((s) => mod(rootPc + s, 12)));
  const actual = soundingPitchClasses(frets);
  const sort = (set) => [...set].sort((a, b) => a - b).join(",");
  if (sort(expected) !== sort(actual)) {
    throw new Error(
      `Correctness gate failed for ${description} (root pc ${rootPc}, ` +
        `suffix "${suffix}", frets ${JSON.stringify(frets)}): ` +
        `expected pcs {${sort(expected)}}, got {${sort(actual)}}`
    );
  }
}

// baseFret: 1 for anything containing an open string (open position);
// otherwise the lowest fretted fret.
function computeBaseFret(frets) {
  if (frets.some((f) => f === 0)) return 1;
  const fretted = frets.filter((f) => f > 0);
  return fretted.length ? Math.min(...fretted) : 1;
}

function buildVoicings() {
  const chords = {};
  for (let pc = 0; pc < 12; pc += 1) chords[String(pc)] = {};

  for (const suffix of SUFFIXES) {
    for (let pc = 0; pc < 12; pc += 1) {
      const candidates = [];

      // Matching open shapes first — they are the easiest.
      for (const shape of OPEN_SHAPES) {
        if (shape.suffix !== suffix || NOTE_PC[shape.root] !== pc) continue;
        assertVoicingCorrect(pc, suffix, shape.frets, `open ${shape.root}${suffix}`);
        candidates.push({
          open: true,
          voicing: {
            frets: shape.frets,
            baseFret: computeBaseFret(shape.frets),
            barre: shape.barre || null,
            label: shape.label || "open",
          },
        });
      }

      // Movable CAGED instances, root fret r on the template's root string.
      for (const t of MOVABLE_TEMPLATES) {
        if (t.suffix !== suffix) continue;
        const r = mod(pc - OPEN_PC_OF_STRING[t.string], 12); // never > 12
        const frets = t.offsets.map((o) => (o === null ? -1 : o + r));
        assertVoicingCorrect(pc, suffix, frets, `${t.form} ${suffix} at fret ${r}`);
        let barre = null;
        if (t.barre && r + t.barre.offset >= 1) {
          barre = { fret: r + t.barre.offset, from: t.barre.from, to: t.barre.to };
        }
        candidates.push({
          open: false,
          voicing: {
            frets,
            baseFret: computeBaseFret(frets),
            barre,
            label: t.form,
          },
        });
      }

      if (candidates.length === 0) continue;

      // Easiest first: opens in curated order, then movables by baseFret.
      candidates.sort((a, b) => {
        if (a.open !== b.open) return a.open ? -1 : 1;
        return a.voicing.baseFret - b.voicing.baseFret;
      });

      // Dedupe (a movable at fret 0 can coincide with an open shape),
      // sanity-check the display window, cap at 4 voicings.
      const seen = new Set();
      const list = [];
      for (const c of candidates) {
        const key = c.voicing.frets.join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        const maxFret = Math.max(...c.voicing.frets);
        if (maxFret > c.voicing.baseFret + 4) {
          throw new Error(
            `Voicing exceeds a five-fret window: ${JSON.stringify(c.voicing)}`
          );
        }
        list.push(c.voicing);
        if (list.length === 4) break;
      }
      if (list.length) chords[String(pc)][suffix] = list;
    }
  }
  return chords;
}

// ---------------------------------------------------------------------------

function main() {
  const chords = buildVoicings();
  const data = { version: 1, tuning: "EADGBE", chords };

  // Summary for the terminal.
  let total = 0;
  const perSuffix = {};
  for (const suffix of SUFFIXES) {
    let count = 0;
    let roots = 0;
    for (let pc = 0; pc < 12; pc += 1) {
      const list = chords[String(pc)][suffix];
      if (list && list.length) {
        count += list.length;
        roots += 1;
      }
    }
    perSuffix[suffix] = { count, roots };
    total += count;
  }

  const here = path.dirname(fileURLToPath(import.meta.url));
  const outPath = path.join(here, "..", "data", "guitar-chords.json");
  writeFileSync(outPath, JSON.stringify(data, null, 2) + "\n");

  console.log(`Wrote ${outPath}`);
  console.log(`Total voicings: ${total} (all passed the correctness gate)`);
  for (const suffix of SUFFIXES) {
    const { count, roots } = perSuffix[suffix];
    const name = suffix === "" ? "(major)" : suffix;
    console.log(`  ${name.padEnd(8)} ${String(count).padStart(3)} voicings across ${roots}/12 roots`);
  }
}

main();
