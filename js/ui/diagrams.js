// diagrams.js — guitar chord grids and piano keyboard diagrams as SVG strings.
//
// Pure module: no DOM APIs, every export returns a self-contained
// <svg>…</svg> string. All strokes and fills use currentColor plus CSS
// classes (dot, barre, pressed, root, bass, …) so the app can theme them.
// Music facts come from the engine; nothing musical is reimplemented here
// beyond laying dots on strings and keys.

import { mod, parseNote, pitchClass, formatNoteDisplay } from "../engine/theory.js";

// ---------------------------------------------------------------------------
// Helpers

/** Escape text for safe embedding in SVG/XML. */
function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Display spelling (♭/♯) of an ASCII note name like "Ab" or "F#". */
function displayName(noteName) {
  return formatNoteDisplay(parseNote(noteName));
}

// ---------------------------------------------------------------------------
// Chord-data lookups

/**
 * The shape key for a realised chord: its symbol minus the root and any
 * slash bass — i.e. the suffix used in data/guitar-chords.json.
 * e.g. {symbol:"G7sus4", root:"G"} → "7sus4"; {symbol:"C/E", root:"C"} → "".
 */
export function shapeKeyFor(realized) {
  const slash = realized.symbol.indexOf("/");
  const core = slash === -1 ? realized.symbol : realized.symbol.slice(0, slash);
  return core.slice(realized.root.length);
}

/**
 * Guitar voicings for a realised chord, from loaded guitar-chords.json data.
 * Returns [] when the data holds nothing for this root + quality.
 */
export function voicingsFor(realized, guitarData) {
  if (!guitarData || !guitarData.chords) return [];
  const byRoot = guitarData.chords[String(realized.pitchClasses[0])];
  if (!byRoot) return [];
  return byRoot[shapeKeyFor(realized)] || [];
}

// ---------------------------------------------------------------------------
// Guitar chord grid

const G = {
  stringGap: 14, // horizontal gap between strings
  fretGap: 15, // vertical gap between frets
  rows: 5, // frets shown
  gridX: 15, // left edge of the grid
  gridY: 30, // top edge of the grid (the nut line)
};

/**
 * Classic chord grid for one voicing: vertical strings (low E on the left),
 * five fret rows starting at baseFret, dots for fretted notes, ○ above open
 * strings, × above muted ones, a rounded bar for barres, and a "3fr"-style
 * position label when baseFret > 1. Optional title above the grid.
 */
