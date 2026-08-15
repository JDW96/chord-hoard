// function-tint.js — thin UI wrapper around js/engine/harmony.js's classify().
//
// Turns a numeral's harmonic function into the CSS class that colours it
// (see css/app.css's ".fn-*" rules and their --fn-* tokens). This is the
// ONE place the mapping from function name to class name lives, so the
// Hoard, Chords and Scales tabs can never tint the same chord two
// different colours. The actual classification (borrowed-first, then
// tonic/subdominant/dominant by scale degree) lives in the engine.

import { classify } from "../engine/harmony.js";
import { el, interleave } from "./util.js";

/** CSS class ("fn-tonic" | "fn-subdominant" | "fn-dominant" | "fn-borrowed")
 * for a numeral's harmonic function in a given tonic + mode. */
export function tintClass(numeral, tonic, mode) {
  return "fn-" + classify(numeral, tonic, mode);
}

const FUNCTIONS = ["tonic", "subdominant", "dominant", "borrowed"];
const LABELS = {
  tonic: "Tonic",
  subdominant: "Subdominant",
  dominant: "Dominant",
  borrowed: "Borrowed",
};

/**
 * The one legend that explains what the tint colours mean, reused verbatim
 * everywhere a tinted chord appears (Hoard, Chords, Scales, detail,
 * performance) rather than each view inventing its own wording. `extraClass`
 * lets a view fit it into its own caption styling (e.g. performance mode's
 * dimmer strip text) without a second copy of this markup.
 */
export function legendCaption(extraClass) {
  return el(
    "p",
    { className: "fn-legend" + (extraClass ? " " + extraClass : "") },
    "Colour: ",
    ...interleave(FUNCTIONS, (f) => el("span", { className: "fn-" + f }, LABELS[f]), " · ")
  );
}
