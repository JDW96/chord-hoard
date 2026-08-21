// words.js — the random word generator's UI side (roadmap 2.4): the lyric
// prompt banner, its reroll dice, and the storage behind the shuffle bag.
//
// Four words, one per tier, shown in tier order 1 to 4 so the plain-to-rare
// gradient reads left to right. The gradient is never explained anywhere in
// the UI: it just reads as four different flavours of inspiration.
//
// Words are deliberately NOT coupled to the harmony on screen. Mood tagging
// and harmonic-function biasing were both designed and both rejected — for
// improv the words work better as an orthogonal axis, and coupling them
// narrows what you can do with them rather than widening it.
//
// On/off is body[data-words], the same CSS-only pattern as the function-tint
// toggle: both the banner and (in performance mode) the colour legend are
// always in the DOM and the attribute decides which one paints. Flipping it
// never needs a re-render, which matters because the settings cog is
// reachable from inside performance mode.

import { el, clear, fetchJSON, storageGet, storageSet } from "./util.js";
import { normaliseBags, drawSet, SEED_RANGE, TIER_KEYS } from "../engine/word-bag.js";

const WORDS_KEY = "chordhoard.words";

/** Fresh randomness for a new shuffle: the ONE unseeded random in the feature. */
function randomSeed() {
  return Math.floor(Math.random() * SEED_RANGE) >>> 0;
}

// data/words.json, fetched once and shared. Same lazy pattern as
// getGuitarData()/getMoves(): the promise is nulled in .catch so a flaky
// connection gets another go rather than caching the failure forever.
let wordsPromise = null;

export function getWordsData() {
  if (!wordsPromise) {
    wordsPromise = fetchJSON("data/words.json").catch((err) => {
      wordsPromise = null;
      throw err;
    });
  }
  return wordsPromise;
}

// ---------------------------------------------------------------------------
// Setting: on/off. Defaults to ON (right for Jack; see the roadmap's
// "flagged for release" note before any wider release).
// ---------------------------------------------------------------------------

const listeners = new Set();

function stored() {
  const raw = storageGet(WORDS_KEY, null);
  return raw && typeof raw === "object" ? raw : {};
}

export function wordsEnabled() {
  return stored().enabled !== false;
}

/** Reflect the current setting onto <body>, which is what CSS keys off. */
export function reflectWords() {
  document.body.dataset.words = wordsEnabled() ? "on" : "off";
}

export function setWordsEnabled(on) {
  storageSet(WORDS_KEY, { ...stored(), enabled: !!on });
  reflectWords();
  for (const fn of listeners) fn();
}

/**
 * Turn the banner off for this session only, without touching the stored
 * preference — used when data/words.json can't be loaded, so the feature
 * bows out quietly and (in performance mode) the colour legend comes back.
 */
function markUnavailable() {
  document.body.dataset.words = "off";
  for (const fn of listeners) fn();
}

