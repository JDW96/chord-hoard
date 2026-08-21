// perform.js — Performance Mode: a single progression (#/perform/<id>[/<tonic>]),
// a saved song section by section (#/perform-song/<songId>[/<sectionIndex>]),
// or a saved setlist step by step (#/perform-setlist/<setlistId>[/<index>]).
//
// Full-viewport takeover: the shell hides its header and tab bar via
// body[data-route="perform"|"perform-song"|"perform-setlist"] (see app.css),
// and this view pins itself to the viewport. The whole progression must FIT
// — zero scrolling, portrait or landscape — so we lay chords in a grid whose
// column count follows the orientation and chord count, then shrink a single
// font-size variable until nothing overflows. Everything but the chord
// symbols is deliberately dim.
//
// Screen Wake Lock: requested on entry, re-acquired when the tab becomes
// visible again, released on exit. Where unsupported (or refused) we degrade
// silently — a tiny indicator only appears when the lock is actually held.
//
// All three routes share one rendering core, buildPerformanceView(): a song
// or setlist step is just a single progression's view plus previous/next
// controls (swipe target is the same physical grid; "swipe" here is v1's
// arrow buttons + arrow keys, not a touch gesture — which doubles as the
// page-turner-pedal story, since those pedals present as keyboards sending
// arrow keys) and an exit link back to the song/setlist editor instead of
// the progression's detail page. The improv-roulette reroll dice (roadmap
// 2.1) and the silent auto-advance walk (roadmap 2.3) are the other two
// controls layered onto that same shared core.

import { parseNote, pitchClass } from "../engine/theory.js";
import * as capo from "../engine/capo.js";
import { renderSong as realizeSong } from "../engine/song.js";
import { bpmForTempo } from "../engine/audio-notes.js";
import * as audioPlayer from "./audio-player.js";
import { state, renderIn, buildSettingsPanel } from "./app.js";
import { chosenTonic, tonicsFor, isMajorFamily } from "./detail.js";
import { songById } from "./songs-store.js";
import { setlistById } from "./setlists-store.js";
import * as roulette from "./roulette.js";
import { tintClass, legendCaption } from "./function-tint.js";
import { openSettingsPanel } from "./settings-panel.js";
import { el, clear, prettySymbol, prettyNote, capitalise } from "./util.js";

// The settings cog (backlog item 15) lives in the header, which perform mode
// hides entirely for its full-viewport takeover — so it needs its own small
// entry point here rather than just vanishing along with the header.
const SETTINGS_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>';

/** "Am"/"Em"/"Dm" → "A"/"E"/"D" — capo.suggest()'s playAs already carries the
    minor-family "m", but progression.render() only wants the tonic letter
    (the entry's own mode supplies the rest). */
function playedTonicFor(hint) {
  return hint.playAs.endsWith("m") ? hint.playAs.slice(0, -1) : hint.playAs;
}

// ---------------------------------------------------------------------------
// A single progression (#/perform/<id>[/<tonic>])
// ---------------------------------------------------------------------------

export function render(container, params) {
  const id = decodeURIComponent(params[0] || "");
  const entry = state.byId.get(id);
  if (!entry) {
    container.appendChild(
      el(
        "section",
        { className: "coming-soon" },
        el("h2", {}, "That one's not in the hoard"),
        el("p", {}, `We couldn't find a progression called "${id}".`),
        el("p", {}, el("a", { href: "#/hoard" }, "Back to the hoard"))
      )
    );
    return;
  }

  // Key: the /<tonic> route segment wins (so a shared or refreshed URL keeps
  // its key), falling back to the remembered chordhoard.keychoice.
  let tonic = chosenTonic(entry);
  if (params[1]) {
    const wanted = decodeURIComponent(params[1]);
    try {
      const pc = pitchClass(parseNote(wanted));
      const match = tonicsFor(entry).find((t) => pitchClass(parseNote(t)) === pc);
      if (match) tonic = match;
    } catch {
      /* unparseable tonic in the URL → remembered/home key */
    }
  }

  buildPerformanceView(container, {
    entry,
    tonic,
    exitHref: "#/prog/" + encodeURIComponent(entry.id),
    extra: rerollControl(entry),
  });
}

