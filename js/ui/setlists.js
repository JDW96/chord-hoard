// setlists.js — setlists (roadmap 2.2): an ordered list of progressions and
// songs for a gig or rehearsal, playable start to finish in performance mode.
//
// Routes:
//   #/setlists           list of saved setlists, "New setlist" entry point
//   #/setlists/new        editor for a brand-new setlist, not yet persisted
//   #/setlists/<id>       editor for an existing saved setlist
//
// Deliberately NOT a new top-level tab: a setlist is curated pins with an
// order, so it's reached from the Hoard's Pins filter group ("Manage
// setlists →") rather than growing the tab bar. Reordering is up/down
// buttons, not drag-and-drop — drag is a minefield on mobile and setlists
// are short.
//
// Editing pattern mirrors songs.js: a module-level mutable draft plus a
// redraw() closure that fully rebuilds the editor subtree on every
// interaction. Saving is explicit, not autosave.

import { state, renderIn } from "./app.js";
import { tonicsFor } from "./detail.js";
import { tintClass } from "./function-tint.js";
import { songEntries, songById } from "./songs-store.js";
import {
  setlistEntries,
  setlistById,
  saveSetlist,
  deleteSetlist,
  newSetlistId,
} from "./setlists-store.js";
import { el, clear, interleave, prettySymbol, prettyNote, capitalise } from "./util.js";

function blankDraft() {
  return { id: null, name: "", items: [] };
}

function cloneSetlist(setlist) {
  return setlist ? JSON.parse(JSON.stringify(setlist)) : null;
}

export function render(container, params) {
  const id = params[0] ? decodeURIComponent(params[0]) : null;
  if (!id) renderList(container);
  else renderEditor(container, id);
}

// ---------------------------------------------------------------------------
// List (#/setlists)
// ---------------------------------------------------------------------------

function renderList(container) {
  const section = el("section", { className: "setlists-list" });
  const cardsHost = el("div", { className: "setlists-cards" });

  section.appendChild(
    el(
      "div",
      { className: "setlists-head" },
      el("h2", {}, "Setlists"),
      el("a", { className: "setlists-new-btn", href: "#/setlists/new" }, "New setlist")
    )
  );
  section.appendChild(cardsHost);
  container.appendChild(section);

  function redrawList() {
    clear(cardsHost);
    const setlists = setlistEntries();
    if (!setlists.length) {
      cardsHost.appendChild(
        el(
          "div",
          { className: "empty-state" },
          el("p", { className: "empty-lead" }, "No setlists yet."),
          el(
            "p",
            {},
            "Order up progressions and songs from the hoard and play them straight through, gig-ready."
          )
        )
      );
      return;
    }
    for (const setlist of setlists) cardsHost.appendChild(setlistCard(setlist, redrawList));
  }

  redrawList();
}

function itemLabel(item) {
  if (item.kind === "song") {
    const song = songById(item.refId);
    return song ? song.name || "Untitled song" : null;
  }
  const entry = state.byId.get(item.refId);
  return entry ? entry.name : null;
}

