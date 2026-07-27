/* Vanilla Service Worker for Words of the Buddha (public copy aligned with src/sw.ts)
 * - On install: cache a minimal, durable core from offline-manifest.json
 * - Fetch: navigation NetworkFirst with offline fallback; static assets CacheFirst
 * - Message API: CACHE_URLS (bulk), PAUSE_JOB, RESUME_JOB, CANCEL_JOB, CLEAR_ALL (keeps core)
 */

const CORE_CACHE = "core-v3";
const NAV_CACHE = "navigations-v1";
const ASSETS_CACHE = "assets-v1";
const FONTS_LOCAL_CACHE = "fonts-local-v1";
const FONTS_WEB_CACHE = "fonts-web-v1";

// Consider URLs without a known file extension as HTML-like navigations.
// Slugs like "/sn12.2" include a dot but are NOT file extensions; we only
// treat it as an asset if the extension is in this known set.
const KNOWN_ASSET_EXT = new Set([
	"css",
	"js",
	"mjs",
	"json",
	"png",
	"jpg",
	"jpeg",
	"svg",
	"webp",
	"ico",
	"woff",
	"woff2",
	"ttf",
	"otf",
	"map",
	"txt",
	"pdf",
]);

function isHtmlLikePath(pathname) {
	if (pathname.endsWith("/")) return true;
	if (/\/index\.html$/.test(pathname)) return true;
	const last = pathname.split("/").pop() || "";
	const dotIdx = last.lastIndexOf(".");
	if (dotIdx === -1) return true;
	const ext = last.slice(dotIdx + 1).toLowerCase();
	return !KNOWN_ASSET_EXT.has(ext);
}

/* Cache Storage keeps decoded bodies, so transfer compression is lost the moment
 * a page is cached: the prerendered corpus costs ~177MB on disk versus ~30MB
 * gzipped. We therefore gzip HTML ourselves before storing it and decode on the
 * way out. A private marker header is used rather than Content-Encoding because
 * the browser does not re-apply content decoding to responses a service worker
 * synthesizes — every read must go through decodeCachedResponse.
 */
const CACHE_ENCODING_HEADER = "x-wotb-cache-encoding";

const canCompressCache =
	typeof CompressionStream !== "undefined" &&
	typeof DecompressionStream !== "undefined";

function isCompressibleResponse(res) {
	if (!res || !res.ok || !res.body) return false;
	if (res.type === "opaque") return false;
	return (res.headers.get("content-type") || "").includes("text/html");
}

/** Stores `res` gzipped when possible, falling back to an as-is put. */
async function putMaybeCompressed(cache, key, res) {
	if (!canCompressCache || !isCompressibleResponse(res)) {
		return cache.put(key, res);
	}
	const fallback = res.clone();
	try {
		const compressed = await new Response(
			res.body.pipeThrough(new CompressionStream("gzip")),
		).arrayBuffer();
		const headers = new Headers(res.headers);
		headers.set(CACHE_ENCODING_HEADER, "gzip");
		headers.delete("content-length");
		await cache.put(
			key,
			new Response(compressed, {
				status: res.status,
				statusText: res.statusText,
				headers,
			}),
		);
	} catch {
		await cache.put(key, fallback);
	}
}

/** Inverse of putMaybeCompressed; a no-op for entries we did not compress. */
function decodeCachedResponse(res) {
	if (!res || res.headers.get(CACHE_ENCODING_HEADER) !== "gzip") return res;
	if (!res.body || typeof DecompressionStream === "undefined") return res;
	const headers = new Headers(res.headers);
	headers.delete(CACHE_ENCODING_HEADER);
	headers.delete("content-length");
	return new Response(
		res.body.pipeThrough(new DecompressionStream("gzip")),
		{
			status: res.status,
			statusText: res.statusText,
			headers,
		},
	);
}

