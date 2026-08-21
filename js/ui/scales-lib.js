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

import { parseNote, pitchClass, formatNote } from "../engine/theory.js";
import { realize } from "../engine/chords.js";
import { formatDisplay } from "../engine/numeral.js";
import { DIATONIC_NUMERALS } from "../engine/harmony.js";
import { scaleNotes as soloScaleNotes, cagedPositions } from "../engine/solo-scales.js";
import { pianoScaleSVG, cagedShapeSVG } from "./diagrams.js";
import { MAJOR_FAMILY_TONICS, MINOR_FAMILY_TONICS } from "./detail.js";
import { chordHref } from "./chords-lib.js";
import { tintClass, legendCaption } from "./function-tint.js";
import { copyFor, borrowedFor, copyBlock, revealList } from "./chord-copy.js";
import { wheelSVG, captionFor } from "./circle-of-fifths.js";
import { state } from "./app.js";
import { el, clear, fetchJSON, prettySymbol, prettyNote, capitalise } from "./util.js";

// data/solo-shapes.json, fetched once and shared across visits (same lazy
// pattern as util.getGuitarData / builder.js's getMoves).
let soloShapesPromise = null;
function getSoloShapesData() {
  if (!soloShapesPromise) {
    soloShapesPromise = fetchJSON("data/solo-shapes.json").catch((err) => {
      soloShapesPromise = null; // retry on next visit
      throw err;
    });
  }
  return soloShapesPromise;
}

async function fillCagedShapes(host, tonic) {
  let data;
  try {
    data = await getSoloShapesData();
  } catch {
    host.appendChild(
      el(
        "div",
        { className: "diagram-placeholder" },
        el("p", {}, "Position shapes wouldn't load"),
        el("p", { className: "muted" }, "Check the connection and come back.")
      )
    );
    return;
  }
  for (const position of cagedPositions(tonic, data)) {
    const svgHost = el("div", { className: "diagram-svg" });
    svgHost.innerHTML = cagedShapeSVG(position, { title: `${position.id}-shape` });
    host.appendChild(
      el(
        "figure",
        { className: "diagram-cell guitar caged-shape-cell" },
        svgHost,
        el("figcaption", {}, `Box ${position.box}`)
      )
    );
  }
}

// ---------------------------------------------------------------------------
// The six modes. `numerals` are the diatonic chords measured against the
// tonic's MAJOR scale (the CLAUDE.md contract) — sourced from harmony.js's
// DIATONIC_NUMERALS, the single place that per-mode list of seven lives, so
// this tab and the function-tinting engine can never disagree about what's
// diatonic. `relative` names the numeral whose root is the relative major
// (or, for major itself, the relative minor) — used for the guitar
// fingering tip.
// ---------------------------------------------------------------------------