function setlistCard(setlist, redrawList) {
  const labelSpans = interleave(
    setlist.items,
    (it) => {
      const label = itemLabel(it);
      return el("span", { className: label ? "" : "song-slot-unfilled" }, label || "missing");
    },
    " · "
  );
  const playable = setlist.items.some((it) => itemLabel(it));

  return el(
    "div",
    { className: "song-card" },
    el(
      "div",
      { className: "song-card-top" },
      el("h3", { className: "song-card-name" }, setlist.name || "Untitled setlist"),
      el("span", { className: "chip static" }, `${setlist.items.length} ${setlist.items.length === 1 ? "item" : "items"}`)
    ),
    el("p", { className: "song-card-sections" }, setlist.items.length ? labelSpans : "Nothing added yet."),
    el(
      "div",
      { className: "song-card-actions" },
      el("a", { className: "song-card-edit", href: "#/setlists/" + encodeURIComponent(setlist.id) }, "Edit"),
      playable
        ? el(
            "a",
            { className: "song-card-play", href: "#/perform-setlist/" + encodeURIComponent(setlist.id) + "/0" },
            "Play"
          )
        : null,
      el(
        "button",
        {
          type: "button",
          className: "song-card-delete",
          attrs: { "aria-label": "Delete " + (setlist.name || "this setlist") },
          on: {
            click: () => {
              deleteSetlist(setlist.id);
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
// Editor (#/setlists/new, #/setlists/<id>)
// ---------------------------------------------------------------------------

let draft = null;
let redraw = () => {};

function renderEditor(container, id) {
  draft = id === "new" ? blankDraft() : cloneSetlist(setlistById(id));
  if (!draft) {
    container.appendChild(
      el(
        "section",
        { className: "coming-soon" },
        el("h2", {}, "That setlist isn't here"),
        el("p", {}, "We couldn't find it. It might have been deleted on another device."),
        el("p", {}, el("a", { href: "#/setlists" }, "Back to Setlists"))
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
  section.appendChild(el("a", { className: "song-back", href: "#/setlists" }, "← Setlists"));

  const nameInput = el("input", {
    type: "text",
    className: "song-name-input",
    value: draft.name,
    placeholder: "Name your setlist",
    attrs: { "aria-label": "Setlist name", maxlength: "80" },
    on: { input: (ev) => (draft.name = ev.target.value) },
  });

  section.appendChild(
    el(
      "div",
      { className: "song-head" },
      el("h2", { className: "song-title" }, routeId === "new" ? "New setlist" : "Edit setlist"),
      el("div", { className: "lib-picker" }, el("h3", {}, "Name"), nameInput)
    )
  );

  const itemsHost = el("div", { className: "setlist-items" });
  draft.items.forEach((item, idx) => itemsHost.appendChild(itemRow(item, idx)));
  section.appendChild(itemsHost);
  if (!draft.items.length) {
    section.appendChild(el("p", { className: "song-slot-hint" }, "Add a progression or song below to get started."));
  }

  section.appendChild(itemPicker());

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
          draft.name = name;
          const wasNew = !draft.id;
          if (wasNew) draft.id = newSetlistId();
          saveSetlist(draft);
          if (wasNew) {
            location.hash = "#/setlists/" + encodeURIComponent(draft.id);
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
        { className: "song-play-btn", href: "#/perform-setlist/" + encodeURIComponent(draft.id) + "/0" },
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
              deleteSetlist(draft.id);
              location.hash = "#/setlists";
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

function moveItem(idx, dir) {
  const j = idx + dir;
  if (j < 0 || j >= draft.items.length) return;
  const [it] = draft.items.splice(idx, 1);
  draft.items.splice(j, 0, it);
  redraw();
}

function reorderButtons(idx) {
  const upBtn = el(
    "button",
    {
      type: "button",
      className: "setlist-reorder-btn",
      attrs: { "aria-label": "Move up" },
      on: { click: () => moveItem(idx, -1) },
    },
    "↑"
  );
  upBtn.disabled = idx === 0;
  const downBtn = el(
    "button",
    {
      type: "button",
      className: "setlist-reorder-btn",
      attrs: { "aria-label": "Move down" },
      on: { click: () => moveItem(idx, 1) },
    },
    "↓"
  );
  downBtn.disabled = idx === draft.items.length - 1;
  return el("div", { className: "setlist-reorder" }, upBtn, downBtn);
}

function itemRow(item, idx) {
  const wrap = el("div", { className: "song-slot setlist-item" });
  const removeBtn = el(
    "button",
    {
      type: "button",
      className: "song-slot-remove",
      attrs: { "aria-label": "Remove this item" },
      on: {
        click: () => {
          draft.items.splice(idx, 1);
          redraw();
        },
      },
    },
    "Remove"
  );

  wrap.appendChild(
    el(
      "div",
      { className: "song-slot-head" },
      reorderButtons(idx),
      el("span", { className: "setlist-item-kind" }, item.kind === "song" ? "Song" : "Progression"),
      removeBtn
    )
  );

  if (item.kind === "song") {
    const song = songById(item.refId);
    if (!song) {
      wrap.appendChild(el("p", { className: "song-slot-missing" }, "This song isn't in the hoard any more."));
    } else {
      const labelSpans = interleave(song.sections, (s) => el("span", {}, capitalise(s.label)), " · ");
      wrap.appendChild(
        el(
          "div",
          { className: "song-slot-filled" },
          el("a", { className: "song-slot-name", href: "#/songs/" + encodeURIComponent(song.id) }, song.name || "Untitled song"),
          el("p", { className: "song-slot-numerals" }, labelSpans)
        )
      );
    }
  } else {
    const entry = state.byId.get(item.refId);
    if (!entry) {
      wrap.appendChild(el("p", { className: "song-slot-missing" }, "This progression isn't in the hoard any more."));
    } else {
      const tonic = tonicsFor(entry).includes(item.tonic) ? item.tonic : entry.homeKey;
      item.tonic = tonic;
      const rendered = renderIn(entry, tonic);
      const cls = (c) => tintClass(c.numeral, tonic, entry.mode);
      const tonicRow = el("div", { className: "key-row setlist-tonic-row", attrs: { role: "group", "aria-label": "Key" } });
      for (const t of tonicsFor(entry)) {
        tonicRow.appendChild(
          el(
            "button",
            {
              type: "button",
              className: "key-btn" + (t === tonic ? " selected" : ""),
              attrs: { "aria-pressed": String(t === tonic) },
              on: {
                click: () => {
                  item.tonic = t;
                  redraw();
                },
              },
            },
            prettyNote(t)
          )
        );
      }
      wrap.appendChild(
        el(
          "div",
          { className: "song-slot-filled" },
          el("a", { className: "song-slot-name", href: "#/prog/" + encodeURIComponent(entry.id) }, entry.name),
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
          tonicRow
        )
      );
    }
  }

  return wrap;
}

function itemPicker() {
  const host = el("div", { className: "setlist-add" });
  host.appendChild(el("h3", {}, "Add to the setlist"));

  const searchInput = el("input", {
    type: "search",
    className: "song-search-input",
    placeholder: "Search progressions and songs by name…",
    attrs: { "aria-label": "Search progressions and songs by name", autocomplete: "off" },
  });
  const resultsHost = el("div", { className: "song-suggest-row" });
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    clear(resultsHost);
    if (!q) return;
    const progMatches = state.entries.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 6);
    const songMatches = songEntries().filter((s) => (s.name || "").toLowerCase().includes(q)).slice(0, 6);
    for (const entry of progMatches) resultsHost.appendChild(addCard(entry.name, "Progression", () => addItem("prog", entry.id, entry.homeKey)));
    for (const song of songMatches) resultsHost.appendChild(addCard(song.name || "Untitled song", "Song", () => addItem("song", song.id, song.tonic)));
    if (!progMatches.length && !songMatches.length) {
      resultsHost.appendChild(el("p", { className: "song-slot-hint" }, "Nothing matches that."));
    }
  });

  host.appendChild(el("div", { className: "song-search" }, searchInput, resultsHost));
  return host;
}

function addCard(name, kindLabel, onAdd) {
  return el(
    "button",
    {
      type: "button",
      className: "song-suggest-card",
      on: { click: onAdd },
    },
    el("span", { className: "song-suggest-name" }, name),
    el("span", { className: "song-suggest-moods" }, kindLabel)
  );
}

function addItem(kind, refId, tonic) {
  draft.items.push({ kind, refId, tonic });
  redraw();
}
