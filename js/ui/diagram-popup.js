// diagram-popup.js — full-size chord diagram overlay (backlog item 4).
//
// A single popup instance lives at the end of <body>, reused across opens.
// Callers hand over a `build(body, refresh)` function that fills the popup
// body; calling the given `refresh()` afterwards (e.g. once a "try another
// shape" control changes some local state) redraws the body in place without
// closing and reopening the dialog. `refresh()` is a no-op once the popup has
// since been closed or replaced, so a stale closure can never repaint a
// dialog the visitor isn't looking at.

import { el, clear } from "./util.js";

let host = null;
let keydownBound = false;
let openToken = 0;

function onKeydown(ev) {
  if (ev.key === "Escape") closeDiagramPopup();
}

function ensureHost() {
  if (host) return host;
  host = el("div", { className: "diagram-popup" });
  host.setAttribute("role", "dialog");
  host.setAttribute("aria-modal", "true");
  host.addEventListener("click", (ev) => {
    if (ev.target === host) closeDiagramPopup();
  });
  document.body.appendChild(host);
  // A route change navigates the visitor away from whatever the popup was
  // showing, so it should not linger over the next view.
  window.addEventListener("hashchange", closeDiagramPopup);
  return host;
}

export function closeDiagramPopup() {
  if (!host || !host.classList.contains("open")) return;
  openToken += 1; // invalidates any refresh() closures from this open
  host.classList.remove("open");
  clear(host);
  if (keydownBound) {
    document.removeEventListener("keydown", onKeydown);
    keydownBound = false;
  }
}

/**
 * Open the popup.
 * @param {string} title       Chord symbol (or similar), shown as a heading.
 * @param {string} [chordsHref] If given, a link through to the Chords tab.
 * @param {(body: HTMLElement, refresh: () => void) => void} build
 *   Fills the popup body. Called immediately, and again by refresh().
 */
export function openDiagramPopup({ title, chordsHref, build }) {
  const h = ensureHost();
  closeDiagramPopup(); // clears any popup already open, bumping the token
  h.classList.add("open");
  const myToken = openToken;

  const body = el("div", { className: "diagram-popup-body" });
  function refresh() {
    if (openToken !== myToken) return; // this popup has since been closed
    clear(body);
    build(body, refresh);
  }

  const panel = el(
    "div",
    { className: "diagram-popup-panel" },
    el(
      "div",
      { className: "diagram-popup-head" },
      el("h3", {}, title),
      el(
        "button",
        {
          type: "button",
          className: "diagram-popup-close",
          attrs: { "aria-label": "Close" },
          on: { click: closeDiagramPopup },
        },
        "✕"
      )
    ),
    body,
    chordsHref
      ? el(
          "a",
          {
            className: "diagram-popup-link",
            href: chordsHref,
            on: { click: closeDiagramPopup },
          },
          "Open in Chords tab ›"
        )
      : null
  );

  clear(h);
  h.appendChild(panel);
  if (!keydownBound) {
    document.addEventListener("keydown", onKeydown);
    keydownBound = true;
  }
  build(body, refresh);
}
