import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	ASK_ANSWER_SYSTEM,
	ASK_FUNCTION_BUDGET_MS,
	ASK_WRITER_MAX_MS,
	ASK_WRITER_MIN_MS,
	askAnswerHints,
	buildAskAnswerEvidence,
	buildAskAnswerUserPrompt,
	composeFullDiscourseText,
	createWatchdogAbortSignal,
	formatAskAnswerEvidenceBlock,
	parseAskAnswerSummary,
	pickMatchingParagraphs,
	RESEARCH_FULL_TEXT_CHARS,
	resolveAskWriterBudgetMs,
	selectAskAnswerPassages,
	selectFullDiscoursePassages,
} from "./aiAskAnswer";

describe("askAnswerHints", () => {
	it("keeps lexical targets and question headwords, not example-gloss filler", () => {
		const hints = askAnswerHints(
			"what should the gloss be for aggregate of collectedness |aggregate of liberation::freedom within the lived body [vimuttikkhandha]|",
			["samadikkhandho", "vimuttikkhandho"],
		);
		assert.ok(hints.some((hint) => /samadikkhandho/i.test(hint)));
		assert.ok(hints.some((hint) => /collectedness/i.test(hint)));
		assert.ok(hints.some((hint) => /vimuttikkhandha/i.test(hint)));
		assert.equal(
			hints.some((hint) => /lived/i.test(hint) || /freedom/i.test(hint)),
			false,
		);
	});
});

describe("selectAskAnswerPassages", () => {
	it("keeps matching paragraphs and drops unrelated ones", () => {
		const text = pickMatchingParagraphs(
			"The cowherd counted the cattle in the evening.\n\nThis is the aggregate of collectedness: right effort, right mindfulness, right collectedness.\n\nThen they walked to the village.",
			["collectedness", "samadikkhandho"],
		);
		assert.match(text, /right effort, right mindfulness/);
		assert.doesNotMatch(text, /cowherd/);
	});

	it("adds Pali when English misses the named compound", () => {
		const passages = selectAskAnswerPassages({
			english:
				"And what is the noble spectrum of wisdom? Right view and right intention.\n\nThe wanderer then asked about rebirth.",
			pali:
				"Katamo ca, brāhmaṇa, ariyo samādhikkhandho? Sammāvāyāmo, sammāsati, sammāsamādhi — ayaṃ vuccatānanda ariyo samādhikkhandho.",
			hints: ["samadikkhandho", "collectedness", "wisdom"],
			referenceOnly: true,
		});
		assert.ok(passages.some((passage) => passage.source === "Sujato English"));
		assert.ok(passages.some((passage) => passage.source === "Pali"));
		const pali = passages.find((passage) => passage.source === "Pali");
		assert.match(pali?.text || "", /samādhikkhandho/);
	});

	it("matches unaspirated planner spellings to Pali aspirates", () => {
		const text = pickMatchingParagraphs(
			"The cowherd counted the cattle.\n\nKatamo ariyo samādhikkhandho? Sammāvāyāmo sammāsati sammāsamādhi.",
			["samadikkhandho"],
		);
		assert.match(text, /samādhikkhandho/);
		assert.doesNotMatch(text, /cowherd/);
	});
});

describe("parseAskAnswerSummary", () => {
	it("reads summary JSON and ignores surrounding prose", () => {
		assert.match(
			parseAskAnswerSummary(
				'Here you go.\n{"summary":"SN 6.2 lists the five training aggregates."}\n',
			),
			/SN 6\.2 lists/,
		);
		assert.equal(parseAskAnswerSummary("no json here"), "");
	});

	it("joins a paragraphs array into a briefing", () => {
		const text = parseAskAnswerSummary(
			JSON.stringify({
				paragraphs: [
					"MN 107 gives the going and returning formula.",
					"AN 6.29 is a compact establishment of recollection.",
				],
			}),
		);
		assert.match(text, /MN 107 gives/);
		assert.match(text, /\n\nAN 6\.29/);
	});
});

describe("ASK_ANSWER_SYSTEM", () => {
	it("forbids attributing definitions to list-only excerpts", () => {
		assert.match(ASK_ANSWER_SYSTEM, /merely lists/);
		assert.match(ASK_ANSWER_SYSTEM, /Do not import stock Dhamma/);
		assert.match(ASK_ANSWER_SYSTEM, /Match the form they asked for/);
		assert.match(ASK_ANSWER_SYSTEM, /GitHub-flavored markdown/);
		assert.match(ASK_ANSWER_SYSTEM, /paragraphs/);
		assert.match(ASK_ANSWER_SYSTEM, /silence\.AN 6\.29/);
		assert.match(ASK_ANSWER_SYSTEM, /shown to the reader/);
		assert.match(ASK_ANSWER_SYSTEM, /When you can/);
	});
});

