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
import { tintClass } from "./function-tint.js";
import { openSettingsPanel } from "./settings-panel.js";
import { createWordBanner } from "./words.js";
import { metaLine } from "./symbols.js";
import { voicingsFor, guitarChordSVG, pianoChordSVG } from "./diagrams.js";
import { chosenVoicingIndex } from "./voicing-choice.js";
import { el, clear, prettySymbol, prettyNote, capitalise, getGuitarData } from "./util.js";

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
 * The performance stage for one progression in one key — the teleprompter
 * (STYLEGUIDE §5.6), which replaced the 2×2 grid.
 *
 * The change in idea: the whole progression used to have to fit on screen at
 * once, which meant a ten-chord entry shrank every chord until none of them
 * were readable at arm's length. Now ONE chord is the subject of the screen
 * and the rest is context arranged around it — a queue rail down the left,
 * the next chord below, beats as dots. Nothing has to shrink to fit, so the
 * old measure-and-shrink loop is gone; clamp() sizes the chord and only an
 * unusually long symbol needs measuring (see fitNow()).
 *
 * `nav`, when given ({ prevHref, nextHref }), adds previous/next controls (a
 * song or setlist context); omitted for a standalone progression.
 * `labelPrefix` prepends the song/section context to the meta line. `extra`
 * is one more control for the bar (the improv-roulette dice).
 */
