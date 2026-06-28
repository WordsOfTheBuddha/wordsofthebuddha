#!/usr/bin/env node
/**
 * Apply curated frontmatter to reference-only Sujato markdown files.
 * Usage:
 *   node scripts/apply-an3-dn-curation.mjs [--collection an3|…|sn56|snp3|--all-sn-remaining] [--dry-run]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { buildSujatoMarkdown } from "./lib/sujato-frontmatter.mjs";
import {
	buildAn3Description,
	buildAn5Description,
	buildAn6Description,
	buildAn7Description,
	buildAn8Description,
	buildAn9Description,
	buildAn10Description,
	buildAn11Description,
	buildSn1Description,
	buildSn2Description,
	buildSn3Description,
	buildSn4Description,
	buildSn5Description,
	buildSn6Description,
	buildSn7Description,
	buildSn8Description,
	buildSn9Description,
	buildSn10Description,
	buildSn11Description,
	buildSn12Description,
	buildSn15Description,
	buildSn16Description,
	buildSn17Description,
	buildSn18Description,
	buildSn19Description,
	buildSn21Description,
	buildSn22Description,
	buildSn23Description,
	buildSn24Description,
	buildSn26Description,
	buildSn27Description,
	buildSn28Description,
	buildSn29Description,
	buildSn30Description,
	buildSn31Description,
	buildSn32Description,
	buildSn33Description,
	buildSn34Description,
	buildSn35Description,
	buildSn36Description,
	buildSn37Description,
	buildSn38Description,
	buildSn39Description,
	buildSn40Description,
	buildSn41Description,
	buildSn42Description,
	buildSn43Description,
	buildSn44Description,
	buildSn45Description,
	buildSn46Description,
	buildSn47Description,
	buildSn48Description,
	buildSn49Description,
	buildSn50Description,
	buildSn51Description,
	buildSn52Description,
	buildSn53Description,
	buildSn54Description,
	buildSn55Description,
	buildSn56Description,
	buildSnpDescription,
	buildQualityMatchers,
	inferQualities,
	inferSn1Themes,
	inferSn2Themes,
	inferSn3Themes,
	inferSn4Themes,
	inferSn5Themes,
	inferSn6Themes,
	inferSn7Themes,
	inferSn8Themes,
	inferSn9Themes,
	inferSn10Themes,
	inferSn11Themes,
	inferSn12Themes,
	inferSn15Themes,
	inferSn16Themes,
	inferSn17Themes,
	inferSn18Themes,
	inferSn19Themes,
	inferSn21Themes,
	inferSn22Themes,
	inferSn23Themes,
	inferSn24Themes,
	inferSn26Themes,
	inferSn27Themes,
	inferSn28Themes,
	inferSn29Themes,
	inferSn30Themes,
	inferSn31Themes,
	inferSn32Themes,
	inferSn33Themes,
	inferSn34Themes,
	inferSn35Themes,
	inferSn36Themes,
	inferSn37Themes,
	inferSn38Themes,
	inferSn39Themes,
	inferSn40Themes,
	inferSn41Themes,
	inferSn42Themes,
	inferSn43Themes,
	inferSn44Themes,
	inferSn45Themes,
	inferSn46Themes,
	inferSn47Themes,
	inferSn48Themes,
	inferSn49Themes,
	inferSn50Themes,
	inferSn51Themes,
	inferSn52Themes,
	inferSn53Themes,
	inferSn54Themes,
	inferSn55Themes,
	inferSn56Themes,
	inferSnpThemes,
	inferThemes,
	loadQualitiesData,
	stripSegments,
} from "./lib/sujato-curation-infer.mjs";

const SN_REMAINING_COLLECTIONS = [
	"sn3",
	"sn7",
	"sn9",
	"sn15",
	"sn17",
	"sn28",
	"sn33",
	"sn34",
	"sn38",
	"sn41",
	"sn42",
	"sn43",
	"sn51",
	"sn52",
	"sn53",
	"sn54",
	"sn55",
	"sn56",
];
const SN_COLLECTIONS = [
	"sn1",
	"sn2",
	"sn3",
	"sn4",
	"sn5",
	"sn6",
	"sn7",
	"sn8",
	"sn9",
	"sn10",
	"sn11",
	"sn12",
	"sn15",
	"sn16",
	"sn17",
	"sn18",
	"sn19",
	"sn21",
	"sn22",
	"sn23",
	"sn24",
	"sn26",
	"sn27",
	"sn28",
	"sn29",
	"sn30",
	"sn31",
	"sn32",
	"sn33",
	"sn34",
	"sn35",
	"sn36",
	"sn37",
	"sn38",
	"sn39",
	"sn40",
	"sn41",
	"sn42",
	"sn43",
	"sn44",
	"sn45",
	"sn46",
	"sn47",
	"sn48",
	"sn49",
	"sn50",
	"sn51",
	"sn52",
	"sn53",
	"sn54",
	"sn55",
	"sn56",
	"snp1",
	"snp2",
	"snp3",
];
const VALID_COLLECTIONS = ["an3", "an5", "an6", "an7", "an8", "an9", "an10", "an11", "dn", ...SN_COLLECTIONS, "--all-sn-remaining"];

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const REF_ONLY_PATH = join(ROOT, "src/utils/referenceOnlyRoutes.ts");
const SUJATO_ROOT = join(ROOT, "src/content/references/sujato");

/** @type {Record<string, { description: string; qualities: string; theme: string }>} */
const CURATED_DN = {
	dn1: {
		description:
			"After overhearing a wanderer and his pupil contradict each other about the Buddha, the Buddha teaches the mendicants the Brahmajāla—a systematic survey of sixty-two kinds of wrong view about the past and future, from eternalism to nihilism.",
		qualities: "wrong view, examination, wisdom, discernment, attachment",
		theme: "cultivating discernment, wisdom",
	},
	dn2: {
		description:
			"King Ajātasattu, restless on a moonlit night, asks which ascetic he might honor; after rejecting several famous teachers, he visits the Buddha and hears the gradual training culminating in the four kinds of psychic power and the fruits of the ascetic life.",
		qualities: "faith, collectedness, wisdom, liberation, examination",
		theme: "training guideline, directly knowing",
	},
	dn3: {
		description:
			"The proud young brahmin Ambaṭṭha is sent to examine the Buddha but insults him; the Buddha refutes his claim to descent from the sage Kaṇha and teaches the true marks of a brahmin by conduct, not birth.",
		qualities: "conceit, examination, wisdom, ethical conduct, discernment",
		theme: "cultivating discernment, story",
	},
	dn4: {
		description:
			"When the brahmin Soṇadaṇḍa is pressed to define a true brahmin before a crowd eager to see the Buddha, he lists five qualities—birth, mantra-learning, beauty, ethics, and wisdom—and the Buddha shows which are essential.",
		qualities: "examination, ethical conduct, wisdom, conceit, learned",
		theme: "cultivating discernment, wisdom",
	},
	dn5: {
		description:
			"The brahmin Kūṭadanta seeks advice on a great sacrifice to ensure his welfare; the Buddha recounts how a past king's true sacrifice consisted of ethical conduct, harmlessness, and generosity—not slaughter—and guides Kūṭadanta to go for refuge.",
		qualities: "giving, ethical conduct, harm, faith, wisdom",
		theme: "story, principle",
	},
	dn6: {
		description:
			"Brahmin emissaries from Kosala ask the Buddha whether any ascetic or brahmin has directly seen the Brahmā realm; the Buddha explains that rebirth among Brahmās follows the path of ethics, immersion, and wisdom—not mere ritual or speculation.",
		qualities: "faith, collectedness, wisdom, ethical conduct, examination",
		theme: "wisdom, training guideline",
	},
	dn7: {
		description:
			"The wanderer Jāliya debates whether the soul is the same as or different from the body; the Buddha refuses the dichotomy and teaches dependent origination, showing that consciousness arises through conditions, not an enduring self.",
		qualities: "wrong view, examination, wisdom, recognition of not-self, discernment",
		theme: "wisdom, cultivating discernment",
	},
	dn8: {
		description:
			"The naked ascetic Kassapa challenges the Buddha on ascetic practices; the Buddha delivers the lion's roar, distinguishing true austerity from self-torment and teaching the middle practice of the noble path.",
		qualities: "examination, ethical conduct, wisdom, clinging to rules and observances, discernment",
		theme: "training guideline, cultivating discernment",
	},
	dn9: {
		description:
			"The wanderer Poṭṭhapāda asks how perception arises and ceases; the Buddha teaches the gradual cessation of perceptions through successive refinements of immersion, culminating in the ending of perception and feeling.",
		qualities: "collectedness, wisdom, examination, discernment, direct knowledge",
		theme: "directly knowing, wisdom",
	},
	dn10: {
		description:
			"Not long after the Buddha's extinguishment, the student Subha questions Venerable Ānanda on conduct, rebirth, and the marks of a great man; Ānanda explains the Buddha's teaching on ethics, meditation, and wisdom.",
		qualities: "ethical conduct, collectedness, wisdom, recollection of the Buddha, examination",
		theme: "training guideline, wisdom",
	},
	dn11: {
		description:
			"The householder Kevaḍḍha asks why the Buddha does not display miracles; the Buddha teaches that the only miracle he approves is the miracle of instruction, and recounts a monk's journey to the gods—including a deceptive Brahmā who claims to be eternal.",
		qualities: "faith, wisdom, wrong view, examination, discernment",
		theme: "story, wisdom",
	},
	dn12: {
		description:
			"The brahmin Lohicca asks whom a teacher should instruct; the Buddha teaches that one should not teach those who lack respect and attentiveness, comparing careless teachers to blind guides leading the blind into a pit.",
		qualities: "examination, respect, wisdom, ethical conduct, discernment",
		theme: "training guideline, wisdom",
	},
	dn13: {
		description:
			"The brahmins Vāseṭṭha and Bhāradvāja, experts in the three Vedas, ask the way to union with Brahmā; the Buddha shows that memorizing mantras without ethics, immersion, and wisdom cannot lead to the Brahmā world or liberation.",
		qualities: "learned, ethical conduct, collectedness, wisdom, examination",
		theme: "wisdom, training guideline",
	},
	dn14: {
		description:
			"On a quiet afternoon the Buddha recounts the lineage of past Buddhas from Vipassī to himself, the wheel-turning monarch Daḷhanemi, and the full formula of dependent origination in forward and reverse order.",
		qualities: "wisdom, recollection of the Buddha, examination, learned, liberation",
		theme: "principle, story",
	},
	dn15: {
		description:
			"Venerable Ānanda asks whether dependent origination is deep; the Buddha teaches the great discourse on causation, showing how consciousness and name-and-form are mutually dependent and why the self is not found in any link.",
		qualities: "wisdom, examination, recognition of not-self, discernment, attachment",
		theme: "principle, wisdom",
	},
	dn16: {
		description:
			"The Buddha's final journey from Rājagaha to Kusinārā, teaching the mendicants on the seven factors of non-decline, the four kinds of respect, and the last instructions before his full extinguishment.",
		qualities: "recollection of death, ethical conduct, wisdom, respect, liberation",
		theme: "urgency, story",
	},
	dn17: {
		description:
			"Near his final days, the Buddha tells Ānanda the legend of King Mahāsudassana, whose magnificent reign and seven treasures arose from past virtue—and whose impermanence the Buddha uses to teach renunciation and urgency.",
		qualities: "recognition of impermanence, giving, wisdom, recollection of death, collectedness",
		theme: "urgency, story",
	},
	dn18: {
		description:
			"The spirit Janavasabha reports to the Buddha how people from Ñātika were reborn among gods; the Buddha then teaches the path of ethics, immersion, and wisdom that leads to the Brahmā world and beyond.",
		qualities: "ethical conduct, collectedness, faith, wisdom, liberation",
		theme: "story, training guideline",
	},
	dn19: {
		description:
			"The centaur Pañcasikha asks the Buddha about the past steward Mahāgovinda, who ruled justly and was reborn among the Brahmā gods; the Buddha reveals that he himself was that steward and teaches the path to the Brahmā world.",
		qualities: "ethical conduct, giving, wisdom, faith, collectedness",
		theme: "story, inspiration",
	},
	dn20: {
		description:
			"At Kapilavatthu the Buddha is surrounded by five hundred perfected ones when deities from ten thousand world-systems gather; the Buddha teaches the gradual training and the mendicants declare their attainments in the great congregation.",
		qualities: "liberation, collectedness, faith, recollection of the Buddha, inspiration",
		theme: "inspiration, directly knowing",
	},
	dn21: {
		description:
			"Sakka, lord of gods, visits the Buddha on Indra's hill and asks about the causes of fear, sorrow, and suffering; the Buddha answers with a series of questions leading to the uprooting of conceit and the end of suffering.",
		qualities: "conceit, suffering, wisdom, examination, liberation",
		theme: "wisdom, cultivating discernment",
	},
	dn23: {
		description:
			"The skeptic Prince Pāyāsi denies rebirth and karmic results; Venerable Kassapa the Prince refutes him with similes—of the pregnant woman, the egg, and the mirror—until Pāyāsi accepts the teaching and establishes a charity for ascetics.",
		qualities: "wrong view, examination, faith, giving, wisdom",
		theme: "cultivating discernment, story",
	},
	dn24: {
		description:
			"The Buddha rebukes Sunakkhatta for boasting that Pāṭikaputta possesses superhuman powers; he recounts how that teacher was exposed as a fraud and teaches the gradual path through immersion and insight.",
		qualities: "vanity, examination, collectedness, wisdom, discernment",
		theme: "cultivating discernment, training guideline",
	},
	dn25: {
		description:
			"After the wanderer Nigrodha boasts of his teacher's doctrine, the Buddha teaches the lady Udumbarikā's hermitage the three kinds of ascetics—like a file of blind men—and the four kinds of individuals on the path to awakening.",
		qualities: "examination, wisdom, wrong view, discernment, liberation",
		theme: "cultivating discernment, principle",
	},
	dn26: {
		description:
			"The Buddha teaches the legend of the wheel-turning monarch Dalhanemi, whose realm prospered under the seven treasures and the four principles of justice—and how society declines when the true Dhamma is forgotten.",
		qualities: "ethical conduct, wisdom, harm, examination, discernment",
		theme: "principle, story",
	},
	dn27: {
		description:
			"The brahmins Vāseṭṭha and Bhāradvāja ask how the classes of society arose; the Buddha recounts the Aggañña legend of the world's evolution and teaches that nobility is by conduct, not birth.",
		qualities: "examination, ethical conduct, wisdom, conceit, discernment",
		theme: "story, cultivating discernment",
	},
	dn28: {
		description:
			"Venerable Sāriputta declares his confidence in the Buddha, reviewing the Teacher's qualities, the well-proclaimed Dhamma, and the Saṅgha of disciples who practice correctly.",
		qualities: "faith, recollection of the Buddha, wisdom, inspiration, respect",
		theme: "recollection of the Buddha, inspiration",
	},
	dn29: {
		description:
			"The Jain ascetic of the Nigaṇṭhas claims his teacher's doctrine is impressive; the Buddha teaches the householder Pasenadi's disciple on the three kinds of impressive teachings and refutes fatalism and the claim that all asceticism is equal.",
		qualities: "wrong view, examination, wisdom, ethical conduct, discernment",
		theme: "cultivating discernment, wisdom",
	},
	dn30: {
		description:
			"The Buddha teaches the thirty-two marks of a great man—such as wheels on the soles of the feet and a cranial protuberance—and how each mark is the result of past deeds of giving, ethics, and restraint.",
		qualities: "giving, ethical conduct, recollection of the Buddha, wisdom, learned",
		theme: "recollection of the Buddha, principle",
	},
	dn31: {
		description:
			"The Buddha finds the young householder Sigālaka worshipping the six directions; he teaches him the six directions as parents, teachers, spouses, friends, employers, and ascetics, and the reciprocal duties that sustain a household life of welfare.",
		qualities: "ethical conduct, respect, giving, wisdom, harm",
		theme: "training guideline, principle",
	},
	dn32: {
		description:
			"The four great kings visit the Buddha and request a protection for mendicants; the Buddha teaches the Āṭānāṭiya safeguard—a recitation invoking deities and the Buddha's power to ward off harm for those who live in respect of the training.",
		qualities: "faith, ethical conduct, harm, respect, recollection of the Buddha",
		theme: "training guideline, inspiration",
	},
	dn33: {
		description:
			"At Pāvā the Buddha encourages Sāriputta to recite the Dhamma in concert with the Saṅgha; Sāriputta systematically expounds teachings grouped by ones through tens, culminating in the ten powers of a Realized One.",
		qualities: "wisdom, learned, recollection of the Dhamma, examination, discernment",
		theme: "principle, wisdom",
	},
	dn34: {
		description:
			"At Campā Venerable Sāriputta teaches the mendicants doctrinal sets from one up to ten factors—including the four establishments of mindfulness, the eightfold path, and the ten powers—showing how the teaching is organized for gradual learning.",
		qualities: "wisdom, learned, examination, mindfulness, discernment",
		theme: "principle, training guideline",
	},
};

