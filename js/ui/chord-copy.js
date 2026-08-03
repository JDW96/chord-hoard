// chord-copy.js — the one place chord explanations are written.
//
// Both the Chords tab ("Where next?") and the Scales tab ("Borrowed chords")
// ask the same question: what does this numeral do relative to home, and where
// does it go? That is one fact, so it lives in one table and both views read it.
//
// The table is keyed by NUMERAL, never by chord name. C in the key of C is the
// `I` row; C in the key of G is the `IV` row. The Chords tab treats whichever
// chord you selected as home, so it only ever needs the I/i view; the Scales tab
// knows its tonic, so every chord on it already has a numeral. Same lookup.
//
// `family` is "major" or "minor" and describes HOME, not the chord: `IV` in a
// major key and `IV` in a minor key are different rows.
//
// Mode can still change the story when the numeral is identical (IV in lydian
// cancels the ♯4 that defines the mode; IV in dorian is simply diatonic), so
// OVERRIDES holds the handful of mode-specific readings and wins when present.
//
// Each entry is three short lines:
//   tension — how much, and what kind
//   theory  — function, which note does the work, what that does to the ear
//   next    — usual destinations, with the cadence named where one exists
//
// Cadence names are UK-first (perfect / imperfect / interrupted / plagal), and
// are there so a name can be searched. Sources are listed in
// docs/phase-2.5-copy.md.

import { el } from "./util.js";

// ---------------------------------------------------------------------------
// Home is a major-ish chord
// ---------------------------------------------------------------------------

const MAJOR = {
  IV: {
    tension: "low",
    theory:
      "Subdominant. The tonic note is still in the chord. Moving here costs nothing.",
    next: "I (plagal cadence), or V",
  },
  V: {
    tension: "high",
    theory:
      "Dominant. Contains the leading note, a semitone under the tonic. That semitone does the work.",
    next: "I (perfect cadence). Going to vi instead is the interrupted cadence",
  },
  vi: {
    tension: "none, though the centre shifts",
    theory:
      "Relative minor. Two of its three notes are in I. The mood travels further than the harmony does.",
    next: "IV or ii. Arriving here from V is the interrupted cadence",
  },
  ii: {
    tension: "moderate",
    theory:
      "Supertonic, a third below IV and sharing two of its notes. Predominant: the lower root turns that same material into a run-up.",
    next: "V, then I (the ii–V–I turnaround)",
  },
  V7: {
    tension: "higher",
    theory:
      "The fourth degree added on top makes a tritone with the leading note. Both close inwards, onto the root and third of I.",
    next: "I (perfect cadence)",
  },
  iii: {
    tension: "faint",
    theory:
      "Mediant. Shares two notes with I and two with V. It commits to neither. Best as a passing chord under a falling melody.",
    next: "vi or IV",
  },
  bVII: {
    tension: "mild",
    theory:
      "Subtonic major, from mixolydian. Built on the flat seventh, so the key's leading note is absent and nothing points home.",
    next: "IV then I, or straight to I. From iv, with a seventh on it, that is the backdoor cadence",
  },
  iv: {
    tension: "a drop of a semitone",
    theory:
      "Minor subdominant, borrowed from the parallel minor. The flat sixth falls onto the fifth of I.",
    next: "I (minor plagal cadence)",
  },
  viidim: {
    tension: "unstable",
    theory:
      "Leading-tone diminished: V7 with the root removed. Dominant function, less weight underneath.",
    next: "I",
  },
  V7sus4: {
    tension: "held",
    theory:
      "The fourth replaces the third. With the leading note gone there is tension and no direction, until the fourth falls.",
    next: "V7, then I",
  },
  bVI: {
    tension: "no pull home",
    theory:
      "Flat submediant, borrowed from the parallel minor. Two of its three notes are outside the key, and none of them leads anywhere.",
    next: "♭VII then I (informally the Mario cadence), or V",
  },
  II: {
    tension: "bright, and outside the key",
    theory:
      "Secondary dominant, V of V. The fourth degree is raised into a leading note aimed at V.",
    next: "V, then I",
  },
  III: {
    tension: "bright, wrong-footing",
    theory:
      "Secondary dominant, V of vi. The fifth degree is raised to point at vi.",
    next: "vi. Land hard on it",
  },
  VI: {
    tension: "outside the key",
    theory:
      "Secondary dominant, V of ii. Raises the tonic note itself, the one degree a key otherwise never touches.",
    next: "ii, then V",
  },
  I7: {
    tension: "restless",
    theory:
      "Dominant seventh built on home. The flat seventh recasts I as the V of IV.",
    next: "IV. The move the 12-bar is built on",
  },
  bIII: {
    tension: "a sideways jolt",
    theory:
      "Flat mediant, borrowed from the parallel minor. Only the fifth of I survives the change.",
    next: "♭VI or IV, then I",
  },
};

