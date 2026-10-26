/*
 * Service worker do Fênix Vôlei (DT-059). Conservador de propósito: guarda só arquivos
 * estáticos que nunca mudam (nome com hash) e a logo; nunca páginas, respostas da API ou
 * fotos, para que dados de uma conta não fiquem no aparelho. Sem internet, mostra
 * /offline no lugar da página.
 */
const VERSION = 'fenix-v1';
const OFFLINE_URL = '/offline';
const PRECACHE = [OFFLINE_URL, '/brand/logo-fenix.png', '/brand/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

/** Arquivos com hash no nome (imutáveis) e a pasta da marca. */
function isStaticAsset(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/brand/');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // API, arquivos e fotos sempre da rede: nada pessoal fica guardado.
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const cached = await cache.match(request);

        if (cached) {
          return cached;
        }

        const response = await fetch(request);

        if (response.ok) {
          void cache.put(request, response.clone());
        }

        return response;
      })
    );

    return;
  }

  // Páginas: sempre da rede; sem conexão, a página de aviso.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error())
    );
  }
});
