// songs.js — song builder view (backlog item 0.1, phase 4).
//
// Routes:
//   #/songs           list of saved songs, "New song" entry point
//   #/songs/new        editor for a brand-new song, not yet persisted
//   #/songs/<id>       editor for an existing saved song
//
// A song is small on purpose: sections reference progression ids only (see
// songs-store.js), never realized chords. This view is deliberately NOT
// wired into the Hoard's collection filter (songs are a different kind of
// thing from a single progression) and has no tab bar entry of its own
// beyond the Songs icon added alongside Build.
//
// Editing pattern mirrors builder.js: a module-level mutable draft plus a
// `redraw()` closure that fully rebuilds the editor subtree on every
// interaction. Saving is explicit (a Save button), not autosave, so a half
// finished edit never silently overwrites a good saved song.

import { sectionSuggestions, sectionTonic } from "../engine/song.js";
import { state, renderIn } from "./app.js";
import { tonicsFor, MAJOR_FAMILY_TONICS } from "./detail.js";
import { tintClass, legendCaption } from "./function-tint.js";
import { songEntries, songById, saveSong, deleteSong, newSongId } from "./songs-store.js";
import { el, clear, interleave, prettySymbol, prettyNote, capitalise } from "./util.js";

const MIN_SECTIONS = 2;
const MAX_SECTIONS = 4;
const SUGGEST_COUNT = 5;

function blankSection() {
  return { label: "verse", progId: null, tonicOverride: null };
}

function blankDraft() {
  return { id: null, name: "", tonic: "C", sections: [blankSection(), blankSection()] };
}

function cloneSong(song) {
  return song ? JSON.parse(JSON.stringify(song)) : null;
}

export function render(container, params) {
  const id = params[0] ? decodeURIComponent(params[0]) : null;
  if (!id) renderList(container);
  else renderEditor(container, id);
}

// ---------------------------------------------------------------------------
// List (#/songs)
// ---------------------------------------------------------------------------

function renderList(container) {
  const section = el("section", { className: "songs-list" });
  const cardsHost = el("div", { className: "songs-cards" });

  section.appendChild(
    el(
      "div",
      { className: "songs-head" },
      el("h2", {}, "Songs"),
      el("a", { className: "songs-new-btn", href: "#/songs/new" }, "New song")
    )
  );
  section.appendChild(cardsHost);
  container.appendChild(section);

  function redrawList() {
    clear(cardsHost);
    const songs = songEntries();
    if (!songs.length) {
      cardsHost.appendChild(
        el(
          "div",
          { className: "empty-state" },
          el("p", { className: "empty-lead" }, "No songs yet."),
          el(
            "p",
            {},
            "Put two to four progressions from the hoard into named sections and play them straight through."
          )
        )
      );
      return;
    }
    for (const song of songs) cardsHost.appendChild(songCard(song, redrawList));
  }

  redrawList();
}

function songCard(song, redrawList) {
  const labelSpans = interleave(
    song.sections,
    (s) =>
      el(
        "span",
        { className: s.progId && state.byId.has(s.progId) ? "" : "song-slot-unfilled" },
        capitalise(s.label)
      ),
    " · "
  );
  const playable = song.sections.some((s) => s.progId && state.byId.has(s.progId));

  return el(
    "div",
    { className: "song-card" },
    el(
      "div",
      { className: "song-card-top" },
      el("h3", { className: "song-card-name" }, song.name || "Untitled song"),
      el("span", { className: "chip static" }, prettyNote(song.tonic))
    ),
    el("p", { className: "song-card-sections" }, labelSpans),
    el(
      "div",
      { className: "song-card-actions" },
      el("a", { className: "song-card-edit", href: "#/songs/" + encodeURIComponent(song.id) }, "Edit"),
      playable
        ? el(
            "a",
            { className: "song-card-play", href: "#/perform-song/" + encodeURIComponent(song.id) + "/0" },
            "Play"
          )
        : null,
      el(
        "button",
        {
          type: "button",
          className: "song-card-delete",
          attrs: { "aria-label": "Delete " + (song.name || "this song") },
          on: {
            click: () => {
              deleteSong(song.id);
              redrawList();
            },
          },
        },
        "Delete"
      )
    )
  );
}

// ---------------------------------------------------------------------------
// Editor (#/songs/new, #/songs/<id>)
// ---------------------------------------------------------------------------

