import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	PUBLIC_PAGE_CACHE_CONTROL,
	PUBLIC_SSR_ROUTE_PATTERNS,
	withPublicEdgeCache,
} from "./edgeCache";

function input(
	path: string,
	init: RequestInit = {},
	cookieHeaders: string[] = [],
) {
	const url = new URL(path, "https://www.wordsofthebuddha.org");
	return {
		request: new Request(url, init),
		url,
		cookies: { headers: () => cookieHeaders },
	};
}

describe("withPublicEdgeCache", () => {
	it("marks a plain 200 HTML page as CDN-cacheable", () => {
		const res = withPublicEdgeCache(
			input("/mn65/en/sujato?ref=1"),
			new Response("<html></html>", {
				headers: { "Content-Type": "text/html" },
			}),
		);
		assert.equal(res.headers.get("Cache-Control"), PUBLIC_PAGE_CACHE_CONTROL);
		assert.equal(res.headers.get("Content-Type"), "text/html");
	});

	it("caches redirects and 404s", () => {
		for (const status of [301, 302, 404]) {
			const res = withPublicEdgeCache(
				input("/qualities/x"),
				new Response(null, { status }),
			);
			assert.equal(res.headers.get("Cache-Control"), PUBLIC_PAGE_CACHE_CONTROL);
		}
	});

	it("keeps a Cache-Control the route already chose", () => {
		const res = withPublicEdgeCache(
			input("/bad-friendship"),
			new Response(null, {
				status: 302,
				headers: { Location: "/on/bad-friendship", "Cache-Control": "no-store" },
			}),
		);
		assert.equal(res.headers.get("Cache-Control"), "no-store");
	});

	it("never caches when a cookie is being set", () => {
		const viaHeader = withPublicEdgeCache(
			input("/mn1"),
			new Response("x", { headers: { "Set-Cookie": "session=abc" } }),
		);
		assert.equal(viaHeader.headers.get("Cache-Control"), null);

		const viaContext = withPublicEdgeCache(
			input("/mn1", {}, ["session=abc; Path=/"]),
			new Response("x"),
		);
		assert.equal(viaContext.headers.get("Cache-Control"), null);

		const attached = new Response("x");
		Reflect.set(attached, Symbol.for("astro.cookies"), {
			headers: () => ["session=abc"],
		});
		const viaResponse = withPublicEdgeCache(input("/mn1"), attached);
		assert.equal(viaResponse.headers.get("Cache-Control"), null);
	});

	it("skips non-GET, Authorization, /api, and 5xx", () => {
		const cases = [
			withPublicEdgeCache(input("/mn1", { method: "POST" }), new Response("x")),
			withPublicEdgeCache(
				input("/mn1", { headers: { Authorization: "Bearer t" } }),
				new Response("x"),
			),
			withPublicEdgeCache(input("/api/search"), new Response("x")),
			withPublicEdgeCache(input("/mn1"), new Response("x", { status: 500 })),
		];
		for (const res of cases) assert.equal(res.headers.get("Cache-Control"), null);
	});
});

describe("PUBLIC_SSR_ROUTE_PATTERNS", () => {
	it("excludes signed-in and per-user routes", () => {
		for (const pattern of [
			"/profile",
			"/signin",
			"/dashboard",
			"/review-room",
			"/admin/ask",
			"/shared-ask/[slug]",
			"/ask/[slug]",
			"/research/[slug]",
		]) {
			assert.equal(PUBLIC_SSR_ROUTE_PATTERNS.has(pattern), false, pattern);
		}
	});
});
