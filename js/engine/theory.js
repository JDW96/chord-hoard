// theory.js — pitch/letter/spelling primitives for Chord Hoard.
//
// Everything here works in (letter, accidental) space rather than raw semitone
// space, so that spellings come out musically correct (bVI of C is Ab, never
// G#). A "note" throughout the engine is a plain object:
//
//   { letter: "A".."G", accidental: -2..+2 }
//
// where accidental counts sharps (+) or flats (−): Bb = {letter:"B", accidental:-1}.

/** The seven letter names in scale order starting from C. */
export const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];

/** Semitone value of each natural letter (C = 0). */
export const LETTER_SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/**
 * Semitone offsets of the major scale, indexed by degree − 1.
 * Degree:      1  2  3  4  5  6  7
 */
export const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

/** True positive modulo (JavaScript's % can return negatives). */
export function mod(n, m) {
  return ((n % m) + m) % m;
}

/**
 * Parse a note name string ("C", "F#", "Bb", "A♭", "E♯") into a note object.
 * Accepts ASCII b/# and Unicode ♭/♯, up to two accidentals of the same kind.
 * Throws on anything else.
 */
export function parseNote(str) {
  if (typeof str !== "string" || str.length === 0) {
    throw new Error(`Invalid note name: ${JSON.stringify(str)}`);
  }
  const letter = str[0].toUpperCase();
  if (!LETTERS.includes(letter)) {
    throw new Error(`Invalid note letter "${str[0]}" in "${str}"`);
  }
  let accidental = 0;
  const rest = str.slice(1);
  if (/^(b|♭){1,2}$/.test(rest)) accidental = -rest.length;
  else if (/^(#|♯){1,2}$/.test(rest)) accidental = rest.length;
  else if (rest !== "") {
    throw new Error(`Invalid accidental "${rest}" in note "${str}"`);
  }
  return { letter, accidental };
}

/** Pitch class (0–11) of a note object. */
export function pitchClass(note) {
  return mod(LETTER_SEMITONES[note.letter] + note.accidental, 12);
}

/**
 * Spell the note that lies `letterSteps` letters and `semitones` semitones
 * above `base`. This is the heart of correct spelling: the letter distance
 * fixes the target letter, and the accidental is whatever makes the semitone
 * distance come out right.
 *
 * e.g. spellFrom(C, 5, 8) → letter A (C + 5 letters), 8 semitones up = Ab.
 *
 * Throws if the required accidental falls outside −2..+2 (double flat/sharp),
 * which for the supported keys and numeral grammar should never happen.
 */
export function spellFrom(base, letterSteps, semitones) {
  const baseIndex = LETTERS.indexOf(base.letter);
  const letter = LETTERS[mod(baseIndex + letterSteps, 7)];
  // Natural semitone distance from the base letter to the target letter,
  // measured upwards within one octave-per-7-letters framework.
  const naturalDistance = mod(
    LETTER_SEMITONES[letter] - LETTER_SEMITONES[base.letter],
    12
  );
  // How many octaves the letter walk implies (letterSteps may exceed 7 for
  // add9, which reaches a compound 9th — semitone arithmetic stays mod 12).
  const wantedDistance = mod(semitones, 12);
  let accidental = base.accidental + (wantedDistance - naturalDistance);
  // Normalise: wantedDistance − naturalDistance is within ±11; pull the
  // accidental back towards zero by octaves if the subtraction overshot.
  while (accidental > 2) accidental -= 12;
  while (accidental < -2) accidental += 12;
  const check = mod(LETTER_SEMITONES[letter] + accidental, 12);
  const target = mod(pitchClass(base) + semitones, 12);
  if (check !== target || accidental < -2 || accidental > 2) {
    throw new Error(
      `Cannot spell note ${letterSteps} letters / ${semitones} semitones above ` +
        `${formatNote(base)} without triple accidentals`
    );
  }
  return { letter, accidental };
}

/** ASCII formatter: {B,-1} → "Bb", {F,1} → "F#", {C,0} → "C". */
export function formatNote(note) {
  const acc =
    note.accidental < 0 ? "b".repeat(-note.accidental) : "#".repeat(note.accidental);
  return note.letter + acc;
}

/** Display formatter with Unicode accidentals: {B,-1} → "B♭". */
export function formatNoteDisplay(note) {
  const acc =
    note.accidental < 0 ? "♭".repeat(-note.accidental) : "♯".repeat(note.accidental);
  return note.letter + acc;
}