self.addEventListener("install", (event) => {
	event.waitUntil(
		(async () => {
			try {
				const res = await fetch("/offline-manifest.json", {
					cache: "no-store",
				});
				const manifest = await res.json();
				// Minimal, durable core; do NOT include collection pages here
				const coreList = new Set([
					"/",
					"/offline",
					"/offline-manifest.json",
					"/search",
					"/manifest.webmanifest",
					...((manifest && manifest.coreAssets) || []),
				]);
				const cache = await caches.open(CORE_CACHE);
				await cache.addAll(Array.from(coreList));
			} catch (e) {
				// ignore
			}
			await self.skipWaiting();
		})(),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			// Drop old core caches when we bump the version
			try {
				const names = await caches.keys();
				await Promise.all(
					names.map((n) => {
						if (n.startsWith("core-") && n !== CORE_CACHE) {
							return caches.delete(n);
						}
						return Promise.resolve(false);
					}),
				);
			} catch {}
			await self.clients.claim();
		})(),
	);
});

/**
 * Warms the nav + asset caches from a response. Never await this on the path
 * that produces a navigation response: reading the body and prefetching assets
 * would hold the document back by however long those fetches take.
 */
function warmFromResponse(res, cacheKey, cache, url) {
	const copy = res.clone();
	return (async () => {
		try {
			await putMaybeCompressed(cache, cacheKey, copy.clone());
			const ct = copy.headers.get("content-type") || "";
			if (ct.includes("text/html")) {
				await prefetchLinkedAssets(await copy.text(), url);
			}
		} catch {}
	})();
}

async function networkFirst(req, event) {
	const cache = await caches.open(NAV_CACHE);
	const url = new URL(req.url);
	// Special-case /search: don't cache per-query HTML; only cache base shell when online
	if (url.pathname === "/search") {
		try {
			const ctrl = new AbortController();
			const to = setTimeout(() => ctrl.abort(), 5000);
			const res = await fetch(req, { signal: ctrl.signal });
			clearTimeout(to);
			if (res && res.ok && !url.search) {
				const warm = warmFromResponse(res, "/search", cache, url);
				if (event) event.waitUntil(warm);
			}
			return res;
		} catch (_) {
			const base = await caches.match("/search");
			if (base) return decodeCachedResponse(base);
			const off = await caches.match("/offline");
			return off
				? decodeCachedResponse(off)
				: new Response("", { status: 503, statusText: "Offline" });
		}
	}

	try {
		const ctrl = new AbortController();
		const to = setTimeout(() => ctrl.abort(), 5000);
		const res = await fetch(req, { signal: ctrl.signal });
		clearTimeout(to);
		if (res && res.ok) {
			const warm = warmFromResponse(res, req, cache, url);
			if (event) event.waitUntil(warm);
		}
		return res;
	} catch (_) {
		// Default: Try any cache, then nav cache, then offline, including normalized variants
		const tryMatch = async (key) =>
			(await cache.match(key)) || (await caches.match(key));
		let cached = (await tryMatch(req)) || (await tryMatch(url.pathname));
		if (!cached) {
			const p = url.pathname;
			const variants = new Set();
			variants.add(p.endsWith("/") ? p.slice(0, -1) : p + "/");
			if (p.endsWith("/index.html"))
				variants.add(p.replace(/\/?index\.html$/, "/"));
			else variants.add((p.endsWith("/") ? p : p + "/") + "index.html");
			for (const v of variants) {
				cached = await tryMatch(v);
				if (cached) break;
			}
		}
		if (cached) return decodeCachedResponse(cached);
		const off = await caches.match("/offline");
		return off
			? decodeCachedResponse(off)
			: new Response("", { status: 503, statusText: "Offline" });
	}
}

async function cacheFirst(req, cacheName) {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(req);
	if (cached) return cached;
	try {
		const res = await fetch(req);
		if (res && res.ok) {
			try {
				await cache.put(req, res.clone());
			} catch {}
		}
		return res;
	} catch (_) {
		return cached || Response.error();
	}
}

