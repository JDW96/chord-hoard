// function-tint.js — thin UI wrapper around js/engine/harmony.js's classify().
//
// Turns a numeral's harmonic function into the CSS class that colours it
// (see css/app.css's ".fn-*" rules and their --fn-* tokens). This is the
// ONE place the mapping from function name to class name lives, so the
// Hoard, Chords and Scales tabs can never tint the same chord two
// different colours. The actual classification (borrowed-first, then
// tonic/subdominant/dominant by scale degree) lives in the engine.

import { classify } from "../engine/harmony.js";

/** CSS class ("fn-tonic" | "fn-subdominant" | "fn-dominant" | "fn-borrowed")
 * for a numeral's harmonic function in a given tonic + mode. */
export function tintClass(numeral, tonic, mode) {
  return "fn-" + classify(numeral, tonic, mode);
}