describe("resolveAskWriterBudgetMs", () => {
	it("caps at the writer max and skips when the function is almost out of time", () => {
		assert.equal(resolveAskWriterBudgetMs(0), ASK_WRITER_MAX_MS);
		assert.equal(resolveAskWriterBudgetMs(100_000), ASK_WRITER_MAX_MS);
		assert.equal(
			resolveAskWriterBudgetMs(ASK_FUNCTION_BUDGET_MS - 80_000),
			80_000,
		);
		assert.equal(
			resolveAskWriterBudgetMs(ASK_FUNCTION_BUDGET_MS - ASK_WRITER_MIN_MS + 1),
			0,
		);
	});
});

describe("createWatchdogAbortSignal", () => {
	it("aborts after idle silence and stays open when pinged", async () => {
		const idle = createWatchdogAbortSignal({ idleMs: 25, maxMs: 500 });
		idle.ping();
		await new Promise((resolve) => setTimeout(resolve, 50));
		assert.equal(idle.signal.aborted, true);
		idle.dispose();

		const live = createWatchdogAbortSignal({ idleMs: 40, maxMs: 400 });
		const tick = setInterval(() => live.ping(), 12);
		await new Promise((resolve) => setTimeout(resolve, 90));
		clearInterval(tick);
		assert.equal(live.signal.aborted, false);
		live.dispose();
	});
});

describe("RESEARCH_FULL_TEXT_CHARS", () => {
	it("is large enough for most MN-length discourses", () => {
		assert.equal(RESEARCH_FULL_TEXT_CHARS, 50_000);
	});
});

describe("selectFullDiscoursePassages", () => {
	it("returns English and Pali together when Pali is requested", () => {
		const passages = selectFullDiscoursePassages({
			english: "The faith-follower is defined here.",
			pali: "Saddhānusārī idha paññāyati.",
			includePali: true,
		});
		assert.deepEqual(
			passages.map((passage) => passage.source),
			["English (full text)", "Pali (full text)"],
		);
		assert.match(passages[0]?.text || "", /faith-follower/);
		assert.match(passages[1]?.text || "", /Saddhānusārī/);
	});

	it("keeps English only when Pali is not requested", () => {
		const passages = selectFullDiscoursePassages({
			english: "The faith-follower is defined here.",
			pali: "Saddhānusārī idha paññāyati.",
		});
		assert.equal(passages.length, 1);
		assert.equal(passages[0]?.source, "English (full text)");
	});
});

describe("composeFullDiscourseText", () => {
	it("returns the whole discourse when it fits", () => {
		assert.equal(composeFullDiscourseText("Short sutta.", 80), "Short sutta.");
	});

	it("keeps the opening and a later matching paragraph when clipped", () => {
		const text = `${"Opening narrative without the later term. ".repeat(8)}\n\nThe faith-follower saddhanusari is defined here.\n\nClosing.`;
		const out = composeFullDiscourseText(text, 220, ["saddhanusari"]);
		assert.match(out, /Opening narrative/);
		assert.match(out, /saddhanusari/);
	});
});

describe("formatAskAnswerEvidenceBlock", () => {
	it("labels reference translations and lists overflow IDs", () => {
		const block = formatAskAnswerEvidenceBlock({
			expanded: [
				{
					slug: "dn10",
					title: "Subha",
					referenceOnly: true,
					passages: [
						{
							source: "Pali",
							text: "ariyo samādhikkhandho",
						},
					],
				},
			],
			listedOnly: ["an5.22"],
		});
		assert.match(block, /DN 10 \[reference\]/);
		assert.match(block, /Pali:\nariyo samādhikkhandho/);
		assert.match(block, /Also selected \(no excerpt in this prompt\): AN 5\.22/);
	});

	it("marks full-text passages", () => {
		const block = formatAskAnswerEvidenceBlock({
			expanded: [
				{
					slug: "mn70",
					title: "At Kīṭāgiri",
					referenceOnly: false,
					full: true,
					passages: [{ source: "English (full text)", text: "Opening." }],
				},
			],
		});
		assert.match(block, /MN 70 \[full text\]/);
		assert.match(block, /English \(full text\):\nOpening/);
	});
});

