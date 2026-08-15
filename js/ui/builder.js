// builder.js — the dynamic progression builder (#/build, phase 4).
//
// Start from any chord and grow a progression one move at a time, with
// suggestions at three spice levels:
//   🌶      in the scale — the mode's own seven chords, ranked by where the
//           chord you're on usually goes (data/moves.json "transitions",
//           degree → ranked degrees, mode-agnostic).
//   🌶🌶    tasteful colour — sus/7th/6/add9/slash-bass dressings of the same
//           ranked destinations ("colours", per family).
//   🌶🌶🌶  borrowed & chromatic — the family's borrowed pool ("borrowed"),
//           filtered per mode so anything already diatonic drops out.
//
// Context-awareness, deliberately modest in v1: ranking follows the LAST
// chord placed; the chord you're on is never suggested back; and once the
// progression is a few chords long without touching home, the tonic is
// nudged to the front of the mild list.
//
// Saving (built.js) writes a full schema entry to chordhoard.built and
// registers it into the running app under the "My progressions" collection,
// so the detail view, transpose, capo, complexity, performance mode and pins
// all work on saved results with no special casing. Each chord holds one bar
// of 4/4 in this first version.

import { parse, formatDisplay } from "../engine/numeral.js";
import { realize } from "../engine/chords.js";
import * as complexity from "../engine/complexity.js";
import { DIATONIC_NUMERALS, isDiatonic } from "../engine/harmony.js";
import { state, registerBuiltEntry, unregisterBuiltEntry } from "./app.js";
import { MAJOR_FAMILY_TONICS, MINOR_FAMILY_TONICS } from "./detail.js";
import { tintClass, legendCaption } from "./function-tint.js";
import { builtEntries, saveBuilt, deleteBuilt, newBuiltId } from "./built.js";
import {
  el,
  clear,
  fetchJSON,
  prettySymbol,
  prettyNote,
  capitalise,
  levelClass,
} from "./util.js";

const MAJOR_FAMILY = new Set(["major", "mixolydian", "lydian"]);
const MODES = ["major", "minor", "dorian", "mixolydian", "lydian", "phrygian"];
const MAX_CHORDS = 16; // bars cap in the schema
const FALLBACK_DEGREES = [1, 5, 4, 6, 2, 3, 7];

// Module-level state so a trip into a saved progression's detail view and
// back doesn't wipe the work in progress.
let mode = "major";
let tonic = "C";
let chosen = []; // numeral strings, in order
let draftName = "";

// data/moves.json, fetched once (same lazy pattern as util.getGuitarData).
let movesPromise = null;
function getMoves() {
  if (!movesPromise) {
    movesPromise = fetchJSON("data/moves.json").catch((err) => {
      movesPromise = null; // retry on next visit
      throw err;
    });
  }
  return movesPromise;
}

function family() {
  return MAJOR_FAMILY.has(mode) ? "major" : "minor";
}

