// Service worker : met l'application en cache pour l'utilisation hors ligne.
// Stratégie « réseau d'abord » : en ligne, on prend toujours la dernière version publiée (et on met le cache à jour) ;
// hors ligne, on sert la copie en cache. Changer CACHE à chaque publication reste conseillé.
const CACHE = "pedaflotta-web-31";
const FILES = [
  "./", "index.html", "style.css", "model.js", "portrait.js", "app.js", "niveau2.html", "niveau3.html", "niveau4.html", "niveau2.js", "manifest.webmanifest",
  "img/plongeur.png", "son/inflateur.mp3", "img/diver_body.png", "img/diver_up.png", "img/diver_down.png", "img/Souris.png", "img/sable.png", "img/ciel.png", "icons/icon-192.png", "icons/icon-512.png",
];
self.addEventListener("install", (e) => {
  // cache: "reload" : ne pas reprendre les fichiers du cache HTTP du navigateur (GitHub Pages les garde 10 min)
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" })
      .then((r) => {
        if (r.ok) { const copie = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copie)); }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
