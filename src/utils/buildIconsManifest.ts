/**
 * Writes icons-manifest.json from embedded metadata.
 * Run: npx tsx src/utils/buildIconsManifest.ts
 *
 * **labels** — single facet list: quality keys from `qualities.json` and/or topic-style buckets
 * (synonyms via `TOPIC_SYNONYMS`, hyphens → spaces). Source may use `labels` and/or legacy
 * `themes` / `qualities` / `topics`; they are merged and deduped.
 *
 * **Valence** — from `labels` against `qualities.json` polarity lists (mixed +/− → none).
 * If no labels, inferred from title + description + tags (quality-key word matches).
 *
 * **tags** — search-only (e.g. line-art); not a facet.
 *
 * **Discourse (multi):** `discourse` may be a string or non-empty string[].
 * The **first** slug is the primary (default viz link order on the design-system page).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { sortDiscourseIds } from "./discourseSort";

type IconEntry = {
	id: string;
	title: string;
	description: string;
	/** One or more sutta slugs; first is primary (viz / Source). Merge when reusing across discourses. */
	discourse: string | string[];
	tags: string[];
	/** Facet labels (preferred). Merged with legacy `themes` / `qualities` / `topics` if present. */
	labels?: string[];
	/** @deprecated Prefer `labels`; merged into output `labels`. */
	themes?: string[];
	/** @deprecated Prefer `labels`; merged into output `labels`. */
	qualities?: string[];
	/** @deprecated Prefer `labels`; merged into output `labels`. */
	topics?: string[];
	/** Override inferred valence from qualities.json buckets. */
	valence?: "-ve" | "+ve" | "";
};

/** When an icon reuses another asset file (same graphic, different id). */
const SVG_OVERRIDES: Record<string, string> = {
	"sense-restraint": "icons/eye-shield.svg",
	"breakthrough-divine-eye": "icons/divine-eye.svg",
};

type ManifestIcon = Omit<
	IconEntry,
	"themes" | "qualities" | "topics" | "valence"
> & {
	svg: string;
	labels: string[];
	valence?: "-ve" | "+ve" | "";
};

const ROOT = resolve(
	process.cwd(),
	"src/assets/content-images/design-system/icons-manifest.json",
);
const QUALITIES_JSON = resolve(process.cwd(), "src/data/qualities.json");

const QUALITIES_RAW = JSON.parse(readFileSync(QUALITIES_JSON, "utf8")) as {
	negative: string[];
	neutral: string[];
	positive: string[];
	qualities: Record<string, unknown>;
};

const QUALITY_KEYS = Object.keys(QUALITIES_RAW.qualities);

const NEGATIVE_QUALITY_SET = new Set(QUALITIES_RAW.negative);
const POSITIVE_QUALITY_SET = new Set(QUALITIES_RAW.positive);
const NEUTRAL_QUALITY_SET = new Set(QUALITIES_RAW.neutral);

/** Map legacy / synonym topic buckets to canonical facet labels (spaces, no duplicates). */
const TOPIC_SYNONYMS: Record<string, string> = {
	satipatthana: "mindfulness",
	samadhi: "collectedness",
	jhana: "collectedness",
	"sense-bases": "sense bases",
	"sense-restraint": "sense restraint",
	"skillful-means": "skillful means",
	ethics: "ethical conduct",
	conduct: "ethical conduct",
	"five-hindrances": "five hindrances",
};

function normalizeLabels(raw: string[]): string[] {
	const out = new Set<string>();
	for (const t of raw) {
		const key = t.trim().toLowerCase();
		let canon = TOPIC_SYNONYMS[key] ?? TOPIC_SYNONYMS[t] ?? t.trim();
		if (canon.includes("-")) canon = canon.replace(/-/g, " ");
		out.add(canon.replace(/\s+/g, " ").trim());
	}
	return [...out].sort((a, b) =>
		a.localeCompare(b, undefined, { sensitivity: "base" }),
	);
}

function inferValence(
	labels: string[],
	manual?: "-ve" | "+ve" | "",
): "-ve" | "+ve" | "" | undefined {
	if (manual) return manual;
	const neg = labels.filter((q) => NEGATIVE_QUALITY_SET.has(q));
	const pos = labels.filter((q) => POSITIVE_QUALITY_SET.has(q));
	const neu = labels.filter((q) => NEUTRAL_QUALITY_SET.has(q));
	if (neg.length && pos.length) return "";
	if (neg.length) return "-ve";
	if (pos.length) return "+ve";
	if (neu.length) return "";
	return undefined;
}

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Dedupe; keep first slug as primary; sort remaining for stable output. */
function normalizeDiscourse(d: string | string[]): string | string[] {
	const raw = (Array.isArray(d) ? d : [d])
		.map((x) => x.trim())
		.filter((x) => x.length > 0);
	if (raw.length === 0) {
		throw new Error("discourse: at least one slug required");
	}
	const seen = new Set<string>();
	const deduped: string[] = [];
	for (const x of raw) {
		if (seen.has(x)) continue;
		seen.add(x);
		deduped.push(x);
	}
	if (deduped.length === 1) return deduped[0];
	const [primary, ...rest] = deduped;
	return [primary, ...sortDiscourseIds(rest)];
}