// Network-first for assets: try network, cache result, fall back to cache if offline
async function networkFirstAsset(req, cacheName) {
	const cache = await caches.open(cacheName);
	try {
		const res = await fetch(req);
		if (res && res.ok) {
			try {
				await cache.put(req, res.clone());
			} catch {}
		}
		return res;
	} catch (_) {
		const cached = await cache.match(req);
		return cached || Response.error();
	}
}

self.addEventListener("fetch", (event) => {
	const req = event.request;
	const url = new URL(req.url);

	// Detect localhost/dev environment
	const isLocalhost = /^localhost$|^127\.0\.0\.1$|^\[::1\]$/.test(
		self.location.hostname,
	);

	// In dev mode, use network-first for everything to avoid stale cache issues
	// Only intercept to provide offline fallback
	if (isLocalhost) {
		// For navigations in dev, use networkFirst (already handles offline fallback)
		if (req.mode === "navigate") {
			event.respondWith(networkFirst(req, event));
			return;
		}
		// For other requests in dev, prefer network but cache for offline
		if (url.origin === self.location.origin) {
			event.respondWith(networkFirstAsset(req, ASSETS_CACHE));
			return;
		}
		// Let external requests pass through
		return;
	}

	// === PRODUCTION MODE BELOW ===

	// Serve offline-manifest.json from cache when possible, with {} fallback offline
	if (
		url.origin === self.location.origin &&
		url.pathname === "/offline-manifest.json"
	) {
		event.respondWith(
			(async () => {
				const cached = await caches.match("/offline-manifest.json");
				if (cached) return decodeCachedResponse(cached);
				try {
					const res = await fetch(req);
					const core = await caches.open(CORE_CACHE);
					core.put("/offline-manifest.json", res.clone());
					return res;
				} catch (_) {
					return new Response("{}", {
						headers: { "content-type": "application/json" },
					});
				}
			})(),
		);
		return;
	}

	// Navigations
	if (req.mode === "navigate") {
		event.respondWith(networkFirst(req, event));
		return;
	}

	// Built asset bundles emitted by Astro/Vite
	// Skip caching large image assets (content-images) for offline to save storage
	if (
		url.origin === self.location.origin &&
		url.pathname.startsWith("/_astro/")
	) {
		// Raster images + SVG emitted as static URLs: don't CacheFirst so updated
		// icons/illustrations (e.g. design-system) aren't stuck after deploy.
		const isImage = /\.(webp|jpg|jpeg|png|avif|svg)$/i.test(url.pathname);
		if (isImage) {
			// Use network-first without persistent caching for discourse images
			event.respondWith(fetch(req).catch(() => Response.error()));
			return;
		}
		event.respondWith(cacheFirst(req, ASSETS_CACHE));
		return;
	}

	// Local assets
	if (
		url.origin === self.location.origin &&
		url.pathname.startsWith("/assets/")
	) {
		event.respondWith(cacheFirst(req, ASSETS_CACHE));
		return;
	}
	// Favicons/public
	if (
		url.origin === self.location.origin &&
		/(favicon|android-chrome|apple-touch-icon|robots\.txt|manifest\.webmanifest)/.test(
			url.pathname,
		)
	) {
		event.respondWith(cacheFirst(req, ASSETS_CACHE));
		return;
	}
	// Fonts local
	if (
		url.origin === self.location.origin &&
		url.pathname.startsWith("/assets/fonts/")
	) {
		event.respondWith(cacheFirst(req, FONTS_LOCAL_CACHE));
		return;
	}
	// Google fonts
	if (/https?:\/\/fonts\.(gstatic|googleapis)\.com\//.test(url.href)) {
		event.respondWith(cacheFirst(req, FONTS_WEB_CACHE));
		return;
	}

	// Catch-all: cache any same-origin JS/CSS that wasn't handled above
	// This ensures dynamically imported chunks get cached for offline use
	if (url.origin === self.location.origin) {
		const ext = url.pathname.split(".").pop()?.toLowerCase();
		if (ext === "js" || ext === "mjs" || ext === "css") {
			event.respondWith(cacheFirst(req, ASSETS_CACHE));
			return;
		}
	}
});

