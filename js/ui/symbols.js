// symbols.js — the "Fake Book" symbology (design-system/STYLEGUIDE.md §4).
//
// Three marks carry information that used to be carried by words, and each
// means exactly one thing everywhere it appears:
//
//   beats      → round dots, one per beat
//   difficulty → rising bars, filled count = level
//   metadata   → an ALL-CAPS monospace line, always quiet
//
// This is the ONE place they're built, so the Hoard, the detail chart and
// the performance stage can never draw the same fact two different ways —
// the same reasoning as chord-copy.js owning chord prose and
// function-tint.js owning the harmony colours.
//
// Colour comes from CSS tokens only (--lv-*, --beat-*), never from
// attributes here, so both themes stay correct without this file knowing
// which one is active.

import { el } from "./util.js";

// How many rungs each instrument's complexity ladder has. Guitar tops out at
// G3 and piano at P4 (CLAUDE.md's level definitions), so the bar count has to
// follow the instrument or a G3 would read as "not quite the hardest".
const LADDER_SIZE = { P: 4, G: 3 };

/**
 * Rising bars for a complexity level ("G2", "P4"). Bars are bottom-aligned
 * and rise left to right; the first `level` of them take that level's colour
 * and the rest sit unfilled in --lv-off.
 *
 * Replaces the text badge wherever a glance is enough. The detail view keeps
 * a labelled badge as well, because that's the one screen where you might
 * actually want to read "G1" rather than count bars.
 */
export function levelBars(level, { title } = {}) {
  const str = String(level || "");
  const family = str[0] === "P" ? "P" : "G";
  const total = LADDER_SIZE[family];
  const filled = Math.max(0, Math.min(total, parseInt(str.slice(1), 10) || 0));

  const wrap = el("span", {
    className: "level-bars lv-" + filled,
    attrs: {
      role: "img",
      "aria-label": `Complexity ${str}`,
      title: title || `Complexity ${str}`,
    },
  });
  for (let i = 0; i < total; i += 1) {
    // The height ramp lives in CSS (nth-child), so a 3-bar guitar ladder and
    // a 4-bar piano ladder end at the same overall height and the two never
    // look like different-sized controls sitting side by side.
    wrap.appendChild(
      el("span", {
        className: "level-bar" + (i < filled ? " on" : ""),
        attrs: { "aria-hidden": "true" },
      })
    );
  }
  return wrap;
}

/**
 * One round dot per beat. `filled` is how many are lit (playback fills them
 * left to right within the sounding chord); omit it for the neutral,
 * nothing-playing state used while browsing.
 *
 * `tint` is a .fn-* class from function-tint.js. Applying it to the WRAPPER
 * rather than each dot means the dots inherit the chord's function colour
 * through `currentColor` (that's what --beat-on resolves to), so a tint that
 * is switched off by body[data-tint="off"] takes the dots with it for free.
 */
export function beatDots(beats, { filled = 0, tint = "", size = "" } = {}) {
  const total = Math.max(0, Math.floor(beats) || 0);
  const wrap = el("span", {
    className: ["beat-dots", size ? "beat-dots-" + size : "", tint].filter(Boolean).join(" "),
    attrs: { role: "img", "aria-label": `${total} ${total === 1 ? "beat" : "beats"}` },
  });
  for (let i = 0; i < total; i += 1) {
    wrap.appendChild(
      el("span", {
        className: "beat-dot" + (i < filled ? " on" : ""),
        attrs: { "aria-hidden": "true" },
      })
    );
  }
  return wrap;
}

/**
 * A metadata line: ALL-CAPS monospace, letter-spaced, always --ink-faint.
 *
 * `parts` are joined with " · ". A part may be a string, a node, or null
 * (skipped, so callers can inline conditionals without filtering first).
 * Strings are upper-cased by CSS, not here, so the underlying text stays
 * readable to screen readers and searchable in the DOM.
 *
 * Moods are the deliberate exception — pass them via `lower()` so they read
 * as words rather than codes inside the caps line (STYLEGUIDE §5.1).
 */
export function metaLine(parts, { className = "", tag = "p" } = {}) {
  const kept = parts.filter((p) => p != null && p !== "");
  const children = [];
  kept.forEach((part, i) => {
    if (i > 0) children.push(el("span", { className: "meta-sep", attrs: { "aria-hidden": "true" } }, " · "));
    children.push(part);
  });
  return el(tag, { className: "meta" + (className ? " " + className : "") }, ...children);
}

/** Mark a meta part as lower-case (moods, which read as words not codes). */
export function lower(text) {
  return el("span", { className: "meta-lower" }, text);
}

/** Mark a meta part with a complexity colour (the detail view's "G1"). */
export function metaLevel(level) {
  return el("span", { className: "meta-level lv-" + String(level).slice(1) }, String(level));
}