describe("buildAskAnswerEvidence", () => {
	const english = [
		"AAA opening that does not mention the later term.",
		"BBB the confidence-follower saddhanusari is defined here.",
		"CCC close.",
	].join("\n\n");

	it("full reads clip from the start instead of hint-picking", async () => {
		const pack = await buildAskAnswerEvidence(
			[
				{
					slug: "mn70",
					title: "At Kīṭāgiri",
					description: "",
					contentSnippet: null,
					referenceOnly: false,
					href: "/mn70",
				},
			],
			["saddhanusari"],
			async () =>
				({
					slug: "mn70",
					title: "At Kīṭāgiri",
					description: "",
					content: english,
				}) as const,
			4,
			{ fullSlugs: ["mn70"], fullChars: 50 },
		);
		assert.equal(pack.expanded[0]?.full, true);
		assert.match(pack.expanded[0]?.passages[0]?.source || "", /full text/);
		assert.match(pack.expanded[0]?.passages[0]?.text || "", /AAA opening/);
		assert.doesNotMatch(
			pack.expanded[0]?.passages[0]?.text || "",
			/saddhanusari/,
		);
	});

	it("ordinary excerpts still pick the matching paragraph", async () => {
		const pack = await buildAskAnswerEvidence(
			[
				{
					slug: "mn70",
					title: "At Kīṭāgiri",
					description: "",
					contentSnippet: null,
					referenceOnly: false,
					href: "/mn70",
				},
			],
			["saddhanusari"],
			async () =>
				({
					slug: "mn70",
					title: "At Kīṭāgiri",
					description: "",
					content: english,
				}) as const,
			4,
			{ excerptChars: 80, excerptParas: 1 },
		);
		assert.equal(pack.expanded[0]?.full, undefined);
		assert.match(pack.expanded[0]?.passages[0]?.text || "", /saddhanusari/);
		assert.doesNotMatch(pack.expanded[0]?.passages[0]?.text || "", /AAA opening/);
	});

	it("keeps later hint-matched paragraphs when a full read is clipped", async () => {
		const long = [
			`${"AAA opening that does not mention the later term. ".repeat(6)}`,
			"BBB the confidence-follower saddhanusari is defined here.",
			"CCC close without the term.",
		].join("\n\n");
		const pack = await buildAskAnswerEvidence(
			[
				{
					slug: "mn70",
					title: "At Kīṭāgiri",
					description: "",
					contentSnippet: null,
					referenceOnly: false,
					href: "/mn70",
				},
			],
			["saddhanusari"],
			async () => ({
				slug: "mn70",
				title: "At Kīṭāgiri",
				description: "",
				content: long,
			}),
			4,
			{ fullSlugs: ["mn70"], fullChars: 220 },
		);
		assert.match(pack.expanded[0]?.passages[0]?.text || "", /AAA opening/);
		assert.match(pack.expanded[0]?.passages[0]?.text || "", /saddhanusari/);
	});

	it("opens requested slugs in Pali and English", async () => {
		const pack = await buildAskAnswerEvidence(
			[
				{
					slug: "mn70",
					title: "At Kīṭāgiri",
					description: "",
					contentSnippet: null,
					referenceOnly: false,
					href: "/mn70",
				},
			],
			[],
			async () =>
				({
					slug: "mn70",
					title: "At Kīṭāgiri",
					description: "",
					content: "The faith-follower is defined here.",
					contentPali: "Saddhānusārī idha paññāyati.",
				}) as const,
			4,
			{ paliSlugs: ["mn70"] },
		);
		assert.equal(pack.expanded[0]?.full, true);
		assert.equal(pack.expanded[0]?.passages.length, 2);
		assert.equal(pack.expanded[0]?.passages[0]?.source, "English (full text)");
		assert.equal(pack.expanded[0]?.passages[1]?.source, "Pali (full text)");
		assert.match(pack.expanded[0]?.passages[1]?.text || "", /Saddhānusārī/);
	});

	it("keeps the rest of the selected set as IDs when the writer cap is 28", async () => {
		const hits = Array.from({ length: 30 }, (_, index) => ({
			slug: `mn${index + 1}`,
			title: `Discourse ${index + 1}`,
			description: "",
			contentSnippet: null,
			referenceOnly: false,
			href: `/mn${index + 1}`,
		}));
		const pack = await buildAskAnswerEvidence(
			hits,
			[],
			async (slug) => ({
				slug,
				title: slug,
				description: "",
				content: `${slug} body`,
			}),
			28,
		);
		assert.equal(pack.expanded.length, 28);
		assert.deepEqual(pack.listedOnly, ["mn29", "mn30"]);
	});
});

describe("buildAskAnswerUserPrompt", () => {
	it("includes the question, guidance, and excerpts", () => {
		const prompt = buildAskAnswerUserPrompt({
			question: "gloss for aggregate of collectedness",
			guidance: "Compile |term::…| lines from the excerpts only.",
			evidence: "DN 10 [reference] — Subha\nPali:\nariyo samādhikkhandho",
		});
		assert.match(prompt, /gloss for aggregate of collectedness/);
		assert.match(prompt, /Compile \|term::/);
		assert.match(prompt, /ariyo samādhikkhandho/);
	});
});
