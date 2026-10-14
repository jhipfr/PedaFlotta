// Service worker : met l'application en cache pour l'utilisation hors ligne.
// Changer CACHE à chaque publication pour forcer la mise à jour chez les utilisateurs.
const CACHE = "pedaflotta-web-12";
const FILES = [
  "./", "index.html", "style.css", "model.js", "portrait.js", "app.js", "manifest.webmanifest",
  "img/plongeur.png", "img/diver_body.png", "img/diver_up.png", "img/diver_down.png", "img/Souris.png", "img/sable.png", "img/ciel.png", "icons/icon-192.png", "icons/icon-512.png",
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
