// scales-lib.js — the scale library view.
//
// Routes:
//   #/scales                  → C major
//   #/scales/<tonic>/<mode>   → e.g. #/scales/E/dorian
//
// Pick a tonic and a mode, get: the scale spelled correctly (derived by
// realising the mode's diatonic numerals through the engine and collecting
// the chord roots — the engine is the only source of musical truth), the
// notes lit up on a piano, a guitar tip built on relative-major thinking,
// the seven diatonic chords (numeral + name, tappable through to the chord
// library), and a shortlist of "frequent visitors" — borrowed chords that
// drop by so often they should be on the guest list.

import { parseNote, pitchClass, formatNoteDisplay } from "../engine/theory.js";
import { realize } from "../engine/chords.js";
import { formatDisplay } from "../engine/numeral.js";
import { pianoScaleSVG } from "./diagrams.js";
import { MAJOR_FAMILY_TONICS, MINOR_FAMILY_TONICS } from "./detail.js";
import { chordHref } from "./chords-lib.js";
import { el, prettySymbol, prettyNote, capitalise } from "./util.js";

// ---------------------------------------------------------------------------
// The six modes. `numerals` are the diatonic chords measured against the
// tonic's MAJOR scale (the CLAUDE.md contract). `relative` names the numeral
// whose root is the relative major (or, for major itself, the relative
// minor) — used for the guitar fingering tip.
// ---------------------------------------------------------------------------

const MODES = [
  {
    id: "major",
    family: "major",
    numerals: ["I", "ii", "iii", "IV", "V", "vi", "viidim"],
    relative: "vi",
  },
  {
    id: "minor",
    family: "minor",
    numerals: ["i", "iidim", "bIII", "iv", "v", "bVI", "bVII"],
    relative: "bIII",
  },
  {
    id: "dorian",
    family: "minor",
    numerals: ["i", "ii", "bIII", "IV", "v", "vidim", "bVII"],
    relative: "bVII",
  },
  {
    id: "mixolydian",
    family: "major",
    numerals: ["I", "ii", "iiidim", "IV", "v", "vi", "bVII"],
    relative: "IV",
  },
  {
    id: "lydian",
    family: "major",
    numerals: ["I", "II", "iii", "#ivdim", "V", "vi", "vii"],
    relative: "V",
  },
  {
    id: "phrygian",
    family: "minor",
    numerals: ["i", "bII", "bIII", "iv", "vdim", "bVI", "bvii"],
    relative: "bVI",
  },
];

const modeById = new Map(MODES.map((m) => [m.id, m]));

// ---------------------------------------------------------------------------
// Frequent visitors — curated borrowed moves per mode, one friendly line each.
// Every one is a legal numeral, realised in the chosen key and tappable.
// ---------------------------------------------------------------------------

const VISITORS = {
  major: [
    { numeral: "iv", blurb: "The minor four — a borrowed ache right before home." },
    { numeral: "bVII", blurb: "Flat seven — rock-and-roll swagger on loan from mixolydian." },
    { numeral: "bVI", blurb: "Flat six — a big widescreen lift from the parallel minor." },
    { numeral: "bIII", blurb: "Flat three — a bold sideways slide that shouldn't work, and does." },
    { numeral: "III", blurb: "The major three — the drama route to vi. Milk it." },
    { numeral: "V7sus4", blurb: "The gospel hover — hangs in the air, then lands home." },
  ],
  minor: [
    {
      numeral: "V",
      blurb:
        "The major five, borrowed from harmonic minor — raising one note gives the pull home real teeth.",
    },
    { numeral: "V7", blurb: "Same harmonic-minor trick with a seventh on top: even hungrier for home." },
    { numeral: "IV", blurb: "The major four — a flash of dorian brightness in the gloom." },
    { numeral: "bII", blurb: "Flat two — the phrygian sting. One chord of pure menace." },
    { numeral: "viidim", blurb: "The leading-tone diminished — maximum squeeze before i." },
  ],
  dorian: [
    { numeral: "V", blurb: "A borrowed major dominant when the groove needs pulling home." },
    { numeral: "bVI", blurb: "Flat six — a darker shadow on loan from plain minor." },
  ],
  mixolydian: [
    { numeral: "V", blurb: "Borrows the leading tone back for one proper cadence." },
    { numeral: "bVI", blurb: "A sudden parallel-minor shadow — great before the bVII." },
  ],
  lydian: [
    { numeral: "IV", blurb: "The plain four — borrowed calm when the ♯4 sparkle gets much." },
    { numeral: "bVII", blurb: "Flat seven — brings all that floating gently back to earth." },
  ],
  phrygian: [
    { numeral: "V", blurb: "The flamenco dominant — major five over all that darkness." },
    { numeral: "bVII", blurb: "The major flat-seven — borrowed swagger to break the spell." },
  ],
};

// ---------------------------------------------------------------------------
// Route handling
// ---------------------------------------------------------------------------

function tonicsForMode(mode) {
  return mode.family === "major" ? MAJOR_FAMILY_TONICS : MINOR_FAMILY_TONICS;
}

function fromParams(params) {
  let mode = modeById.get("major");
  if (params[1]) {
    const wanted = decodeURIComponent(params[1]);
    if (modeById.has(wanted)) mode = modeById.get(wanted);
  }
  const tonics = tonicsForMode(mode);
  let tonic = tonics[0];
  if (params[0]) {
    const wanted = decodeURIComponent(params[0]);
    // Accept any spelling of the pitch class and snap to the supported tonic.
    try {
      const pc = pitchClass(parseNote(wanted));
      const match = tonics.find((t) => pitchClass(parseNote(t)) === pc);
      if (match) tonic = match;
    } catch {
      /* unparseable → default tonic */
    }
  }
  return { tonic, mode };
}