/** Subscribe to on/off changes. Returns an unsubscribe function. */
export function onWordsToggle(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/**
 * Draw four words and persist the advanced bags. Synchronous — callers hold
 * the already-fetched data — so a reroll or a loop boundary never waits.
 */
export function drawWords(data) {
  const tiers = (data && data.tiers) || {};
  const sizes = {};
  for (const tier of TIER_KEYS) sizes[tier] = (tiers[tier] || []).length;
  const saved = stored();
  const bags = normaliseBags(
    { version: saved.version, bags: saved.bags },
    data.version,
    sizes,
    randomSeed
  );
  const { words, next } = drawSet(bags, tiers, randomSeed);
  storageSet(WORDS_KEY, { ...saved, version: data.version, bags: next.bags });
  return words;
}

// ---------------------------------------------------------------------------
// The banner component — shared by the detail view and all three perform
// routes, so a lyric prompt looks and behaves the same wherever it appears.
// ---------------------------------------------------------------------------

/**
 * Build a word banner.
 *
 * `onLayout` is called whenever the banner's height might have changed (words
 * arriving, the setting flipping, a failed fetch) — performance mode passes
 * its layout() so the fit-to-viewport maths re-runs.
 *
 * Returns `{ node, reroll, dispose }`. `reroll()` draws a fresh set without
 * leaving the view (the roadmap's own reasoning: otherwise rejecting a bad
 * set costs four taps mid-rehearsal). `dispose()` unsubscribes.
 */
export function createWordBanner({ className = "", onLayout = () => {} } = {}) {
  const wordsHost = el("div", { className: "word-banner-words" });
  const rerollBtn = el(
    "button",
    {
      type: "button",
      className: "word-banner-reroll",
      attrs: { "aria-label": "New words", title: "Draw four new words" },
      on: { click: () => reroll() },
    },
    "🎲"
  );
  const node = el(
    "div",
    { className: "word-banner" + (className ? " " + className : "") },
    wordsHost,
    rerollBtn
  );

  let data = null;

  // Four words up to 14 characters each don't always fit one line on a phone,
  // and a banner that is one line for "dog · rain · feral · kraken" and two
  // for "kitchen · cathedral · smuggler · cantankerous" jumps every time it
  // redraws. So the text shrinks to fit instead.
  //
  // The floor is measured, not guessed: over 2000 random draws at 375px wide
  // (291px of usable banner), half fit at the full size already, none needed
  // to go below 13px, and the smallest any draw asked for was 13.6px. Only
  // the theoretical worst case — the longest word in all four tiers at once
  // — needs less (12px), and that wraps rather than shrinking past
  // legibility. Re-measure this number if the type scale or the 14-character
  // cap in data/words.json ever changes.
  const MIN_WORD_PX = 13;

  function fit() {
    wordsHost.classList.remove("wrapped");
    wordsHost.style.fontSize = "";
    // Hidden (words off, or a view that hasn't been laid out yet): nothing to
    // measure. onWordsToggle and the resize listener below come back to it.
    if (!wordsHost.clientWidth) return;
    let size = parseFloat(getComputedStyle(wordsHost).fontSize) || 16;
    while (wordsHost.scrollWidth > wordsHost.clientWidth + 1 && size > MIN_WORD_PX) {
      size = Math.max(MIN_WORD_PX, size * 0.94);
      wordsHost.style.fontSize = size + "px";
    }
    // Narrower than anything we design for (a very small phone, or a future
    // caller giving the banner less room): wrap rather than shrink past
    // legibility or run the words off the edge.
    if (wordsHost.scrollWidth > wordsHost.clientWidth + 1) wordsHost.classList.add("wrapped");
  }

  function paint(words) {
    clear(wordsHost);
    // A fresh separator node per gap, not one shared node passed to
    // interleave(): appending the same element twice MOVES it, so a single
    // reused separator ends up in one gap only.
    words.forEach((word, i) => {
      if (i > 0) {
        wordsHost.appendChild(
          el("span", { className: "word-banner-sep", attrs: { "aria-hidden": "true" } }, "·")
        );
      }
      wordsHost.appendChild(el("span", { className: "word-banner-word" }, word));
    });
    fit();
    onLayout();
  }

  function reroll() {
    if (!data) return;
    paint(drawWords(data));
  }

  async function populate() {
    if (data || !wordsEnabled()) return;
    try {
      data = await getWordsData();
    } catch {
      markUnavailable(); // quietly out of the way; the view is unaffected
      return;
    }
    paint(drawWords(data));
  }

  // Toggled on after the view was built: fill in then, rather than drawing
  // (and burning bag positions) for a banner nobody can see. Already-drawn
  // words just need re-measuring, since they were hidden when last painted.
  const unsubscribe = onWordsToggle(() => {
    if (wordsEnabled()) populate();
    fit();
    onLayout();
  });

  // A rotation or a window resize changes how much room the words have.
  const onResize = () => {
    fit();
    onLayout();
  };
  window.addEventListener("resize", onResize);

  populate();

  return {
    node,
    reroll,
    dispose: () => {
      unsubscribe();
      window.removeEventListener("resize", onResize);
    },
  };
}
