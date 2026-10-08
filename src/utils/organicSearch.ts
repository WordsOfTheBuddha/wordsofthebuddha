/**
 * Document titles, meta descriptions, and short URLs for the queries people
 * type when looking for early Buddhist texts. The on-page heading stays the
 * translation's own title. One primary URL per head query, so a sutta and a
 * topic hub don't both lead with the same phrase.
 */

export type AlsoKnown = {
	/** Sentence shown under the heading. */
	line: string;
	/** Shown only when this phrase is absent from the heading and description. */
	phrase: string;
};

export type DiscourseSearchEntry = {
	/** `<title>` and social title. The wording people search for is at the front. */
	title: string;
	aliases: string[];
	alsoKnown?: AlsoKnown;
	/**
	 * Prepended to the meta description when none of `aliases` already appear
	 * in the on-page description.
	 */
	metaLead?: string;
	/** Paths that 301 to this discourse. Leading slash, no trailing slash. */
	redirects?: string[];
};

export type HubSearchEntry = {
	title: string;
	description: string;
	redirects?: string[];
};

export type OftenReadEntry = {
	href: string;
	title: string;
	detail: string;
};

/** Fold diacritics and case so "Kālāma" matches "kalama". */
export function foldSearchText(value: string): string {
	return value
		.toLowerCase()
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.replace(/['’`´]/g, "");
}

function containsFolded(haystack: string, needle: string): boolean {
	const foldedNeedle = foldSearchText(needle).trim();
	if (!foldedNeedle) return false;
	return foldSearchText(haystack).includes(foldedNeedle);
}

export const discourseSearch: Record<string, DiscourseSearchEntry> = {
	mn10: {
		title: "MN 10 Satipaṭṭhāna Sutta — Establishments of Mindfulness",
		aliases: [
			"Satipatthana Sutta",
			"Establishments of Mindfulness",
			"Foundations of Mindfulness",
		],
		metaLead: "The Satipaṭṭhāna Sutta, on the establishments of mindfulness.",
		redirects: [
			"/satipatthana",
			"/satipatthana-sutta",
			"/satipatthana-sutra",
			"/foundations-of-mindfulness",
		],
	},
	dn22: {
		title: "DN 22 Mahāsatipaṭṭhāna Sutta — The Longer Satipaṭṭhāna",
		aliases: ["Mahasatipatthana Sutta", "Maha Satipatthana"],
		alsoKnown: {
			line: "The longer discourse on the establishments of mindfulness.",
			phrase: "establishments of mindfulness",
		},
		metaLead: "The Mahāsatipaṭṭhāna Sutta, the longer discourse on the establishments of mindfulness.",
		redirects: [
			"/maha-satipatthana",
			"/mahasatipatthana",
			"/mahasatipatthana-sutta",
			"/maha-satipatthana-sutta",
		],
	},
	mn118: {
		title: "MN 118 Ānāpānasati Sutta — Mindfulness of Breathing",
		aliases: ["Anapanasati Sutta", "Mindfulness of Breathing"],
		alsoKnown: {
			line: "Also known as mindfulness of breathing.",
			phrase: "mindfulness of breathing",
		},
		metaLead: "The Ānāpānasati Sutta, on mindfulness of breathing.",
		redirects: ["/anapanasati", "/anapanasati-sutta", "/anapanasati-sutra"],
	},
	"snp1.8": {
		title: "SNP 1.8 Metta Sutta — Loving-Kindness",
		aliases: ["Metta Sutta", "Karaniya Metta Sutta", "Loving-Kindness Sutta"],
		metaLead: "The Metta Sutta (Karaṇīya Metta), on loving-kindness.",
		redirects: [
			"/metta-sutta",
			"/metta-sutra",
			"/karaniya-metta",
			"/karaniya-metta-sutta",
		],
	},
	"an3.65": {
		title: "AN 3.65 Kālāma Sutta — Advice to the Kālāmas",
		aliases: ["Kalama Sutta", "Kālāma Sutta", "Kesamutti Sutta"],
		alsoKnown: {
			line: "Also known as the Kālāma Sutta.",
			phrase: "kālāma sutta",
		},
		metaLead: "The Kālāma Sutta.",
		redirects: ["/kalama-sutta", "/kalama-sutra", "/kesamutti-sutta"],
	},
	"sn56.11": {
		title: "SN 56.11 Four Noble Truths — The Buddha’s First Sermon",
		aliases: [
			"Four Noble Truths",
			"Dhammacakkappavattana Sutta",
			"Buddha’s first sermon",
		],
		alsoKnown: {
			line: "Also known as the Buddha’s first sermon.",
			phrase: "first sermon",
		},
		metaLead: "The Buddha’s first sermon, the Dhammacakkappavattana Sutta.",
		redirects: [
			"/four-noble-truths",
			"/dhammacakkappavattana",
			"/dhammacakkappavattana-sutta",
			"/dhammacakka",
			"/buddhas-first-sermon",
		],
	},
	"sn45.8": {
		title: "SN 45.8 Noble Eightfold Path — Vibhaṅga Sutta",
		aliases: ["Noble Eightfold Path", "Eightfold Path"],
		metaLead: "The discourse that explains the noble eightfold path.",
		redirects: [
			"/noble-eightfold-path",
			"/eightfold-path",
			"/noble-eightfold-path-sutta",
		],
	},
	"sn22.59": {
		title: "SN 22.59 Anattalakkhaṇa Sutta — Not-Self",
		aliases: ["Anattalakkhana Sutta", "Not-Self", "Anatta"],
		redirects: [
			"/anattalakkhana",
			"/anattalakkhana-sutta",
			"/anatta-lakkhana",
			"/not-self-sutta",
		],
	},
	"sn35.28": {
		title: "SN 35.28 The Fire Sermon — Ādittapariyāya Sutta",
		aliases: ["Fire Sermon", "Adittapariyaya Sutta"],
		alsoKnown: {
			line: "Also known as the Fire Sermon.",
			phrase: "fire sermon",
		},
		metaLead: "The Fire Sermon (Ādittapariyāya).",
		redirects: ["/fire-sermon", "/adittapariyaya", "/adittapariyaya-sutta"],
	},
	"sn12.2": {
		title: "SN 12.2 Dependent Origination — The Twelve Links",
		aliases: ["Dependent Origination", "Paticcasamuppada"],
		alsoKnown: {
			line: "Also called dependent origination.",
			phrase: "dependent origination",
		},
		metaLead: "The analysis of dependent origination (paṭiccasamuppāda).",
	},
	dn15: {
		title: "DN 15 Mahānidāna Sutta — Dependent Origination",
		aliases: ["Mahanidana Sutta", "Mahānidāna"],
		alsoKnown: {
			line: "The great discourse on dependent origination.",
			phrase: "dependent origination",
		},
		metaLead: "The Mahānidāna Sutta, the great discourse on dependent origination.",
		redirects: ["/mahanidana", "/mahanidana-sutta", "/maha-nidana"],
	},
	dn16: {
		title: "DN 16 Mahāparinibbāna Sutta — The Buddha’s Final Days",
		aliases: ["Mahaparinibbana Sutta", "Buddha’s last days"],
		redirects: ["/mahaparinibbana", "/mahaparinibbana-sutta"],
	},
	dn31: {
		title: "DN 31 Sigālovāda Sutta — Advice to Sigālaka",
		aliases: ["Sigalovada Sutta", "Singalovada Sutta"],
		alsoKnown: {
			line: "Also known as the Sigālovāda Sutta.",
			phrase: "sigālovāda",
		},
		metaLead: "The Sigālovāda Sutta, on ethics for householders.",
		redirects: [
			"/sigalovada",
			"/sigalovada-sutta",
			"/singalovada-sutta",
			"/sigalaka-sutta",
		],
	},
	mn21: {
		title: "MN 21 Kakacūpama Sutta — Simile of the Saw",
		aliases: ["Simile of the Saw", "Kakacupama Sutta"],
		redirects: ["/simile-of-the-saw", "/kakacupama-sutta"],
	},
	mn22: {
		title: "MN 22 Alagaddūpama Sutta — Simile of the Raft",
		aliases: ["Simile of the Raft", "Parable of the Raft", "Alagaddupama Sutta"],
		redirects: [
			"/simile-of-the-raft",
			"/parable-of-the-raft",
			"/alagaddupama-sutta",
		],
	},
	mn141: {
		title: "MN 141 Saccavibhaṅga — Exposition of the Four Noble Truths",
		aliases: ["Saccavibhanga Sutta", "Exposition of the Truths"],
		redirects: ["/saccavibhanga", "/saccavibhanga-sutta"],
	},
	"snp2.4": {
		title: "SNP 2.4 Maṅgala Sutta — Blessings",
		aliases: ["Mangala Sutta"],
		metaLead: "The Maṅgala Sutta, on the highest blessings.",
		redirects: ["/mangala-sutta"],
	},
	"snp2.1": {
		title: "SNP 2.1 Ratana Sutta — The Jewel Discourse",
		aliases: ["Ratana Sutta", "Jewel Sutta"],
		metaLead: "The Ratana Sutta, the discourse on the three jewels.",
		redirects: ["/ratana-sutta", "/jewel-sutta"],
	},
};

export const collectionSearch: Record<string, HubSearchEntry> = {
	dhp: {
		title: "Dhammapada — Verses of the Buddha in Pāli and English",
		description:
			"Read the Dhammapada in parallel Pāli and English: 423 verses of the Buddha on the mind, ethical conduct, and liberation.",
	},
	mn: {
		title: "Majjhima Nikāya — Middle Length Discourses in Pāli and English",
		description:
			"The Majjhima Nikāya (Middle Length Discourses): 152 suttas in parallel Pāli and English, including the Satipaṭṭhāna and Ānāpānasati Suttas.",
	},
	sn: {
		title: "Saṁyutta Nikāya — Connected Discourses in Pāli and English",
		description:
			"The Saṁyutta Nikāya (Connected Discourses) in parallel Pāli and English, grouped by theme: dependent origination, the aggregates, the path, and the truths.",
	},
	an: {
		title: "Aṅguttara Nikāya — Numerical Discourses in Pāli and English",
		description:
			"The Aṅguttara Nikāya (Numerical Discourses) in parallel Pāli and English, including the Kālāma Sutta.",
	},
	dn: {
		title: "Dīgha Nikāya — Long Discourses in Pāli and English",
		description:
			"The Dīgha Nikāya (Long Discourses) in parallel Pāli and English, including the Mahāparinibbāna and Mahāsatipaṭṭhāna Suttas.",
	},
	snp: {
		title: "Sutta Nipāta — Early Buddhist Verse in Pāli and English",
		description:
			"The Sutta Nipāta in parallel Pāli and English, including the Metta, Maṅgala, and Ratana Suttas.",
	},
	iti: {
		title: "Itivuttaka — Short Discourses in Pāli and English",
		description:
			"The Itivuttaka: 112 short discourses of the Buddha in parallel Pāli and English, each framed with “thus it was said.”",
	},
	ud: {
		title: "Udāna — Inspired Utterances in Pāli and English",
		description:
			"The Udāna: 80 inspired utterances of the Buddha in parallel Pāli and English.",
	},
	kp: {
		title: "Khuddakapāṭha — Short Passages for Chanting",
		description:
			"The Khuddakapāṭha in parallel Pāli and English: short chanting passages, including the Metta, Maṅgala, and Ratana Suttas.",
	},
	sn12: {
		title: "Dependent Origination — Saṁyutta Nikāya 12",
		description:
			"Discourses on dependent origination (paṭiccasamuppāda), the conditional arising of suffering, in parallel Pāli and English.",
	},
	sn22: {
		title: "Five Aggregates (Khandha) — Saṁyutta Nikāya 22",
		description:
			"Discourses on the five aggregates — form, feeling, perception, intentional constructs, and consciousness — in parallel Pāli and English.",
		redirects: ["/five-aggregates", "/five-khandhas"],
	},
	sn45: {
		title: "Noble Eightfold Path — Saṁyutta Nikāya 45",
		description:
			"Discourses on the noble eightfold path, factor by factor, in parallel Pāli and English.",
	},
	sn56: {
		title: "Discourses on the Four Noble Truths — Saṁyutta Nikāya 56",
		description:
			"Discourses on the four noble truths, including the Buddha’s first sermon (SN 56.11), in parallel Pāli and English.",
	},
};

export const topicSearch: Record<string, HubSearchEntry> = {
	"dependent-co-arising": {
		title: "Dependent Origination (Paṭiccasamuppāda) — Words of the Buddha",
		description:
			"Dependent origination (paṭiccasamuppāda): when this exists, that comes to be. Discourses on the twelve links and the ending of suffering.",
		redirects: [
			"/dependent-origination",
			"/paticcasamuppada",
			"/dependent-arising",
		],
	},
	breathing: {
		title: "Mindfulness of Breathing (Ānāpānasati) — Words of the Buddha",
		description:
			"Mindfulness of breathing (ānāpānasati) in the suttas: the step-by-step training and the collectedness it leads to, including the Ānāpānasati Sutta.",
	},
	jhana: {
		title: "Jhāna — Meditation in the Early Buddhist Suttas",
		description:
			"Jhāna (jhana) in the early suttas: meditative absorption with a steady, collected awareness, secluded from the five hindrances.",
	},
	"loving-kindness": {
		title: "Loving-Kindness (Mettā) — Words of the Buddha",
		description:
			"Loving-kindness (mettā): boundless goodwill for all beings, with the Metta Sutta and the other discourses that teach it.",
	},
};

/** Discover links. Anchor text is the wording people search for. */
export const oftenRead: OftenReadEntry[] = [
	{
		href: "/dhp",
		title: "Dhammapada",
		detail: "423 verses on the mind and how to live",
	},
	{
		href: "/mn10",
		title: "Satipaṭṭhāna Sutta",
		detail: "The establishments of mindfulness",
	},
	{
		href: "/snp1.8",
		title: "Metta Sutta",
		detail: "Loving-kindness for all beings",
	},
	{
		href: "/mn118",
		title: "Ānāpānasati Sutta",
		detail: "Mindfulness of breathing, in sixteen steps",
	},
	{
		href: "/sn56.11",
		title: "The Buddha’s first sermon",
		detail: "The four noble truths",
	},
	{
		href: "/an3.65",
		title: "Kālāma Sutta",
		detail: "How to know what is worth trusting",
	},
	{
		href: "/sn45.8",
		title: "Noble eightfold path",
		detail: "Each factor, explained",
	},
	{
		href: "/on/dependent-co-arising",
		title: "Dependent origination",
		detail: "How suffering arises and ends",
	},
	{
		href: "/sn35.28",
		title: "The Fire Sermon",
		detail: "The senses, burning",
	},
	{
		href: "/sn22.59",
		title: "Not-self",
		detail: "The five aggregates are not a self",
	},
	{
		href: "/snp2.4",
		title: "Maṅgala Sutta",
		detail: "The highest blessings",
	},
];

function addRedirects(
	out: Record<string, string>,
	paths: string[] | undefined,
	target: string,
) {
	for (const from of paths ?? []) {
		if (!from.startsWith("/") || from.endsWith("/") || from.includes("?")) {
			throw new Error(`Organic redirect must be a bare path: ${from}`);
		}
		const existing = out[from];
		if (existing && existing !== target) {
			throw new Error(
				`Organic redirect ${from} points at both ${existing} and ${target}`,
			);
		}
		out[from] = target;
	}
}

export const organicSearchRedirects: Record<string, string> = (() => {
	const out: Record<string, string> = {};
	for (const [id, entry] of Object.entries(discourseSearch)) {
		addRedirects(out, entry.redirects, `/${id}`);
	}
	for (const [slug, entry] of Object.entries(collectionSearch)) {
		addRedirects(out, entry.redirects, `/${slug}`);
	}
	for (const [slug, entry] of Object.entries(topicSearch)) {
		addRedirects(out, entry.redirects, `/on/${slug}`);
	}
	return out;
})();

export function discourseDocumentTitle(
	id: string | null | undefined,
): string | null {
	if (!id) return null;
	return discourseSearch[id]?.title ?? null;
}

export function discourseAlternateNames(
	id: string | null | undefined,
): string[] {
	if (!id) return [];
	return discourseSearch[id]?.aliases ?? [];
}

export function discourseMetaDescription(
	id: string | null | undefined,
	description: string | null | undefined,
): string | null {
	const base = String(description ?? "").trim();
	const entry = id ? discourseSearch[id] : undefined;
	if (!entry?.metaLead) return base || null;
	if (!base) return entry.metaLead;
	if (entry.aliases.some((alias) => containsFolded(base, alias))) return base;
	if (containsFolded(base, entry.metaLead)) return base;
	return `${entry.metaLead} ${base}`;
}

export function discourseAlsoKnown(
	id: string | null | undefined,
	title: string | null | undefined,
	description: string | null | undefined,
): string | null {
	const entry = id ? discourseSearch[id] : undefined;
	if (!entry?.alsoKnown) return null;
	const blob = `${title ?? ""} ${description ?? ""}`;
	if (containsFolded(blob, entry.alsoKnown.phrase)) return null;
	return entry.alsoKnown.line;
}

export function collectionDocumentMeta(
	slug: string | null | undefined,
): HubSearchEntry | null {
	if (!slug) return null;
	return collectionSearch[slug] ?? null;
}

export function topicDocumentMeta(
	slug: string | null | undefined,
): HubSearchEntry | null {
	if (!slug) return null;
	return topicSearch[slug] ?? null;
}