function loadRefOnlyRoutes() {
	const raw = readFileSync(REF_ONLY_PATH, "utf8");
	const match = raw.match(/referenceOnlyRoutes = (\[[\s\S]*?\]) as const/);
	return match ? JSON.parse(match[1]) : [];
}

function slugsForCollection(collection) {
	const routes = loadRefOnlyRoutes();
	if (collection === "dn") {
		return routes.filter((s) => /^dn\d/.test(s)).sort((a, b) => {
			const na = Number(a.slice(2));
			const nb = Number(b.slice(2));
			return na - nb;
		});
	}
	return routes
		.filter((s) => s.startsWith(`${collection}.`))
		.sort((a, b) => {
			const na = Number(a.split(".")[1].split("-")[0]);
			const nb = Number(b.split(".")[1].split("-")[0]);
			return na - nb;
		});
}

function curateAn3(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	const description = buildAn3Description(title, body, slug);
	const qualities = inferQualities(fullText, matchers);
	const theme = inferThemes(fullText);
	return {
		description,
		qualities: qualities.join(", "),
		theme: theme.join(", "),
	};
}

function curateAn5(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	const description = buildAn5Description(title, body, slug);
	const qualities = inferQualities(fullText, matchers);
	const theme = inferThemes(fullText);
	return {
		description,
		qualities: qualities.join(", "),
		theme: theme.join(", "),
	};
}

