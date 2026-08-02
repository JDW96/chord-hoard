// capo.js — capo suggestions for guitar.
//
// Idea: putting a capo at fret n lets you play shapes n semitones below the
// sounding key. We try capos 0–7, transpose the progression's tonic DOWN by
// the capo, and keep candidates whose shape-tonic lands in the open-friendly
// set (C, A, G, E, D major / Am, Em, Dm minor).
//
// Barre heuristic (simple and honest — this is a suggestion, not gospel):
// a shape counts as "open" if its root pitch class is one of the natural
// roots with everyday open shapes — C, D, E, G, A (covering C/Am, D/Dm/D7,
// E/Em/E7, G/G7, A/Am/A7 and friends). Anything else, including F (a small
// barre for most players) and B, counts as one barre. We prefer the capo with
// the fewest barres, breaking ties with the lowest capo position.

import { parseNote, pitchClass, mod } from "./theory.js";

// Open-friendly SHAPE TONICS, by pitch class.
const OPEN_MAJOR_TONICS = { 0: "C", 9: "A", 7: "G", 4: "E", 2: "D" };
const OPEN_MINOR_TONICS = { 9: "Am", 4: "Em", 2: "Dm" };

// Root pitch classes with everyday open chord shapes (see note above).
const OPEN_ROOT_PCS = new Set([0, 2, 4, 7, 9]); // C D E G A

function countBarres(realizedChords, capo) {
  let barres = 0;
  for (const chord of realizedChords) {
    const shapeRootPc = mod(pitchClass(parseNote(chord.root)) - capo, 12);
    if (!OPEN_ROOT_PCS.has(shapeRootPc)) barres += 1;
  }
  return barres;
}

/**
 * Suggest a capo for a progression.
 *
 * @param {Array}  realizedChords  chords from chords.realize()
 * @param {string} tonic           sounding tonic note name, e.g. "Bb"
 * @param {boolean} [isMinorMode]  true for minor-family modes
 * @returns {{capo:number, playAs:string, note:string}|null}
 *          null when capo 0 is already open-friendly (no improvement worth
 *          the clamp) or no capo 0–7 reaches an open-friendly tonic.
 */
export function suggest(realizedChords, tonic, isMinorMode = false) {
  const tonicPc = pitchClass(parseNote(tonic));
  const openTonics = isMinorMode ? OPEN_MINOR_TONICS : OPEN_MAJOR_TONICS;

  // Already in an open-friendly key? Then a capo is not an improvement.
  if (openTonics[tonicPc] !== undefined) return null;

  let best = null;
  for (let capo = 1; capo <= 7; capo++) {
    const shapeTonicPc = mod(tonicPc - capo, 12);
    const playAs = openTonics[shapeTonicPc];
    if (playAs === undefined) continue;
    const barres = countBarres(realizedChords, capo);
    // Fewest barres wins; ties go to the lowest capo (checked in order).
    if (best === null || barres < best.barres) {
      best = { capo, playAs, barres };
    }
  }
  if (best === null) return null;

  return {
    capo: best.capo,
    playAs: best.playAs,
    note: `Capo ${best.capo}: play ${best.playAs} shapes and it sounds in ${tonic}${isMinorMode ? "m" : ""}.`,
  };
}