// ---------------------------------------------------------------------------
// Home is a minor-ish chord
// ---------------------------------------------------------------------------

const MINOR = {
  iv: {
    tension: "low",
    theory:
      "Subdominant minor. No leading note, and nothing outside the mode. It can sit for bars without resolving.",
    next: "i (plagal cadence), or V",
  },
  V: {
    tension: "the highest in minor",
    theory:
      "Major dominant, from harmonic minor. The seventh degree is raised a semitone to make a leading note. That raise is the only difference from v.",
    next: "i (perfect cadence)",
  },
  bVII: {
    tension: "low, lifting",
    theory:
      "Subtonic major, built on the flat seventh. Nothing in it is aimed at the tonic.",
    next: "i, or up through ♭VI. In i–♭VII–♭VI–V it is the Andalusian cadence",
  },
  bVI: {
    tension: "no pull home",
    theory:
      "Flat submediant. Its root sits a semitone above the fifth degree, which lets V land on it in place of i.",
    next: "♭VII then i, or V. Arriving from V is the interrupted cadence",
  },
  bIII: {
    tension: "none, this is release",
    theory:
      "Relative major, same seven notes. Two of them are already in i, so the brightness arrives without a jolt. Leads out of a minor verse.",
    next: "♭VII or ♭VI, then i",
  },
  v: {
    tension: "soft, unresolved",
    theory:
      "Minor dominant, the five natural minor gives you. The flat seventh in it sits a whole tone under the tonic, too far to pull. The chord falls home under its own weight.",
    next: "i, or ♭VII",
  },
  V7: {
    tension: "higher",
    theory:
      "The fourth degree added on top makes a tritone with the leading note. Both close inwards, onto the root and third of i.",
    next: "i",
  },
  IV: {
    tension: "brighter than expected",
    theory:
      "Major subdominant. Its major third is the raised sixth degree, the single note separating dorian from natural minor.",
    next: "i, or v",
  },
  iidim: {
    tension: "unstable",
    theory:
      "Supertonic diminished. Predominant. The flat sixth in it presses down onto the fifth degree.",
    next: "V, then i",
  },
  viidim: {
    tension: "unstable",
    theory:
      "Leading-tone diminished, from harmonic minor. V7 with the root removed.",
    next: "i",
  },
  bII: {
    tension: "a semitone over home",
    theory:
      "The Neapolitan. Predominant, normally played in first inversion with the fourth degree in the bass.",
    next: "V, then i",
  },
};

// ---------------------------------------------------------------------------
// Mode-specific readings. Key is "<mode>|<numeral>"; these replace `theory`
// and `next` on the base entry, keeping its `tension`.
// ---------------------------------------------------------------------------

const OVERRIDES = {
  "lydian|IV": {
    theory:
      "Cancels the ♯4 the mode is built on. Home stops floating and behaves like plain major for a bar.",
    next: "I, or V",
  },
  "mixolydian|V": {
    theory:
      "Borrows back the leading note, the one degree mixolydian gives up. One proper cadence, then the mode resumes.",
    next: "I (perfect cadence)",
  },
  "dorian|IV": {
    theory:
      "In the scale here, not borrowed: dorian's raised sixth degree is this chord's major third.",
    next: "i, or ♭VII",
  },
  "dorian|bVI": {
    theory:
      "Borrowed from natural minor. Restores the flat sixth, so dorian's defining degree is absent while it sounds.",
    next: "♭VII, or i",
  },
  "phrygian|V": {
    theory:
      "Major V, from the phrygian dominant scale. Two degrees have to be raised to build it, against one for a borrowed V elsewhere.",
    next: "i. It closes the Andalusian cadence, i–♭VII–♭VI–V",
  },
};