// Messaging for bulk caching
const CONTROLLER = {
	abortController: null,
	paused: false,
	resumeResolvers: [],
};

function notifyAll(message) {
	return self.clients
		.matchAll({ includeUncontrolled: true })
		.then((clients) => {
			clients.forEach((c) => c.postMessage(message));
		});
}

function waitWhilePaused(signal) {
	if (!CONTROLLER.paused) return Promise.resolve();
	return new Promise((resolve) => {
		const done = () => resolve();
		CONTROLLER.resumeResolvers.push(done);
		// If aborted while waiting, resolve immediately
		const onAbort = () => {
			signal.removeEventListener("abort", onAbort);
			resolve();
		};
		signal.addEventListener("abort", onAbort);
	});
}

async function fetchAndCacheBatch(urls, cacheName, signal, progressKey) {
	// Route non-HTML assets to global assets cache; ignore cacheName
	const assetsCache = await caches.open(ASSETS_CACHE);
	let done = 0;
	for (const url of urls) {
		if (signal.aborted) throw new Error("cancelled");
		// Pause support
		if (CONTROLLER.paused) {
			await notifyAll({
				type: "PAUSED",
				progressKey,
				done,
				total: urls.length,
			});
			await waitWhilePaused(signal);
			if (signal.aborted) throw new Error("cancelled");
			await notifyAll({
				type: "RESUMED",
				progressKey,
				done,
				total: urls.length,
			});
		}
		try {
			const res = await fetch(url, { credentials: "same-origin" });
			if (res && (res.ok || res.type === "opaque")) {
				let treatAsNavigation = false;
				try {
					const u = new URL(url, self.location.origin);
					treatAsNavigation =
						u.origin === self.location.origin &&
						isHtmlLikePath(u.pathname);
				} catch {
					treatAsNavigation =
						/^\//.test(url) && !/\.[a-zA-Z0-9]+$/.test(url);
				}
				if (treatAsNavigation) {
					const navCache = await caches.open(NAV_CACHE);
					try {
						const u = new URL(url, self.location.origin);
						if (u.pathname !== "/offline") {
							try {
								await putMaybeCompressed(
									navCache,
									url,
									res.clone(),
								);
							} catch {}
						}
						// Prefetch linked assets for this HTML (always)
						try {
							const ct = res.headers.get("content-type") || "";
							if (ct.includes("text/html")) {
								const html = await res.clone().text();
								await prefetchLinkedAssets(html, u);
							}
						} catch {}
					} catch {}
				} else {
					try {
						await assetsCache.put(url, res.clone());
					} catch {}
				}
			}
		} catch (e) {
			await notifyAll({
				type: "ERROR",
				progressKey,
				url,
				error: String(e),
			});
		}
		done += 1;
		await notifyAll({
			type: "PROGRESS",
			progressKey,
			done,
			total: urls.length,
		});
	}
}

