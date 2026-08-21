// solo-scales.js — pentatonic and blues scales for soloing (roadmap 0.3).
//
// Deliberately NOT modes: these aren't added to data/vocab.json's modes list
// or to harmony.js's DIATONIC_NUMERALS. They're a separate small concept —
// five notes (or six, for blues) picked for improvising over a progression,
// not a scale a chord progression is built from.
//
// Spelling reuses theory.js's spellFrom(), which fixes a target LETTER by
// letter-distance from a base note and works out whatever accidental makes
// the semitone distance come out right. That one function is doing all the
// real work here — including the blues scale's one legitimately odd case:
// the "blue note" between the 4th and 5th shares its LETTER with the 4th
// (spelled as a raised 4th, e.g. E natural next to Eb in Bb blues) rather
// than being written as a flattened 5th letter (Fb) — the standard notated
// form of the blues scale is 1-b3-4-#4-5-b7, and spellling it that way keeps
// the 4th and the blue note visually adjacent on the same letter, which is
// how real method books write it. Because letterSteps for that note is the
// SAME as the 4th's, spellFrom() produces this automatically: no special
// casing needed, just a repeated letter-step with a different target
// semitone count.

import { parseNote, formatNote, spellFrom, pitchClass, mod } from "./theory.js";
import { render } from "./progression.js";

const MINOR_ISH = new Set(["minor", "dorian", "phrygian"]);

/**
 * Scale definitions: letterSteps (from the tonic, may repeat a step for the
 * blues note) paired with semitones (from the tonic) and a display label per
 * degree. Index-aligned arrays, not objects, so scaleNotes() can zip them.
 */
export const SCALES = {
  majorPentatonic: {
    label: "Major pentatonic",
    letterSteps: [0, 1, 2, 4, 5],
    semitones: [0, 2, 4, 7, 9],
    degreeLabels: ["1", "2", "3", "5", "6"],
  },
  minorPentatonic: {
    label: "Minor pentatonic",
    letterSteps: [0, 2, 3, 4, 6],
    semitones: [0, 3, 5, 7, 10],
    degreeLabels: ["1", "♭3", "4", "5", "♭7"],
  },
  blues: {
    label: "Blues",
    letterSteps: [0, 2, 3, 3, 4, 6],
    semitones: [0, 3, 5, 6, 7, 10],
    degreeLabels: ["1", "♭3", "4", "♭5", "5", "♭7"],
  },
};

/** Ordered list of scale keys, for UI iteration. */
export const SCALE_KEYS = Object.keys(SCALES);

/**
 * The spelled notes of a scale in a given tonic, in ascending order, each
 * paired with its degree label. Throws (via spellFrom) only for a tonic
 * spelling extreme enough to need a triple accidental, which none of the
 * app's 12 locked tonics are.
 */
export function scaleNotes(scaleKey, tonicStr) {
  const scale = SCALES[scaleKey];
  if (!scale) throw new Error(`Unknown solo scale "${scaleKey}"`);
  const tonic = parseNote(tonicStr);
  return scale.letterSteps.map((steps, i) => ({
    note: spellFrom(tonic, steps, scale.semitones[i]),
    degree: scale.degreeLabels[i],
  }));
}

/**
 * The relative tonic (minor for a major-family entry, major for a
 * minor-family one) as a note string, spelled correctly via letter-distance
 * rather than by pitch class alone.
 *
 * This uses the plain natural-minor relative-major relationship (a minor
 * 3rd) for EVERY minor-family mode, not just "minor" itself — dorian and
 * phrygian's own true parent major scales sit elsewhere (a dorian tonic's
 * parent major is a whole step below it, a phrygian tonic's is a major 3rd
 * below). That's not a bug here: dorian, phrygian and natural minor only
 * differ from each other on the 2nd and 6th degrees, which is exactly what
 * a pentatonic scale omits. So "this tonic's minor pentatonic" (built from
 * degrees 1, b3, 4, 5, b7) is diatonically safe in all three modes alike,
 * and "the relative major's major pentatonic" is the SAME five notes by
 * construction — the simple formula below is correct for every minor-ish
 * mode this app supports, not an approximation that happens to work.
 */
function relativeTonic(tonicStr, mode) {
  const tonic = parseNote(tonicStr);
  // Relative minor is a major 6th (9 semitones, 5 letters) above a major
  // tonic; relative major is a minor 3rd (3 semitones, 2 letters) above a
  // minor tonic. Same interval, opposite direction, so this covers both.
  const relative = MINOR_ISH.has(mode) ? spellFrom(tonic, 2, 3) : spellFrom(tonic, 5, 9);
  return formatNote(relative);
}

// ---------------------------------------------------------------------------
// recommend() — computed per entry, never stored.
// ---------------------------------------------------------------------------

const CANDIDATE_KEYS = ["majorPentatonic", "minorPentatonic", "blues"];

/** Every pitch class sounded anywhere in the progression's distinct chords. */
function progressionPitchClasses(rendered) {
  const pcs = new Set();
  for (const chord of rendered.distinctChords) {
    for (const pc of chord.pitchClasses) pcs.add(pc);
  }
  return pcs;
}

/**
 * Score a candidate scale against a rendered progression: how much of the
 * progression's harmony it covers, minus a penalty for scale notes that sit
 * a semitone above a chord tone (the clash that actually stings when
 * soloing), weighted by how long that chord is held so a passing clash
 * matters less than one under a chord you sit on.
 */