let draft = null; // the song currently being edited
let redraw = () => {};

function renderEditor(container, id) {
  draft = id === "new" ? blankDraft() : cloneSong(songById(id));
  if (!draft) {
    container.appendChild(
      el(
        "section",
        { className: "coming-soon" },
        el("h2", {}, "That song isn't here"),
        el("p", {}, "We couldn't find it. It might have been deleted on another device."),
        el("p", {}, el("a", { href: "#/songs" }, "Back to Songs"))
      )
    );
    return;
  }

  const section = el("section", { className: "song-editor" });
  container.appendChild(section);

  redraw = () => {
    clear(section);
    drawEditor(section, id);
  };
  redraw();
}

function drawEditor(section, routeId) {
  section.appendChild(el("a", { className: "song-back", href: "#/songs" }, "← Songs"));

  const nameInput = el("input", {
    type: "text",
    className: "song-name-input",
    value: draft.name,
    placeholder: "Name your song",
    attrs: { "aria-label": "Song name", maxlength: "80" },
    on: { input: (ev) => (draft.name = ev.target.value) },
  });

  const tonicRow = el("div", { className: "key-row", attrs: { role: "group", "aria-label": "Song key" } });
  for (const t of MAJOR_FAMILY_TONICS) {
    tonicRow.appendChild(
      el(
        "button",
        {
          type: "button",
          className: "key-btn" + (t === draft.tonic ? " selected" : ""),
          attrs: { "aria-pressed": String(t === draft.tonic) },
          on: {
            click: () => {
              draft.tonic = t;
              redraw();
            },
          },
        },
        prettyNote(t)
      )
    );
  }

  section.appendChild(
    el(
      "div",
      { className: "song-head" },
      el("h2", { className: "song-title" }, routeId === "new" ? "New song" : "Edit song"),
      el("div", { className: "lib-picker" }, el("h3", {}, "Name"), nameInput),
      el("div", { className: "lib-picker" }, el("h3", {}, "Key"), tonicRow)
    )
  );

  const slotsHost = el("div", { className: "song-sections" });
  draft.sections.forEach((sec, idx) => slotsHost.appendChild(sectionSlot(idx)));
  section.appendChild(slotsHost);

  if (draft.sections.length < MAX_SECTIONS) {
    section.appendChild(
      el(
        "button",
        {
          type: "button",
          className: "song-add-section",
          on: {
            click: () => {
              draft.sections.push(blankSection());
              redraw();
            },
          },
        },
        "Add section"
      )
    );
  }

  section.appendChild(legendCaption());

  const status = el("p", { className: "song-status" });

  const saveBtn = el(
    "button",
    {
      type: "button",
      className: "song-save-btn",
      on: {
        click: () => {
          const name = draft.name.trim();
          if (!name) {
            status.textContent = "Give it a name first so you can find it again.";
            return;
          }
          if (draft.sections.length < MIN_SECTIONS) {
            status.textContent = "Two sections minimum.";
            return;
          }
          if (draft.sections.some((s) => !s.progId)) {
            status.textContent = "Every section needs a progression before saving.";
            return;
          }
          draft.name = name;
          const wasNew = !draft.id;
          if (wasNew) draft.id = newSongId();
          saveSong(draft);
          if (wasNew) {
            location.hash = "#/songs/" + encodeURIComponent(draft.id);
          } else {
            status.textContent = "Saved.";
          }
        },
      },
    },
    "Save"
  );

  const actions = el("div", { className: "song-actions" }, saveBtn);

  if (draft.id) {
    actions.appendChild(
      el(
        "a",
        { className: "song-play-btn", href: "#/perform-song/" + encodeURIComponent(draft.id) + "/0" },
        "Play"
      )
    );
  }

  if (routeId !== "new") {
    actions.appendChild(
      el(
        "button",
        {
          type: "button",
          className: "song-delete-btn",
          on: {
            click: () => {
              deleteSong(draft.id);
              location.hash = "#/songs";
            },
          },
        },
        "Delete"
      )
    );
  }

  section.appendChild(actions);
  section.appendChild(status);
}

