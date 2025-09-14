// Název cache - změňte pro invalidaci a novou instalaci
const CACHE_NAME = 'pedrova-jizda-cache-v2';
// Seznam všech souborů, které jsou potřeba pro offline běh
const assetsToCache = [
  './',
  'index.html',
  'icon.svg',
  'manifest.json',
  // Externí zdroje jako Skypack a Google Fonts jsou také potřeba
  'https://cdn.skypack.dev/three@0.132.2',
  'https://cdn.skypack.dev/three@0.132.2/examples/jsm/objects/Reflector.js',
  'https://cdn.skypack.dev/three@0.132.2/examples/jsm/postprocessing/EffectComposer.js',
  'https://cdn.skypack.dev/three@0.132.2/examples/jsm/postprocessing/RenderPass.js',
  'https://cdn.skypack.dev/three@0.132.2/examples/jsm/postprocessing/UnrealBloomPass.js',
  'https://cdn.skypack.dev/three@0.132.2/examples/jsm/postprocessing/ShaderPass.js',
  'https://fonts.googleapis.com/css2?family=Roboto+Condensed:ital,wght@0,700;1,400&family=Teko:wght@400;600&display=swap'
];

/**
 * Událost 'install':
 * Spustí se při první instalaci Service Workeru.
 * Otevře cache a vloží do ní všechny definované assety.
 */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Přednačítám soubory do cache.');
        return cache.addAll(assetsToCache);
      })
      .catch(error => {
        console.error('[Service Worker] Chyba při přednačítání souborů:', error);
      })
  );
});

/**
 * Událost 'activate':
 * Spustí se, když je nový Service Worker aktivován.
 * Projde všechny existující cache a smaže ty, které neodpovídají aktuální verzi (CACHE_NAME).
 * Tím je zajištěno, že se používají vždy nejnovější soubory.
 */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Mažu starou cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

/**
 * Událost 'fetch':
 * Zachytává všechny síťové požadavky ze stránky.
 * Implementuje strategii "Stale-While-Revalidate":
 * 1. Okamžitě se pokusí odpovědět souborem z cache (rychlé načtení).
 * 2. Současně pošle požadavek na síť, aby získal nejnovější verzi.
 * 3. Pokud je síťový požadavek úspěšný, aktualizuje soubor v cache pro příští návštěvu.
 * 4. Pokud soubor v cache není, čeká na odpověď ze sítě.
 */
self.addEventListener('fetch', event => {
  // Ignorujeme požadavky, které nejsou typu GET
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);
      
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Pokud je odpověď ze sítě v pořádku, aktualizujeme cache
        if (networkResponse && networkResponse.status === 200) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(error => {
        console.warn('[Service Worker] Síťový požadavek selhal. Použije se cache, pokud je dostupná.', error);
        // Pokud síť selže, vrátíme alespoň to, co je v cache
        return cachedResponse;
      });

      // Vrátíme odpověď z cache, pokud existuje (pro rychlost), jinak čekáme na síť
      return cachedResponse || fetchPromise;
    })
  );
});

