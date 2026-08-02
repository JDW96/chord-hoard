// app.js — Chord Hoard app shell: hash router, view registry, shared state,
// data loading. Views are small modules that export render(container, params).
//
// Routes:
//   #/hoard                    browse/search the hoard (default)
//   #/prog/<id>                progression detail
//   #/perform/<id>[/<tonic>]   performance mode (full-screen, wake lock)
//   #/chords[/<root>/<qual>]   chord library
//   #/scales[/<tonic>/<mode>]  scale library
//   #/build                    dynamic builder (phase-4 placeholder)

import * as progression from "../engine/progression.js";
import * as complexity from "../engine/complexity.js";
import { el, clear, fetchJSON, storageGet, storageSet } from "./util.js";
import * as hoard from "./hoard.js";
import * as detail from "./detail.js";
import * as perform from "./perform.js";
import * as chordsLib from "./chords-lib.js";
import * as scalesLib from "./scales-lib.js";

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

export const state = {
  vocab: null, // parsed data/vocab.json
  entries: [], // all progression entries, load order
  byId: new Map(), // id → entry
  instrument: "guitar", // "guitar" | "piano" — header toggle, persisted
  renderCache: new Map(), // "id|tonic" → progression.render result
  ratingCache: new Map(), // "id|tonic|instrument" → complexity.rate result
};

const INSTRUMENT_KEY = "chordhoard.instrument";

/** Render a progression entry in a tonic, cached per (entry, tonic). */
export function renderIn(entry, tonic) {
  const key = entry.id + "|" + tonic;
  let rendered = state.renderCache.get(key);
  if (!rendered) {
    rendered = progression.render(entry, tonic);
    state.renderCache.set(key, rendered);
  }
  return rendered;
}

/**
 * Complexity rating for an entry in a tonic on an instrument, cached.
 * Rated over the progression's full chord sequence (level = hardest chord).
 */
export function ratingIn(entry, tonic, instrument) {
  const key = entry.id + "|" + tonic + "|" + instrument;
  let rating = state.ratingCache.get(key);
  if (!rating) {
    rating = complexity.rate(renderIn(entry, tonic).chords, instrument);
    state.ratingCache.set(key, rating);
  }
  return rating;
}

export function setInstrument(instrument) {
  if (instrument !== "guitar" && instrument !== "piano") return;
  state.instrument = instrument;
  storageSet(INSTRUMENT_KEY, instrument);
  reflectInstrumentToggle();
  renderRoute(); // complexity badges, filters and diagrams all depend on it
}

// ---------------------------------------------------------------------------
// Placeholder views ("coming soon")
// ---------------------------------------------------------------------------

function comingSoon(title, blurb) {
  return {
    render(container) {
      container.appendChild(
        el(
          "section",
          { className: "coming-soon" },
          el("h2", {}, title),
          el("p", {}, blurb),
          el("p", { className: "coming-soon-tag" }, "Coming soon")
        )
      );
    },
  };
}

// ---------------------------------------------------------------------------
// VIEW REGISTRY — the one obvious place views plug in.
//
// ═══ EXTENSION POINT (wave 2) ═══
// To ship a real Chords / Scales / Build / Perform view, write a module in
// js/ui/ exporting render(container, params) and swap it in below. Nothing
// else in the shell needs to change. `params` is the array of path segments
// after the route name (e.g. #/prog/abc → ["abc"]).
// ═══════════════════════════════
// ---------------------------------------------------------------------------

const views = {
  hoard: { render: hoard.render },
  prog: { render: detail.render },
  perform: { render: perform.render },
  chords: { render: chordsLib.render },
  scales: { render: scalesLib.render },
  build: comingSoon(
    "Progression builder",
    "Start from one chord and let the hoard suggest where to go next — mild, medium or spicy. Still in the workshop."
  ),
};

// Which bottom tab lights up for each route.
const TAB_FOR_ROUTE = {
  hoard: "hoard",
  prog: "hoard",
  perform: "hoard",
  chords: "chords",
  scales: "scales",
  build: "build",
};

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

function parseHash() {
  const hash = location.hash || "#/hoard";
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const route = parts[0] || "hoard";
  return { route, params: parts.slice(1) };
}

let dataReady = false;
let dataError = null;

function renderRoute() {
  const main = document.getElementById("view");
  if (!main) return;
  clear(main);

  if (dataError) {
    main.appendChild(
      el(
        "section",
        { className: "coming-soon" },
        el("h2", {}, "The hoard won't open"),
        el("p", {}, "Something went wrong loading the data. " + dataError),
        el("p", {}, "If you opened index.html straight from disk, try serving the folder instead (any static server will do).")
      )
    );
    return;
  }
  if (!dataReady) {
    main.appendChild(el("p", { className: "loading" }, "Opening the hoard…"));
    return;
  }

  const { route, params } = parseHash();
  const view = views[route] || views.hoard;
  updateTabs(TAB_FOR_ROUTE[route] || "hoard");
  document.body.dataset.route = views[route] ? route : "hoard";
  view.render(main, params);
  main.scrollTop = 0;
  window.scrollTo(0, 0);
}

function updateTabs(active) {
  for (const tab of document.querySelectorAll(".tabbar a")) {
    const isActive = tab.dataset.tab === active;
    tab.classList.toggle("active", isActive);
    if (isActive) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  }
}

// ---------------------------------------------------------------------------
// Data loading — manifest of progression files, all RELATIVE paths
// ---------------------------------------------------------------------------

async function loadData() {
  const [vocab, manifest] = await Promise.all([
    fetchJSON("data/vocab.json"),
    fetchJSON("data/progressions/index.json"),
  ]);
  // The manifest is {files:[…]} (or a bare array, for forwards compatibility).
  const files = Array.isArray(manifest) ? manifest : manifest.files;
  const batches = await Promise.all(
    files.map((file) => fetchJSON("data/progressions/" + file))
  );
  state.vocab = vocab;
  state.entries = batches.flat();
  state.byId = new Map(state.entries.map((entry) => [entry.id, entry]));
}

// ---------------------------------------------------------------------------
// Header instrument toggle
// ---------------------------------------------------------------------------

function reflectInstrumentToggle() {
  for (const btn of document.querySelectorAll(".instrument-toggle button")) {
    const isActive = btn.dataset.instrument === state.instrument;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-pressed", String(isActive));
  }
}

function wireHeader() {
  for (const btn of document.querySelectorAll(".instrument-toggle button")) {
    btn.addEventListener("click", () => setInstrument(btn.dataset.instrument));
  }
  reflectInstrumentToggle();
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function init() {
  const saved = storageGet(INSTRUMENT_KEY, "guitar");
  state.instrument = saved === "piano" ? "piano" : "guitar";
  wireHeader();
  window.addEventListener("hashchange", renderRoute);
  renderRoute(); // loading state
  try {
    await loadData();
    dataReady = true;
  } catch (err) {
    dataError = err && err.message ? err.message : String(err);
  }
  renderRoute();
}

// Guarded so the module can be imported outside a browser (syntax checks).
if (typeof document !== "undefined") {
  init();
}
