// scales-lib.js — the scale library view.
//
// Routes:
//   #/scales                  → C major
//   #/scales/<tonic>/<mode>   → e.g. #/scales/E/dorian
//
// Pick a tonic and a mode, get: the scale spelled correctly (derived by
// realising the mode's diatonic numerals through the engine and collecting
// the chord roots — the engine is the only source of musical truth), the
// notes lit up on a piano (each note tappable, making it the new tonic), a
// guitar tip built on relative-major thinking, the seven diatonic chords
// (numeral + name, tappable through to the chord library), and the borrowed
// chords that turn up in this mode most often. Explanations for both chord
// lists come from chord-copy.js, shared with the chord library.

import { parseNote, pitchClass, formatNoteDisplay } from "../engine/theory.js";
import { realize } from "../engine/chords.js";
import { formatDisplay } from "../engine/numeral.js";
import { pianoScaleSVG } from "./diagrams.js";
import { MAJOR_FAMILY_TONICS, MINOR_FAMILY_TONICS } from "./detail.js";
import { chordHref } from "./chords-lib.js";
import { copyFor, borrowedFor, copyBlock, revealList } from "./chord-copy.js";
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

// Which numerals sit outside a mode's scale is COMPUTED per key from the notes
// themselves (see the render function), so this tab can never contradict itself
// about what counts as borrowed. Explanations come from chord-copy.js.

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

  // ---- Scale notes ---------------------------------------------------------
  // Every note is a link that makes it the new tonic, keeping the mode. The
  // pitch class is snapped to this family's supported spelling, so tapping G♭
  // in D♭ major lands on F♯ major.
  section.appendChild(
    el(
      "header",
      { className: "scale-hero" },
      el("h2", { className: "scale-name" }, `${prettyNote(tonic)} ${mode.id}`),
      el(
        "div",
        { className: "scale-notes" },
        scaleNotes.map((note, i) => {
          if (i === 0) {
            return el(
              "span",
              { className: "chord-note root", attrs: { "aria-current": "true" } },
              prettyNote(note)
            );
          }
          const target = tonicInFamily(note, mode);
          return el(
            "a",
            { className: "chord-note note-link", href: hrefFor(target, mode.id) },
            prettyNote(note)
          );
        })
      ),
      el("p", { className: "scale-notes-hint" }, "Tap a note to make it home.")
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
      ? `${prettyNote(relRoot)} minor is ${prettyNote(tonic)} major's relative minor: the same seven notes, the same fingerings, a different home note.`
      : `${prettyNote(tonic)} ${mode.id} uses the ${prettyNote(relRoot)} major fingerings, starting on ${prettyNote(tonic)}.`;
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
      el("h3", {}, "Chords in this scale"),
      el(
        "p",
        { className: "where-next-lead" },
        "Seven chords built from these seven notes. Tap one to open it."
      ),
      grid
    )
  );

  // ---- Borrowed chords ------------------------------------------------------
  // In scale or borrowed is decided in pitch classes, not numeral strings: V7
  // is diatonic in major and borrowed in lydian, and only the notes know that.
  const scalePCs = new Set(scaleNotes.map((n) => pitchClass(parseNote(n))));
  const inScale = (numeral) =>
    realize(numeral, tonic).pitchClasses.every((pc) => scalePCs.has(pc));
  const borrowed = borrowedFor(mode.family, mode.id, inScale);
  const visitorCard = (numeral) => {
    const chord = realize(numeral, tonic);
    return el(
      "a",
      { className: "visitor-card", href: chordHref(chord) },
      el(
        "div",
        { className: "visitor-head" },
        el("span", { className: "degree-numeral" }, formatDisplay(numeral)),
        el("span", { className: "visitor-symbol" }, prettySymbol(chord.symbol))
      ),
      copyBlock(copyFor(numeral, mode.family, mode.id))
    );
  };
  section.appendChild(
    el(
      "div",
      { className: "visitors" },
      el("h3", {}, "Borrowed chords"),
      el(
        "p",
        { className: "where-next-lead" },
        "From outside the scale, but common in it anyway. Borrowing them is called modal interchange."
      ),
      revealList(borrowed, visitorCard, "visitor-list")
    )
  );

  container.appendChild(section);
}
