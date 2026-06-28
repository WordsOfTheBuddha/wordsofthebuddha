#!/usr/bin/env node
/**
 * Apply curated frontmatter to MN reference-only Sujato markdown files.
 * Usage: node scripts/apply-mn-curation.mjs [--dry-run]
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { buildSujatoMarkdown } from "./lib/sujato-frontmatter.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SUJATO_MN = join(ROOT, "src/content/references/sujato/mn");
const EN_MN = join(ROOT, "src/content/en/mn");
const dryRun = process.argv.includes("--dry-run");

/** @type {Record<string, { description: string; qualities: string; theme: string }>} */
const CURATED = {
	mn23: {
		description:
			"The Buddha expounds a layered parable—revealed to Venerable Kassapa by a deity—of digging into a termite mound that smokes by night and blazes by day, unearthing successive obstacles from sensual craving to ignorance as the way to uproot old defilements.",
		qualities: "examination, wisdom, craving, ignorance, delusion, giving up",
		theme: "wisdom, cultivating discernment",
	},
	mn35: {
		description:
			"The Buddha refutes the Jain debater Saccaka's boast that questioning the five aggregates would make even a post tremble, guiding him to see form, feeling, perception, choices, and consciousness as not-self.",
		qualities:
			"recognition of not-self, personal existence view, examination, wisdom, conceit",
		theme: "cultivating discernment, wisdom",
	},
	mn50: {
		description:
			"Venerable Mahāmoggallāna discerns Māra who had entered his belly and commands him to depart, showing how the Realized One and his disciples cannot be deceived by the Wicked One.",
		qualities: "mindfulness, wisdom, harm, liberation, discernment",
		theme: "directly knowing",
	},
	mn51: {
		description:
			"The Buddha teaches Pessa and the wanderer Kandaraka about four individuals who mortify themselves, others, both, or neither, praising the one who avoids torment and practices the four kinds of mindfulness meditation.",
		qualities: "mindfulness, ethical conduct, collectedness, wisdom, examination",
		theme: "training guideline, principle",
	},
	mn56: {
		description:
			"Before a Jain assembly including the lay follower Upāli, the Buddha systematically refutes Jain teachings on karma, asceticism, and omniscience, leading Upāli to go for refuge.",
		qualities: "examination, wrong view, wisdom, faith, discernment",
		theme: "cultivating discernment, wisdom",
	},
	mn57: {
		description:
			"The Buddha explains to Puṇṇa and the dog-vow ascetic Seniya how habitual behaviour shapes rebirth, and why imitating animals cannot lead to the end of suffering.",
		qualities: "ethical conduct, wrong view, examination, wisdom, clinging to rules and observances",
		theme: "wisdom, principle",
	},
	mn60: {
		description:
			"Wandering among the Kosalans, the Buddha teaches the people of Sālā the sure bet teaching—contrasting four kinds of doctrinal views and showing which conduce to welfare here and hereafter.",
		qualities: "faith, wisdom, wrong view, examination, ethical conduct",
		theme: "wisdom, cultivating discernment",
	},
	mn65: {
		description:
			"When Bhaddāli refuses the training rule to eat one meal a day, the Buddha teaches him and the Saṅgha on the benefits of restraint and the dangers of obstinacy toward the Teacher's instructions.",
		qualities: "ethical conduct, giving up, examination, stubbornness, sense restraint",
		theme: "training guideline",
	},
	mn67: {
		description:
			"The Buddha summons five hundred loud visiting mendicants led by Sāriputta and Moggallāna, and teaches when a senior may and may not rebuke a junior—illustrated through the story of Sāriputta's nephew.",
		qualities: "ethical conduct, examination, conceit, respect",
		theme: "training guideline, cultivating discernment",
	},
	mn68: {
		description:
			"To well-born young mendicants resting at Naḷakapāna, the Buddha questions why they went forth and teaches the four bases of psychic power through the parable of a firm-posted royal elephant.",
		qualities: "giving up, recollection of death, collectedness, faith, psychic power",
		theme: "inspiration, training guideline",
	},
	mn69: {
		description:
			"Venerable Sāriputta instructs the Saṅgha on proper deportment for a forest-dwelling mendicant who enters the community—covering conduct, restraint, and meditation practice.",
		qualities: "ethical conduct, mindfulness, collectedness, anger, solitude",
		theme: "training guideline",
	},
	mn74: {
		description:
			"The Buddha analyses the wanderer Dīghanakha's view that nothing is acceptable, distinguishing the few who abandon such views from the many who cling and merely exchange one grasping for another.",
		qualities: "wrong view, attachment, examination, wisdom, giving up",
		theme: "cultivating discernment, wisdom",
	},
	mn76: {
		description:
			"Venerable Ānanda visits the wanderer Sandaka and his assembly, and sets forth four spiritual paths that offer no guarantee of attaining any transcendent state—including those who claim immediate annihilation or absorption without discernment.",
		qualities: "wisdom, examination, wrong view, liberation, discernment",
		theme: "cultivating discernment, wisdom",
	},
	mn79: {
		description:
			"Visiting the wanderer Sakuludāyī, the Buddha answers sixteen points on what is ultimate splendour and the successive refinements of bliss culminating in the stilling of perception and feeling.",
		qualities: "collectedness, wisdom, examination, happiness, jhana",
		theme: "wisdom, directly knowing",
	},
	mn80: {
		description:
			"The wanderer Vekhanasa declares an ultimate splendour; the Buddha, through Venerable Mahākaccāna, leads him through graded comparisons—from gem to firefly to oil lamp to sun—that expose the inadequacy of his claim.",
		qualities: "vanity, examination, wisdom, collectedness, discernment",
		theme: "cultivating discernment, wisdom",
	},
	mn83: {
		description:
			"After smiling at a spot near Mithilā, the Buddha recounts for Ānanda the legend of the just king Maghadeva and his successors who upheld the Dhamma until a king abandoned it.",
		qualities: "ethical conduct, giving, wisdom, recollection of death",
		theme: "story, principle",
	},
	mn84: {
		description:
			"Venerable Mahākaccāna refutes King Avantiputta's brahmin claim that only brahmins are the light class, showing through examples of wealth, conduct, and liberation that nobility is a matter of deeds, not birth.",
		qualities: "ethical conduct, examination, wisdom, conceit, liberation",
		theme: "cultivating discernment, wisdom",
	},
	mn85: {
		description:
			"Prince Bodhi invites the Buddha to his new Pink Lotus mansion and claims pleasure is won through pain; the Buddha recounts his own search, refutes self-mortification, and teaches—through the simile of training as an elephant rider—that faith, health, integrity, energy, and wisdom are needed to realize the end of the path.",
		qualities: "faith, examination, wisdom, right effort, liberation",
		theme: "inspiration, wisdom",
	},
	mn86: {
		description:
			"The Buddha walks alone toward the murderer Aṅgulimāla, who pursues him but cannot catch him; through the stop teaching, Aṅgulimāla renounces violence, receives ordination, and eventually becomes awakened.",
		qualities: "harm, ethical conduct, faith, liberation, compassion",
		theme: "inspiration, story",
	},
	mn87: {
		description:
			"A grieving householder who has lost his only child comes to the Buddha, who teaches that sorrow over the beloved binds one to suffering and that all five aggregates are impermanent and not a true self.",
		qualities:
			"suffering, attachment, recognition of impermanence, recognition of not-self, dearness",
		theme: "wisdom, urgency",
	},
	mn90: {
		description:
			"King Pasenadi visits the Buddha to ask whether women can attain awakening, after relating five portentous dreams; the Buddha affirms women's capacity for the highest goal when they go forth and train.",
		qualities: "faith, wisdom, liberation, examination, inspiration",
		theme: "wisdom, principle",
	},
	mn91: {
		description:
			"The learned centenarian brahmin Brahmāyu examines the Buddha for the thirty-two marks of a great man, hears the graduated discourse, and declares him the perfected Buddha before passing away.",
		qualities: "faith, wisdom, recollection of the Buddha, examination, learned",
		theme: "recollection of the Buddha, story",
	},
	mn92: {
		description:
			"The brahmin teacher Keṇiya prepares a grand feast and the Buddha teaches him and the brahmin Sela, who recognises the thirty-two marks and—with his two hundred fifty pupils—goes forth under the Buddha.",
		qualities: "faith, wisdom, recollection of the Buddha, examination, inspiration",
		theme: "inspiration, story",
	},
	mn93: {
		description:
			"The young brahmin scholar Assalāyana, urged by five hundred brahmins, debates the Buddha on whether brahmins alone are purified by birth; the Buddha refutes the claim through reasoning and examples.",
		qualities: "examination, wisdom, conceit, ethical conduct, discernment",
		theme: "cultivating discernment, wisdom",
	},
	mn94: {
		description:
			"Venerable Udena answers the brahmin Ghoṭamukha, who doubted any principled renunciate life exists, with a sequence of similes showing how a true practitioner restrains body, speech, and mind.",
		qualities: "ethical conduct, collectedness, wisdom, examination, sense restraint",
		theme: "training guideline, wisdom",
	},
	mn96: {
		description:
			"The brahmin Esukārī asks about the four prescribed services according to class; the Buddha teaches that one should serve whoever makes one better, not worse, regardless of birth.",
		qualities: "ethical conduct, examination, wisdom, giving, discernment",
		theme: "cultivating discernment, principle",
	},
	mn97: {
		description:
			"Venerable Sāriputta visits the dying and negligent brahmin official Dhanañjāni, teaches him on the dangers of negligence and the recollections, and guides him to be reborn among the Brahmā gods.",
		qualities: "negligence, faith, recollection of the Buddha, recollection of death, wisdom",
		theme: "urgency, inspiration",
	},
	mn98: {
		description:
			"Brahmin students Vāseṭṭha and Bhāradvāja ask how one becomes a brahmin; the Buddha teaches that the terms brahmin, aristocrat, peasant, and menial name lineage, while true purity is by ethical conduct and spiritual attainment.",
		qualities: "ethical conduct, examination, wisdom, liberation, discernment",
		theme: "cultivating discernment, wisdom",
	},
	mn100: {
		description:
			"The devoted laywoman Dhanañjānī honours the Buddha when she stumbles; the student Saṅgārava challenges her, and the Buddha teaches how brahmavihāra practice leads to rebirth among the Brahmā gods.",
		qualities: "loving-kindness, faith, giving, collectedness, examination",
		theme: "training guideline, wisdom",
	},
	mn103: {
		description:
			"Near his final days, the Buddha asks the mendicants whether they think he teaches for gain, and instructs them on how to resolve disputes over Dhamma without quarrelling—by focusing on the meaning, not personality.",
		qualities: "examination, wisdom, argumentativeness, recollection of the Dhamma, respect",
		theme: "training guideline, wisdom",
	},
	mn105: {
		description:
			"The Licchavi Sunakkhatta, having left the Saṅgha, questions whether mendicants who declared arahantship truly attained it; the Buddha teaches the gradual training through jhānas and insight into the three characteristics.",
		qualities: "examination, collectedness, wisdom, vanity, liberation",
		theme: "training guideline, directly knowing",
	},
	mn109: {
		description:
			"On a full-moon uposatha at the Eastern Monastery, Venerable Mahāpuccha asks the Buddha about the five grasping aggregates, the origin of fetters, and the distinction between the aggregates and clinging.",
		qualities: "attachment, examination, wisdom, recognition of not-self, discernment",
		theme: "wisdom, cultivating discernment",
	},
	mn114: {
		description:
			"The Buddha expounds what bodily, verbal, and mental conduct should and should not be cultivated, culminating in the triple training of ethics, mind, and wisdom that ends defilements.",
		qualities: "ethical conduct, wisdom, examination, right effort, liberation",
		theme: "training guideline, principle",
	},
	mn115: {
		description:
			"The Buddha teaches the eighteen elements through contemplation of eye, sights, and eye consciousness, and warns that danger comes from fools who, like a spreading grass fire, harm the Saṅgha and society.",
		qualities: "wisdom, examination, mindfulness, harm, discernment",
		theme: "principle, wisdom",
	},
	mn116: {
		description:
			"At Isigili near Rājagaha, the Buddha explains how nearby mountains received their names and commemorates five hundred Independent Buddhas who once dwelt there and entered final nibbāna.",
		qualities: "recollection of the Buddha, wisdom, liberation, learned",
		theme: "recollection of the Buddha, story",
	},
	mn120: {
		description:
			"The Buddha teaches how a mendicant with faith, ethics, learning, giving, and wisdom can, by steady aspiration, be reborn among well-to-do aristocrats, gods of the four great kings, or higher heavens.",
		qualities: "faith, ethical conduct, giving, wisdom, learned",
		theme: "training guideline, principle",
	},
	mn124: {
		description:
			"The aged Venerable Bakkula recounts to his former friend, the naked ascetic Kassapa, his eighty years without ill will, sensual thought, or village rains residence—and Kassapa ordains and quickly attains awakening.",
		qualities: "liberation, ethical conduct, collectedness, loving-kindness, inspiration",
		theme: "inspiration, directly knowing",
	},
	mn127: {
		description:
			"The chamberlain Pañcakaṅga asks Venerable Anuruddha to clarify the difference between the attainment of the cessation of perception and feeling and the non-percipient non-existence state.",
		qualities: "collectedness, wisdom, examination, direct knowledge, discernment",
		theme: "directly knowing, wisdom",
	},
	mn129: {
		description:
			"The Buddha contrasts the fool who thinks, speaks, and acts poorly—with consequent present suffering and bad rebirths—and the astute person who does the opposite, reaping praise and the path.",
		qualities: "examination, wisdom, ethical conduct, suffering, discernment",
		theme: "cultivating discernment, principle",
	},
	mn130: {
		description:
			"The Buddha compares his clairvoyant vision of rebirth according to deeds to one watching people enter and leave houses, and teaches the four divine messengers—old age, sickness, death, and a criminal's punishment—that prompt the wise to practise.",
		qualities: "recollection of death, wisdom, ethical conduct, examination, faith",
		theme: "urgency, directly knowing",
	},
	mn133: {
		description:
			"A deity urges Venerable Samiddhi to learn the One Fine Night teaching; the Buddha explains through Venerable Mahākaccāna how not dwelling on past or future but discerning the present leads to profound freedom.",
		qualities: "mindfulness, wisdom, examination, liberation, clear awareness",
		theme: "training guideline, wisdom",
	},
	mn144: {
		description:
			"Visiting the gravely ill Venerable Channa, Sāriputta and Mahācunda counsel him; the Buddha later declares that Channa's knife-death was blameless because he was not attached and had cut craving.",
		qualities: "suffering, giving up, examination, liberation, attachment",
		theme: "urgency, wisdom",
	},
	mn145: {
		description:
			"When Venerable Puṇṇa asks for brief Dhamma before going to Sūnaparanta, the Buddha teaches how approving and clinging to the six sense bases gives rise to relishing, which is the origin of suffering.",
		qualities: "attachment, examination, suffering, liberation, discernment",
		theme: "wisdom, training guideline",
	},
	mn146: {
		description:
			"Reluctantly assigned to instruct the nuns, Venerable Nandaka teaches Mahāpajāpati Gotamī and five hundred nuns that all six sense bases and their objects are like impermanent, stressful guests—leading many to attain awakening.",
		qualities:
			"recognition of impermanence, recognition of unsatisfactoriness, wisdom, liberation, disenchantment",
		theme: "wisdom, training guideline",
	},
	mn147: {
		description:
			"Seeing that Rāhula's qualities for liberation have matured, the Buddha leads him to the Dark Forest and instructs him to regard the six sense bases and their objects as not-self, not belonging to a self.",
		qualities: "recognition of not-self, examination, mindfulness, liberation, discernment",
		theme: "training guideline, wisdom",
	},
	mn150: {
		description:
			"At Nagaravinda the Buddha teaches householders how to truly honour ascetics—not by assuming parity of conduct but by inquiring into their freedom from defilements and the qualities of their hearts.",
		qualities: "examination, faith, ethical conduct, wisdom, respect",
		theme: "cultivating discernment, wisdom",
	},
	mn151: {
		description:
			"The Buddha praises Sāriputta's practice of emptiness meditation and teaches how a mendicant should systematically check progress—purifying ethics, alms, hindrances, aggregates, and factors of awakening before attaining.",
		qualities: "collectedness, mindfulness, ethical conduct, wisdom, examination",
		theme: "training guideline, directly knowing",
	},
};

