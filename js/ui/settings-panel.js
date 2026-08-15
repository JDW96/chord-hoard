// settings-panel.js — a small singleton settings overlay, opened from the
// header's cog icon (backlog item 15). Modeled on diagram-popup.js's pattern
// (one instance at the end of <body>, reused across opens) but for anything
// that isn't tied to a specific chord. Right now it holds one row (the
// harmonic-function colour toggle, moved here from its own header icon on
// 2026-08-15 so it's reachable from every route); more settings — a
// light/dark override is the obvious next one — get added as more rows,
// not more header icons.

import { el, clear } from "./util.js";

let host = null;
let keydownBound = false;

function onKeydown(ev) {
  if (ev.key === "Escape") closeSettingsPanel();
}

function ensureHost() {
  if (host) return host;
  host = el("div", { className: "settings-panel" });
  host.setAttribute("role", "dialog");
  host.setAttribute("aria-modal", "true");
  host.setAttribute("aria-label", "Settings");
  host.addEventListener("click", (ev) => {
    if (ev.target === host) closeSettingsPanel();
  });
  document.body.appendChild(host);
  // A route change navigates the visitor away, so the panel shouldn't linger.
  window.addEventListener("hashchange", closeSettingsPanel);
  return host;
}

export function closeSettingsPanel() {
  if (!host || !host.classList.contains("open")) return;
  host.classList.remove("open");
  clear(host);
  if (keydownBound) {
    document.removeEventListener("keydown", onKeydown);
    keydownBound = false;
  }
}

/**
 * Open the panel. `build(body)` fills it with settingsRow()s — called fresh
 * on every open, so it always reflects current state without the caller
 * having to track a stale reference.
 */
export function openSettingsPanel(build) {
  const h = ensureHost();
  closeSettingsPanel();
  h.classList.add("open");

  const body = el("div", { className: "settings-panel-body" });
  const panel = el(
    "div",
    { className: "settings-panel-sheet" },
    el(
      "div",
      { className: "settings-panel-head" },
      el("h3", {}, "Settings"),
      el(
        "button",
        {
          type: "button",
          className: "settings-panel-close",
          attrs: { "aria-label": "Close" },
          on: { click: closeSettingsPanel },
        },
        "✕"
      )
    ),
    body
  );

  clear(h);
  h.appendChild(panel);
  if (!keydownBound) {
    document.addEventListener("keydown", onKeydown);
    keydownBound = true;
  }
  build(body);
}

/** A label(+description) on the left, a control on the right — every
 * settings row should look the same, now and later. */
export function settingsRow(label, description, control) {
  return el(
    "div",
    { className: "settings-row" },
    el(
      "div",
      { className: "settings-row-text" },
      el("strong", {}, label),
      description ? el("span", { className: "muted" }, description) : null
    ),
    control
  );
}
