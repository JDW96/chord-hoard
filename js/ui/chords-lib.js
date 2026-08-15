// chords-lib.js — the chord library view.
//
// Routes:
//   #/chords                    → C major
//   #/chords/<root>/<quality>   → e.g. #/chords/Eb/m7   (root is any parseable
//                                 note name; we snap it to its pitch class)
//
// Pick a root (12 pitch classes) and a quality (the 15 the engine knows) and
// see the chord spelled out, on the piano, in every guitar shape we hold, plus
// a "where next?" panel of common destinations — each one a tap away.
//
// Realisation trick: the engine realises numerals against a tonic, so a bare
// chord is just degree I (or i) of a key whose tonic IS the chord root. We
// pick the supported tonic spelling for the root's pitch class — major-family
// spellings for major-ish qualities, minor-family for minor-ish (CLAUDE.md's
// locked lists) — so C♯/D♭ comes out as Db major but C#m minor, exactly as
// the supported keys spell them.

import { parseNote, pitchClass } from "../engine/theory.js";
import { realize } from "../engine/chords.js";
import { formatDisplay } from "../engine/numeral.js";
import {
  voicingsFor,
  guitarChordSVG,
  pianoChordSVG,
} from "./diagrams.js";
import { chordHref } from "./chord-link.js";
import { MAJOR_FAMILY_TONICS, MINOR_FAMILY_TONICS } from "./detail.js";
import { copyFor, orderFor, copyBlock, revealList } from "./chord-copy.js";
import { el, clear, prettySymbol, prettyNote, getGuitarData } from "./util.js";

// ---------------------------------------------------------------------------
// Roots — one entry per pitch class, with a sensible default spelling for the
// link token and a both-names label for the picker.
// ---------------------------------------------------------------------------

const ROOTS = [
  { pc: 0, token: "C", label: "C" },
  { pc: 1, token: "Db", label: "C♯/D♭" },
  { pc: 2, token: "D", label: "D" },
  { pc: 3, token: "Eb", label: "D♯/E♭" },
  { pc: 4, token: "E", label: "E" },
  { pc: 5, token: "F", label: "F" },
  { pc: 6, token: "F#", label: "F♯/G♭" },
  { pc: 7, token: "G", label: "G" },
  { pc: 8, token: "Ab", label: "G♯/A♭" },
  { pc: 9, token: "A", label: "A" },
  { pc: 10, token: "Bb", label: "A♯/B♭" },
  { pc: 11, token: "B", label: "B" },
];

// Supported tonic spelling per pitch class, per family (from the locked
// CLAUDE.md key lists, re-exported by detail.js).
const MAJOR_TONIC_BY_PC = new Map(
  MAJOR_FAMILY_TONICS.map((t) => [pitchClass(parseNote(t)), t])
);
const MINOR_TONIC_BY_PC = new Map(
  MINOR_FAMILY_TONICS.map((t) => [pitchClass(parseNote(t)), t])
);

// ---------------------------------------------------------------------------
// Qualities — the 15 the engine (and guitar-chords.json) speak, realised as
// degree I/i of the root's own key. `family` picks which tonic spelling list
// we realise from; minor-ish qualities use the minor-family spellings.
// ---------------------------------------------------------------------------

const QUALITIES = [
  // Triads
  { id: "maj", label: "Major", numeral: "I", family: "major", group: "Triads" },
  { id: "m", label: "Minor", numeral: "i", family: "minor", group: "Triads" },
  { id: "sus2", label: "Sus2", numeral: "Isus2", family: "major", group: "Triads" },
  { id: "sus4", label: "Sus4", numeral: "Isus4", family: "major", group: "Triads" },
  // Sevenths
  { id: "7", label: "7", numeral: "I7", family: "major", group: "Sevenths" },
  { id: "m7", label: "m7", numeral: "i7", family: "minor", group: "Sevenths" },
  { id: "maj7", label: "maj7", numeral: "Imaj7", family: "major", group: "Sevenths" },
  { id: "7sus4", label: "7sus4", numeral: "I7sus4", family: "major", group: "Sevenths" },
  // Colours
  { id: "6", label: "6", numeral: "I6", family: "major", group: "Colours" },
  { id: "m6", label: "m6", numeral: "i6", family: "minor", group: "Colours" },
  { id: "add9", label: "add9", numeral: "Iadd9", family: "major", group: "Colours" },
  { id: "madd9", label: "madd9", numeral: "iadd9", family: "minor", group: "Colours" },
  // Other
  { id: "dim", label: "Dim", numeral: "idim", family: "minor", group: "Other" },
  { id: "aug", label: "Aug", numeral: "Iaug", family: "major", group: "Other" },
  { id: "5", label: "5 (power)", numeral: "I5", family: "major", group: "Other" },
];

const QUALITY_GROUPS = ["Triads", "Sevenths", "Colours", "Other"];
const qualityById = new Map(QUALITIES.map((q) => [q.id, q]));

/** Tonic spelling used to realise a quality on a pitch class. */
function tonicFor(pc, quality) {
  return quality.family === "minor"
    ? MINOR_TONIC_BY_PC.get(pc)
    : MAJOR_TONIC_BY_PC.get(pc);
}

// chordHref (the #/chords/<root>/<quality> link for a realised chord) lives
// in chord-link.js and is re-exported here so existing `from "./chords-lib.js"`
// imports (the scale library, the where-next panel) keep working unchanged.
export { chordHref };

// "Where next?" destinations come from chord-copy.js, which treats the
// selected chord as home (I or i) and is shared with the scale library.

// ---------------------------------------------------------------------------
// Route handling
// ---------------------------------------------------------------------------

