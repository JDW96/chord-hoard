// harmony.js — harmonic function classification (backlog item 9): which of
// four buckets a chord belongs to — tonic, subdominant, dominant, or
// borrowed — used to tint chords consistently across the Hoard, Chords and
// Scales tabs.
//
// "Borrowed" wins over the other three: a chord that isn't diatonic to the
// current tonic+mode is borrowed regardless of what function it would
// otherwise serve. This is the SAME diatonic-membership test the Scales tab
// already uses for its "Borrowed chords" section (by pitch classes, never
// by comparing numeral strings) — DIATONIC_NUMERALS is now the one place
// that per-mode list of seven lives (scales-lib.js's MODES sources its
// `numerals` field from here), so the two views can never disagree about
// what counts as borrowed. V in a minor key is the textbook case: it needs
// harmonic minor's raised seventh, which natural minor's own seven diatonic
// chords do not have, so it classifies as borrowed here — exactly how the
// Scales tab already treats it.
//
// For a diatonic chord, function follows the classic three-function system
// by SCALE DEGREE (1-7), independent of mode: I/vi/iii lean tonic, ii/IV are
// subdominant (predominant), V/vii are dominant. iii is genuinely ambiguous
// in the received theory — chord-copy.js's own MAJOR.iii entry says "shares
// two notes with I and two with V... commits to neither" — grouped here as
// tonic, the commoner convention, since it lacks the leading-tone pull that
// defines dominant function.

import { parse } from "./numeral.js";
import { realize } from "./chords.js";

/**
 * The seven diatonic numerals of each mode, measured against the tonic's
 * major scale (the CLAUDE.md numeral contract). Single source of truth —
 * scales-lib.js's MODES table reads its `numerals` field from here.
 */
export const DIATONIC_NUMERALS = {
  major: ["I", "ii", "iii", "IV", "V", "vi", "viidim"],
  minor: ["i", "iidim", "bIII", "iv", "v", "bVI", "bVII"],
  dorian: ["i", "ii", "bIII", "IV", "v", "vidim", "bVII"],
  mixolydian: ["I", "ii", "iiidim", "IV", "v", "vi", "bVII"],
  lydian: ["I", "II", "iii", "#ivdim", "V", "vi", "vii"],
  phrygian: ["i", "bII", "bIII", "iv", "vdim", "bVI", "bvii"],
};

const DEGREE_FUNCTION = {
  1: "tonic",
  2: "subdominant",
  3: "tonic",
  4: "subdominant",
  5: "dominant",
  6: "tonic",
  7: "dominant",
};

/** The pitch classes covered by a mode's own seven diatonic chords, in a given tonic. */
export function scalePitchClasses(tonic, mode) {
  const numerals = DIATONIC_NUMERALS[mode];
  if (!numerals) throw new Error(`Unknown mode "${mode}"`);
  const pcs = new Set();
  for (const n of numerals) {
    for (const pc of realize(n, tonic).pitchClasses) pcs.add(pc);
  }
  return pcs;
}

/** Is a numeral, realised in this tonic+mode, entirely within that mode's scale? */
export function isDiatonic(numeral, tonic, mode) {
  const scale = scalePitchClasses(tonic, mode);
  return realize(numeral, tonic).pitchClasses.every((pc) => scale.has(pc));
}

/**
 * Classify a numeral's harmonic function relative to a tonic and mode.
 * Returns "tonic" | "subdominant" | "dominant" | "borrowed".
 */
export function classify(numeral, tonic, mode) {
  if (!isDiatonic(numeral, tonic, mode)) return "borrowed";
  const { degree } = parse(numeral);
  return DEGREE_FUNCTION[degree];
}
