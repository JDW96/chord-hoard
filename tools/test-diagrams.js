#!/usr/bin/env node
// test-diagrams.js — zero-dependency tests for the diagram layer.
// Run: node tools/test-diagrams.js   (exits 1 on any failure)
//
// Re-validates every voicing shipped in data/guitar-chords.json against the
// chord formulas (the correctness gate, independently re-implemented here so
// a generator bug cannot vouch for itself), checks that the expected classic
// shapes are present, and exercises the SVG builders in js/ui/diagrams.js.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { realize } from "../js/engine/chords.js";
import { cagedPositions } from "../js/engine/solo-scales.js";
import {
  shapeKeyFor,
  voicingsFor,
  guitarChordSVG,
  pianoChordSVG,
  pianoScaleSVG,
  cagedShapeSVG,
} from "../js/ui/diagrams.js";

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (err) {
    failures.push({ name, message: err.message });
  }
}

function assert(cond, label) {
  if (!cond) throw new Error(label || "assertion failed");
}

function assertEqual(actual, expected, label = "") {
  if (actual !== expected) {
    throw new Error(
      `${label ? label + ": " : ""}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

// ------------------------------------------------------------------- set-up

const here = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(
  readFileSync(path.join(here, "..", "data", "guitar-chords.json"), "utf8")
);
const soloShapesData = JSON.parse(
  readFileSync(path.join(here, "..", "data", "solo-shapes.json"), "utf8")
);

// Independent re-implementation of the gate (do not import the generator).
const TUNING = [4, 9, 2, 7, 11, 4]; // string 6 (low E) → string 1
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
  add9: [0, 2, 4, 7],
  madd9: [0, 2, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  5: [0, 7],
};
const mod = (n, m) => ((n % m) + m) % m;
const ROOT_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

function soundingSet(frets) {
  const pcs = new Set();
  frets.forEach((f, i) => {
    if (f >= 0) pcs.add(mod(TUNING[i] + f, 12));
  });
  return [...pcs].sort((a, b) => a - b).join(",");
}

function formulaSet(rootPc, suffix) {
  return FORMULAS[suffix]
    .map((s) => mod(rootPc + s, 12))
    .sort((a, b) => a - b)
    .join(",");
}

function findVoicing(rootPc, suffix, frets) {
  const list = (data.chords[String(rootPc)] || {})[suffix] || [];
  return list.find((v) => JSON.stringify(v.frets) === JSON.stringify(frets)) || null;
}

// -------------------------------------------------- the gate, re-validated

test("shipped data has expected top-level shape", () => {
  assertEqual(data.version, 1, "version");
  assertEqual(data.tuning, "EADGBE", "tuning");
  assert(data.chords && typeof data.chords === "object", "chords object");
});

test("every shipped voicing sounds exactly its chord formula", () => {
  let checked = 0;
  for (const [pcStr, byQuality] of Object.entries(data.chords)) {
    const rootPc = Number(pcStr);
    assert(rootPc >= 0 && rootPc <= 11, `root pc ${pcStr} in range`);
    for (const [suffix, voicings] of Object.entries(byQuality)) {
      assert(suffix in FORMULAS, `known suffix "${suffix}"`);
      assert(voicings.length >= 1 && voicings.length <= 4, "1–4 voicings");
      for (const v of voicings) {
        assertEqual(v.frets.length, 6, "six strings");
        assert(Number.isInteger(v.baseFret) && v.baseFret >= 1, "baseFret >= 1");
        for (const f of v.frets) {
          assert(Number.isInteger(f) && f >= -1, `fret ${f} valid`);
        }
        const maxFret = Math.max(...v.frets);
        assert(maxFret <= v.baseFret + 4, "fits a five-fret window");
        assertEqual(
          soundingSet(v.frets),
          formulaSet(rootPc, suffix),
          `pc ${rootPc} "${suffix}" ${JSON.stringify(v.frets)}`
        );
        if (v.barre) {
          assert(v.barre.fret >= 1, "barre fret >= 1");
          assert(v.barre.from > v.barre.to, "barre from > to");
        }
        checked += 1;
      }
    }
  }
  assert(checked > 200, `checked ${checked} voicings (expected a few hundred)`);
});

// ------------------------------------------------------- expected classics

test("open C major is x32010 in open position", () => {
  const v = findVoicing(0, "", [-1, 3, 2, 0, 1, 0]);
  assert(v, "voicing present");
  assertEqual(v.baseFret, 1, "baseFret");
  assertEqual(v.label, "open", "label");
});

test("open G major is 320003", () => {
  assert(findVoicing(7, "", [3, 2, 0, 0, 0, 3]), "voicing present");
});

test("E-shape F barre is 133211 at baseFret 1 with a full barre", () => {
  const v = findVoicing(5, "", [1, 3, 3, 2, 1, 1]);
  assert(v, "voicing present");
  assertEqual(v.baseFret, 1, "baseFret");
  assert(v.barre && v.barre.fret === 1 && v.barre.from === 6 && v.barre.to === 1, "barre");
});

test("A-shape C# major is x46664 at baseFret 4", () => {
  const v = findVoicing(1, "", [-1, 4, 6, 6, 6, 4]);
  assert(v, "voicing present");
  assertEqual(v.baseFret, 4, "baseFret");
  assert(v.barre && v.barre.fret === 4, "barre at 4");
});

test("open D minor is xx0231", () => {
  assert(findVoicing(2, "m", [-1, -1, 0, 2, 3, 1]), "voicing present");
});

test("C power chord exists as x355xx or 8-10-10-xxx", () => {
  const a = findVoicing(0, "5", [-1, 3, 5, 5, -1, -1]);
  const e = findVoicing(0, "5", [8, 10, 10, -1, -1, -1]);
  assert(a || e, "at least one power-chord shape");
});

// ------------------------------------------------------------- shapeKeyFor

test("shapeKeyFor strips root and slash bass from engine symbols", () => {
  assertEqual(shapeKeyFor(realize("V7", "C")), "7", "V7 in C");
  assertEqual(shapeKeyFor(realize("i", "C")), "m", "i in C");
  assertEqual(shapeKeyFor(realize("bVI", "C")), "", "bVI in C (Ab major)");
  assertEqual(shapeKeyFor(realize("I/3", "C")), "", "I/3 in C (C/E)");
  assertEqual(shapeKeyFor(realize("V7sus4", "G")), "7sus4", "V7sus4 in G");
  assertEqual(shapeKeyFor(realize("Imaj7", "Bb")), "maj7", "Imaj7 in Bb");
  assertEqual(shapeKeyFor(realize("ivadd9", "C")), "madd9", "ivadd9 in C");
  assertEqual(shapeKeyFor(realize("viidim", "C")), "dim", "viidim in C");
  assertEqual(shapeKeyFor(realize("I5", "F#")), "5", "I5 in F#");
});

// ------------------------------------------------------------- voicingsFor

test("voicingsFor finds at least one voicing for every root × core quality", () => {
  const qualities = ["", "m", "7", "m7", "maj7", "sus2", "sus4", "5"];
  for (let pc = 0; pc < 12; pc += 1) {
    const root = ROOT_NAMES[pc];
    for (const suffix of qualities) {
      const realized = { symbol: root + suffix, root, pitchClasses: [pc] };
      const found = voicingsFor(realized, data);
      assert(found.length >= 1, `${root}${suffix || " (major)"}: none found`);
    }
  }
});

test("voicingsFor returns [] when nothing matches, and works via realize", () => {
  assertEqual(voicingsFor(realize("ivadd9", "C"), data).length, 0, "Fmadd9 empty");
  assertEqual(voicingsFor(realize("I", "C"), null).length, 0, "null data");
  assert(voicingsFor(realize("V7", "C"), data).length >= 1, "G7 via realize");
  assert(voicingsFor(realize("I/3", "C"), data).length >= 1, "C/E uses C shapes");
});

// ------------------------------------------------------------- guitar SVGs

test("guitarChordSVG renders open C with markers and dots", () => {
  const v = findVoicing(0, "", [-1, 3, 2, 0, 1, 0]);
  const svg = guitarChordSVG(v, { title: "C" });
  assert(svg.startsWith("<svg"), "starts with <svg");
  assert(svg.endsWith("</svg>"), "ends with </svg>");
  assert(svg.includes('class="mute"'), "muted string marker");
  assert(svg.includes('class="open"'), "open string marker");
  assert(svg.includes('class="dot"'), "dots");
  assert(svg.includes('class="nut"'), "nut drawn at baseFret 1");
  assert(!svg.includes("fr</text>") || !svg.includes(">1fr<"), "no position label at nut");
  assert(svg.includes(">C</text>"), "title text");
});

test("guitarChordSVG shows position label and barre for x46664", () => {
  const v = findVoicing(1, "", [-1, 4, 6, 6, 6, 4]);
  const svg = guitarChordSVG(v);
  assert(svg.includes(">4fr</text>"), "4fr label");
  assert(svg.includes('class="barre"'), "barre bar");
  assert(!svg.includes('class="nut"'), "no nut away from open position");
});

test("guitarChordSVG escapes titles", () => {
  const v = findVoicing(0, "", [-1, 3, 2, 0, 1, 0]);
  const svg = guitarChordSVG(v, { title: 'C <"&> chord' });
  assert(svg.includes("&lt;"), "escaped <");
  assert(svg.includes("&amp;"), "escaped &");
  assert(svg.includes("&quot;"), "escaped \"");
  assert(!svg.includes('<"'), "no raw < in text");
});

test("guitar SVGs are produced for every shipped voicing", () => {
  for (const byQuality of Object.values(data.chords)) {
    for (const voicings of Object.values(byQuality)) {
      for (const v of voicings) {
        const svg = guitarChordSVG(v);
        assert(svg.startsWith("<svg") && svg.endsWith("</svg>"), "well-formed shell");
        assert(!svg.includes("NaN") && !svg.includes("undefined"), "no bad numbers");
      }
    }
  }
});

// -------------------------------------------------------------- piano SVGs

const countMatches = (str, re) => (str.match(re) || []).length;

test("pianoChordSVG presses exactly four keys for Cmaj7, root on C", () => {
  const svg = pianoChordSVG(realize("Imaj7", "C"));
  assert(svg.startsWith("<svg") && svg.endsWith("</svg>"), "well-formed shell");
  assertEqual(countMatches(svg, /\bpressed\b/g), 4, "pressed keys");
  assertEqual(countMatches(svg, /\broot\b/g), 1, "one root key");
  assert(svg.includes(">C</text>"), "C label");
  assert(svg.includes(">B</text>"), "B label");
});

test("pianoChordSVG uses the engine's flat/sharp display spelling", () => {
  const ab = pianoChordSVG(realize("bVI", "C")); // Ab major: Ab C Eb
  assert(ab.includes(">A♭</text>"), "A♭ label");
  assert(ab.includes(">E♭</text>"), "E♭ label");
  const fs = pianoChordSVG(realize("V", "B")); // F# major: F# A# C#
  assert(fs.includes(">F♯</text>"), "F♯ label");
  assert(fs.includes(">A♯</text>"), "A♯ label");
});

test("pianoChordSVG marks a differing slash bass", () => {
  const svg = pianoChordSVG(realize("I/3", "C")); // C/E
  assertEqual(countMatches(svg, /\bbass\b/g), 1, "one bass key");
  assertEqual(countMatches(svg, /\bpressed\b/g), 4, "3 chord tones + bass");
  const plain = pianoChordSVG(realize("I", "C"));
  assertEqual(countMatches(plain, /\bbass\b/g), 0, "no bass class without slash");
});

test("pianoChordSVG keeps every chord on the keyboard (fold-down case)", () => {
  // Badd9 tops out beyond two octaves before folding: B D# F# C#.
  const svg = pianoChordSVG(realize("Iadd9", "B"));
  assertEqual(countMatches(svg, /\bpressed\b/g), 4, "all four tones shown");
  assert(!svg.includes("NaN"), "no bad numbers");
});

test("pianoScaleSVG highlights the scale across both octaves", () => {
  const svg = pianoScaleSVG(["C", "D", "E", "F", "G", "A", "B"]);
  assertEqual(countMatches(svg, /\bpressed\b/g), 14, "7 notes × 2 octaves");
  assertEqual(countMatches(svg, /\broot\b/g), 2, "tonic marked in each octave");
  const gMaj = pianoScaleSVG(["G", "A", "B", "C", "D", "E", "F#"]);
  assert(gMaj.includes(">F♯</text>"), "F♯ label in G major");
});

test("piano SVGs render every distinct chord quality without throwing", () => {
  const numerals = [
    "I", "i", "V7", "ii7", "Imaj7", "Isus2", "Isus4", "V7sus4",
    "I6", "i6", "Iadd9", "iadd9", "viidim", "Iaug", "I5",
  ];
  for (const tonic of ["C", "F#", "Eb", "B"]) {
    for (const n of numerals) {
      const svg = pianoChordSVG(realize(n, tonic));
      assert(svg.startsWith("<svg") && svg.endsWith("</svg>"), `${n} in ${tonic}`);
      assert(!svg.includes("NaN") && !svg.includes("undefined"), "no bad numbers");
    }
  }
});

// --------------------------------------------------------- CAGED box shapes

const MAJOR_FAMILY_TONICS_TEST = ["C", "G", "D", "A", "E", "B", "F#", "F", "Bb", "Eb", "Ab", "Db"];
const MINOR_FAMILY_TONICS_TEST = ["A", "E", "B", "F#", "C#", "G#", "D", "G", "C", "F", "Bb", "Eb"];

test("data/solo-shapes.json has 5 shapes, CAGED order, every note a valid minor pentatonic degree", () => {
  assertEqual(soloShapesData.shapes.length, 5, "five shapes");
  assertEqual(
    soloShapesData.shapes.map((s) => s.id).join(""),
    "EDCAG",
    "CAGED shape order"
  );
  // cagedPositions() throws if any note isn't a minor-pentatonic interval
  // from its shape's declared root — this exercises that check for real.
  const positions = cagedPositions("A", soloShapesData);
  assertEqual(positions.length, 5, "five positions");
  for (const p of positions) {
    assertEqual(p.notes.length, 12, `box ${p.box}: 6 strings x 2 notes`);
    const roots = p.notes.filter((n) => n.degree === "1");
    assert(roots.length >= 1, `box ${p.box} has at least one root`);
  }
});

test("cagedPositions() renders without throwing for every supported tonic, both mode families", () => {
  for (const t of [...MAJOR_FAMILY_TONICS_TEST, ...MINOR_FAMILY_TONICS_TEST]) {
    const positions = cagedPositions(t, soloShapesData);
    assertEqual(positions.length, 5, `${t}: five shapes`);
  }
});

test("cagedPositions() places A minor pentatonic Box 1 (E-shape) at fret 5", () => {
  const box1 = cagedPositions("A", soloShapesData).find((p) => p.id === "E");
  assertEqual(box1.referenceFret, 5, "reference fret");
  const rootOnLowE = box1.notes.find((n) => n.string === 6 && n.degree === "1");
  assertEqual(rootOnLowE.fret, 5, "root on the low E string at fret 5");
});

test("cagedPositions() Box 3 (C-shape) has the known string-2 stretch (frets +1 to +4)", () => {
  const box3 = cagedPositions("A", soloShapesData).find((p) => p.id === "C");
  const string2Frets = box3.notes.filter((n) => n.string === 2).map((n) => n.fret - box3.referenceFret).sort();
  assertEqual(JSON.stringify(string2Frets), JSON.stringify([1, 4]), "3-fret gap, not the usual 2");
});

test("cagedShapeSVG renders a well-formed SVG with root and degree markers", () => {
  const box1 = cagedPositions("A", soloShapesData).find((p) => p.id === "E");
  const svg = cagedShapeSVG(box1, { title: "A minor pentatonic" });
  assert(svg.startsWith("<svg") && svg.endsWith("</svg>"), "well-formed shell");
  assert(!svg.includes("NaN") && !svg.includes("undefined"), "no bad numbers");
  assert(svg.includes('class="solo-dot root"'), "root dot marked");
  assert(svg.includes('class="solo-dot"'), "non-root dot present");
  assert(svg.includes(">5fr<"), "position label");
  assert(svg.includes(">A minor pentatonic</text>"), "title text");
});

test("cagedShapeSVG renders every shape for every supported tonic without throwing", () => {
  for (const t of [...MAJOR_FAMILY_TONICS_TEST, ...MINOR_FAMILY_TONICS_TEST]) {
    for (const position of cagedPositions(t, soloShapesData)) {
      const svg = cagedShapeSVG(position);
      assert(svg.startsWith("<svg") && svg.endsWith("</svg>"), `${t} box ${position.box}`);
      assert(!svg.includes("NaN") && !svg.includes("undefined"), `${t} box ${position.box}: no bad numbers`);
    }
  }
});

// ------------------------------------------------------------------ report

console.log(`diagrams: ${passed} passed, ${failures.length} failed`);
for (const f of failures) {
  console.error(`  FAIL ${f.name}\n       ${f.message}`);
}
process.exit(failures.length ? 1 : 0);
