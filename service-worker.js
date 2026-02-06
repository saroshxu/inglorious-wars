const CACHE_NAME = "pwa-assets-v1"; // bump this to force wholesale recache
const META_CACHE = "pwa-assets-meta-v1";

const ALLOWED_EXTENSIONS = [
	".js",
	".css",
	".png",
	".jpg",
	".jpeg",
	".svg",
	".webp",
	".gif",
	".ico",
	".woff",
	".woff2",
	".ttf",
	".eot",
	".json",
	".map",
];

/* ---------- Utility functions ---------- */

// Return absolute URL string for asset relative to SW origin
function normalizeUrl(u) {
	try {
		return new URL(u, self.location.origin).href;
	} catch (e) {
		return String(u);
	}
}

// Determine whether to cache this URL (skip .php/.html and root)
function isCacheable(url) {
	if (!url) return false;
	const path = url.split("?")[0].split("#")[0];
	if (path.endsWith("/") || path.endsWith(".php") || path.endsWith(".html"))
		return false;
	return ALLOWED_EXTENSIONS.some((ext) => path.endsWith(ext));
}

// Post a message to a specific client (page)
async function postToClient(clientId, message) {
	if (!clientId) return;
	const client = await self.clients.get(clientId);
	if (!client) return;
	client.postMessage(message);
}

/* ---------- Cache helpers ---------- */

async function openCaches() {
	const cache = await caches.open(CACHE_NAME);
	const meta = await caches.open(META_CACHE);
	return { cache, meta };
}

// Fetch asset from network (fresh) and put into cache
async function fetchAndCache(cache, metaCache, url) {
	const response = await fetch(url, {
		cache: "no-store",
		credentials: "same-origin",
	});
	if (!response || !response.ok)
		throw new Error(
			`Failed fetch ${url} (status ${response && response.status})`,
		);
	await cache.put(url, response.clone());

	// store small metadata (etag/last-modified) for later freshness tests
	const meta = {};
	const etag = response.headers.get("etag");
	const lastMod = response.headers.get("last-modified");
	if (etag) meta.etag = etag;
	if (lastMod) meta.lastModified = lastMod;
	meta.timestamp = Date.now();
	try {
		await metaCache.put(
			"/__meta__" + url,
			new Response(JSON.stringify(meta), {
				headers: { "Content-Type": "application/json" },
			}),
		);
	} catch (e) {
		// non-fatal
	}
}

// Check if request exists in cache
async function isInCache(cache, url) {
	const match = await cache.match(url);
	return !!match;
}

/* ---------- Primary behaviors ---------- */

// Batch-cache assets. Returns summary { total, successCount, failed: [ {url, error} ] }
async function cacheAssets(assets, clientId) {
	const normalized = Array.from(
		new Set((assets || []).map(normalizeUrl)),
	).filter(isCacheable);
	const { cache, meta } = await openCaches();

	const failed = [];
	let successCount = 0;

	for (const url of normalized) {
		try {
			// If already cached, still fetch fresh to ensure latest (change if you want cache-first)
			await fetchAndCache(cache, meta, url);
			successCount++;
		} catch (err) {
			failed.push({ url, error: err.message || String(err) });
		}
	}

	const result = {
		type: "CACHE_DONE",
		total: normalized.length,
		successCount,
		failed,
	};
	// Inform requesting client
	await postToClient(clientId, result);
	return result;
}

// Check missing assets and optionally check freshness (HEAD -> compare etag/last-modified)
async function checkMissing(assets, clientId, checkFresh = false) {
	const normalized = Array.from(
		new Set((assets || []).map(normalizeUrl)),
	).filter(isCacheable);
	const { cache, meta } = await openCaches();

	const missing = [];
	const outdated = [];

	for (const url of normalized) {
		const inCache = await isInCache(cache, url);
		if (!inCache) {
			missing.push(url);
			continue;
		}

		if (checkFresh) {
			try {
				// try HEAD to compare
				const head = await fetch(url, {
					method: "HEAD",
					cache: "no-store",
					credentials: "same-origin",
				});
				if (head && head.ok) {
					const remoteEtag = head.headers.get("etag");
					const remoteLast = head.headers.get("last-modified");

					// read metadata if present
					const metaResp = await meta.match("/__meta__" + url);
					let localMeta = {};
					if (metaResp) {
						try {
							localMeta = await metaResp.json();
						} catch (e) {
							localMeta = {};
						}
					} else {
						// best-effort: read headers from cached response
						const cachedResp = await cache.match(url);
						if (cachedResp) {
							localMeta.etag = cachedResp.headers.get("etag");
							localMeta.lastModified =
								cachedResp.headers.get("last-modified");
						}
					}

					if (
						remoteEtag &&
						localMeta.etag &&
						remoteEtag !== localMeta.etag
					) {
						outdated.push(url);
						continue;
					}
					if (
						remoteLast &&
						localMeta.lastModified &&
						remoteLast !== localMeta.lastModified
					) {
						outdated.push(url);
						continue;
					}
				}
			} catch (e) {
				// network or HEAD not allowed — ignore freshness check for this item
			}
		}
	}

	const msg = { type: "MISSING_ASSETS", missing, outdated };
	await postToClient(clientId, msg);
	return msg;
}

/* ---------- Event handlers ---------- */

self.addEventListener("install", (evt) => {
	// minimal install behavior. We don't precache by default.
	self.skipWaiting();
});

self.addEventListener("activate", (evt) => {
	evt.waitUntil(self.clients.claim());
});

// Handle incoming messages from pages
self.addEventListener("message", (event) => {
	// Expect { type, payload }
	const clientId = event.source && event.source.id;
	const data = event.data || {};
	const type = data.type;
	const payload = data.payload || {};

	// Use async wrapper to handle promises
	(async () => {
		try {
			if (type === "CACHE_ASSETS") {
				const assets = Array.isArray(payload.assets)
					? payload.assets
					: [];
				await cacheAssets(assets, clientId);
				return;
			}

			if (type === "CHECK_MISSING") {
				const assets = Array.isArray(payload.assets)
					? payload.assets
					: [];
				const checkFresh = !!payload.checkFresh;
				await checkMissing(assets, clientId, checkFresh);
				return;
			}

			// unknown command - echo back
			await postToClient(clientId, {
				type: "UNKNOWN_COMMAND",
				original: data,
			});
		} catch (err) {
			// send error back
			await postToClient(clientId, {
				type: "CACHE_ERROR",
				error: err && err.message ? err.message : String(err),
			});
		}
	})();
});

// Fetch handler - only intercept cacheable static assets, never php/html/pages
self.addEventListener("fetch", (event) => {
	const url = new URL(event.request.url);

	// Never touch pages
	if (
		url.pathname === "/" ||
		url.pathname.endsWith(".php") ||
		url.pathname.endsWith(".html")
	) {
		return;
	}

	// Only consider cacheable extensions
	if (!isCacheable(url.pathname)) {
		return;
	}

	// IMPORTANT:
	// Only respond if asset is ALREADY cached
	event.respondWith(
		caches.match(event.request).then((cached) => {
			if (cached) return cached;

			// VERY IMPORTANT:
			// Do NOT fetch here — let browser handle it
			return fetch(event.request);
			// or simply: return Response.error();
		}),
	);
});
