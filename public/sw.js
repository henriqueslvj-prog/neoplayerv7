// NeoPlayer service worker.
//
// v2 usava "cache primeiro" para TUDO, inclusive o HTML e o JS do app, e nunca
// apagava versões antigas de cache. Resultado: depois de um deploy novo, o
// navegador continuava servindo o index.html e os bundles JS antigos —
// misturados com CSS/ícones novos buscados da rede — causando exatamente o
// tipo de tela quebrada (logo sumindo, texto de menu em branco) que aparece
// quando pedaços de versões diferentes do app tentam rodar juntos.
//
// v3 corrige isso: HTML/JS/CSS (tudo que pode mudar a cada deploy) vai sempre
// primeiro pela rede, com o cache servindo só como reserva se a rede falhar.
// Ícones e o manifest (que raramente mudam) continuam cache-primeiro, para
// abrir rápido offline. Versões antigas de cache são apagadas na ativação, e
// o novo service worker assume o controle imediatamente, sem esperar todas as
// abas antigas fecharem.

const CACHE = "neoplayer-cache-v3";
const STATIC = ["/manifest.webmanifest", "/favicon.ico", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png"];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).catch(() => {}));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return STATIC.some(p => url.pathname === p) || url.pathname.startsWith("/icons/");
}

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  if (isStaticAsset(url)) {
    // Ícones/manifest: cache primeiro (raramente mudam, ajuda no offline).
    e.respondWith(caches.match(e.request).then(c => c || fetch(e.request)));
    return;
  }

  // Tudo que compõe a versão do app (HTML, JS, CSS): rede primeiro, sempre
  // buscando o que há de mais novo; cache só entra como reserva offline.
  e.respondWith(
    fetch(e.request)
      .then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return r;
      })
      .catch(() => caches.match(e.request).then(c => c || caches.match("/")))
  );
});