function sectionSlot(idx) {
  const sec = draft.sections[idx];
  const wrap = el("div", { className: "song-slot" });

  const labelSelect = el("select", {
    className: "song-slot-label",
    attrs: { "aria-label": "Section label" },
    on: {
      change: (ev) => {
        sec.label = ev.target.value;
        redraw();
      },
    },
  });
  for (const s of state.vocab.sections) {
    const opt = el("option", { value: s }, capitalise(s));
    if (s === sec.label) opt.selected = true;
    labelSelect.appendChild(opt);
  }

  const removeBtn =
    draft.sections.length > MIN_SECTIONS
      ? el(
          "button",
          {
            type: "button",
            className: "song-slot-remove",
            attrs: { "aria-label": "Remove this section" },
            on: {
              click: () => {
                draft.sections.splice(idx, 1);
                redraw();
              },
            },
          },
          "Remove"
        )
      : null;

  wrap.appendChild(el("div", { className: "song-slot-head" }, labelSelect, removeBtn));

  if (sec.progId) {
    const entry = state.byId.get(sec.progId);
    if (!entry) {
      wrap.appendChild(
        el(
          "div",
          { className: "song-slot-missing" },
          el("p", {}, "This progression isn't in the hoard any more."),
          el(
            "button",
            {
              type: "button",
              className: "song-slot-change",
              on: {
                click: () => {
                  sec.progId = null;
                  redraw();
                },
              },
            },
            "Choose another"
          )
        )
      );
    } else {
      const tonic = sectionTonic(draft, entry, sec, tonicsFor);
      const rendered = renderIn(entry, tonic);
      const cls = (c) => tintClass(c.numeral, tonic, entry.mode);
      wrap.appendChild(
        el(
          "div",
          { className: "song-slot-filled" },
          el(
            "a",
            { className: "song-slot-name", href: "#/prog/" + encodeURIComponent(entry.id) },
            entry.name
          ),
          el(
            "p",
            { className: "song-slot-numerals" },
            interleave(rendered.chords, (c) => el("span", { className: cls(c) }, c.display), " · ")
          ),
          el(
            "p",
            { className: "song-slot-chords" },
            interleave(rendered.chords, (c) => el("span", { className: cls(c) }, prettySymbol(c.symbol)), " – ")
          ),
          el(
            "button",
            {
              type: "button",
              className: "song-slot-change",
              on: {
                click: () => {
                  sec.progId = null;
                  redraw();
                },
              },
            },
            "Change"
          )
        )
      );
    }
  } else {
    wrap.appendChild(sectionPicker(sec));
  }

  return wrap;
}

function sectionPicker(sec) {
  const host = el("div", { className: "song-slot-empty" });
  host.appendChild(el("p", { className: "song-slot-hint" }, "Pick a progression for this section."));

  const suggestions = sectionSuggestions(state.entries, draft.sections, draft.tonic).slice(0, SUGGEST_COUNT);
  if (suggestions.length) {
    const row = el("div", { className: "song-suggest-row" });
    for (const entry of suggestions) row.appendChild(suggestCard(entry, sec));
    host.appendChild(el("div", { className: "song-suggest-group" }, el("h4", {}, "Suggested"), row));
  }

  const searchInput = el("input", {
    type: "search",
    className: "song-search-input",
    placeholder: "Or search the hoard by name…",
    attrs: { "aria-label": "Search progressions by name", autocomplete: "off" },
  });
  const resultsHost = el("div", { className: "song-suggest-row" });
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    clear(resultsHost);
    if (!q) return;
    const used = new Set(draft.sections.map((s) => s.progId).filter(Boolean));
    const matches = state.entries
      .filter((e) => !used.has(e.id) && e.name.toLowerCase().includes(q))
      .slice(0, 8);
    for (const entry of matches) resultsHost.appendChild(suggestCard(entry, sec));
  });
  host.appendChild(el("div", { className: "song-search" }, searchInput, resultsHost));

  return host;
}

function suggestCard(entry, sec) {
  const tonic = entry.homeKey;
  const rendered = renderIn(entry, tonic);
  const cls = (c) => tintClass(c.numeral, tonic, entry.mode);
  return el(
    "button",
    {
      type: "button",
      className: "song-suggest-card",
      on: {
        click: () => {
          sec.progId = entry.id;
          redraw();
        },
      },
    },
    el("span", { className: "song-suggest-name" }, entry.name),
    el(
      "span",
      { className: "song-suggest-numerals" },
      interleave(rendered.chords, (c) => el("span", { className: cls(c) }, c.display), " · ")
    ),
    entry.moods.length
      ? el("span", { className: "song-suggest-moods" }, entry.moods.slice(0, 3).join(" · "))
      : null
  );
}