function curateAnNumbered(slug, title, body, qualitiesData, buildDescription) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	const description = buildDescription(title, body, slug);
	const qualities = inferQualities(fullText, matchers);
	const theme = inferThemes(fullText);
	return {
		description,
		qualities: qualities.join(", "),
		theme: theme.join(", "),
	};
}

function curateAn6(slug, title, body, qualitiesData) {
	return curateAnNumbered(slug, title, body, qualitiesData, buildAn6Description);
}

function curateAn7(slug, title, body, qualitiesData) {
	return curateAnNumbered(slug, title, body, qualitiesData, buildAn7Description);
}

function curateAn8(slug, title, body, qualitiesData) {
	return curateAnNumbered(slug, title, body, qualitiesData, buildAn8Description);
}

function curateAn9(slug, title, body, qualitiesData) {
	return curateAnNumbered(slug, title, body, qualitiesData, buildAn9Description);
}

function curateAn10(slug, title, body, qualitiesData) {
	return curateAnNumbered(slug, title, body, qualitiesData, buildAn10Description);
}

function curateAn11(slug, title, body, qualitiesData) {
	return curateAnNumbered(slug, title, body, qualitiesData, buildAn11Description);
}

function curateDn(slug) {
	const meta = CURATED_DN[slug];
	if (!meta) throw new Error(`Missing DN curation for ${slug}`);
	return meta;
}