/** Infer quality keys from title/description/tags when `labels` is empty after merge. */
function inferLabelsFromText(
	icon: Pick<IconEntry, "title" | "description" | "tags">,
): string[] {
	const blob = `${icon.title} ${icon.description} ${icon.tags.join(" ")}`;
	const out: string[] = [];
	for (const key of QUALITY_KEYS) {
		if (key.length < 3) continue;
		const re = new RegExp(`\\b${escapeRegExp(key)}\\b`, "i");
		if (re.test(blob)) out.push(key);
	}
	return out;
}

const icons: IconEntry[] = [
	// MN 1
	{
		id: "seen",
		title: "Sense: seen",
		description: "Eye motif for diṭṭha",
		discourse: ["mn1", "mn148", "mn10"],
		tags: ["gold", "line-art", "sense"],
		themes: ["sense bases", "phenomena"],
	},
	{
		id: "heard",
		title: "Sense: heard",
		description: "Ear motif for suta",
		discourse: ["mn1", "mn148", "mn10"],
		tags: ["line-art", "sense"],
		themes: ["sense bases", "phenomena"],
	},
	{
		id: "sensed",
		title: "Sense: sensed",
		description: "Touch/nose motif for muta",
		discourse: ["mn1", "mn148"],
		tags: ["line-art", "sense"],
		themes: ["sense bases", "phenomena"],
	},
	{
		id: "cognized",
		title: "Sense: cognized",
		description: "Mind/consciousness motif for viññāta",
		discourse: ["mn1", "mn148", "mn10"],
		tags: ["line-art", "sense"],
		themes: ["sense bases", "phenomena"],
	},
	{
		id: "puthujjana-header",
		title: "Uninstructed ordinary person",
		description: "Depiction of a puthujjana, asappurisa",
		discourse: ["mn1", "mn113", "mn29", "mn30", "mn148"],
		tags: ["burgundy", "line-art"],
		themes: ["path", "phenomena", "unprincipled conduct"],
	},
	{
		id: "ariya-header",
		title: "Noble disciple",
		description: "Straight path with grounded node (sappurisa)",
		discourse: ["mn1", "mn113", "mn29", "mn30", "mn148"],
		tags: ["teal", "line-art"],
		themes: ["path", "person of integrity", "phenomena"],
	},
	{
		id: "earth",
		title: "Earth element",
		description: "Strata lines for pathavī",
		discourse: "mn1",
		tags: ["line-art", "elements"],
		themes: ["elements", "phenomena"],
	},
	{
		id: "water",
		title: "Water element",
		description: "Waves for āpo",
		discourse: "mn1",
		tags: ["line-art", "elements"],
		themes: ["elements", "phenomena"],
	},
	{
		id: "fire",
		title: "Fire element",
		description: "Flame for tejo",
		discourse: "mn1",
		tags: ["line-art", "elements", "fire"],
		themes: ["elements", "phenomena"],
	},
	{
		id: "air",
		title: "Air element",
		description: "Wind curves for vāyo",
		discourse: "mn1",
		tags: ["line-art", "elements"],
		themes: ["elements", "phenomena"],
	},
	{
		id: "beings",
		title: "Beings",
		description: "Twin stick figures for beings (bhūtā)",
		discourse: "mn1",
		tags: ["line-art"],
		themes: ["phenomena"],
	},
	{
		id: "deities",
		title: "Deities",
		description: "Figure with halo arc for devas",
		discourse: "mn1",
		tags: ["line-art", "gold"],
		themes: ["phenomena"],
	},
	{
		id: "creator",
		title: "Creator god",
		description: "Triangle crown for pajāpati",
		discourse: "mn1",
		tags: ["line-art"],
		themes: ["phenomena"],
	},
	{
		id: "brahma",
		title: "Brahmā",
		description: "Figure with outer ring",
		discourse: "mn1",
		tags: ["line-art", "gold"],
		themes: ["phenomena"],
	},
	{
		id: "streaming-radiance",
		title: "Streaming radiance",
		description: "ābhassarā — radiating circle",
		discourse: "mn1",
		tags: ["line-art"],
		themes: ["phenomena"],
	},
	{
		id: "refulgent",
		title: "Refulgent glory",
		description: "subhakiṇhā — nested circles",
		discourse: "mn1",
		tags: ["line-art"],
		themes: ["phenomena"],
	},
	{
		id: "great-fruit",
		title: "Great fruit",
		description: "vehapphalā — orb with three dots",
		discourse: "mn1",
		tags: ["line-art"],
		themes: ["phenomena"],
	},
	{
		id: "overlord",
		title: "Overlord",
		description: "abhibhū — circle with crown",
		discourse: "mn1",
		tags: ["line-art", "gold"],
		themes: ["phenomena"],
	},
	{
		id: "space-base",
		title: "Boundless space",
		description: "ākāsānañcāyatana — dashed circles",
		discourse: "mn1",
		tags: ["line-art", "dashed"],
		themes: ["phenomena", "formless"],
	},
	{
		id: "consciousness-base",
		title: "Boundless consciousness",
		description: "viññāṇañcāyatana — concentric rings",
		discourse: "mn1",
		tags: ["line-art"],
		themes: ["phenomena", "formless"],
	},
	{
		id: "nothingness-base",
		title: "Nothingness",
		description: "ākiñcaññāyatana — dashed ring",
		discourse: ["mn1", "mn106"],
		tags: ["line-art", "dashed"],
		themes: ["phenomena", "formless"],
	},
	{
		id: "neither-base",
		title: "Neither perception nor non-perception",
		description: "nevasaññānāsaññāyatana — dual stroke rings",
		discourse: ["mn1", "mn106"],
		tags: ["line-art"],
		themes: ["phenomena", "formless"],
	},
	{
		id: "oneness",
		title: "Oneness",
		description: "ekatta — single dot",
		discourse: "mn1",
		tags: ["line-art"],
		themes: ["phenomena"],
	},
	{
		id: "diversity",
		title: "Diversity",
		description: "nānatta — scattered dots",
		discourse: "mn1",
		tags: ["line-art"],
		themes: ["phenomena"],
	},
	{
		id: "all",
		title: "All",
		description: "sabba — ring with three inner dots",
		discourse: "mn1",
		tags: ["line-art"],
		themes: ["phenomena"],
	},
	// MN 2
	{
		id: "tangle-unwise-attention",
		title: "Unwise attention",
		description: "Tangled lines for ayoniso, āsava, uddhaccakukkucca",
		discourse: "mn2",
		tags: ["burgundy", "line-art"],
		themes: ["wisdom", "five hindrances", "harm"]
	},
	{
		id: "wise-attention",
		title: "Wise attention",
		description: "Clear lines and horizon circle for yoniso",
		discourse: "mn2",
		tags: ["teal", "line-art"],
		themes: ["wisdom", "safety"]
	},
	{
		id: "eye-shield",
		title: "Restraint (eye + gates)",
		description: "Saṃvara — eye with vertical bars.",
		discourse: "mn2",
		tags: ["line-art"],
		themes: ["wholesome", "sense restraint"]
	},
	{
		id: "bowl-robe",
		title: "Proper use (bowl + robe)",
		description: "Paṭisevanā requisites.",
		discourse: "mn2",
		tags: ["line-art"],
		themes: ["wholesome"]
	},
	{
		id: "endure",
		title: "Enduring",
		description: "Adhivāsanā — figure with stress lines.",
		discourse: "mn2",
		tags: ["line-art"],
		themes: ["wholesome"]
	},
	{
		id: "avoid-fork",
		title: "Avoiding (fork)",
		description: "Parivajjanā — path to danger vs safety.",
		discourse: "mn2",
		tags: ["line-art", "fork"],
		themes: ["safety", "wholesome", "non-harm"]
	},
	{
		id: "flame-thought",
		title: "Flame",
		description: "Flame representative of thought of sensual desire (kāmavitakka)",
		discourse: "mn2",
		tags: ["line-art", "flame"],
		themes: ["five hindrances", "unwholesome", "harm"]
	},
	{
		id: "thorn-vine",
		title: "Thorn vine",
		description: "Thorn vine representative of thought of ill will (byāpādavitakka)",
		discourse: "mn2",
		tags: ["line-art"],
		themes: ["five hindrances", "unwholesome", "harm"]
	},
	{
		id: "impact-star",
		title: "Remove: harmful thought",
		description: "Vihiṁsāvitakka — impact star.",
		discourse: "mn2",
		tags: ["line-art"],
		themes: ["harm", "unwholesome"]
	},
	{
		id: "seven-factors",
		title: "Seven awakening factors",
		description: "Bojjhaṅga arc — seven dots",
		discourse: "mn2",
		tags: ["line-art", "dots"],
		themes: ["awakening"]
	},
	// MN 3
	{
		id: "bowl-overflow",
		title: "Heir of material things (bowl with excess)",
		description: "Heaped bowl — āmisadāyāda",
		discourse: "mn3",
		tags: ["line-art", "bowl", "burgundy"],
	},
	{
		id: "bowl-empty",
		title: "Heir in the Dhamma (empty bowl)",
		description: "Empty bowl — dhammadāyāda",
		discourse: "mn3",
		tags: ["line-art", "bowl", "teal"],
	},
	// MN 4
	{
		id: "lunar-phases",
		title: "Lunar fortnight (four phases)",
		description: "Four lunar phases — auspicious nights row",
		discourse: "mn4",
		tags: ["line-art", "moon", "lunar"],
	},
	{
		id: "posture-walking",
		title: "Posture: walking",
		description: "Walking figure — postures",
		discourse: "mn4",
		tags: ["line-art", "figure"],
		themes: ["mindfulness"]
	},
	{
		id: "posture-standing",
		title: "Posture: standing",
		description: "Standing figure — postures",
		discourse: "mn4",
		tags: ["line-art", "figure"],
		themes: ["mindfulness"]
	},
	{
		id: "posture-sitting",
		title: "Posture: sitting",
		description: "Seated figure — postures",
		discourse: "mn4",
		tags: ["line-art", "figure"],
		themes: ["mindfulness"]
	},
	{
		id: "posture-lying",
		title: "Posture: lying down",
		description: "Reclining figure — postures",
		discourse: "mn4",
		tags: ["line-art", "figure"],
		themes: ["mindfulness"]
	},
	// MN 5
	{
		id: "bowl-stained",
		title: "Stained bronze bowl",
		description: "Stained bowl (neglected) — not seeing one’s blemish",
		discourse: "mn5",
		tags: ["line-art", "bowl", "burgundy"],
		qualities: ["negligence"]
	},
	{
		id: "bowl-polished",
		title: "Polished bronze bowl",
		description: "Polished bowl (cared for) — knowing one’s blemish",
		discourse: "mn5",
		tags: ["line-art", "bowl", "gold"],
		qualities: ["diligence"]
	},
	{
		id: "bowl-dusty-clean",
		title: "Bowl gathering dust",
		description: "Clean bowl gathering dust",
		discourse: "mn5",
		tags: ["line-art", "bowl"],
		qualities: ["negligence"]
	},
	{
		id: "bowl-gleaming",
		title: "Clean gleaming bowl",
		description: "Shining clean bowl",
		discourse: "mn5",
		tags: ["line-art", "bowl", "gold"],
		qualities: ["diligence"],
	},
	{
		id: "wish-eye-slash",
		title: "Unwholesome wish: concealing wrongdoing",
		description: "Eye with slash — wish for hiding faults",
		discourse: "mn5",
		tags: ["line-art", "wish"],
		themes: ["unwholesome", "unprincipled conduct"]
	},
	{
		id: "wish-status-seat",
		title: "Unwholesome wish: status",
		description: "Seat motif — desire for precedence and honor",
		discourse: "mn5",
		tags: ["line-art", "wish"],
		themes: ["unwholesome", "unprincipled conduct"]
	},
	{
		id: "wish-teach-speaker",
		title: "Unwholesome wish: to teach",
		description: "Speaking figure — wish to instruct others",
		discourse: "mn5",
		tags: ["line-art", "wish"],
		themes: ["unwholesome", "unprincipled conduct"]
	},
	{
		id: "wish-honor-bow",
		title: "Unwholesome wish: honor",
		description: "Bow and second figure — wish to be revered",
		discourse: "mn5",
		tags: ["line-art", "wish"],
		themes: ["unwholesome", "unprincipled conduct"]
	},
	{
		id: "wish-requisite-robe",
		title: "Requisite: robes",
		description: "Robe triangle — finest requisites",
		discourse: "mn5",
		tags: ["line-art", "wish"],
		themes: ["unwholesome"]
	},
	{
		id: "wish-requisite-bowl",
		title: "Requisite: alms bowl",
		description: "Small bowl — piṇḍapāta",
		discourse: "mn5",
		tags: ["line-art", "wish", "bowl"],
		themes: ["unwholesome"]
	},
	{
		id: "wish-requisite-lodging",
		title: "Requisite: lodging",
		description: "Shelter outline — senāsana",
		discourse: "mn5",
		tags: ["line-art", "wish"],
		themes: ["unwholesome"]
	},
	{
		id: "wish-requisite-medicine",
		title: "Requisite: medicine",
		description: "Cross in circle — bhesajja",
		discourse: "mn5",
		tags: ["line-art", "wish"],
		themes: ["unwholesome"]
	},
	// MN 118
	{
		id: "body-observer",
		title: "Body contemplation",
		description: "Small seated figure — kāyānupassī",
		discourse: ["mn118", "mn148", "mn10"],
		tags: ["line-art", "figure", "body"],
		themes: ["mindfulness", "sense bases", "sense restraint", "wholesome"],
	},
	{
		id: "feeling-droplet",
		title: "Feeling contemplation",
		description: "Droplet or flame — vedanānupassī",
		discourse: ["mn118", "mn10"],
		tags: ["line-art", "feeling"],
		themes: ["mindfulness", "wholesome", "sense restraint"],
	},
	{
		id: "elbow-bracket",
		title: "Elbow bracket",
		description: "Orthogonal connector with rounded elbow",
		discourse: "mn118",
		tags: ["line-art", "connector"],
	},
	{
		id: "number-badge-r10",
		title: "Number badge (r=10)",
		description: "Template circle + digit for stepped lists",
		discourse: "mn118",
		tags: ["badge", "number"],
	},
	{
		id: "number-badge-02",
		title: "Step badge: 2",
		description: "number display: 2",
		discourse: "mn118",
		tags: ["badge", "number"],
	},
	{
		id: "number-badge-03",
		title: "Step badge: 3",
		description: "number display: 3",
		discourse: "mn118",
		tags: ["badge", "number"],
	},
	{
		id: "number-badge-04",
		title: "Step badge: 4",
		description: "number display: 4",
		discourse: "mn118",
		tags: ["badge", "number"],
	},
	{
		id: "number-badge-05",
		title: "Step badge: 5",
		description: "number display: 5",
		discourse: "mn118",
		tags: ["badge", "number"],
	},
	{
		id: "number-badge-06",
		title: "Step badge: 6",
		description: "number display: 6",
		discourse: "mn118",
		tags: ["badge", "number"],
	},
	{
		id: "number-badge-07",
		title: "Step badge: 7",
		description: "number display: 7",
		discourse: "mn118",
		tags: ["badge", "number"],
	},
	{
		id: "number-badge-08",
		title: "Step badge: 8",
		description: "number display: 8",
		discourse: "mn118",
		tags: ["badge", "number"],
	},
	{
		id: "number-badge-09",
		title: "Step badge: 9",
		description: "number display: 9",
		discourse: "mn118",
		tags: ["badge", "number"],
	},
	{
		id: "number-badge-10",
		title: "Step badge: 10",
		description: "number display: 10",
		discourse: "mn118",
		tags: ["badge", "number"],
	},
	{
		id: "number-badge-11",
		title: "Step badge: 11",
		description: "number display: 11",
		discourse: "mn118",
		tags: ["badge", "number"],
	},
	{
		id: "number-badge-12",
		title: "Step badge: 12",
		description: "number display: 12",
		discourse: "mn118",
		tags: ["badge", "number"],
	},
	{
		id: "number-badge-13",
		title: "Step badge: 13",
		description: "number display: 13",
		discourse: "mn118",
		tags: ["badge", "number"],
	},
	{
		id: "number-badge-14",
		title: "Step badge: 14",
		description: "number display: 14",
		discourse: "mn118",
		tags: ["badge", "number"],
	},
	{
		id: "number-badge-15",
		title: "Step badge: 15",
		description: "number display: 15",
		discourse: "mn118",
		tags: ["badge", "number"],
	},
	{
		id: "number-badge-16",
		title: "Step badge: 16",
		description: "number display: 16",
		discourse: "mn118",
		tags: ["badge", "number"],
	},
	{
		id: "mind-contemplation",
		title: "Mind contemplation",
		description:
			"Concentric circles — citte cittānupassī",
		discourse: ["mn118", "mn10"],
		tags: ["line-art", "mind"],
		themes: ["mindfulness", "wholesome", "sense restraint"],
	},
	{
		id: "mental-qualities",
		title: "Mental qualities",
		description:
			"dhammesu dhammānupassī",
		discourse: ["mn118", "mn10"],
		tags: ["line-art", "dhamma"],
		themes: ["mindfulness", "wholesome", "sense restraint"],
	},
	{
		id: "bojjhanga-investigation",
		title: "Bojjhaṅga: investigation of states",
		description:
			"dhammavicayasambojjhaṅga glyph",
		discourse: ["mn118", "mn10"],
		tags: ["line-art", "bojjhanga"],
		themes: ["awakening", "wisdom"]
	},
	{
		id: "bojjhanga-energy",
		title: "Bojjhaṅga: energy",
		description:
			"vīriyasambojjhaṅga glyph",
		discourse: ["mn118", "mn10"],
		tags: ["line-art", "bojjhanga"],
		themes: ["awakening", "diligence", "effort"]
	},
	{
		id: "bojjhanga-joy",
		title: "Bojjhaṅga: joy",
		description:
			"pītisambojjhaṅga glyph",
		discourse: ["mn118", "mn10"],
		tags: ["line-art", "bojjhanga"],
		themes: ["awakening", "collectedness"]
	},
	{
		id: "bojjhanga-tranquility",
		title: "Bojjhaṅga: tranquility",
		description:
			"passaddhisambojjhaṅga glyph",
		discourse: ["mn118", "mn10"],
		tags: ["line-art", "bojjhanga"],
		themes: ["awakening", "collectedness"]
	},
	{
		id: "bojjhanga-collectedness",
		title: "Bojjhaṅga: collectedness",
		description:
			"samādhisambojjhaṅga glyph",
		discourse: ["mn118", "mn10"],
		tags: ["line-art", "bojjhanga"],
		themes: ["awakening", "collectedness"]
	},
	{
		id: "bojjhanga-equanimity",
		title: "Bojjhaṅga: equanimity",
		description:
			"upekkhāsambojjhaṅgo glyph",
		discourse: ["mn118", "mn10"],
		tags: ["line-art", "bojjhanga"],
		themes: ["awakening", "equanimity"]
	},
	// MN 119
	{
		id: "breath-torso",
		title: "Mindfulness of breathing (torso icon)",
		description:
			"Breath and torso line-art",
		discourse: ["mn119", "mn10"],
		tags: ["line-art", "breath", "body"],
		themes: ["mindfulness", "awakening", "clear awareness"],
	},
	{
		id: "shared-postures-four",
		title: "Four postures",
		description:
			"Four postures: walk → stand → sit → lie",
		discourse: ["mn119", "mn20", "mn10"],
		tags: ["line-art", "figure"],
		themes: ["skillful means", "mindfulness"],
	},
	{
		id: "clear-awareness-fourfold",
		title: "Clear awareness — four sense domains",
		description:
			"2×2 grid (eye, ear, body activity, cognizing) — sampajānakārī",
		discourse: ["mn119", "mn10"],
		tags: ["line-art"],
		themes: ["clear awareness", "mindfulness"],
	},
	{
		id: "body-impurities",
		title: "Body impurities review",
		description:
			"Asuci paccavekkhana motif, kāyānupassanā",
		discourse: ["mn119", "mn10"],
		tags: ["line-art", "body"],
		themes: ["mindfulness"],
	},
	{
		id: "four-elements",
		title: "Four elements in the body",
		description:
			"Earth, water, fire, wind motifs",
		discourse: ["mn119", "mn10", "mn106"],
		tags: ["line-art"],
		themes: ["elements", "mindfulness"],
	},
	{
		id: "charnel-skull",
		title: "Nine charnel grounds",
		description:
			"Skull and bones — sivathikā",
		discourse: ["mn119", "mn10"],
		tags: ["line-art", "death"],
		themes: ["mindfulness", "wholesome"],
	},
	{
		id: "jhana-first",
		title: "First jhāna simile",
		description: "Kneading bath with bubbles — jhāna band",
		discourse: "mn119",
		tags: ["line-art", "jhana"],
		themes: ["collectedness", "awakening", "renunciation", "non-harm"]
	},
	{
		id: "jhana-second",
		title: "Second jhāna simile",
		description: "Lake and spring — jhāna band",
		discourse: "mn119",
		tags: ["line-art", "jhana"],
		themes: ["collectedness", "awakening", "renunciation", "non-harm"]
	},
	{
		id: "jhana-third",
		title: "Third jhāna simile",
		description: "Submerged lotus — jhāna band",
		discourse: "mn119",
		tags: ["line-art", "jhana"],
		themes: ["collectedness", "awakening", "renunciation", "non-harm", "mindfulness", "equanimity"]
	},
	{
		id: "jhana-fourth",
		title: "Fourth jhāna simile",
		description: "Bright orb — jhāna band",
		discourse: ["mn119", "mn106"],
		tags: ["line-art", "jhana"],
		themes: ["collectedness", "direct knowledge", "awakening", "renunciation", "non-harm", "clear awareness", "mindfulness", "equanimity", "dispassion"]
	},
	{
		id: "simile-uncultivated-clay",
		title: "Uncultivated: clay and rock",
		description: "abhāvitā simile — wet clay",
		discourse: "mn119",
		tags: ["line-art"],
		themes: ["unwholesome", "uncultivated", "harm"]
	},
	{
		id: "simile-uncultivated-wood",
		title: "Uncultivated: dry wood",
		description: "abhāvitā simile — dry sapless wood",
		discourse: "mn119",
		tags: ["line-art"],
		themes: ["unwholesome", "uncultivated", "harm"]
	},
	{
		id: "simile-uncultivated-jar",
		title: "Uncultivated: empty jar",
		description: "abhāvitā simile — empty water jar",
		discourse: "mn119",
		tags: ["line-art"],
		themes: ["unwholesome", "uncultivated", "harm"]
	},
	{
		id: "simile-cultivated-string",
		title: "Cultivated: string on heartwood",
		description: "bhāvitā simile — light ball on solid wood",
		discourse: "mn119",
		tags: ["line-art"],
		themes: ["wholesome", "cultivation", "non-harm"]
	},
	{
		id: "simile-cultivated-wet-wood",
		title: "Cultivated: wet sappy wood",
		description: "bhāvitā simile — fire cannot take",
		discourse: "mn119",
		tags: ["line-art"],
		themes: ["wholesome", "cultivation", "non-harm"]
	},
	{
		id: "simile-cultivated-full-jar",
		title: "Cultivated: full jar",
		description: "bhāvitā simile — full water jar",
		discourse: "mn119",
		tags: ["line-art"],
		themes: ["wholesome", "cultivation", "non-harm"]
	},
	{
		id: "chariot-wheel",
		title: "Skilled charioteer",
		description: "Spoked wheel — charioteer simile",
		discourse: "mn119",
		tags: ["line-art"],
		themes: ["direct knowledge"]
	},
	{
		id: "defilements-ended",
		title: "Ending of mental defilements",
		description: "Twin liberation orbs — āsavakkhaya, cetovimutti",
		discourse: "mn119",
		tags: ["line-art", "gold"],
		themes: ["awakening", "liberation", "ending", "safety"]
	},
	// MN 113
	{
		id: "conceit-noble-birth",
		title: "Conceit motif: noble birth",
		description: "Crown zigzag — worldly status",
		discourse: "mn113",
		tags: ["line-art", "mn113"],
	},
	{
		id: "conceit-wealth",
		title: "Conceit motif: abundant wealth",
		description: "Twin orbs",
		discourse: "mn113",
		tags: ["line-art", "mn113"],
	},
	{
		id: "conceit-fame",
		title: "Conceit motif: recognition and fame",
		description: "Star",
		discourse: "mn113",
		tags: ["line-art", "mn113"],
	},
	{
		id: "conceit-material-gains",
		title: "Conceit motif: material gains",
		description: "Dish / gains curve",
		discourse: "mn113",
		tags: ["line-art", "mn113"],
	},
	{
		id: "conceit-great-learning",
		title: "Conceit motif: great learning",
		description: "Open book",
		discourse: "mn113",
		tags: ["line-art", "mn113"],
	},
	{
		id: "conceit-vinaya",
		title: "Conceit motif: Vinaya expert",
		description: "Scroll / basket",
		discourse: "mn113",
		tags: ["line-art", "mn113"],
	},
	{
		id: "conceit-dhamma-teacher",
		title: "Conceit motif: Dhamma teacher",
		description: "Head with speech arc",
		discourse: "mn113",
		tags: ["line-art", "mn113"],
	},
	{
		id: "conceit-forest",
		title: "Conceit motif: forest dweller",
		description: "Tree",
		discourse: "mn113",
		tags: ["line-art", "mn113"],
	},
	{
		id: "conceit-rag-robe",
		title: "Conceit motif: rag-robe wearer",
		description: "Folded cloth",
		discourse: "mn113",
		tags: ["line-art", "mn113"],
	},
	{
		id: "conceit-alms",
		title: "Conceit motif: alms collector",
		description: "Alms bowl curve",
		discourse: "mn113",
		tags: ["line-art", "mn113"],
	},
	// UI (shared)
	{
		id: "ui-chevron-down",
		title: "Chevron down",
		description: "Small downward chevron",
		discourse: ["mn1", "mn2"],
		tags: ["ui", "chevron"],
	},
	{
		id: "ui-arrow-down",
		title: "Arrow down",
		description: "Conclusion / transition arrow",
		discourse: "mn2",
		tags: ["ui", "arrow"],
	},
	// Other discourses (sweep)
	{
		id: "liberation-sparkle",
		title: "Liberation sparkle",
		description: "Gold sparkle on path to liberation",
		discourse: "an10.1",
		tags: ["gold", "line-art", "sparkle"],
	},
	{
		id: "wide-arc",
		title: "Wide structural arc",
		description: "Horizontal quadratic rail",
		discourse: "an7.61",
		tags: ["line-art", "arc"],
	},
	{
		id: "branch-split",
		title: "Branch split",
		description: "Chevron with two curved branches",
		discourse: "sn36.6",
		tags: ["line-art", "fork"],
	},
	{
		id: "tree-barren",
		title: "Tree simile: without branches and leaves",
		description: "Barren twin-trunk tree",
		discourse: "an7.65",
		tags: ["line-art", "an7", "tree"],
		themes: ["path", "unprincipled conduct", "unwholesome"],
	},
	{
		id: "tree-flourishing",
		title: "Tree simile: abundant branches and leaves",
		description: "Flourishing tree with canopy",
		discourse: "an7.65",
		tags: ["line-art", "an7", "tree"],
		themes: ["ethical conduct", "path", "person of integrity", "wholesome"],
	},
	{
		id: "head-on-fire",
		title: "Simile: head on fire",
		description: "Flame motif",
		discourse: "an10.51",
		tags: ["line-art", "an10", "urgency"],
		themes: ["effort", "mindfulness"],
	},
	{
		id: "two-darts",
		title: "Two darts",
		description: "Figure with bodily dart and mental loop",
		discourse: "sn36.6",
		tags: ["line-art", "sn36", "vedana", "dart"],
		themes: ["suffering", "insight"],
	},
	{
		id: "one-dart",
		title: "One dart",
		description: "Figure with bodily dart only",
		discourse: "sn36.6",
		tags: ["line-art", "sn36", "vedana", "dart"],
		themes: ["liberation", "insight"],
	},
	{
		id: "friction-sticks-heat",
		title: "rubbing wood: friction and heat",
		description:
			"Rubbing two dry wood pieces produces flame-like heat. Simile for sustained contact (phassa) that produces feeling.",
		discourse: "sn36.10",
		tags: ["line-art", "simile"],
		themes: ["insight", "simile"],
	},
	{
		id: "sticks-separated-heat",
		title: "separating wood: heat fades",
		description:
			"Separating two dry wood pieces extinguishes the flame-like heat. Simile for ceasing contact (phassa) that ceases feeling.",
		discourse: "sn36.10",
		tags: ["line-art", "simile"],
		themes: ["insight", "simile"],
	},
	// MN 53 Sekha — training path (reuses MN2 eye-shield, MN119 divine eye, MN2 broken chain where noted)
	{
		id: "virtue-tablet",
		title: "Accomplishment in virtue",
		description: "Tablet with precepts and checkmark",
		discourse: "mn53",
		tags: ["line-art", "mn53", "sekha", "sila"],
		themes: ["ethics", "conduct"],
	},
	{
		id: "sense-restraint",
		title: "Sense restraint",
		description: "Eye with shield",
		discourse: "mn53",
		tags: ["line-art", "mn53", "sekha", "sense"],
		themes: ["sense restraint", "wholesome"],
	},
	{
		id: "moderation-bowl",
		title: "Moderation in eating",
		description: "Alms bowl",
		discourse: "mn53",
		tags: ["line-art", "mn53", "sekha", "bowl"],
		themes: ["conduct", "renunciation", "sense restraint"],
	},
	{
		id: "wakefulness-moon",
		title: "Devotion to wakefulness",
		description: "Moon with watch marks",
		discourse: "mn53",
		tags: ["line-art", "mn53", "sekha"],
		themes: ["effort", "mindfulness", "clear awareness"],
	},
	{
		id: "hen-egg-simile",
		title: "Hen and egg simile",
		description: "Cracked egg",
		discourse: "mn53",
		tags: ["line-art", "mn53", "sekha"],
		themes: ["insight", "liberation", "awakening"],
	},
	{
		id: "past-lives-eye",
		title: "Recollection of past lives",
		description: "Eye glancing backward — first breakthrough (pubbenivāsānussati)",
		discourse: "mn53",
		tags: ["line-art", "mn53", "sekha"],
		themes: ["insight", "liberation", "psychic power", "direct knowledge"],
	},
	{
		id: "breakthrough-divine-eye",
		title: "Divine eye",
		description:
			"Radiant eye — second breakthrough (dibbacakkhu)",
		discourse: ["mn53", "mn119"],
		tags: ["line-art", "mn53", "sekha"],
		themes: ["insight", "liberation", "psychic power", "direct knowledge"],
		qualities: ["psychic power"],
	},
	{
		id: "broken-chain",
		title: "breaking of fetters",
		description: "Fetters abandoned — broken chain",
		discourse: ["mn2", "mn53", "mn119"],
		tags: ["line-art", "mn53", "sekha"],
		themes: ["liberation", "insight", "psychic power", "direct knowledge", "ending"],
	},
	// MN 148 Chachakka — unique internal-base icons (body: mn118-body-observer)
	{
		id: "sense-nose",
		title: "Internal sense base: nose",
		description:
			"Nose outline — ghāna",
		discourse: ["mn148", "mn10"],
		tags: ["line-art", "mn148", "sense"],
		themes: ["sense bases", "phenomena"],
	},
	{
		id: "sense-tongue",
		title: "Internal sense base: tongue",
		description:
			"Tongue outline — jivhā",
		discourse: ["mn148", "mn10"],
		tags: ["line-art", "mn148", "sense"],
		themes: ["sense bases", "phenomena"],
	},
	// MN 20 Vitakkasaṇṭhāna — similes (postures: shared-postures-four)
	{
		id: "simile-carpenter-pegs",
		title: "Fine peg replaces coarse peg",
		description: "Two pegs and replacement arrow (aññaṁ nimittaṁ…)",
		discourse: "mn20",
		tags: ["line-art", "mn20", "vitakka"],
		themes: ["skillful means", "wholesome"],
	},
	{
		id: "simile-carcass-necklace",
		title: "Carcass hung around the neck",
		description: "Figure recoiling from necklace (drawbacks)",
		discourse: "mn20",
		tags: ["line-art", "mn20", "vitakka"],
		themes: ["dispassion", "insight", "skillful means"],
	},
	{
		id: "simile-look-away",
		title: "Closing the eyes / looking away",
		description: "Struck-through eye — (asati amanasikāra)",
		discourse: "mn20",
		tags: ["line-art", "mn20", "vitakka"],
		themes: ["sense restraint", "skillful means"],
	},
	{
		id: "simile-subdue-figures",
		title: "Strong person subdues a weaker one",
		description: "Two figures — (forceful mind training)",
		discourse: "mn20",
		tags: ["line-art", "mn20", "vitakka"],
		themes: ["wholesome", "effort", "skillful means"],
	},
	// MN 10 Satipaṭṭhāna — five hindrances (detail panel)
	{
		id: "hindrance-dullness",
		title: "Hindrance: dullness and drowsiness",
		description: "Thinamiddha motif — cloud and drooping line.",
		discourse: "mn10",
		tags: ["line-art", "mn10", "hindrances"],
		labels: ["five hindrances", "unwholesome", "harm"],
	},
	{
		id: "hindrance-doubt",
		title: "Hindrance: doubt",
		description: "Vicikicchā motif — question-mark curve.",
		discourse: "mn10",
		tags: ["line-art", "mn10", "hindrances"],
		labels: ["five hindrances", "unwholesome", "harm"],
	},
	// ── MN 106 · Āneñjasappāya Sutta ────────────────────────────
	{
		id: "impermanence-dissolve",
		title: "Recognition of impermanence",
		description: "Half-arc dissolving into particles — aniccasaññā",
		discourse: "mn106",
		tags: ["line-art", "mn106"],
		labels: ["recognition of impermanence", "dispassion", "wisdom"],
	},
	{
		id: "emptiness-void",
		title: "Emptiness of perceptions",
		description: "Hollow ring with dashed void — suññato",
		discourse: "mn106",
		tags: ["line-art", "mn106"],
		labels: ["with nothing", "perceiving escape", "formless"],
	},
	{
		id: "non-belonging-scatter",
		title: "Non-belonging",
		description: "Unconnected dot with dispersed lines — netaṁ mama",
		discourse: "mn106",
		tags: ["line-art", "mn106"],
		labels: ["recognition of not-self", "free from attachment", "non-identification", "formless"],
	},
	{
		id: "dwell-loop",
		title: "Return loop (repeat often)",
		description:
			"U-shaped track with arrow — dwell thus often · tabbahulavihārī",
		discourse: "mn106",
		tags: ["line-art", "mn106", "arrow"],
		labels: ["skillful means", "diligence", "effort"],
	},
];

function main() {
	const iconsOut: ManifestIcon[] = icons.map((icon) => {
		const {
			themes,
			qualities: qManual,
			topics: tManual,
			labels: labelsManual,
			valence: vManual,
			discourse: discRaw,
			...rest
		} = icon;
		const mergedRaw = [
			...(labelsManual ?? []),
			...(tManual ?? []),
			...(themes ?? []),
			...(qManual ?? []),
		];
		let labelsOut = normalizeLabels(mergedRaw);
		if (!labelsOut.length) {
			labelsOut = normalizeLabels(inferLabelsFromText(rest));
		}
		const valenceOut = inferValence(labelsOut, vManual);
		return {
			...rest,
			discourse: normalizeDiscourse(discRaw),
			labels: labelsOut,
			...(valenceOut ? { valence: valenceOut } : {}),
			svg: SVG_OVERRIDES[icon.id] ?? `icons/${icon.id}.svg`,
		};
	});
	const payload = { version: 1, icons: iconsOut };
	writeFileSync(ROOT, JSON.stringify(payload, null, "\t") + "\n", "utf8");
	console.log("Wrote", iconsOut.length, "icons to", ROOT);
}

main();
