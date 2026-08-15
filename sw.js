/* Chord Hoard service worker — cache-first, fully offline once installed.
   Bump CACHE_VERSION whenever any precached file changes, so returning
   visitors pick up the new build. */

const CACHE_VERSION = 'chordhoard-v9';

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/engine/theory.js',
  './js/engine/numeral.js',
  './js/engine/chords.js',
  './js/engine/capo.js',
  './js/engine/complexity.js',
  './js/engine/progression.js',
  './js/engine/harmony.js',
  './js/ui/app.js',
  './js/ui/util.js',
  './js/ui/hoard.js',
  './js/ui/detail.js',
  './js/ui/diagrams.js',
  './js/ui/diagram-popup.js',
  './js/ui/voicing-choice.js',
  './js/ui/chord-link.js',
  './js/ui/circle-of-fifths.js',
  './js/ui/chord-copy.js',
  './js/ui/function-tint.js',
  './js/ui/chords-lib.js',
  './js/ui/scales-lib.js',
  './js/ui/perform.js',
  './data/vocab.json',
  './data/guitar-chords.json',
  './data/progressions/index.json',
  './data/progressions/seed.json',
  './data/progressions/theatre.json',
  './data/progressions/pop-rock.json',
  './data/progressions/folk-celtic.json',
  './data/progressions/blues-soul-gospel.json',
  './data/progressions/diatonic-essentials.json',
  './data/progressions/jazz-standards.json',
  './data/progressions/cinematic.json',
  './data/progressions/latin-reggae.json',
  './data/progressions/electronic-indie.json',
  './data/progressions/country-americana.json',
  './data/progressions/odd-metres-long-forms.json',
  './data/progressions/modal-depth.json',
  './data/progressions/comedy-novelty.json',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        // Cache any same-origin file we fetch at runtime (e.g. future
        // progression batches added to the manifest).
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => {
        // Offline and not cached: for navigations, fall back to the shell.
        if (request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
