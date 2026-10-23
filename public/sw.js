// Service worker mínimo: permite instalar la app y abrirla aunque falle la cobertura.
// Las páginas se piden siempre a la red (para tener la última versión) y solo
// se usa la copia guardada si no hay conexión. Supabase nunca se cachea.
const CACHE = 'los-sauces-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Las páginas se piden sin caché del navegador: así siempre llega la última versión publicada
  const peticion = e.request.mode === 'navigate' ? fetch(e.request.url, { cache: 'no-store', credentials: 'same-origin' }) : fetch(e.request);
  e.respondWith(
    peticion
      .then((res) => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copia));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./'))),
  );
});
