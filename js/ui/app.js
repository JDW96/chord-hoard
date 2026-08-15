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
import * as builder from "./builder.js";
import { builtEntries } from "./built.js";
import { openSettingsPanel, settingsRow } from "./settings-panel.js";
import { legendCaption } from "./function-tint.js";
import { downloadBackup, importBackup } from "./backup.js";

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

export const state = {
  vocab: null, // parsed data/vocab.json
  collectionLabels: {}, // collection key → display label, from the manifest
  entries: [], // all progression entries, load order
  byId: new Map(), // id → entry
  instrument: "guitar", // "guitar" | "piano" — header toggle, persisted
  functionTint: true, // harmonic-function colouring — header toggle, persisted
  renderCache: new Map(), // "id|tonic" → progression.render result
  ratingCache: new Map(), // "id|tonic|instrument" → complexity.rate result
};

const INSTRUMENT_KEY = "chordhoard.instrument";
const TINT_KEY = "chordhoard.functionTint";

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

/**
 * Toggle harmonic-function tinting. This is CSS-only: the .fn-* classes are
 * always present on the tinted spans (see function-tint.js), and this just
 * flips body[data-tint] to show or hide the colour — no re-render needed.
 */
export function setFunctionTint(on) {
  state.functionTint = !!on;
  storageSet(TINT_KEY, state.functionTint ? "on" : "off");
  reflectFunctionTint();
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
  build: { render: builder.render },
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

  // Set before the loading/error branches: CSS scopes the header instrument
  // toggle on this attribute, and it should not flash in on a slow first load.
  const parsed = parseHash();
  document.body.dataset.route = views[parsed.route] ? parsed.route : "hoard";

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

  const { route, params } = parsed;
  const view = views[route] || views.hoard;
  updateTabs(TAB_FOR_ROUTE[route] || "hoard");
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
  state.collectionLabels = (!Array.isArray(manifest) && manifest.collections) || {};
  // Which themed file an entry came from is derived here rather than stored on
  // all 349 entries. Load order is manifest order, so the Collection filter
  // lists them in the order the manifest sets rather than alphabetically.
  state.entries = batches.flatMap((batch, i) => {
    const collection = files[i].replace(/\.json$/, "");
    return batch.map((entry) => ({ ...entry, collection }));
  });
  // Progressions saved from the builder (chordhoard.built) join the list
  // under their own derived collection, so cards, filters, detail view and
  // performance mode treat them like any other entry.
  state.collectionLabels = { ...state.collectionLabels, built: "My progressions" };
  state.entries.push(
    ...builtEntries().map((entry) => ({ ...entry, collection: "built" }))
  );
  state.byId = new Map(state.entries.map((entry) => [entry.id, entry]));
}

/** Register a just-saved builder progression into the running app. */
export function registerBuiltEntry(entry) {
  const withCollection = { ...entry, collection: "built" };
  state.entries.push(withCollection);
  state.byId.set(entry.id, withCollection);
}

/** Remove a deleted builder progression from the running app. */
export function unregisterBuiltEntry(id) {
  state.entries = state.entries.filter((entry) => entry.id !== id);
  state.byId.delete(id);
}

/** Display label for a collection key, falling back to the key itself. */
export function collectionLabel(key) {
  return (state.collectionLabels && state.collectionLabels[key]) || key;
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

function reflectFunctionTint() {
  document.body.dataset.tint = state.functionTint ? "on" : "off";
}

// ---------------------------------------------------------------------------
// Settings panel (backlog item 15) — reachable from every route via the
// header's permanent cog icon, rather than a one-off toggle that only made
// sense on some routes. Currently one row (colour tinting); more settings
// (a light/dark override is the obvious next one) become more rows here,
// not more header icons.
// ---------------------------------------------------------------------------

export function buildSettingsPanel(body) {
  const switchBtn = el(
    "button",
    {
      type: "button",
      className: "settings-switch" + (state.functionTint ? " active" : ""),
      attrs: { "aria-pressed": String(state.functionTint) },
      on: {
        click: () => {
          setFunctionTint(!state.functionTint);
          switchBtn.classList.toggle("active", state.functionTint);
          switchBtn.setAttribute("aria-pressed", String(state.functionTint));
          switchBtn.textContent = state.functionTint ? "On" : "Off";
        },
      },
    },
    state.functionTint ? "On" : "Off"
  );
  body.appendChild(
    settingsRow(
      "Colour by function",
      "Tint chords by harmonic role on the Hoard, Chords, Scales, detail and performance views.",
      switchBtn
    )
  );
  body.appendChild(legendCaption());

  // ---- Backup: export / import (phase 4) --------------------------------
  // Everything personal (pins, key choices, voicing picks, playability,
  // settings) lives under chordhoard.* keys; backup.js sweeps the prefix.
  body.appendChild(
    settingsRow(
      "Back up your hoard",
      "Download pins, key choices, voicing picks and settings as one JSON file.",
      el(
        "button",
        {
          type: "button",
          className: "settings-action",
          on: { click: downloadBackup },
        },
        "Download"
      )
    )
  );

  const importStatus = el("p", { className: "settings-status" });
  const fileInput = el("input", {
    type: "file",
    className: "settings-file",
    attrs: { accept: "application/json,.json", "aria-hidden": "true", tabindex: "-1" },
    on: {
      change: async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        try {
          const written = await importBackup(file);
          importStatus.textContent = written
            ? `Restored ${written} ${written === 1 ? "item" : "items"}. Reloading…`
            : "That backup was empty, so nothing changed.";
          if (written) setTimeout(() => location.reload(), 600);
        } catch (err) {
          importStatus.textContent = err && err.message ? err.message : String(err);
        }
        fileInput.value = "";
      },
    },
  });
  body.appendChild(
    settingsRow(
      "Restore a backup",
      "Load a backup file. Matching items are replaced; everything else stays.",
      el(
        "button",
        {
          type: "button",
          className: "settings-action",
          on: { click: () => fileInput.click() },
        },
        "Choose file"
      )
    )
  );
  body.appendChild(fileInput);
  body.appendChild(importStatus);
}

function wireHeader() {
  for (const btn of document.querySelectorAll(".instrument-toggle button")) {
    btn.addEventListener("click", () => setInstrument(btn.dataset.instrument));
  }
  reflectInstrumentToggle();
  const settingsBtn = document.querySelector(".settings-btn");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => openSettingsPanel(buildSettingsPanel));
  }
  reflectFunctionTint();
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function init() {
  const saved = storageGet(INSTRUMENT_KEY, "guitar");
  state.instrument = saved === "piano" ? "piano" : "guitar";
  state.functionTint = storageGet(TINT_KEY, "on") !== "off";
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
