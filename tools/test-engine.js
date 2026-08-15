#!/usr/bin/env node
// test-engine.js — zero-dependency test runner for the Chord Hoard engine.
// Run: node tools/test-engine.js   (exits 1 on any failure)

import * as theory from "../js/engine/theory.js";
import * as numeral from "../js/engine/numeral.js";
import { realize } from "../js/engine/chords.js";
import * as capo from "../js/engine/capo.js";
import * as complexity from "../js/engine/complexity.js";
import * as progression from "../js/engine/progression.js";
import * as harmony from "../js/engine/harmony.js";

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

function assertEqual(actual, expected, label = "") {
  if (actual !== expected) {
    throw new Error(
      `${label ? label + ": " : ""}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertDeepEqual(actual, expected, label = "") {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${label ? label + ": " : ""}expected ${e}, got ${a}`);
  }
}

function assertThrows(fn, label = "") {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) throw new Error(`${label ? label + ": " : ""}expected a throw, got none`);
}

// ---------------------------------------------------------------- theory.js

test("parseNote handles ASCII and Unicode accidentals", () => {
  assertDeepEqual(theory.parseNote("Bb"), { letter: "B", accidental: -1 });
  assertDeepEqual(theory.parseNote("F♯"), { letter: "F", accidental: 1 });
  assertDeepEqual(theory.parseNote("C"), { letter: "C", accidental: 0 });
});

test("parseNote rejects rubbish", () => {
  assertThrows(() => theory.parseNote("H"), "H");
  assertThrows(() => theory.parseNote("Cb#"), "Cb#");
  assertThrows(() => theory.parseNote(""), "empty");
});

test("pitchClass of enharmonic spellings", () => {
  assertEqual(theory.pitchClass(theory.parseNote("E#")), 5);
  assertEqual(theory.pitchClass(theory.parseNote("Cb")), 11);
  assertEqual(theory.pitchClass(theory.parseNote("Bb")), 10);
});

test("spellFrom spells by letter distance", () => {
  const c = theory.parseNote("C");
  assertEqual(theory.formatNote(theory.spellFrom(c, 5, 8)), "Ab", "m6 above C");
  assertEqual(theory.formatNote(theory.spellFrom(c, 5, 9)), "A", "M6 above C");
  const fs = theory.parseNote("F#");
  assertEqual(theory.formatNote(theory.spellFrom(fs, 2, 4)), "A#", "M3 above F#");
});

test("note formatters (ASCII and display)", () => {
  const bb = theory.parseNote("Bb");
  assertEqual(theory.formatNote(bb), "Bb");
  assertEqual(theory.formatNoteDisplay(bb), "B♭");
  assertEqual(theory.formatNoteDisplay(theory.parseNote("F#")), "F♯");
});

// --------------------------------------------------------------- numeral.js

test("parse plain and accidental degrees", () => {
  assertDeepEqual(numeral.parse("bVI"), {
    accidental: -1, degree: 6, upper: true, suffixes: [], bass: null,
  });
  assertDeepEqual(numeral.parse("#iv"), {
    accidental: 1, degree: 4, upper: false, suffixes: [], bass: null,
  });
  assertDeepEqual(numeral.parse("vii"), {
    accidental: 0, degree: 7, upper: false, suffixes: [], bass: null,
  });
});

test("parse suffixes and bass", () => {
  const p = numeral.parse("V7sus4/5");
  assertDeepEqual(p.suffixes.slice().sort(), ["7", "sus4"]);
  assertEqual(p.bass, 5);
  assertEqual(numeral.parse("ii7").suffixes[0], "7");
  assertEqual(numeral.parse("I5").suffixes[0], "5");
});

test("parse rejects everything outside the grammar", () => {
  for (const bad of ["VIII", "Ib", "isus3", "V7maj7", "IV/8", "H", ""]) {
    assertThrows(() => numeral.parse(bad), JSON.stringify(bad));
  }
});

