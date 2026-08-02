// progression.js — progression-level API: take a data entry, render it in a key.

import { parse, formatDisplay } from "./numeral.js";
import { realize } from "./chords.js";

/** Beats per bar = the numerator of the time signature (6/8 → 6, 4/4 → 4). */
export function beatsPerBar(timeSig) {
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(timeSig);
  if (!m) throw new Error(`Invalid time signature "${timeSig}" (want e.g. "4/4")`);
  const numerator = Number(m[1]);
  if (numerator < 1) throw new Error(`Invalid time signature "${timeSig}"`);
  return numerator;
}

/**
 * Render a progression entry (per the CLAUDE.md schema) in a given tonic.
 * Returns { tonic, chords, distinctChords, bars, timeSig } where each chord is
 * { numeral, display, beats, symbol, root, quality, notes, pitchClasses,
 *   bassNote } and distinctChords lists each unique realised chord once.
 * Throws if the beats don't add up to bars × beats-per-bar.
 */
export function render(entry, tonic) {
  if (!entry || !Array.isArray(entry.numerals) || entry.numerals.length === 0) {
    throw new Error(`Progression "${entry && entry.id}" has no numerals`);
  }
  const perBar = beatsPerBar(entry.timeSig);
  const totalBeats = entry.numerals.reduce((sum, n) => sum + n.beats, 0);
  const expected = entry.bars * perBar;
  if (totalBeats !== expected) {
    throw new Error(
      `Progression "${entry.id}": beats total ${totalBeats} but ` +
        `${entry.bars} bars of ${entry.timeSig} needs ${expected}`
    );
  }

  const chords = entry.numerals.map((item) => {
    const parsed = parse(item.numeral);
    const realized = realize(parsed, tonic);
    return {
      numeral: item.numeral,
      display: formatDisplay(parsed),
      beats: item.beats,
      ...realized,
    };
  });

  // Distinct chords, first occurrence order, keyed by symbol.
  const seen = new Set();
  const distinctChords = [];
  for (const chord of chords) {
    if (!seen.has(chord.symbol)) {
      seen.add(chord.symbol);
      const { numeral, display, beats, ...realized } = chord;
      distinctChords.push(realized);
    }
  }

  return { tonic, chords, distinctChords, bars: entry.bars, timeSig: entry.timeSig };
}