// ---------------------------------------------------------------------------
// Improv roulette reroll (roadmap 2.1) — only shown when the entry currently
// on screen came from a "Surprise me" pool with more than one member, so a
// perform link reached the ordinary way (from the detail view) never grows a
// dice it has nothing to reroll within.
// ---------------------------------------------------------------------------

function rerollControl(entry) {
  if (!roulette.isActivePool(entry.id)) return null;
  return el(
    "button",
    {
      type: "button",
      className: "perform-reroll",
      attrs: {
        "aria-label": "Surprise me again",
        title: "Draw another from the same filtered set",
      },
      on: {
        click: () => {
          const nextId = roulette.pickFrom(entry.id);
          const next = nextId ? state.byId.get(nextId) : null;
          if (!next) return;
          location.hash =
            "#/perform/" + encodeURIComponent(next.id) + "/" + encodeURIComponent(next.homeKey);
        },
      },
    },
    "🎲"
  );
}

// ---------------------------------------------------------------------------
// A saved song, section by section
// (#/perform-song/<songId>[/<sectionIndex>])
// ---------------------------------------------------------------------------

function songSectionHref(songId, index) {
  return "#/perform-song/" + encodeURIComponent(songId) + "/" + index;
}

export function renderSong(container, params) {
  const songId = decodeURIComponent(params[0] || "");
  const song = songById(songId);
  if (!song) {
    container.appendChild(
      el(
        "section",
        { className: "coming-soon" },
        el("h2", {}, "That song isn't here"),
        el("p", {}, `We couldn't find a song called "${songId}".`),
        el("p", {}, el("a", { href: "#/songs" }, "Back to Songs"))
      )
    );
    return;
  }

  const total = song.sections.length;
  const exitHref = "#/songs/" + encodeURIComponent(song.id);
  if (!total) {
    container.appendChild(
      el(
        "section",
        { className: "coming-soon" },
        el("h2", {}, "Nothing to play yet"),
        el("p", {}, "This song has no sections."),
        el("p", {}, el("a", { href: exitHref }, "Back to the song"))
      )
    );
    return;
  }

  let index = parseInt(params[1], 10);
  if (!Number.isInteger(index) || index < 0 || index >= total) index = 0;

  const sections = realizeSong(song, state.byId, tonicsFor);
  const current = sections[index];
  const nav = {
    prevHref: index > 0 ? songSectionHref(song.id, index - 1) : null,
    nextHref: index < total - 1 ? songSectionHref(song.id, index + 1) : null,
  };

  if (current.missing) {
    buildMissingSectionView(container, {
      title: (song.name || "Untitled song") + " · " + capitalise(current.section.label),
      index,
      total,
      exitHref,
      nav,
    });
    return;
  }

  buildPerformanceView(container, {
    entry: current.entry,
    tonic: current.tonic,
    exitHref,
    nav,
    labelPrefix: `${song.name || "Untitled song"} · ${capitalise(current.section.label)} (${index + 1}/${total}) · `,
  });
}

// ---------------------------------------------------------------------------
// A saved setlist, step by step (#/perform-setlist/<setlistId>[/<index>])
// (roadmap 2.2) — flattened into a linear sequence of playable steps: a
// "prog" item is one step, a "song" item expands into ALL of that song's own
// sections in order, so a whole song plays through inside the setlist rather
// than needing its own nested prev/next. This reuses realizeSong() (the same
// engine call renderSong() above uses) so a song's sections never need a
// second implementation of key/tonic resolution.
// ---------------------------------------------------------------------------

function setlistStepHref(setlistId, index) {
  return "#/perform-setlist/" + encodeURIComponent(setlistId) + "/" + index;
}

function setlistSteps(setlist) {
  const steps = [];
  for (const item of setlist.items) {
    if (item.kind === "song") {
      const song = songById(item.refId);
      if (!song) {
        steps.push({ missing: true, label: "a deleted song" });
        continue;
      }
      const sections = realizeSong(song, state.byId, tonicsFor);
      sections.forEach((sec) => {
        const label = `${song.name || "Untitled song"} · ${capitalise(sec.section.label)}`;
        if (sec.missing) steps.push({ missing: true, label });
        else steps.push({ entry: sec.entry, tonic: sec.tonic, label });
      });
    } else {
      const entry = state.byId.get(item.refId);
      if (!entry) {
        steps.push({ missing: true, label: "a deleted progression" });
        continue;
      }
      const tonic = tonicsFor(entry).includes(item.tonic) ? item.tonic : entry.homeKey;
      steps.push({ entry, tonic, label: entry.name });
    }
  }
  return steps;
}

