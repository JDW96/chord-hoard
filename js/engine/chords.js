// chords.js — chord realisation: Roman numeral + tonic → named chord + notes.
//
// Spelling follows CLAUDE.md exactly: the numeral's degree fixes the chord-root
// LETTER (tonic letter + degree − 1 steps through A–G), and every chord tone is
// spelled at a fixed letter distance from the root with whatever accidental
// makes the semitone interval match the chord formula.

import { MAJOR_SCALE, parseNote, pitchClass, spellFrom, formatNote } from "./theory.js";
import { parse } from "./numeral.js";

// Chord tone recipes as [letterSteps, semitones] pairs from the root.
// Thirds stack at +2 letters each; sus2/sus4/add9/6 use letter distances
// 1/3/1/5 respectively (add9's 14 semitones = a compound 2nd).
const TRIADS = {
  maj: [[0, 0], [2, 4], [4, 7]],
  min: [[0, 0], [2, 3], [4, 7]],
  dim: [[0, 0], [2, 3], [4, 6]],
  aug: [[0, 0], [2, 4], [4, 8]],
  sus2: [[0, 0], [1, 2], [4, 7]],
  sus4: [[0, 0], [3, 5], [4, 7]],
  power: [[0, 0], [4, 7]],
};

const EXTENSIONS = {
  dom7: [6, 10],
  min7: [6, 10],
  maj7: [6, 11],
  6: [5, 9],
  add9: [1, 14],
};

// Human-readable quality names for the UI ("explain gently").
const QUALITY_NAMES = {
  maj: "major",
  min: "minor",
  dim: "diminished",
  aug: "augmented",
  sus2: "suspended 2nd",
  sus4: "suspended 4th",
  power: "power chord",
  dom7: "dominant 7th",
  min7: "minor 7th",
  maj7: "major 7th",
  "maj+6": "major 6th",
  "min+6": "minor 6th",
  "maj+add9": "added 9th",
  "min+add9": "minor added 9th",
  "sus2+7": "7 suspended 2nd",
  "sus4+7": "7 suspended 4th",
};

/**
 * Realise a numeral (parsed object or string) in a given tonic.
 * Returns { symbol, root, quality, notes, pitchClasses, bassNote }:
 *   symbol       chord symbol, e.g. "Ab", "F#m", "G7sus4", "C/E"
 *   root         root note name (ASCII), e.g. "Ab"
 *   quality      readable quality, e.g. "major", "dominant 7th"
 *   notes        chord tones, correctly spelled, root position (ASCII)
 *   pitchClasses 0–11 integer per note
 *   bassNote     the bass note name — the slash bass if present, else the root
 */
export function realize(parsedOrString, tonic) {
  const parsed =
    typeof parsedOrString === "string" ? parse(parsedOrString) : parsedOrString;
  const tonicNote = parseNote(tonic);

  // Root: letter fixed by degree, accidental fixed by major-scale semitones
  // adjusted by the numeral's b/#.
  const rootNote = spellFrom(
    tonicNote,
    parsed.degree - 1,
    MAJOR_SCALE[parsed.degree - 1] + parsed.accidental
  );

  // Base triad quality.
  let triad = parsed.upper ? "maj" : "min";
  if (parsed.suffixes.includes("dim")) triad = "dim";
  else if (parsed.suffixes.includes("aug")) triad = "aug";
  else if (parsed.suffixes.includes("sus2")) triad = "sus2";
  else if (parsed.suffixes.includes("sus4")) triad = "sus4";
  else if (parsed.suffixes.includes("5")) triad = "power";

  // Extension, if any. A plain "7" is dominant on major-family bases
  // (uppercase, sus) and minor 7th on lowercase (ii7 = m7).
  let extension = null;
  if (parsed.suffixes.includes("7")) extension = parsed.upper ? "dom7" : "min7";
  else if (parsed.suffixes.includes("maj7")) extension = "maj7";
  else if (parsed.suffixes.includes("6")) extension = "6";
  else if (parsed.suffixes.includes("add9")) extension = "add9";

  const recipe = TRIADS[triad].slice();
  if (extension) recipe.push(EXTENSIONS[extension]);

  const toneNotes = recipe.map(([letters, semis]) =>
    spellFrom(rootNote, letters, semis)
  );
  const notes = toneNotes.map(formatNote);
  const pitchClasses = toneNotes.map(pitchClass);

  // Symbol suffix.
  const rootStr = formatNote(rootNote);
  let suffix;
  if (triad === "maj") suffix = "";
  else if (triad === "min") suffix = "m";
  else if (triad === "power") suffix = "5";
  else suffix = triad; // dim, aug, sus2, sus4
  if (extension === "dom7" || extension === "min7") {
    // "m" + "7" → "m7"; sus chords put the 7 first: "G7sus4".
    suffix =
      triad === "sus2" || triad === "sus4" ? "7" + triad : suffix + "7";
  } else if (extension === "maj7") suffix += "maj7";
  else if (extension === "6") suffix += "6";
  else if (extension === "add9") suffix += "add9";

  // Quality description.
  let quality;
  if (!extension) quality = QUALITY_NAMES[triad];
  else if (extension === "dom7" || extension === "min7") {
    quality =
      triad === "sus2" || triad === "sus4"
        ? QUALITY_NAMES[triad + "+7"]
        : QUALITY_NAMES[extension];
  } else if (extension === "maj7") quality = QUALITY_NAMES.maj7;
  else quality = QUALITY_NAMES[triad + "+" + extension];

  // Slash bass: degree n of the TONIC's major scale, spelled diatonically.
  let bassNote = rootStr;
  let symbol = rootStr + suffix;
  if (parsed.bass !== null) {
    const bass = spellFrom(tonicNote, parsed.bass - 1, MAJOR_SCALE[parsed.bass - 1]);
    bassNote = formatNote(bass);
    if (bassNote !== rootStr) symbol += "/" + bassNote;
  }

  return { symbol, root: rootStr, quality, notes, pitchClasses, bassNote };
}
