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
import * as song from "../js/engine/song.js";
import * as soloScales from "../js/engine/solo-scales.js";
import * as audioNotes from "../js/engine/audio-notes.js";
import * as wordBag from "../js/engine/word-bag.js";

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

// -------------------------------------------------------------------- song.js
// Fixture entries, deliberately minimal (no need to satisfy the beats/bars
// arithmetic progression.render() enforces — scoreCandidate/sectionSuggestions
// never realize the chords, only read numerals/mode/homeKey/moods).

const SONG_TONICS_FOR = (entry) =>
  entry.mode === "major"
    ? ["C", "G", "D", "A", "E", "B", "F#", "F", "Bb", "Eb", "Ab", "Db"]
    : ["A", "E", "B", "F#", "C#", "G#", "D", "G", "C", "F", "Bb", "Eb"];

function fixtureEntry(id, overrides) {
  return {
    id,
    name: id,
    mode: "major",
    numerals: [{ numeral: "I", beats: 4 }],
    bars: 1,
    timeSig: "4/4",
    homeKey: "C",
    tempo: "mid",
    moods: [],
    genres: [],
    instrument: "both",
    notes: "",
    songs: [],
    ...overrides,
  };
}

test("song: keyRelation — same, relative (both directions), and unrelated", () => {
  assertEqual(song.keyRelation(fixtureEntry("e", { homeKey: "G", mode: "major" }), "G"), "same");
  // E minor is G major's relative minor.
  assertEqual(song.keyRelation(fixtureEntry("e", { homeKey: "E", mode: "minor" }), "G"), "relative");
  // G major is E minor's relative major (same pair, other direction).
  assertEqual(song.keyRelation(fixtureEntry("e", { homeKey: "G", mode: "major" }), "E"), "relative");
  // D major is G major's dominant, not its relative.
  assertEqual(song.keyRelation(fixtureEntry("e", { homeKey: "D", mode: "major" }), "G"), "none");
});

test("song: scoreCandidate weighs key relation same > relative > none", () => {
  const same = fixtureEntry("s1", { homeKey: "C", mode: "major" });
  const relative = fixtureEntry("s2", { homeKey: "A", mode: "minor" });
  const none = fixtureEntry("s3", { homeKey: "D", mode: "major" });
  const entriesById = new Map();
  const scoreSame = song.scoreCandidate(same, [], "C", entriesById);
  const scoreRelative = song.scoreCandidate(relative, [], "C", entriesById);
  const scoreNone = song.scoreCandidate(none, [], "C", entriesById);
  if (!(scoreSame > scoreRelative && scoreRelative > scoreNone)) {
    throw new Error(`expected same > relative > none, got ${scoreSame} / ${scoreRelative} / ${scoreNone}`);
  }
});

test("song: scoreCandidate rewards shared moods with the chosen sections", () => {
  const verse = fixtureEntry("a", { homeKey: "C", mode: "major", moods: ["hopeful", "gentle"] });
  const entriesById = new Map([["a", verse]]);
  const currentSections = [{ label: "verse", progId: "a", tonicOverride: null }];
  const highMood = fixtureEntry("b1", {
    homeKey: "C",
    mode: "major",
    moods: ["hopeful", "gentle"],
    numerals: [{ numeral: "V", beats: 2 }],
  });
  const noMood = fixtureEntry("b2", {
    homeKey: "C",
    mode: "major",
    moods: [],
    numerals: [{ numeral: "V", beats: 2 }],
  });
  const scoreHigh = song.scoreCandidate(highMood, currentSections, "C", entriesById);
  const scoreLow = song.scoreCandidate(noMood, currentSections, "C", entriesById);
  if (!(scoreHigh > scoreLow)) {
    throw new Error(`expected shared moods to score higher: ${scoreHigh} vs ${scoreLow}`);
  }
});

test("song: sectionSuggestions ranks by score and excludes already-used progIds", () => {
  const verse = fixtureEntry("a", { homeKey: "C", mode: "major", moods: ["hopeful"] });
  const strongCandidate = fixtureEntry("b1", { homeKey: "C", mode: "major", moods: ["hopeful"] });
  const weakCandidate = fixtureEntry("b2", { homeKey: "F#", mode: "major", moods: [] });
  const entries = [verse, strongCandidate, weakCandidate];
  const currentSections = [{ label: "verse", progId: "a", tonicOverride: null }];
  const ranked = song.sectionSuggestions(entries, currentSections, "C");
  assertDeepEqual(
    ranked.map((e) => e.id),
    ["b1", "b2"],
    "used progId excluded, stronger candidate first"
  );
});