export function renderSetlist(container, params) {
  const setlistId = decodeURIComponent(params[0] || "");
  const setlist = setlistById(setlistId);
  if (!setlist) {
    container.appendChild(
      el(
        "section",
        { className: "coming-soon" },
        el("h2", {}, "That setlist isn't here"),
        el("p", {}, `We couldn't find a setlist called "${setlistId}".`),
        el("p", {}, el("a", { href: "#/setlists" }, "Back to Setlists"))
      )
    );
    return;
  }

  const exitHref = "#/setlists/" + encodeURIComponent(setlist.id);
  const steps = setlistSteps(setlist);
  const total = steps.length;
  if (!total) {
    container.appendChild(
      el(
        "section",
        { className: "coming-soon" },
        el("h2", {}, "Nothing to play yet"),
        el("p", {}, "This setlist has no items."),
        el("p", {}, el("a", { href: exitHref }, "Back to the setlist"))
      )
    );
    return;
  }

  let index = parseInt(params[1], 10);
  if (!Number.isInteger(index) || index < 0 || index >= total) index = 0;

  const current = steps[index];
  const nav = {
    prevHref: index > 0 ? setlistStepHref(setlist.id, index - 1) : null,
    nextHref: index < total - 1 ? setlistStepHref(setlist.id, index + 1) : null,
  };
  const title = (setlist.name || "Untitled setlist") + " · " + current.label;

  if (current.missing) {
    buildMissingSectionView(container, { title, index, total, exitHref, nav, backLabel: "the setlist" });
    return;
  }

  buildPerformanceView(container, {
    entry: current.entry,
    tonic: current.tonic,
    exitHref,
    nav,
    labelPrefix: `${setlist.name || "Untitled setlist"} · ${current.label} (${index + 1}/${total}) · `,
  });
}

// ---------------------------------------------------------------------------
// Shared rendering core
// ---------------------------------------------------------------------------

/** ArrowLeft/ArrowRight move between sections; a no-op with nav === null. */
function wireArrowNav(nav) {
  if (!nav) return () => {};
  function onKey(ev) {
    if (ev.key === "ArrowLeft" && nav.prevHref) location.hash = nav.prevHref;
    else if (ev.key === "ArrowRight" && nav.nextHref) location.hash = nav.nextHref;
  }
  document.addEventListener("keydown", onKey);
  return () => document.removeEventListener("keydown", onKey);
}

function navButton(direction, href, label) {
  const props = {
    className: "perform-nav-btn " + direction + (href ? "" : " disabled"),
    attrs: { "aria-label": label },
  };
  if (href) props.href = href;
  else props.attrs["aria-disabled"] = "true";
  return el("a", props, direction === "prev" ? "‹" : "›");
}

/**
 * A brief full-viewport placeholder for a song/setlist step whose
 * progression no longer resolves (a deleted built-* entry, or a setlist
 * item pointing at a deleted song) — a visible state, not a throw, with the
 * same exit/nav chrome as a real step so the user can skip past it rather
 * than getting stuck. `backLabel` names what exitHref returns to ("the
 * song" / "the setlist").
 */
function buildMissingSectionView(container, { title, index, total, exitHref, nav, backLabel = "the song" }) {
  const strip = el(
    "div",
    { className: "perform-strip" },
    el("a", { className: "perform-exit", href: exitHref, attrs: { "aria-label": "Exit performance mode" } }, "✕"),
    navButton("prev", nav.prevHref, "Previous section"),
    el("span", { className: "perform-strip-info" }, `${title} (${index + 1}/${total})`),
    navButton("next", nav.nextHref, "Next section")
  );
  const topBar = el("div", { className: "perform-topbar" }, strip);
  const body = el(
    "div",
    { className: "perform-missing" },
    el("p", {}, "This one isn't in the hoard any more."),
    el("p", {}, el("a", { href: exitHref }, `Back to ${backLabel}`))
  );
  container.appendChild(el("section", { className: "perform-full" }, topBar, body));

  const unwireNav = wireArrowNav(nav);
  window.addEventListener("hashchange", () => unwireNav(), { once: true });
}