function hrefFor(tonic, modeId) {
  return "#/scales/" + encodeURIComponent(tonic) + "/" + encodeURIComponent(modeId);
}

/** Same pitch class re-spelt for another mode family's tonic list. */
function tonicInFamily(tonic, mode) {
  const tonics = tonicsForMode(mode);
  const pc = pitchClass(parseNote(tonic));
  return tonics.find((t) => pitchClass(parseNote(t)) === pc) || tonics[0];
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function render(container, params) {
  const { tonic, mode } = fromParams(params);

  // The seven diatonic chords, realised once — their roots ARE the scale.
  const diatonic = mode.numerals.map((n) => ({ numeral: n, chord: realize(n, tonic) }));
  const scaleNotes = diatonic.map((d) => d.chord.root);

  const section = el("section", { className: "scales-lib" });

  // ---- Tonic picker ---------------------------------------------------------
  const tonicRow = el("div", {
    className: "key-row",
    attrs: { role: "group", "aria-label": "Choose a tonic" },
  });
  for (const t of tonicsForMode(mode)) {
    tonicRow.appendChild(
      el(
        "a",
        {
          className: "key-btn" + (t === tonic ? " selected" : ""),
          href: hrefFor(t, mode.id),
          attrs: { "aria-current": t === tonic ? "true" : undefined },
        },
        formatNoteDisplay(parseNote(t))
      )
    );
  }
  section.appendChild(
    el("div", { className: "lib-picker" }, el("h3", {}, "Tonic"), tonicRow)
  );

  // ---- Mode picker ------------------------------------------------------------
  const modeRow = el("div", {
    className: "chip-row",
    attrs: { role: "group", "aria-label": "Choose a mode" },
  });
  for (const m of MODES) {
    modeRow.appendChild(
      el(
        "a",
        {
          className: "chip" + (m.id === mode.id ? " selected" : ""),
          href: hrefFor(tonicInFamily(tonic, m), m.id),
          attrs: { "aria-current": m.id === mode.id ? "true" : undefined },
        },
        capitalise(m.id)
      )
    );
  }
  section.appendChild(
    el("div", { className: "lib-picker" }, el("h3", {}, "Mode"), modeRow)
  );

  // ---- Scale notes -------------------------------------------------------------
  section.appendChild(
    el(
      "header",
      { className: "scale-hero" },
      el("h2", { className: "scale-name" }, `${prettyNote(tonic)} ${mode.id}`),
      el(
        "div",
        { className: "scale-notes" },
        scaleNotes.map((n, i) =>
          el("span", { className: "chord-note" + (i === 0 ? " root" : "") }, prettyNote(n))
        )
      )
    )
  );

  // ---- Piano ---------------------------------------------------------------------
  const pianoHost = el("div", { className: "diagram-svg lib-piano" });
  pianoHost.innerHTML = pianoScaleSVG(scaleNotes);
  section.appendChild(
    el(
      "div",
      { className: "diagrams" },
      el("h3", {}, "On the piano"),
      el("figure", { className: "diagram-cell piano lib-piano-cell" }, pianoHost)
    )
  );

  // ---- Guitar tip ------------------------------------------------------------------
  const relRoot = realize(mode.relative, tonic).root;
  const guitarTip =
    mode.id === "major"
      ? `${prettyNote(tonic)} major shares every note with ${prettyNote(relRoot)} minor — same fingerings, brighter home base.`
      : `${prettyNote(tonic)} ${mode.id} = ${prettyNote(relRoot)} major fingerings, start on ${prettyNote(tonic)}. Same notes, different home.`;
  section.appendChild(
    el(
      "p",
      { className: "capo-hint scale-guitar-tip" },
      el("strong", {}, "On the guitar: "),
      guitarTip
    )
  );

  // ---- Diatonic chord grid ------------------------------------------------------------
  const grid = el("div", { className: "degree-grid" });
  for (const { numeral, chord } of diatonic) {
    grid.appendChild(
      el(
        "a",
        { className: "degree-cell", href: chordHref(chord) },
        el("div", { className: "degree-numeral" }, formatDisplay(numeral)),
        el("div", { className: "degree-symbol" }, prettySymbol(chord.symbol))
      )
    );
  }
  section.appendChild(
    el(
      "div",
      { className: "diatonic" },
      el("h3", {}, "The chords that live here"),
      el(
        "p",
        { className: "where-next-lead" },
        "Seven degrees, seven chords — all built from just these notes. Tap any of them to open it in the chord library."
      ),
      grid
    )
  );

  // ---- Frequent visitors ---------------------------------------------------------------
  const visitors = VISITORS[mode.id] || [];
  const visitorList = el("div", { className: "visitor-list" });
  for (const v of visitors) {
    const chord = realize(v.numeral, tonic);
    visitorList.appendChild(
      el(
        "a",
        { className: "visitor-card", href: chordHref(chord) },
        el(
          "div",
          { className: "visitor-head" },
          el("span", { className: "degree-numeral" }, formatDisplay(v.numeral)),
          el("span", { className: "visitor-symbol" }, prettySymbol(chord.symbol))
        ),
        el("p", { className: "visitor-blurb" }, v.blurb)
      )
    );
  }
  section.appendChild(
    el(
      "div",
      { className: "visitors" },
      el("h3", {}, "Frequent visitors"),
      el(
        "p",
        { className: "where-next-lead" },
        "Not from round here, but they drop by so often you should know them — borrowed chords that love this mode."
      ),
      visitorList
    )
  );

  container.appendChild(section);
}