test("song: sectionTonic uses the override when given, else re-spells the song tonic onto the entry's family", () => {
  const majorEntry = fixtureEntry("m", { homeKey: "C", mode: "major" });
  const minorEntry = fixtureEntry("n", { homeKey: "A", mode: "minor" });
  const songObj = { id: "s", name: "Test", tonic: "Db", sections: [] };
  assertEqual(
    song.sectionTonic(songObj, majorEntry, { tonicOverride: "G" }, SONG_TONICS_FOR),
    "G",
    "explicit override wins"
  );
  assertEqual(
    song.sectionTonic(songObj, majorEntry, { tonicOverride: null }, SONG_TONICS_FOR),
    "Db",
    "major-family entry keeps the song tonic's own spelling"
  );
  const songInDb = { id: "s2", name: "Test", tonic: "Db", sections: [] };
  assertEqual(
    song.sectionTonic(songInDb, minorEntry, { tonicOverride: null }, SONG_TONICS_FOR),
    "C#",
    "minor-family entry re-spells Db's pitch class as C# (its own family's spelling)"
  );
});

test("song: renderSong tolerates a missing progId instead of throwing", () => {
  const verse = fixtureEntry("a", {
    homeKey: "C",
    mode: "major",
    numerals: [
      { numeral: "I", beats: 4 },
      { numeral: "IV", beats: 4 },
      { numeral: "V", beats: 4 },
      { numeral: "I", beats: 4 },
    ],
    bars: 4,
    timeSig: "4/4",
  });
  const entriesById = new Map([["a", verse]]);
  const songObj = {
    id: "song-1",
    name: "Test song",
    tonic: "C",
    sections: [
      { label: "verse", progId: "a", tonicOverride: null },
      { label: "chorus", progId: "deleted-built-id", tonicOverride: null },
    ],
  };
  const rendered = song.renderSong(songObj, entriesById, SONG_TONICS_FOR);
  assertEqual(rendered.length, 2);
  assertEqual(rendered[0].missing, false);
  assertEqual(rendered[0].entry.id, "a");
  assertEqual(rendered[0].tonic, "C");
  assertEqual(rendered[0].rendered.chords.length, 4);
  assertEqual(rendered[1].missing, true);
  assertEqual(rendered[1].section.progId, "deleted-built-id");
});

// ------------------------------------------------------------- solo-scales.js

test("solo-scales: Bb blues spells the blue note as a raised 4th (E), not a flat 5th (Fb)", () => {
  const notes = soloScales.scaleNotes("blues", "Bb").map((n) => theory.formatNote(n.note));
  assertDeepEqual(notes, ["Bb", "Db", "Eb", "E", "F", "Ab"]);
  // The 4th and the blue note share a letter — the "two notes on one letter" case.
  assertEqual(notes[2][0], "E");
  assertEqual(notes[3][0], "E");
});

test("solo-scales: F# minor pentatonic spells cleanly (no double accidentals)", () => {
  const notes = soloScales.scaleNotes("minorPentatonic", "F#").map((n) => theory.formatNote(n.note));
  assertDeepEqual(notes, ["F#", "A", "B", "C#", "E"]);
});

test("solo-scales: major pentatonic omits the 4th and 7th degrees", () => {
  const notes = soloScales.scaleNotes("majorPentatonic", "C").map((n) => theory.formatNote(n.note));
  assertDeepEqual(notes, ["C", "D", "E", "G", "A"]);
});

test("solo-scales: every scale realises for every supported tonic on both mode families", () => {
  const tonics = [
    "C", "G", "D", "A", "E", "B", "F#", "F", "Bb", "Eb", "Ab", "Db", // major-family
    "A", "E", "B", "F#", "C#", "G#", "D", "G", "C", "F", "Bb", "Eb", // minor-family
  ];
  for (const t of tonics) {
    for (const key of soloScales.SCALE_KEYS) {
      soloScales.scaleNotes(key, t); // throws on a bad spelling
    }
  }
});