/**
 * The real performance grid for one progression in one key. `nav`, when
 * given ({ prevHref, nextHref }), adds previous/next section controls (a
 * song or setlist context); omitted entirely for a single standalone
 * progression. `labelPrefix` prepends the song/section context to the info
 * strip text. `extra`, when given, is one more control node placed in the
 * strip (the improv-roulette reroll dice — see rerollControl()).
 */
function buildPerformanceView(container, { entry, tonic, exitHref, nav, labelPrefix, extra }) {
  const rendered = renderIn(entry, tonic);
  const chords = rendered.chords;

  // ---- Capo mode (backlog item 5): a toggle that swaps the big symbols for
  // the shapes you'd actually play under the suggested capo, keeping the
  // real sounding chord as small print alongside — for sight-reading while
  // capoed up, rather than having to do the transposition in your head.
  // Ephemeral (resets on re-entry), like the detail view's per-chord toggle.
  let hint = null;
  let playedChords = null;
  if (state.instrument === "guitar") {
    hint = capo.suggest(chords, tonic, !isMajorFamily(entry));
    if (hint) playedChords = renderIn(entry, playedTonicFor(hint)).chords;
  }
  let capoMode = false;

  // ---- Corner strip: exit, key + time signature + capo, wake indicator ----
  const wakeDot = el(
    "span",
    {
      className: "wake-dot",
      attrs: { title: "Screen staying awake", "aria-hidden": "true" },
    },
    "●"
  );
  wakeDot.style.display = "none";

  function infoText() {
    const prefix = labelPrefix || "";
    const base = `${prettyNote(tonic)} ${entry.mode} · ${entry.timeSig}`;
    if (!hint) return prefix + base;
    if (capoMode) {
      return `${prefix}Capo ${hint.capo} · playing as ${hint.playAs} · sounds ${prettyNote(tonic)} ${entry.mode}`;
    }
    return `${prefix}${base} · capo ${hint.capo} (as ${hint.playAs})`;
  }

  const infoSpan = el("span", { className: "perform-strip-info" }, infoText());

  const capoBtn = hint
    ? el(
        "button",
        {
          type: "button",
          className: "perform-capo-toggle",
          attrs: {
            "aria-pressed": String(capoMode),
            title: "Show the shapes to play under the capo instead of the sounding chords",
          },
          on: {
            click: () => {
              capoMode = !capoMode;
              capoBtn.classList.toggle("active", capoMode);
              capoBtn.setAttribute("aria-pressed", String(capoMode));
              infoSpan.textContent = infoText();
              buildGrid();
              applyHighlight();
              layout();
            },
          },
        },
        "Capo mode"
      )
    : null;

  const settingsBtn = el(
    "button",
    {
      type: "button",
      className: "perform-settings",
      attrs: { "aria-label": "Settings" },
      on: { click: () => openSettingsPanel(buildSettingsPanel) },
    },
  );
  settingsBtn.innerHTML = SETTINGS_ICON;

  // ---- Play button (roadmap 1.1) + auto-advance (roadmap 2.3) -------------
  // Always plays/walks the real sounding chords (`chords`, at `tonic`),
  // never the capo-played shapes — same precedent as the tint above: the
  // harmony doesn't change under a capo, only which shape your hands make.
  // Both controls share ONE audioPlayer transport (only one playback runs
  // at a time), so starting either one stops the other; `activeControl`
  // tracks which button is "on" so a click always means "start (or stop)
  // THIS control", never an accidental stop-only tap on the other one.
  let soundingIndex = null;
  let activeControl = null; // "play" | "auto" | null
  function applyHighlight() {
    grid.querySelectorAll(".perform-cell:not(.blank)").forEach((node, i) => {
      node.classList.toggle("sounding", i === soundingIndex);
    });
  }
  function highlightSounding(index) {
    soundingIndex = index;
    applyHighlight();
  }
  function resetPlayUI() {
    if (activeControl === "play") activeControl = null;
    playBtn.textContent = "▶";
    playBtn.classList.remove("active");
    playBtn.setAttribute("aria-label", "Play");
    playBtn.setAttribute("aria-pressed", "false");
    highlightSounding(null);
  }
  const playBtn = el(
    "button",
    {
      type: "button",
      className: "perform-play-toggle",
      attrs: { "aria-label": "Play", "aria-pressed": "false" },
      on: {
        click: () => {
          if (activeControl === "play") {
            audioPlayer.stopPlayback();
            return;
          }
          activeControl = "play";
          playBtn.textContent = "■";
          playBtn.classList.add("active");
          playBtn.setAttribute("aria-label", "Stop");
          playBtn.setAttribute("aria-pressed", "true");
          audioPlayer.playProgression(chords, {
            bpm: bpmForTempo(entry.tempo),
            timeSig: entry.timeSig,
            onChordChange: highlightSounding,
            onStop: resetPlayUI,
          });
        },
      },
    },
    "▶"
  );

  // Auto-advance: a silent, tempo-driven highlight walk for hands-free
  // play-along, reusing the SAME scheduler with the synth muted rather than
  // a second parallel timer — one code path, not two (roadmap 2.3). Loops,
  // per the acceptance criteria, so it keeps walking until stopped.
  let autoBpm = bpmForTempo(entry.tempo);
  function resetAutoUI() {
    if (activeControl === "auto") activeControl = null;
    autoBtn.textContent = "Auto-advance";
    autoBtn.classList.remove("active");
    autoBtn.setAttribute("aria-pressed", "false");
    highlightSounding(null);
  }
  const autoBtn = el(
    "button",
    {
      type: "button",
      className: "perform-auto-toggle",
      attrs: {
        "aria-pressed": "false",
        title: "Silently walk the grid chord by chord at this tempo, hands-free",
      },
      on: {
        click: () => {
          if (activeControl === "auto") {
            audioPlayer.stopPlayback();
            return;
          }
          activeControl = "auto";
          autoBtn.textContent = "Stop";
          autoBtn.classList.add("active");
          autoBtn.setAttribute("aria-pressed", "true");
          audioPlayer.playProgression(chords, {
            bpm: autoBpm,
            timeSig: entry.timeSig,
            loop: true,
            muted: true,
            onChordChange: highlightSounding,
            onStop: resetAutoUI,
          });
        },
      },
    },
    "Auto-advance"
  );
  const autoBpmValue = el("span", { className: "perform-bpm-value" }, `${autoBpm} BPM`);
  const autoBpmStepper = el(
    "div",
    { className: "perform-bpm-stepper" },
    el(
      "button",
      {
        type: "button",
        className: "perform-bpm-btn",
        attrs: { "aria-label": "Slower" },
        on: {
          click: () => {
            autoBpm = Math.max(40, autoBpm - 4);
            autoBpmValue.textContent = `${autoBpm} BPM`;
          },
        },
      },
      "−"
    ),
    autoBpmValue,
    el(
      "button",
      {
        type: "button",
        className: "perform-bpm-btn",
        attrs: { "aria-label": "Faster" },
        on: {
          click: () => {
            autoBpm = Math.min(220, autoBpm + 4);
            autoBpmValue.textContent = `${autoBpm} BPM`;
          },
        },
      },
      "+"
    )
  );

  const stripChildren = [
    el(
      "a",
      {
        className: "perform-exit",
        href: exitHref,
        attrs: { "aria-label": "Exit performance mode" },
      },
      "✕"
    ),
    settingsBtn,
    playBtn,
    extra || null,
  ];
  if (nav) stripChildren.push(navButton("prev", nav.prevHref, "Previous section"));
  stripChildren.push(capoBtn, infoSpan);
  if (nav) stripChildren.push(navButton("next", nav.nextHref, "Next section"));
  stripChildren.push(wakeDot);

  const strip = el("div", { className: "perform-strip" }, ...stripChildren);
  const autoRow = el("div", { className: "perform-auto-row" }, autoBtn, autoBpmStepper);
  // Wrapped with the legend so layout() has one element to measure the
  // fixed "chrome" height from (see .perform-topbar in app.css).
  const topBar = el(
    "div",
    { className: "perform-topbar" },
    strip,
    autoRow,
    legendCaption("perform-legend")
  );

  // ---- Chord grid ----------------------------------------------------------
  // Fixed at TWO columns, always (backlog item 16): four chords are 2×2,
  // eight are 2×4, ten are 2×5. Any shortfall is drawn as empty cells rather
  // than reflowing, and short progressions sit on the same 2×2 base — so
  // chord size shrinks predictably with row count instead of jumping when a
  // column count changes.
  const GRID_COLS = 2;
  const gridRows = Math.max(2, Math.ceil(chords.length / GRID_COLS));
  const grid = el("div", { className: "perform-grid" });

  function buildGrid() {
    clear(grid);
    chords.forEach((chord, i) => {
      const playedChord = playedChords ? playedChords[i] : null;
      const big = capoMode && playedChord ? playedChord : chord;
      // Tint by the real sounding chord's function, not the capo-played
      // shape — the harmonic function doesn't change under a capo, just
      // which shape your hands make.
      const cls = tintClass(chord.numeral, tonic, entry.mode);
      grid.appendChild(
        el(
          "div",
          { className: "perform-cell" },
          el("div", { className: "perform-symbol " + cls }, prettySymbol(big.symbol)),
          el(
            "div",
            { className: "perform-sub" },
            el("span", { className: "perform-numeral " + cls }, chord.display),
            el("span", { className: "perform-beats" }, `${chord.beats}`),
            capoMode && playedChord
              ? el("span", { className: "perform-sounds" }, `sounds ${prettySymbol(chord.symbol)}`)
              : null
          )
        )
      );
    });
    // Fill the last row(s) out to the fixed grid with visible empty cells.
    for (let i = chords.length; i < gridRows * GRID_COLS; i += 1) {
      grid.appendChild(
        el("div", { className: "perform-cell blank", attrs: { "aria-hidden": "true" } })
      );
    }
  }
  buildGrid();
  applyHighlight();

  const root = el("section", { className: "perform-full" }, topBar, grid);
  container.appendChild(root);

  // ---- Fit-to-viewport ------------------------------------------------------
  function layout() {
    const shown = capoMode && playedChords ? playedChords : chords;
    const longest = Math.max(...shown.map((c) => prettySymbol(c.symbol).length));
    const w = root.clientWidth;
    const h = root.clientHeight;
    if (!w || !h) return;
    // Two columns always, portrait or landscape — the row count is the only
    // thing that grows, so the type size scales predictably (item 16).
    const cols = GRID_COLS;
    const rows = gridRows;
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    // First guess from cell geometry, then shrink until nothing overflows.
    const cellW = w / cols;
    const cellH = (h - topBar.offsetHeight) / rows;
    let fs = Math.min(cellH * 0.42, (cellW * 1.55) / Math.max(2, longest));
    fs = Math.max(14, fs);
    root.style.setProperty("--perform-fs", fs + "px");
    for (let i = 0; i < 12; i += 1) {
      const overflowing =
        grid.scrollHeight > grid.clientHeight + 1 ||
        grid.scrollWidth > grid.clientWidth + 1 ||
        root.scrollHeight > root.clientHeight + 1;
      if (!overflowing) break;
      fs *= 0.9;
      root.style.setProperty("--perform-fs", fs + "px");
    }
  }

  // ---- Screen Wake Lock -------------------------------------------------------
  let wakeLock = null;
  let alive = true;

  async function acquireWakeLock() {
    if (!alive || !("wakeLock" in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeDot.style.display = "";
      wakeLock.addEventListener("release", () => {
        wakeDot.style.display = "none";
      });
    } catch {
      wakeDot.style.display = "none"; // refused or unsupported — play on
    }
  }

  function onVisibility() {
    if (document.visibilityState === "visible") acquireWakeLock();
  }

  const unwireNav = wireArrowNav(nav);

  function cleanup() {
    alive = false;
    window.removeEventListener("hashchange", cleanup);
    window.removeEventListener("resize", layout);
    document.removeEventListener("visibilitychange", onVisibility);
    unwireNav();
    audioPlayer.stopPlayback();
    if (wakeLock) {
      wakeLock.release().catch(() => {});
      wakeLock = null;
    }
  }

  window.addEventListener("hashchange", cleanup);
  window.addEventListener("resize", layout);
  document.addEventListener("visibilitychange", onVisibility);

  layout();
  // Fonts and layout settle a tick later; measure once more to be sure.
  requestAnimationFrame(layout);
  acquireWakeLock();
}
