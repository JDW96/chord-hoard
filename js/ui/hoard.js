// hoard.js — the browse view: search, filters, and the ledger.
//
// Search matches name, moods, genres and chord names in the home key.
// Filters are chip groups: OR within a group, AND across groups.
// Complexity is computed by the engine per entry in its home key for the
// currently selected instrument, and cached in app.js's ratingCache.
//
// Results are LEDGER ROWS, not cards (STYLEGUIDE §5.2): hairline-separated
// rows straight on the paper, three lines each — name + difficulty + pin,
// the chords tinted by harmonic function, then one quiet meta line. That's
// roughly three times the density of the old card, which matters because
// the whole point of a hoard of 349 progressions is scanning it.

import { state, renderIn, ratingIn, collectionLabel } from "./app.js";
import { tintClass } from "./function-tint.js";
import { isPinned, pinButton } from "./pins.js";
import { isPlayable } from "./playability.js";
import { chosenTonic } from "./detail.js";
import * as roulette from "./roulette.js";
import { levelBars, metaLine, lower } from "./symbols.js";
import { el, clear, prettySymbol, capitalise, levelClass } from "./util.js";

// Module-level UI state so search/filters survive a trip into a detail view.
const filters = {
  pinned: new Set(), // holds "pinned" when the pins-only chip is on
  collection: new Set(), // themed batch the entry was loaded from
  mood: new Set(),
  genre: new Set(),
  mode: new Set(),
  bars: new Set(),
  timeSig: new Set(),
  tempo: new Set(),
  instrument: new Set(),
  level: new Set(), // holds values like "P2" / "G1"; only the current
  // instrument's ladder is shown and applied
  playability: new Set(), // "all" (every chord playable) / "one" (one to practise)
};
let query = "";
let sheetOpen = false;
let refresh = null; // set by render(); called when filters change

const PIANO_LADDER = ["P1", "P2", "P3", "P4"];
const GUITAR_LADDER = ["G1", "G2", "G3"];

// Search haystacks, built once per entry (home key never changes).
const haystacks = new Map();
function haystackFor(entry) {
  let hay = haystacks.get(entry.id);
  if (!hay) {
    const rendered = renderIn(entry, entry.homeKey);
    hay = [
      entry.name,
      collectionLabel(entry.collection),
      entry.moods.join(" "),
      entry.genres.join(" "),
      rendered.distinctChords.map((c) => c.symbol).join(" "),
      rendered.distinctChords.map((c) => prettySymbol(c.symbol)).join(" "),
    ]
      .join(" ")
      .toLowerCase();
    haystacks.set(entry.id, hay);
  }
  return hay;
}

function ladder() {
  return state.instrument === "piano" ? PIANO_LADDER : GUITAR_LADDER;
}

function entryLevel(entry) {
  return ratingIn(entry, entry.homeKey, state.instrument).level;
}

/**
 * How many DISTINCT chords in this entry (home key, current instrument) the
 * player can't yet play — marked playable or bottom-level unmarked counts as
 * playable, everything else (shaky, nope, unmarked higher levels) doesn't.
 * Distinct, so a chord that comes round four times is one problem, not four.
 */