test("parse rejects illegal combinations and case conventions", () => {
  assertThrows(() => numeral.parse("Isus2sus4"), "two sus");
  assertThrows(() => numeral.parse("V75"), "7 with power chord");
  assertThrows(() => numeral.parse("viidim7"), "dim with 7");
  assertThrows(() => numeral.parse("Isus4maj7"), "sus with maj7");
  assertThrows(() => numeral.parse("Idim"), "dim on uppercase");
  assertThrows(() => numeral.parse("iaug"), "aug on lowercase");
  assertThrows(() => numeral.parse("imaj7"), "maj7 on lowercase");
  assertThrows(() => numeral.parse("I/0"), "bass 0");
  assertThrows(() => numeral.parse("I/"), "empty bass");
  assertThrows(() => numeral.parse("Vi"), "mixed case");
});

test("format canonicalises", () => {
  assertEqual(numeral.format(numeral.parse("V7sus4")), "V7sus4");
  // Suffix order in the source string does not matter; format is canonical.
  assertEqual(numeral.format(numeral.parse("Vsus47")), "V7sus4");
  assertEqual(numeral.format(numeral.parse("bVI")), "bVI");
  assertEqual(numeral.format(numeral.parse("I/3")), "I/3");
  assertEqual(numeral.format(numeral.parse("viidim")), "viidim");
});

test("formatDisplay prettifies", () => {
  assertEqual(numeral.formatDisplay("viidim"), "vii°");
  assertEqual(numeral.formatDisplay("bVI"), "♭VI");
  assertEqual(numeral.formatDisplay("bIIIaug"), "♭III+");
  assertEqual(numeral.formatDisplay("#iv"), "♯iv");
  assertEqual(numeral.formatDisplay("V7sus4"), "V7sus4");
});

// ---------------------------------------------------------------- chords.js

test("realize I in C", () => {
  const c = realize("I", "C");
  assertDeepEqual(c.notes, ["C", "E", "G"]);
  assertDeepEqual(c.pitchClasses, [0, 4, 7]);
  assertEqual(c.symbol, "C");
  assertEqual(c.quality, "major");
  assertEqual(c.bassNote, "C");
});

test("required spelling cases from the spec", () => {
  assertEqual(realize("bVI", "C").symbol, "Ab", "bVI in C (not G#)");
  assertEqual(realize("V", "F#").symbol, "C#", "V in F#");
  assertEqual(realize("bVII", "F#").symbol, "E", "bVII in F#");
  assertEqual(realize("iv", "E").symbol, "Am", "iv in E");
  assertDeepEqual(realize("viidim", "C").notes, ["B", "D", "F"], "viidim in C");
  assertDeepEqual(realize("V7", "Bb").notes, ["F", "A", "C", "Eb"], "V7 in Bb");
  assertEqual(realize("bIII", "Eb").symbol, "Gb", "bIII in Eb");
  assertDeepEqual(realize("Isus4", "D").notes, ["D", "G", "A"], "Isus4 in D");
  assertEqual(realize("vi7", "G").symbol, "Em7", "vi7 in G");
  assertEqual(realize("IVmaj7", "A").symbol, "Dmaj7", "IVmaj7 in A");
});

test("V in C# major spells G#, not Ab", () => {
  // C# is not a supported UI tonic, but the spelling algorithm still holds.
  assertEqual(realize("V", "C#").symbol, "G#");
});

test("slash bass realises diatonically in the tonic major scale", () => {
  const c = realize("I/3", "C");
  assertEqual(c.symbol, "C/E");
  assertEqual(c.bassNote, "E");
  assertEqual(realize("I/5", "G").symbol, "G/D");
  // Bass degrees come from the MAJOR scale even under a minor numeral.
  assertEqual(realize("i/3", "A").bassNote, "C#");
  // Bass equal to the root: no redundant slash.
  assertEqual(realize("I/1", "C").symbol, "C");
});