const MODES = [
  { id: "major", family: "major", numerals: DIATONIC_NUMERALS.major, relative: "vi" },
  { id: "minor", family: "minor", numerals: DIATONIC_NUMERALS.minor, relative: "bIII" },
  { id: "dorian", family: "minor", numerals: DIATONIC_NUMERALS.dorian, relative: "bVII" },
  { id: "mixolydian", family: "major", numerals: DIATONIC_NUMERALS.mixolydian, relative: "IV" },
  { id: "lydian", family: "major", numerals: DIATONIC_NUMERALS.lydian, relative: "V" },
  { id: "phrygian", family: "minor", numerals: DIATONIC_NUMERALS.phrygian, relative: "bVI" },
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
  // The wheel IS the tonic picker now (backlog item 3 follow-up, agreed
  // with Jack 2026-08-15) — it covers exactly the same tonics the flat
  // button row used to, so the row was removed rather than kept alongside
  // it. Only the ring matching the current mode's family is tappable; the
  // other ring is shown for context.
  const wheelHost = el("div", { className: "wheel-svg" });
  wheelHost.innerHTML = wheelSVG({ family: mode.family, activeTonic: tonic });
  function jumpToWedge(ev) {
    const w = ev.target.closest("[data-tonic]");
    if (w) window.location.hash = hrefFor(w.getAttribute("data-tonic"), mode.id);
  }
  wheelHost.addEventListener("click", jumpToWedge);
  wheelHost.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      jumpToWedge(ev);
    }
  });

  section.appendChild(
    el(
      "div",
      { className: "lib-picker" },
      el("h3", {}, "Tonic"),
      wheelHost,
      el("p", { className: "wheel-caption" }, captionFor(tonic, mode.family)),
      el(
        "p",
        { className: "wheel-hint" },
        "Outer ring is major, inner ring is its relative minor. Tap a key to jump there."
      )
    )
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
    const cls = tintClass(numeral, tonic, mode.id);
    grid.appendChild(
      el(
        "a",
        { className: "degree-cell", href: chordHref(chord) },
        el("div", { className: "degree-numeral " + cls }, formatDisplay(numeral)),
        el("div", { className: "degree-symbol " + cls }, prettySymbol(chord.symbol))
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
      legendCaption(),
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
    const cls = tintClass(numeral, tonic, mode.id);
    return el(
      "a",
      { className: "visitor-card", href: chordHref(chord) },
      el(
        "div",
        { className: "visitor-head" },
        el("span", { className: "degree-numeral " + cls }, formatDisplay(numeral)),
        el("span", { className: "visitor-symbol " + cls }, prettySymbol(chord.symbol))
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

  // ---- Soloing (roadmap 0.3) -------------------------------------------
  // Pentatonic and blues are deliberately NOT modes (see solo-scales.js):
  // they don't get a row in the mode picker above, just a section here.
  // `relRoot` (computed above for the guitar tip) is this mode's own true
  // parent-major/relative-minor root, so the "same notes, different home"
  // card stays consistent with what the guitar tip already told the reader.
  const minorRootedTonic = mode.family === "major" ? relRoot : tonic;
  const soloCards = [
    {
      title: `${prettyNote(tonic)} ${mode.family === "major" ? "major" : "minor"} pentatonic`,
      scaleKey: mode.family === "major" ? "majorPentatonic" : "minorPentatonic",
      tonic,
    },
    {
      title: `${prettyNote(minorRootedTonic)} blues`,
      scaleKey: "blues",
      tonic: minorRootedTonic,
    },
    {
      title: `${prettyNote(relRoot)} ${mode.family === "major" ? "minor" : "major"} pentatonic`,
      scaleKey: mode.family === "major" ? "minorPentatonic" : "majorPentatonic",
      tonic: relRoot,
      note: "Same five notes as the first card, a different note as home.",
    },
  ];
  const soloingSection = el(
    "div",
    { className: "soloing" },
    el("h3", {}, "Soloing"),
    el(
      "p",
      { className: "where-next-lead" },
      "Pentatonic and blues scales for improvising over chords in this key, not chords built from it."
    ),
    el(
      "div",
      { className: "solo-scale-grid" },
      soloCards.map((card) => {
          const notes = soloScaleNotes(card.scaleKey, card.tonic);
          const pianoHost = el("div", { className: "diagram-svg solo-scale-piano" });
          pianoHost.innerHTML = pianoScaleSVG(notes.map(({ note }) => formatNote(note)));
          return el(
            "div",
            { className: "solo-scale-card" },
            el("h4", { className: "solo-scale-title" }, card.title),
            el(
              "div",
              { className: "solo-scale-notes" },
              notes.map(({ note, degree }) =>
                el(
                  "span",
                  { className: "solo-note" },
                  el("span", { className: "solo-note-name" }, prettyNote(formatNote(note))),
                  el("span", { className: "solo-note-degree" }, degree)
                )
              )
            ),
            el("figure", { className: "diagram-cell piano solo-scale-piano-cell" }, pianoHost),
            card.note ? el("p", { className: "solo-scale-note" }, card.note) : null
          );
        })
      )
    );
  section.appendChild(soloingSection);

  // ---- CAGED positions (roadmap 0.3, guitar only) ------------------------
  // One set of shapes serves both pentatonic cards above (see the comment
  // on minorRootedTonic) — rooted here at whichever tonic reads as "1" in
  // them, i.e. the minor pentatonic root.
  if (state.instrument === "guitar") {
    const cagedHost = el("div", { className: "diagram-strip caged-strip" });
    soloingSection.appendChild(
      el(
        "div",
        { className: "caged-section" },
        el("h4", { className: "solo-scale-title" }, "CAGED positions"),
        el(
          "p",
          { className: "where-next-lead" },
          `Five moveable shapes that tile the neck for ${prettyNote(minorRootedTonic)} minor pentatonic ` +
            `(and equally for ${prettyNote(mode.family === "major" ? tonic : relRoot)} major pentatonic, ` +
            "same notes from a different home)."
        ),
        cagedHost
      )
    );
    fillCagedShapes(cagedHost, minorRootedTonic);
  }

  container.appendChild(section);
}