function unplayableCount(entry) {
  const rating = ratingIn(entry, entry.homeKey, state.instrument);
  const seen = new Set();
  let count = 0;
  for (const chord of rating.perChord) {
    if (seen.has(chord.symbol)) continue;
    seen.add(chord.symbol);
    if (!isPlayable(chord.symbol, state.instrument, chord.level)) count += 1;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

function matchesFilters(entry) {
  if (filters.pinned.size && !isPinned(entry.id)) return false;
  if (filters.collection.size && !filters.collection.has(entry.collection)) return false;
  if (filters.mood.size && !entry.moods.some((m) => filters.mood.has(m))) return false;
  if (filters.genre.size && !entry.genres.some((g) => filters.genre.has(g))) return false;
  if (filters.mode.size && !filters.mode.has(entry.mode)) return false;
  if (filters.bars.size && !filters.bars.has(String(entry.bars))) return false;
  if (filters.timeSig.size && !filters.timeSig.has(entry.timeSig)) return false;
  if (filters.tempo.size && !filters.tempo.has(entry.tempo)) return false;
  if (filters.instrument.size && !filters.instrument.has(entry.instrument)) return false;
  // Only level values on the current instrument's ladder count.
  const activeLevels = ladder().filter((lv) => filters.level.has(lv));
  if (activeLevels.length && !activeLevels.includes(entryLevel(entry))) return false;
  // Playability: "all" wants zero unplayable chords, "one" wants exactly one
  // (a practice target). Both selected = either is fine.
  if (filters.playability.size) {
    const count = unplayableCount(entry);
    const ok =
      (filters.playability.has("all") && count === 0) ||
      (filters.playability.has("one") && count === 1);
    if (!ok) return false;
  }
  return true;
}

function matchesQuery(entry) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const hay = haystackFor(entry);
  return tokens.every((t) => hay.includes(t));
}

function results() {
  return state.entries.filter((e) => matchesQuery(e) && matchesFilters(e));
}

function activeFilterCount() {
  const levelCount = ladder().filter((lv) => filters.level.has(lv)).length;
  return (
    filters.pinned.size +
    filters.collection.size +
    filters.mood.size +
    filters.genre.size +
    filters.mode.size +
    filters.bars.size +
    filters.timeSig.size +
    filters.tempo.size +
    filters.instrument.size +
    filters.playability.size +
    levelCount
  );
}

// Options for each chip group, derived from the loaded data so the sheet
// only ever offers choices that can match something.
function optionsFromData() {
  const collect = (fn) => [...new Set(state.entries.flatMap(fn))];
  const byVocab = (values, vocabList) =>
    vocabList.filter((v) => values.includes(v));
  return {
    // Not vocab-controlled and not sorted: the manifest's order is the order
    // the collections were built in, which is more useful than alphabetical.
    collection: collect((e) => [e.collection]),
    mood: byVocab(collect((e) => e.moods), state.vocab.moods),
    genre: byVocab(collect((e) => e.genres), state.vocab.genres),
    mode: byVocab(collect((e) => [e.mode]), state.vocab.modes),
    bars: collect((e) => [String(e.bars)]).sort((a, b) => a - b),
    timeSig: collect((e) => [e.timeSig]).sort(),
    tempo: byVocab(collect((e) => [e.tempo]), state.vocab.tempos),
    instrument: byVocab(collect((e) => [e.instrument]), state.vocab.instruments),
    level: ladder(),
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export function render(container) {
  const list = el("div", { className: "ledger" });
  const count = metaLine([""], { className: "hoard-count" });
  count.setAttribute("aria-live", "polite");
  const sheet = el("div", {
    className: "filter-sheet" + (sheetOpen ? " open" : ""),
    id: "filter-sheet",
  });

  // FILTER is a mono pill now rather than a labelled button — it sits on the
  // search hairline, where the old full-width control row used to be.
  const filterBtn = el(
    "button",
    {
      className: "pill filter-toggle",
      type: "button",
      attrs: { "aria-expanded": String(sheetOpen), "aria-controls": "filter-sheet" },
      on: {
        click: () => {
          sheetOpen = !sheetOpen;
          sheet.classList.toggle("open", sheetOpen);
          filterBtn.setAttribute("aria-expanded", String(sheetOpen));
        },
      },
    },
    "Filter"
  );

  const search = el("input", {
    className: "search-box",
    type: "search",
    value: query,
    placeholder: "Search the hoard…",
    attrs: { "aria-label": "Search names, moods, genres and chords", autocomplete: "off" },
    on: {
      input: (ev) => {
        query = ev.target.value;
        redrawResults();
      },
    },
  });

  // "Surprise me" (roadmap 2.1) — a random pick from whatever the CURRENT
  // filters/search turn up, straight into performance mode in its home key.
  // Disabled rather than silently doing nothing when that set is empty.
  const rouletteBtn = el(
    "button",
    {
      type: "button",
      className: "pill pill-icon roulette-btn",
      attrs: {
        "aria-label": "Surprise me — jump to a random match in performance mode",
        title: "Surprise me",
      },
      on: {
        click: () => {
          const found = results();
          if (!found.length) return;
          roulette.setPool(found.map((e) => e.id));
          const entry = found[Math.floor(Math.random() * found.length)];
          location.hash =
            "#/perform/" + encodeURIComponent(entry.id) + "/" + encodeURIComponent(entry.homeKey);
        },
      },
    },
    "🎲"
  );

  buildSheet(sheet);

  // One hairline row carries search, filters and the dice. The old
  // full-width "Surprise me" pill and its own row are gone (§5.7) — the
  // dice says the same thing in a corner of the space.
  container.appendChild(
    el(
      "section",
      { className: "hoard" },
      el(
        "div",
        { className: "hoard-search" },
        el("span", { className: "hoard-search-glyph", attrs: { "aria-hidden": "true" } }, "⌕"),
        search,
        filterBtn,
        rouletteBtn
      ),
      sheet,
      count,
      list
    )
  );

  function redrawResults() {
    const found = results();
    rouletteBtn.disabled = !found.length;
    clear(list);
    const n = found.length;
    // Meta voice: a count, not a sentence. CSS upper-cases it.
    count.textContent =
      n === state.entries.length
        ? `${n} progressions`
        : `${n} of ${state.entries.length} progressions`;
    if (!n) {
      list.appendChild(
        el(
          "div",
          { className: "empty-state" },
          el("p", { className: "empty-lead" }, "Nothing in the hoard matches that."),
          el(
            "p",
            {},
            "Loosen a filter or two, or try a different word — there's plenty of treasure in here, promise."
          )
        )
      );
      return;
    }
    for (const entry of found) list.appendChild(ledgerRow(entry));
  }

  // Re-badge the filter button when selections change.
  function refreshFilterBadge() {
    const n = activeFilterCount();
    filterBtn.textContent = n ? `Filter ${n}` : "Filter";
    filterBtn.classList.toggle("active", n > 0);
    filterBtn.classList.toggle("has-active", n > 0);
  }

  refresh = () => {
    refreshFilterBadge();
    redrawResults();
  };
  refreshFilterBadge();
  redrawResults();
}

function buildSheet(sheet) {
  const opts = optionsFromData();
  const groups = [
    ["pinned", "Pins", ["pinned"], () => "Pinned only"],
    ["collection", "Collection", opts.collection, collectionLabel],
    ["mood", "Mood", opts.mood, capitalise],
    ["genre", "Genre", opts.genre, capitalise],
    ["mode", "Mode", opts.mode, capitalise],
    ["bars", "Bars", opts.bars, (b) => `${b} bars`],
    ["timeSig", "Time signature", opts.timeSig, (t) => t],
    ["tempo", "Tempo", opts.tempo, capitalise],
    ["instrument", "Shines on", opts.instrument, capitalise],
    [
      "level",
      state.instrument === "piano" ? "Complexity (piano)" : "Complexity (guitar)",
      opts.level,
      (lv) => lv,
    ],
    [
      "playability",
      state.instrument === "piano" ? "Playability (piano)" : "Playability (guitar)",
      ["all", "one"],
      (v) => (v === "all" ? "All chords playable" : "One chord to practise"),
    ],
  ];

  for (const [key, label, values, fmt] of groups) {
    const chipRow = el("div", { className: "chip-row", attrs: { role: "group", "aria-label": label } });
    for (const value of values) {
      const selected = filters[key].has(value);
      const chip = el(
        "button",
        {
          type: "button",
          className:
            "chip" +
            (selected ? " selected" : "") +
            (key === "level" ? " " + levelClass(value) : ""),
          attrs: { "aria-pressed": String(selected) },
          on: {
            click: () => {
              if (filters[key].has(value)) filters[key].delete(value);
              else filters[key].add(value);
              const on = filters[key].has(value);
              chip.classList.toggle("selected", on);
              chip.setAttribute("aria-pressed", String(on));
              if (refresh) refresh();
            },
          },
        },
        fmt(value)
      );
      chipRow.appendChild(chip);
    }
    sheet.appendChild(
      el(
        "div",
        { className: "filter-group" },
        // Group headings drop to the meta voice; the chips themselves stay
        // as they are, because a chip IS the right control for a multi-select
        // and the sheet is the one place the app is a form (§6).
        metaLine([label], { tag: "h3" }),
        chipRow,
        // Setlists (roadmap 2.2) live alongside pins rather than as a new
        // top-level tab — curated pins with an order, not a different kind
        // of thing.
        key === "pinned"
          ? el("a", { className: "setlists-link", href: "#/setlists" }, "Manage setlists →")
          : null
      )
    );
  }

  sheet.appendChild(
    el(
      "button",
      {
        type: "button",
        className: "clear-filters",
        on: {
          click: () => {
            for (const set of Object.values(filters)) set.clear();
            for (const chip of sheet.querySelectorAll(".chip.selected")) {
              chip.classList.remove("selected");
              chip.setAttribute("aria-pressed", "false");
            }
            if (refresh) refresh();
          },
        },
      },
      "Clear all filters"
    )
  );
}

/**
 * One ledger row (STYLEGUIDE §5.2). Three lines:
 *
 *   Axis Progression                              ▁▃▅  📌
 *   C   G   Am   F
 *   4/4 · 4 BARS · MID · POP ROCK · hopeful
 *
 * The whole row is the link and the pin is a nested button, exactly as the
 * card was — pinButton() already stops the click propagating, so nothing
 * about that behaviour changes.
 *
 * The always-visible numerals line is gone: at this density it doubled the
 * row height to repeat information the chords already carry in colour. It
 * comes back on the detail view, where there's room to read it.
 */
function ledgerRow(entry) {
  const rendered = renderIn(entry, entry.homeKey);
  const rating = ratingIn(entry, entry.homeKey, state.instrument);
  const cls = (c) => tintClass(c.numeral, entry.homeKey, entry.mode);

  const chords = el(
    "div",
    { className: "ledger-chords" },
    rendered.chords.map((c) =>
      el("span", { className: cls(c) }, prettySymbol(c.symbol))
    )
  );

  // The meta line reads as one caps string with the moods left lower-case,
  // because they're words rather than codes (§5.1).
  const meta = metaLine([
    entry.timeSig,
    `${entry.bars} bars`,
    entry.tempo,
    entry.genres.join(" "),
    entry.moods.length ? lower(entry.moods.join(", ")) : null,
    entry.instrument !== "both" ? capitalise(entry.instrument) : null,
  ]);

  return el(
    "a",
    {
      className: "ledger-row " + levelClass(rating.level),
      href: "#/prog/" + encodeURIComponent(entry.id),
    },
    el(
      "div",
      { className: "ledger-top" },
      el("h2", { className: "ledger-name" }, entry.name),
      el(
        "span",
        { className: "ledger-marks" },
        levelBars(rating.level, { title: "Complexity in " + entry.homeKey }),
        // Pins record the key you'd actually play it in — the remembered
        // choice from the detail view where there is one, else the home key.
        pinButton(entry, () => chosenTonic(entry), () => {
          // Unpinning while "Pinned only" is on should drop the row.
          if (filters.pinned.size && refresh) refresh();
        })
      )
    ),
    chords,
    meta
  );
}