function curateSn1(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn1Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn1Themes(fullText).join(", "),
	};
}

function curateSn2(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn2Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn2Themes(fullText).join(", "),
	};
}

function curateSnBook(slug, title, body, qualitiesData, buildDescription, inferThemesFn) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildDescription(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferThemesFn(fullText).join(", "),
	};
}

function curateSn4(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn4Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn4Themes(fullText).join(", "),
	};
}

function curateSn5(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn5Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn5Themes(fullText).join(", "),
	};
}

function curateSn6(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn6Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn6Themes(fullText).join(", "),
	};
}

function curateSn8(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn8Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn8Themes(fullText).join(", "),
	};
}

function curateSn10(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn10Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn10Themes(fullText).join(", "),
	};
}

function curateSn11(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn11Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn11Themes(fullText).join(", "),
	};
}

function curateSn12(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn12Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn12Themes(fullText).join(", "),
	};
}

function curateSn16(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn16Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn16Themes(fullText).join(", "),
	};
}

function curateSn18(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn18Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn18Themes(fullText).join(", "),
	};
}

function curateSn19(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn19Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn19Themes(fullText).join(", "),
	};
}

function curateSn21(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn21Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn21Themes(fullText).join(", "),
	};
}

function curateSn22(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn22Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn22Themes(fullText).join(", "),
	};
}

