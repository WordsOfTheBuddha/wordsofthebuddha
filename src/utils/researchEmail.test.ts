import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildResearchReadyEmail,
	publicResearchEmailOrigin,
	researchEmailFromAddress,
	researchResultHref,
} from "./researchEmail";

describe("research email payload", () => {
	it("builds a signed-in-only result link", () => {
		assert.equal(
			researchResultHref("abc-1", "https://www.wordsofthebuddha.org"),
			"https://www.wordsofthebuddha.org/search?mode=research&research=abc-1",
		);
	});

	it("never puts a localhost or loopback origin in the result link", () => {
		assert.equal(
			publicResearchEmailOrigin("http://localhost:4321"),
			"https://www.wordsofthebuddha.org",
		);
		assert.equal(
			publicResearchEmailOrigin("http://127.0.0.1:4321"),
			"https://www.wordsofthebuddha.org",
		);
		assert.equal(
			publicResearchEmailOrigin("http://[::1]:4321"),
			"https://www.wordsofthebuddha.org",
		);
		assert.equal(
			researchResultHref("abc-1", "http://localhost:4321"),
			"https://www.wordsofthebuddha.org/search?mode=research&research=abc-1",
		);
	});

	it("uses the verified domain when no explicit from is set", () => {
		assert.equal(
			researchEmailFromAddress("", "wordsofthebuddha.org"),
			"Ask <ask@wordsofthebuddha.org>",
		);
		assert.equal(
			researchEmailFromAddress("Ask <hello@example.com>", "wordsofthebuddha.org"),
			"Ask <hello@example.com>",
		);
	});

	it("writes a ready subject and does not call a provider", () => {
		const mail = buildResearchReadyEmail({
			lookingFor: "feeling (vedanā)",
			question: "What do the discourses teach about feeling?",
			jobId: "job-1",
			origin: "https://www.wordsofthebuddha.org",
			ok: true,
		});
		assert.equal(mail.subject, "Your research on feeling (vedanā) is ready");
		assert.match(mail.text, /signed in/);
		assert.match(mail.html, /research=job-1/);
		assert.doesNotMatch(mail.html, /<script/i);
	});

	it("writes a failure note", () => {
		const mail = buildResearchReadyEmail({
			lookingFor: "feeling",
			question: "feeling?",
			jobId: "job-2",
			ok: false,
		});
		assert.equal(mail.subject, "Research could not finish");
		assert.match(mail.text, /try again/i);
		assert.doesNotMatch(mail.href, /localhost|127\.0\.0\.1/i);
	});

	it("rewrites a local job origin in the ready mail", () => {
		const mail = buildResearchReadyEmail({
			lookingFor: "feeling",
			question: "feeling?",
			jobId: "job-3",
			origin: "http://localhost:4321",
			ok: true,
		});
		assert.equal(
			mail.href,
			"https://www.wordsofthebuddha.org/search?mode=research&research=job-3",
		);
		assert.doesNotMatch(mail.text, /localhost|127\.0\.0\.1/i);
		assert.doesNotMatch(mail.html, /localhost|127\.0\.0\.1/i);
	});
});