function loadRefOnlyMnSlugs() {
	const en = new Set(
		readdirSync(EN_MN)
			.filter((f) => f.endsWith(".mdx"))
			.map((f) => f.replace(".mdx", "")),
	);
	return readdirSync(SUJATO_MN)
		.filter((f) => f.endsWith(".md"))
		.map((f) => f.replace(".md", ""))
		.filter((slug) => !en.has(slug))
		.sort((a, b) => parseInt(a.slice(2), 10) - parseInt(b.slice(2), 10));
}

function main() {
	const slugs = loadRefOnlyMnSlugs();
	const missing = slugs.filter((s) => !CURATED[s]);
	if (missing.length) {
		console.error(`Missing curation for: ${missing.join(", ")}`);
		process.exit(1);
	}
	const extra = Object.keys(CURATED).filter((s) => !slugs.includes(s));
	if (extra.length) {
		console.error(`Extra curation entries not ref-only: ${extra.join(", ")}`);
		process.exit(1);
	}

	let written = 0;
	for (const slug of slugs) {
		const refPath = join(SUJATO_MN, `${slug}.md`);
		const { data, content } = matter(readFileSync(refPath, "utf8"));
		const meta = CURATED[slug];
		const merged = {
			...data,
			description: meta.description,
			qualities: meta.qualities,
			theme: meta.theme,
		};
		const next = buildSujatoMarkdown({ ...merged, body: content });
		if (dryRun) {
			console.log(`[dry-run] ${slug}`);
		} else {
			writeFileSync(refPath, next, "utf8");
		}
		written++;
	}

	console.log(
		`${dryRun ? "[dry-run] " : ""}✅ Applied curation to ${written} MN Sujato reference file(s).`,
	);
}

main();
