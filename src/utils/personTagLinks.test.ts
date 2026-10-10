import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveCharacterLinks } from "./personTagLinks";

describe("resolveCharacterLinks", () => {
	it("resolves labels to /on person hubs", () => {
		const [mara] = resolveCharacterLinks(["Māra the Evil One"]);
		assert.equal(mara?.href, "/on/mara-the-evil-one");
		assert.equal(mara?.title, "Māra the Evil One");
	});

	it("strips honorifics via the canonical slug pipeline", () => {
		const [tesa] = resolveCharacterLinks(["Brahmin Tesa"]);
		assert.equal(tesa?.href, "/on/tesa");
		assert.equal(tesa?.title, "Brahmin Tesa");
	});

	it("resolves comma-containing labels via title match", () => {
		const [sakka] = resolveCharacterLinks(["Sakka, lord of the gods"]);
		assert.equal(sakka?.href, "/on/sakka-lord-of-the-gods");
	});

	it("splits comma-separated string frontmatter when no single match", () => {
		const links = resolveCharacterLinks(
			"Venerable Sāriputta, Venerable Candikāputta",
		);
		assert.deepEqual(
			links.map((l) => l.href),
			["/on/sariputta", "/on/candikaputta"],
		);
	});

	it("keeps a quoted comma label whole when it matches a person", () => {
		const links = resolveCharacterLinks("Venerable Bhaddiya, son of Kāḷīgodhā");
		assert.equal(links.length, 1);
		assert.equal(links[0]?.href, "/on/bhaddiya-son-of-kaligodha");
	});

	it("splits array frontmatter items independently", () => {
		const links = resolveCharacterLinks([
			"Sakka, lord of the gods",
			"Brahmin Tesa",
		]);
		assert.deepEqual(
			links.map((l) => l.href),
			["/on/sakka-lord-of-the-gods", "/on/tesa"],
		);
	});

	it("degrades to an unlinked tag for unknown labels", () => {
		const [unknown] = resolveCharacterLinks(["Some Unknown Person"]);
		assert.equal(unknown?.href, undefined);
		assert.equal(unknown?.label, "Some Unknown Person");
	});

	it("adds an appear-count fallback for 1-discourse persons without a bio", () => {
		const [dabba] = resolveCharacterLinks(["Venerable Dabba Mallaputta"]);
		assert.equal(dabba?.href, "/on/dabba-mallaputta");
		assert.equal(dabba?.description, undefined);
		assert.match(
			dabba?.fallbackContext ?? "",
			/^_Appears in 1 discourse in this library\._/,
		);
	});

	it("appends the first discourse description for 2-discourse fallbacks", () => {
		const [dasama] = resolveCharacterLinks(["Householder Dasama"]);
		assert.match(
			dasama?.fallbackContext ?? "",
			/^_Appears in 2 discourses in this library\._ .+/,
		);
	});

	it("gives no fallback for 3+ discourse persons without a bio", () => {
		const [dona] = resolveCharacterLinks(["Brahmin Doṇa"]);
		assert.equal(dona?.href, "/on/dona");
		assert.equal(dona?.description, undefined);
		assert.equal(dona?.fallbackContext, undefined);
	});

	it("skips empty entries and de-duplicates case-insensitively", () => {
		const links = resolveCharacterLinks([
			"",
			"Brahmin Tesa",
			"brahmin tesa",
		]);
		assert.equal(links.length, 1);
		assert.equal(links[0]?.label, "Brahmin Tesa");
	});

	it("returns nothing for absent or empty frontmatter", () => {
		assert.deepEqual(resolveCharacterLinks(undefined), []);
		assert.deepEqual(resolveCharacterLinks(null), []);
		assert.deepEqual(resolveCharacterLinks(""), []);
	});
});