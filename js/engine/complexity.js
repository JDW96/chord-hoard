// complexity.js — complexity rating + playability profile overrides.
//
// Level definitions (from CLAUDE.md, encoding Jack's actual ability):
//
// Piano  P1: maj/min triads with white-key roots (natural letter, no
//            accidental), plus colour chords (sus2/sus4/7/maj7/min7 — and by
//            the same "knows it in C" logic, 6/add9) whose chord tones ALL sit
//            within the C major scale.
//        P2: any other plain maj/min triad (black-key roots).
//        P3: colour chords outside C-diatonic; any slash-bass chord.
//        P4: dim, aug.
// Guitar G1: open chords, power chords, any maj/min triad via CAGED, and the
//            same C-diatonic colour chords as P1.
//        G2: colour chords off the open/C-diatonic shapes; slash-bass chords.
//        G3: dim, aug.
//
// A progression's level is its hardest chord. Ratings are per-key by nature:
// the caller realises the chords in a key first, so the same numerals can be
// P1 in C and P3 in Eb.

const C_MAJOR_PCS = new Set([0, 2, 4, 5, 7, 9, 11]);
const PIANO_LEVELS = ["P1", "P2", "P3", "P4"];
const GUITAR_LEVELS = ["G1", "G2", "G3"];

// Quality strings that mean "plain triad" / "no colour to worry about".
const PLAIN_QUALITIES = new Set(["major", "minor", "power chord"]);
const DIM_AUG = new Set(["diminished", "augmented"]);

function levelIndex(chord, instrument) {
  const whiteKeyRoot = chord.root.length === 1; // no b/# in the name
  const allDiatonicToC = chord.pitchClasses.every((pc) => C_MAJOR_PCS.has(pc));
  const hasSlashBass = chord.bassNote !== chord.root;

  let idx; // 0-based into the level ladder
  if (instrument === "piano") {
    if (DIM_AUG.has(chord.quality)) idx = 3;
    else if (PLAIN_QUALITIES.has(chord.quality)) idx = whiteKeyRoot ? 0 : 1;
    else idx = allDiatonicToC ? 0 : 2; // colour chords
    if (hasSlashBass) idx = Math.max(idx, 2); // slash bass is at least P3
  } else if (instrument === "guitar") {
    if (DIM_AUG.has(chord.quality)) idx = 2;
    else if (PLAIN_QUALITIES.has(chord.quality)) idx = 0; // CAGED covers all roots
    else idx = allDiatonicToC ? 0 : 1; // colour chords
    if (hasSlashBass) idx = Math.max(idx, 1); // slash bass is at least G2
  } else {
    throw new Error(`Unknown instrument "${instrument}" (want "piano" or "guitar")`);
  }
  return idx;
}

/**
 * Rate a progression's realised chords for one instrument.
 *
 * @param {Array}  realizedChords  chords from chords.realize()
 * @param {string} instrument      "piano" | "guitar"
 * @param {Object} [profile]       optional map of chord symbol →
 *                                 "playable" | "shaky" | "nope". Overrides are
 *                                 reported per chord; a "nope" does not change
 *                                 the computed level but is flagged so the UI
 *                                 can warn or filter.
 * @returns {{level:string, perChord:Array<{symbol:string, level:string, override:string|null}>}}
 */
export function rate(realizedChords, instrument, profile = {}) {
  const ladder = instrument === "piano" ? PIANO_LEVELS : GUITAR_LEVELS;
  let maxIdx = 0;
  const perChord = realizedChords.map((chord) => {
    const idx = levelIndex(chord, instrument);
    maxIdx = Math.max(maxIdx, idx);
    const override =
      Object.prototype.hasOwnProperty.call(profile, chord.symbol)
        ? profile[chord.symbol]
        : null;
    return { symbol: chord.symbol, level: ladder[idx], override };
  });
  return { level: ladder[maxIdx], perChord };
}
