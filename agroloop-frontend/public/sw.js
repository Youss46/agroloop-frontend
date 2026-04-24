const CACHE_VERSION = "v1";
const SHELL_CACHE = `agroloop-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `agroloop-static-${CACHE_VERSION}`;
const API_CACHE = `agroloop-api-${CACHE_VERSION}`;

// App shell — resources always needed to render the app
const SHELL_URLS = [
  "/",
  "/manifest.json",
  "/favicon.svg",
  "/brand/agroloop-icon.png",
  "/brand/agroloop-logo-light.png",
  "/brand/agroloop-logo-dark.png",
];

// ─── Install: pre-cache the shell ─────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  const currentCaches = [SHELL_CACHE, STATIC_CACHE, API_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => !currentCaches.includes(name))
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch: routing strategy ──────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests (except our API)
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin && !url.hostname.includes("agroloopci.ci")) return;

  // 1. API calls → Network-first, fallback to cache (max 5 min stale)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstWithTimeout(request, API_CACHE, 4000));
    return;
  }

  // 2. Static assets (JS/CSS/images/fonts) → Cache-first, update in background
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstWithRevalidate(request, STATIC_CACHE));
    return;
  }

  // 3. Navigation (HTML) → Shell cache fallback so app works offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/").then((cached) => cached || new Response("Hors ligne", { status: 503 }))
      )
    );
    return;
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|svg|webp|woff2?|ttf|ico)(\?.*)?$/.test(pathname);
}

async function networkFirstWithTimeout(request, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response(JSON.stringify({ error: "Hors ligne" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function cacheFirstWithRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  return cached || fetchPromise;
}
