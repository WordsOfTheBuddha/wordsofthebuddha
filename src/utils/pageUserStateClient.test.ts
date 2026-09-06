import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { highlightSlugFromUrl } from "./highlightSlug";
import {
	discourseSlugFromPath,
	emptyPageUserState,
	loadPageUserState,
	pageStateQueryFromLocation,
	parsePageUserState,
	resetPageUserStateClient,
} from "./pageUserStateClient";

describe("pageUserStateClient", () => {
	afterEach(() => {
		resetPageUserStateClient();
		delete (globalThis as { fetch?: typeof fetch }).fetch;
	});

	it("takes a discourse slug from the last path segment only", () => {
		assert.equal(discourseSlugFromPath("/mn1"), "mn1");
		assert.equal(discourseSlugFromPath("/sn55.21"), "sn55.21");
		assert.equal(discourseSlugFromPath("/dhp1-20"), "dhp1-20");
		assert.equal(discourseSlugFromPath("/sn"), "");
		assert.equal(discourseSlugFromPath("/mn"), "");
		assert.equal(discourseSlugFromPath("/search"), "");
		assert.equal(discourseSlugFromPath("/"), "");
	});

	it("builds highlight slugs the same way as highlight restore", () => {
		assert.equal(highlightSlugFromUrl("https://x.test/mn1"), "/mn1");
		assert.equal(
			highlightSlugFromUrl("https://x.test/mn1?pli=true"),
			"/mn1?pli=true&layout=interleaved",
		);
		assert.equal(
			highlightSlugFromUrl("https://x.test/mn1?pli=true&layout=split"),
			"/mn1?pli=true&layout=split",
		);
	});

	it("sends slug only for discourses and always sends highlightSlug", () => {
		const discourse = pageStateQueryFromLocation({
			href: "https://x.test/mn1?pli=true",
			pathname: "/mn1",
		});
		assert.equal(discourse.get("slug"), "mn1");
		assert.equal(
			discourse.get("highlightSlug"),
			"/mn1?pli=true&layout=interleaved",
		);

		const collection = pageStateQueryFromLocation({
			href: "https://x.test/sn",
			pathname: "/sn",
		});
		assert.equal(collection.get("slug"), null);
		assert.equal(collection.get("highlightSlug"), "/sn");
	});

	it("parses signed-in and signed-out payloads", () => {
		assert.deepEqual(parsePageUserState(null), emptyPageUserState());
		assert.deepEqual(
			parsePageUserState({
				signedIn: true,
				user: {
					displayName: "Ānanda",
					email: "a@example.com",
					emailVerified: true,
				},
				hasRead: true,
				isSaved: false,
				isInReadLater: true,
				highlights: { rangyHash: "abc" },
			}),
			{
				signedIn: true,
				user: {
					displayName: "Ānanda",
					email: "a@example.com",
					emailVerified: true,
				},
				hasRead: true,
				isSaved: false,
				isInReadLater: true,
				highlights: { rangyHash: "abc" },
			},
		);
	});

	it("dedupes concurrent loadPageUserState fetches", async () => {
		let calls = 0;
		const previousWindow = (globalThis as { window?: unknown }).window;
		(globalThis as { window: { location: { href: string; pathname: string } } }).window =
			{
				location: {
					href: "https://x.test/mn1",
					pathname: "/mn1",
				},
			};
		(globalThis as { fetch: typeof fetch }).fetch = (async () => {
			calls += 1;
			return {
				ok: true,
				json: async () => ({ signedIn: false }),
			};
		}) as unknown as typeof fetch;

		try {
			const [a, b] = await Promise.all([
				loadPageUserState(),
				loadPageUserState(),
			]);
			assert.equal(calls, 1);
			assert.equal(a?.signedIn, false);
			assert.equal(b?.signedIn, false);
		} finally {
			if (previousWindow === undefined) {
				delete (globalThis as { window?: unknown }).window;
			} else {
				(globalThis as { window?: unknown }).window = previousWindow;
			}
		}
	});
});