test("every suffix realises with correct tones and symbol", () => {
  assertDeepEqual(realize("Isus2", "C").notes, ["C", "D", "G"], "sus2");
  assertEqual(realize("Isus2", "C").symbol, "Csus2");
  assertDeepEqual(realize("I5", "G").notes, ["G", "D"], "power");
  assertEqual(realize("I5", "G").symbol, "G5");
  assertDeepEqual(realize("I6", "C").notes, ["C", "E", "G", "A"], "6");
  assertEqual(realize("I6", "C").symbol, "C6");
  assertDeepEqual(realize("vi6", "C").notes, ["A", "C", "E", "F#"], "m6");
  assertEqual(realize("vi6", "C").symbol, "Am6");
  assertDeepEqual(realize("Iadd9", "F").notes, ["F", "A", "C", "G"], "add9");
  assertEqual(realize("Iadd9", "F").symbol, "Fadd9");
  assertEqual(realize("iadd9", "C").symbol, "Cmadd9");
  assertDeepEqual(realize("V7sus4", "C").notes, ["G", "C", "D", "F"], "7sus4");
  assertEqual(realize("V7sus4", "C").symbol, "G7sus4");
  assertDeepEqual(realize("Imaj7", "Db").notes, ["Db", "F", "Ab", "C"], "maj7");
  assertEqual(realize("Imaj7", "Db").symbol, "Dbmaj7");
  assertEqual(realize("ii7", "C").symbol, "Dm7");
  assertDeepEqual(realize("Iaug", "C").notes, ["C", "E", "G#"], "aug");
  assertEqual(realize("Iaug", "C").symbol, "Caug");
  assertEqual(realize("bIIIaug", "A").symbol, "Caug");
  assertEqual(realize("bII", "C").symbol, "Db");
  assertEqual(realize("#iv", "C").symbol, "F#m");
});

test("extreme spellings stay in (letter, accidental) space", () => {
  // bVI in Db is B double-flat by the algorithm — awkward but correct,
  // and its perfect fifth is Fb (not F).
  assertDeepEqual(realize("bVI", "Db").notes, ["Bbb", "Db", "Fb"]);
  // viidim in Db: C Eb Gb — the dim fifth spelled as a fifth.
  assertDeepEqual(realize("viidim", "Db").notes, ["C", "Eb", "Gb"]);
});

test("realize accepts a pre-parsed numeral object", () => {
  const parsed = numeral.parse("V7");
  assertEqual(realize(parsed, "C").symbol, "G7");
});

// ------------------------------------------------------------------ capo.js

const realizeAll = (numerals, tonic) => numerals.map((n) => realize(n, tonic));

test("capo: Bb major suggests a low capo onto open shapes", () => {
  const chords = realizeAll(["I", "IV", "V"], "Bb"); // Bb, Eb, F
  const s = capo.suggest(chords, "Bb", false);
  assertEqual(s === null, false, "should suggest");
  const ok =
    (s.capo === 1 && s.playAs === "A") || (s.capo === 3 && s.playAs === "G");
  assertEqual(ok, true, `got capo ${s.capo} playAs ${s.playAs}`);
});

test("capo: C major needs no capo", () => {
  const chords = realizeAll(["I", "IV", "V", "vi"], "C");
  assertEqual(capo.suggest(chords, "C", false), null);
});

test("capo: Eb major → capo 1, play D shapes", () => {
  const chords = realizeAll(["I", "IV", "V"], "Eb");
  const s = capo.suggest(chords, "Eb", false);
  assertEqual(s.capo, 1);
  assertEqual(s.playAs, "D");
});

test("capo: C minor → capo 3, play Am shapes", () => {
  const chords = realizeAll(["i", "iv", "v"], "C");
  const s = capo.suggest(chords, "C", true);
  assertEqual(s.capo, 3);
  assertEqual(s.playAs, "Am");
});

test("capo: E minor already open → null", () => {
  const chords = realizeAll(["i", "bVI", "bVII"], "E");
  assertEqual(capo.suggest(chords, "E", true), null);
});

// ------------------------------------------------------------ complexity.js

test("complexity: C F G Am in C → P1 / G1", () => {
  const chords = realizeAll(["I", "IV", "V", "vi"], "C");
  assertEqual(complexity.rate(chords, "piano").level, "P1");
  assertEqual(complexity.rate(chords, "guitar").level, "G1");
});