async function prefetchLinkedAssets(html, baseUrl) {
	try {
		const assetHrefs = new Set();
		const re = /\b(?:href|src)=("|')(.*?)\1/gi;
		let m;
		while ((m = re.exec(html))) {
			const raw = m[2];
			if (!raw) continue;
			let abs;
			try {
				abs = new URL(raw, baseUrl).href;
			} catch {
				continue;
			}
			const u = new URL(abs);
			const sameOrigin = u.origin === self.location.origin;
			const path = u.pathname;
			if (
				sameOrigin &&
				(path.startsWith("/_astro/") ||
					path.startsWith("/assets/") ||
					/favicon|manifest\.webmanifest/.test(path))
			) {
				assetHrefs.add(u.href);
			}
		}
		if (assetHrefs.size === 0) return;
		const cache = await caches.open(ASSETS_CACHE);
		await Promise.all(
			Array.from(assetHrefs).map(async (href) => {
				try {
					const req = new Request(href, {
						credentials: "same-origin",
					});
					const hit = await cache.match(req);
					if (hit) return;
					const res = await fetch(req);
					if (res && res.ok) {
						try {
							await cache.put(req, res.clone());
						} catch {}
					}
				} catch {}
			}),
		);
	} catch {}
}

self.addEventListener("message", (event) => {
	const data = event.data || {};
	// Lightweight handshake for clients to confirm SW control (useful on iOS PWA)
	if (data.type === "PING") {
		event.waitUntil(
			(async () => {
				try {
					await self.clients.claim();
				} catch {}
				try {
					event.source?.postMessage?.({ type: "PONG" });
				} catch {
					await notifyAll({ type: "PONG" });
				}
			})(),
		);
		return;
	}
	if (data.type === "CACHE_URLS") {
		const { urls = [], cacheName = "bulk-v1", progressKey = "job" } = data;
		CONTROLLER.abortController?.abort();
		CONTROLLER.abortController = new AbortController();
		CONTROLLER.paused = false;
		// drain previous resolvers
		(CONTROLLER.resumeResolvers || []).splice(0).forEach((fn) => {
			try {
				fn();
			} catch {}
		});
		const signal = CONTROLLER.abortController.signal;
		event.waitUntil(
			(async () => {
				try {
					await notifyAll({
						type: "STARTED",
						progressKey,
						total: urls.length,
					});
					await fetchAndCacheBatch(
						urls,
						cacheName,
						signal,
						progressKey,
					);
					await notifyAll({ type: "DONE", progressKey });
				} catch (e) {
					const msgType =
						String(e) === "cancelled" ? "CANCELLED" : "ERROR";
					await notifyAll({
						type: msgType,
						progressKey,
						error: String(e),
					});
				}
			})(),
		);
	} else if (data.type === "CANCEL_JOB") {
		CONTROLLER.abortController?.abort();
		CONTROLLER.paused = false;
		(CONTROLLER.resumeResolvers || []).splice(0).forEach((fn) => {
			try {
				fn();
			} catch {}
		});
	} else if (data.type === "PAUSE_JOB") {
		CONTROLLER.paused = true;
		notifyAll({ type: "PAUSED", progressKey: data.progressKey || "job" });
	} else if (data.type === "RESUME_JOB") {
		CONTROLLER.paused = false;
		(CONTROLLER.resumeResolvers || []).splice(0).forEach((fn) => {
			try {
				fn();
			} catch {}
		});
		notifyAll({ type: "RESUMED", progressKey: data.progressKey || "job" });
	} else if (data.type === "CLEAR_ALL") {
		event.waitUntil(
			(async () => {
				// Delete all non-core caches for a clean reset, keep CORE_CACHE
				const keys = await caches.keys();
				await Promise.all(
					keys.map((k) => {
						if (k.startsWith("core-"))
							return Promise.resolve(false);
						return caches.delete(k);
					}),
				);
				// Try to refresh core entries from network when possible
				try {
					const core = await caches.open(CORE_CACHE);
					const [offlineRes, manifestRes, searchRes] =
						await Promise.all([
							fetch("/offline", { cache: "reload" }).catch(
								() => null,
							),
							fetch("/offline-manifest.json", {
								cache: "reload",
							}).catch(() => null),
							fetch("/search", { cache: "reload" }).catch(
								() => null,
							),
						]);
					if (offlineRes)
						await core.put("/offline", offlineRes.clone());
					if (manifestRes)
						await core.put(
							"/offline-manifest.json",
							manifestRes.clone(),
						);
					if (searchRes) await core.put("/search", searchRes.clone());
				} catch {}
				await notifyAll({ type: "CLEARED" });
			})(),
		);
	}
});
