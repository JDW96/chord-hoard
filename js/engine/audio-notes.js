// audio-notes.js — pure note/frequency and scheduling maths for playback.
//
// No AudioContext here (that lives in js/ui/audio-player.js, the one file
// allowed to own one) — this module only turns realized chords into concrete
// frequencies, and a progression's beats into a timeline, so both are
// unit-testable in plain Node.

import { parseNote, pitchClass, formatNote } from "./theory.js";

// A4 = 440Hz, twelve-tone equal temperament. "Absolute" below means
// pitchClass + octave*12 in scientific pitch notation (C4 = middle C = 48).
const A4_ABSOLUTE = 9 + 4 * 12; // pitch class of A (9) at octave 4

function absoluteOf(note, octave) {
  return pitchClass(note) + octave * 12;
}

function frequencyFromAbsolute(absolute) {
  return 440 * Math.pow(2, (absolute - A4_ABSOLUTE) / 12);
}

/** Frequency in Hz of a note name ("Bb", "F#") at a given scientific octave. */
export function frequencyOf(noteName, octave) {
  return frequencyFromAbsolute(absoluteOf(parseNote(noteName), octave));
}

/**
 * Voice a realized chord (chords.realize output, or progression.render's
 * per-chord objects which carry the same fields) into concrete pitches:
 * the bass note low (around bassOctave, default 3) and the chord tones
 * stacked upward from tonesOctave (default 4) so they never fall below the
 * previous tone — a fixed, predictable window rather than voice-leading
 * against the prior chord, which keeps consecutive chords from leaping
 * wildly without needing to know what came before.
 *
 * Returns { bass: {note, octave, freq}, tones: [{note, octave, freq}, …] }.
 * `tones` follows realized.notes in root-position order (root, 3rd, 5th, …).
 */
export function voiceChord(realized, { bassOctave = 3, tonesOctave = 4 } = {}) {
  const bassParsed = parseNote(realized.bassNote);
  const bassAbsolute = absoluteOf(bassParsed, bassOctave);
  const bass = {
    note: formatNote(bassParsed),
    octave: bassOctave,
    freq: frequencyFromAbsolute(bassAbsolute),
  };

  let prevAbsolute = null;
  const tones = realized.notes.map((noteName) => {
    const note = parseNote(noteName);
    const pc = pitchClass(note);
    let octave = tonesOctave;
    let absolute = pc + octave * 12;
    if (prevAbsolute !== null) {
      while (absolute <= prevAbsolute) {
        octave += 1;
        absolute = pc + octave * 12;
      }
    }
    prevAbsolute = absolute;
    return { note: formatNote(note), octave, freq: frequencyFromAbsolute(absolute) };
  });

  return { bass, tones };
}

/** Default BPM per the data's `tempo` feel field (not a stored BPM). */
export const TEMPO_BPM = { slow: 72, mid: 104, fast: 144 };

/** BPM for an entry's `tempo` field, falling back to the "mid" default. */
export function bpmForTempo(tempo) {
  return TEMPO_BPM[tempo] || TEMPO_BPM.mid;
}

/**
 * Turn a rendered chord list (progression.render(entry, tonic).chords, each
 * carrying `.beats`) into a timeline at the given BPM. A "beat" here is the
 * data's own beat unit (the time signature's numerator count), not
 * necessarily a quarter note — BPM is the click rate of that unit, which is
 * the right model for a reference/metronome player rather than a DAW.
 *
 * Returns { events: [{chord, index, startSec, durationSec}], totalSec,
 * secPerBeat }.
 */
export function buildSchedule(chords, bpm) {
  const secPerBeat = 60 / bpm;
  let t = 0;
  const events = chords.map((chord, index) => {
    const startSec = t;
    const durationSec = chord.beats * secPerBeat;
    t += durationSec;
    return { chord, index, startSec, durationSec };
  });
  return { events, totalSec: t, secPerBeat };
}
