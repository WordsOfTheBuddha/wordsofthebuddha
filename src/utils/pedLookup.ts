/**
 * Offline PTS Pali-English Dictionary (PED) headword lookup.
 * Data: src/data/pedDictionary.generated.json (built from SuttaCentral sc-data).
 */

export type PedEntry = {
	word: string;
	html: string;
};

type PedPack = {
	_meta?: { license?: string; entries?: number };
	entries: Record<string, string>;
};

let pedPromise: Promise<PedPack> | null = null;

function normalizePedKey(word: string): string {
	return word.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Strip DPD sense numbers: "sakka 1" → "sakka", "vutta 1.1" → "vutta". */
export function stripLemmaSenseNumber(lemma: string): string {
	return lemma.replace(/ \d+(\.\d+)*$/, "").trim();
}

function lemmaVariants(lemma: string): string[] {
	const base = normalizePedKey(stripLemmaSenseNumber(lemma));
	if (!base) return [];
	const variants = new Set<string>([base]);
	// attamanā → attamana; common PED headword shortening of finals
	const shortened = base.replace(/[āīū]$/u, (ch) =>
		ch === "ā" ? "a" : ch === "ī" ? "i" : "u",
	);
	if (shortened !== base) variants.add(shortened);
	// atthaṁ / atthaṃ → attha (niggahīta rarely kept on PED headwords)
	if (/[ṁṃ]$/u.test(base)) {
		variants.add(base.replace(/[ṁṃ]$/u, ""));
	}
	return [...variants];
}

async function loadPedPack(): Promise<PedPack> {
	if (!pedPromise) {
		pedPromise = import("../data/pedDictionary.generated.json").then(
			(mod) => (mod as { default: PedPack }).default ?? (mod as PedPack),
		);
	}
	return pedPromise;
}

/** Warm the PED chunk for offline caching (optional). */
export async function warmupPedDictionary(): Promise<void> {
	try {
		await loadPedPack();
	} catch {
		/* ignore */
	}
}

/**
 * Look up a PED headword. Prefer a DPD-resolved lemma.
 * Returns null when there is no headword match.
 */
export async function lookupPedHeadword(
	lemmaOrWord: string,
): Promise<PedEntry | null> {
	const pack = await loadPedPack();
	for (const key of lemmaVariants(lemmaOrWord)) {
		const html = pack.entries[key];
		if (html) return { word: key, html };
	}
	return null;
}

/**
 * Try several lemma candidates (primary DPD lemmas first); return first hit.
 */
export async function lookupPedFromLemmas(
	lemmas: string[],
): Promise<PedEntry | null> {
	const seen = new Set<string>();
	for (const lemma of lemmas) {
		for (const key of lemmaVariants(lemma)) {
			if (seen.has(key)) continue;
			seen.add(key);
			const hit = await lookupPedHeadword(key);
			if (hit) return hit;
		}
	}
	return null;
}