function buildPerformanceView(container, { entry, tonic, exitHref, nav, labelPrefix, extra }) {
  const rendered = renderIn(entry, tonic);
  const chords = rendered.chords;

  // ---- Capo mode (backlog item 5), unchanged in behaviour: swap the big
  // symbols for the shapes you'd actually play under the suggested capo,
  // keeping the real sounding chord as small print alongside.
  let hint = null;
  let playedChords = null;
  if (state.instrument === "guitar") {
    hint = capo.suggest(chords, tonic, !isMajorFamily(entry));
    if (hint) playedChords = renderIn(entry, playedTonicFor(hint)).chords;
  }
  let capoMode = false;

  // The chord currently under the spotlight. Everything on the stage — rail,
  // NOW, NEXT, beats, shape — is a function of this one number, so there is
  // exactly one thing to update when playback advances or a rail entry is
  // tapped, rather than four things to keep in step.
  let currentIndex = 0;
  let playing = false;

  /** The chord to DISPLAY at an index: the played shape under capo mode,
      the sounding chord otherwise. */
  function shown(i) {
    return capoMode && playedChords ? playedChords[i] : chords[i];
  }
  /** Tint always follows the REAL harmonic function, never the capo-played
      shape — a capo changes which shape your hands make, not what the chord
      is doing. Same rule the grid followed before this rewrite. */
  function tintOf(i) {
    return tintClass(chords[i].numeral, tonic, entry.mode);
  }

  // ---- Title block --------------------------------------------------------
  const wakeDot = el(
    "span",
    { className: "stage-wake", attrs: { title: "Screen staying awake", "aria-hidden": "true" } },
    "●"
  );
  wakeDot.style.display = "none";

  function metaText() {
    const prefix = labelPrefix || "";
    const base = `${prettyNote(tonic)} ${entry.mode} · ${entry.timeSig} · ${autoBpm} BPM`;
    if (!hint) return `${prefix}${base} · no capo`;
    if (capoMode) {
      return `${prefix}Capo ${hint.capo} · playing as ${hint.playAs} · sounds ${prettyNote(tonic)} ${entry.mode}`;
    }
    return `${prefix}${base} · capo ${hint.capo} (as ${hint.playAs})`;
  }

  const metaSpan = el("span", {}, "");
  // The wake dot is appended rather than passed as a meta part: it spends
  // most of its life hidden, and a hidden part would still leave metaLine's
  // " · " separator dangling at the end of the line.
  const metaNode = metaLine([metaSpan], { className: "stage-meta" });
  metaNode.appendChild(wakeDot);
  const titleBlock = el(
    "div",
    { className: "stage-title-block" },
    el("div", { className: "stage-name" }, entry.name),
    metaNode
  );

  function refreshMeta() {
    metaSpan.textContent = metaText();
  }

  // ---- Queue rail ---------------------------------------------------------
  // Every chord down the left edge, the current one at full strength with a
  // function-tinted rule beside it. Tapping one jumps the stage there, which
  // is how you get back to the top of a progression mid-song without
  // waiting for the loop to come round.
  const rail = el("div", {
    className: "stage-rail" + (chords.length > 8 ? " dense" : ""),
    attrs: { role: "group", "aria-label": "Chords in this progression" },
  });

  function buildRail() {
    clear(rail);
    chords.forEach((_, i) => {
      rail.appendChild(
        el(
          "button",
          {
            type: "button",
            className: "stage-rail-item " + tintOf(i),
            attrs: { "aria-label": `Jump to ${prettySymbol(shown(i).symbol)}` },
            on: { click: () => showChord(i) },
          },
          prettySymbol(shown(i).symbol)
        )
      );
    });
  }

  // ---- NOW ----------------------------------------------------------------
  // The symbol itself stays --ink and only the rule under it takes the
  // harmony colour (§5.6): on a near-black stage the current chord has to be
  // the brightest thing on screen, and tinting the glyph would dim it. So
  // the tint class goes on the OUTER element, whose border-bottom draws in
  // currentColor, and the inner span holds the text at full strength.
  const nowText = el("span", { className: "stage-chord-text" });
  const nowChord = el("div", { className: "stage-chord" }, nowText);
  const nowBeats = el("span", { className: "beat-dots beat-dots-lg" });
  const nowBeatsLabel = el("span", { className: "meta stage-beats-label" }, "");
  const nowSounds = el("span", { className: "meta stage-sounds" }, "");
  const nowShape = el("div", { className: "stage-shape" });
  const nowBlock = el(
    "div",
    { className: "stage-now" },
    nowChord,
    el("div", { className: "stage-beats" }, nowBeats, nowBeatsLabel, nowSounds),
    nowShape
  );

  // ---- NEXT ---------------------------------------------------------------
  const nextChord = el("div", { className: "stage-next-chord" });
  const nextBlock = el(
    "div",
    { className: "stage-next" },
    el("div", { className: "meta stage-next-label" }, "Next"),
    nextChord
  );

  // ---- Lyric words (roadmap 2.4) -----------------------------------------
  const wordBanner = createWordBanner({ className: "stage-words" });
  function rotateWords() {
    wordBanner.reroll();
  }

  // ---- Chord shapes -------------------------------------------------------
  // Loaded lazily and cached for the life of this view. A failed fetch just
  // leaves the shape blank — the chord itself is what matters on stage.
  let guitarData = null;
  let guitarPending = false;
  function ensureGuitarData() {
    if (guitarData || guitarPending || state.instrument !== "guitar") return;
    guitarPending = true;
    getGuitarData()
      .then((data) => {
        guitarData = data;
        drawShape();
      })
      .catch(() => {
        /* no shapes on stage; the chord symbol still reads */
      });
  }

  function drawShape() {
    const chord = shown(currentIndex);
    if (state.instrument === "piano") {
      nowShape.innerHTML = pianoChordSVG(chord);
      return;
    }
    if (!guitarData) {
      nowShape.innerHTML = "";
      return;
    }
    const voicings = voicingsFor(chord, guitarData);
    if (!voicings || !voicings.length) {
      nowShape.innerHTML = "";
      return;
    }
    // Honour the voicing the player picked in the detail view — the whole
    // point of voicing-choice.js is that choosing an easier F once fixes it
    // everywhere, and the stage is where it matters most.
    const index = chosenVoicingIndex(chord, voicings);
    nowShape.innerHTML = guitarChordSVG(voicings[index], {
      title: prettySymbol(chord.symbol),
    });
  }

  // ---- Beat dots ----------------------------------------------------------
  // Filled left to right across the sounding chord. audio-player only calls
  // back per CHORD, not per beat, so the fill is driven here from the tempo:
  // one dot every secPerBeat from the moment the chord lands. It can drift a
  // few milliseconds from the audio clock, which is the same trade the
  // chord highlight has always made and is invisible on a dot.
  let beatTimer = null;
  function stopBeatFill() {
    if (beatTimer) {
      clearInterval(beatTimer);
      beatTimer = null;
    }
  }

  function paintBeats(filled) {
    nowBeats.querySelectorAll(".beat-dot").forEach((d, i) => {
      d.classList.toggle("on", i < filled);
    });
  }

  function startBeatFill() {
    stopBeatFill();
    if (!playing) return;
    const total = chords[currentIndex].beats;
    let filled = 1;
    paintBeats(filled);
    const msPerBeat = 60000 / autoBpm;
    beatTimer = setInterval(() => {
      filled += 1;
      if (filled > total) {
        stopBeatFill();
        return;
      }
      paintBeats(filled);
    }, msPerBeat);
  }

  // ---- The one update path ------------------------------------------------
  function showChord(i) {
    if (i == null) {
      // Playback ended: keep the stage on the first chord rather than
      // blanking it, so the screen still reads as a chart between takes.
      playing = false;
      stopBeatFill();
      paintBeats(0);
      return;
    }
    currentIndex = ((i % chords.length) + chords.length) % chords.length;
    const chord = shown(currentIndex);
    const tint = tintOf(currentIndex);

    nowText.textContent = prettySymbol(chord.symbol);
    nowChord.className = "stage-chord " + tint;

    // Beat dots are rebuilt per chord because the count changes with it.
    clear(nowBeats);
    nowBeats.className = "beat-dots beat-dots-lg " + tint;
    for (let b = 0; b < chords[currentIndex].beats; b += 1) {
      nowBeats.appendChild(el("span", { className: "beat-dot", attrs: { "aria-hidden": "true" } }));
    }
    const beats = chords[currentIndex].beats;
    nowBeatsLabel.textContent = `${beats} ${beats === 1 ? "beat" : "beats"}`;
    nowSounds.textContent =
      capoMode && playedChords ? `sounds ${prettySymbol(chords[currentIndex].symbol)}` : "";

    const nextIdx = (currentIndex + 1) % chords.length;
    nextChord.textContent = prettySymbol(shown(nextIdx).symbol);
    nextChord.className = "stage-next-chord " + tintOf(nextIdx);

    rail.querySelectorAll(".stage-rail-item").forEach((node, idx) => {
      node.classList.toggle("current", idx === currentIndex);
    });

    drawShape();
    fitNow();
    startBeatFill();
  }

  // ---- Controls -----------------------------------------------------------
  const settingsBtn = el(
    "button",
    {
      type: "button",
      className: "stage-settings",
      attrs: { "aria-label": "Settings" },
      on: { click: () => openSettingsPanel(buildSettingsPanel) },
    },
  );
  settingsBtn.innerHTML = SETTINGS_ICON;

  let autoBpm = bpmForTempo(entry.tempo);
  let activeControl = null; // "play" | "auto" | null

  function resetPlayUI() {
    if (activeControl === "play") activeControl = null;
    playBtn.textContent = "▶ Play";
    playBtn.classList.remove("active");
    playBtn.setAttribute("aria-label", "Play");
    playBtn.setAttribute("aria-pressed", "false");
    playing = false;
    showChord(null);
    showControls();
  }

  const playBtn = el(
    "button",
    {
      type: "button",
      className: "pill stage-play",
      attrs: { "aria-label": "Play", "aria-pressed": "false" },
      on: {
        click: () => {
          if (activeControl === "play") {
            audioPlayer.stopPlayback();
            return;
          }
          activeControl = "play";
          playing = true;
          playBtn.textContent = "■ Stop";
          playBtn.classList.add("active");
          playBtn.setAttribute("aria-label", "Stop");
          playBtn.setAttribute("aria-pressed", "true");
          audioPlayer.playProgression(chords, {
            bpm: autoBpm,
            timeSig: entry.timeSig,
            loop: true,
            onChordChange: showChord,
            onLoop: rotateWords,
            onStop: resetPlayUI,
          });
          idleHide();
        },
      },
    },
    "▶ Play"
  );

  function resetAutoUI() {
    if (activeControl === "auto") activeControl = null;
    autoBtn.textContent = "⟳ Auto";
    autoBtn.classList.remove("active");
    autoBtn.setAttribute("aria-pressed", "false");
    playing = false;
    showChord(null);
    showControls();
  }

  const autoBtn = el(
    "button",
    {
      type: "button",
      className: "pill stage-auto",
      attrs: {
        "aria-pressed": "false",
        title: "Silently walk the chords at this tempo, hands-free",
      },
      on: {
        click: () => {
          if (activeControl === "auto") {
            audioPlayer.stopPlayback();
            return;
          }
          activeControl = "auto";
          playing = true;
          autoBtn.textContent = "⟳ Stop";
          autoBtn.classList.add("active");
          autoBtn.setAttribute("aria-pressed", "true");
          audioPlayer.playProgression(chords, {
            bpm: autoBpm,
            timeSig: entry.timeSig,
            loop: true,
            muted: true,
            onChordChange: showChord,
            onLoop: rotateWords,
            onStop: resetAutoUI,
          });
          idleHide();
        },
      },
    },
    "⟳ Auto"
  );

  const bpmValue = el("span", { className: "stepper-value" }, `${autoBpm}`);
  function stepBpm(delta) {
    autoBpm = Math.min(220, Math.max(40, autoBpm + delta));
    bpmValue.textContent = `${autoBpm}`;
    refreshMeta();
  }
  const bpmStepper = el(
    "div",
    { className: "stepper stage-bpm" },
    el("button", { type: "button", attrs: { "aria-label": "Slower" }, on: { click: () => stepBpm(-4) } }, "−"),
    bpmValue,
    el("button", { type: "button", attrs: { "aria-label": "Faster" }, on: { click: () => stepBpm(4) } }, "+")
  );

  const capoBtn = hint
    ? el(
        "button",
        {
          type: "button",
          className: "pill stage-capo",
          attrs: {
            "aria-pressed": String(capoMode),
            title: "Show the shapes to play under the capo instead of the sounding chords",
          },
          on: {
            click: () => {
              capoMode = !capoMode;
              capoBtn.classList.toggle("active", capoMode);
              capoBtn.setAttribute("aria-pressed", String(capoMode));
              refreshMeta();
              buildRail();
              showChord(currentIndex);
            },
          },
        },
        "Capo"
      )
    : null;

  const controlChildren = [
    el("a", { className: "stage-exit", href: exitHref, attrs: { "aria-label": "Exit performance mode" } }, "✕"),
    settingsBtn,
  ];
  if (nav) controlChildren.push(stageNav("prev", nav.prevHref, "Previous section"));
  controlChildren.push(playBtn, autoBtn, bpmStepper, capoBtn, extra || null);
  if (nav) controlChildren.push(stageNav("next", nav.nextHref, "Next section"));

  const controls = el("div", { className: "stage-controls" }, ...controlChildren);

  // ---- Control auto-hide (§5.6) -------------------------------------------
  // Four idle seconds while something is running and the bar fades out, so
  // the stage is just the music. Any tap brings it back. Never while idle —
  // a still screen with no visible controls reads as broken — and never at
  // all under prefers-reduced-motion.
  const reduceMotion =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let hideTimer = null;

  function showControls() {
    controls.classList.remove("hidden");
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
  }

  function idleHide() {
    if (reduceMotion) return;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (playing) controls.classList.add("hidden");
    }, 4000);
  }

  function onStageTap() {
    showControls();
    if (playing) idleHide();
  }

  // ---- Assemble -----------------------------------------------------------
  // NOW and NEXT share a wrapper so landscape can put them side by side by
  // flipping one flex-direction (§5.6). They were siblings of the rail and
  // the words at first, which meant "NEXT to the right of NOW" was not
  // expressible in CSS at all and NEXT kept its own full-width row —
  // stealing the height the chord needed and pushing it over the rail.
  const centre = el("div", { className: "stage-centre" }, nowBlock, nextBlock);

  const root = el(
    "section",
    { className: "perform-full stage" },
    titleBlock,
    rail,
    centre,
    wordBanner.node,
    controls
  );
  container.appendChild(root);

  buildRail();
  refreshMeta();
  ensureGuitarData();
  showChord(0);

  root.addEventListener("pointerdown", onStageTap);

  // ---- Fit the NOW chord --------------------------------------------------
  // clamp() in --fs-chord-now handles the ordinary case; this only catches a
  // long symbol ("A♭add9") that would run off the side at the clamped size.
  // One measure-and-scale, not the old repeated shrink loop over a grid.
  function fitNow() {
    root.style.removeProperty("--perform-now-fs");
    // Leave the queue rail its own column: a long symbol scaled only to the
    // full width would centre itself straight over the rail's chords.
    const railW = rail.offsetWidth || 0;
    const available = root.clientWidth - 32 - railW * 2;
    if (available <= 0 || !nowText.scrollWidth) return;
    const overflow = nowText.scrollWidth / available;
    if (overflow > 1) {
      const base = parseFloat(getComputedStyle(nowChord).fontSize);
      root.style.setProperty("--perform-now-fs", Math.floor(base / overflow) + "px");
    }
  }

  // ---- Screen Wake Lock ---------------------------------------------------
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
    window.removeEventListener("resize", fitNow);
    document.removeEventListener("visibilitychange", onVisibility);
    root.removeEventListener("pointerdown", onStageTap);
    if (hideTimer) clearTimeout(hideTimer);
    stopBeatFill();
    unwireNav();
    wordBanner.dispose();
    audioPlayer.stopPlayback();
    if (wakeLock) {
      wakeLock.release().catch(() => {});
      wakeLock = null;
    }
  }

  window.addEventListener("hashchange", cleanup);
  window.addEventListener("resize", fitNow);
  document.addEventListener("visibilitychange", onVisibility);

  fitNow();
  // Fonts and layout settle a tick later; measure once more to be sure.
  requestAnimationFrame(fitNow);
  acquireWakeLock();
}

/** Previous/next section control for the stage's control bar. */
function stageNav(direction, href, label) {
  const props = {
    className: "stage-nav " + direction + (href ? "" : " disabled"),
    attrs: { "aria-label": label },
  };
  if (href) props.href = href;
  else props.attrs["aria-disabled"] = "true";
  return el("a", props, direction === "prev" ? "‹" : "›");
}
