/**
 * Shared inference helpers for Sujato reference curation.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const QUALITIES_PATH = join(ROOT, "src/data/qualities.json");

export function loadQualitiesData() {
	return JSON.parse(readFileSync(QUALITIES_PATH, "utf8"));
}

function escapeRe(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildQualityMatchers(qualitiesData) {
	const matchers = [];
	const all = [
		...qualitiesData.positive,
		...qualitiesData.negative,
		...qualitiesData.neutral,
	];
	for (const q of all) {
		matchers.push({ quality: q, pattern: new RegExp(`\\b${escapeRe(q)}\\b`, "i") });
	}
	for (const [quality, synonyms] of Object.entries(qualitiesData.qualities ?? {})) {
		for (const syn of synonyms) {
			if (
				syn.startsWith("Context:") ||
				syn.startsWith("Supported") ||
				syn.startsWith("Leads") ||
				syn.startsWith("Opposite") ||
				syn.startsWith("[")
			) {
				continue;
			}
			if (syn.length < 3) continue;
			matchers.push({ quality, pattern: new RegExp(`\\b${escapeRe(syn)}\\b`, "i") });
		}
	}
	return matchers;
}

const THEME_RULES = [
	{
		theme: "story",
		patterns: [
			/\bking\b|\bqueen\b|\bprince\b|\bdeva\b|\bbrahmin\b|\bhouseholder\b|once upon|one time the|account of/i,
		],
	},
	{ theme: "urgency", patterns: [/\bdeath\b|impermanen|urgent|swiftly|before long|limited time/i] },
	{
		theme: "recollection of the Buddha",
		patterns: [/realized one|tathāgata|awakened buddha|worthy one/i],
	},
	{
		theme: "directly knowing",
		patterns: [/directly know|direct knowledge|experiential|see for yourself/i],
	},
	{
		theme: "training guideline",
		patterns: [
			/should develop|should practice|meditat|jhāna|immersion|\beffort\b|striving|training|you should train/i,
		],
	},
	{
		theme: "cultivating discernment",
		patterns: [/on the one hand|two kinds|contrasts|distinguish|compare|versus|not the other|fool.*astute/i],
	},
	{ theme: "inspiration", patterns: [/inspire|confidence|faith|joy|gladness|encourag/i] },
	{ theme: "inquisitiveness", patterns: [/investigate|inquire|curious|question|examine/i] },
	{
		theme: "principle",
		patterns: [
			/three things|three principles|three factors|three kinds|three types|three persons|three ways|three modes|three bases|three assemblies|three characteristics|three sources|three practices|three nutriments|three cravings|three feelings|three perceptions/i,
			/five things|five principles|five factors|five kinds|five types|five persons|five ways|five modes|five powers|five hindrances|five faculties|five strengths|five obstructions/i,
			/six things|six principles|six factors|six kinds|six types|six persons|six ways|six modes|six recollections|six higher knowledges|six unsurpassable/i,
			/seven things|seven principles|seven factors|seven kinds|seven types|seven persons|seven ways|seven modes|seven powers|seven awakening factors|seven treasures/i,
			/eight things|eight principles|eight factors|eight kinds|eight types|eight persons|eight ways|eight modes|eight worldly conditions|eight assemblies|eight benefits/i,
			/nine things|nine principles|nine factors|nine kinds|nine types|nine persons|nine ways|nine modes|nine bases|nine meditations|nine cessations/i,
			/ten things|ten principles|ten factors|ten kinds|ten types|ten persons|ten ways|ten modes|ten bases|ten thorns|ten dimensions/i,
			/eleven things|eleven principles|eleven factors|eleven kinds|eleven types|eleven persons|eleven ways|eleven modes|eleven bases|eleven qualities/i,
		],
	},
	{
		theme: "wisdom",
		patterns: [/understand|wisdom|insight|discern|comprehend|penetrat|knowledge|\bview\b/i],
	},
];

export function inferThemes(text) {
	const scores = new Map();
	for (const { theme, patterns } of THEME_RULES) {
		for (const p of patterns) {
			if (p.test(text)) scores.set(theme, (scores.get(theme) ?? 0) + 1);
		}
	}
	const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
	if (!sorted.length) return ["principle"];
	const top = sorted[0][0];
	const second = sorted[1]?.[0];
	if (second && sorted[1][1] >= sorted[0][1] * 0.7) return [top, second];
	return [top];
}

export function inferQualities(text, matchers, max = 6) {
	const scores = new Map();
	for (const { quality, pattern } of matchers) {
		const hits = (text.match(new RegExp(pattern.source, "gi")) ?? []).length;
		if (hits) scores.set(quality, (scores.get(quality) ?? 0) + hits);
	}
	const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
	const picked = sorted.slice(0, max).map(([q]) => q);

	const fallbacks = [
		[/ignorance|unknowing/i, "delusion"],
		[/ethical|virtue|morality|sīla|noble ethics/i, "ethical conduct"],
		[/immersion|samādhi|collected/i, "collectedness"],
		[/wisdom|discernment|paññ/i, "wisdom"],
		[/freedom|liberation|release|vimutti/i, "liberation"],
		[/sensual pleasure|sensuality/i, "sensual desire"],
		[/craving|greed|attachment|thirst/i, "craving"],
		[/view(?!ing)/i, "wrong view"],
		[/effort|striving|strive/i, "right effort"],
		[/faith|confidence/i, "faith"],
		[/mindful/i, "mindfulness"],
		[/harm|injure|violence/i, "harm"],
		[/conceit|arrogance|pride/i, "conceit"],
		[/anger|hate|ill will/i, "ill will"],
		[/fool|foolish/i, "immaturity"],
		[/astute|wise person/i, "wisdom"],
	];
	for (const [pattern, quality] of fallbacks) {
		if (pattern.test(text) && !picked.includes(quality)) picked.push(quality);
	}

	if (picked.length < 2) picked.push("wisdom");
	return [...new Set(picked)].slice(0, max);
}

export function cleanLine(s) {
	return s.replace(/\s+/g, " ").trim();
}

export function stripSegments(body) {
	return body.replace(/<!--[^>]+-->/g, "").trim();
}

export function extractThreeItems(body) {
	const lines = stripSegments(body)
		.split("\n")
		.map(cleanLine)
		.filter(Boolean);

	const whatThreeIdx = lines.findIndex((l) => /^what three\??$/i.test(l));
	if (whatThreeIdx !== -1) {
		const items = [];
		for (let i = whatThreeIdx + 1; i < lines.length; i++) {
			const line = lines[i];
			if (/^(and what|these are|an astute|a fool|so you|that's how)/i.test(line)) break;
			if (line.length >= 12 && line.length <= 220) {
				items.push(line.replace(/\.$/, ""));
			}
			if (items.length >= 3) break;
		}
		if (items.length >= 2) return items.slice(0, 3);
	}

	for (const line of lines) {
		if (line.length < 12 || line.length > 120) continue;
		if (/^(mendicants|bhikkhus|monks|what|who|which|so you)/i.test(line)) continue;
		if (/^(the |a |someone|it's when|here,)/i.test(line) && !/^the (addicted|scorching|middle)/i.test(line)) {
			continue;
		}
	}
	return [];
}

function formatEnum(items) {
	return items
		.slice(0, 3)
		.map((s) => s.toLowerCase())
		.join(", ")
		.replace(/, ([^,]*)$/, ", and $1");
}

export function buildAn3Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		if (/insight into greed/i.test(text) || /for insight into/i.test(text)) {
			return "The Buddha teaches that three things—emptiness immersion, signless immersion, and undirected immersion—should be developed for insight into and the complete ending of greed, hate, delusion, and other unwholesome qualities.";
		}
		if (/three practices/i.test(text)) {
			return "The Buddha describes the three practices—the addicted practice, the scorching practice, and the middle practice—contrasting indulgence in sensual pleasures, self-mortification, and the noble eightfold path.";
		}
		if (/should be developed/i.test(text)) {
			return "The Buddha teaches a repeated formula on three things that should be developed for complete understanding, ending, and letting go of unwholesome qualities in this grouped discourse.";
		}
		return `The Buddha presents a repeated threefold teaching on ${title.toLowerCase()} in this grouped discourse.`;
	}

	if (/whatever dangers|whatever perils|whatever hazards/i.test(text) && /fool/i.test(text)) {
		return "The Buddha teaches that whatever dangers, perils, and hazards there are all come from the foolish, not the astute, urging mendicants to shun the three qualities of a fool and undertake those of an astute person.";
	}

	if (/three kinds of persons|three persons/i.test(text)) {
		return "The Buddha describes the three kinds of persons found in the world, contrasting their conduct and spiritual attainment.";
	}

	if (/three things should be developed/i.test(text)) {
		const purpose =
			text.match(/for (?:the )?(complete understanding[^.]{0,80}|insight[^.]{0,60}|[^.]{10,90})/i)?.[1];
		return purpose
			? `The Buddha teaches that three things should be developed for ${purpose.replace(/\.$/, "").toLowerCase()}.`
			: "The Buddha teaches that three things should be developed on the path.";
	}

	if (/three characteristics of the conditioned/i.test(text)) {
		return "The Buddha describes the three characteristics of the conditioned—arising, passing away, and alteration while remaining—and contrasts them with the three characteristics of the unconditioned.";
	}

	if (/three sources that give rise to deeds/i.test(text)) {
		return "The Buddha teaches the three sources that give rise to deeds—greed, hate, and delusion—and how they shape action and its results.";
	}

	const topicMatch =
		text.match(/there are these three ([^.!?]{3,90})/i) ||
		text.match(/these three ([^.!?]{3,90}) are/i) ||
		text.match(/a fool is known by three things/i) ||
		text.match(/an astute person is known by three things/i);

	if (/a fool is known by three things/i.test(text)) {
		const items = extractThreeItems(body);
		if (items.length >= 2) {
			return `The Buddha contrasts the fool and the astute person by three qualities each—the fool ${formatEnum(items).replace(/^/, "")}, while the astute person does the opposite.`;
		}
		return "The Buddha contrasts the fool and the astute person, each known by three qualities of conduct and response.";
	}

	if (topicMatch) {
		const topic = (topicMatch[1] || title).replace(/[:,.]$/, "").trim();
		const items = extractThreeItems(body);
		const topicLower = topic.toLowerCase();

		if (/^things?$/i.test(topic) && items.length >= 2) {
			if (/wanderers of other religions|followers of other religions/i.test(text)) {
				return `The Buddha teaches how mendicants should answer followers of other religions who ask about the three things—${formatEnum(items)}—explaining how each is blameworthy and whether it fades slowly or quickly.`;
			}
			return `The Buddha describes the three things—${formatEnum(items)}.`;
		}

		if (items.length >= 2) {
			return `The Buddha describes the three ${topicLower}—${formatEnum(items)}.`;
		}
		if (/^things?$/i.test(topic) && title && !/^untitled/i.test(title)) {
			return `The Buddha teaches on ${title.toLowerCase()}, presenting a threefold teaching for disciples on the path.`;
		}
		return `The Buddha describes the three ${topicLower}.`;
	}

	if (/then venerable|then the householder|then the wanderer/i.test(text)) {
		const who = text.match(/then (venerable \w+|the \w+)/i)?.[1] ?? "a disciple";
		return `The Buddha teaches ${who} on ${title.toLowerCase()}, presenting a threefold teaching for disciples on the path.`;
	}

	if (title && title.length > 2 && !/^untitled/i.test(title)) {
		return `The Buddha teaches on ${title.toLowerCase()}, presenting a threefold teaching for disciples on the path.`;
	}

	return "The Buddha presents a threefold teaching in this discourse.";
}

export function extractFiveItems(body) {
	const lines = stripSegments(body)
		.split("\n")
		.map(cleanLine)
		.filter(Boolean);

	const whatFiveIdx = lines.findIndex((l) => /^what five\??$/i.test(l));
	if (whatFiveIdx !== -1) {
		const items = [];
		for (let i = whatFiveIdx + 1; i < lines.length; i++) {
			const line = lines[i];
			if (/^(and what|these are|a disrespectful|a respectful|so you|that's how|without giving|but after)/i.test(line)) break;
			if (line.length >= 8 && line.length <= 220) {
				items.push(line.replace(/\.$/, "").replace(/ …$/, ""));
			}
			if (items.length >= 5) break;
		}
		if (items.length >= 2) return items.slice(0, 5);
	}

	return [];
}

function formatFiveEnum(items) {
	if (items.length <= 3) return formatEnum(items);
	const head = items
		.slice(0, 3)
		.map((s) => s.toLowerCase())
		.join(", ");
	const tail = items
		.slice(3)
		.map((s) => s.toLowerCase())
		.join(", and ");
	return `${head}, and ${tail}`;
}

const NUMBER_WORDS = { 6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten", 11: "eleven" };
const NUMBER_WORDS_INV = Object.fromEntries(
	Object.entries(NUMBER_WORDS).map(([k, v]) => [v, Number(k)]),
);

export function extractNumberedItems(body, nOrWord, max) {
	const word = typeof nOrWord === "number" ? NUMBER_WORDS[nOrWord] : nOrWord;
	const limit = max ?? (typeof nOrWord === "number" ? nOrWord : NUMBER_WORDS_INV[word] ?? 11);
	if (!word) return [];

	const lines = stripSegments(body)
		.split("\n")
		.map(cleanLine)
		.filter(Boolean);

	const whatIdx = lines.findIndex((l) => new RegExp(`^what ${word}\\??$`, "i").test(l));
	if (whatIdx !== -1) {
		const items = [];
		for (let i = whatIdx + 1; i < lines.length; i++) {
			const line = lines[i];
			if (
				/^(and what|these are|a disrespectful|a respectful|so you|that's how|without giving|but after|first, take|it's when|it's a|in the same way|a mendicant with|a cowherd with)/i.test(
					line,
				)
			) {
				break;
			}
			if (line.length >= 8 && line.length <= 280) {
				items.push(line.replace(/\.$/, "").replace(/ …$/, ""));
			}
			if (items.length >= limit) break;
		}
		if (items.length >= 2) return items.slice(0, limit);
	}

	return [];
}

function extractInlineListItems(body, n) {
	const word = NUMBER_WORDS[n];
	const lines = stripSegments(body)
		.split("\n")
		.map(cleanLine)
		.filter(Boolean);
	const whatIdx = lines.findIndex((l) => new RegExp(`^what ${word}\\??$`, "i").test(l));
	if (whatIdx === -1 || whatIdx + 1 >= lines.length) return [];

	const line = lines[whatIdx + 1];
	const ofMatch = line.match(/^(?:the )?(?:\w+ )+of ([^.]+)$/i);
	if (ofMatch) {
		const parts = ofMatch[1]
			.split(/,\s*(?:and )?/)
			.map((s) => s.replace(/\.$/, "").trim())
			.filter(Boolean);
		if (parts.length >= 2) return parts;
	}

	const sentenceParts = line
		.split(/\.\s+/)
		.map((s) => s.replace(/\.$/, "").trim())
		.filter((s) => s.length >= 8);
	if (sentenceParts.length >= 2) return sentenceParts;

	return [];
}

function formatLongEnum(items, showFirst = 3) {
	if (items.length <= showFirst) return formatEnum(items);
	const head = items
		.slice(0, showFirst)
		.map((s) => s.toLowerCase())
		.join(", ");
	const tail = items
		.slice(showFirst)
		.map((s) => s.toLowerCase())
		.join(", and ");
	return `${head}, and ${tail}`;
}

function buildAnNumberedDescription(n, title, body, slug) {
	const word = NUMBER_WORDS[n];
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		if (/\(tell in full/i.test(text)) {
			if (/hindrance|mindfulness/i.test(text) || /hindrance/i.test(title)) {
				return "The Buddha teaches a repeated formula on the five hindrances and related qualities, applying the analysis from the chapter on mindfulness meditation across this grouped discourse.";
			}
			return `The Buddha teaches a repeated ${word}fold formula drawn from an earlier chapter, applied across the discourses in this grouped range.`;
		}
		if (
			/for insight into|for the complete understanding|for the letting go/i.test(text) &&
			/should be developed/i.test(text)
		) {
			if (/of hate|insight into hate/i.test(text)) {
				return `The Buddha teaches a repeated formula on ${word} things that should be developed for insight into and the complete ending of hate, delusion, anger, and other unwholesome qualities in this grouped discourse.`;
			}
			if (/insight into greed/i.test(text)) {
				return `The Buddha teaches that ${word} things should be developed for insight into and the complete ending of greed, hate, delusion, and other unwholesome qualities in this grouped discourse.`;
			}
			return `The Buddha teaches a repeated formula on ${word} things that should be developed for complete understanding, ending, and letting go of unwholesome qualities in this grouped discourse.`;
		}
		if (/cowherd with eleven factors|cowherd with these eleven/i.test(text)) {
			return "The Buddha teaches a repeated simile of a cowherd with eleven factors and a mendicant with eleven qualities, applying the comparison across sense bases and meditative perceptions in this grouped discourse.";
		}
		if (/should not frequent|should frequent|should not pay homage|should pay homage/i.test(text)) {
			return "The Buddha teaches a repeated formula on individuals with ten qualities—contrasting who mendicants should and should not frequent, honor, and revere—based on the ten path factors in this grouped discourse.";
		}
		if (/meditate observing impermanence|suffering …|not-self …|letting go/i.test(text)) {
			return "The Buddha teaches a repeated simile applying eleven factors of a cowherd to eleven qualities a mendicant needs to meditate on impermanence, suffering, and not-self in the sense bases in this grouped discourse.";
		}
		if (new RegExp(`${word} things should be developed`, "i").test(text)) {
			if (/for the complete understanding|insight into|for insight/i.test(text)) {
				return `The Buddha teaches a repeated formula on ${word} things that should be developed for complete understanding, ending, and letting go of unwholesome qualities in this grouped discourse.`;
			}
			return `The Buddha teaches a repeated formula on ${word} things that should be developed for insight and the complete ending of unwholesome states in this grouped discourse.`;
		}
		if (/for the complete understanding/i.test(text)) {
			return `The Buddha teaches a repeated formula stating that ${word} things should be developed for the complete understanding, ending, and letting go of greed, hate, delusion, and other unwholesome qualities in this grouped discourse.`;
		}
		if (/householders/i.test(text)) {
			return `The Buddha teaches that having ${word} qualities certain outstanding householders became stream-enterers and went on to heavenly rebirth, applying the same formula to each in this grouped discourse.`;
		}
		if (/sabbath/i.test(text)) {
			return "The Buddha teaches various laywomen the observance of the sabbath with its eight factors, explaining its great fruitfulness and benefit in this grouped discourse.";
		}
		if (/observing suffering in the eye|worthy of offerings/i.test(text)) {
			return "The Buddha teaches a repeated formula on seven individuals who meditate on aspects of the six sense bases and are worthy of offerings, applying the analysis to each sense field in this grouped discourse.";
		}
		return `The Buddha presents a repeated ${word}fold teaching on ${title.toLowerCase()} in this grouped discourse.`;
	}

	if (n === 8 && /benefits when the heart's release by love|eight benefits/i.test(text)) {
		return "The Buddha teaches eight benefits of developing the heart's release by love—including peaceful sleep, protection by deities, and rebirth among divinities—and praises loving-kindness above royal sacrifices.";
	}

	if (n === 8 && /eight worldly conditions/i.test(text)) {
		return "The Buddha teaches that gain and loss, fame and disgrace, blame and praise, and pleasure and pain—the eight worldly conditions—revolve around the world, and explains how a noble disciple differs from an ordinary person in facing them.";
	}

	if (n === 8 && /eight assemblies/i.test(text)) {
		return "The Buddha describes the eight assemblies—of aristocrats, brahmins, householders, and ascetics, and their counterparts among gods, demons, divinities, and Brahmās—and how a mendicant should train when entering each.";
	}

	if (
		n === 9 &&
		/vital condition for the development of the qualities on the same side as awakening|awakening factors/i.test(
			text,
		)
	) {
		return "The Buddha teaches the vital conditions for developing qualities on the side of awakening—good friends, ethics, talk that opens the heart, energy, and wisdom—and four further perceptions to uproot conceit and attain extinguishment.";
	}

	if (n === 9 && /nine progressive meditations/i.test(text)) {
		return "The Buddha describes the nine progressive meditations—from the four absorptions through the formless dimensions to the cessation of perception and feeling.";
	}

	if (n === 9 && /nine progressive cessations/i.test(text)) {
		return "The Buddha describes the nine progressive cessations—successively giving up perceptions of form, contact, and the formless dimensions until perception and feeling cease.";
	}

	if (n === 9 && /nine ways to get rid of resentment/i.test(text)) {
		return "The Buddha teaches nine ways to get rid of resentment toward someone who has done wrong, from developing love to resolving to set that person free in the heart.";
	}

	if (n === 9 && /nine things rooted in craving/i.test(text)) {
		return "The Buddha teaches the nine things rooted in craving—craving for sights, sounds, smells, tastes, touches, and ideas, each in three modes of seeking what is pleasing.";
	}

	if (n === 9 && /without giving up nine things/i.test(text)) {
		return "The Buddha teaches that without giving up nine unwholesome qualities—greed, hate, delusion, anger, acrimony, disdain, contempt, jealousy, and stinginess—one cannot realize perfection.";
	}

	if (n === 9 && /can't transgress|cannot transgress|can'?t deliberately take the life/i.test(text)) {
		return "The Buddha teaches that a perfected mendicant is incapable of transgressing in nine ways—including the five breaches of training and acting out of impulse, aversion, delusion, and fear.";
	}

	if (n === 10 && /ethical person, who has fulfilled ethical conduct, need not make a wish/i.test(text)) {
		return "The Buddha teaches that an ethical person need not wish for each stage of practice—freedom from regrets leads naturally through joy, rapture, tranquility, bliss, immersion, true knowing and seeing, disillusionment, and knowledge and vision of freedom.";
	}

	if (n === 10 && /goal and benefit of skillful ethics/i.test(text)) {
		return "The Buddha explains to Ānanda how skillful ethics progressively lead through freedom from regrets, joy, rapture, tranquility, bliss, immersion, true knowing and seeing, disillusionment, and dispassion to knowledge and vision of freedom.";
	}

	if (n === 10 && /ten universal dimensions of meditation/i.test(text)) {
		return "The Buddha describes the ten universal dimensions of meditation—on earth, water, fire, air, blue, yellow, red, white, space, and consciousness—perceived as undivided and limitless.";
	}

	if (n === 10 && /ten ways to get rid of resentment/i.test(text)) {
		return "The Buddha teaches ten ways to get rid of resentment toward someone who has done wrong, from developing love to resolving to set that person free in the heart.";
	}

	if (n === 10 && /ten thorns/i.test(text)) {
		return "The Buddha describes the ten thorns that obstruct a mendicant's practice—such as fondness for company, talk, sleep, and attachment to robes, almsfood, and lodgings.";
	}

	if (n === 10 && /ten things when developed and cultivated/i.test(text)) {
		return "The Buddha contrasts ten things that, when developed and cultivated within the Holy One's training, lead to disillusionment, dispassion, and the ending of greed, hate, and delusion with those that do not.";
	}

	if (n === 10 && /escaped from ten things/i.test(text)) {
		return "The Buddha teaches that the Realized One has escaped from ten things—sensuality, ill will, dullness, restlessness, doubt, and other defilements—so that he lives detached and liberated with mind free of boundaries.";
	}

	if (n === 10 && /ten things are roadblocks/i.test(text)) {
		return "The Buddha teaches ten roadblocks and ten nourishing factors for rare worldly goods such as wealth, beauty, and happiness.";
	}

	if (n === 10 && /ten kinds of unskillful deeds|ten kinds of skillful deeds/i.test(text)) {
		return "The Buddha describes the ten kinds of unskillful and skillful deeds and how they lead to bad or good destinations.";
	}

	if (n === 11 && /goal and benefit of skillful ethics/i.test(text)) {
		return "The Buddha explains to Ānanda how skillful ethics progressively lead through freedom from regrets, joy, rapture, tranquility, bliss, immersion, true knowing and seeing, disillusionment, and dispassion to knowledge and vision of freedom.";
	}

	if (n === 11 && /ethical person, who has fulfilled ethical conduct, need not make a wish/i.test(text)) {
		return "The Buddha teaches that an ethical person need not wish for each stage of practice—freedom from regrets leads naturally through joy, rapture, tranquility, bliss, immersion, true knowing and seeing, disillusionment, and knowledge and vision of freedom.";
	}

	if (n === 7 && /seven awakening factors/i.test(text)) {
		return "The Buddha teaches the seven awakening factors—mindfulness, investigation of principles, energy, rapture, tranquility, immersion, and equanimity—and how they are developed and fulfilled on the path.";
	}

	if (n === 7 && /seven powers/i.test(text)) {
		if (/what is the power of faith/i.test(text)) {
			return "The Buddha describes the seven powers—faith, energy, conscience, prudence, mindfulness, immersion, and wisdom—and explains each in detail, from faith in the Realized One to the power of wisdom.";
		}
		return "The Buddha describes the seven powers—faith, energy, conscience, prudence, mindfulness, immersion, and wisdom—that support a mendicant on the path.";
	}

	if (n === 7 && /disliked and disapproved/i.test(text)) {
		return "The Buddha contrasts mendicants disliked and admired by their spiritual companions, each defined by seven qualities—including desire for material things, honor, and status, versus conscience, prudence, and right view.";
	}

	if (n === 8 && /disliked and disapproved/i.test(text)) {
		return "The Buddha contrasts mendicants disliked and admired by their spiritual companions, each defined by eight qualities of conduct, conscience, and view.";
	}

	if (n === 6 && /worthy of offerings/i.test(text) && /neither happy nor sad|equanimous/i.test(text)) {
		return "The Buddha teaches that a mendicant who remains equanimous, mindful, and aware when experiencing sights, sounds, smells, tastes, touches, and ideas through the six senses is worthy of offerings and the supreme field of merit.";
	}

	if (n === 6 && /worthy of offerings/i.test(text) && /psychic power|clairaudience/i.test(text)) {
		return "The Buddha teaches that a mendicant accomplished in the six higher knowledges—psychic powers, clairaudience, mind reading, recollection of past lives, clairvoyance, and the ending of defilements—is worthy of offerings and the supreme field of merit.";
	}

	if (new RegExp(`a mendicant with ${word} qualities is`, "i").test(text)) {
		if (/worthy of offerings/i.test(text)) {
			if (/fine royal thoroughbred|factor of kingship/i.test(text)) {
				return `The Buddha teaches that a fine royal thoroughbred with ${word} factors—including endurance of sights, sounds, smells, tastes, and touches—is worthy of a king and fit to serve a king.`;
			}
			if (/by restraint.*by developing|given up the defilements that should be given up/i.test(text)) {
				return "The Buddha teaches that a mendicant who has given up defilements by restraint, using, enduring, avoiding, getting rid, and developing is worthy of offerings and the supreme field of merit.";
			}
			return `The Buddha teaches that a mendicant with ${word} qualities is worthy of offerings dedicated to the gods, hospitality, religious donation, and veneration as the supreme field of merit.`;
		}
		if (/expert in the monastic law/i.test(text)) {
			return `The Buddha describes a mendicant who is an expert in the monastic law with ${word} qualities—including mastery of offenses, ethics, immersion, and the ending of defilements.`;
		}
		if (/worthy of going on a mission/i.test(text)) {
			return `The Buddha describes the ${word} qualities that make a mendicant worthy of going on a mission to teach and guide others.`;
		}
		if (/incapable of realizing/i.test(text)) {
			return `The Buddha teaches ${word} qualities that make someone incapable of realizing higher attainments that can be realized with extra effort.`;
		}
	}

	if (n === 6 && /six recollection/i.test(text)) {
		return "The Buddha teaches the six topics for recollection—the Buddha, the teaching, the Saṅgha, ethics, generosity, and deities—as aids to mindfulness and inspiration on the path.";
	}

	if (n === 6 && /unsurpassable/i.test(text)) {
		return "The Buddha describes six unsurpassable things—the unsurpassable sight, sound, happiness, training, generosity, and reflection—that inspire faith and confidence in the teaching.";
	}

	if (/things can'?t be done/i.test(text)) {
		return `The Buddha teaches ${word} things that cannot be done by certain individuals, clarifying the limits of wrong action for disciples accomplished in view.`;
	}

	if (/accomplished in view/i.test(text)) {
		if (/can'?t give rise to/i.test(text)) {
			return `The Buddha teaches that an individual accomplished in view cannot give rise to ${word} unwholesome qualities, having abandoned the wrong view that would produce them.`;
		}
		if (/has given up/i.test(text)) {
			return `The Buddha teaches that an individual accomplished in view has given up ${word} things that obstruct the path to liberation.`;
		}
	}

	if (new RegExp(`without giving up (these )?${word} things`, "i").test(text)) {
		return `The Buddha teaches that without giving up ${word} things one cannot attain higher fruits of the path, and that abandoning them opens the way to deeper realization.`;
	}

	if (new RegExp(`for insight into greed, ${word} things should be developed`, "i").test(text)) {
		return `The Buddha teaches that ${word} things should be developed for insight into and the complete ending of greed, hate, delusion, and other unwholesome qualities.`;
	}

	if (new RegExp(`${word} things should be developed`, "i").test(text)) {
		const purpose =
			text.match(/for (?:the )?(complete understanding[^.]{0,80}|insight[^.]{0,60}|[^.]{10,90})/i)?.[1];
		return purpose
			? `The Buddha teaches that ${word} things should be developed for ${purpose.replace(/\.$/, "").toLowerCase()}.`
			: `The Buddha teaches that ${word} things should be developed on the path.`;
	}

	if (new RegExp(`${word} kinds of persons|${word} persons`, "i").test(text)) {
		return `The Buddha describes the ${word} kinds of persons found in the world, contrasting their conduct and spiritual attainment.`;
	}

	const topicMatch =
		text.match(new RegExp(`there are these ${word} ([^.!?]{3,90})`, "i")) ||
		text.match(new RegExp(`these ${word} ([^.!?]{3,90}) are`, "i"));

	if (topicMatch) {
		const topic = (topicMatch[1] || title).replace(/[:,.]$/, "").trim();
		const items = extractNumberedItems(body, n);
		const inlineItems = items.length >= 2 ? items : extractInlineListItems(body, n);
		const topicLower = topic.toLowerCase();

		if (/^things?$/i.test(topic) && inlineItems.length >= 2) {
			return `The Buddha describes the ${word} things—${formatLongEnum(inlineItems)}.`;
		}

		if (/^qualities$/i.test(topic) && inlineItems.length >= 2) {
			return `The Buddha describes the ${word} qualities—${formatLongEnum(inlineItems)}.`;
		}

		if (inlineItems.length >= 2) {
			return `The Buddha describes the ${word} ${topicLower}—${formatLongEnum(inlineItems)}.`;
		}
		if (/^things?$/i.test(topic) && title && !/^untitled/i.test(title)) {
			return `The Buddha teaches on ${title.toLowerCase()}, presenting a ${word}fold teaching for disciples on the path.`;
		}
		const shortDesc = `The Buddha describes the ${word} ${topicLower}.`;
		if (shortDesc.length < 40) {
			if (title && !/^untitled/i.test(title)) {
				return `The Buddha teaches on ${title.toLowerCase()}, describing the ${word} ${topicLower} and how they bind or afflict beings on the path.`;
			}
			return `The Buddha describes the ${word} ${topicLower} and their role in binding beings to suffering.`;
		}
		return shortDesc;
	}

	if (/then venerable|then the householder|then the wanderer/i.test(text)) {
		const who = text.match(/then (venerable \w+|the \w+)/i)?.[1] ?? "a disciple";
		return `The Buddha teaches ${who} on ${title.toLowerCase()}, presenting a ${word}fold teaching for disciples on the path.`;
	}

	if (title && title.length > 2 && !/^untitled/i.test(title)) {
		return `The Buddha teaches on ${title.toLowerCase()}, presenting a ${word}fold teaching for disciples on the path.`;
	}

	return `The Buddha presents a ${word}fold teaching in this discourse on qualities and practice for disciples on the path.`;
}

export function buildAn6Description(title, body, slug) {
	return buildAnNumberedDescription(6, title, body, slug);
}

export function buildAn7Description(title, body, slug) {
	return buildAnNumberedDescription(7, title, body, slug);
}

export function buildAn8Description(title, body, slug) {
	return buildAnNumberedDescription(8, title, body, slug);
}

export function buildAn9Description(title, body, slug) {
	return buildAnNumberedDescription(9, title, body, slug);
}

export function buildAn10Description(title, body, slug) {
	return buildAnNumberedDescription(10, title, body, slug);
}

export function buildAn11Description(title, body, slug) {
	return buildAnNumberedDescription(11, title, body, slug);
}

export function buildAn5Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		if (/five things should be developed/i.test(text) || /for the complete understanding/i.test(text)) {
			if (/powers of faith, energy, mindfulness/i.test(text)) {
				return "The Buddha teaches that five things—the powers of faith, energy, mindfulness, immersion, and wisdom—should be developed for the complete understanding, ending, and letting go of greed, hate, delusion, and other unwholesome qualities in this grouped discourse.";
			}
			return "The Buddha teaches a repeated formula on five things that should be developed for complete understanding, ending, and letting go of unwholesome qualities in this grouped discourse.";
		}
		if (/without giving up these five qualities/i.test(text) && /absorption|stream-entry|perfection/i.test(text)) {
			return "The Buddha teaches that without giving up five kinds of stinginess one cannot attain higher absorptions or the fruits of the path, and that abandoning them opens the way to stream-entry through perfection in this grouped discourse.";
		}
		if (/should be developed/i.test(text)) {
			return "The Buddha teaches a repeated fivefold formula on qualities that should be developed for insight and the complete ending of unwholesome states in this grouped discourse.";
		}
		return `The Buddha presents a repeated fivefold teaching on ${title.toLowerCase()} in this grouped discourse.`;
	}

	if (/five hindrances|five obstructions/i.test(text)) {
		return "The Buddha describes the five hindrances—sensual desire, ill will, dullness and drowsiness, restlessness and worry, and doubt—that overwhelm the mind and weaken wisdom until they are abandoned.";
	}

	if (/five powers of a trainee/i.test(text)) {
		return "The Buddha describes the five powers of a trainee—faith, conscience, prudence, energy, and wisdom—that support a mendicant on the path.";
	}

	if (/\bfive powers\b/i.test(text)) {
		if (/faith, conscience, prudence/i.test(text)) {
			return "The Buddha describes the five powers—faith, conscience, prudence, energy, and wisdom—that support a mendicant on the path.";
		}
		if (/power of wisdom is the chief/i.test(text)) {
			return "The Buddha describes the five powers—faith, energy, mindfulness, immersion, and wisdom—and teaches that wisdom is the chief power that holds and binds the others together.";
		}
		if (/what is the power of faith/i.test(text)) {
			return "The Buddha describes the five powers—faith, energy, mindfulness, immersion, and wisdom—and explains each in detail, from faith in the Realized One to the power of wisdom.";
		}
		return "The Buddha describes the five powers—faith, energy, mindfulness, immersion, and wisdom—and how they support practice on the path.";
	}

	if (/five faculties/i.test(text)) {
		return "The Buddha teaches the five faculties—faith, energy, mindfulness, immersion, and wisdom—and how they are developed and fulfilled on the path.";
	}

	if (/five strengths/i.test(text)) {
		return "The Buddha describes the five strengths—faith, energy, mindfulness, immersion, and wisdom—and how they strengthen a mendicant who has abandoned the five hindrances.";
	}

	if (/five kinds of persons|five persons/i.test(text)) {
		return "The Buddha describes the five kinds of persons found in the world, contrasting their conduct and spiritual attainment.";
	}

	if (/five things should be developed/i.test(text)) {
		const purpose =
			text.match(/for (?:the )?(complete understanding[^.]{0,80}|insight[^.]{0,60}|[^.]{10,90})/i)?.[1];
		return purpose
			? `The Buddha teaches that five things should be developed for ${purpose.replace(/\.$/, "").toLowerCase()}.`
			: "The Buddha teaches that five things should be developed on the path.";
	}

	if (/disrespectful and irreverent mendicant with five qualities/i.test(text)) {
		return "The Buddha contrasts disrespectful and respectful mendicants, each defined by five qualities—faithlessness, shamelessness, imprudence, laziness, and lack of wisdom versus their opposites.";
	}

	if (/stinginess with dwellings/i.test(text)) {
		return "The Buddha teaches that stinginess with dwellings, families, material things, praise, and the teachings obstructs higher attainments and must be given up to realize the fruits of the path.";
	}

	const topicMatch =
		text.match(/there are these five ([^.!?]{3,90})/i) ||
		text.match(/these five ([^.!?]{3,90}) are/i) ||
		text.match(/a mendicant with five ([^.!?]{3,60})/i);

	if (topicMatch) {
		const topic = (topicMatch[1] || title).replace(/[:,.]$/, "").trim();
		const items = extractFiveItems(body);
		const topicLower = topic.toLowerCase();

		if (/^things?$/i.test(topic) && items.length >= 2) {
			return `The Buddha describes the five things—${formatFiveEnum(items)}.`;
		}

		if (/^qualities$/i.test(topic) && items.length >= 2) {
			return `The Buddha describes the five qualities—${formatFiveEnum(items)}.`;
		}

		if (items.length >= 2) {
			return `The Buddha describes the five ${topicLower}—${formatFiveEnum(items)}.`;
		}
		if (/^things?$/i.test(topic) && title && !/^untitled/i.test(title)) {
			return `The Buddha teaches on ${title.toLowerCase()}, presenting a fivefold teaching for disciples on the path.`;
		}
		return `The Buddha describes the five ${topicLower}.`;
	}

	if (/then venerable|then the householder|then the wanderer/i.test(text)) {
		const who = text.match(/then (venerable \w+|the \w+)/i)?.[1] ?? "a disciple";
		return `The Buddha teaches ${who} on ${title.toLowerCase()}, presenting a fivefold teaching for disciples on the path.`;
	}

	if (title && title.length > 2 && !/^untitled/i.test(title)) {
		return `The Buddha teaches on ${title.toLowerCase()}, presenting a fivefold teaching for disciples on the path.`;
	}

	return "The Buddha presents a fivefold teaching in this discourse on qualities and practice for disciples on the path.";
}

export function buildSn12Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		if (
			/does not truly know or see|should train|practice meditation|rouse up enthusiasm|try vigorously/i.test(
				text,
			)
		) {
			return "The Buddha teaches a repeated formula on links of dependent origination—urging mendicants who have not truly known and seen each link to train, meditate, and strive until direct knowledge arises—in this grouped discourse.";
		}
		if (/don'?t understand|do not understand/i.test(text)) {
			return "The Buddha teaches a repeated formula contrasting ascetics and brahmins who fail to understand links of dependent origination with those who truly know and see them—in this grouped discourse.";
		}
		return `The Buddha presents a repeated teaching on dependent origination regarding ${title.toLowerCase()} in this grouped discourse.`;
	}

	if (
		/dependent origination/i.test(text) &&
		/ignorance is a requirement|ignorance is a condition/i.test(text)
	) {
		return "The Buddha teaches dependent origination—the twelve links from ignorance through choices, consciousness, name and form, the six sense fields, contact, feeling, craving, grasping, continued existence, rebirth, to old age and death—and their cessation.";
	}

	if (/ascetics and brahmins who don'?t understand|don'?t understand old age/i.test(text)) {
		return "The Buddha contrasts ascetics and brahmins who fail to understand links of dependent origination—their origin, cessation, and the practice leading to cessation—with those who truly know and see them.";
	}

	if (/does not truly know or see/i.test(text)) {
		const linkMatch = text.match(/does not truly know or see ([^.]{5,60})/i);
		if (linkMatch) {
			return `The Buddha teaches that one who does not truly know and see ${linkMatch[1].toLowerCase().replace(/\.$/, "")} should train accordingly until direct knowledge arises.`;
		}
		return "The Buddha teaches that one who has not truly known and seen a link of dependent origination should train on the path until direct knowledge arises.";
	}

	if (/ancient city|before my awakening.*intent on awakening/i.test(text)) {
		return "The Buddha recounts how before his awakening he discovered dependent origination through the simile of an ancient city, tracing the path of the noble ones who mapped the links and their cessation.";
	}

	if (/teaching by the middle|two extremes/i.test(text)) {
		return "The Buddha teaches dependent origination by the middle—rejecting eternalism and annihilationism while explaining how consciousness and name-and-form are mutually dependent.";
	}

	if (/forty-four bases|sixteen questions|bases of knowledge/i.test(text)) {
		return "The Buddha describes bases of knowledge regarding the arising and passing of the links of dependent origination.";
	}

	if (/origin.*cessation.*practice that leads/i.test(text)) {
		return `The Buddha teaches on ${title.toLowerCase()}, explaining an aspect of dependent origination—its origin, cessation, and the practice leading to its cessation.`;
	}

	if (
		/ignorance|choices|consciousness|name and form|six sense fields|contact|feeling|craving|grasping|continued existence|rebirth|old age and death/i.test(
			text,
		)
	) {
		return `The Buddha teaches on ${title.toLowerCase()}, presenting an analysis of dependent origination and the causal links that give rise to suffering.`;
	}

	if (title && title.length > 2) {
		return `The Buddha teaches on dependent origination regarding ${title.toLowerCase()}, showing how the links arise and cease on the path to liberation.`;
	}

	return "The Buddha teaches on dependent origination and the causal conditions that give rise to and cease from suffering.";
}

export function buildSn22Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		return `The Buddha presents a repeated teaching on the five aggregates regarding ${title.toLowerCase()} in this grouped discourse.`;
	}

	if (/form is not-self|feeling is not-self/i.test(text) && /lead to affliction|may my form be/i.test(text)) {
		return "The Buddha teaches that the five aggregates—form, feeling, perception, choices, and consciousness—are not-self, showing why they lead to affliction and cannot be compelled at will.";
	}

	if (/form is impermanent|impermanent is suffering|what's impermanent is suffering/i.test(text)) {
		return "The Buddha teaches that each of the five aggregates is impermanent, suffering, and not-self, and should be truly seen with right understanding until the mind is freed by not grasping.";
	}

	if (/lump of foam|water bubble|mirage|plantain trunk|magical illusion/i.test(text)) {
		return "The Buddha teaches similes—of a lump of foam, a water bubble, a mirage, a plantain trunk, and a magical illusion—showing how form, feeling, perception, choices, and consciousness are empty and insubstantial.";
	}

	if (/phases of the aggregates|growth, decline/i.test(text)) {
		return "The Buddha describes the phases of the aggregates—their growth, decline, and passing—so a mendicant might understand them and cut through the conceit 'I am'.";
	}

	if (/residual conceit.*i am|conceit 'i am'/i.test(text)) {
		return "The Buddha teaches how even a mendicant who has ended the fetters may retain a residual conceit 'I am' regarding the aggregates, and how to remove it through deeper insight.";
	}

	if (/householder/i.test(text)) {
		const who = text.match(/householder (\w+(?:'s \w+)?)/i)?.[1] ?? "a householder";
		return `The Buddha advises ${who} on the five aggregates and how to practice amid aging, illness, and the limitations of the body.`;
	}

	if (/five aggregates|five grasping aggregates/i.test(text)) {
		return `The Buddha teaches on the five aggregates regarding ${title.toLowerCase()}, showing how they are to be understood for liberation from suffering.`;
	}

	if (/form|feeling|perception|choices|consciousness/i.test(text)) {
		return `The Buddha teaches on ${title.toLowerCase()}, applying the analysis of the five aggregates—form, feeling, perception, choices, and consciousness—to insight and release.`;
	}

	if (title && title.length > 2) {
		return `The Buddha teaches on the five aggregates regarding ${title.toLowerCase()}, guiding disciples toward disenchantment and liberation.`;
	}

	return "The Buddha teaches on the five aggregates and how rightly understanding them leads to liberation from suffering.";
}

export function buildSn35Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		if (
			/all is liable to be reborn|liable to grow old|liable to fall ill|liable to die|liable to sorrow|liable to suffer|liable to despair/i.test(
				text,
			)
		) {
			const formula =
				text.match(/all is (liable to [^.]{5,40})/i)?.[1] ??
				text.match(/liable to (grow old|fall ill|die|sorrow)/i)?.[0] ??
				"impermanent";
			return `The Buddha teaches a repeated formula showing that the six sense bases and their objects are ${formula.toLowerCase()}, applying this analysis to each internal and external sense field in this grouped discourse.`;
		}
		if (/should be developed|should practice|meditation on|does not truly know/i.test(text)) {
			return "The Buddha teaches a repeated formula on the six sense bases and their objects, urging mendicants to train and develop meditation until they truly know and see them in this grouped discourse.";
		}
		return `The Buddha presents a repeated teaching on the six internal and external sense bases regarding ${title.toLowerCase()} in this grouped discourse.`;
	}

	if (/all is burning|burning with the fires of greed/i.test(text)) {
		return "The Buddha teaches that the six sense bases and their objects—the eye and sights, ear and sounds, and so on through mind and ideas—are burning with the fires of greed, hate, and delusion, and that seeing this leads to disenchantment and liberation.";
	}

	if (/world is empty|empty of self/i.test(text)) {
		return "The Buddha explains to Ānanda that the world is called empty because the six sense bases, their objects, consciousness, contact, and feelings are all empty of self or what belongs to self.";
	}

	if (/fetter|fetters.*fall away|ending of the fetters/i.test(text)) {
		return "The Buddha teaches how contemplating the six sense bases leads to the fading away of the fetters and the ending of suffering.";
	}

	if (/eye is burning|eye.*sights.*eye consciousness/i.test(text)) {
		return `The Buddha teaches on the internal and external sense bases regarding ${title.toLowerCase()}, analyzing the eye, sights, consciousness, contact, and feeling for insight and release.`;
	}

	if (/six sense bases|six sense fields|six internal|six external/i.test(text)) {
		return `The Buddha teaches on the six internal and external sense bases regarding ${title.toLowerCase()}, showing how contact and feeling arise and how to practice for liberation.`;
	}

	if (title && title.length > 2) {
		return `The Buddha teaches on the six sense bases regarding ${title.toLowerCase()}, guiding disciples toward discernment of sense experience and release from clinging.`;
	}

	return "The Buddha teaches on the six internal and external sense bases and how rightly understanding them leads to liberation.";
}

export function buildSnpDescription(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));
	const chapter = slug.match(/^snp(\d+)/)?.[1];

	if (chapter === "1") {
		if (/serpent|old worn-out skin|casting off/i.test(text)) {
			return "Verses depicting the path to liberation through the metaphor of a serpent shedding its skin, showing how a mendicant who restrains anger, cuts off passion and craving, and abandons conceit casts off attachment to this world and the next.";
		}
		if (/rancher|Mahī|roofed|rain forth/i.test(text)) {
			return "Verses in which the rancher Dhaniya boasts of his worldly security and the Buddha counters with the safety of one who has quelled anger and found shelter in the Dhamma, culminating in both going for refuge.";
		}
		if (/brahmin|sacred/i.test(text)) {
			return `Verse dialogue in the Uragavagga in which the Buddha responds regarding ${title.toLowerCase()}, contrasting worldly security with the safety of one established in the path.`;
		}
		return `Verses in the Uragavagga (${title}) depicting how a mendicant abandons defilements and sheds worldly attachment like a serpent casting off its worn-out skin.`;
	}

	if (chapter === "2") {
		if (/gems|jewels|excellent gem|Tathāgata|deathless/i.test(text)) {
			return "Verses addressed to earthly and celestial beings declaring the peerless qualities of the Awakened One, the deathless Dhamma, and the noble Saṅgha as supreme gems, invoking well-being through truth.";
		}
		if (/putrefaction|delicious food|millet/i.test(text)) {
			return "Verses in which the Buddha teaches the brahmin poet Kassapa that feasting on alms food is not putrefaction when obtained honestly, contrasting the simple fare of the good with indulgence in rich food.";
		}
		if (/mettā|loving-kindness|beings/i.test(text)) {
			return `Verses on ${title.toLowerCase()} in the Little Chapter, encouraging loving-kindness toward all beings and devotion to the qualities of the Buddha, Dhamma, and Saṅgha.`;
		}
		return `Verses in the Little Chapter (${title}) on ethical conduct, devotion, and the supreme value of the Buddha, Dhamma, and Saṅgha.`;
	}

	if (chapter === "3") {
		if (/going forth|life at home is cramped|gone forth/i.test(text)) {
			return "Verses recounting the Buddha's going forth, his encounter with King Bimbisāra, and his teaching on the drawbacks of sensual pleasures and the security of the renunciate life.";
		}
		if (/rhinoceros|horn|wander alone/i.test(text)) {
			return "Verses praising solitude and self-reliance in the spiritual life, using the image of a rhinoceros wandering alone rather than keeping company that breeds attachment and harm.";
		}
		if (/sacrifice|oblation|brahmin|fire sacrifice/i.test(text)) {
			return "Verses in which the Buddha meets a brahmin during a fire sacrifice and teaches that true purity comes from ethical conduct and abandoning harmful deeds, not ritual offerings.";
		}
		if (/householder|king|prince/i.test(text)) {
			return `Verses on ${title.toLowerCase()} in the Great Chapter, recounting the Buddha's encounters and his teaching on renunciation, ethical conduct, and liberation.`;
		}
		return `Verses in the Great Chapter (${title}) on renunciation, ethical conduct, and the path to liberation through solitude and discernment.`;
	}

	return `Verses on ${title.toLowerCase()} teaching qualities and conduct that lead to liberation.`;
}

export function buildSn1Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		return `The Buddha presents a repeated teaching in verse dialogue with deities regarding ${title.toLowerCase()} in this grouped discourse.`;
	}

	if (/once upon a time.*deity|company of the thirty-three|garden of delight/i.test(text)) {
		return "The Buddha recounts how deities of the company of the Thirty-Three disputed in verse over heavenly pleasures, and how a wiser deity reminded them that all conditions are impermanent and their settling is bliss.";
	}

	if (/glorious deity.*went up to the buddha|deity.*bowed.*stood to one side|deity.*said to him/i.test(text)) {
		if (/crossed the flood|neither standing nor swimming/i.test(text)) {
			return "A deity asks the Buddha how he crossed the flood of suffering; the Buddha teaches that clinging and struggle both fail, and the deity praises him in verse as a brahmin fully quenched who has crossed clinging to the world.";
		}
		if (/sensual pleasure|lust|desire|women dressed/i.test(text)) {
			return `A deity engages the Buddha in verse on ${title.toLowerCase()}, probing the dangers of sensual desire and the path beyond attachment.`;
		}
		if (/impermanent|rise and fall|conditions/i.test(text)) {
			return `A deity approaches the Buddha in verse to reflect on ${title.toLowerCase()}, and the Teacher affirms the impermanent nature of conditioned things.`;
		}
		return `Late at night a radiant deity approaches the Buddha and speaks in verse on ${title.toLowerCase()}, and the Teacher responds with a teaching on the Dhamma.`;
	}

	if (/glorious deity.*went up to venerable|deity.*addressed him in verse|deity.*standing in the air/i.test(text)) {
		const disciple = text.match(/went up to (venerable \w+)/i)?.[1] ?? "a disciple";
		if (/sensual pleasure|lust|eat first|seek alms/i.test(text)) {
			return `A radiant deity tempts ${disciple} in verse with sensual pleasures or worldly advice; the Buddha later teaches on mindfulness, letting go of identity, and the path beyond craving.`;
		}
		return `A radiant deity addresses ${disciple} in verse on ${title.toLowerCase()}, prompting a teaching on diligence and the spiritual life.`;
	}

	if (/the buddha addressed the mendicants|the buddha said this/i.test(text) && /deity|deva/i.test(text)) {
		return `The Buddha teaches the mendicants a verse dialogue among deities on ${title.toLowerCase()}, illustrating a point of the Dhamma through celestial voices.`;
	}

	if (/^what leads|^what drags|^who|^how|^why|^when|^where/i.test(stripSegments(body).trim())) {
		if (/craving leads the world/i.test(text)) {
			return "In verse dialogue a deity asks what leads and drags the world along, and the answer is given that craving alone has everything under its sway.";
		}
		if (/craving|desire|attachment/i.test(text)) {
			return `In verse dialogue a deity asks about ${title.toLowerCase()}, and the Buddha answers that craving and attachment drive beings through the round of rebirth.`;
		}
		if (/mind|name|form|fetter|bond/i.test(text)) {
			return `In verse dialogue a deity asks about ${title.toLowerCase()}, and the Buddha answers with a concise teaching on how the mind and defilements bind beings to suffering.`;
		}
		return `In verse dialogue a deity asks the Buddha about ${title.toLowerCase()}, and he answers with a concise teaching on the Dhamma.`;
	}

	if (/teacher approved|knowing that the teacher approved/i.test(text)) {
		return `A deity speaks to the Buddha in verse on ${title.toLowerCase()}; the Teacher approves, and the deity pays homage before vanishing.`;
	}

	if (title && title.length > 2) {
		return `A deity engages the Buddha in verse on ${title.toLowerCase()}, exploring a teaching on suffering, liberation, and the law of kamma.`;
	}

	return "A deity approaches the Buddha in verse dialogue, addressing a teaching on the path to liberation from suffering.";
}

export function buildSn2Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));
	const godling = title.replace(/^with /i, "").trim() || "a young deity";

	if (slug.includes("-")) {
		return `The Buddha presents a repeated teaching in verse dialogue with young deities regarding ${title.toLowerCase()} in this grouped discourse.`;
	}

	if (/sun god|moon god|seized by rāhu/i.test(text)) {
		const which = /sun god/i.test(text) ? "Sun" : "Moon";
		return `When the ${which} God is seized by Rāhu, lord of titans, he recollects the Buddha and pleads for refuge; the Teacher then commands Rāhu to release him in verse, declaring the Buddhas' compassion for the world.`;
	}

	if (/disciples of various monastics|pūraṇa kassapa|gosāla|jain ascetic/i.test(text)) {
		return "Several young deities, disciples of rival teachers, praise their former masters in verse before the Buddha, who refutes each claim and declares the noble path of ethics, immersion, and wisdom.";
	}

	if (/do you endorse sāriputta/i.test(text)) {
		return "The Buddha asks Ānanda whether he endorses Sāriputta; when Ānanda praises Sāriputta's wisdom and qualities, a young deity Susīma endorses him too, and the Buddha approves.";
	}

	if (/young deity anāthapiṇḍika|that young deity.*ānanda.*anāthapiṇḍika/i.test(text)) {
		return "The householder Anāthapiṇḍika, after passing away, appears as a young deity and recites verses on the value of examining the Dhamma, ethical conduct over birth, and the virtues of Sāriputta.";
	}

	if (/the buddha addressed the mendicants/i.test(text) && /godling|young deity/i.test(text)) {
		return `The Buddha recounts to the mendicants a verse exchange with the young deity ${godling} on ${title.toLowerCase()}.`;
	}

	if (/teacher approved|knowing that the teacher approved/i.test(text)) {
		if (/train in well-spoken|sit alone|calm the mind/i.test(text)) {
			return "The young deity Kassapa tells the Buddha that he has revealed the mendicant but not the mendicant's instructions; invited to clarify, he recites verses on well-spoken words, solitude, and calming the mind, which the Teacher approves.";
		}
		return `The young deity ${godling} speaks to the Buddha in verse on ${title.toLowerCase()}; the Teacher approves, and the deity pays homage before vanishing.`;
	}

	if (/seven mendicants reborn in aviha|crossed over clinging to the world/i.test(text)) {
		return "The young deity Ghaṭīkāra recites verses celebrating mendicants reborn in the Aviha realm after ending greed and hate, and the Buddha asks who has crossed Death's dominion, leading to dialogue on those perfected in past births.";
	}

	if (/standing to one side.*godling|godling.*recited these verses/i.test(text)) {
		if (/anger|cut off anger|sleep with ease/i.test(text)) {
			return "The young deity Māgha asks in verse what to cut off to sleep with ease and grieve no more; the Buddha advises cutting off anger with its poisonous root.";
		}
		if (/four lamps|sun blazes|buddha is the best of blazes/i.test(text)) {
			return "The young deity Maghada asks how many lamps light up the world; the Buddha answers that sun, moon, fire, and a Buddha are the four—there is no fifth.";
		}
		if (/wicked deed|fools and simpletons|bitter fruit/i.test(text)) {
			return "The young deity Khema recites verses on the bitter fruit of wicked deeds and the gladness of skillful actions, and the Buddha adds the simile of a careful cart driver who stays on the highway.";
		}
		return `Standing to one side, the young deity ${godling} addresses the Buddha in verse on ${title.toLowerCase()}.`;
	}

	if (/glorious godling|godling.*went up to the buddha/i.test(text)) {
		return `Late at night the glorious young deity ${godling} approaches the Buddha and speaks in verse on ${title.toLowerCase()}, exploring the continuity of kamma, rebirth, and the pursuit of wisdom across realms.`;
	}

	if (/^what leads|^what should|^how many|^who are those/i.test(stripSegments(body).trim())) {
		return `In verse dialogue the young deity ${godling} asks the Buddha about ${title.toLowerCase()}, and he answers with a concise teaching on the Dhamma.`;
	}

	if (title && title.length > 2) {
		return `A young deity engages the Buddha in verse on ${title.toLowerCase()}, reflecting on past deeds, rebirth, and the pursuit of liberation.`;
	}

	return "A young deity approaches the Buddha in verse dialogue, expressing insight gained from rebirth in the divine realm or seeking guidance on the path to liberation.";
}

export function buildSn4Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		return `Māra the Wicked confronts the Buddha or mendicants with a repeated formula regarding ${title.toLowerCase()} in this grouped discourse.`;
	}

	if (/māra's daughters|craving, malignancy, and lust/i.test(text)) {
		return "Māra's daughters Craving, Malignancy, and Lust try to seduce the Buddha with beauty and allure; he teaches them on the dangers of form, feeling, and the path of those freed from sensuality, leaving them defeated.";
	}

	if (/pursuing the buddha for seven years|seven years hoping/i.test(text)) {
		return "After pursuing the Buddha for seven years without finding a vulnerability, Māra questions him in verse on why he meditates alone in the forest; the Buddha answers that he has uprooted suffering and is unshakable.";
	}

	if (/godhika/i.test(text)) {
		return "Venerable Godhika repeatedly attains temporary release of heart only to fall away; on the seventh occasion he takes his own life while fully awakened, and Māra tries to claim him—until the Buddha declares Godhika is fully extinguished.";
	}

	if (/samiddhi/i.test(text)) {
		return "When Venerable Samiddhi reflects on his good fortune in teacher, teaching, and companions, Māra makes a terrifying noise to frighten him; the Buddha teaches Samiddhi to develop perception of impermanence in all things.";
	}

	if (/several mendicants were meditating|enjoy human sensual pleasures/i.test(text)) {
		return "Māra the Wicked appears to young mendicants in the guise of an old brahmin, urging them to enjoy sensual pleasures rather than renounce what is apparent for what is distant; the mendicants refute him with the Buddha's teaching on the drawbacks of sensuality.";
	}

	if (/lifespan of humans is short|hundred years or a little more/i.test(text)) {
		return "The Buddha teaches mendicants that human life is short and no one born is immortal; Māra interrupts in verse claiming people enjoy long life, and the Buddha refutes him, urging diligence in the spiritual life.";
	}

	if (/māra's snares|bound by māra's snares|freed from māra's snares/i.test(text)) {
		return "The Buddha tells mendicants he attained supreme freedom through rational effort and urges them to do likewise; Māra claims the Buddha is still bound by his snares, and the Teacher answers in verse that he is freed and Māra is beaten.";
	}

	if (/when he was first awakened|grueling work|practice of mortification/i.test(text)) {
		if (/elephant king/i.test(text)) {
			return "Soon after awakening, while meditating in the rain at night, the Buddha is approached by Māra manifesting as a terrifying elephant king; the Teacher recognizes him and remains fearless.";
		}
		if (/rainbow of bright colors|beautiful and ugly/i.test(text)) {
			return "Soon after awakening, Māra displays beautiful and ugly rainbow colors to frighten the Buddha during night meditation; the Teacher replies in verse that those well restrained in body, speech, and mind do not fall under Māra's sway.";
		}
		if (/serpent|king of serpents/i.test(text)) {
			return "Soon after awakening, Māra manifests as a great serpent to terrify the Buddha during night meditation; the Teacher recognizes and overcomes him in verse.";
		}
		return "Soon after his awakening, the Buddha reflects that he is freed from pointless mortification; Māra accuses him of straying from the path of purity, and the Buddha answers that ethics, immersion, and wisdom led to ultimate purity.";
	}

	if (/pull the wool over their eyes|educating, encouraging.*mendicants/i.test(text)) {
		if (/alms bowls|form of an ox/i.test(text)) {
			return "While the Buddha teaches on the five grasping aggregates, Māra manifests as an ox threatening alms bowls to distract the mendicants; the Buddha exposes him in verse.";
		}
		if (/form of a farmer|mine alone is the eye/i.test(text)) {
			return "While the Buddha teaches on extinguishment, Māra appears as a muddy farmer claiming dominion over the six sense fields; the Buddha refutes him, teaching non-attachment to eye, ear, nose, tongue, body, and mind.";
		}
		if (/six fields of contact|earth is shattering/i.test(text)) {
			return "While the Buddha teaches on the six fields of contact, Māra makes a terrifying noise like the earth shattering; the Buddha exposes him and teaches the mendicants to see formations as impermanent.";
		}
		if (/large assembly of laypeople|not appropriate for you to instruct/i.test(text)) {
			return "While the Buddha teaches a large assembly of laypeople, Māra claims it is not appropriate for him to instruct others and warns against favoring and opposing; the Buddha answers that he teaches without grasping at views.";
		}
		if (/splinter/i.test(text)) {
			return "While the Buddha instructs mendicants on illness and the body, Māra appears disguised with a splinter to provoke fear; the Buddha exposes and dismisses him.";
		}
		if (/lion/i.test(title.toLowerCase()) || /lion's roar/i.test(text)) {
			return "While the Buddha teaches with a lion's roar among mendicants, Māra challenges him in verse; the Buddha answers, declaring the defeat of the Wicked One.";
		}
		return `While the Buddha instructs mendicants on ${title.toLowerCase()}, Māra the Wicked intervenes to distract or challenge him, and is overcome in verse.`;
	}

	if (/crushed some large boulders|vulture's peak/i.test(text)) {
		return "While the Buddha meditates on Vulture's Peak in the rain at night, Māra crushes boulders nearby to terrify him; the Buddha declares in verse that the rightly released and awakened are unshaken even if the mountain shook.";
	}

	if (/māra the wicked.*addressed him in verse|replied to him in verse/i.test(text)) {
		return `Māra the Wicked challenges the Buddha in verse on ${title.toLowerCase()}; the Teacher answers with wisdom and declares his defeat.`;
	}

	if (title && title.length > 2) {
		return `Māra the Wicked obstructs or tempts the Buddha or his disciples regarding ${title.toLowerCase()}, and is overcome through wisdom, restraint, and the power of the Dhamma.`;
	}

	return "Māra the Wicked confronts the Buddha or his disciples, attempting to obstruct the path through fear, temptation, or deception, and is overcome through wisdom and the power of the Dhamma.";
}

export function buildSn6Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		return `A Brahmā or divinity engages the Buddha or his disciples in a repeated teaching regarding ${title.toLowerCase()} in this grouped discourse.`;
	}

	if (/full extinguishment|conditions fall apart.*persist with diligence/i.test(text)) {
		return "At his final passing between sal trees at Kusinārā, the Buddha enters and emerges from successive absorptions until fully extinguished; the divinity Sahampati then laments in verse that even such an unrivaled Teacher must lay down the body.";
	}

	if (/sahampati|inclines to remaining passive|let the blessed one teach/i.test(text)) {
		return "After awakening, the Buddha reflects that the Dhamma is too deep to teach and inclines to passivity; the divinity Sahampati appears to plead that beings with little dust in their eyes will understand, and the Buddha surveys the world with compassion and agrees to teach.";
	}

	if (/baka the divinity|no other escape beyond this/i.test(text)) {
		return "Baka the Divinity, thinking his realm is permanent and eternal, invites the Buddha as a welcome guest; the Teacher refutes his ignorance, teaching impermanence and the escape beyond even the highest Brahmā realm.";
	}

	if (/brahmadeva|brahmin lady.*oblation/i.test(text)) {
		return "The perfected disciple Brahmadeva, on almsround at his mother's house while she offers to Brahmā, is recognized by the divinity Sahampati; mother and son exchange verses on abandoning sacrifice to Brahmā and the true refuge in the Awakened One.";
	}

	if (/negligent divinity|negligent.*realm of divinity/i.test(text)) {
		return "The divinities Subrahmā and Suddhāvāsa, finding the Buddha in retreat, visit a negligent Brahmā in his prosperous realm and inspire awe in him, teaching that even psychic power is worthless without attending on the Buddha.";
	}

	if (/certain divinity|no ascetic or brahmin can come here|fire element/i.test(text)) {
		return "A Brahmā who thinks no ascetic can reach his realm is visited by the Buddha and chief disciples displaying mastery of the fire element; the Brahmā's conceit is humbled before the power of the Realized One.";
	}

	if (/kokālika/i.test(text)) {
		if (/corrupt wishes|confidence in sāriputta/i.test(text)) {
			return "When the mendicant Kokālika slanders Sāriputta and Moggallāna as corrupt, the Buddha warns him repeatedly to have confidence in them; Kokālika persists and suffers the consequences of divisive speech.";
		}
		if (/immeasurable by measuring|ordinary person, shrouded/i.test(text)) {
			return "While the Buddha is in retreat, the divinity Subrahmā speaks in verse at his door on the folly of Kokālika, who judged the immeasurable chief disciples by mere measuring.";
		}
		if (/tudu the independent divinity|gravely ill/i.test(text)) {
			return "The gravely ill mendicant Kokālika rejects the divinity Tudu's advice to have confidence in Sāriputta and Moggallāna, and exchanges verses until he is reborn in hell for his divisive speech.";
		}
	}

	if (/katamorakatissaka|ignoramus, shrouded/i.test(text)) {
		return "While the Buddha is in retreat, the divinity Suddhāvāsa speaks in verse on the folly of judging the immeasurable, referring to the mendicant Katamorakatissaka.";
	}

	if (/sanaṅkumāra|aristocrat is best among people/i.test(text)) {
		return "The divinity Sanaṅkumāra recites verses before the Buddha declaring that one accomplished in knowledge and conduct is best among gods and humans, beyond mere birth as an aristocrat; the Teacher approves.";
	}

	if (/devadatta/i.test(text)) {
		return "A divinity speaks to the Buddha about Devadatta's ambition and downfall, illustrating the dangers of conceit, divisiveness, and turning against the Teacher.";
	}

	if (/subrahmā|suddhāvāsa/i.test(text) && /verse/i.test(text)) {
		return `While the Buddha is in day retreat, a divinity speaks in verse on ${title.toLowerCase()}, heard at the door of his dwelling.`;
	}

	if (/divinity.*spoke this verse|glorious divinity.*went up to the buddha/i.test(text)) {
		const name = title.replace(/^with /i, "").replace(/^about /i, "").trim();
		return `The divinity ${name} approaches the Buddha and speaks in verse on ${title.toLowerCase()}, affirming the depth and reach of the Dhamma even among exalted beings.`;
	}

	if (title && title.length > 2) {
		const name = title.replace(/^with /i, "").replace(/^about /i, "").trim();
		return `The Buddha or a disciple engages the Brahmā ${name} on ${title.toLowerCase()}, teaching impermanence, the limits of celestial rebirth, and the unparalleled depth of the Awakened One's wisdom.`;
	}

	return "A mighty Brahmā or divinity approaches the Buddha or his disciples to seek clarification, offer praise, or challenge a misconception about the highest realms and the path to liberation.";
}

export function buildSn8Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		return `Venerable Vaṅgīsa recites verses on ${title.toLowerCase()} in this grouped discourse of the Vaṅgīsa collection.`;
	}

	if (/recently attained perfection|bliss of freedom/i.test(text)) {
		return "Venerable Vaṅgīsa, having recently attained perfection, recites verses on his going forth, the Buddha's awakening, and the joy of freedom from the aggregates, elements, and sense fields.";
	}

	if (/lust infecting his mind|dissatisfied.*lust|women dressed in all their finery/i.test(text)) {
		return "When lust infects his mind after seeing finely dressed women, Venerable Vaṅgīsa dispels his own discontent by reciting verses on renunciation, firmness in the teaching, and defying Māra on the path to extinguishment.";
	}

	if (/extolled|extoll|feel inspired to speak/i.test(text)) {
		const who =
			text.match(/extoll(?:ed)? (\w+) in his presence/i)?.[1] ??
			text.match(/toward (\w+)/i)?.[1] ??
			"a senior disciple";
		return `Venerable Vaṅgīsa, inspired by a Dhamma talk, rises to extol Venerable ${who} in verse—praising his wisdom, clarity of teaching, and benefit to the Saṅgha.`;
	}

	if (/invitation to admonish|admonish one another/i.test(text)) {
		return "At the invitation to admonish, Venerable Vaṅgīsa recites verses encouraging mendicants to speak up with respect when they see a colleague's faults, and to accept correction humbly.";
	}

	if (/well-spoken|well spoken words/i.test(text)) {
		return "Venerable Vaṅgīsa recites verses on well-spoken words—those that are true, beneficial, and timely—and on the value of hearing and proclaiming the Buddha's teaching.";
	}

	if (/over a thousand|thousand monks/i.test(text)) {
		return "Venerable Vaṅgīsa recites verses celebrating over a thousand monks gathered to hear the Dhamma, praising the Buddha and the radiance of the teaching.";
	}

	if (/buddha.*kinsman of the sun|path going to extinguishment|dark one|wicked one/i.test(text)) {
		return `Venerable Vaṅgīsa recites verses on ${title.toLowerCase()}, expressing devotion to the Buddha and resolve to overcome Māra on the path to extinguishment.`;
	}

	if (/faith arose|went forth to homelessness|aggregates.*sense fields/i.test(text)) {
		return `Venerable Vaṅgīsa recites verses on ${title.toLowerCase()}, recounting how faith in the Buddha led him to go forth and practice insight into the aggregates and sense fields.`;
	}

	if (title && title.length > 2) {
		return `Venerable Vaṅgīsa recites spontaneous verses on ${title.toLowerCase()}, blending poetic expression with insight into the Buddha's teaching.`;
	}

	return "Venerable Vaṅgīsa recites spontaneous verses expressing devotion to the Buddha, the beauty of the Dhamma, and the challenges of the spiritual life.";
}

export function buildSn10Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		return `The Buddha or a disciple encounters a yakkha in verse dialogue on ${title.toLowerCase()} in this grouped discourse.`;
	}

	if (/get out, ascetic|get in, ascetic/i.test(text)) {
		return "The yakkha Āḷavaka repeatedly orders the Buddha out and in, then questions him in verse on giving, ethics, anger, and the path; the Buddha answers until the yakkha is subdued and goes for refuge.";
	}

	if (/householder anāthapiṇḍika|anāthapiṇḍika had arrived/i.test(text)) {
		return "On his first journey to meet the Buddha, the householder Anāthapiṇḍika is guided through the night by the yakkha Sivaka, who recites verses on the supreme merit of offering to the Saṅgha and the danger of turning back from the path.";
	}

	if (/nun sukkā|nun cīrā|bhikkhunī/i.test(text)) {
		const who = text.match(/nun (\w+)/i)?.[1] ?? "a nun";
		return `The yakkha challenges the nun ${who} in verse; she responds with teaching on ethical conduct and insight, subduing the spirit through the power of the Dhamma.`;
	}

	if (/native spirit|yakkha.*went up to the buddha|spirit.*addressed him in verse/i.test(text)) {
		if (/form is not the soul|zygote|blastocyst|womb/i.test(text)) {
			return "The yakkha Indaka questions the Buddha in verse on how a being acquires a body if form is not the soul; the Buddha answers with the stages of embryonic development and how the mother's nourishment sustains the fetus.";
		}
		if (/anger|ill will|harm/i.test(text)) {
			return `The yakkha ${title.replace(/^with /i, "")} challenges the Buddha in verse on ${title.toLowerCase()}; the Teacher answers with teaching on abandoning anger, harmlessness, and the path to peace.`;
		}
		if (/sakka|lord of gods/i.test(text)) {
			return "A yakkha who falsely claims the name of Sakka questions the Buddha in verse and is corrected on the qualities of the true lord of gods and the power of the Dhamma.";
		}
		return `The yakkha ${title.replace(/^with /i, "")} approaches the Buddha in verse on ${title.toLowerCase()}, and the Teacher responds with a teaching on morality, impermanence, or the dangers of defilements.`;
	}

	if (/native spirit.*disciple|spirit.*venerable/i.test(text)) {
		return `A yakkha challenges a disciple in verse on ${title.toLowerCase()}; the mendicant or the Buddha responds with teaching that subdues or instructs the spirit.`;
	}

	if (title && title.length > 2) {
		return `The Buddha encounters the yakkha ${title.replace(/^with /i, "")} and teaches in verse on ${title.toLowerCase()}, showing how the Dhamma transforms even hostile beings.`;
	}

	return "The Buddha or a disciple encounters a yakkha who challenges them in verse, and the Dhamma is taught on ethics, impermanence, and the end of suffering.";
}

export function inferSn1Themes(text) {
	const themes = inferThemes(text);
	if (/deity|deva|verse|impermanent/i.test(text)) {
		return themes.includes("inspiration")
			? themes.slice(0, 2)
			: ["inspiration", themes[0] ?? "wisdom"].slice(0, 2);
	}
	return themes.includes("wisdom") ? themes.slice(0, 2) : ["wisdom", themes[0] ?? "inspiration"].slice(0, 2);
}

export function inferSn2Themes(text) {
	const themes = inferThemes(text);
	if (/godling|young deity|reborn|verse|kamma/i.test(text)) {
		return themes.includes("inspiration")
			? themes.slice(0, 2)
			: ["inspiration", themes[0] ?? "wisdom"].slice(0, 2);
	}
	return themes.includes("wisdom") ? themes.slice(0, 2) : ["wisdom", themes[0] ?? "inspiration"].slice(0, 2);
}

export function inferSn4Themes(text) {
	const themes = inferThemes(text);
	if (/mendicants|train|meditat|lifespan|spiritual life/i.test(text)) {
		return themes.includes("training guideline")
			? themes.slice(0, 2)
			: ["training guideline", themes[0] ?? "wisdom"].slice(0, 2);
	}
	if (/godhika|seven years|daughters|pursuing/i.test(text)) {
		return themes.includes("story") ? themes.slice(0, 2) : ["story", themes[0] ?? "wisdom"].slice(0, 2);
	}
	return themes.includes("wisdom") ? themes.slice(0, 2) : ["wisdom", themes[0] ?? "training guideline"].slice(0, 2);
}

export function inferSn6Themes(text) {
	const themes = inferThemes(text);
	if (/full extinguishment|sahampati|teach the dhamma|last words/i.test(text)) {
		return themes.includes("recollection of the Buddha")
			? themes.slice(0, 2)
			: ["recollection of the Buddha", themes[0] ?? "inspiration"].slice(0, 2);
	}
	if (/baka|negligent|psychic power|realm of divinity/i.test(text)) {
		return themes.includes("wisdom")
			? themes.slice(0, 2)
			: ["wisdom", themes[0] ?? "cultivating discernment"].slice(0, 2);
	}
	if (/kokālika|devadatta/i.test(text)) {
		return themes.includes("story") ? themes.slice(0, 2) : ["story", themes[0] ?? "wisdom"].slice(0, 2);
	}
	return themes.includes("inspiration") ? themes.slice(0, 2) : ["inspiration", themes[0] ?? "wisdom"].slice(0, 2);
}

export function inferSn8Themes(text) {
	const themes = inferThemes(text);
	if (/buddha|faith|extoll|inspired|kinsman of the sun/i.test(text)) {
		return themes.includes("recollection of the Buddha")
			? themes.slice(0, 2)
			: ["inspiration", "recollection of the Buddha"];
	}
	if (/lust|dissatisfied|dark one|meditate/i.test(text)) {
		return themes.includes("training guideline")
			? themes.slice(0, 2)
			: ["training guideline", "inspiration"];
	}
	return themes.length ? themes.slice(0, 2) : ["inspiration", "wisdom"];
}

export function inferSn10Themes(text) {
	const themes = inferThemes(text);
	if (/yakkha|native spirit|get out|householder|nun/i.test(text)) {
		return themes.includes("story") ? themes.slice(0, 2) : ["story", themes[0] ?? "wisdom"].slice(0, 2);
	}
	return themes.includes("wisdom") ? themes.slice(0, 2) : ["wisdom", themes[0] ?? "story"].slice(0, 2);
}

export function inferSn12Themes(text) {
	const themes = inferThemes(text);
	if (!themes.includes("principle")) return ["principle", themes[0]].slice(0, 2);
	return themes.slice(0, 2);
}

export function inferSn22Themes(text) {
	const themes = inferThemes(text);
	if (themes.includes("wisdom")) return themes.slice(0, 2);
	return ["wisdom", themes[0] ?? "directly knowing"].slice(0, 2);
}

export function inferSn35Themes(text) {
	const themes = inferThemes(text);
	if (/burning|fetter|train|meditat/i.test(text)) {
		return themes.includes("training guideline")
			? themes.slice(0, 2)
			: ["wisdom", "training guideline"];
	}
	return themes.includes("wisdom") ? themes.slice(0, 2) : ["wisdom", themes[0] ?? "principle"].slice(0, 2);
}

export function inferSnpThemes(text, slug) {
	const chapter = slug.match(/^snp(\d+)/)?.[1];
	if (chapter === "1") return ["inspiration", "principle"];
	if (chapter === "2") return ["inspiration", "wisdom"];
	const themes = inferThemes(text);
	if (/going forth|Bimbisāra|awakened/i.test(text)) return ["inspiration", "recollection of the Buddha"];
	if (/rhinoceros|alone|solitude/i.test(text)) return ["training guideline", "inspiration"];
	return themes.length ? themes.slice(0, 2) : ["inspiration", "principle"];
}

export function buildSn45Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		if (/slants, slopes, and inclines to the (east|ocean)/i.test(text)) {
			const direction = /inclines to the ocean/i.test(text) ? "the ocean" : "the east";
			return `The Buddha teaches a repeated simile of great rivers slanting, sloping, and inclining to ${direction}, showing how a mendicant who develops the noble eightfold path likewise inclines to extinguishment, applied across each river in this grouped discourse.`;
		}
		if (/accomplishment in ethics|accomplishment in enthusiasm|accomplishment in self-development|accomplishment in view|accomplishment in diligence/i.test(text)) {
			return "The Buddha teaches a repeated simile of dawn as the forerunner of sunrise, showing how accomplishment in ethics, enthusiasm, self-development, view, and diligence each forerun the arising of the noble eightfold path in this grouped discourse.";
		}
		if (/\(tell in full|tell in full as in/i.test(text)) {
			if (/fragrant root|fragrant heartwood|fragrant flower|wheel-turning monarch|roof peak|rafters/i.test(text)) {
				return "The Buddha teaches a repeated simile showing how the noble eightfold path is foremost among skillful qualities—like a roof peak, the finest fragrance, or a wheel-turning monarch—applied across varied comparisons in this grouped discourse.";
			}
			if (/floods|yokes|grasping|ties|underlying tendencies|hindrances|aggregates|fetters/i.test(text)) {
				return "The Buddha teaches a repeated formula on floods, yokes, grasping, ties, underlying tendencies, hindrances, aggregates, and fetters, showing that the noble eightfold path should be developed for their direct knowledge, complete understanding, and giving up in this grouped discourse.";
			}
			return `The Buddha presents a repeated teaching on the noble eightfold path regarding ${title.toLowerCase()} in this grouped discourse.`;
		}
		if (/five discourses on/i.test(title)) {
			return `The Buddha teaches a repeated formula on the noble eightfold path regarding ${title.toLowerCase()}, applied across the discourses in this grouped range.`;
		}
		return `The Buddha presents a repeated teaching on the noble eightfold path regarding ${title.toLowerCase()} in this grouped discourse.`;
	}

	if (/ignorance.*forerunner|wisdom.*forerunner/i.test(text)) {
		return "The Buddha teaches that ignorance is the forerunner in the arising of unwholesome qualities and wisdom the forerunner in the arising of wholesome qualities, showing how wrong and right factors of the eightfold path arise in sequence.";
	}

	if (/good friends.*whole of the spiritual life|good friends are the whole/i.test(text)) {
		const who = /then (venerable \w+|sāriputta)/i.test(text)
			? text.match(/then (venerable \w+)/i)?.[1] ?? "a disciple"
			: "Ānanda";
		return `The Buddha teaches ${who} that good friends, companions, and associates are the whole of the spiritual life, and that a mendicant with good friends can develop and cultivate the noble eightfold path.`;
	}

	if (/teach and analyze.*noble eightfold path|what is the noble eightfold path/i.test(text)) {
		return "The Buddha teaches and analyzes the noble eightfold path—right view, purpose, speech, action, livelihood, effort, mindfulness, and immersion—explaining each factor from ethics and renunciation through the four absorptions.";
	}

	if (/spiritual path.*culmination|what is the spiritual path/i.test(text)) {
		return "The Buddha teaches that the spiritual path is the noble eightfold path and that its culmination is the ending of greed, hate, and delusion.";
	}

	if (/untrue person.*true person|what is an untrue person/i.test(text)) {
		return "The Buddha contrasts the untrue person, who has wrong view through wrong immersion, with the true person, who has right view through right immersion, defining each by the eight factors of the path.";
	}

	if (/divine vehicle|vehicle of truth|supreme victory in battle/i.test(text)) {
		return "The Buddha teaches Ānanda that the noble eightfold path is called the divine vehicle, the vehicle of truth, and the supreme victory in battle, culminating in the removal of greed, hate, and delusion.";
	}

	if (/footprints of all creatures|elephant's footprint|elephant's footprint/i.test(text)) {
		return "The Buddha teaches that all skillful qualities are rooted in diligence, like all footprints fitting inside an elephant's footprint, and that a diligent mendicant can develop the noble eightfold path.";
	}

	if (/dawn is the forerunner.*sunrise|accomplishment in ethics is the forerunner/i.test(text)) {
		const factor =
			text.match(/accomplishment in (\w+)/i)?.[1]?.toLowerCase() ?? "ethics";
		return `The Buddha teaches that accomplishment in ${factor} is the forerunner and harbinger of the arising of the noble eightfold path, as dawn precedes sunrise.`;
	}

	if (/slants, slopes, and inclines to (the east|extinguishment)/i.test(text)) {
		const river = text.match(/the (\w+) river/i)?.[1] ?? "Ganges";
		return `The Buddha teaches that just as the ${river} river slants, slopes, and inclines to the east, a mendicant who develops the noble eightfold path slants, slopes, and inclines to extinguishment.`;
	}

	if (/slants, slopes, and inclines to the ocean/i.test(text)) {
		const river = text.match(/the (\w+) river/i)?.[1] ?? "Yamunā";
		return `The Buddha teaches that just as the ${river} river slants, slopes, and inclines to the ocean, a mendicant who develops the noble eightfold path slants, slopes, and inclines to extinguishment.`;
	}

	if (/rafters.*peak|fragrant root|fragrant heartwood|fragrant flower|wheel-turning monarch/i.test(text)) {
		return "The Buddha teaches a simile showing how the noble eightfold path is foremost among skillful qualities—like rafters meeting at a roof peak or the finest fragrance—and should be developed and cultivated.";
	}

	if (/four floods|floods of sensuality|noble eightfold path should be developed for the direct knowledge/i.test(text)) {
		const topic =
			text.match(/there are these (four \w+[^.]{0,40}|five \w+[^.]{0,40})/i)?.[1]?.toLowerCase() ??
			"bonds";
		return `The Buddha teaches the ${topic} and that the noble eightfold path should be developed for their direct knowledge, complete understanding, finishing, and giving up.`;
	}

	if (/practicing part of the meditation.*first awakened|feeling conditioned by/i.test(text)) {
		return "The Buddha reports on meditation he practiced at the time of his awakening, analyzing how feeling is conditioned by wrong and right view, immersion, desire, thought, and perception until they are stilled.";
	}

	if (/develops right view.*relies on seclusion|develop and cultivate the noble eightfold path/i.test(text)) {
		return `The Buddha teaches on ${title.toLowerCase()}, showing how a mendicant develops and cultivates the noble eightfold path with factors that rely on seclusion, fading away, and cessation, ripening as letting go.`;
	}

	if (/noble eightfold path/i.test(text)) {
		return `The Buddha teaches on the noble eightfold path regarding ${title.toLowerCase()}, guiding mendicants to develop right view through right immersion on the path to liberation.`;
	}

	if (title && title.length > 2) {
		return `The Buddha teaches on the noble eightfold path regarding ${title.toLowerCase()}, guiding mendicants in the development of the path factors for liberation.`;
	}

	return "The Buddha teaches on the noble eightfold path and how its factors are developed and cultivated for the ending of suffering.";
}

export function buildSn46Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		if (/slants, slopes, and inclines to/i.test(text)) {
			return "The Buddha teaches a repeated simile of great rivers slanting, sloping, and inclining to the east or ocean, showing how a mendicant who develops the seven awakening factors likewise inclines to extinguishment, applied across each river in this grouped discourse.";
		}
		if (/\(tell in full|tell in full for each/i.test(text)) {
			return "The Buddha teaches a repeated formula on developing the seven awakening factors—mindfulness, investigation of principles, energy, rapture, tranquility, immersion, and equanimity—applied across varied topics in this grouped discourse.";
		}
		if (/higher fetters|floods|yokes|grasping|ties|underlying tendencies|hindrances|aggregates|fetters/i.test(text)) {
			return "The Buddha teaches a repeated formula on floods, yokes, grasping, ties, underlying tendencies, hindrances, aggregates, and fetters, showing that the seven awakening factors should be developed for their direct knowledge, complete understanding, and giving up in this grouped discourse.";
		}
		return `The Buddha presents a repeated teaching on the seven awakening factors regarding ${title.toLowerCase()} in this grouped discourse.`;
	}

	if (/dragons grow|himalaya|king of mountains/i.test(text)) {
		return "The Buddha presents a simile of dragons growing strong supported by the Himalayas before entering the ocean, showing how a mendicant grounded on ethics develops the seven awakening factors to acquire great and abundant good qualities.";
	}

	if (/body is sustained by food|five hindrances are sustained by fuel|seven awakening factors are sustained by fuel/i.test(text)) {
		return "The Buddha teaches that just as the body depends on food, the five hindrances and seven awakening factors depend on fuel—showing what irrational or rational application of mind fuels or starves each hindrance and awakening factor.";
	}

	if (/fuels and what starves the five hindrances and the seven awakening factors/i.test(text)) {
		return "The Buddha teaches what fuels and starves the five hindrances and the seven awakening factors, analyzing how frequent irrational or rational application of mind to their respective bases makes each arise, grow, or cease.";
	}

	if (/sluggish.*restless|mind is sluggish|mind is restless/i.test(text)) {
		return "The Buddha teaches which awakening factors to develop and avoid when the mind is sluggish or restless, using similes of kindling or extinguishing a fire, and declares that mindfulness is always useful.";
	}

	if (/seven awakening factors/i.test(text) && /develops the awakening factor/i.test(text)) {
		return "The Buddha teaches how a mendicant develops the seven awakening factors—mindfulness, investigation of principles, energy, rapture, tranquility, immersion, and equanimity—depending on and grounded on ethics, relying on seclusion, fading away, and cessation.";
	}

	if (/five hindrances/i.test(text)) {
		return `The Buddha teaches on the five hindrances and the seven awakening factors regarding ${title.toLowerCase()}, showing how hindrances are fueled and awakening factors are nourished through application of mind.`;
	}

	if (/slants, slopes, and inclines to/i.test(text)) {
		const river = text.match(/the (\w+) river/i)?.[1] ?? "Ganges";
		return `The Buddha teaches that just as the ${river} river slants, slopes, and inclines to the east, a mendicant who develops the seven awakening factors slants, slopes, and inclines to extinguishment.`;
	}

	if (/awakening factor/i.test(text)) {
		return `The Buddha teaches on the seven awakening factors regarding ${title.toLowerCase()}, guiding mendicants to develop mindfulness through equanimity for the ending of defilements.`;
	}

	if (title && title.length > 2) {
		return `The Buddha teaches on the seven awakening factors regarding ${title.toLowerCase()}, guiding mendicants in cultivating factors that lead to awakening.`;
	}

	return "The Buddha teaches on the seven awakening factors and how they are developed and cultivated for the ending of defilements.";
}

export function buildSn47Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		if (/slants, slopes, and inclines to the (east|ocean)/i.test(text)) {
			const direction = /inclines to the ocean/i.test(text) ? "the ocean" : "the east";
			return `The Buddha teaches a repeated simile of great rivers slanting, sloping, and inclining to ${direction}, showing how a mendicant who develops the four kinds of mindfulness meditation likewise inclines to extinguishment, applied across each river in this grouped discourse.`;
		}
		if (/linked discourses on mindfulness|tell in full as in the linked discourses on the path|higher fetters|floods|yokes|grasping/i.test(text)) {
			return "The Buddha teaches a repeated formula on floods, yokes, grasping, ties, underlying tendencies, hindrances, aggregates, and fetters, showing that the four kinds of mindfulness meditation should be developed for their direct knowledge, complete understanding, and giving up in this grouped discourse.";
		}
		if (/twelve discourses|six on slanting/i.test(text)) {
			return "The Buddha teaches twelve discourses pairing similes of rivers slanting to the east and to the ocean with the four kinds of mindfulness meditation, showing how their development inclines a mendicant to extinguishment.";
		}
		return `The Buddha presents a repeated teaching on the four establishments of mindfulness regarding ${title.toLowerCase()} in this grouped discourse.`;
	}

	if (/direct path.*purification|four establishments of mindfulness|four kinds of mindfulness meditation/i.test(text)) {
		return "The Buddha teaches the four establishments of mindfulness—body, feelings, mind, and principles—as the direct path for the purification of beings, the overcoming of sorrow and lamentation, and the realization of extinguishment.";
	}

	if (/live mindful and aware|situational awareness/i.test(text)) {
		return "The Buddha instructs mendicants to live mindful and aware—establishing mindfulness in the four domains and acting with situational awareness in all daily activities from going out and coming back to speaking and keeping silent.";
	}

	if (/bowl.*oil|finest lady in the land|chop off your head/i.test(text)) {
		return "The Buddha teaches a simile of a man carrying a bowl of oil brimful through a crowd while a swordsman follows, showing that mindfulness of the body must be guarded as carefully as one's life amid the distractions of the world.";
	}

	if (/sāriputta.*fully quenched|sāriputta has become fully quenched/i.test(text)) {
		return "After learning of Sāriputta's full extinguishment, the Buddha teaches that when a great disciple passes away one should not grieve but reflect on impermanence and continue practicing the four establishments of mindfulness.";
	}

	if (/meditates by observing an aspect of the body/i.test(text)) {
		return `The Buddha teaches on the four establishments of mindfulness regarding ${title.toLowerCase()}, urging mendicants to meditate keen, aware, and mindful on body, feelings, mind, and principles, rid of covetousness and displeasure.`;
	}

	if (/slants, slopes, and inclines to/i.test(text)) {
		const river = text.match(/the (\w+) river/i)?.[1] ?? "Ganges";
		return `The Buddha teaches that just as the ${river} river slants, slopes, and inclines to the east, a mendicant who develops the four kinds of mindfulness meditation slants, slopes, and inclines to extinguishment.`;
	}

	if (/four kinds of mindfulness|mindfulness meditation should be developed/i.test(text)) {
		const topic =
			text.match(/there are these (five \w+[^.]{0,50}|four \w+[^.]{0,50})/i)?.[1]?.toLowerCase() ??
			"bonds";
		return `The Buddha teaches the ${topic} and that the four kinds of mindfulness meditation should be developed for their direct knowledge, complete understanding, finishing, and giving up.`;
	}

	if (/mindful|mindfulness/i.test(text)) {
		return `The Buddha teaches on the four establishments of mindfulness regarding ${title.toLowerCase()}, guiding mendicants to develop continuous mindfulness for insight and liberation.`;
	}

	if (title && title.length > 2) {
		return `The Buddha teaches on the four establishments of mindfulness regarding ${title.toLowerCase()}, guiding mendicants in the direct path to realization of extinguishment.`;
	}

	return "The Buddha teaches on the four establishments of mindfulness and how they are developed as the direct path to liberation.";
}

export function inferSn45Themes(text) {
	const themes = inferThemes(text);
	if (/good friends|develop and cultivate|should train|meditat/i.test(text)) {
		return themes.includes("training guideline")
			? themes.slice(0, 2)
			: ["training guideline", themes[0] ?? "principle"];
	}
	if (!themes.includes("principle")) return ["principle", themes[0] ?? "training guideline"].slice(0, 2);
	return themes.slice(0, 2);
}

export function inferSn46Themes(text) {
	const themes = inferThemes(text);
	if (/develop|cultivate|fuels|starves|sluggish|restless/i.test(text)) {
		return themes.includes("training guideline")
			? themes.slice(0, 2)
			: ["training guideline", themes[0] ?? "principle"];
	}
	if (!themes.includes("principle")) return ["principle", themes[0] ?? "training guideline"].slice(0, 2);
	return themes.slice(0, 2);
}

export function inferSn47Themes(text) {
	const themes = inferThemes(text);
	if (/direct path|meditates by observing|mindful and aware|should train/i.test(text)) {
		return themes.includes("training guideline")
			? ["training guideline", themes.includes("wisdom") ? "wisdom" : themes[0] ?? "principle"].slice(0, 2)
			: ["training guideline", "wisdom"];
	}
	return themes.includes("wisdom") ? themes.slice(0, 2) : ["wisdom", themes[0] ?? "training guideline"].slice(0, 2);
}

export function buildSn37Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (/five kinds of suffering that particularly apply to ladies/i.test(text)) {
		return "The Buddha teaches five kinds of suffering that particularly apply to ladies—leaving relatives for a husband's family, menstruation, pregnancy, childbirth, and serving a man—undergone by women and not by men.";
	}

	if (/three qualities.*ladies|ladies.*three qualities/i.test(text)) {
		return "The Buddha teaches three qualities of ladies—being irritable, jealous, and stingy—and how these make a woman disagreeable to her husband and family.";
	}

	if (/extremely undesirable to a (man|lady)|extremely desirable to a (man|lady)/i.test(text)) {
		const target = /undesirable to a man|desirable to a man/i.test(text) ? "a man" : "a lady";
		return `The Buddha teaches five qualities that make a woman extremely desirable or undesirable to ${target}—attractiveness, wealth, ethical behavior, skill and energy, and bearing children.`;
	}

	if (/anuruddha.*clairvoyance|with my clairvoyance/i.test(text)) {
		if (/place of loss|underworld, hell/i.test(text)) {
			const qualities =
				text.match(/they're (\w+(?:, \w+){2,4})/i)?.[1]?.toLowerCase() ??
				"unwholesome qualities";
			return `Answering Venerable Anuruddha, the Buddha teaches five qualities of ladies—${qualities}—that lead to rebirth in a place of loss after death.`;
		}
		if (/good place, a heavenly realm|heavenly realm/i.test(text)) {
			const qualities =
				text.match(/they're (\w+(?:, \w+){2,4})/i)?.[1]?.toLowerCase() ??
				"wholesome qualities";
			return `Answering Venerable Anuruddha, the Buddha teaches five qualities of ladies—${qualities}—that lead to rebirth in a heavenly realm after death.`;
		}
	}

	if (/kill living creatures|five precepts|don't kill living creatures/i.test(text)) {
		if (/don't kill|do not kill/i.test(text)) {
			return "Answering Venerable Anuruddha, the Buddha teaches that ladies who observe the five precepts—not killing, stealing, sexual misconduct, lying, or consuming intoxicants—are reborn in a heavenly realm after death.";
		}
		return "Answering Venerable Anuruddha, the Buddha teaches that ladies who break the five precepts—killing, stealing, sexual misconduct, lying, and consuming intoxicants—are reborn in hell after death.";
	}

	if (/five powers of a lady|powers of a lady/i.test(text)) {
		if (/under her thumb/i.test(text)) {
			return "The Buddha teaches the five powers of a lady—attractiveness, wealth, relatives, children, and ethical behavior—and how a lady with all five has her husband under her thumb.";
		}
		if (/send her away|won't accommodate her/i.test(text)) {
			return "The Buddha teaches the five powers of a lady and shows that without ethical behavior a family sends her away, while ethical behavior alone ensures she is accommodated regardless of other powers.";
		}
		if (/not because of the powers of attractiveness/i.test(text)) {
			return "The Buddha teaches the five powers of a lady and declares that heavenly rebirth comes from the power of ethical behavior, not from attractiveness, wealth, relatives, or children.";
		}
		if (/female noble disciple who grows/i.test(text)) {
			return "The Buddha teaches that a female noble disciple who grows in faith, ethics, learning, generosity, and wisdom grows nobly, taking on what is essential and excellent in this life.";
		}
		if (/living with self-assurance|self-assurance/i.test(text)) {
			return "The Buddha teaches the five powers of a lady and how a female noble disciple who possesses them lives at home with self-assurance, like a head-anointed king on his throne.";
		}
		if (/mastered by her|she is mastered/i.test(text)) {
			return "The Buddha teaches the five powers of a lady and contrasts a lady mastered by her husband with one who has mastered her husband through those powers.";
		}
		return "The Buddha teaches the five powers of a lady—attractiveness, wealth, relatives, children, and ethical behavior—and their role in household life and spiritual destiny.";
	}

	if (/faithless|unethical|unlearned|lazy|unmindful/i.test(text) && /ladies/i.test(text)) {
		return `The Buddha teaches on ${title.toLowerCase()} as one of five qualities that lead ladies to unfortunate rebirth when their body breaks up after death.`;
	}

	if (/faithful|ethical|learned|energetic|mindful|loving|wise/i.test(text) && /ladies/i.test(text)) {
		return `The Buddha teaches on ${title.toLowerCase()} as one of five wholesome qualities that lead ladies to a heavenly rebirth when their body breaks up after death.`;
	}

	if (title && title.length > 2) {
		return `The Buddha teaches on ${title.toLowerCase()} regarding the qualities and circumstances of women in household life.`;
	}

	return "The Buddha teaches on the qualities, powers, and circumstances of women and how ethical conduct and wisdom shape their lives and rebirths.";
}

export function buildSn44Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (/kept silent|the buddha kept silent/i.test(text)) {
		return "When the wanderer Vacchagotta asks whether the self survives, does not survive, both, or neither, the Buddha keeps silent—showing that such questions do not lead to the ending of suffering.";
	}

	if (/not been declared by the buddha|has not been declared/i.test(text)) {
		const who =
			text.match(/(?:nun|venerable|king) (\w+)/i)?.[1] ??
			(text.match(/wanderer (\w+)/i)?.[1] ? `the wanderer ${text.match(/wanderer (\w+)/i)[1]}` : null) ??
			(text.match(/king pasenadi/i) ? "King Pasenadi" : "a questioner");
		if (/realized one still exist|after death/i.test(text)) {
			return `${who === "King Pasenadi" ? "King Pasenadi asks the nun Khemā" : "A questioner asks"} whether a realized one still exists, no longer exists, both, or neither after death; the Buddha has not declared any of these four positions as they do not lead to liberation.`;
		}
		return `The Buddha explains why certain speculative questions about the undeclared points have not been declared by him, as they do not lead to the ending of suffering.`;
	}

	if (/what's the cause.*not been declared|what is the cause.*not been declared/i.test(text)) {
		return "Venerable Sāriputta and Venerable Mahākoṭṭhita discuss why the Buddha has not declared the status of a realized one after death, showing that as long as greed, desire, and craving for the aggregates remain, such questions cannot be answered.";
	}

	if (/does not apply to the perfected one|does not apply to the extinguished/i.test(text)) {
		return "The Buddha teaches that the undeclared points—whether the world is eternal, finite, and the status of a realized one after death—do not apply to the perfected one who has ended the defilements.";
	}

	if (/rebirth.*fuel|declare rebirth for one with fuel|craving is its fuel/i.test(text)) {
		return "The wanderer Vacchagotta asks why the Buddha declares rebirth for some disciples but not for perfected ones; the Buddha teaches rebirth for one with fuel—using similes of fire and wind—and declares craving as fuel for one between lives.";
	}

	if (/describing a realized one.*other than these four ways|describe them other than these four/i.test(text)) {
		return "When wanderers claim a realized one after death must exist, not exist, both, or neither, Venerable Anurādha refutes all four and is rebuked until the Buddha confirms that a realized one cannot be described in any of these ways.";
	}

	if (/does the self survive|does a self survive/i.test(text)) {
		return "The wanderer Vacchagotta asks the Buddha whether the self survives after death; the Buddha keeps silent, and later explains to Ānanda that answering either way would entangle Vacchagotta in the self-view.";
	}

	if (/world is eternal|world is infinite|after death.*tathāgata/i.test(text)) {
		return `The Buddha teaches why speculative views—such as whether the world is eternal or infinite, or the status of a realized one after death—are among the undeclared points that do not lead to liberation.`;
	}

	if (title && title.length > 2) {
		return `The Buddha teaches on the undeclared points regarding ${title.toLowerCase()}, explaining why certain speculative questions are set aside as not leading to the ending of suffering.`;
	}

	return "The Buddha teaches on the undeclared points—speculative questions about the self, the world, and a realized one after death—and why they are not answered as they do not lead to liberation.";
}

export function buildSn48Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		if (/slants, slopes, and inclines to the (east|ocean)/i.test(text)) {
			const direction = /inclines to the ocean/i.test(text) ? "the ocean" : "the east";
			return `The Buddha teaches a repeated simile of great rivers slanting, sloping, and inclining to ${direction}, showing how a mendicant who develops the five faculties likewise inclines to extinguishment, applied across each river in this grouped discourse.`;
		}
		if (/\(tell in full|tell in full as in/i.test(text)) {
			if (/searches|discriminations|defilements|barrenness|stains/i.test(text)) {
				return "The Buddha teaches a repeated formula on searches, discriminations, defilements, states of existence, suffering, barrenness, stains, troubles, feelings, craving, and thirst, showing that the five faculties should be developed for their direct knowledge and giving up in this grouped discourse.";
			}
			if (/floods|yokes|grasping|ties|underlying tendencies|hindrances|aggregates|fetters/i.test(text)) {
				return "The Buddha teaches a repeated formula on floods, yokes, grasping, ties, underlying tendencies, hindrances, aggregates, and fetters, showing that the five faculties should be developed for their direct knowledge, complete understanding, and giving up in this grouped discourse.";
			}
			return `The Buddha presents a repeated teaching on the five faculties regarding ${title.toLowerCase()} in this grouped discourse.`;
		}
		return `The Buddha presents a repeated teaching on the five spiritual faculties regarding ${title.toLowerCase()} in this grouped discourse.`;
	}

	if (/plain version|there are these five faculties/i.test(text) && text.length < 400) {
		return "The Buddha teaches the five spiritual faculties—faith, energy, mindfulness, immersion, and wisdom—as the basis for progress on the path to liberation.";
	}

	if (/stream-enterer|once-returner|non-returner|perfected one|follower by faith|follower of teachings/i.test(text)) {
		if (/disparity of faculties|disparity of fruits|disparity of individuals/i.test(text)) {
			return "The Buddha teaches that from a disparity of faculties comes a disparity of fruits and individuals—from stream-enterer through once-returner and non-returner to perfected one, or follower by faith and follower of teachings.";
		}
		if (/practicing to realize the fruit|totally and utterly lacks/i.test(text)) {
			return "The Buddha teaches the five faculties and how those who have completed them are perfected ones, while weaker development corresponds to stream-enterers, once-returners, non-returners, and those still practicing for each fruit.";
		}
		if (/gratification, drawback, and escape/i.test(text)) {
			return "The Buddha teaches the five faculties and declares that a noble disciple who truly understands their gratification, drawback, and escape is a stream-enterer, assured and destined for awakening.";
		}
	}

	if (/undefiled freedom of heart|ending of defilements/i.test(text)) {
		return "The Buddha teaches that by developing and cultivating the five faculties a mendicant realizes the undefiled freedom of heart and freedom by wisdom in this very life, living with insight due to the ending of defilements.";
	}

	if (/faculty of faith|faculty of energy|faculty of mindfulness|faculty of collectedness|faculty of wisdom/i.test(text)) {
		return "The Buddha analyzes the five spiritual faculties—defining faith as conviction in the Buddha's awakening, energy as the four right efforts, mindfulness as the four establishments of mindfulness, immersion as the four absorptions, and wisdom as discerning the four noble truths.";
	}

	if (/slants, slopes, and inclines to/i.test(text)) {
		const river = text.match(/the (\w+) river/i)?.[1] ?? "Ganges";
		return `The Buddha teaches that just as the ${river} river slants, slopes, and inclines to the east, a mendicant who develops the five faculties slants, slopes, and inclines to extinguishment.`;
	}

	if (/five faculties should be developed|faculties should be developed/i.test(text)) {
		const topic =
			text.match(/there are these (five \w+[^.]{0,50}|four \w+[^.]{0,50})/i)?.[1]?.toLowerCase() ??
			"bonds";
		return `The Buddha teaches the ${topic} and that the five faculties should be developed for their direct knowledge, complete understanding, finishing, and giving up.`;
	}

	if (/develops the faculty|develop and cultivate the five faculties/i.test(text)) {
		return `The Buddha teaches on the five spiritual faculties regarding ${title.toLowerCase()}, guiding mendicants to develop faith, energy, mindfulness, immersion, and wisdom for liberation.`;
	}

	if (title && title.length > 2) {
		return `The Buddha teaches on the five spiritual faculties regarding ${title.toLowerCase()}, guiding mendicants in developing faith through wisdom on the path to liberation.`;
	}

	return "The Buddha teaches on the five spiritual faculties and how they are developed and cultivated for the ending of defilements.";
}

export function buildSn49Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		if (/slants, slopes, and inclines to the (east|ocean)/i.test(text)) {
			const direction = /inclines to the ocean/i.test(text) ? "the ocean" : "the east";
			return `The Buddha teaches a repeated simile of great rivers slanting, sloping, and inclining to ${direction}, showing how a mendicant who develops the four right efforts likewise inclines to extinguishment, applied across each river in this grouped discourse.`;
		}
		if (/\(tell in full|tell in full as in/i.test(text)) {
			if (/footprint|roof peak|fragrant|wheel-turning monarch|realized one/i.test(text)) {
				return "The Buddha teaches a repeated simile showing how the four right efforts are foremost among skillful qualities—like a footprint, roof peak, finest fragrance, or wheel-turning monarch—applied across varied comparisons in this grouped discourse.";
			}
			if (/hard work|seeds|dragons|atmosphere|clouds|ship|guest house/i.test(text)) {
				return "The Buddha teaches a repeated simile chapter on hard work, seeds, dragons, trees, pots, spikes, atmosphere, clouds, ships, guest houses, and rivers, showing how the four right efforts are grounded on ethics in this grouped discourse.";
			}
			if (/floods|yokes|grasping|ties|underlying tendencies|hindrances|aggregates|fetters/i.test(text)) {
				return "The Buddha teaches a repeated formula on floods, yokes, grasping, ties, underlying tendencies, hindrances, aggregates, and fetters, showing that the four right efforts should be developed for their direct knowledge, complete understanding, and giving up in this grouped discourse.";
			}
			return `The Buddha presents a repeated teaching on the four right efforts regarding ${title.toLowerCase()} in this grouped discourse.`;
		}
		if (/ten discourses on|discourses on searches/i.test(text)) {
			return "The Buddha teaches a repeated formula on searches, discriminations, defilements, states of existence, suffering, barrenness, stains, troubles, feelings, craving, and thirst, showing that the four right efforts should be developed for their direct knowledge and giving up in this grouped discourse.";
		}
		return `The Buddha presents a repeated teaching on the four right efforts regarding ${title.toLowerCase()} in this grouped discourse.`;
	}

	if (/four right efforts/i.test(text) && /slants, slopes, and inclines/i.test(text)) {
		const river = text.match(/the (\w+) river/i)?.[1] ?? "Ganges";
		return `The Buddha teaches that just as the ${river} river slants, slopes, and inclines to the east, a mendicant who develops the four right efforts slants, slopes, and inclines to extinguishment.`;
	}

	if (/hard work that gets done depends on the earth|grounded on ethics/i.test(text)) {
		return "The Buddha teaches that just as all hard work depends on the earth, a mendicant develops the four right efforts depending on and grounded on ethics—preventing unarisen unwholesome states, abandoning arisen ones, arousing unarisen wholesome states, and maintaining arisen ones.";
	}

	if (/four right efforts should be developed|right efforts should be developed/i.test(text)) {
		const topic =
			text.match(/there are these (three \w+[^.]{0,50}|four \w+[^.]{0,50}|five \w+[^.]{0,50})/i)?.[1]?.toLowerCase() ??
			"bonds";
		return `The Buddha teaches the ${topic} and that the four right efforts should be developed for their direct knowledge, complete understanding, finishing, and giving up.`;
	}

	if (/generate enthusiasm, try, make an effort/i.test(text)) {
		return `The Buddha teaches on the four right efforts regarding ${title.toLowerCase()}, guiding mendicants to prevent unarisen unwholesome qualities, abandon arisen ones, arouse unarisen wholesome qualities, and maintain those that have arisen.`;
	}

	if (title && title.length > 2) {
		return `The Buddha teaches on the four right efforts regarding ${title.toLowerCase()}, guiding mendicants in energetic cultivation of wholesome states for liberation.`;
	}

	return "The Buddha teaches on the four right efforts and how they are developed and cultivated for the ending of defilements.";
}

export function buildSn50Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		if (/slants, slopes, and inclines to the (east|ocean)/i.test(text)) {
			const direction = /inclines to the ocean/i.test(text) ? "the ocean" : "the east";
			return `The Buddha teaches a repeated simile of great rivers slanting, sloping, and inclining to ${direction}, showing how a mendicant who develops the five powers likewise inclines to extinguishment, applied across each river in this grouped discourse.`;
		}
		if (/\(tell in full|tell in full as in/i.test(text)) {
			if (/footprint|roof peak|fragrant|wheel-turning monarch|realized one/i.test(text)) {
				return "The Buddha teaches a repeated simile showing how the five powers are foremost among skillful qualities—like a footprint, roof peak, finest fragrance, or wheel-turning monarch—applied across varied comparisons in this grouped discourse.";
			}
			if (/hard work|seeds|dragons|atmosphere|clouds|ship|guest house/i.test(text)) {
				return "The Buddha teaches a repeated simile chapter on hard work, seeds, dragons, trees, pots, spikes, atmosphere, clouds, ships, guest houses, and rivers, showing how the five powers are grounded on ethics in this grouped discourse.";
			}
			if (/floods|yokes|grasping|ties|underlying tendencies|hindrances|aggregates|fetters/i.test(text)) {
				return "The Buddha teaches a repeated formula on floods, yokes, grasping, ties, underlying tendencies, hindrances, aggregates, and fetters, showing that the five powers should be developed for their direct knowledge, complete understanding, and giving up in this grouped discourse.";
			}
			return `The Buddha presents a repeated teaching on the five powers regarding ${title.toLowerCase()} in this grouped discourse.`;
		}
		if (/ten discourses on|discourses on searches/i.test(text)) {
			return "The Buddha teaches a repeated formula on searches, discriminations, defilements, states of existence, suffering, barrenness, stains, troubles, feelings, craving, and thirst, showing that the five powers should be developed for their direct knowledge and giving up in this grouped discourse.";
		}
		return `The Buddha presents a repeated teaching on the five powers regarding ${title.toLowerCase()} in this grouped discourse.`;
	}

	if (/five powers/i.test(text) && /slants, slopes, and inclines/i.test(text)) {
		const river = text.match(/the (\w+) river/i)?.[1] ?? "Ganges";
		return `The Buddha teaches that just as the ${river} river slants, slopes, and inclines to the east, a mendicant who develops the five powers slants, slopes, and inclines to extinguishment.`;
	}

	if (/five powers should be developed|powers should be developed/i.test(text)) {
		const topic =
			text.match(/there are these (three \w+[^.]{0,50}|four \w+[^.]{0,50}|five \w+[^.]{0,50})/i)?.[1]?.toLowerCase() ??
			"bonds";
		return `The Buddha teaches the ${topic} and that the five powers should be developed for their direct knowledge, complete understanding, finishing, and giving up.`;
	}

	if (/develops the power|develop and cultivate the five powers|powers of faith/i.test(text)) {
		return `The Buddha teaches on the five powers—faith, energy, mindfulness, immersion, and wisdom—regarding ${title.toLowerCase()}, guiding mendicants to develop them relying on seclusion, fading away, and cessation.`;
	}

	if (title && title.length > 2) {
		return `The Buddha teaches on the five powers regarding ${title.toLowerCase()}, guiding mendicants in developing faith through wisdom as unshakeable supports for liberation.`;
	}

	return "The Buddha teaches on the five powers—faith, energy, mindfulness, immersion, and wisdom—and how they are developed and cultivated for the ending of defilements.";
}

export function inferSn37Themes(text) {
	const themes = inferThemes(text);
	if (/ethical|faith|generosity|wisdom|precepts/i.test(text)) {
		return themes.includes("cultivating discernment")
			? themes.slice(0, 2)
			: ["cultivating discernment", themes[0] ?? "wisdom"];
	}
	return themes.includes("wisdom") ? themes.slice(0, 2) : ["wisdom", themes[0] ?? "cultivating discernment"].slice(0, 2);
}

export function inferSn44Themes(text) {
	const themes = inferThemes(text);
	if (/not been declared|kept silent|undeclared|speculative/i.test(text)) {
		return themes.includes("cultivating discernment")
			? ["wisdom", "cultivating discernment"]
			: ["wisdom", themes.includes("inquisitiveness") ? "inquisitiveness" : "cultivating discernment"];
	}
	return themes.includes("wisdom") ? themes.slice(0, 2) : ["wisdom", themes[0] ?? "principle"].slice(0, 2);
}

export function inferSn48Themes(text) {
	const themes = inferThemes(text);
	if (/develop|cultivate|facult|stream-enterer|perfected one/i.test(text)) {
		return themes.includes("training guideline")
			? themes.slice(0, 2)
			: ["principle", themes[0] ?? "training guideline"].slice(0, 2);
	}
	return themes.includes("principle") ? themes.slice(0, 2) : ["principle", themes[0] ?? "training guideline"].slice(0, 2);
}

export function inferSn49Themes(text) {
	const themes = inferThemes(text);
	if (/develop|cultivate|right effort|generate enthusiasm/i.test(text)) {
		return themes.includes("training guideline")
			? themes.slice(0, 2)
			: ["training guideline", themes[0] ?? "principle"].slice(0, 2);
	}
	return themes.includes("principle") ? themes.slice(0, 2) : ["training guideline", themes[0] ?? "principle"].slice(0, 2);
}

export function inferSn50Themes(text) {
	const themes = inferThemes(text);
	if (/develop|cultivate|five powers|powers of faith/i.test(text)) {
		return themes.includes("training guideline")
			? themes.slice(0, 2)
			: ["principle", themes[0] ?? "training guideline"].slice(0, 2);
	}
	return themes.includes("principle") ? themes.slice(0, 2) : ["principle", themes[0] ?? "training guideline"].slice(0, 2);
}

export function buildSn11Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (/undertook seven vows|what seven\?/i.test(text) && /support my parents|speak gently/i.test(text)) {
		return "The Buddha teaches that in a former life Sakka achieved lordship among the gods by undertaking seven vows—supporting parents, honoring elders, speaking gently, avoiding backbiting, practicing generosity, speaking truth, and quickly abandoning anger.";
	}

	if (/victory by fine words|victory by good speech/i.test(text)) {
		return "The Buddha recounts how Sakka, lord of gods, defeated Vepacitti, lord of titans, in a contest of verses judged by gods and titans, showing that patience and mindfulness overcome anger and punishment.";
	}

	if (/initiative and energy|try hard|strive|make an effort to attain the unattained/i.test(text)) {
		return "The Buddha recounts Sakka urging the negligent godling Suvīra into battle, showing through verse that happiness without effort is impossible and praising initiative and energy for mendicants on the path.";
	}

	if (/homage|revered the mendicant|worship you|envy those who are homeless/i.test(text)) {
		return `The Buddha recounts Sakka, lord of gods, paying homage to the Saṅgha and explaining in verse why he honors homeless mendicants over worldly power, as told in ${title.toLowerCase()}.`;
	}

	if (/rise, hero|victor in battle|fully liberated/i.test(text)) {
		return "The Buddha recounts how Sakka and the divinity Sahampati approached the Buddha in retreat and Sakka spoke verses in praise of the Realized One's victory and liberation.";
	}

	if (/don't let anger be your master|don't get angry at angry people/i.test(text)) {
		return "The Buddha recounts verses spoken by Sakka to the gods of the thirty-three, urging them not to be mastered by anger and to practice kindness and harmlessness like noble ones.";
	}

	if (/have you seen sakka|I understand sakka/i.test(text)) {
		return "The Buddha explains to Mahāli the Licchavi how Sakka achieved his status as lord of gods through past merit, ethical conduct, and vows—not by birth or appearance alone.";
	}

	if (/speak this verse|addressed.* in verse|spoke this verse/i.test(text) && /sakka/i.test(text)) {
		return `The Buddha recounts Sakka, lord of gods, speaking verses on ${title.toLowerCase()}, illustrating how even celestial rulers apply the Dhamma to conflict, conduct, and devotion.`;
	}

	if (/battle.*gods and.*titans|titans march against the gods/i.test(text)) {
		return `The Buddha recounts a battle between gods and titans involving Sakka, using the story of ${title.toLowerCase()} to teach mendicants about ethics, speech, or effort on the path.`;
	}

	if (/once upon a time.*sakka|sakka, lord of gods/i.test(text)) {
		return `The Buddha recounts an encounter involving Sakka, lord of gods, regarding ${title.toLowerCase()}, illustrating how the Dhamma applies to leadership, conflict, and devotion among the gods.`;
	}

	if (title && title.length > 2) {
		return `The Buddha teaches on ${title.toLowerCase()} in the Connected Discourses with Sakka, recounting how the lord of gods embodies or learns the Dhamma.`;
	}

	return "The Buddha recounts a teaching involving Sakka, lord of gods, showing how the Dhamma guides even celestial rulers toward ethical conduct and liberation.";
}

export function buildSn19Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug === "sn19.1" || /tell all these discourses in full/i.test(text)) {
		return "The Buddha confirms Venerable Mahāmoggallāna's clairvoyant vision of a skeleton spirit tormented by vultures and crows, explaining that the being was formerly a cattle butcher in Rājagaha and now experiences the residual result of that deed.";
	}

	const pastDeed = text.match(/That being used to be (?:a )?([^.]{5,80}?)(?: right here| in Rājagaha|\.\.\.)/i)?.[1];
	const deedPhrase = pastDeed
		? `, formerly a ${pastDeed.trim().replace(/\.$/, "").toLowerCase()} in Rājagaha`
		: " for past unethical conduct in Rājagaha";

	const visionMatch =
		text.match(/I saw (?:a )?(.{8,100}?)(?: flying through the air| as he| as she)/i) ??
		text.match(/I saw (?:a )?(.{8,80}?)\./i);

	if (visionMatch || /Just now, reverend|descending from Vulture/i.test(text)) {
		let vision = visionMatch
			? visionMatch[1].replace(/\s+/g, " ").trim().replace(/\.$/, "").toLowerCase()
			: title.toLowerCase();
		if (/^(a |an )/.test(vision)) {
			vision = vision.replace(/^(a |an )/, "");
		}
		const visionPhrase = /^[aeiou]/.test(vision) ? `an ${vision}` : `a ${vision}`;
		return `The Buddha confirms Venerable Mahāmoggallāna's clairvoyant vision of ${visionPhrase} suffering in a ghostly incarnation${deedPhrase}, illustrating the inescapable results of unwholesome kamma.`;
	}

	if (/clairvoyant|smiled at a certain spot|live full of vision and knowledge/i.test(text)) {
		return `The Buddha confirms Mahāmoggallāna's vision of a suffering spirit appearing as ${title.toLowerCase()}, teaching the mendicants that such beings experience the residual results of past unwholesome deeds.`;
	}

	if (title && title.length > 2) {
		return `The Buddha confirms Venerable Mahāmoggallāna's clairvoyant vision of a spirit appearing as ${title.toLowerCase()}, tormented for past unethical conduct and illustrating the severe results of kamma.`;
	}

	return "The Buddha confirms Venerable Mahāmoggallāna's clairvoyant vision of a suffering spirit, teaching the mendicants about the inescapable results of past unwholesome deeds.";
}

export function buildSn36Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (/two feelings.*three feelings|three feelings.*five feelings|thirty-six.*hundred and eight feelings/i.test(text)) {
		return "The Buddha explains that he has taught feelings in many ways—two, three, five, six, eighteen, thirty-six, or a hundred and eight—and that those who accept the well-spoken teaching live in harmony rather than dispute.";
	}

	if (/vision, knowledge, wisdom.*regarding teachings not learned before/i.test(text)) {
		return "The Buddha describes the vision, knowledge, and wisdom that arose at his awakening regarding feelings—their nature, origin, cessation, gratification, drawback, and escape—as teachings not learned from another.";
	}

	if (/infirmary|end of the body draw close|end of life draw close|oil lamp depended on oil/i.test(text)) {
		return "The Buddha teaches mendicants in the infirmary to await death mindful and aware, contemplating pleasant, painful, and neutral feelings as impermanent and dependent on the body until all feeling becomes cool at life's end.";
	}

	if (/underlying tendency to greed|underlying tendency to aversion|underlying tendency to ignorance/i.test(text)) {
		return "The Buddha teaches the three feelings—pleasant, painful, and neutral—and how the underlying tendencies to greed, aversion, and ignorance respectively should be given up through understanding feelings and seeing the escape.";
	}

	if (/guest house|lodgers come from the east/i.test(text)) {
		return "The Buddha teaches that just as a guest house receives travelers from all directions, the body receives pleasant, painful, and neutral feelings—both of the flesh and not of the flesh.";
	}

	if (/rooted in contact|dependent on a contact to be felt/i.test(text)) {
		return "The Buddha teaches that the three feelings—pleasant, painful, and neutral—are produced by contact, rooted in contact, and cease when the contact that gives rise to them ceases.";
	}

	if (/suffering includes whatever is felt|whatever is felt/i.test(text) && /three feelings/i.test(text)) {
		return "The Buddha resolves a mendicant's question about how all feeling can be included in suffering, explaining that even pleasant and neutral feelings are impermanent, dependently arisen, and subject to change and destruction.";
	}

	if (/gratification.*drawback.*escape|origin of feeling.*cessation of feeling/i.test(text)) {
		return `The Buddha teaches on feelings regarding ${title.toLowerCase()}, analyzing their origin, cessation, gratification, drawback, and escape for insight and release from clinging.`;
	}

	if (/three feelings|pleasant, painful, and neutral feeling/i.test(text)) {
		if (/cause of feelings|path that leads to their ending|hungerless, quenched/i.test(text)) {
			return "The Buddha describes the three feelings—pleasant, painful, and neutral—and teaches that a mindful disciple understands feelings, their origin, cessation, and the path leading to their ending until they are hungerless and quenched.";
		}
		if (/not of the flesh|of the flesh/i.test(text)) {
			return "The Buddha teaches the three feelings—pleasant, painful, and neutral—distinguishing feelings of the flesh from those not of the flesh for insight into their conditioned nature.";
		}
		return "The Buddha describes the three feelings—pleasant, painful, and neutral—and teaches how understanding their conditioned nature leads to disenchantment and the ending of suffering.";
	}

	if (/ascetics and brahmins/i.test(text)) {
		return "The Buddha contrasts ascetics and brahmins who fail to understand feelings—their origin, cessation, and the practice leading to cessation—with those who truly know and see them.";
	}

	if (title && title.length > 2) {
		return `The Buddha teaches on feelings regarding ${title.toLowerCase()}, analyzing pleasant, painful, and neutral feeling for insight, disenchantment, and release from suffering.`;
	}

	return "The Buddha teaches on the three feelings—pleasant, painful, and neutral—and how rightly understanding them leads to liberation from suffering.";
}

export function inferSn11Themes(text) {
	const themes = inferThemes(text);
	if (/homage|revered|faith|generous|charity/i.test(text)) {
		return themes.includes("recollection of the Buddha")
			? themes.slice(0, 2)
			: ["inspiration", "recollection of the Buddha"];
	}
	if (/initiative|energy|strive|try hard|effort|negligence|lazy/i.test(text)) {
		return themes.includes("training guideline")
			? themes.slice(0, 2)
			: ["training guideline", "inspiration"];
	}
	if (/patience|anger|verse|fine words|mindful and stay calm/i.test(text)) {
		return themes.includes("cultivating discernment")
			? themes.slice(0, 2)
			: ["wisdom", "cultivating discernment"];
	}
	return themes.includes("story") ? themes.slice(0, 2) : ["story", themes[0] ?? "inspiration"].slice(0, 2);
}

export function inferSn19Themes(text) {
	const themes = inferThemes(text);
	if (/kamma|deed|butcher|unwholesome|ethical/i.test(text)) {
		return themes.includes("urgency")
			? themes.slice(0, 2)
			: ["urgency", "wisdom"];
	}
	return themes.includes("story") ? themes.slice(0, 2) : ["story", themes[0] ?? "urgency"].slice(0, 2);
}

export function inferSn36Themes(text) {
	const themes = inferThemes(text);
	if (/meditat|infirmary|should develop|mindful and aware|await their time/i.test(text)) {
		return themes.includes("training guideline")
			? themes.slice(0, 2)
			: ["wisdom", "training guideline"];
	}
	if (/on the one hand|distinction|disparity|difference between|two darts/i.test(text)) {
		return themes.includes("cultivating discernment")
			? themes.slice(0, 2)
			: ["cultivating discernment", "wisdom"];
	}
	if (/question|what was the buddha referring|in private retreat/i.test(text)) {
		return themes.includes("inquisitiveness")
			? themes.slice(0, 2)
			: ["wisdom", "inquisitiveness"];
	}
	return themes.includes("wisdom") ? themes.slice(0, 2) : ["wisdom", themes[0] ?? "principle"].slice(0, 2);
}

export function buildSn23Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		if (/give up any desire, any greed.*māra/i.test(text)) {
			return "The Buddha teaches Venerable Rādha a repeated brief formula on giving up desire and greed for Māra, impermanent, suffering, not-self, and related qualities across the five aggregates in this grouped discourse.";
		}
		return `The Buddha teaches Venerable Rādha a repeated formula on the five aggregates regarding ${title.toLowerCase()} in this grouped discourse.`;
	}

	if (/how is māra defined|when there is form, rādha, there would be māra/i.test(text)) {
		return "Venerable Rādha asks how Māra is defined; the Buddha teaches that where there are the five aggregates there is Māra, and that seeing them rightly leads through disillusionment and dispassion to freedom and extinguishment.";
	}

	if (/sentient being|being is spoken of/i.test(text) && /sandcastle/i.test(text)) {
		return "Venerable Rādha asks how a sentient being is defined; the Buddha teaches that clinging to desire and craving in the five aggregates makes a being, using the simile of children playing with sandcastles until craving is worn away.";
	}

	if (/leash to existence|cessation of the leash/i.test(text)) {
		return "Venerable Rādha asks about the leash to existence and its cessation; the Buddha teaches that desire, craving, grasping, and underlying tendencies toward the five aggregates are the leash, and their cessation is the cessation of the leash.";
	}

	if (/things that should be completely understood|complete understanding/i.test(text)) {
		return "The Buddha teaches Venerable Rādha the five aggregates that should be completely understood, what complete understanding is, and the individual who has completely understood them for liberation.";
	}

	if (/ascetics and brahmins who don'?t truly understand|gratification, drawback, and escape/i.test(text)) {
		return "The Buddha teaches Venerable Rādha that only ascetics and brahmins who truly understand the five grasping aggregates' gratification, drawback, and escape realize the goal of the spiritual life.";
	}

	if (/stream-enterer|destined for awakening/i.test(text) && /grasping aggregates/i.test(text)) {
		return "The Buddha teaches Venerable Rādha that a noble disciple who truly understands the five grasping aggregates' origin, disappearance, gratification, drawback, and escape is a stream-enterer assured of awakening.";
	}

	if (/perfected one|ended the defilements|ended the fetters/i.test(text) && /grasping aggregates/i.test(text)) {
		return "The Buddha teaches Venerable Rādha that a mendicant who has ended the defilements by truly understanding the five grasping aggregates is a perfected one with defilements ended.";
	}

	if (/give up any desire, any greed/i.test(text)) {
		const topic =
			text.match(/for whatever is ([^.]{5,50})/i)?.[1]?.replace(/\.$/, "").toLowerCase() ??
			title.toLowerCase();
		return `The Buddha teaches Venerable Rādha to give up desire and greed for whatever is ${topic}, applying the formula to form, feeling, perception, choices, and consciousness.`;
	}

	if (/māra/i.test(text) && /form is māra|subject to māra/i.test(text)) {
		return `The Buddha teaches Venerable Rādha that the five aggregates are ${title.toLowerCase()}, and that desire and greed for them should be given up on the path to liberation.`;
	}

	if (/impermanent|suffering|not-self|liable to|of a nature to/i.test(text) && /form is/i.test(text)) {
		return `The Buddha teaches Venerable Rādha that the five aggregates are ${title.toLowerCase()}, and that desire and greed for them should be given up for the ending of suffering.`;
	}

	if (/teach me dhamma in brief|live alone, withdrawn/i.test(text)) {
		return `The Buddha gives Venerable Rādha a brief teaching on ${title.toLowerCase()}, urging him to give up desire and greed for the five aggregates and live withdrawn, diligent, and resolute.`;
	}

	if (title && title.length > 2) {
		return `The Buddha teaches Venerable Rādha on the five aggregates regarding ${title.toLowerCase()}, guiding him toward insight, dispassion, and liberation.`;
	}

	return "The Buddha teaches Venerable Rādha on the five aggregates and how giving up craving in them leads to liberation.";
}

function extractSn24View(text, title) {
	if (/winds don'?t blow/i.test(text)) {
		return "winds don't blow, rivers don't flow, and the moon and stars stand firm like a pillar";
	}
	const quoted =
		text.match(/does the view arise:\s*['‘](.+?)['’']\?/is)?.[1] ??
		text.match(/the view arises:\s*['‘](.+?)['’']/is)?.[1] ??
		text.match(/^\s*['‘](.+?)['’']/is)?.[1];
	if (quoted) return quoted.replace(/\.$/, "").trim();
	if (title && !/^winds$/i.test(title) && !/^this is mine/i.test(title)) {
		return title.toLowerCase();
	}
	return null;
}

export function buildSn24Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		if (/\(tell in full|\(tell these/i.test(text)) {
			if (/second chapter|discourses 20 through 43|24 discourses of the second chapter/i.test(text)) {
				return "The Buddha teaches a repeated formula on wrong views about the self and the aggregates—showing how grasping the five aggregates gives rise to identity views and how a stream-enterer abandons them—applied across this grouped discourse.";
			}
			if (/discourses 2 through 17|previous chapter/i.test(text)) {
				return "The Buddha teaches a repeated formula on wrong views such as 'this is mine, I am this, this is my self'—showing how grasping the five aggregates gives rise to identity views and how a stream-enterer abandons them—applied across this grouped discourse.";
			}
		}
		return `The Buddha teaches a repeated formula on wrong views regarding ${title.toLowerCase()}, showing how grasping the five aggregates gives rise to views and how a stream-enterer abandons them, in this grouped discourse.`;
	}

	const view = extractSn24View(text, title);
	if (view) {
		const viewPhrase = view.startsWith("the ") || view.startsWith("a ") ? view : `‘${view}’`;
		return `The Buddha teaches that when the five aggregates are grasped and insisted on, the wrong view arises that ${viewPhrase}, and that seeing their impermanence and suffering leads a noble disciple to become a stream-enterer.`;
	}

	if (/stream-enterer|destined for awakening/i.test(text)) {
		return `The Buddha teaches on wrong views regarding ${title.toLowerCase()}, analyzing how grasping the five aggregates gives rise to views and how abandoning doubt in the noble truths makes one a stream-enterer.`;
	}

	if (title && title.length > 2) {
		return `The Buddha teaches on wrong views regarding ${title.toLowerCase()}, showing how grasping the five aggregates gives rise to identity views and how a noble disciple abandons them through insight into impermanence and suffering.`;
	}

	return "The Buddha teaches on wrong views about the self and the aggregates, showing how grasping the five aggregates gives rise to views and how a stream-enterer abandons them.";
}

export function buildSn29Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		if (/how giving helps|give food|give food/i.test(text) || /both kinds of deeds/i.test(text)) {
			const birthTypes = [];
			if (/egg-born/i.test(text) || /egg-born/i.test(title)) birthTypes.push("egg-born");
			if (/womb-born/i.test(text) || /womb-born/i.test(title)) birthTypes.push("womb-born");
			if (/moisture-born/i.test(text) || /moisture-born/i.test(title)) birthTypes.push("moisture-born");
			if (/spontaneously-born/i.test(text) || /spontaneously-born/i.test(title)) birthTypes.push("spontaneously-born");
			const typesPhrase =
				birthTypes.length > 1
					? `${birthTypes.slice(0, -1).join(", ")} and ${birthTypes.at(-1)}`
					: birthTypes[0] ?? "dragon";
			return `The Buddha teaches a repeated formula on how doing both kinds of deeds, hearing of the ${typesPhrase} dragons, aspiring to their rebirth, and giving generously leads to rebirth in their company, applied across this grouped discourse.`;
		}
		return `The Buddha teaches a repeated formula on dragons and rebirth regarding ${title.toLowerCase()} in this grouped discourse.`;
	}

	if (/\(tell all in full\)|\(tell in full\)/i.test(text) && text.length < 250) {
		const birthType = text.match(/(egg-born|womb-born|moisture-born|spontaneously-born) dragons/i)?.[1] ?? "dragon";
		return `The Buddha teaches why some ${birthType} dragons keep the sabbath after transforming their bodies, reflecting on past deeds and resolving to practice good conduct by body, speech, and mind.`;
	}

	if (/dragons reproduce in these four ways|four ways that dragons reproduce/i.test(text)) {
		if (/better than those born from an egg/i.test(text)) {
			return "The Buddha teaches the four ways dragons reproduce—from egg, womb, moisture, or spontaneously—and that dragons born from womb, moisture, or spontaneous birth are progressively superior to those born from eggs.";
		}
		return "The Buddha teaches the four ways dragons reproduce—born from an egg, from a womb, from moisture, or spontaneously.";
	}

	if (/keep the sabbath|transformed their bodies/i.test(text)) {
		const birthType = text.match(/(egg-born|womb-born|moisture-born|spontaneously-born) dragons/i)?.[1] ?? "dragon";
		return `The Buddha teaches why some ${birthType} dragons keep the sabbath after transforming their bodies, reflecting on past mixed deeds and resolving to practice good conduct for a better rebirth.`;
	}

	if (/both kinds of deeds|when their body breaks up, after death/i.test(text)) {
		const birthType =
			text.match(/company of the (egg-born|womb-born|moisture-born|spontaneously-born) dragons/i)?.[1] ??
			"dragon";
		return `The Buddha teaches that someone who does both kinds of deeds, hears that ${birthType} dragons are long-lived and happy, aspires to join them, and gives generously is reborn in their company after death.`;
	}

	if (title && title.length > 2) {
		return `The Buddha teaches on dragons regarding ${title.toLowerCase()}, explaining causes of rebirth among the nāgas and the role of deeds, aspiration, and giving.`;
	}

	return "The Buddha teaches on dragons—the nāgas among the gods of the Four Great Kings—explaining their modes of birth and the karmic causes of rebirth in their company.";
}

export function buildSn30Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		if (/\(tell all in full\)|\(tell in full\)/i.test(text) && text.length < 400) {
			return "The Buddha teaches a repeated formula on how doing both kinds of deeds, hearing of phoenix rebirth, aspiring to join them, and giving generously leads to rebirth among womb-born, moisture-born, or spontaneously-born phoenixes, applied across this grouped discourse.";
		}
		if (/how giving helps|give food/i.test(text) || /both kinds of deeds/i.test(text)) {
			const birthTypes = [];
			if (/egg-born/i.test(text) || /egg-born/i.test(title)) birthTypes.push("egg-born");
			if (/womb-born/i.test(text) || /womb-born/i.test(title)) birthTypes.push("womb-born");
			if (/moisture-born/i.test(text) || /moisture-born/i.test(title)) birthTypes.push("moisture-born");
			if (/spontaneously-born/i.test(text) || /spontaneously-born/i.test(title)) birthTypes.push("spontaneously-born");
			const typesPhrase =
				birthTypes.length > 1
					? `${birthTypes.slice(0, -1).join(", ")} and ${birthTypes.at(-1)}`
					: birthTypes[0] ?? "phoenix";
			return `The Buddha teaches a repeated formula on how doing both kinds of deeds, hearing of the ${typesPhrase} phoenixes, aspiring to their rebirth, and giving generously leads to rebirth in their company, applied across this grouped discourse.`;
		}
		return `The Buddha teaches a repeated formula on phoenixes and rebirth regarding ${title.toLowerCase()} in this grouped discourse.`;
	}

	if (/phoenixes reproduce in these four ways|four ways that phoenixes reproduce/i.test(text)) {
		if (/carry off dragons/i.test(text)) {
			return "The Buddha teaches the four ways phoenixes reproduce and how phoenixes of each birth-type can carry off dragons of corresponding or lesser birth-types, with spontaneously-born phoenixes able to seize any dragon.";
		}
		return "The Buddha teaches the four ways phoenixes reproduce—born from an egg, from a womb, from moisture, or spontaneously.";
	}

	if (/both kinds of deeds|when their body breaks up, after death/i.test(text)) {
		const birthType =
			text.match(/company of the (egg-born|womb-born|moisture-born|spontaneously-born) phoenixes/i)?.[1] ??
			"phoenix";
		return `The Buddha teaches that someone who does both kinds of deeds, hears that ${birthType} phoenixes are long-lived and happy, aspires to join them, and gives generously is reborn in their company after death.`;
	}

	if (title && title.length > 2) {
		return `The Buddha teaches on phoenixes regarding ${title.toLowerCase()}, explaining causes of rebirth among the supaṇṇa deities of the Thirty-Three and the role of deeds, aspiration, and giving.`;
	}

	return "The Buddha teaches on phoenixes—the supaṇṇa deities among the gods of the Thirty-Three—explaining their modes of birth and the karmic causes of rebirth in their company.";
}

export function inferSn23Themes(text) {
	const themes = inferThemes(text);
	if (/teach me dhamma in brief|give up any desire|live alone, withdrawn/i.test(text)) {
		return themes.includes("training guideline")
			? themes.slice(0, 2)
			: ["training guideline", themes[0] ?? "wisdom"];
	}
	if (/stream-enterer|perfected one|ascetics and brahmins/i.test(text)) {
		return themes.includes("cultivating discernment")
			? themes.slice(0, 2)
			: ["wisdom", "cultivating discernment"];
	}
	return themes.includes("wisdom") ? themes.slice(0, 2) : ["wisdom", themes[0] ?? "directly knowing"].slice(0, 2);
}

export function inferSn24Themes(text) {
	const themes = inferThemes(text);
	if (/wrong view|grasping|insisting on|stream-enterer/i.test(text)) {
		return themes.includes("cultivating discernment")
			? themes.slice(0, 2)
			: ["cultivating discernment", "wisdom"];
	}
	if (!themes.includes("principle")) return ["principle", themes[0] ?? "wisdom"].slice(0, 2);
	return themes.slice(0, 2);
}

export function inferSn29Themes(text) {
	const themes = inferThemes(text);
	if (/sabbath|good things by way of body|ethical/i.test(text)) {
		return themes.includes("training guideline")
			? themes.slice(0, 2)
			: ["principle", "training guideline"];
	}
	if (/give food|giving|heard/i.test(text)) {
		return themes.includes("principle") ? themes.slice(0, 2) : ["principle", themes[0] ?? "story"];
	}
	return themes.includes("story") ? themes.slice(0, 2) : ["story", themes[0] ?? "principle"].slice(0, 2);
}

export function inferSn30Themes(text) {
	const themes = inferThemes(text);
	if (/carry off|better than|four ways/i.test(text)) {
		return themes.includes("principle") ? themes.slice(0, 2) : ["principle", themes[0] ?? "story"];
	}
	if (/give food|giving|both kinds of deeds/i.test(text)) {
		return themes.includes("principle") ? themes.slice(0, 2) : ["principle", themes[0] ?? "story"];
	}
	return themes.includes("story") ? themes.slice(0, 2) : ["story", themes[0] ?? "principle"].slice(0, 2);
}

export function buildSn31Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		if (/give food|give gifts of fragrant|they give food/i.test(text)) {
			if (/fragrant heartwood|fragrant roots|fragrant scents/i.test(text) && /food.*drink.*lamp/i.test(text)) {
				return "The Buddha teaches a repeated formula on how ethical conduct, aspiration, and giving food, drink, clothing, and other gifts lead to rebirth among the gods who dwell in fragrant tree parts—from heartwood through scents—in this grouped discourse.";
			}
			if (/fragrant roots/i.test(text)) {
				return "The Buddha teaches a repeated formula on how ethical conduct, aspiration, and giving food, drink, clothing, garlands, fragrance, and other gifts lead to rebirth among the gods who live in fragrant roots in this grouped discourse.";
			}
		}
		if (/give gifts of fragrant|they give gifts/i.test(text)) {
			return "The Buddha teaches a repeated formula on how ethical conduct, hearing of the centaur gods, aspiration, and giving fragrant tree products lead to rebirth among the gods who dwell in fragrant heartwood, softwood, bark, and related tree parts in this grouped discourse.";
		}
		return `The Buddha teaches a repeated formula on rebirth among the gods of the centaur realm regarding ${title.toLowerCase()} in this grouped discourse.`;
	}

	if (/I will teach you about the gods of the centaur realm/i.test(text)) {
		return "The Buddha teaches the mendicants about the gods of the centaur realm—those who live in fragrant roots, heartwood, softwood, bark, shoots, leaves, flowers, fruit, sap, and scents.";
	}

	if (/does good things by way of body, speech, and mind/i.test(text)) {
		if (/give gifts of fragrant roots/i.test(text)) {
			return "The Buddha teaches that someone who acts well by body, speech, and mind, aspires to the gods who live in fragrant roots, and gives gifts of fragrant roots is reborn in their company after death.";
		}
		if (/gods of the centaur realm are long-lived/i.test(text) && !/give gifts|they give/i.test(text)) {
			return "The Buddha teaches that someone who acts well by body, speech, and mind, hears of the long-lived centaur gods, and aspires to their realm is reborn among the gods of the centaur realm after death.";
		}
	}

	if (title && title.length > 2 && !/^plain version/i.test(title)) {
		return `The Buddha teaches how ethical conduct, aspiration, and giving lead to rebirth among the gods of the centaur realm regarding ${title.toLowerCase()}.`;
	}

	return "The Buddha teaches how ethical conduct, aspiration, and giving lead to rebirth among the gods who dwell in fragrant tree parts of the centaur realm.";
}

export function buildSn32Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		if (/warm thunderclouds|stormy thunderclouds|rainy thunderclouds/i.test(text)) {
			return "The Buddha teaches a repeated formula on how ethical conduct, aspiration, and giving food and lamps lead to rebirth among the gods of warm, stormy, windy, and rainy thunderclouds in this grouped discourse.";
		}
		if (/cool thunderclouds/i.test(text)) {
			return "The Buddha teaches a repeated formula on how ethical conduct, aspiration, and giving food and lamps lead to rebirth among the gods of cool thunderclouds in this grouped discourse.";
		}
		return `The Buddha teaches a repeated formula on rebirth among the gods of the thundercloud host regarding ${title.toLowerCase()} in this grouped discourse.`;
	}

	if (/I will teach you about the gods of the thundercloud host/i.test(text)) {
		return "The Buddha teaches the mendicants about the gods of the thundercloud host—those of cool, warm, stormy, windy, and rainy thunderclouds.";
	}

	if (/does good things by way of body, speech, and mind/i.test(text) && /thundercloud host/i.test(text)) {
		return "The Buddha teaches that someone who acts well by body, speech, and mind, hears of the long-lived gods of the thundercloud host, and aspires to their realm is reborn among them after death.";
	}

	if (/revel in our own kind of enjoyment/i.test(text)) {
		const weather =
			text.match(/why sometimes it becomes (\w+)/i)?.[1]?.toLowerCase() ??
			title.replace(/^gods of the /i, "").replace(/ thunderclouds$/i, "").toLowerCase();
		return `The Buddha teaches that when the gods of the ${weather} thunderclouds wish to revel in their own enjoyment, the weather becomes ${weather} in accordance with their wish.`;
	}

	if (/cool thunderclouds/i.test(text) && /give food/i.test(text)) {
		return "The Buddha teaches that someone who acts well by body, speech, and mind, aspires to the gods of cool thunderclouds, and gives food and lamps is reborn in their company after death.";
	}

	if (title && title.length > 2 && !/^plain version|good conduct/i.test(title)) {
		return `The Buddha teaches on the gods of the thundercloud host regarding ${title.toLowerCase()}, explaining the kamma that leads to rebirth or natural phenomena among them.`;
	}

	return "The Buddha teaches on the gods of the thundercloud host and the ethical conduct, aspiration, and giving that lead to rebirth among them.";
}

export function buildSn39Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		if (/tell in full as the linked discourses with jambukhādaka/i.test(text)) {
			return "Venerable Sāriputta teaches the wanderer Sāmaṇḍaka that extinguishment is the ending of greed, hate, and delusion and that the noble eightfold path is the practice for realizing it, applying the same formula as the discourses with Jambukhādaka across this grouped range.";
		}
		return `Venerable Sāriputta teaches the wanderer Sāmaṇḍaka on ${title.toLowerCase()} in this grouped discourse of the Connected Discourses with Sāmaṇḍaka.`;
	}

	if (/hard to do/i.test(text) && /going forth.*hard to do|hard to be satisfied|hard to practice in line/i.test(text)) {
		return "Venerable Sāriputta teaches the wanderer Sāmaṇḍaka that going forth, contentment after going forth, and practicing in line with the teaching are each hard to do—but one who practices accordingly need not take long to become a perfected one.";
	}

	if (/what is extinguishment/i.test(text)) {
		return "Venerable Sāriputta teaches the wanderer Sāmaṇḍaka that extinguishment is the ending of greed, hate, and delusion and that the noble eightfold path is the practice for realizing it.";
	}

	if (/sāriputta.*sāmaṇḍaka|wanderer sāmaṇḍaka/i.test(text)) {
		return `Venerable Sāriputta answers the wanderer Sāmaṇḍaka on ${title.toLowerCase()}, clarifying core points of the teaching and the path to liberation.`;
	}

	if (title && title.length > 2) {
		return `Venerable Sāriputta teaches the wanderer Sāmaṇḍaka on ${title.toLowerCase()}, explaining the Dhamma and the path to realization.`;
	}

	return "Venerable Sāriputta teaches the wanderer Sāmaṇḍaka on extinguishment, the spiritual life, and the path to liberation.";
}

function sn40MeditationTopic(text, title) {
	const fromTitle = title.match(/(?:about|with) (?:the )?(.+)$/i)?.[1];
	if (fromTitle && !/^sakka|candana/i.test(fromTitle)) {
		return fromTitle.replace(/\.$/, "").toLowerCase();
	}
	const match =
		text.match(/called the ['“]([^'”]+)['”]/i) ??
		text.match(/called the ‘([^’]+)’/i) ??
		text.match(/What is the ([^?]+)\?/i);
	return match?.[1]?.replace(/\.$/, "").trim().toLowerCase() ?? "meditative attainment";
}

export function buildSn40Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug === "sn40.11" || /tell in full as in the discourse with sakka/i.test(text)) {
		return "Venerable Mahāmoggallāna teaches the godlings Candana, Suyāma, Santusita, Sunimmita, and Vasavatti the benefits of refuge, experiential confidence in the Triple Gem, and noble ethics—applying the same formula as the discourse with Sakka in this grouped discourse.";
	}

	if (slug === "sn40.10" || (/sakka, lord of gods/i.test(text) && /go for refuge to the buddha/i.test(text))) {
		if (/surpass other gods in ten respects/i.test(text)) {
			return "Venerable Mahāmoggallāna teaches Sakka, lord of gods, that going for refuge to the Buddha, teaching, and Saṅgha—and having experiential confidence and noble ethics—leads to heavenly rebirth and surpassing other gods in ten respects such as lifespan, beauty, and happiness.";
		}
		if (/experiential confidence in the buddha/i.test(text)) {
			return "Venerable Mahāmoggallāna teaches Sakka, lord of gods, that experiential confidence in the Buddha, teaching, and Saṅgha and noble ethical conduct lead to rebirth in a good heavenly realm.";
		}
		return "Venerable Mahāmoggallāna teaches Sakka, lord of gods, that going for refuge to the Buddha, teaching, and Saṅgha is the reason some beings are reborn in a good heavenly realm.";
	}

	if (/perception and focus accompanied by/i.test(text) && /buddha came up to me with his psychic power/i.test(text)) {
		const topic = sn40MeditationTopic(text, title);
		return `Venerable Mahāmoggallāna recounts how, while developing ${topic}, distracting perceptions beset him until the Buddha appeared by psychic power and urged him to settle his mind in that attainment until he mastered it.`;
	}

	if (/just now, reverends, as I was in private retreat/i.test(text)) {
		const topic = sn40MeditationTopic(text, title);
		return `Venerable Mahāmoggallāna recounts reflecting in private retreat on what ${topic} is, entering that attainment, and receiving the Buddha's guidance when distracting perceptions arose.`;
	}

	if (/they speak of this thing called/i.test(text)) {
		const topic = sn40MeditationTopic(text, title);
		return `Venerable Mahāmoggallāna recounts his struggle to stabilize ${topic} and how the Buddha's direct instruction helped him attain great direct knowledge.`;
	}

	if (title && title.length > 2 && !/^a question about/i.test(title)) {
		return `Venerable Mahāmoggallāna teaches on ${title.toLowerCase()}, recounting his meditative attainments and the Buddha's guidance on the path to direct knowledge.`;
	}

	return "Venerable Mahāmoggallāna recounts his meditative attainments and how the Buddha's guidance helped him master absorption and direct knowledge.";
}

export function inferSn31Themes(text) {
	const themes = inferThemes(text);
	if (/give gifts|giving|good things by way of body/i.test(text)) {
		return themes.includes("principle")
			? themes.slice(0, 2)
			: ["principle", themes[0] ?? "inspiration"];
	}
	return themes.includes("story") ? themes.slice(0, 2) : ["story", themes[0] ?? "principle"].slice(0, 2);
}

export function inferSn32Themes(text) {
	const themes = inferThemes(text);
	if (/revel in our own kind of enjoyment|becomes cool|becomes warm|becomes stormy/i.test(text)) {
		return themes.includes("story") ? themes.slice(0, 2) : ["story", themes[0] ?? "principle"];
	}
	if (/give food|good things by way of body/i.test(text)) {
		return themes.includes("principle")
			? themes.slice(0, 2)
			: ["principle", themes[0] ?? "inspiration"];
	}
	return themes.includes("story") ? themes.slice(0, 2) : ["story", themes[0] ?? "principle"].slice(0, 2);
}

export function inferSn39Themes(text) {
	const themes = inferThemes(text);
	if (/noble eightfold path|practice in line with the teaching|path and a practice/i.test(text)) {
		return themes.includes("training guideline")
			? themes.slice(0, 2)
			: ["wisdom", "training guideline"];
	}
	if (/hard to do|going forth|contentment|perfected one/i.test(text)) {
		return themes.includes("training guideline")
			? themes.slice(0, 2)
			: ["training guideline", "urgency"];
	}
	return themes.includes("wisdom") ? themes.slice(0, 2) : ["wisdom", themes[0] ?? "training guideline"].slice(0, 2);
}

export function inferSn40Themes(text) {
	const themes = inferThemes(text);
	if (/first absorption|second absorption|third absorption|fourth absorption|dimension of|signless immersion|private retreat|settle your mind/i.test(text)) {
		return themes.includes("training guideline")
			? themes.slice(0, 2)
			: ["training guideline", "directly knowing"];
	}
	if (/sakka|go for refuge|experiential confidence|lord of gods/i.test(text)) {
		return themes.includes("inspiration")
			? themes.slice(0, 2)
			: ["inspiration", "recollection of the Buddha"];
	}
	return themes.includes("directly knowing")
		? themes.slice(0, 2)
		: ["directly knowing", themes[0] ?? "training guideline"].slice(0, 2);
}

const SN18_TOPIC_BY_TITLE = {
	"the eye, etc.": "the six internal sense bases",
	"sights, etc.": "sights, sounds, smells, tastes, touches, and ideas",
	consciousness: "eye, ear, nose, tongue, body, and mind consciousness",
	contact: "eye, ear, nose, tongue, body, and mind contact",
	feeling: "feelings born of eye, ear, nose, tongue, body, and mind contact",
	perceptions: "perceptions of sights, sounds, smells, tastes, touches, and ideas",
	intention: "intentions regarding sights, sounds, smells, tastes, touches, and ideas",
	craving: "craving for sights, sounds, smells, tastes, touches, and ideas",
	elements: "the earth, water, fire, air, space, and consciousness elements",
	"the aggregates": "form, feeling, perception, choices, and consciousness",
	tendency: "I-making, mine-making, and the underlying tendency to conceit",
	"rid of conceit": "I-making, mine-making, and conceit",
};

export function buildSn5Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));
	const nun = title.replace(/^with /i, "").trim() || "a nun";

	if (/sentient being|pile of conditions|chariot/i.test(text)) {
		return `The nun Vajirā confronts Māra in verse when he asks who created the sentient being, teaching that there is only a pile of conditions and aggregates—like a chariot assembled from parts—with nothing to be found beyond suffering that arises and ceases.`;
	}

	if (/created this puppet|where is its maker/i.test(text)) {
		return `The nun Selā confronts Māra in verse when he asks who created the puppet and where its maker is, refuting the notion of a creator and teaching insight into the conditioned nature of the aggregates.`;
	}

	if (/two-inch wisdom|sages to attain/i.test(text)) {
		return `The nun Somā confronts Māra in verse when he claims that awakening is too challenging for a woman with “two-inch wisdom,” teaching that what makes one a sage is wisdom itself—not gender.`;
	}

	if (/children have died|over the death of children/i.test(text)) {
		return `The nun Kisāgotamī confronts Māra in verse when he taunts her for crying as if her children had died, declaring that she has overcome grief, defeated the army of death, and lives without defilements.`;
	}

	if (/five-piece band|music of a five/i.test(text)) {
		return `The nun Vijayā confronts Māra in verse when he tempts her with youth and the music of a five-piece band, teaching that she has handed back sensual pleasures and eradicated craving for the rotting body.`;
	}

	if (/don't approve of rebirth|transcending rebirth/i.test(text)) {
		return `The nun Cālā confronts Māra in verse when he urges her to approve of rebirth for the sake of sensual pleasures, teaching that birth brings killing, caging, and misery—and that the Buddha has settled her in the truth of transcending rebirth.`;
	}

	if (/don't want to be reborn anywhere|gods of the thirty-three/i.test(text)) {
		return `The nun Upacālā confronts Māra in verse when he tempts her with rebirth among the gods of the Thirty-Three and other heavens, teaching that the whole world is burning and her mind adores the place where Māra cannot go.`;
	}

	if (/don't approve anyone's creed|born in the sakyan clan/i.test(text)) {
		return `The nun Sīsupacālā confronts Māra in verse when he challenges her for shaving her head yet approving no creed, declaring her devotion to the unrivaled Sakyan Buddha who is everywhere freed and unattached.`;
	}

	if (/100,000 rascals|psychic power|master of my own mind/i.test(text)) {
		return `The nun Uppalavaṇṇā confronts Māra in verse when he tries to frighten her with the threat of assault while she meditates alone, declaring her mastery of mind, psychic power, and freedom from all bonds.`;
	}

	if (/no escape in the world|erotic delights/i.test(text)) {
		return `The nun Āḷavikā confronts Māra in verse when he urges her to enjoy erotic delights rather than seek seclusion, teaching that she has personally experienced the escape from the world and sees sensual pleasures as swords upon the aggregates.`;
	}

	if (/māra the wicked.*addressed her in verse/i.test(text)) {
		return `The nun ${nun} confronts Māra the Wicked in verse when he tries to make her fall away from seclusion or immersion, answering with teaching on liberation, non-attachment, and the end of defilements.`;
	}

	return `The nun ${nun} confronts Māra in verse dialogue, teaching insight into impermanence, the dangers of sensuality, and the path to liberation from suffering.`;
}

export function buildSn18Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));
	const titleLower = title.toLowerCase();

	if (slug.includes("-")) {
		return "The Buddha teaches Rāhula a repeated formula on impermanence, suffering, and not-self—applying the analysis to sights, consciousness, contact, feeling, perception, intention, craving, elements, and the aggregates across this grouped discourse.";
	}

	if (/underlying tendency to conceit|i-making, mine-making/i.test(text) && /rid of|peaceful and well freed/i.test(text)) {
		return "The Buddha teaches Rāhula how to know and see so that the heart is rid of I-making, mine-making, and conceit for this conscious body and externally for all signs, until it is peaceful and well freed by not grasping the five aggregates.";
	}

	if (/underlying tendency to conceit|i-making, mine-making/i.test(text)) {
		return "The Buddha teaches Rāhula how to know and see the five aggregates—form, feeling, perception, choices, and consciousness—so that there is no I-making, mine-making, or underlying tendency to conceit internally or externally.";
	}

	if (/teach me dhamma in brief|live alone, withdrawn/i.test(text)) {
		return "When Rāhula asks the Buddha for brief teaching so he may live alone and resolute, the Buddha guides him through the six internal sense bases—eye, ear, nose, tongue, body, and mind—as impermanent, suffering, and not fit to be regarded as self, leading to disenchantment and freedom.";
	}

	const topic = SN18_TOPIC_BY_TITLE[titleLower];
	if (topic) {
		return `The Buddha teaches Rāhula to contemplate ${topic} as impermanent, suffering, and not-self—not fit to be regarded as “mine, I am this, my self”—until disenchantment, fading of desire, and liberation arise.`;
	}

	if (/permanent or impermanent/i.test(text)) {
		return `The Buddha teaches Rāhula to contemplate ${titleLower} as impermanent, suffering, and not-self, guiding him step by step toward disenchantment and the ending of rebirth.`;
	}

	return "The Buddha teaches Rāhula systematic contemplation of impermanence, suffering, and not-self across sense experience and the aggregates, guiding his son toward full awakening.";
}

export function buildSn21Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (/noble silence|second absorption/i.test(text) && /moggallāna/i.test(text)) {
		return "Venerable Mahāmoggallāna explains to the mendicants how he discovered that noble silence is the stilling of placing the mind and keeping it connected in the second absorption, and how the Buddha guided him with psychic power when perception beset his meditation.";
	}

	if (/decay and perishing would give rise to sorrow/i.test(text)) {
		return "Venerable Sāriputta declares to the mendicants that nothing in the world whose decay and perishing would give rise to sorrow in him—even the Buddha's passing—and Ānanda explains that he has long eradicated I-making, mine-making, and the tendency to conceit.";
	}

	if (/mound of salt|few grains of salt/i.test(text)) {
		return "Venerable Sāriputta and Mahāmoggallāna exchange praise after Moggallāna reports a psychic Dhamma talk with the Buddha on energy, each humbly comparing himself to gravel or a few grains of salt beside the other's greatness.";
	}

	if (/adhered to passivity and silence|doing my own work/i.test(text)) {
		return "When mendicants complain that a junior monk is passive and unhelpful with robe-sewing, the Buddha reveals that he has realized the supreme end of the spiritual path and attained the four absorptions at will.";
	}

	if (/nicely pressed and ironed robes|apply eyeshadow|glazed bowl/i.test(text)) {
		return "The Buddha admonishes his cousin Nanda for dressing in pressed robes, applying eyeshadow, and carrying a glazed bowl, urging him instead toward wilderness life, rag robes, almsfood, and freedom from concern for sensual pleasures.";
	}

	if (/miserable and sad, with tears flowing|admonish others.*don't accept admonition/i.test(text)) {
		return "The Buddha counsels his cousin Tissa, who weeps because mendicants jeer at him, teaching that one who admonishes others must also accept admonition—and that the spiritual life is lived to remove anger, conceit, and denigration.";
	}

	if (/educate, encourage, firing up.*dhamma talk/i.test(text)) {
		return "The Buddha praises Venerable Visākha, Pañcāli's son, for educating and inspiring the mendicants in the assembly hall with polished Dhamma talk, urging that an astute person should speak and hold up the banner of the seers.";
	}

	if (/living alone is fulfilled in detail|senior in name only/i.test(text)) {
		return "The Buddha teaches the mendicant Senior that true living alone means giving up the past, relinquishing the future, and eliminating desire and greed for present incarnations—not merely going on almsround and walking mindfully in physical solitude.";
	}

	if (/companions, protégés of venerable mahākappina/i.test(text)) {
		return "The Buddha praises two companion mendicants, protégés of Venerable Mahākappina, declaring that they are mighty, have realized the supreme end of the spiritual path, and bear their final bodies having vanquished Māra.";
	}

	if (/realized the supreme end of the spiritual path|bears his final body/i.test(text)) {
		const monk =
			title.replace(/^with /i, "").trim() ||
			text.match(/venerable (\w+)/i)?.[1] ||
			"a mendicant";
		if (/ugly, unsightly, deformed/i.test(text)) {
			return `The Buddha praises Venerable Bhaddiya the Dwarf before the Saṅgha, teaching that though his body is despised, a little person who is wise is truly great—and that he has realized the supreme end of the spiritual path.`;
		}
		if (/shines in both ways|attractive, good-looking/i.test(text)) {
			return `The Buddha praises Venerable Sujāta before the mendicants, declaring that he shines in both beauty and spiritual attainment, with heart upright, unfettered, and quenched by not grasping.`;
		}
		if (/white, thin, with a pointy nose/i.test(text)) {
			return `The Buddha praises Venerable Mahākappina before the mendicants as mighty and accomplished in every attainment, having realized the supreme end of the spiritual path in this very life.`;
		}
		return `The Buddha praises Venerable ${monk} before the mendicants, declaring that he has realized the supreme end of the spiritual path in this very life and bears his final body having vanquished Māra.`;
	}

	if (/in private retreat this thought came/i.test(text)) {
		const who = text.match(/venerable (\w+)|sāriputta|moggallāna/i)?.[0] ?? "a disciple";
		return `Venerable ${who.replace(/^venerable /i, "")} shares with the mendicants a reflection from private retreat and the teaching that arose from it on the path to liberation.`;
	}

	if (title && title.length > 2 && !/^with kolita|^with upatissa/i.test(title.toLowerCase())) {
		const monk = title.replace(/^with /i, "").trim();
		return `The Buddha teaches on Venerable ${monk} in the Connected Discourses with Bhikkhus, illustrating qualities and conduct on the path to liberation.`;
	}

	return "The Buddha teaches on exemplary mendicants in the Connected Discourses with Bhikkhus, illustrating attainment, conduct, and inspiration for disciples on the path.";
}

export function inferSn5Themes(text) {
	const themes = inferThemes(text);
	if (/māra|verse|confronts|wicked one/i.test(text)) {
		return themes.includes("inspiration")
			? themes.slice(0, 2)
			: ["inspiration", themes[0] ?? "wisdom"].slice(0, 2);
	}
	return themes.includes("wisdom") ? themes.slice(0, 2) : ["wisdom", themes[0] ?? "inspiration"].slice(0, 2);
}

export function inferSn18Themes(text) {
	const themes = inferThemes(text);
	if (/impermanent|not-self|suffering|disillusioned/i.test(text)) {
		return themes.includes("training guideline")
			? themes.slice(0, 2)
			: ["wisdom", "training guideline"];
	}
	if (!themes.includes("principle")) return ["principle", themes[0] ?? "wisdom"].slice(0, 2);
	return themes.slice(0, 2);
}

export function inferSn21Themes(text) {
	const themes = inferThemes(text);
	if (/realized the supreme end|bears his final body|vanquished māra/i.test(text)) {
		return themes.includes("inspiration")
			? themes.slice(0, 2)
			: ["inspiration", themes[0] ?? "recollection of the Buddha"].slice(0, 2);
	}
	if (/living alone|energy|meditation|admonish|wilderness/i.test(text)) {
		return themes.includes("training guideline")
			? themes.slice(0, 2)
			: ["training guideline", themes[0] ?? "wisdom"].slice(0, 2);
	}
	if (/story|cousin|companion|junior monk/i.test(text)) {
		return themes.includes("story") ? themes.slice(0, 2) : ["story", themes[0] ?? "inspiration"].slice(0, 2);
	}
	return themes.length ? themes.slice(0, 2) : ["inspiration", "wisdom"];
}

const SN26_TOPIC_BY_TITLE = {
	"the eye": "the eye, ear, nose, tongue, body, and mind",
	sights: "sights, sounds, smells, tastes, touches, and ideas",
	consciousness: "eye, ear, nose, tongue, body, and mind consciousness",
	contact: "eye, ear, nose, tongue, body, and mind contact",
	feeling: "feelings born of eye, ear, nose, tongue, body, and mind contact",
	perception: "perceptions of sights, sounds, smells, tastes, touches, and ideas",
	intention: "intentions regarding sights, sounds, smells, tastes, touches, and ideas",
	craving: "craving for sights, sounds, smells, tastes, touches, and ideas",
	elements: "the earth, water, fire, air, space, and consciousness elements",
	"the aggregates": "form, feeling, perception, choices, and consciousness",
};

const SN27_TOPIC_BY_TITLE = {
	"the eye": "the eye, ear, nose, tongue, body, and mind",
	sights: "sights, sounds, smells, tastes, touches, and ideas",
	consciousness: "eye, ear, nose, tongue, body, and mind consciousness",
	contact: "eye, ear, nose, tongue, body, and mind contact",
	feeling: "feelings born of eye, ear, nose, tongue, body, and mind contact",
	perception: "perceptions of sights, sounds, smells, tastes, touches, and ideas",
	intention: "intentions regarding sights, sounds, smells, tastes, touches, and ideas",
	craving: "craving for sights, sounds, smells, tastes, touches, and ideas",
	elements: "the earth, water, fire, air, space, and consciousness elements",
	"the aggregates": "form, feeling, perception, choices, and consciousness",
};

export function buildSn16Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (/content with any kind of robe|improper solicitation for the sake of a robe/i.test(text)) {
		return "The Buddha praises Venerable Mahākassapa's contentment with robes, almsfood, lodging, and medicines—using them unattached and seeing the escape—and exhorts mendicants to train in the same way.";
	}

	if (/without being keen and prudent you can'?t achieve awakening/i.test(text) && /sāriputta/i.test(text)) {
		return "Venerable Sāriputta asks Venerable Mahākassapa how keenness and prudence toward skillful and unskillful qualities are needed to achieve awakening, extinguishment, and the supreme sanctuary from the yoke.";
	}

	if (/approach families like the moon|withdrawn in body and mind/i.test(text)) {
		return "The Buddha teaches mendicants to approach families like the moon—with body and mind withdrawn and unassuming—and contrasts impure teaching for recognition with pure teaching out of compassion, holding up Mahākassapa as the model.";
	}

	if (/worthy of visiting families|not worthy of visiting families/i.test(text) && /may they give to me/i.test(text)) {
		return "The Buddha teaches which mendicants are worthy of visiting families—those free from solicitous thoughts about gifts—and shows how Mahākassapa visits families without feeling slighted whether families give much or little.";
	}

	if (/you'?re old now, kassapa|worn-out hempen rag robes/i.test(text)) {
		return "When the Buddha offers Mahākassapa household robes and invitations, Kassapa explains that he has long lived in the wilderness on almsfood and rag robes for his own happiness and so future disciples may follow his example.";
	}

	if (/competing in studies|who can speak more/i.test(text)) {
		return "When the Buddha asks Mahākassapa to advise the mendicants, Kassapa says they are hard to admonish and cites monks competing in studies; the Buddha rebukes the competitors and teaches that the spiritual life is not for vain recitation contests.";
	}

	if (/moon in the waning fortnight|moon in the waxing fortnight/i.test(text)) {
		return "When the Buddha asks Mahākassapa to advise the mendicants, Kassapa teaches that lacking faith, conscience, prudence, energy, and wisdom leads to decline like the waning moon, while possessing them leads to growth like the waxing moon.";
	}

	if (/senior mendicants lived in the wilderness|well-known and famous, a recipient of robes/i.test(text)) {
		return "When the Buddha asks Mahākassapa to advise the mendicants, Kassapa laments that senior monks now honor famous recipients of gifts rather than wilderness ascetics, leading juniors to lasting harm instead of welfare.";
	}

	if (/whenever i want.*first absorption|and so does kassapa/i.test(text)) {
		return "The Buddha declares that whenever he enters the absorptions, wields psychic powers, recollects past lives, sees beings' rebirths, and realizes freedom from defilements, Venerable Mahākassapa can do the same.";
	}

	if (/nuns'? quarters|needle peddler|needle maker/i.test(text)) {
		return "When Ānanda invites Mahākassapa to teach nuns, the nun Thullatissā insults him as a needle peddler before the Videhan sage; the Buddha then asks whether he praised Ānanda or Kassapa before the Saṅgha for attaining the absorptions.";
	}

	if (/wandering together with these junior mendicants|followed another religion/i.test(text)) {
		return "Mahākassapa rebukes Ānanda for wandering with careless junior mendicants whose protégés disrobe; after the nun Thullanandā slanders him, Kassapa recounts how he went forth and first recognized the Buddha at the Many Sons Shrine.";
	}

	if (/does a realized one still exist after death|not been declared by the buddha/i.test(text)) {
		return "Venerable Sāriputta asks Mahākassapa whether a realized one still exists, no longer exists, both, or neither after death; Kassapa explains these points were not declared because they do not lead to disillusionment, while the four noble truths were.";
	}

	if (/counterfeit of the true teaching|fewer training rules but more enlightened/i.test(text)) {
		return "Mahākassapa asks why there used to be fewer training rules and more enlightened mendicants; the Buddha teaches that the true teaching disappears when its counterfeit appears—like native gold vanishing when counterfeit gold arises—and lists five factors of decline and five of endurance.";
	}

	if (title && title.length > 2) {
		return `The Buddha teaches on Venerable Mahākassapa regarding ${title.toLowerCase()}, holding him up as a model of austere conduct, wisdom, and dedication to the training.`;
	}

	return "The Buddha teaches on Venerable Mahākassapa, one of his foremost disciples in ascetic practice, as a model for mendicants on the path to liberation.";
}

export function buildSn26Description(title, body, slug) {
	const titleLower = title.toLowerCase();
	const topic = SN26_TOPIC_BY_TITLE[titleLower];
	if (topic) {
		return `The Buddha teaches that the arising, continuation, and manifestation of ${topic} is the arising of suffering, the continuation of disease, and the manifestation of old age and death—and that their cessation is the cessation of suffering.`;
	}
	return "The Buddha teaches that the arising of phenomena in experience is the arising of suffering, disease, and old age and death—and that their cessation is the cessation of suffering.";
}

export function buildSn27Description(title, body, slug) {
	const titleLower = title.toLowerCase();
	const topic = SN27_TOPIC_BY_TITLE[titleLower];
	if (topic) {
		return `The Buddha teaches that desire and greed for ${topic} is a corruption of the mind that must be abandoned so the mind inclines to renunciation and becomes fit for realizing anything attainable by insight.`;
	}
	return "The Buddha teaches that desire and greed for phenomena in experience corrupt the mind and must be abandoned so the mind inclines to renunciation and insight.";
}

export function inferSn16Themes(text) {
	const themes = inferThemes(text);
	if (/counterfeit of the true teaching|decline and disappearance of the true teaching|fewer enlightened/i.test(text)) {
		return themes.includes("urgency") ? themes.slice(0, 2) : ["urgency", themes[0] ?? "wisdom"].slice(0, 2);
	}
	if (/realized one still exist after death|not been declared by the buddha|four noble truths/i.test(text)) {
		return themes.includes("cultivating discernment")
			? themes.slice(0, 2)
			: ["wisdom", "cultivating discernment"];
	}
	if (/first absorption|psychic power|and so does kassapa/i.test(text)) {
		return themes.includes("inspiration")
			? themes.slice(0, 2)
			: ["inspiration", themes[0] ?? "directly knowing"].slice(0, 2);
	}
	if (/ānanda|sāriputta|nuns|thulla|needle peddler|rebuke/i.test(text)) {
		return themes.includes("story") ? themes.slice(0, 2) : ["story", themes[0] ?? "training guideline"].slice(0, 2);
	}
	if (/content|wilderness|almsfood|rag robes|approach families|teaching is pure/i.test(text)) {
		return themes.includes("training guideline")
			? themes.slice(0, 2)
			: ["training guideline", themes[0] ?? "inspiration"].slice(0, 2);
	}
	return themes.includes("inspiration") ? themes.slice(0, 2) : ["inspiration", themes[0] ?? "recollection of the Buddha"].slice(0, 2);
}

export function inferSn26Themes(text) {
	const themes = inferThemes(text);
	if (/arising of suffering|cessation of suffering|old age and death/i.test(text)) {
		return themes.includes("principle") ? themes.slice(0, 2) : ["principle", themes[0] ?? "wisdom"].slice(0, 2);
	}
	return themes.includes("wisdom") ? themes.slice(0, 2) : ["wisdom", themes[0] ?? "principle"].slice(0, 2);
}

export function inferSn27Themes(text) {
	const themes = inferThemes(text);
	if (/corruption of the mind|desire and greed|renunciation|realized by insight/i.test(text)) {
		return themes.includes("training guideline")
			? themes.slice(0, 2)
			: ["training guideline", themes[0] ?? "wisdom"].slice(0, 2);
	}
	return themes.includes("wisdom") ? themes.slice(0, 2) : ["wisdom", themes[0] ?? "principle"].slice(0, 2);
}

const SN43_PATH_BY_TITLE = {
	"mindfulness of the body": "mindfulness of the body",
	"serenity and discernment": "serenity and discernment",
	"placing the mind and keeping it connected": "placing the mind and keeping it connected",
	"emptiness immersion": "emptiness immersion",
	"mindfulness meditation": "mindfulness meditation",
	"right efforts": "the four right efforts",
	"right powers": "the five powers",
	"right faculties": "the five faculties",
	"right factors of awakening": "the seven awakening factors",
	"right path": "the noble eightfold path",
	"right release": "the eight liberations",
};

const SN28_ABSORPTION_BY_TITLE = {
	"born of seclusion": "the first absorption, born of seclusion with rapture and bliss while placing the mind and keeping it connected",
	"without placing the mind": "the second absorption, with internal confidence and unified mind without placing the mind and keeping it connected",
	rapture: "the third absorption, with equanimity, mindfulness, and clear awareness while experiencing bliss with the body",
	equanimity: "the fourth absorption, with pure equanimity and mindfulness, neither pleasure nor pain",
	"the dimension of infinite space": "the dimension of infinite space by going beyond all form and perceptions of resistance",
	"the dimension of infinite consciousness": "the dimension of infinite consciousness by going totally beyond the dimension of infinite space",
	"the dimension of nothingness": "the dimension of nothingness by going totally beyond the dimension of infinite consciousness",
	"the dimension of neither perception nor non-perception":
		"the dimension of neither perception nor non-perception by going totally beyond the dimension of nothingness",
	"the cessation of perception and feeling": "the cessation of perception and feeling by going totally beyond the dimension of neither perception nor non-perception",
};

export function buildSn3Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (/king pasenadi|pasenadi of kosala/i.test(text)) {
		if (/bad friends.*ajātasattu|ajātasattu has bad friends/i.test(text)) {
			return "After King Ajātasattu defeats King Pasenadi in battle, the Buddha teaches that Ajātasattu has bad friends, companions, and associates, while Pasenadi has good ones—and that good friendship is the whole of the spiritual life.";
		}
		if (/awakened to the supreme perfect awakening|newly gone forth/i.test(text)) {
			return "King Pasenadi questions whether the young Buddha can claim supreme awakening; the Buddha affirms it and teaches that an aristocrat, serpent, fire, and mendicant should not be disparaged for their youth.";
		}
		if (/four things should not be looked down upon/i.test(text)) {
			return "King Pasenadi asks the Buddha about his claim to awakening; the Buddha teaches four things that should not be disparaged for being young—an aristocrat, serpent, fire, and mendicant.";
		}
		if (/judgment|sacrifice|shackles|matted-hair|five kings/i.test(title.toLowerCase())) {
			return `King Pasenadi of Kosala visits the Buddha and hears teaching on ${title.toLowerCase()}, exploring ethics, kingship, and the Dhamma through dialogue and simile.`;
		}
		return `King Pasenadi of Kosala visits the Buddha and discusses ${title.toLowerCase()}, receiving guidance on conduct, wisdom, and the spiritual life.`;
	}

	if (/king ajātasattu|ajātasattu of magadha/i.test(text)) {
		return `The Buddha teaches on King Ajātasattu regarding ${title.toLowerCase()}, contrasting unwholesome friendship and conduct with the path of ethics and wisdom.`;
	}

	if (/mendicants.*told him what had happened|two kings met in battle/i.test(text)) {
		return "When mendicants report that King Ajātasattu defeated King Pasenadi in battle, the Buddha teaches that Ajātasattu has bad friends while Pasenadi has good friends, and that companionship shapes one's destiny.";
	}

	if (title && title.length > 2) {
		return `The Buddha teaches King Pasenadi of Kosala on ${title.toLowerCase()}, using dialogue and simile to guide a ruler toward the Dhamma.`;
	}

	return "The Buddha teaches kings and mendicants in the Connected Discourses with Kings, showing how rulers may approach the Dhamma through ethical conduct and wise friendship.";
}

export function buildSn7Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));
	const brahmin = title.replace(/^with /i, "").trim() || "a brahmin";

	if (/addressed the buddha in verse|said to the buddha in verse/i.test(text)) {
		if (/sleep at ease|slain do you sleep|no sorrow/i.test(text)) {
			return `The brahmin ${brahmin} asks the Buddha in verse what must be slain to sleep at ease without sorrow; the Teacher answers that anger—with its poisonous root, festering core, and striking out—must be cut off.`;
		}
		if (/fire-worshiper|fire sacrifice|sacrifice/i.test(text)) {
			return `The brahmin ${brahmin}, a fire-worshiper, challenges the Buddha in verse on sacrifice and purity; the Teacher teaches that true purity comes from ethical conduct and abandoning harmful deeds, not ritual offerings.`;
		}
		return `The brahmin ${brahmin} approaches the Buddha in verse on ${title.toLowerCase()}, and the Teacher answers with a teaching on ethics, wisdom, and liberation.`;
	}

	if (/dhanañjānī|lowlife woman|refute your teacher/i.test(text)) {
		return "When the brahmin lady Dhanañjānī pays homage to the Buddha, her husband storms off to refute him; the Buddha answers his verse question on cutting off anger, and Dhanañjānī later guides her husband back to the Teacher.";
	}

	if (/many daughters|no sons|brahmin.*daughters/i.test(text)) {
		return `The brahmin ${brahmin} laments having many daughters and no sons; the Buddha teaches that daughters may be as good as sons when they are ethical, learned, and devoted to their husbands.`;
	}

	if (/farmer|plough|field/i.test(text)) {
		return `The brahmin ${brahmin} boasts of his lineage and learning; the Buddha refutes pride in birth and teaches that a true brahmin is one who has abandoned unwholesome qualities and lives by ethical conduct.`;
	}

	if (/devahita|carried on a litter|sick/i.test(text)) {
		return `The brahmin ${brahmin}, carried on a litter while ill, visits the Buddha and receives teaching on ${title.toLowerCase()}, ethics, and the qualities of a true brahmin.`;
	}

	if (/refute|contradict|teacher's doctrine/i.test(text)) {
		return `The angry brahmin ${brahmin} sets out to refute the Buddha's doctrine but is answered with teaching on ${title.toLowerCase()}, ethical conduct, and the ending of defilements.`;
	}

	if (title && title.length > 2 && /^with /i.test(title)) {
		return `The brahmin ${brahmin} visits the Buddha and discusses ${title.toLowerCase()}, receiving teaching on conduct, wisdom, and what makes a true brahmin.`;
	}

	return "The Buddha teaches brahmins in dialogue and verse, refuting pride in birth and ritual while guiding them toward ethical conduct and wisdom.";
}

export function buildSn9Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (/deity haunting that forest|deity.*addressed them in verse|forest deity/i.test(text)) {
		if (/domestic life|outward things|desiring seclusion/i.test(text)) {
			return "A forest deity, sympathizing with a mendicant whose mind strays to domestic life during meditation, admonishes him in verse to dispel desire for people, give up discontent, and cross the dusty abyss of sensuality.";
		}
		if (/kassapagotta|several mendicants set out wandering/i.test(text)) {
			return `A forest deity admonishes mendicants in verse on ${title.toLowerCase()}, urging mindfulness, seclusion, and diligence on the path beyond sensual dust.`;
		}
		return `A forest deity approaches a mendicant in verse on ${title.toLowerCase()}, encouraging seclusion, mindfulness, and freedom from sensual desire.`;
	}

	if (/the buddha addressed.*mendicants/i.test(text) && /forest|deity/i.test(text)) {
		return `The Buddha teaches mendicants about a forest deity's verse admonition on ${title.toLowerCase()}, illustrating the value of seclusion and mindfulness.`;
	}

	if (/with ānanda|ānanda/i.test(text)) {
		return `The Buddha or a forest deity teaches on ${title.toLowerCase()} regarding seclusion, mindfulness, and overcoming distraction in wilderness practice.`;
	}

	if (title && title.length > 2) {
		return `A forest deity or the Buddha teaches on ${title.toLowerCase()}, encouraging mendicants in seclusion to guard the mind against sensuality and negligence.`;
	}

	return "A forest deity admonishes a mendicant in verse to cherish seclusion, mindfulness, and diligence, freeing the mind from domestic distractions and sensual dust.";
}

export function buildSn15Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (/transmigration has no known beginning|no first point is found/i.test(text)) {
		if (/grass, sticks, branches, and leaves|black plum tree land/i.test(text)) {
			return "The Buddha teaches that transmigration has no known beginning and that mothers and grandmothers would outnumber all the grass, sticks, branches, and leaves in the Black Plum Tree Land if one tried to count them across beginningless rebirths.";
		}
		if (/tears|mother's milk|mother's milk/i.test(text)) {
			return `The Buddha teaches that transmigration has no known beginning, using the simile of ${title.toLowerCase()} to show how long beings have roamed shrouded by ignorance and fettered by craving.`;
		}
		if (/single individual|one person/i.test(text)) {
			return "The Buddha teaches that transmigration has no known beginning, showing that a single individual's mothers and fathers across aeons would exceed the sands of the Ganges.";
		}
		if (/mount vepulla|rajgir/i.test(text)) {
			return "The Buddha teaches at Mount Vepulla near Rājagaha that transmigration has no known beginning, and that the mountain has worn away over aeons while beings have continued to roam fettered by ignorance and craving.";
		}
		if (/thirty mendicants/i.test(text)) {
			return "Thirty mendicants, each claiming to have few defilements remaining, are taught by the Buddha that transmigration has no known beginning and that the mass of suffering they have already undergone is vast beyond measure.";
		}
		return "The Buddha teaches mendicants that transmigration has no known beginning, with no first point found of beings roaming shrouded by ignorance and fettered by craving.";
	}

	if (title && title.length > 2) {
		return `The Buddha teaches on ${title.toLowerCase()} to illustrate that transmigration has no known beginning and that ignorance and craving have long bound beings to suffering.`;
	}

	return "The Buddha teaches that transmigration has no known beginning, using vivid similes to show how long beings have wandered shrouded by ignorance and fettered by craving.";
}

export function buildSn17Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		return `The Buddha teaches a repeated formula on possessions, honor, and popularity as grim, bitter, and harsh obstacles to the supreme sanctuary from the yoke, illustrated by ${title.toLowerCase()} in this grouped discourse.`;
	}

	if (/devadatta/i.test(text)) {
		return "Not long after Devadatta's departure, the Buddha teaches that possessions, honor, and popularity came to Devadatta for his own ruin and downfall, using similes of banana plants, bamboo, reeds, and a mule that bear fruit to their destruction.";
	}

	if (/five hundred carts|mother|father/i.test(text)) {
		return `The Buddha teaches that possessions, honor, and popularity are grim, bitter, and harsh obstacles to liberation, using the simile of ${title.toLowerCase()} to show how they bind and destroy the unwary.`;
	}

	if (/possessions, honor, and popularity are grim/i.test(text)) {
		return "The Buddha teaches mendicants that possessions, honor, and popularity are grim, bitter, and harsh—an obstacle to reaching the supreme sanctuary from the yoke—and that they should train to give up arisen gains and not let them occupy the mind.";
	}

	if (title && title.length > 2) {
		return `The Buddha teaches on ${title.toLowerCase()} that possessions, honor, and popularity are grim, bitter, and harsh, and an obstacle to the supreme sanctuary from the yoke.`;
	}

	return "The Buddha warns mendicants that possessions, honor, and popularity are grim, bitter, and harsh obstacles to liberation, urging them to give up arisen gains and not let worldly success occupy the mind.";
}

export function buildSn28Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));
	const titleLower = title.toLowerCase();
	const absorption = SN28_ABSORPTION_BY_TITLE[titleLower];

	if (absorption) {
		return `Venerable Sāriputta tells Ānanda that in private retreat he entered and remained in ${absorption}, explaining how his faculties grew clear and his complexion bright through that meditation.`;
	}

	if (/first absorption|second absorption|third absorption|fourth absorption/i.test(text)) {
		const which = text.match(/(first|second|third|fourth) absorption/i)?.[0]?.toLowerCase() ?? "an absorption";
		return `Venerable Sāriputta tells Ānanda that in private retreat he entered and remained in the ${which}, and that his faculties grew clear and his complexion pure and bright through that meditation.`;
	}

	if (/dimension of infinite|dimension of nothingness|neither perception nor non-perception|cessation of perception and feeling/i.test(text)) {
		return `Venerable Sāriputta tells Ānanda about attaining ${title.toLowerCase()} in private retreat, describing how his faculties grew clear through that formless meditation.`;
	}

	if (title && title.length > 2) {
		return `Venerable Sāriputta describes to Ānanda his meditation on ${title.toLowerCase()} in private retreat, showing the clarity and brightness that arise from deep collectedness.`;
	}

	return "Venerable Sāriputta describes to Ānanda the absorptions and formless attainments he practiced in private retreat, illustrating the clarity of faculties that comes from deep meditation.";
}

export function buildSn33Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-") || /five discourses on/i.test(title)) {
		const verb =
			title.match(/on (Not \w+)/i)?.[1]?.toLowerCase() ??
			text.match(/because of (not \w+)/i)?.[1]?.toLowerCase() ??
			"not comprehending";
		const aggregate =
			/not comprehending form|not understanding form|not penetrating form|not distinguishing form|not detecting form/i.test(
				title + text,
			)
				? "form, feeling, perception, choices, and consciousness"
				: "the aggregates";
		return `The Buddha teaches Vaccha that it is because of ${verb} ${aggregate} that beings are not freed from death, and that comprehending them leads to direct knowledge of the unconditioned.`;
	}

	if (/unconditioned|ending of greed, hate, and delusion/i.test(text)) {
		return "The Buddha teaches the wanderer Vaccha that not comprehending the five aggregates keeps beings bound to death, while direct knowledge of the aggregates leads to realizing the unconditioned.";
	}

	return "The Buddha teaches the wanderer Vaccha how failure to comprehend the five aggregates binds beings to death, and how insight into them leads to the unconditioned.";
}

export function buildSn34Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		return `The Buddha teaches a repeated formula on four meditators distinguished by skill in immersion and ${title.toLowerCase()}, declaring the one skilled in both to be foremost, applied across this grouped discourse.`;
	}

	const skill = title.toLowerCase();
	if (/four meditators|skilled in immersion/i.test(text)) {
		return `The Buddha teaches four meditators—skilled in immersion, in ${skill}, in both, or in neither—and declares the one skilled in both immersion and ${skill} to be foremost, best, and finest, like cream of ghee among dairy products.`;
	}

	if (title && title.length > 2) {
		return `The Buddha teaches four meditators distinguished by skill in immersion and ${title.toLowerCase()}, showing which combination is foremost for developing deep collectedness.`;
	}

	return "The Buddha teaches four kinds of meditators distinguished by skill in immersion and related meditative abilities, declaring the one accomplished in both to be foremost.";
}

export function buildSn38Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));
	const topic = title.toLowerCase();

	if (/jambukhādaka|wanderer.*sāriputta/i.test(text)) {
		if (/what is extinguishment|ending of greed, hate, and delusion/i.test(text)) {
			return "The wanderer Jambukhādaka asks Venerable Sāriputta what extinguishment is; Sāriputta answers that it is the ending of greed, hate, and delusion, and teaches the noble eightfold path as the practice leading to it.";
		}
		if (/path and a practice for realizing/i.test(text)) {
			return `The wanderer Jambukhādaka asks Venerable Sāriputta about ${topic} and the path to realizing it; Sāriputta answers with concise teaching on the Dhamma and the noble practice.`;
		}
		if (/feeling|perception|consciousness|extinguishment|solace|principled speech/i.test(topic)) {
			return `The wanderer Jambukhādaka questions Venerable Sāriputta on ${topic}; Sāriputta answers with clear analysis of the Dhamma and the practice leading to extinguishment.`;
		}
		return `The wanderer Jambukhādaka questions Venerable Sāriputta on ${topic}, receiving concise teaching on the path to liberation.`;
	}

	if (title && title.length > 2) {
		return `Venerable Sāriputta answers the wanderer Jambukhādaka on ${topic}, explaining the Dhamma and the practice that leads to extinguishment.`;
	}

	return "Venerable Sāriputta answers the wanderer Jambukhādaka's questions on the Dhamma, defining key terms and pointing to the noble path as the way to extinguishment.";
}

export function buildSn41Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (/householder citta|cittta of macchikāsaṇḍa/i.test(text)) {
		if (/fetter.*things that tighten fetters/i.test(text)) {
			return "When senior mendicants dispute whether the fetter and the things that tighten fetters differ in meaning, the householder Citta resolves the question, teaching that the five lower fetters are one thing and the five kinds of sensual stimulation another.";
		}
		if (/psychic power|demonstration|display/i.test(text)) {
			return `The householder Citta invites mendicants to witness ${title.toLowerCase()} and discusses with them the qualities of a noble disciple who has direct knowledge of the Dhamma.`;
		}
		if (/godatta|isidatta|kāmabhū/i.test(text)) {
			const guest = title.match(/with (\w+)/i)?.[1] ?? "a visitor";
			return `The householder Citta discusses ${title.toLowerCase()} with ${guest}, teaching on fetters, immersion, and the qualities of a noble disciple in the lay life.`;
		}
		return `The householder Citta of Macchikāsaṇḍa teaches mendicants and visitors on ${title.toLowerCase()}, displaying the learning and direct knowledge of an exemplary lay disciple.`;
	}

	if (title && title.length > 2) {
		return `The householder Citta teaches on ${title.toLowerCase()}, showing the wisdom and direct knowledge of an exemplary lay follower.`;
	}

	return "The householder Citta of Macchikāsaṇḍa teaches mendicants and visitors on the Dhamma, displaying the wisdom, faith, and direct knowledge of an exemplary lay disciple.";
}

export function buildSn42Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (/headman|gaṇaka|householder/i.test(text)) {
		if (/simile of the field|field/i.test(title.toLowerCase())) {
			return "The Buddha teaches a headman the simile of the field, showing how deeds of body, speech, and mind are like seeds sown in a field that yield their fruit in this life and the next.";
		}
		if (/horn blower|horn/i.test(title.toLowerCase())) {
			return "The Buddha teaches a headman using the simile of a horn blower to illustrate how one who proclaims the Dhamma must first master it oneself before instructing others.";
		}
		if (/families|household/i.test(title.toLowerCase())) {
			return "The Buddha teaches headmen on the qualities that sustain families in welfare and the reciprocal duties that support ethical household life.";
		}
		return `The Buddha teaches a headman or householder on ${title.toLowerCase()}, using simile and dialogue to guide lay followers toward ethical conduct and wisdom.`;
	}

	if (title && title.length > 2) {
		return `The Buddha teaches headmen and householders on ${title.toLowerCase()}, guiding lay followers toward ethical conduct, generosity, and confidence in the Dhamma.`;
	}

	return "The Buddha teaches headmen and householders in dialogue and simile, guiding lay followers toward ethical conduct and wisdom in household life.";
}

export function buildSn43Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));
	const titleLower = title.toLowerCase();
	const path = SN43_PATH_BY_TITLE[titleLower] ?? titleLower;

	return `The Buddha teaches mendicants the unconditioned—defined as the ending of greed, hate, and delusion—and declares ${path} to be the path that leads to the unconditioned, urging them to practice absorption without negligence.`;
}

export function buildSn51Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		if (/slants, slopes, and inclines/i.test(text)) {
			return "The Buddha teaches a repeated simile of great rivers slanting, sloping, and inclining to the east or ocean, showing how a mendicant who develops the four bases of psychic power likewise inclines to extinguishment, applied across each river in this grouped discourse.";
		}
		if (/tell in full|plain version/i.test(text)) {
			return `The Buddha presents a repeated teaching on the four bases of psychic power regarding ${title.toLowerCase()} in this grouped discourse.`;
		}
		return `The Buddha teaches a repeated formula on the four bases of psychic power—enthusiasm, energy, mental development, and inquiry with active effort—regarding ${title.toLowerCase()} in this grouped discourse.`;
	}

	if (/moggallāna.*psychic power|strike awe|longhouse.*shake/i.test(text)) {
		return "When restless mendicants stay beneath Migāra's Mother's longhouse, the Buddha sends Venerable Mahāmoggallāna to strike awe in them by shaking the building with his toe, then teaches the four bases of psychic power developed with immersion and active effort.";
	}

	if (/iron ball|hot iron ball/i.test(text)) {
		return "The Buddha teaches that when the four bases of psychic power are developed and cultivated, they lead to going from the near shore to the far shore, using the simile of an iron ball heated all day.";
	}

	if (/four bases of psychic power|immersion due to enthusiasm/i.test(text)) {
		return `The Buddha teaches on the four bases of psychic power—immersion due to enthusiasm, energy, mental development, and inquiry, each with active effort—showing how they are developed and cultivated regarding ${title.toLowerCase()}.`;
	}

	if (title && title.length > 2) {
		return `The Buddha teaches on the four bases of psychic power regarding ${title.toLowerCase()}, showing how enthusiasm, energy, mental development, and inquiry lead toward liberation.`;
	}

	return "The Buddha teaches the four bases of psychic power—developed with immersion due to enthusiasm, energy, mental development, and inquiry together with active effort—as the way from the near shore to the far shore.";
}

export function buildSn52Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (/anuruddha.*private retreat|four kinds of mindfulness meditation/i.test(text)) {
		if (/undertaking of the four kinds/i.test(text)) {
			return "Venerable Anuruddha reflects that whoever misses out on the four kinds of mindfulness meditation misses the noble path to the ending of suffering; Venerable Mahāmoggallāna asks how they are undertaken, and Anuruddha defines internal, external, and both, observing origination and vanishing.";
		}
		if (/in private/i.test(title.toLowerCase())) {
			return `Venerable Anuruddha reflects in private retreat on the four kinds of mindfulness meditation regarding ${title.toLowerCase()}, declaring that undertaking them is undertaking the noble path to the complete ending of suffering.`;
		}
		return "Venerable Anuruddha teaches that the four kinds of mindfulness meditation—regarding body, feelings, mind, and principles—are the noble path to the complete ending of suffering when undertaken with keen awareness.";
	}

	if (/on the bank of the sutanu|thorny wood/i.test(title.toLowerCase())) {
		return `Venerable Anuruddha teaches mendicants at ${title.toLowerCase()} on the four kinds of mindfulness meditation and their role on the noble path to the ending of suffering.`;
	}

	if (/four kinds of mindfulness|mindfulness meditation/i.test(text)) {
		return `Venerable Anuruddha teaches on the four kinds of mindfulness meditation regarding ${title.toLowerCase()}, showing how they fulfill the noble path to the ending of suffering.`;
	}

	if (title && title.length > 2) {
		return `Venerable Anuruddha teaches on the four kinds of mindfulness meditation regarding ${title.toLowerCase()}, as the noble path to the complete ending of suffering.`;
	}

	return "Venerable Anuruddha teaches that the four kinds of mindfulness meditation constitute the noble path to the complete ending of suffering when developed with keen awareness and clear comprehension.";
}

export function buildSn53Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		if (/slants, slopes, and inclines/i.test(text)) {
			return "The Buddha teaches a repeated simile of great rivers slanting, sloping, and inclining to the east, showing how a mendicant who develops the four absorptions likewise inclines to extinguishment, applied across each river in this grouped discourse.";
		}
		if (/floods|diligence|hard work|searches/i.test(title.toLowerCase())) {
			return `The Buddha teaches a repeated formula on the four absorptions regarding ${title.toLowerCase()}, showing how they are developed and cultivated to incline the mind toward extinguishment in this grouped discourse.`;
		}
		return `The Buddha presents a repeated teaching on the four absorptions regarding ${title.toLowerCase()} in this grouped discourse.`;
	}

	if (/four absorptions|first absorption|jhāna/i.test(text)) {
		return `The Buddha teaches that when the four absorptions are developed and cultivated they lead to going from the near shore to the far shore, explaining how they are cultivated regarding ${title.toLowerCase()}.`;
	}

	if (title && title.length > 2) {
		return `The Buddha teaches on the four absorptions regarding ${title.toLowerCase()}, showing how deep collectedness inclines the mind toward extinguishment.`;
	}

	return "The Buddha teaches that the four absorptions, when developed and cultivated, lead from the near shore to the far shore, inclining the mind toward extinguishment.";
}

export function buildSn54Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (/mindfulness of breathing|breathe in|breathe out/i.test(text)) {
		if (/sixteen|I'll breathe in experiencing/i.test(text) || /whole body|still.*physical process|gladdening the mind|liberating the mind|inconstant|fading away|cessation|letting go/i.test(text)) {
			return `The Buddha teaches how mindfulness of breathing is developed through sixteen steps—from knowing long and short breaths through experiencing the whole body, stilling bodily and mental processes, gladdening and liberating the mind, to contemplating impermanence, fading away, cessation, and letting go—regarding ${title.toLowerCase()}.`;
		}
		if (/fruits|benefits|very fruitful/i.test(title.toLowerCase())) {
			return `The Buddha teaches the fruits and benefits of developing mindfulness of breathing regarding ${title.toLowerCase()}, showing how this one practice is very fruitful when cultivated in seclusion.`;
		}
		if (/with ariṭṭha|mahākappina/i.test(title.toLowerCase())) {
			return `The Buddha teaches mindfulness of breathing to or through the example of ${title.replace(/^with |^about /i, "").toLowerCase()}, showing how breath meditation leads to deep collectedness and insight.`;
		}
		return `The Buddha teaches that mindfulness of breathing, when developed and cultivated regarding ${title.toLowerCase()}, is very fruitful and beneficial for one gone to a wilderness, tree root, or empty hut.`;
	}

	if (title && title.length > 2) {
		return `The Buddha teaches on mindfulness of breathing regarding ${title.toLowerCase()}, guiding mendicants through breath meditation toward collectedness and insight.`;
	}

	return "The Buddha teaches mindfulness of breathing as a very fruitful practice, developed in seclusion through knowing the breath and calming body and mind on the path to liberation.";
}

export function buildSn55Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (/experiential confidence in the buddha|four things.*exempt from hell|wheel-turning monarch/i.test(text)) {
		return `The Buddha teaches the four factors of stream-entry—experiential confidence in the Buddha, the teaching, and the Saṅgha, and ethical conduct loved by the noble ones—showing how they protect a noble disciple from loss and lead to heaven, regarding ${title.toLowerCase()}.`;
	}

	if (/stream-entry|stream-enterer|entered the stream/i.test(text)) {
		return `The Buddha teaches on stream-entry regarding ${title.toLowerCase()}, explaining the four factors of a noble disciple and the qualities that ensure liberation from loss and rebirth in heaven.`;
	}

	if (/chamberlains|isidatta|purāṇa|brick hall|thousand nuns/i.test(text)) {
		return `The Buddha teaches lay followers on ${title.toLowerCase()}, explaining the four factors of stream-entry and the great merit of experiential confidence in the Buddha, teaching, Saṅgha, and noble ethics.`;
	}

	if (/four factors|four qualities|four things/i.test(text)) {
		return `The Buddha teaches the four factors of stream-entry regarding ${title.toLowerCase()}—experiential confidence in the Buddha, teaching, and Saṅgha, and ethical conduct loved by the noble ones.`;
	}

	if (title && title.length > 2) {
		return `The Buddha teaches on the factors of stream-entry regarding ${title.toLowerCase()}, showing how confidence in the Triple Gem and noble ethics lead to liberation from loss.`;
	}

	return "The Buddha teaches the four factors of stream-entry—experiential confidence in the Buddha, teaching, and Saṅgha, and ethical conduct loved by the noble ones—as the protection of a noble disciple.";
}

export function buildSn56Description(title, body, slug) {
	const text = cleanLine(stripSegments(body).replace(/\n+/g, " "));

	if (slug.includes("-")) {
		if (/tell in full|plain version/i.test(text)) {
			return `The Buddha presents a repeated teaching on the four noble truths regarding ${title.toLowerCase()} in this grouped discourse.`;
		}
		return `The Buddha teaches a repeated formula on the four noble truths—suffering, its origin, its cessation, and the practice leading to its cessation—regarding ${title.toLowerCase()} in this grouped discourse.`;
	}

	if (/rolling forth the wheel of dhamma|deer park at isipatana|group of five mendicants/i.test(text)) {
		return "At the deer park in Isipatana, the Buddha sets rolling the Wheel of Dhamma for the group of five mendicants, teaching the middle way and the four noble truths of suffering, its origin, its cessation, and the practice leading to its cessation.";
	}

	if (/two extremes should not be cultivated|indulgence in sensual pleasures|self-mortification/i.test(text)) {
		return "The Buddha teaches the group of five mendicants to avoid the two extremes of sensual indulgence and self-mortification, declaring the noble eightfold path as the middle way and expounding the four noble truths.";
	}

	if (/develop immersion|meditate in retreat|diligent|keen|resolute|independent|firmly strive/i.test(text)) {
		const titleLower = title.toLowerCase();
		let urge;
		if (titleLower === "retreat") urge = "meditate in retreat";
		else if (titleLower === "immersion") urge = "develop immersion";
		else if (titleLower.startsWith("a gentleman")) urge = "practice like a gentleman";
		else urge = `be ${titleLower}`;
		return `The Buddha urges mendicants to ${urge} and truly understand the four noble truths—that this is suffering, its origin, its cessation, and the practice leading to the cessation of suffering.`;
	}

	if (/noble truth of suffering|origin of suffering|cessation of suffering|practice that leads to the cessation/i.test(text)) {
		if (/simile|like a|just as/i.test(text)) {
			return `The Buddha teaches the four noble truths using the simile of ${title.toLowerCase()}, showing why understanding suffering, its origin, its cessation, and the path is essential for liberation.`;
		}
		return `The Buddha teaches the four noble truths regarding ${title.toLowerCase()}—suffering, its origin, its cessation, and the practice leading to its cessation.`;
	}

	if (/gentleman|thought|arguments|penetration|breakthrough|gratification|drawback|escape/i.test(title.toLowerCase())) {
		return `The Buddha teaches a gentleman or mendicant to understand the four noble truths regarding ${title.toLowerCase()}, emphasizing direct knowledge of suffering and the path to its cessation.`;
	}

	if (title && title.length > 2) {
		return `The Buddha teaches the four noble truths regarding ${title.toLowerCase()}, urging mendicants to practice for direct knowledge of suffering, its origin, its cessation, and the path.`;
	}

	return "The Buddha teaches the four noble truths of suffering, its origin, its cessation, and the practice leading to its cessation, urging mendicants to develop direct knowledge through meditation and diligence.";
}

export function inferSn3Themes(text) {
	const themes = inferThemes(text);
	if (/king pasenadi|king ajātasattu|battle|good friends/i.test(text)) {
		return themes.includes("story") ? themes.slice(0, 2) : ["story", themes[0] ?? "wisdom"].slice(0, 2);
	}
	return themes.includes("wisdom") ? themes.slice(0, 2) : ["wisdom", themes[0] ?? "story"].slice(0, 2);
}

export function inferSn7Themes(text) {
	const themes = inferThemes(text);
	if (/brahmin|verse|fire-worshiper|sacrifice/i.test(text)) {
		return themes.includes("cultivating discernment")
			? themes.slice(0, 2)
			: ["cultivating discernment", themes[0] ?? "wisdom"].slice(0, 2);
	}
	return themes.includes("wisdom") ? themes.slice(0, 2) : ["wisdom", themes[0] ?? "story"].slice(0, 2);
}

export function inferSn9Themes(text) {
	const themes = inferThemes(text);
	if (/forest|seclusion|deity|verse/i.test(text)) {
		return themes.includes("training guideline")
			? themes.slice(0, 2)
			: ["training guideline", themes[0] ?? "inspiration"].slice(0, 2);
	}
	return themes.includes("training guideline") ? themes.slice(0, 2) : ["training guideline", themes[0] ?? "wisdom"].slice(0, 2);
}

export function inferSn15Themes(text) {
	const themes = inferThemes(text);
	if (/transmigration has no known beginning|no first point/i.test(text)) {
		return themes.includes("urgency") ? themes.slice(0, 2) : ["urgency", themes[0] ?? "wisdom"].slice(0, 2);
	}
	return themes.includes("principle") ? themes.slice(0, 2) : ["principle", themes[0] ?? "urgency"].slice(0, 2);
}

export function inferSn17Themes(text) {
	const themes = inferThemes(text);
	if (/possessions, honor, and popularity|devadatta/i.test(text)) {
		return themes.includes("urgency") ? themes.slice(0, 2) : ["urgency", themes[0] ?? "training guideline"].slice(0, 2);
	}
	return themes.includes("training guideline") ? themes.slice(0, 2) : ["training guideline", themes[0] ?? "urgency"].slice(0, 2);
}

export function inferSn28Themes(text) {
	const themes = inferThemes(text);
	if (/absorption|dimension of|cessation of perception/i.test(text)) {
		return themes.includes("directly knowing")
			? themes.slice(0, 2)
			: ["training guideline", themes[0] ?? "directly knowing"].slice(0, 2);
	}
	return themes.includes("training guideline") ? themes.slice(0, 2) : ["training guideline", themes[0] ?? "inspiration"].slice(0, 2);
}

export function inferSn33Themes(text) {
	const themes = inferThemes(text);
	if (/unconditioned|not comprehending|aggregates/i.test(text)) {
		return themes.includes("wisdom") ? themes.slice(0, 2) : ["wisdom", themes[0] ?? "principle"].slice(0, 2);
	}
	return themes.includes("principle") ? themes.slice(0, 2) : ["principle", themes[0] ?? "wisdom"].slice(0, 2);
}

export function inferSn34Themes(text) {
	const themes = inferThemes(text);
	if (/four meditators|skilled in immersion/i.test(text)) {
		return themes.includes("training guideline")
			? themes.slice(0, 2)
			: ["training guideline", themes[0] ?? "cultivating discernment"].slice(0, 2);
	}
	return themes.includes("training guideline") ? themes.slice(0, 2) : ["training guideline", themes[0] ?? "principle"].slice(0, 2);
}

export function inferSn38Themes(text) {
	const themes = inferThemes(text);
	if (/jambukhādaka|extinguishment|sāriputta/i.test(text)) {
		return themes.includes("inquisitiveness")
			? themes.slice(0, 2)
			: ["inquisitiveness", themes[0] ?? "wisdom"].slice(0, 2);
	}
	return themes.includes("wisdom") ? themes.slice(0, 2) : ["wisdom", themes[0] ?? "inquisitiveness"].slice(0, 2);
}

export function inferSn41Themes(text) {
	const themes = inferThemes(text);
	if (/householder citta|lay/i.test(text)) {
		return themes.includes("inspiration") ? themes.slice(0, 2) : ["inspiration", themes[0] ?? "wisdom"].slice(0, 2);
	}
	return themes.includes("wisdom") ? themes.slice(0, 2) : ["wisdom", themes[0] ?? "inspiration"].slice(0, 2);
}

export function inferSn42Themes(text) {
	const themes = inferThemes(text);
	if (/headman|householder|families/i.test(text)) {
		return themes.includes("story") ? themes.slice(0, 2) : ["story", themes[0] ?? "training guideline"].slice(0, 2);
	}
	return themes.includes("training guideline") ? themes.slice(0, 2) : ["training guideline", themes[0] ?? "wisdom"].slice(0, 2);
}

export function inferSn43Themes(text) {
	const themes = inferThemes(text);
	if (/unconditioned|path that leads to the unconditioned/i.test(text)) {
		return themes.includes("principle") ? themes.slice(0, 2) : ["principle", themes[0] ?? "training guideline"].slice(0, 2);
	}
	return themes.includes("training guideline") ? themes.slice(0, 2) : ["training guideline", themes[0] ?? "principle"].slice(0, 2);
}

export function inferSn51Themes(text) {
	const themes = inferThemes(text);
	if (/bases of psychic power|psychic power|moggallāna/i.test(text)) {
		return themes.includes("training guideline")
			? themes.slice(0, 2)
			: ["training guideline", themes[0] ?? "directly knowing"].slice(0, 2);
	}
	return themes.includes("training guideline") ? themes.slice(0, 2) : ["training guideline", themes[0] ?? "principle"].slice(0, 2);
}

export function inferSn52Themes(text) {
	const themes = inferThemes(text);
	if (/mindfulness meditation|four kinds of mindfulness/i.test(text)) {
		return themes.includes("training guideline")
			? themes.slice(0, 2)
			: ["training guideline", themes[0] ?? "wisdom"].slice(0, 2);
	}
	return themes.includes("training guideline") ? themes.slice(0, 2) : ["training guideline", themes[0] ?? "principle"].slice(0, 2);
}

export function inferSn53Themes(text) {
	const themes = inferThemes(text);
	if (/four absorptions|jhāna|immersion/i.test(text)) {
		return themes.includes("training guideline")
			? themes.slice(0, 2)
			: ["training guideline", themes[0] ?? "principle"].slice(0, 2);
	}
	return themes.includes("training guideline") ? themes.slice(0, 2) : ["training guideline", themes[0] ?? "wisdom"].slice(0, 2);
}

export function inferSn54Themes(text) {
	const themes = inferThemes(text);
	if (/mindfulness of breathing|breathe in/i.test(text)) {
		return themes.includes("training guideline")
			? themes.slice(0, 2)
			: ["training guideline", themes[0] ?? "directly knowing"].slice(0, 2);
	}
	return themes.includes("training guideline") ? themes.slice(0, 2) : ["training guideline", themes[0] ?? "wisdom"].slice(0, 2);
}

export function inferSn55Themes(text) {
	const themes = inferThemes(text);
	if (/stream-entry|experiential confidence|four factors/i.test(text)) {
		return themes.includes("inspiration")
			? themes.slice(0, 2)
			: ["inspiration", themes[0] ?? "faith"].slice(0, 2);
	}
	return themes.includes("inspiration") ? themes.slice(0, 2) : ["inspiration", themes[0] ?? "wisdom"].slice(0, 2);
}

export function inferSn56Themes(text) {
	const themes = inferThemes(text);
	if (/four noble truths|noble truth of suffering|wheel of dhamma/i.test(text)) {
		return themes.includes("principle") ? themes.slice(0, 2) : ["principle", themes[0] ?? "wisdom"].slice(0, 2);
	}
	if (/develop immersion|meditate in retreat|diligent/i.test(text)) {
		return themes.includes("training guideline")
			? themes.slice(0, 2)
			: ["training guideline", themes[0] ?? "principle"].slice(0, 2);
	}
	return themes.includes("principle") ? themes.slice(0, 2) : ["principle", themes[0] ?? "wisdom"].slice(0, 2);
}