function scoreScale(notes, rendered) {
  const scalePcs = new Set(notes.map((n) => pitchClass(n.note)));

  const progressionPcs = progressionPitchClasses(rendered);
  let covered = 0;
  for (const pc of progressionPcs) if (scalePcs.has(pc)) covered += 1;
  const coverage = progressionPcs.size ? covered / progressionPcs.size : 0;

  let clashWeight = 0;
  let totalWeight = 0;
  for (const chord of rendered.chords) {
    totalWeight += chord.beats;
    for (const pc of chord.pitchClasses) {
      if (scalePcs.has(mod(pc + 1, 12))) clashWeight += chord.beats;
    }
  }
  const clash = totalWeight ? clashWeight / totalWeight : 0;

  return coverage - clash;
}

/**
 * The best-fitting soloing scale for a progression entry, computed fresh
 * from its pitch classes (never stored). Candidates are major/minor
 * pentatonic and blues, rooted at `tonic` (the entry's home key by default —
 * pass the CURRENTLY chosen tonic from a transpose control so the
 * recommendation follows it, the same way capo hints and diagrams do; the
 * relationship between scale-type-fit and the chords is transposition
 * invariant, only the actual note changes) AND at its relative tonic (six
 * candidates total) — a song in a major key is often just as playable with
 * its relative minor pentatonic, and vice versa. Ties favour the
 * tonic-rooted candidate over the relative one, since "the scale that
 * matches the key you're already thinking in" is the more useful default.
 *
 * Returns { scaleKey, tonic, reason, score }. `reason` is "home" (rooted on
 * `tonic`) or "relative" (rooted on its relative major/minor) — deliberately
 * just that one word; the score behind it is a coarse coverage heuristic,
 * not a claim of deeper theory the UI should try to narrate.
 */
export function recommend(entry, tonic = entry.homeKey) {
  const rendered = render(entry, tonic);
  const relative = relativeTonic(tonic, entry.mode);

  let best = null;
  let bestScore = -Infinity;
  for (const scaleKey of CANDIDATE_KEYS) {
    for (const [tonicStr, reason] of [[tonic, "home"], [relative, "relative"]]) {
      const notes = scaleNotes(scaleKey, tonicStr);
      const score = scoreScale(notes, rendered);
      if (score > bestScore) {
        bestScore = score;
        best = { scaleKey, tonic: tonicStr, reason };
      }
    }
  }
  return { ...best, score: bestScore };
}

// ---------------------------------------------------------------------------
// CAGED position cheat sheets (guitar only) — five moveable minor-pentatonic
// box shapes that tile the neck. Major pentatonic and minor pentatonic of
// its relative tonic are the SAME five notes as the SAME box (see
// relativeTonic()'s comment above for why), so one set of shapes serves
// both; there is no separate "major pentatonic box" data.
// ---------------------------------------------------------------------------

// Open-string pitch classes, string 6 (low E) to string 1 (high E).
const OPEN_STRING_PC = { 6: 4, 5: 9, 4: 2, 3: 7, 2: 11, 1: 4 };

/**
 * Absolute fret positions for the 5 CAGED minor-pentatonic boxes, transposed
 * to sound `tonicStr` as the root. `shapesData` is the loaded
 * data/solo-shapes.json (fetched by the UI layer — engine modules never
 * fetch their own data; see util.js's fetchJSON/getGuitarData pattern for
 * the caller side).
 *
 * Each shape's data is pure geometry (which string, which fret OFFSET from
 * a reference fret) — the degree at each position is not stored, it's
 * recomputed here from the string tuning and the shape's declared root, so
 * a transcription error in solo-shapes.json that produces a note outside
 * the minor pentatonic formula throws instead of silently mislabelling a
 * fret. (tools/test-diagrams.js runs this over the real data file as a
 * standing check.)
 *
 * Returns one entry per shape, in data file order (E, D, C, A, G — CAGED
 * sequence, "Box 1" through "Box 5"):
 *   { id, box, referenceFret, notes: [{ string, fret, degree }] }
 */
export function cagedPositions(tonicStr, shapesData) {
  const targetPc = pitchClass(parseNote(tonicStr));
  const minorFormula = SCALES.minorPentatonic;

  return shapesData.shapes.map((shape) => {
    const rootStringPc = OPEN_STRING_PC[shape.root.string];
    // The reference fret (offset 0) that makes this shape's root sound the
    // target tonic. Interval math cancels this out for degree lookup below,
    // it's only needed to place dots at real, playable fret numbers.
    const referenceFret = mod(targetPc - rootStringPc - shape.root.offset, 12);

    const notes = [];
    for (const [stringStr, offsets] of Object.entries(shape.strings)) {
      const string = Number(stringStr);
      const stringPc = OPEN_STRING_PC[string];
      for (const offset of offsets) {
        const interval = mod(stringPc + offset - (rootStringPc + shape.root.offset), 12);
        const degreeIndex = minorFormula.semitones.indexOf(interval);
        if (degreeIndex === -1) {
          throw new Error(
            `solo-shapes.json: shape "${shape.id}" string ${string} offset ${offset} ` +
              `is ${interval} semitones from the root, not a minor pentatonic tone`
          );
        }
        notes.push({ string, fret: referenceFret + offset, degree: minorFormula.degreeLabels[degreeIndex] });
      }
    }
    return { id: shape.id, box: shape.box, referenceFret, notes };
  });
}