export function guitarChordSVG(voicing, { title } = {}) {
  const { frets, baseFret, barre } = voicing;
  const { stringGap, fretGap, rows, gridX, gridY } = G;
  const gridW = stringGap * 5;
  const gridH = fretGap * rows;
  const xOfIndex = (i) => gridX + i * stringGap; // i = 0 (low E) … 5 (high E)
  const xOfString = (n) => xOfIndex(6 - n); // n = string number 6…1
  const yOfFret = (f) => gridY + (f - baseFret + 0.5) * fretGap; // dot centre

  const parts = [];

  if (title) {
    parts.push(
      `<text x="50" y="11" text-anchor="middle" font-size="9" ` +
        `fill="currentColor" class="title">${escapeXml(title)}</text>`
    );
  }

  // Fret lines (row 0 is the nut when baseFret is 1).
  for (let row = 0; row <= rows; row += 1) {
    const y = gridY + row * fretGap;
    const nut = row === 0 && baseFret === 1;
    parts.push(
      `<line x1="${gridX}" y1="${y}" x2="${gridX + gridW}" y2="${y}" ` +
        `stroke="currentColor" stroke-width="${nut ? 3 : 1}" ` +
        `class="${nut ? "nut" : "fret"}"/>`
    );
  }

  // Strings.
  for (let i = 0; i < 6; i += 1) {
    parts.push(
      `<line x1="${xOfIndex(i)}" y1="${gridY}" x2="${xOfIndex(i)}" ` +
        `y2="${gridY + gridH}" stroke="currentColor" stroke-width="1" class="string"/>`
    );
  }

  // Position label, e.g. "4fr" beside the first shown fret (left of the
  // grid, clear of any barre's rounded end on the right).
  if (baseFret > 1) {
    parts.push(
      `<text x="${gridX - 4}" y="${yOfFret(baseFret) + 2.5}" ` +
        `text-anchor="end" font-size="7" fill="currentColor" ` +
        `class="fret-label">${baseFret}fr</text>`
    );
  }

  // Barre first, so dots on other frets sit above it visually.
  if (barre) {
    const x1 = xOfString(barre.from) - 5;
    const x2 = xOfString(barre.to) + 5;
    parts.push(
      `<rect x="${x1}" y="${yOfFret(barre.fret) - 4.5}" width="${x2 - x1}" ` +
        `height="9" rx="4.5" fill="currentColor" class="barre"/>`
    );
  }

  // Per-string markers: × muted, ○ open, dot fretted (unless the barre
  // already covers that string at that fret).
  for (let i = 0; i < 6; i += 1) {
    const f = frets[i];
    const n = 6 - i; // string number
    const x = xOfIndex(i);
    if (f === -1) {
      parts.push(
        `<text x="${x}" y="${gridY - 5}" text-anchor="middle" font-size="8" ` +
          `fill="currentColor" class="mute">×</text>`
      );
    } else if (f === 0) {
      parts.push(
        `<circle cx="${x}" cy="${gridY - 8}" r="3" fill="none" ` +
          `stroke="currentColor" stroke-width="1.2" class="open"/>`
      );
    } else {
      const coveredByBarre =
        barre && f === barre.fret && n <= barre.from && n >= barre.to;
      if (!coveredByBarre) {
        parts.push(
          `<circle cx="${x}" cy="${yOfFret(f)}" r="4.5" fill="currentColor" class="dot"/>`
        );
      }
    }
  }

  const label = title ? escapeXml(title) : "guitar chord diagram";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" ` +
    `class="chord-diagram chord-diagram--guitar" role="img" ` +
    `aria-label="${label}">${parts.join("")}</svg>`
  );
}

// ---------------------------------------------------------------------------
// Piano keyboard

const P = {
  whiteW: 12,
  whiteH: 56,
  blackW: 7,
  blackH: 34,
  x0: 1,
  y0: 1,
};

const WHITE_INDEX = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };
// A black key sits astride this white-key boundary within its octave.
const BLACK_BOUNDARY = { 1: 1, 3: 2, 6: 4, 8: 5, 10: 6 };

function keyCentreX(semitone) {
  const { whiteW, x0 } = P;
  const octave = Math.floor(semitone / 12);
  const pc = mod(semitone, 12);
  const octaveX = x0 + octave * 7 * whiteW;
  if (pc in WHITE_INDEX) return octaveX + (WHITE_INDEX[pc] + 0.5) * whiteW;
  return octaveX + BLACK_BOUNDARY[pc] * whiteW;
}

/**
 * Render a C-to-B keyboard spanning `octaves` octaves. `marks` maps a
 * semitone index (0 = lowest C) to { classes: [...], label: string|null }.
 */
