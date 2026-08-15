// chord-link.js — the #/chords/<root>/<quality> href for a realised chord.
//
// Split out from chords-lib.js so any view that shows a single chord diagram
// (detail.js's diagram popup, backlog item 4) can link through to the Chords
// tab without creating an import cycle: chords-lib.js reads detail.js's key
// lists (MAJOR_FAMILY_TONICS etc.) at module load time, so anything detail.js
// imports must not, even transitively, import chords-lib.js.

import { shapeKeyFor } from "./diagrams.js";

// Mirrors the `id`s in chords-lib.js's QUALITIES list. Deliberately a plain
// whitelist rather than derived from chords-lib.js itself — that derivation
// is exactly the cycle this file exists to avoid. If chords-lib.js gains or
// renames a quality, update both.
const QUALITY_IDS = new Set([
  "maj", "m", "sus2", "sus4",
  "7", "m7", "maj7", "7sus4",
  "6", "m6", "add9", "madd9",
  "dim", "aug", "5",
]);

/** Library link for any realised chord (engine chords.realize output). */
export function chordHref(realized) {
  const suffix = shapeKeyFor(realized);
  const wanted = suffix === "" ? "maj" : suffix;
  const qualityId = QUALITY_IDS.has(wanted) ? wanted : "maj";
  return "#/chords/" + encodeURIComponent(realized.root) + "/" + encodeURIComponent(qualityId);
}