test("complexity: black-key triads Db Gb Ab → P2 piano, G1 guitar", () => {
  const chords = realizeAll(["I", "IV", "V"], "Db");
  assertEqual(complexity.rate(chords, "piano").level, "P2");
  assertEqual(complexity.rate(chords, "guitar").level, "G1"); // CAGED covers these
});

test("complexity: Fadd9 (all tones in C major) stays P1", () => {
  const chords = [realize("bVIIadd9", "G")]; // Fadd9: F A C G, all C-diatonic
  assertEqual(chords[0].symbol, "Fadd9");
  assertEqual(complexity.rate(chords, "piano").level, "P1");
  assertEqual(complexity.rate(chords, "guitar").level, "G1");
});

test("complexity: colour chords outside C-diatonic → P3 / G2", () => {
  const chords = [realize("Imaj7", "Eb")]; // Ebmaj7: Eb G Bb D
  assertEqual(complexity.rate(chords, "piano").level, "P3");
  assertEqual(complexity.rate(chords, "guitar").level, "G2");
});

test("complexity: slash bass → at least P3 / G2", () => {
  const chords = [realize("I/3", "C")]; // C/E
  assertEqual(complexity.rate(chords, "piano").level, "P3");
  assertEqual(complexity.rate(chords, "guitar").level, "G2");
});

test("complexity: Bdim anywhere → P4 / G3", () => {
  const chords = [realize("viidim", "C")];
  assertEqual(complexity.rate(chords, "piano").level, "P4");
  assertEqual(complexity.rate(chords, "guitar").level, "G3");
});

test("complexity: G7sus4 in C is C-diatonic → P1", () => {
  const chords = [realize("V7sus4", "C")];
  assertEqual(complexity.rate(chords, "piano").level, "P1");
});

test("complexity: profile overrides are reported, not recomputed", () => {
  const chords = realizeAll(["I", "viidim"], "C");
  const rated = complexity.rate(chords, "piano", { Bdim: "nope", C: "playable" });
  assertEqual(rated.level, "P4", "nope does not change the computed level");
  assertEqual(rated.perChord[0].override, "playable");
  assertEqual(rated.perChord[1].override, "nope");
  assertEqual(rated.perChord[1].level, "P4");
  const unprofiled = complexity.rate(chords, "piano");
  assertEqual(unprofiled.perChord[0].override, null);
});

// ------------------------------------------------------------ progression.js

const entry = {
  id: "test-01",
  numerals: [
    { numeral: "I", beats: 6 },
    { numeral: "IV", beats: 6 },
    { numeral: "V7", beats: 6 },
    { numeral: "I", beats: 6 },
  ],
  bars: 4,
  timeSig: "6/8",
};

test("progression.render realises in key with beats and display", () => {
  const r = progression.render(entry, "G");
  assertEqual(r.tonic, "G");
  assertEqual(r.chords.length, 4);
  assertDeepEqual(
    r.chords.map((c) => c.symbol),
    ["G", "C", "D7", "G"]
  );
  assertEqual(r.chords[0].beats, 6);
  assertEqual(r.chords[2].display, "V7");
  assertDeepEqual(
    r.distinctChords.map((c) => c.symbol),
    ["G", "C", "D7"] // repeats collapsed
  );
  assertEqual(r.bars, 4);
  assertEqual(r.timeSig, "6/8");
});

test("progression.render validates beats arithmetic", () => {
  const bad = { ...entry, bars: 3 }; // 24 beats but 3 × 6 = 18
  assertThrows(() => progression.render(bad, "C"));
  const bad44 = {
    id: "t",
    numerals: [{ numeral: "I", beats: 4 }, { numeral: "V", beats: 3 }],
    bars: 2,
    timeSig: "4/4",
  };
  assertThrows(() => progression.render(bad44, "C"));
});

test("beatsPerBar reads the numerator", () => {
  assertEqual(progression.beatsPerBar("6/8"), 6);
  assertEqual(progression.beatsPerBar("4/4"), 4);
  assertEqual(progression.beatsPerBar("12/8"), 12);
  assertEqual(progression.beatsPerBar("5/4"), 5);
  assertThrows(() => progression.beatsPerBar("waltz"));
});

