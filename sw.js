// Service worker : reçoit les fichiers partagés (menu « Partager » d'Android)
// et met l'app en cache pour qu'elle s'ouvre instantanément.
const APP_CACHE = 'vocal-texte-v1';
const SHARE_CACHE = 'shared-files';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== APP_CACHE && key !== SHARE_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1) Réception d'un partage : on stocke le fichier puis on ouvre l'app.
  if (event.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith((async () => {
      try {
        const form = await event.request.formData();
        const files = form.getAll('audio').filter((f) => f && typeof f !== 'string');
        const cache = await caches.open(SHARE_CACHE);
        await cache.delete('shared-audio');
        if (files.length) {
          const file = files[0];
          await cache.put('shared-audio', new Response(file, {
            headers: {
              'Content-Type': file.type || 'application/octet-stream',
              'X-Filename': encodeURIComponent(file.name || 'note-vocale'),
            },
          }));
        }
      } catch (e) {
        // On ouvre l'app quand même ; elle affichera « aucun fichier reçu ».
      }
      return Response.redirect(new URL('./?shared=1', self.registration.scope).href, 303);
    })());
    return;
  }

  // 2) Fichiers de l'app : réseau d'abord (pour les mises à jour), cache sinon.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const res = await fetch(event.request);
      if (res.ok) {
        const cache = await caches.open(APP_CACHE);
        cache.put(event.request, res.clone());
      }
      return res;
    } catch (e) {
      const cached = await caches.match(event.request, { ignoreSearch: true });
      return cached || caches.match('./index.html');
    }
  })());
});
