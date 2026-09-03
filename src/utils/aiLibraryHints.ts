/**
 * Compact, token-cheap hints about what this library contains.
 * Helps the rewrite model pick real topics / Pāli forms / discourse IDs.
 */

const PALI_ENGLISH: readonly [string, string][] = [
	["kodha", "anger"],
	["dosa", "hate / aversion"],
	["lobha", "greed"],
	["moha", "delusion"],
	["taṇhā", "craving"],
	["upādāna", "clinging"],
	["dukkha", "suffering / stress"],
	["anicca", "impermanence"],
	["anattā", "not-self"],
	["sati", "mindfulness"],
	["samādhi", "concentration"],
	["paññā", "wisdom"],
	["vedanā", "feeling / felt experience"],
	["viññāṇa", "consciousness"],
	["nāmarūpa", "name-and-form"],
	["saṅkhāra", "formations / intentional constructs"],
	["phassa", "contact"],
	["jāti", "birth"],
	["jarāmaraṇa", "aging-and-death"],
	["nibbāna", "nibbāna / extinguishment"],
	["mettā", "loving-kindness"],
	["karuṇā", "compassion"],
	["upekkhā", "equanimity"],
	["nekkhamma", "renunciation"],
	["viriya", "energy / diligence"],
	["passaddhi", "tranquility"],
	["pīti", "rapture"],
	["sukha", "pleasure / ease"],
	["maraṇa", "death"],
	["punabbhava", "renewed existence"],
	["sakkāya", "identity view"],
	["diṭṭhi", "view"],
	["avijjā", "ignorance"],
	["pañca khandha", "five aggregates"],
];

/** Built once; safe to ship in the system prompt. */
export function buildAiLibraryHints(options?: {
	topicTitles?: readonly string[];
	qualityTitles?: readonly string[];
	/** slug=title pairs for person pages (exact figures in the library). */
	personEntries?: readonly { slug: string; title: string }[];
	discourseCatalogBlock?: string;
}): string {
	const topics = (options?.topicTitles || []).slice(0, 40);
	const qualities = (options?.qualityTitles || []).slice(0, 60);
	const persons = (options?.personEntries || []).slice(0, 160);
	const pali = PALI_ENGLISH.map(([p, e]) => `${p}=${e}`).join("; ");
	const lines = [
		"Library vocabulary (prefer these when relevant; do not invent sutta IDs):",
		`Pāli↔English: ${pali}`,
	];
	if (topics.length > 0) {
		lines.push(`Topic pages include: ${topics.join("; ")}`);
	}
	if (qualities.length > 0) {
		lines.push(`Quality pages include: ${qualities.join("; ")}`);
	}
	if (persons.length > 0) {
		lines.push(
			`Person pages (slug=title; use these exact slugs in personSlugs when the question is clearly about that figure): ${persons
				.map((entry) => `${entry.slug}=${entry.title}`)
				.join("; ")}`,
		);
	}
	lines.push(
		"Default search already matches titles, descriptions, IDs, and topics/qualities/similes/persons. Body text needs content:… or the user enabling full-text search; prefer short topical queries first.",
	);
	const catalog = (options?.discourseCatalogBlock || "").trim();
	if (catalog) {
		lines.push("", catalog);
	}
	return lines.join("\n");
}