test("progression.render works in 12/8 and 3/4", () => {
  const e = {
    id: "t2",
    numerals: [{ numeral: "i", beats: 12 }, { numeral: "bVI", beats: 12 }],
    bars: 2,
    timeSig: "12/8",
  };
  const r = progression.render(e, "A");
  assertDeepEqual(r.chords.map((c) => c.symbol), ["Am", "F"]);
  const w = {
    id: "t3",
    numerals: [{ numeral: "I", beats: 3 }, { numeral: "IV", beats: 3 }],
    bars: 2,
    timeSig: "3/4",
  };
  assertEqual(progression.render(w, "C").chords.length, 2);
});

test("progression.render realises in every supported tonic without throwing", () => {
  const majors = ["C", "G", "D", "A", "E", "B", "F#", "F", "Bb", "Eb", "Ab", "Db"];
  const spicy = {
    id: "t4",
    numerals: [
      { numeral: "I", beats: 4 },
      { numeral: "bVI", beats: 4 },
      { numeral: "bVII", beats: 4 },
      { numeral: "V7sus4", beats: 4 },
    ],
    bars: 4,
    timeSig: "4/4",
  };
  for (const tonic of majors) progression.render(spicy, tonic);
});

// ------------------------------------------------------------------ harmony.js

test("harmony: each mode's own seven diatonic numerals are never borrowed", () => {
  for (const [mode, numerals] of Object.entries(harmony.DIATONIC_NUMERALS)) {
    const tonic = mode === "minor" || mode === "dorian" || mode === "phrygian" ? "A" : "C";
    for (const n of numerals) {
      assertEqual(
        harmony.isDiatonic(n, tonic, mode), true,
        `${n} should be diatonic in ${tonic} ${mode}`
      );
    }
  }
});

test("harmony: classify groups scale degrees into tonic/subdominant/dominant", () => {
  assertEqual(harmony.classify("I", "C", "major"), "tonic");
  assertEqual(harmony.classify("iii", "C", "major"), "tonic");
  assertEqual(harmony.classify("vi", "C", "major"), "tonic");
  assertEqual(harmony.classify("ii", "C", "major"), "subdominant");
  assertEqual(harmony.classify("IV", "C", "major"), "subdominant");
  assertEqual(harmony.classify("V", "C", "major"), "dominant");
  assertEqual(harmony.classify("viidim", "C", "major"), "dominant");
});

test("harmony: chords outside the mode's own seven are borrowed", () => {
  assertEqual(harmony.classify("bVII", "C", "major"), "borrowed");
  assertEqual(harmony.classify("iv", "C", "major"), "borrowed");
  assertEqual(harmony.classify("bVI", "C", "major"), "borrowed");
  assertEqual(harmony.classify("I7", "C", "major"), "borrowed");
});

test("harmony: V in minor is borrowed (needs harmonic minor's raised 7th)", () => {
  assertEqual(harmony.classify("V", "A", "minor"), "borrowed");
  assertEqual(harmony.classify("v", "A", "minor"), "dominant", "natural minor's own v is diatonic");
});

test("harmony: modal cases stay diatonic to their own mode", () => {
  assertEqual(harmony.classify("IV", "D", "dorian"), "subdominant"); // dorian's raised 6th IV
  assertEqual(harmony.classify("bVI", "D", "dorian"), "borrowed"); // borrowed from natural minor
  assertEqual(harmony.classify("bVII", "G", "mixolydian"), "dominant");
  assertEqual(harmony.classify("II", "C", "lydian"), "subdominant"); // lydian's raised 4th-degree II
});

test("harmony: unknown mode throws", () => {
  assertThrows(() => harmony.scalePitchClasses("C", "harmonic-major"));
});

// ------------------------------------------------------------------- report

if (failures.length > 0) {
  console.error(`\n${failures.length} FAILED, ${passed} passed:\n`);
  for (const f of failures) {
    console.error(`  ✗ ${f.name}\n      ${f.message}`);
  }
  process.exit(1);
} else {
  console.log(`All ${passed} tests passed.`);
}