// ---------------------------------------------------------------------------
// Display order, commonest first. The Chords tab shows HEAD_COUNT of these and
// reveals the rest on tap.
// ---------------------------------------------------------------------------

const MAJOR_ORDER = [
  "IV", "V", "vi", "ii", "V7", "iii", "bVII", "iv",
  "viidim", "V7sus4", "bVI", "II", "III", "VI", "I7", "bIII",
];

const MINOR_ORDER = [
  "iv", "V", "bVII", "bVI", "bIII", "v", "V7", "IV",
  "iidim", "viidim", "bII",
];

export const HEAD_COUNT = 8;

/** The raw tables and override keys, for tools/test-copy.js. */
export const TABLES = { major: MAJOR, minor: MINOR };
export const OVERRIDE_KEYS = Object.keys(OVERRIDES);

/** Every numeral we hold copy for, in display order, for a family. */
export function orderFor(family) {
  return family === "minor" ? MINOR_ORDER.slice() : MAJOR_ORDER.slice();
}

/**
 * Copy for a numeral relative to a home of `family` ("major" | "minor"),
 * optionally in a specific mode. Returns null when we hold nothing.
 */
export function copyFor(numeral, family, mode) {
  const base = (family === "minor" ? MINOR : MAJOR)[numeral];
  if (!base) return null;
  const override = mode ? OVERRIDES[mode + "|" + numeral] : null;
  return override ? { ...base, ...override } : base;
}

/**
 * Which of our numerals fall OUTSIDE the current scale, in display order.
 *
 * `isInScale(numeral)` is supplied by the caller and answers the question in
 * pitch classes, not numeral strings: V7 is diatonic in major but borrowed in
 * lydian, and only the notes know that. Deriving the list this way is why the
 * Scales tab cannot disagree with itself about what counts as borrowed.
 */
export function borrowedFor(family, mode, isInScale) {
  return orderFor(family).filter(
    (numeral) => copyFor(numeral, family, mode) && !isInScale(numeral)
  );
}

/**
 * A card list that shows `limit` items and reveals the rest on tap, so a long
 * list is never silently cut. Returns the nodes to append, in order.
 *
 *   items     things to render
 *   makeCard  item → element
 *   listClass class for each list container
 */
export function revealList(items, makeCard, listClass) {
  const head = el("div", { className: listClass });
  for (const item of items.slice(0, HEAD_COUNT)) head.appendChild(makeCard(item));

  const rest = items.slice(HEAD_COUNT);
  if (!rest.length) return [head];

  const restList = el("div", {
    className: listClass + " reveal-rest",
    attrs: { hidden: "" },
  });
  for (const item of rest) restList.appendChild(makeCard(item));

  const label = (open) => (open ? "Show fewer" : `Show ${rest.length} more`);
  const button = el(
    "button",
    {
      type: "button",
      className: "reveal-btn",
      attrs: { "aria-expanded": "false" },
      on: {
        click(event) {
          const opening = restList.hasAttribute("hidden");
          if (opening) restList.removeAttribute("hidden");
          else restList.setAttribute("hidden", "");
          event.currentTarget.setAttribute("aria-expanded", String(opening));
          event.currentTarget.textContent = label(opening);
        },
      },
    },
    label(false)
  );
  return [head, restList, button];
}

/**
 * The three labelled lines, as DOM. Shared by both card types so they cannot
 * drift apart.
 */
export function copyBlock(entry) {
  const line = (label, text) =>
    el(
      "div",
      { className: "copy-line" },
      el("span", { className: "copy-label" }, label),
      el("span", { className: "copy-text" }, text)
    );
  return el(
    "div",
    { className: "copy-block" },
    line("Tension", entry.tension),
    line("Theory", entry.theory),
    line("Next", entry.next)
  );
}
