// circle-of-fifths.js — data and SVG for the circle-of-fifths key wheel
// (backlog item 3), a memorisation aid supplementing the plain key-button
// rows in the detail view and the Scales tab.
//
// Layout is the standard one: 12 positions in true ascending-fifths order,
// major tonic on the outer ring, its true relative minor on the inner ring
// at the same position. The 12 positions are exactly the app's locked tonic
// spellings (CLAUDE.md) — just reordered from "sharps then flats" into a
// genuine circle. Each key's accidentals are computed by realising its
// seven diatonic chords through the engine (never hardcoded), so the wheel
// can never contradict the rest of the app about how a key spells.

import { realize } from "../engine/chords.js";
import { parseNote, formatNoteDisplay } from "../engine/theory.js";
import { prettySymbol } from "./util.js";

const WHEEL = [
  { major: "C", minor: "A" },
  { major: "G", minor: "E" },
  { major: "D", minor: "B" },
  { major: "A", minor: "F#" },
  { major: "E", minor: "C#" },
  { major: "B", minor: "G#" },
  { major: "F#", minor: "Eb" },
  { major: "Db", minor: "Bb" },
  { major: "Ab", minor: "F" },
  { major: "Eb", minor: "C" },
  { major: "Bb", minor: "G" },
  { major: "F", minor: "D" },
];

const MAJOR_DIATONIC_NUMERALS = ["I", "ii", "iii", "IV", "V", "vi", "viidim"];
// Standard key-signature accumulation order: the order sharps/flats are
// added as key signatures gain accidentals, not scale-degree order.
const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];

/** The accidentals in a major key, in standard key-signature order. */
export function accidentalsFor(majorTonic) {
  const notes = MAJOR_DIATONIC_NUMERALS.map((n) => parseNote(realize(n, majorTonic).root));
  const sharps = notes.filter((n) => n.accidental > 0);
  const flats = notes.filter((n) => n.accidental < 0);
  const order = sharps.length ? SHARP_ORDER : flats.length ? FLAT_ORDER : [];
  const byLetter = new Map((sharps.length ? sharps : flats).map((n) => [n.letter, n]));
  return order.filter((l) => byLetter.has(l)).map((l) => formatNoteDisplay(byLetter.get(l)));
}

/** The wheel position (major + relative minor) that carries a given tonic. */
export function positionForTonic(tonic, family) {
  return WHEEL.find((p) => p[family] === tonic);
}

/** "E major / C♯ minor — F♯ C♯ G♯ D♯" (or "no sharps or flats" for C/Am). */
export function captionFor(tonic, family) {
  const pos = positionForTonic(tonic, family);
  if (!pos) return "";
  const acc = accidentalsFor(pos.major);
  const text = acc.length ? acc.join(" ") : "no sharps or flats";
  return `${prettySymbol(pos.major)} major / ${prettySymbol(pos.minor)} minor — ${text}`;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wedge(tonic, x, y, r, fontSize, ring, interactive, selected, home) {
  const label = ring === "minor" ? prettySymbol(tonic).toLowerCase() : prettySymbol(tonic);
  const classes = [
    "wheel-wedge",
    ring,
    interactive ? "interactive" : "muted",
    selected ? "selected" : "",
    home ? "home" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const attrs = interactive
    ? ` data-tonic="${escapeXml(tonic)}" tabindex="0" role="button" aria-label="${escapeXml(label)} ${ring === "minor" ? "minor" : "major"}${
        home ? ", home key" : ""
      }"${selected ? ' aria-current="true"' : ""}`
    : "";
  return (
    `<g class="${classes}"${attrs}>` +
    `<circle cx="${x}" cy="${y}" r="${r}" class="wheel-dot"/>` +
    `<text x="${x}" y="${y + fontSize * 0.35}" text-anchor="middle" font-size="${fontSize}" ` +
    `class="wheel-label">${escapeXml(label)}</text>` +
    `</g>`
  );
}

/**
 * The wheel SVG. `family` ("major"|"minor") decides which ring is tappable
 * (carries data-tonet/role=button) — the other ring is shown for context but
 * inert, matching how a printed circle-of-fifths poster shows both rings.
 * `activeTonic` (a tonic from that family) gets the "selected" highlight.
 * `homeTonic`, if given, marks that wedge with a dashed ring so it stays
 * visible at a glance after tapping elsewhere on the wheel — the flat
 * button row used to carry this ("home" class), and the wheel is now the
 * only key selector, so it needed to pick that up too.
 */
export function wheelSVG({ family, activeTonic, homeTonic }) {
  const size = 300;
  const cx = 150;
  const cy = 150;
  const rOuter = 118;
  const rInner = 78;
  const parts = [
    `<circle cx="${cx}" cy="${cy}" r="${rOuter}" class="wheel-ring"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${rInner}" class="wheel-ring"/>`,
  ];
  WHEEL.forEach((pos, i) => {
    const angle = ((-90 + i * 30) * Math.PI) / 180;
    const xo = cx + rOuter * Math.cos(angle);
    const yo = cy + rOuter * Math.sin(angle);
    const xi = cx + rInner * Math.cos(angle);
    const yi = cy + rInner * Math.sin(angle);
    parts.push(
      wedge(
        pos.major,
        xo,
        yo,
        21,
        14,
        "major",
        family === "major",
        family === "major" && pos.major === activeTonic,
        family === "major" && pos.major === homeTonic
      )
    );
    parts.push(
      wedge(
        pos.minor,
        xi,
        yi,
        17,
        11.5,
        "minor",
        family === "minor",
        family === "minor" && pos.minor === activeTonic,
        family === "minor" && pos.minor === homeTonic
      )
    );
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" ` +
    `class="wheel" role="img" aria-label="Circle of fifths">${parts.join("")}</svg>`
  );
}
