/* Service worker dla Receptury.
   Cache'uje pliki aplikacji (shell) do działania offline.
   NIE dotyka danych — przepisy żyją w IndexedDB, poza zasięgiem SW.
   Po każdej zmianie w app.html podbij CACHE_VERSION, żeby wymusić odświeżenie. */
const CACHE_VERSION = 'receptura-v4';
const APP_SHELL = [
  './app.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png'
];

// instalacja: zapisz shell do cache
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

// aktywacja: usuń stare wersje cache
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// pobieranie: dla plików aplikacji — najpierw cache, w tle odśwież (stale-while-revalidate).
// Dla wszystkiego innego (np. przyszłe API Supabase) — przepuść do sieci bez cache.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // zapisy/synchronizacja — do sieci
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;             // zewnętrzne (Supabase itd.) — do sieci

  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached); // offline — oddaj z cache jeśli jest
      return cached || network;
    })
  );
});