test("solo-scales: recommend() picks the obviously-correct scale for a pentatonic-only progression", () => {
  const entry = {
    id: "ctrl", name: "ctrl", mode: "major",
    numerals: [{ numeral: "I", beats: 4 }, { numeral: "vi", beats: 4 }],
    bars: 2, timeSig: "4/4", homeKey: "C", tempo: "mid",
    moods: [], genres: [], instrument: "both", notes: "", songs: [],
  };
  // I-vi in C only ever sounds C, E, G, A — all five degrees of C major
  // pentatonic cover it with zero clashes, so this should win outright over
  // its exact tie-in-notes relative (A minor pentatonic, same pitch classes)
  // by the "prefer home" tie-break, and over every other candidate on score.
  const rec = soloScales.recommend(entry);
  assertEqual(rec.scaleKey, "majorPentatonic");
  assertEqual(rec.tonic, "C");
  assertEqual(rec.reason, "home");
  assertEqual(rec.score, 1);
});

test("solo-scales: recommend() doesn't throw on a modal entry", () => {
  const entry = {
    id: "dorian-fix", name: "dorian-fix", mode: "dorian",
    numerals: [
      { numeral: "i", beats: 4 },
      { numeral: "IV", beats: 4 },
      { numeral: "bVII", beats: 4 },
      { numeral: "i", beats: 4 },
    ],
    bars: 4, timeSig: "4/4", homeKey: "D", tempo: "mid",
    moods: [], genres: [], instrument: "both", notes: "", songs: [],
  };
  const rec = soloScales.recommend(entry);
  if (!soloScales.SCALE_KEYS.includes(rec.scaleKey)) throw new Error(`unexpected scaleKey ${rec.scaleKey}`);
  if (rec.reason !== "home" && rec.reason !== "relative") throw new Error(`unexpected reason ${rec.reason}`);
  if (!Number.isFinite(rec.score)) throw new Error(`non-finite score ${rec.score}`);
});

test("solo-scales: recommend() doesn't throw on a heavily borrowed (chromatic mediant) entry", () => {
  const entry = {
    id: "borrowed-fix", name: "borrowed-fix", mode: "major",
    numerals: [
      { numeral: "I", beats: 4 },
      { numeral: "bIII", beats: 4 },
      { numeral: "bVI", beats: 4 },
      { numeral: "I", beats: 4 },
    ],
    bars: 4, timeSig: "4/4", homeKey: "C", tempo: "mid",
    moods: [], genres: [], instrument: "both", notes: "", songs: [],
  };
  const rec = soloScales.recommend(entry);
  if (!soloScales.SCALE_KEYS.includes(rec.scaleKey)) throw new Error(`unexpected scaleKey ${rec.scaleKey}`);
  if (rec.reason !== "home" && rec.reason !== "relative") throw new Error(`unexpected reason ${rec.reason}`);
  if (!Number.isFinite(rec.score)) throw new Error(`non-finite score ${rec.score}`);
});

// --------------------------------------------------------------- audio-notes.js

test("audio-notes: frequencyOf matches known reference pitches", () => {
  const close = (a, b) => Math.abs(a - b) < 0.01;
  if (!close(audioNotes.frequencyOf("A", 4), 440)) throw new Error("A4 should be 440Hz");
  if (!close(audioNotes.frequencyOf("C", 4), 261.6255653)) throw new Error("C4 should be ~261.63Hz");
  if (!close(audioNotes.frequencyOf("A", 3), 220)) throw new Error("A3 should be 220Hz");
  if (!close(audioNotes.frequencyOf("A", 5), 880)) throw new Error("A5 should be 880Hz");
});

test("audio-notes: voiceChord stacks root-position tones ascending from tonesOctave", () => {
  const realized = realize("I", "C"); // {root:"C", notes:["C","E","G"], bassNote:"C"}
  const voiced = audioNotes.voiceChord(realized);
  assertEqual(voiced.tones.map((t) => t.note + t.octave).join(","), "C4,E4,G4");
  assertEqual(voiced.bass.note + voiced.bass.octave, "C3");
});