function tonics() {
  return family() === "major" ? MAJOR_FAMILY_TONICS : MINOR_FAMILY_TONICS;
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

function computeSuggestions(moves) {
  const diatonic = DIATONIC_NUMERALS[mode];
  const last = chosen.length ? chosen[chosen.length - 1] : null;

  let degrees;
  if (!last) {
    degrees = FALLBACK_DEGREES;
  } else {
    const from = parse(last).degree;
    degrees = moves.transitions[String(from)] || FALLBACK_DEGREES;
    // Nudge home: a few chords in without touching the tonic, bring degree 1
    // to the front so the mild list leads with a way back.
    if (chosen.length >= 3 && degrees.includes(1)) {
      const recent = chosen.slice(-3).map((n) => parse(n).degree);
      if (!recent.includes(1)) degrees = [1, ...degrees.filter((d) => d !== 1)];
    }
  }

  const notLast = (n) => n !== last;
  const mild = degrees.map((d) => diatonic[d - 1]).filter(notLast);

  const colourTable = moves.colours[family()] || {};
  const medium = [];
  for (const d of degrees.slice(0, 4)) {
    for (const n of colourTable[String(d)] || []) {
      if (notLast(n)) medium.push(n);
    }
  }

  const spicy = (moves.borrowed[family()] || []).filter(
    (n) => notLast(n) && !isDiatonic(n, tonic, mode)
  );

  return { mild, medium: medium.slice(0, 8), spicy: spicy.slice(0, 8) };
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function render(container) {
  const section = el("section", { className: "builder" });
  container.appendChild(section);

  let redraw = () => {};

  getMoves().then(
    (moves) => {
      redraw = () => {
        clear(section);
        draw(section, moves, redraw);
      };
      redraw();
    },
    () => {
      section.appendChild(
        el(
          "div",
          { className: "coming-soon" },
          el("h2", {}, "The workshop won't open"),
          el("p", {}, "The suggestion rules (data/moves.json) wouldn't load. Check the connection and come back.")
        )
      );
    }
  );
}

function draw(section, moves, redraw) {
  section.appendChild(el("h2", { className: "builder-title" }, "Build a progression"));

  // ---- Mode + key pickers -------------------------------------------------
  const modeRow = el("div", { className: "chip-row", attrs: { role: "group", "aria-label": "Mode" } });
  for (const m of MODES) {
    modeRow.appendChild(
      el(
        "button",
        {
          type: "button",
          className: "chip" + (m === mode ? " selected" : ""),
          attrs: { "aria-pressed": String(m === mode) },
          on: {
            click: () => {
              if (m === mode) return;
              const wasFamily = family();
              mode = m;
              // Numerals carry across modes of the same family well enough
              // to keep; across families they mostly stop parsing as the
              // player meant them, so start clean.
              if (family() !== wasFamily) {
                chosen = [];
                tonic = tonics()[0];
              }
              redraw();
            },
          },
        },
        capitalise(m)
      )
    );
  }

  const keyRow = el("div", { className: "key-row", attrs: { role: "group", "aria-label": "Key" } });
  for (const t of tonics()) {
    keyRow.appendChild(
      el(
        "button",
        {
          type: "button",
          className: "key-btn" + (t === tonic ? " selected" : ""),
          attrs: { "aria-pressed": String(t === tonic) },
          on: {
            click: () => {
              tonic = t;
              redraw();
            },
          },
        },
        prettyNote(t)
      )
    );
  }

  section.appendChild(
    el(
      "div",
      { className: "build-pickers" },
      el("div", { className: "lib-picker" }, el("h3", {}, "Mode"), modeRow),
      el("div", { className: "lib-picker" }, el("h3", {}, "Key"), keyRow)
    )
  );

  // ---- The progression so far --------------------------------------------
  const currentHost = el("div", { className: "build-current" });
  section.appendChild(currentHost);
  fillCurrent(currentHost, redraw);

  // ---- Suggestions ---------------------------------------------------------
  const { mild, medium, spicy } = computeSuggestions(moves);
  const groups = [
    ["🌶", "In the scale", mild, "The scale's own chords, likeliest moves first."],
    ["🌶🌶", "Tasteful colour", medium, "The same destinations with a note added or the bass moved."],
    ["🌶🌶🌶", "Borrowed & chromatic", spicy, "From outside the scale. One at a time goes a long way."],
  ];

  const sugHost = el("div", { className: "build-suggestions" });
  sugHost.appendChild(
    el(
      "h3",
      {},
      chosen.length
        ? `After ${prettySymbol(realize(chosen[chosen.length - 1], tonic).symbol)}, try…`
        : "Start with…"
    )
  );
  sugHost.appendChild(legendCaption());

  for (const [chillies, label, numerals, blurb] of groups) {
    if (!numerals.length) continue;
    const row = el("div", { className: "build-sug-row" });
    for (const n of numerals) row.appendChild(suggestionBtn(n, redraw));
    sugHost.appendChild(
      el(
        "div",
        { className: "build-sug-group" },
        el(
          "h4",
          {},
          el("span", { className: "build-chillies", attrs: { "aria-hidden": "true" } }, chillies),
          " " + label
        ),
        el("p", { className: "build-sug-blurb" }, blurb),
        row
      )
    );
  }
  section.appendChild(sugHost);

  // ---- Save ----------------------------------------------------------------
  section.appendChild(saveBlock(redraw));

  // ---- Saved progressions --------------------------------------------------
  section.appendChild(savedBlock(redraw));
}

function suggestionBtn(numeral, redraw) {
  const realized = realize(numeral, tonic);
  const cls = tintClass(numeral, tonic, mode);
  const level = complexity.rate([realized], state.instrument).level;
  const full = chosen.length >= MAX_CHORDS;
  return el(
    "button",
    {
      type: "button",
      className: "build-sug" + (full ? " disabled" : ""),
      disabled: full || null,
      attrs: { "aria-label": `Add ${realized.symbol}` },
      on: {
        click: () => {
          if (chosen.length >= MAX_CHORDS) return;
          chosen.push(numeral);
          redraw();
        },
      },
    },
    el("span", { className: "build-sug-symbol " + cls }, prettySymbol(realized.symbol)),
    el("span", { className: "build-sug-numeral " + cls }, formatDisplay(numeral)),
    el("span", { className: "badge small " + levelClass(level) }, level)
  );
}

function fillCurrent(host, redraw) {
  if (!chosen.length) {
    host.appendChild(
      el(
        "p",
        { className: "build-empty" },
        "Nothing yet. Pick a first chord below and keep tapping. The suggestions follow you."
      )
    );
    return;
  }

  const strip = el("div", { className: "build-strip" });
  chosen.forEach((n, i) => {
    const realized = realize(n, tonic);
    const cls = tintClass(n, tonic, mode);
    strip.appendChild(
      el(
        "span",
        { className: "build-chip" },
        el("span", { className: "build-chip-symbol " + cls }, prettySymbol(realized.symbol)),
        el("span", { className: "build-chip-numeral " + cls }, formatDisplay(n)),
        el(
          "button",
          {
            type: "button",
            className: "build-chip-remove",
            attrs: { "aria-label": `Remove ${realized.symbol}` },
            on: {
              click: () => {
                chosen.splice(i, 1);
                redraw();
              },
            },
          },
          "✕"
        )
      )
    );
  });

  const rating = complexity.rate(chosen.map((n) => realize(n, tonic)), state.instrument);

  host.appendChild(
    el(
      "div",
      { className: "build-current-head" },
      el("h3", {}, "So far"),
      el("span", { className: "badge " + levelClass(rating.level) }, rating.level),
      el(
        "button",
        {
          type: "button",
          className: "build-clear",
          on: {
            click: () => {
              chosen = [];
              redraw();
            },
          },
        },
        "Clear"
      )
    )
  );
  host.appendChild(strip);
  host.appendChild(
    el(
      "p",
      { className: "build-note" },
      `${chosen.length} ${chosen.length === 1 ? "bar" : "bars"} of 4/4. Each chord holds one bar in this first version.` +
        (chosen.length >= MAX_CHORDS ? " That's the ceiling: 16 bars." : "")
    )
  );
}

function saveBlock(redraw) {
  const input = el("input", {
    className: "build-name",
    type: "text",
    value: draftName,
    placeholder: "Name it (e.g. Rainy Tuesday)",
    attrs: { "aria-label": "Progression name", maxlength: "60" },
    on: { input: (ev) => (draftName = ev.target.value) },
  });

  const status = el("p", { className: "build-save-status" });

  const btn = el(
    "button",
    {
      type: "button",
      className: "build-save-btn",
      on: {
        click: () => {
          const name = draftName.trim();
          if (chosen.length < 2) {
            status.textContent = "Two chords minimum. One chord is a drone, not a progression.";
            return;
          }
          if (!name) {
            status.textContent = "Give it a name first so you can find it again.";
            return;
          }
          const entry = {
            id: newBuiltId(),
            name,
            mode,
            numerals: chosen.map((n) => ({ numeral: n, beats: 4 })),
            bars: chosen.length,
            timeSig: "4/4",
            homeKey: tonic,
            tempo: "mid",
            moods: [],
            genres: [],
            instrument: "both",
            notes: "",
            songs: [],
          };
          saveBuilt(entry);
          registerBuiltEntry(entry);
          draftName = "";
          chosen = [];
          redraw();
        },
      },
    },
    "Save to my hoard"
  );

  return el(
    "div",
    { className: "build-save" },
    el("h3", {}, "Save it"),
    el(
      "p",
      { className: "build-sug-blurb" },
      "Saved progressions join the Hoard under My progressions, with cards, keys, capo, performance mode and pins like everything else."
    ),
    el("div", { className: "build-save-row" }, input, btn),
    status
  );
}

function savedBlock(redraw) {
  const saved = builtEntries();
  const host = el("div", { className: "build-saved" }, el("h3", {}, "My progressions"));
  if (!saved.length) {
    host.appendChild(
      el("p", { className: "build-sug-blurb" }, "Nothing saved yet. Saved progressions gather here and in the Hoard.")
    );
    return host;
  }
  for (const entry of saved) {
    host.appendChild(
      el(
        "div",
        { className: "build-saved-row" },
        el(
          "div",
          { className: "build-saved-text" },
          el("a", { className: "build-saved-name", href: "#/prog/" + encodeURIComponent(entry.id) }, entry.name),
          el(
            "span",
            { className: "build-saved-meta" },
            `${prettyNote(entry.homeKey)} ${entry.mode} · ${entry.bars} ${entry.bars === 1 ? "bar" : "bars"}`
          )
        ),
        el(
          "button",
          {
            type: "button",
            className: "build-saved-load",
            attrs: { title: "Load a copy into the builder" },
            on: {
              click: () => {
                mode = entry.mode;
                tonic = entry.homeKey;
                chosen = entry.numerals.map((n) => n.numeral);
                draftName = entry.name;
                redraw();
                window.scrollTo(0, 0);
              },
            },
          },
          "Load"
        ),
        el(
          "button",
          {
            type: "button",
            className: "build-saved-delete",
            attrs: { "aria-label": `Delete ${entry.name}` },
            on: {
              click: () => {
                deleteBuilt(entry.id);
                unregisterBuiltEntry(entry.id);
                redraw();
              },
            },
          },
          "Delete"
        )
      )
    );
  }
  return host;
}
