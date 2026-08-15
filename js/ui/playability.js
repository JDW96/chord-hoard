// playability.js — personal playability profiles (phase 4).
//
// A profile is a map of chord symbol → "playable" | "shaky" | "nope", kept
// PER INSTRUMENT under chordhoard.playability: an F barre chord is a guitar
// problem and no problem at all on piano. Symbols are the realised names
// ("F#m7", "Bb/D"), the same string complexity.rate() reports, so one mark
// covers that chord everywhere it appears, in every progression.
//
// What counts as playable when nothing is marked: a chord at the bottom
// complexity level (P1/G1 — Jack's baseline by definition) is assumed
// playable; anything higher is assumed not, until marked. Marks always win.

import { el, storageGet, storageSet } from "./util.js";

const KEY = "chordhoard.playability";
export const STATUSES = ["playable", "shaky", "nope"];

function allProfiles() {
  const raw = storageGet(KEY, {});
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}

/** The symbol → status map for one instrument (a plain object, maybe empty). */
export function profileFor(instrument) {
  const prof = allProfiles()[instrument];
  return prof && typeof prof === "object" ? prof : {};
}

/** The saved status for a chord symbol on an instrument, or null. */
export function statusFor(symbol, instrument) {
  const status = profileFor(instrument)[symbol];
  return STATUSES.includes(status) ? status : null;
}

/** Save (or with null/repeat, clear) a chord's status for an instrument. */
export function setStatus(symbol, instrument, status) {
  const all = allProfiles();
  if (!all[instrument] || typeof all[instrument] !== "object") all[instrument] = {};
  if (status && STATUSES.includes(status)) all[instrument][symbol] = status;
  else delete all[instrument][symbol];
  storageSet(KEY, all);
}

/**
 * Is this chord playable, given its computed level and any saved mark?
 * @param {string} symbol      realised chord symbol
 * @param {string} instrument  "guitar" | "piano"
 * @param {string} level       computed level for that chord ("P1"…"G3")
 */
export function isPlayable(symbol, instrument, level) {
  const status = statusFor(symbol, instrument);
  if (status) return status === "playable";
  return String(level).endsWith("1"); // baseline level = assumed playable
}

// ---------------------------------------------------------------------------
// Marker control — a small segmented row (Playable / Shaky / Nope), the same
// wherever chords can be marked (diagram popup, Chords tab). Tapping the
// active option clears the mark back to the computed default.
// ---------------------------------------------------------------------------

const LABELS = { playable: "Playable", shaky: "Shaky", nope: "Nope" };

/**
 * Build the marker row for a chord symbol on an instrument.
 * @param {(status: string|null) => void} [onChange] after every change
 */
export function playabilityRow(symbol, instrument, onChange) {
  const row = el("div", {
    className: "playability-row",
    attrs: { role: "group", "aria-label": `Can you play ${symbol}?` },
  });
  const buttons = new Map();

  function reflect() {
    const current = statusFor(symbol, instrument);
    for (const [status, btn] of buttons) {
      const active = status === current;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    }
  }

  for (const status of STATUSES) {
    const btn = el(
      "button",
      {
        type: "button",
        className: "playability-btn " + status,
        on: {
          click: () => {
            const next = statusFor(symbol, instrument) === status ? null : status;
            setStatus(symbol, instrument, next);
            reflect();
            if (onChange) onChange(next);
          },
        },
      },
      LABELS[status]
    );
    buttons.set(status, btn);
    row.appendChild(btn);
  }

  reflect();
  return el(
    "div",
    { className: "playability" },
    el(
      "p",
      { className: "playability-label" },
      `Can you play this on ${instrument}?`
    ),
    row
  );
}