function curateSn23(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn23Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn23Themes(fullText).join(", "),
	};
}

function curateSn24(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn24Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn24Themes(fullText).join(", "),
	};
}

function curateSn26(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn26Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn26Themes(fullText).join(", "),
	};
}

function curateSn27(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn27Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn27Themes(fullText).join(", "),
	};
}

function curateSn29(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn29Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn29Themes(fullText).join(", "),
	};
}

function curateSn30(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn30Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn30Themes(fullText).join(", "),
	};
}

function curateSn31(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn31Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn31Themes(fullText).join(", "),
	};
}

function curateSn32(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn32Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn32Themes(fullText).join(", "),
	};
}

function curateSn39(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn39Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn39Themes(fullText).join(", "),
	};
}

function curateSn40(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn40Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn40Themes(fullText).join(", "),
	};
}

function curateSn44(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn44Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn44Themes(fullText).join(", "),
	};
}

function curateSn35(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn35Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn35Themes(fullText).join(", "),
	};
}

function curateSn36(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn36Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn36Themes(fullText).join(", "),
	};
}

function curateSn37(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn37Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn37Themes(fullText).join(", "),
	};
}

function curateSn45(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn45Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn45Themes(fullText).join(", "),
	};
}

function curateSn46(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn46Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn46Themes(fullText).join(", "),
	};
}