function keyboardSVG(octaves, marks, ariaLabel) {
  const { whiteW, whiteH, blackW, blackH, x0, y0 } = P;
  const width = octaves * 7 * whiteW + 2 * x0;
  const labelY = y0 + whiteH + 10;
  const height = labelY + 7;
  const total = octaves * 12;
  const parts = [];

  // White keys first, black keys on top of them.
  for (let s = 0; s < total; s += 1) {
    const pc = mod(s, 12);
    if (!(pc in WHITE_INDEX)) continue;
    const octave = Math.floor(s / 12);
    const x = x0 + (octave * 7 + WHITE_INDEX[pc]) * whiteW;
    const mark = marks.get(s);
    const classes = ["key", "white", ...(mark ? mark.classes : [])];
    const fill = mark ? `fill="currentColor" fill-opacity="0.35"` : `fill="none"`;
    parts.push(
      `<rect x="${x}" y="${y0}" width="${whiteW}" height="${whiteH}" ` +
        `${fill} stroke="currentColor" stroke-width="1" class="${classes.join(" ")}"/>`
    );
  }
  for (let s = 0; s < total; s += 1) {
    const pc = mod(s, 12);
    if (!(pc in BLACK_BOUNDARY)) continue;
    const x = keyCentreX(s) - blackW / 2;
    const mark = marks.get(s);
    const classes = ["key", "black", ...(mark ? mark.classes : [])];
    const opacity = mark ? `fill-opacity="0.55" ` : ``;
    parts.push(
      `<rect x="${x}" y="${y0}" width="${blackW}" height="${blackH}" ` +
        `fill="currentColor" ${opacity}stroke="currentColor" stroke-width="1" ` +
        `class="${classes.join(" ")}"/>`
    );
  }

  // Note-name labels beneath the keyboard, one per marked key.
  for (const [s, mark] of [...marks.entries()].sort((a, b) => a[0] - b[0])) {
    if (!mark.label) continue;
    parts.push(
      `<text x="${keyCentreX(s)}" y="${labelY}" text-anchor="middle" ` +
        `font-size="6.5" fill="currentColor" class="note-label">` +
        `${escapeXml(mark.label)}</text>`
    );
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `class="chord-diagram chord-diagram--piano" role="img" ` +
    `aria-label="${escapeXml(ariaLabel)}">${parts.join("")}</svg>`
  );
}

/** Fold a key position down by octaves until it fits on the keyboard. */
function foldIntoRange(position, total) {
  let p = position;
  while (p >= total) p -= 12;
  while (p < 0) p += 12;
  return p;
}

/**
 * Piano diagram for a realised chord (engine chords.realize output): chord
 * tones highlighted (class "pressed"), the root visually distinct (class
 * "root"), a differing slash bass marked with class "bass", and note names
 * printed under the pressed keys using the engine's ♭/♯ spelling.
 */
export function pianoChordSVG(realized, { octaves = 2 } = {}) {
  const total = octaves * 12;
  const pcs = realized.pitchClasses;
  const rootPc = pcs[0];
  const marks = new Map();

  // Slash bass sits below the root, so anchor the layout on it when present.
  const hasBass = realized.bassNote && realized.bassNote !== realized.root;
  let rootPos;
  if (hasBass) {
    const bassPc = pitchClass(parseNote(realized.bassNote));
    const bassPos = foldIntoRange(bassPc, total);
    marks.set(bassPos, {
      classes: ["pressed", "bass"],
      label: displayName(realized.bassNote),
    });
    rootPos = foldIntoRange(bassPos + mod(rootPc - bassPc, 12), total);
  } else {
    rootPos = foldIntoRange(rootPc, total);
  }

  // Chord tones ascend from the root; anything past the top edge folds down
  // an octave (rare — e.g. an add9 on a high root within two octaves).
  let prev = rootPos;
  for (let i = 0; i < pcs.length; i += 1) {
    let pos;
    if (i === 0) {
      pos = rootPos;
    } else {
      pos = prev + (mod(pcs[i] - pcs[i - 1], 12) || 12);
      prev = pos;
      pos = foldIntoRange(pos, total);
    }
    if (marks.has(pos)) continue; // a fold-down may land on an existing mark
    marks.set(pos, {
      classes: i === 0 ? ["pressed", "root"] : ["pressed"],
      label: displayName(realized.notes[i]),
    });
  }

  return keyboardSVG(octaves, marks, `${realized.symbol} on piano`);
}

/**
 * Piano diagram for a scale: every occurrence of each scale note across the
 * shown octaves is highlighted and labelled. The first note is treated as
 * the tonic and gets class "root". `noteNames` use ASCII spelling ("Bb").
 */
export function pianoScaleSVG(noteNames, { octaves = 2 } = {}) {
  const total = octaves * 12;
  const marks = new Map();
  const tonicPc = pitchClass(parseNote(noteNames[0]));

  for (const name of noteNames) {
    const pc = pitchClass(parseNote(name));
    for (let s = pc; s < total; s += 12) {
      if (marks.has(s)) continue;
      marks.set(s, {
        classes: pc === tonicPc ? ["pressed", "root"] : ["pressed"],
        label: displayName(name),
      });
    }
  }

  const label = `${displayName(noteNames[0])} scale on piano`;
  return keyboardSVG(octaves, marks, label);
}
