import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import {
	parseSearchIndexJson,
	searchIndexOrigin,
} from "./loadSearchIndexData";
import { decodeMaybeGzip } from "./gzipJsonFile";
import { publicJsonCandidates } from "./loadSearchIndexData.server";
import { gzipSync } from "node:zlib";

describe("searchIndexOrigin", () => {
	it("prefers the Astro site over VERCEL_URL", () => {
		assert.equal(
			searchIndexOrigin(
				{
					SITE: "https://from-env.example",
					VERCEL_URL: "app.vercel.app",
				},
				"https://www.wordsofthebuddha.org",
			),
			"https://www.wordsofthebuddha.org",
		);
	});

	it("uses the production domain before the deployment host", () => {
		assert.equal(
			searchIndexOrigin(
				{
					VERCEL_PROJECT_PRODUCTION_URL: "www.wordsofthebuddha.org",
					VERCEL_URL: "app.vercel.app",
				},
				"",
			),
			"https://www.wordsofthebuddha.org",
		);
	});

	it("falls back to localhost when nothing is set", () => {
		assert.equal(searchIndexOrigin({}, ""), "http://localhost:4321");
	});
});

describe("parseSearchIndexJson", () => {
	it("rejects HTML payloads that used to 502 Ask", () => {
		assert.throws(
			() =>
				parseSearchIndexJson(
					"<!DOCTYPE html><html><body>Login</body></html>",
					"search-index.json",
					"https://app.vercel.app/search-index.json",
				),
			/got HTML instead of JSON/,
		);
	});

	it("parses a document array", () => {
		const docs = parseSearchIndexJson(
			'[{"slug":"mn10","title":"Satipaṭṭhāna"}]',
			"search-index.json",
			"disk",
		);
		assert.equal(docs[0]?.slug, "mn10");
	});
});

describe("decodeMaybeGzip", () => {
	it("gunzips serverless companions and passes through plain JSON", () => {
		const json = '[{"slug":"mn10"}]';
		assert.equal(decodeMaybeGzip("search-index.json", Buffer.from(json)), json);
		assert.equal(
			decodeMaybeGzip(
				"search-index.json.gz",
				gzipSync(Buffer.from(json, "utf8")),
			),
			json,
		);
	});
});

describe("publicJsonCandidates", () => {
	it("looks in generated/ first so includeFiles land in the function", () => {
		const candidates = publicJsonCandidates("search-index.json");
		assert.equal(
			candidates[0],
			path.join(process.cwd(), "generated", "search-index.json"),
		);
		assert.equal(
			candidates[1],
			path.join(process.cwd(), "generated", "search-index.json.gz"),
		);
		assert.ok(
			candidates.includes(path.join(process.cwd(), "search-index.json")),
		);
	});
});
