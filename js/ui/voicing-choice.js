// voicing-choice.js — remembers which guitar voicing the player picked for a
// chord shape (backlog item 14).
//
// Storage is keyed by (root pitch class, shape suffix) — the same lookup
// diagrams.voicingsFor() uses against data/guitar-chords.json — NOT by
// progression or numeral. So picking an easier F once fixes it everywhere
// that chord shape turns up, regardless of which progression or key it came
// from. "chordhoard.voicing" follows the same storageGet/storageSet pattern
// as every other chordhoard.* key, so it is a natural fit for the JSON
// export/import backlog item 14 also calls for, once that lands.

import { shapeKeyFor } from "./diagrams.js";
import { storageGet, storageSet } from "./util.js";

const VOICING_KEY = "chordhoard.voicing";

function shapeId(realized) {
  return realized.pitchClasses[0] + ":" + shapeKeyFor(realized);
}

/** The remembered (or default, 0) voicing index for a realised chord. */
export function chosenVoicingIndex(realized, voicings) {
  if (!voicings || voicings.length < 2) return 0;
  const saved = storageGet(VOICING_KEY, {})[shapeId(realized)];
  return Number.isInteger(saved) && saved >= 0 && saved < voicings.length ? saved : 0;
}

/** Advance to the next voicing (wrapping) and remember the choice. */
export function nextVoicingIndex(realized, voicings, current) {
  if (!voicings || voicings.length < 2) return 0;
  const next = (current + 1) % voicings.length;
  const all = storageGet(VOICING_KEY, {});
  all[shapeId(realized)] = next;
  storageSet(VOICING_KEY, all);
  return next;
}