function curateSn47(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn47Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn47Themes(fullText).join(", "),
	};
}

function curateSn48(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn48Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn48Themes(fullText).join(", "),
	};
}

function curateSn49(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn49Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn49Themes(fullText).join(", "),
	};
}

function curateSn50(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSn50Description(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSn50Themes(fullText).join(", "),
	};
}

function curateSnp(slug, title, body, qualitiesData) {
	const matchers = buildQualityMatchers(qualitiesData);
	const fullText = `${title}\n${stripSegments(body)}`;
	return {
		description: buildSnpDescription(title, body, slug),
		qualities: inferQualities(fullText, matchers).join(", "),
		theme: inferSnpThemes(fullText, slug).join(", "),
	};
}

function curateSlug(collection, slug, title, body, qualitiesData) {
	switch (collection) {
		case "dn":
			return curateDn(slug);
		case "an5":
			return curateAn5(slug, title, body, qualitiesData);
		case "an6":
			return curateAn6(slug, title, body, qualitiesData);
		case "an7":
			return curateAn7(slug, title, body, qualitiesData);
		case "an8":
			return curateAn8(slug, title, body, qualitiesData);
		case "an9":
			return curateAn9(slug, title, body, qualitiesData);
		case "an10":
			return curateAn10(slug, title, body, qualitiesData);
		case "an11":
			return curateAn11(slug, title, body, qualitiesData);
		case "an3":
			return curateAn3(slug, title, body, qualitiesData);
		case "sn1":
			return curateSn1(slug, title, body, qualitiesData);
		case "sn2":
			return curateSn2(slug, title, body, qualitiesData);
		case "sn3":
			return curateSnBook(slug, title, body, qualitiesData, buildSn3Description, inferSn3Themes);
		case "sn4":
			return curateSn4(slug, title, body, qualitiesData);
		case "sn5":
			return curateSn5(slug, title, body, qualitiesData);
		case "sn6":
			return curateSn6(slug, title, body, qualitiesData);
		case "sn7":
			return curateSnBook(slug, title, body, qualitiesData, buildSn7Description, inferSn7Themes);
		case "sn8":
			return curateSn8(slug, title, body, qualitiesData);
		case "sn9":
			return curateSnBook(slug, title, body, qualitiesData, buildSn9Description, inferSn9Themes);
		case "sn10":
			return curateSn10(slug, title, body, qualitiesData);
		case "sn11":
			return curateSn11(slug, title, body, qualitiesData);
		case "sn12":
			return curateSn12(slug, title, body, qualitiesData);
		case "sn15":
			return curateSnBook(slug, title, body, qualitiesData, buildSn15Description, inferSn15Themes);
		case "sn16":
			return curateSn16(slug, title, body, qualitiesData);
		case "sn17":
			return curateSnBook(slug, title, body, qualitiesData, buildSn17Description, inferSn17Themes);
		case "sn18":
			return curateSn18(slug, title, body, qualitiesData);
		case "sn19":
			return curateSn19(slug, title, body, qualitiesData);
		case "sn21":
			return curateSn21(slug, title, body, qualitiesData);
		case "sn22":
			return curateSn22(slug, title, body, qualitiesData);
		case "sn23":
			return curateSn23(slug, title, body, qualitiesData);
		case "sn24":
			return curateSn24(slug, title, body, qualitiesData);
		case "sn26":
			return curateSn26(slug, title, body, qualitiesData);
		case "sn27":
			return curateSn27(slug, title, body, qualitiesData);
		case "sn28":
			return curateSnBook(slug, title, body, qualitiesData, buildSn28Description, inferSn28Themes);
		case "sn29":
			return curateSn29(slug, title, body, qualitiesData);
		case "sn30":
			return curateSn30(slug, title, body, qualitiesData);
		case "sn31":
			return curateSn31(slug, title, body, qualitiesData);
		case "sn32":
			return curateSn32(slug, title, body, qualitiesData);
		case "sn33":
			return curateSnBook(slug, title, body, qualitiesData, buildSn33Description, inferSn33Themes);
		case "sn34":
			return curateSnBook(slug, title, body, qualitiesData, buildSn34Description, inferSn34Themes);
		case "sn35":
			return curateSn35(slug, title, body, qualitiesData);
		case "sn36":
			return curateSn36(slug, title, body, qualitiesData);
		case "sn37":
			return curateSn37(slug, title, body, qualitiesData);
		case "sn38":
			return curateSnBook(slug, title, body, qualitiesData, buildSn38Description, inferSn38Themes);
		case "sn39":
			return curateSn39(slug, title, body, qualitiesData);
		case "sn40":
			return curateSn40(slug, title, body, qualitiesData);
		case "sn41":
			return curateSnBook(slug, title, body, qualitiesData, buildSn41Description, inferSn41Themes);
		case "sn42":
			return curateSnBook(slug, title, body, qualitiesData, buildSn42Description, inferSn42Themes);
		case "sn43":
			return curateSnBook(slug, title, body, qualitiesData, buildSn43Description, inferSn43Themes);
		case "sn44":
			return curateSn44(slug, title, body, qualitiesData);
		case "sn45":
			return curateSn45(slug, title, body, qualitiesData);
		case "sn46":
			return curateSn46(slug, title, body, qualitiesData);
		case "sn47":
			return curateSn47(slug, title, body, qualitiesData);
		case "sn48":
			return curateSn48(slug, title, body, qualitiesData);
		case "sn49":
			return curateSn49(slug, title, body, qualitiesData);
		case "sn50":
			return curateSn50(slug, title, body, qualitiesData);
		case "sn51":
			return curateSnBook(slug, title, body, qualitiesData, buildSn51Description, inferSn51Themes);
		case "sn52":
			return curateSnBook(slug, title, body, qualitiesData, buildSn52Description, inferSn52Themes);
		case "sn53":
			return curateSnBook(slug, title, body, qualitiesData, buildSn53Description, inferSn53Themes);
		case "sn54":
			return curateSnBook(slug, title, body, qualitiesData, buildSn54Description, inferSn54Themes);
		case "sn55":
			return curateSnBook(slug, title, body, qualitiesData, buildSn55Description, inferSn55Themes);
		case "sn56":
			return curateSnBook(slug, title, body, qualitiesData, buildSn56Description, inferSn56Themes);
		case "snp1":
		case "snp2":
		case "snp3":
			return curateSnp(slug, title, body, qualitiesData);
		default:
			throw new Error(`Unknown collection: ${collection}`);
	}
}