test("audio-notes: voiceChord bumps a lower letter up an octave to stay ascending", () => {
  const realized = realize("V", "C"); // G major: G,B,D — D is below G in pitch class
  const voiced = audioNotes.voiceChord(realized);
  assertEqual(voiced.tones.map((t) => t.note + t.octave).join(","), "G4,B4,D5");
});

test("audio-notes: voiceChord puts a slash bass below the stack, not the triad root", () => {
  const realized = realize("I/3", "C"); // C/E
  const voiced = audioNotes.voiceChord(realized);
  assertEqual(voiced.bass.note + voiced.bass.octave, "E3");
  assertEqual(voiced.tones.map((t) => t.note + t.octave).join(","), "C4,E4,G4");
});

test("audio-notes: bpmForTempo maps the feel field and falls back to mid", () => {
  assertEqual(audioNotes.bpmForTempo("slow"), 72);
  assertEqual(audioNotes.bpmForTempo("fast"), 144);
  assertEqual(audioNotes.bpmForTempo("unknown"), 104);
});

test("audio-notes: buildSchedule lays out chord start times and total length", () => {
  const chords = [{ beats: 4 }, { beats: 2 }, { beats: 2 }];
  const sched = audioNotes.buildSchedule(chords, 60); // 60 BPM → 1 sec per beat
  assertEqual(sched.secPerBeat, 1);
  assertEqual(sched.events[0].startSec, 0);
  assertEqual(sched.events[0].durationSec, 4);
  assertEqual(sched.events[1].startSec, 4);
  assertEqual(sched.events[2].startSec, 6);
  assertEqual(sched.totalSec, 8);
});

test("audio-notes: buildSchedule on a real 6/8 entry from progression.render", () => {
  const jig = {
    id: "sched-fixture",
    numerals: [
      { numeral: "I", beats: 6 },
      { numeral: "IV", beats: 6 },
      { numeral: "V", beats: 6 },
      { numeral: "I", beats: 6 },
    ],
    bars: 4, timeSig: "6/8",
  };
  const rendered = progression.render(jig, "G");
  const sched = audioNotes.buildSchedule(rendered.chords, 120);
  assertEqual(sched.events.length, 4);
  assertEqual(sched.events[3].startSec, sched.secPerBeat * 18);
  assertEqual(sched.totalSec, sched.secPerBeat * 24);
});

// ------------------------------------------------------- word-bag (2.4)

// A counting seed source, so every test below is deterministic — the whole
// point of a seeded PRNG here is that "the shuffle is correct" is a thing a
// test can assert rather than a thing we hope about.
function seedSource(start = 1) {
  let n = start;
  return () => {
    n += 1;
    return n * 2654435761 >>> 0; // Knuth's multiplicative hash, well spread
  };
}

const TINY_TIERS = {
  "1": ["a", "b", "c"],
  "2": ["d", "e", "f"],
  "3": ["g", "h", "i"],
  "4": ["j", "k", "l"],
};
const TINY_SIZES = { "1": 3, "2": 3, "3": 3, "4": 3 };

test("word-bag: mulberry32 is deterministic for a fixed seed", () => {
  const a = wordBag.mulberry32(12345);
  const b = wordBag.mulberry32(12345);
  const runA = [a(), a(), a(), a()];
  const runB = [b(), b(), b(), b()];
  assertDeepEqual(runA, runB, "same seed, same sequence");
  for (const v of runA) {
    if (!(v >= 0 && v < 1)) throw new Error(`out of range: ${v}`);
  }
  const other = wordBag.mulberry32(12346);
  if (other() === runA[0]) throw new Error("different seeds gave the same first value");
});

test("word-bag: shuffleOrder is a real permutation, stable per seed", () => {
  const order = wordBag.shuffleOrder(500, 99);
  assertEqual(order.length, 500);
  assertEqual(new Set(order).size, 500, "every index exactly once");
  assertDeepEqual(order, wordBag.shuffleOrder(500, 99), "same seed, same order");
  const other = wordBag.shuffleOrder(500, 100);
  if (JSON.stringify(order) === JSON.stringify(other)) {
    throw new Error("a different seed gave an identical order");
  }
});

