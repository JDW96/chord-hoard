// util.js — small shared DOM + formatting helpers for the Chord Hoard UI.
//
// Everything that touches user-visible strings from the data files goes
// through DOM textContent (via el/text below) — never innerHTML — so nothing
// from a JSON file can inject markup.

/**
 * Create an element. `props` may include className, dataset entries via
 * `data` object, attributes via `attrs` object, event listeners via `on`
 * object, and any direct property (href, type, value…). Children may be
 * nodes, strings (added as text nodes), arrays, or null/undefined (skipped).
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null) continue;
    if (key === "class" || key === "className") node.className = value;
    else if (key === "data") {
      for (const [k, v] of Object.entries(value)) node.dataset[k] = v;
    } else if (key === "attrs") {
      for (const [k, v] of Object.entries(value)) node.setAttribute(k, v);
    } else if (key === "on") {
      for (const [k, v] of Object.entries(value)) node.addEventListener(k, v);
    } else {
      node[key] = value;
    }
  }
  appendChildren(node, children);
  return node;
}

function appendChildren(node, children) {
  for (const child of children) {
    if (child == null || child === false) continue;
    if (Array.isArray(child)) appendChildren(node, child);
    else if (child instanceof Node) node.appendChild(child);
    else node.appendChild(document.createTextNode(String(child)));
  }
}

/** Remove every child of a node. */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/**
 * Escape a string for safe inclusion in HTML/attribute contexts. Prefer
 * building DOM via el(); this exists for the rare string-template case
 * (e.g. titles handed to SVG builders).
 */
export function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Pretty-print a chord symbol for display: ASCII accidentals → Unicode.
 * "Bbm7/F" → "B♭m7/F", "F#sus4" → "F♯sus4". Only touches accidentals that
 * directly follow a note letter, so "b" in a suffix is left alone.
 */
export function prettySymbol(symbol) {
  return String(symbol).replace(
    /([A-G])(bb|b|##|#)/g,
    (_, letter, acc) =>
      letter + acc.replaceAll("b", "♭").replaceAll("#", "♯")
  );
}

/** Pretty-print a tonic note name: "Bb" → "B♭". */
export function prettyNote(name) {
  return prettySymbol(name);
}

/** Read a JSON value from localStorage, falling back on any problem. */
export function storageGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** Write a JSON value to localStorage; failures (private mode) are ignored. */
export function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — the app still works, it just forgets */
  }
}

/** Fetch a JSON file by RELATIVE path (subpath-hosting safe). */
export async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
  return res.json();
}

// Guitar voicing shapes (data/guitar-chords.json), fetched once and shared by
// the detail view and the chord library. A failed fetch is not cached, so a
// flaky connection gets another go on the next visit.
let guitarDataPromise = null;

/** Lazily load and cache data/guitar-chords.json. */
export function getGuitarData() {
  if (!guitarDataPromise) {
    guitarDataPromise = fetchJSON("data/guitar-chords.json").catch((err) => {
      guitarDataPromise = null; // retry on next visit
      throw err;
    });
  }
  return guitarDataPromise;
}

/** Capitalise the first letter of a word (for chips: "major" → "Major"). */
export function capitalise(word) {
  return word ? word[0].toUpperCase() + word.slice(1) : word;
}

/** CSS class for a complexity level badge: "P3" → "lv-3", "G1" → "lv-1". */
export function levelClass(level) {
  return "lv-" + String(level).slice(1);
}