function applyCollection(collection, dryRun) {
	const slugs = slugsForCollection(collection);
	if (!slugs.length) {
		console.error(`No ref-only slugs for collection ${collection}`);
		process.exit(1);
	}

	const qualitiesData = loadQualitiesData();
	let written = 0;

	for (const slug of slugs) {
		const refPath = join(SUJATO_ROOT, slug.match(/^[a-z]+/)?.[0] ?? "", `${slug}.md`);
		if (!existsSync(refPath)) {
			console.error(`Missing Sujato ref: ${refPath}`);
			process.exit(1);
		}

		const { data, content } = matter(readFileSync(refPath, "utf8"));
		const title = (data.title || slug).trim();
		const meta = curateSlug(collection, slug, title, content, qualitiesData);

		const merged = {
			...data,
			description: meta.description,
			qualities: meta.qualities,
			theme: meta.theme,
		};
		const next = buildSujatoMarkdown({ ...merged, body: content });

		if (dryRun) {
			console.log(`[dry-run] ${slug}: ${meta.description.slice(0, 80)}…`);
		} else {
			writeFileSync(refPath, next, "utf8");
		}
		written++;
	}

	console.log(
		`${dryRun ? "[dry-run] " : ""}✅ Applied curation to ${written} ${collection.toUpperCase()} Sujato reference file(s).`,
	);
	return written;
}

function main() {
	const args = process.argv.slice(2);
	const dryRun = args.includes("--dry-run");
	const collectionArg = args.find((a) => a.startsWith("--collection="));
	const collection = collectionArg?.split("=")[1] ?? args[args.indexOf("--collection") + 1];

	if (!collection || !VALID_COLLECTIONS.includes(collection)) {
		console.error(
			`Usage: node scripts/apply-an3-dn-curation.mjs --collection ${VALID_COLLECTIONS.join("|")} [--dry-run]`,
		);
		process.exit(1);
	}

	if (collection === "--all-sn-remaining") {
		let total = 0;
		for (const snCollection of SN_REMAINING_COLLECTIONS) {
			total += applyCollection(snCollection, dryRun);
		}
		console.log(
			`${dryRun ? "[dry-run] " : ""}✅ Applied curation to ${total} SN remaining Sujato reference file(s) across ${SN_REMAINING_COLLECTIONS.length} saṃyuttas.`,
		);
		return;
	}

	applyCollection(collection, dryRun);
}

main();