test("word-bag: drawSet takes one word per tier, in tier order", () => {
  const seedFn = seedSource();
  const bags = wordBag.freshBags(1, seedFn);
  const { words } = wordBag.drawSet(bags, TINY_TIERS, seedFn);
  assertEqual(words.length, 4);
  words.forEach((word, i) => {
    const tier = TINY_TIERS[String(i + 1)];
    if (!tier.includes(word)) throw new Error(`word ${i + 1} ("${word}") is not from tier ${i + 1}`);
  });
});

test("word-bag: drawSet does not mutate the bags it was given", () => {
  const seedFn = seedSource();
  const bags = wordBag.freshBags(1, seedFn);
  const before = JSON.stringify(bags);
  wordBag.drawSet(bags, TINY_TIERS, seedFn);
  assertEqual(JSON.stringify(bags), before, "input untouched");
});

test("word-bag: a full pass through a tier repeats nothing", () => {
  // The whole promise of the bag: 500 draws, 500 different words, and only
  // then does anything come round again.
  const tier = Array.from({ length: 500 }, (_, i) => "w" + i);
  const tiers = { "1": tier, "2": tier, "3": tier, "4": tier };
  const sizes = { "1": 500, "2": 500, "3": 500, "4": 500 };
  const seedFn = seedSource(7);
  let state = wordBag.normaliseBags(null, 1, sizes, seedFn);
  const seen = [];
  for (let i = 0; i < 500; i += 1) {
    const { words, next } = wordBag.drawSet(state, tiers, seedFn);
    seen.push(words[0]);
    state = { version: 1, bags: next.bags };
  }
  assertEqual(new Set(seen).size, 500, "500 draws, 500 distinct words");
  // The 501st draw starts a fresh shuffle rather than running off the end.
  const { words } = wordBag.drawSet(state, tiers, seedFn);
  assertEqual(typeof words[0], "string");
  assertEqual(state.bags["1"].cursor, 0, "cursor reset at exhaustion");
});

test("word-bag: the draw order survives a reload (same seed, same walk)", () => {
  const seedFn = seedSource(3);
  let state = wordBag.normaliseBags(null, 1, TINY_SIZES, seedFn);
  const first = wordBag.drawSet(state, TINY_TIERS, seedFn);
  // Round-trip the stored shape through JSON, as localStorage would.
  const reloaded = JSON.parse(JSON.stringify({ version: 1, bags: first.next.bags }));
  const restored = wordBag.normaliseBags(reloaded, 1, TINY_SIZES, seedSource(999));
  const afterReload = wordBag.drawSet(restored, TINY_TIERS, seedSource(999));
  const withoutReload = wordBag.drawSet(
    { version: 1, bags: first.next.bags },
    TINY_TIERS,
    seedSource(1234)
  );
  assertDeepEqual(afterReload.words, withoutReload.words, "a reload doesn't change the walk");
});

test("word-bag: a version bump resets the bags", () => {
  const seedFn = seedSource();
  const bags = wordBag.freshBags(1, seedFn);
  bags.bags["1"].cursor = 2;
  const same = wordBag.normaliseBags(bags, 1, TINY_SIZES, seedFn);
  assertEqual(same.bags["1"].cursor, 2, "same version keeps walking");
  const bumped = wordBag.normaliseBags(bags, 2, TINY_SIZES, seedFn);
  assertEqual(bumped.version, 2);
  assertEqual(bumped.bags["1"].cursor, 0, "a version bump starts over");
});

test("word-bag: malformed or overrun storage is repaired, not trusted", () => {
  const seedFn = seedSource();
  const junk = wordBag.normaliseBags({ version: 1, bags: { "1": "nope" } }, 1, TINY_SIZES, seedFn);
  assertEqual(junk.bags["1"].cursor, 0);
  assertEqual(typeof junk.bags["1"].seed, "number");
  // A cursor past the end of a tier that shrank under it.
  const overrun = wordBag.normaliseBags(
    { version: 1, bags: { "1": { seed: 5, cursor: 99 }, "2": { seed: 6, cursor: 1 } } },
    1,
    TINY_SIZES,
    seedFn
  );
  assertEqual(overrun.bags["1"].cursor, 0, "overrun cursor reset");
  assertEqual(overrun.bags["2"].cursor, 1, "healthy cursor left alone");
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