function fromParams(params) {
  let pc = 0;
  let qualityId = "maj";
  if (params[0]) {
    try {
      pc = pitchClass(parseNote(decodeURIComponent(params[0])));
    } catch {
      pc = 0;
    }
  }
  if (params[1]) {
    const wanted = decodeURIComponent(params[1]);
    if (qualityById.has(wanted)) qualityId = wanted;
  }
  return { pc, qualityId };
}

function hrefFor(pc, qualityId) {
  const token = ROOTS[pc].token;
  return "#/chords/" + encodeURIComponent(token) + "/" + encodeURIComponent(qualityId);
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function render(container, params) {
  const { pc, qualityId } = fromParams(params);
  const quality = qualityById.get(qualityId);
  const tonic = tonicFor(pc, quality);
  const realized = realize(quality.numeral, tonic);

  const section = el("section", { className: "chords-lib" });

  // ---- Root picker -------------------------------------------------------
  const rootRow = el("div", {
    className: "key-row",
    attrs: { role: "group", "aria-label": "Choose a root note" },
  });
  for (const r of ROOTS) {
    rootRow.appendChild(
      el(
        "a",
        {
          className: "key-btn root-btn" + (r.pc === pc ? " selected" : ""),
          href: hrefFor(r.pc, qualityId),
          attrs: { "aria-current": r.pc === pc ? "true" : undefined },
        },
        r.label
      )
    );
  }
  section.appendChild(
    el("div", { className: "lib-picker" }, el("h3", {}, "Root"), rootRow)
  );

  // ---- Quality picker ------------------------------------------------------
  const qualityHost = el("div", { className: "lib-picker" }, el("h3", {}, "Quality"));
  for (const group of QUALITY_GROUPS) {
    const row = el("div", {
      className: "chip-row quality-row",
      attrs: { role: "group", "aria-label": group },
    });
    for (const q of QUALITIES.filter((q) => q.group === group)) {
      row.appendChild(
        el(
          "a",
          {
            className: "chip quality-chip" + (q.id === qualityId ? " selected" : ""),
            href: hrefFor(pc, q.id),
            attrs: { "aria-current": q.id === qualityId ? "true" : undefined },
          },
          q.label
        )
      );
    }
    qualityHost.appendChild(
      el(
        "div",
        { className: "quality-group" },
        el("span", { className: "quality-group-label" }, group),
        row
      )
    );
  }
  section.appendChild(qualityHost);

  // ---- The chord itself ----------------------------------------------------
  section.appendChild(
    el(
      "header",
      { className: "chord-hero" },
      el("div", { className: "chord-hero-symbol" }, prettySymbol(realized.symbol)),
      el("div", { className: "chord-hero-quality" }, realized.quality),
      el(
        "div",
        { className: "chord-hero-notes" },
        realized.notes.map((n, i) =>
          el("span", { className: "chord-note" + (i === 0 ? " root" : "") }, prettyNote(n))
        )
      )
    )
  );

  // ---- Piano diagram ---------------------------------------------------------
  const pianoHost = el("div", { className: "diagram-svg lib-piano" });
  pianoHost.innerHTML = pianoChordSVG(realized);
  section.appendChild(
    el(
      "div",
      { className: "diagrams" },
      el("h3", {}, "On the piano"),
      el("figure", { className: "diagram-cell piano lib-piano-cell" }, pianoHost)
    )
  );

  // ---- Guitar voicings (async data) -----------------------------------------
  const guitarStrip = el("div", { className: "diagram-strip" });
  section.appendChild(
    el("div", { className: "diagrams" }, el("h3", {}, "On the guitar"), guitarStrip)
  );
  fillGuitarStrip(guitarStrip, realized);

  // ---- Where next? -----------------------------------------------------------
  const homeNumeral = quality.family === "minor" ? "i" : "I";
  const numerals = orderFor(quality.family);

  const destCard = (numeral) => {
    const copy = copyFor(numeral, quality.family);
    const destChord = realize(numeral, tonic);
    return el(
      "a",
      { className: "dest-card", href: chordHref(destChord) },
      el(
        "div",
        { className: "dest-head" },
        el("span", { className: "dest-symbol" }, prettySymbol(destChord.symbol)),
        el("span", { className: "dest-numeral" }, formatDisplay(numeral))
      ),
      copyBlock(copy)
    );
  };

  section.appendChild(
    el(
      "div",
      { className: "where-next" },
      el("h3", {}, "Where next?"),
      el(
        "p",
        { className: "where-next-lead" },
        `${prettySymbol(realized.symbol)} is home (${formatDisplay(
          homeNumeral
        )}). These are the chords it usually moves to. Tap one.`
      ),
      revealList(numerals, destCard, "dest-list")
    )
  );

  container.appendChild(section);
}

async function fillGuitarStrip(host, realized) {
  let voicings = [];
  try {
    const data = await getGuitarData();
    voicings = voicingsFor(realized, data);
  } catch {
    voicings = [];
  }
  clear(host);
  if (!voicings.length) {
    host.appendChild(
      el(
        "div",
        { className: "diagram-missing wide" },
        "No guitar shape on file. Every note is on the piano diagram above."
      )
    );
    return;
  }
  for (const voicing of voicings) {
    const svgHost = el("div", { className: "diagram-svg" });
    svgHost.innerHTML = guitarChordSVG(voicing, { title: prettySymbol(realized.symbol) });
    host.appendChild(
      el(
        "figure",
        { className: "diagram-cell" },
        svgHost,
        el("figcaption", {}, voicing.label || "shape")
      )
    );
  }
}
