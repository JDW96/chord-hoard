// hoard.js — the browse view: search, filters, and result cards.
//
// Search matches name, moods, genres and chord names in the home key.
// Filters are chip groups: OR within a group, AND across groups.
// Complexity is computed by the engine per entry in its home key for the
// currently selected instrument, and cached in app.js's ratingCache.

import { state, renderIn, ratingIn, collectionLabel } from "./app.js";
import { tintClass } from "./function-tint.js";
import { el, clear, interleave, prettySymbol, capitalise, levelClass } from "./util.js";

// Module-level UI state so search/filters survive a trip into a detail view.
const filters = {
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

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

function matchesFilters(entry) {
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
    filters.collection.size +
    filters.mood.size +
    filters.genre.size +
    filters.mode.size +
    filters.bars.size +
    filters.timeSig.size +
    filters.tempo.size +
    filters.instrument.size +
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
  const list = el("div", { className: "card-list" });
  const count = el("p", { className: "result-count", attrs: { "aria-live": "polite" } });
  const sheet = el("div", {
    className: "filter-sheet" + (sheetOpen ? " open" : ""),
    id: "filter-sheet",
  });

  const filterBtn = el(
    "button",
    {
      className: "filter-toggle",
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
    "Filters"
  );

  const search = el("input", {
    className: "search-box",
    type: "search",
    value: query,
    placeholder: "Search names, moods, genres, chords…",
    attrs: { "aria-label": "Search the hoard", autocomplete: "off" },
    on: {
      input: (ev) => {
        query = ev.target.value;
        redrawResults();
      },
    },
  });

  buildSheet(sheet);

  container.appendChild(
    el(
      "section",
      { className: "hoard" },
      el("div", { className: "search-row" }, search, filterBtn),
      sheet,
      count,
      list
    )
  );

  function redrawResults() {
    const found = results();
    clear(list);
    const n = found.length;
    count.textContent =
      n === state.entries.length
        ? `The whole hoard — ${n} progressions`
        : `${n} ${n === 1 ? "progression" : "progressions"} found`;
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
    for (const entry of found) list.appendChild(card(entry));
  }

  // Re-badge the filter button when selections change.
  function refreshFilterBadge() {
    const n = activeFilterCount();
    filterBtn.textContent = n ? `Filters · ${n}` : "Filters";
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
      el("div", { className: "filter-group" }, el("h3", {}, label), chipRow)
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

function card(entry) {
  const rendered = renderIn(entry, entry.homeKey);
  const rating = ratingIn(entry, entry.homeKey, state.instrument);
  const cls = (c) => tintClass(c.numeral, entry.homeKey, entry.mode);
  const numeralSpans = interleave(
    rendered.chords,
    (c) => el("span", { className: cls(c) }, c.display),
    " · "
  );
  const chordSpans = interleave(
    rendered.chords,
    (c) => el("span", { className: cls(c) }, prettySymbol(c.symbol)),
    " – "
  );

  return el(
    "a",
    {
      // The level also rides on the card itself so the edge stripe can be
      // coloured in CSS without the badge having to carry the whole signal.
      className: "card " + levelClass(rating.level),
      href: "#/prog/" + encodeURIComponent(entry.id),
    },
    el(
      "div",
      { className: "card-top" },
      el("h2", { className: "card-name" }, entry.name),
      el(
        "span",
        { className: "badge " + levelClass(rating.level), attrs: { title: "Complexity in " + entry.homeKey } },
        rating.level
      )
    ),
    el("p", { className: "card-numerals" }, numeralSpans),
    el("p", { className: "card-chords" }, chordSpans),
    el(
      "div",
      { className: "card-chips" },
      el("span", { className: "chip static" }, capitalise(entry.mode)),
      el("span", { className: "chip static" }, entry.timeSig),
      el("span", { className: "chip static" }, `${entry.bars} bars`),
      el("span", { className: "chip static" }, capitalise(entry.tempo)),
      entry.instrument !== "both"
        ? el("span", { className: "chip static" }, capitalise(entry.instrument))
        : null
    ),
    el(
      "div",
      { className: "card-moods" },
      entry.moods.map((m) => el("span", { className: "mood-tag" }, m))
    )
  );
}
