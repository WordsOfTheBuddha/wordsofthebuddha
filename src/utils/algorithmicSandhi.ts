/**
 * Algorithmic Pali Sandhi Splitting
 *
 * When a compound word is not found in paliSandhi.json or the dictionary,
 * this module attempts to reverse-engineer the sandhi rules to split it
 * into constituent parts that ARE found in the dictionary.
 *
 * The reverse sandhi rules are derived from patterns observed in
 * paliSandhi.json and classical Pali grammar.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SandhiCandidate {
	/** The left part of the split (restored to its pre-sandhi form) */
	left: string;
	/** The right part of the split (restored to its pre-sandhi form) */
	right: string;
	/** Name of the rule that produced this candidate */
	rule: string;
	/** Split position in the original compound */
	splitPos: number;
}

export interface SandhiSplitResult {
	/** Original compound word */
	word: string;
	/** Ordered list of constituent words after splitting */
	parts: string[];
	/** Chain of rule names applied */
	rules: string[];
}

// ---------------------------------------------------------------------------
// Reverse Sandhi Rules
//
// Each rule takes the compound word and a split position, and returns an
// array of candidate (left, right) pairs. The split position is the index
// where we conceptually divide the compound; the rule determines how to
// reconstruct the original words from the junction characters.
// ---------------------------------------------------------------------------

type ReverseSandhiRule = (
	word: string,
	pos: number
) => SandhiCandidate[] | null;

const VOWELS = new Set(["a", "ā", "i", "ī", "u", "ū", "e", "o"]);

function isVowel(ch: string): boolean {
	return VOWELS.has(ch);
}

/**
 * Build the ordered list of reverse sandhi rules.
 *
 * Rules are ordered roughly by frequency (most common first) so that
 * the first valid split found tends to be the best one.
 */
function buildReverseSandhiRules(): {
	name: string;
	fn: ReverseSandhiRule;
}[] {
	return [
		// -----------------------------------------------------------------
		// 1. Direct concatenation (no transformation at junction)
		//    e.g. kuppapaṭicca + santiṁ → kuppapaṭiccasantiṁ
		// -----------------------------------------------------------------
		{
			name: "direct",
			fn: (word, pos) => {
				const left = word.slice(0, pos);
				const right = word.slice(pos);
				if (left.length >= 2 && right.length >= 2) {
					return [{ left, right, rule: "direct", splitPos: pos }];
				}
				return null;
			},
		},

		// -----------------------------------------------------------------
		// 2. Niggahīta (ṁ/ṃ) → m before vowels  (88 occurrences)
		//    kathaṁ + accayeyya → kathamaccayeyya
		//    Reverse: if we see 'm' at junction followed by a vowel,
		//    try restoring left to end with ṁ
		// -----------------------------------------------------------------
		{
			name: "niggahita_m",
			fn: (word, pos) => {
				if (pos < 2 || pos >= word.length) return null;
				const charAtJunction = word[pos - 1]; // last char of left portion
				const charAfter = word[pos]; // first char of right portion
				if (charAtJunction === "m" && isVowel(charAfter)) {
					const left = word.slice(0, pos - 1) + "ṁ";
					const right = word.slice(pos);
					return [
						{ left, right, rule: "niggahita_m", splitPos: pos },
					];
				}
				return null;
			},
		},

		// -----------------------------------------------------------------
		// 3. Vowel elision: drop final -a of first word before vowel
		//    yena + upaṭṭhānasālā → yenupaṭṭhānasālā
		//    Reverse: try inserting 'a' at end of left part
		// -----------------------------------------------------------------
		{
			name: "elide_final_a",
			fn: (word, pos) => {
				if (pos < 2 || pos >= word.length) return null;
				const charAfter = word[pos]; // first char of right
				if (isVowel(charAfter)) {
					const left = word.slice(0, pos) + "a";
					const right = word.slice(pos);
					return [
						{ left, right, rule: "elide_final_a", splitPos: pos },
					];
				}
				return null;
			},
		},

		// -----------------------------------------------------------------
		// 4. Drop initial a- of second word (17 occurrences)
		//    yassa + antarato → yassantarato
		//    Reverse: try prepending 'a' to right part
		// -----------------------------------------------------------------
		{
			name: "elide_initial_a",
			fn: (word, pos) => {
				if (pos < 2 || pos >= word.length) return null;
				const left = word.slice(0, pos);
				const right = "a" + word.slice(pos);
				return [
					{ left, right, rule: "elide_initial_a", splitPos: pos },
				];
			},
		},

		// -----------------------------------------------------------------
		// 5. Vowel coalescence: a + a → ā  (14 occurrences)
		//    ca + asi → cāsi
		//    Reverse: if we see 'ā' at junction, try left+'a' and 'a'+right
		// -----------------------------------------------------------------
		{
			name: "aa_to_long_a",
			fn: (word, pos) => {
				if (pos < 1 || pos >= word.length) return null;
				// The 'ā' straddles the junction
				if (word[pos - 1] === "ā") {
					const left = word.slice(0, pos - 1) + "a";
					const right = "a" + word.slice(pos);
					return [
						{ left, right, rule: "aa_to_long_a", splitPos: pos },
					];
				}
				// Also try: the ā is at position pos
				if (word[pos] === "ā") {
					const left = word.slice(0, pos) + "a";
					const right = "a" + word.slice(pos + 1);
					return [
						{ left, right, rule: "aa_to_long_a", splitPos: pos },
					];
				}
				return null;
			},
		},

		// -----------------------------------------------------------------
		// 6. Vowel coalescence: i + i → ī  (12 occurrences)
		//    pāti + iti → pātīti
		// -----------------------------------------------------------------
		{
			name: "ii_to_long_i",
			fn: (word, pos) => {
				if (pos < 1 || pos >= word.length) return null;
				if (word[pos - 1] === "ī") {
					const left = word.slice(0, pos - 1) + "i";
					const right = "i" + word.slice(pos);
					return [
						{ left, right, rule: "ii_to_long_i", splitPos: pos },
					];
				}
				if (word[pos] === "ī") {
					const left = word.slice(0, pos) + "i";
					const right = "i" + word.slice(pos + 1);
					return [
						{ left, right, rule: "ii_to_long_i", splitPos: pos },
					];
				}
				return null;
			},
		},

		// -----------------------------------------------------------------
		// 7. Vowel coalescence: u + u → ū
		// -----------------------------------------------------------------
		{
			name: "uu_to_long_u",
			fn: (word, pos) => {
				if (pos < 1 || pos >= word.length) return null;
				if (word[pos - 1] === "ū") {
					const left = word.slice(0, pos - 1) + "u";
					const right = "u" + word.slice(pos);
					return [
						{ left, right, rule: "uu_to_long_u", splitPos: pos },
					];
				}
				if (word[pos] === "ū") {
					const left = word.slice(0, pos) + "u";
					const right = "u" + word.slice(pos + 1);
					return [
						{ left, right, rule: "uu_to_long_u", splitPos: pos },
					];
				}
				return null;
			},
		},

		// -----------------------------------------------------------------
		// 8. a + i → ā  (contraction, as in brāhmaṇa + iti → brāhmaṇāti)
		//    Reverse: if we see 'ā', try left+'a' and 'i'+right
		// -----------------------------------------------------------------
		{
			name: "a_i_to_long_a",
			fn: (word, pos) => {
				if (pos < 1 || pos >= word.length) return null;
				if (word[pos - 1] === "ā") {
					const left = word.slice(0, pos - 1) + "a";
					const right = "i" + word.slice(pos);
					return [
						{
							left,
							right,
							rule: "a_i_to_long_a",
							splitPos: pos,
						},
					];
				}
				return null;
			},
		},

		// -----------------------------------------------------------------
		// 9. a + i → o  (as in pahātabba + iti → pahātabboti)
		//    Reverse: if we see 'o', try left+'a' and 'i'+right
		// -----------------------------------------------------------------
		{
			name: "a_i_to_o",
			fn: (word, pos) => {
				if (pos < 1 || pos >= word.length) return null;
				if (word[pos - 1] === "o") {
					const left = word.slice(0, pos - 1) + "a";
					const right = "i" + word.slice(pos);
					return [
						{ left, right, rule: "a_i_to_o", splitPos: pos },
					];
				}
				return null;
			},
		},

		// -----------------------------------------------------------------
		// 10. Niggahīta assimilation: ṁ + h → ñh  (5 occurrences)
		//     dhammaṁ + hi → dhammañhi
		//     Reverse: if we see 'ñ' before 'h', try left+'ṁ' and 'h'+right
		// -----------------------------------------------------------------
		{
			name: "niggahita_palatal",
			fn: (word, pos) => {
				if (pos < 2 || pos >= word.length) return null;
				if (word[pos - 1] === "ñ") {
					// ñ replaces ṁ; the consonant after ñ starts the second word
					// e.g. dhammañhi: pos=7 → word[6]='ñ', word[7]='h'
					//      left = dhammaṁ, right = hi
					const left = word.slice(0, pos - 1) + "ṁ";
					const right = word.slice(pos);
					return [
						{
							left,
							right,
							rule: "niggahita_palatal",
							splitPos: pos,
						},
					];
				}
				return null;
			},
		},

		// -----------------------------------------------------------------
		// 11. Niggahīta assimilation: ṁ before velar → ṅ
		//     ṁ + k/g → ṅk/ṅg
		// -----------------------------------------------------------------
		{
			name: "niggahita_velar",
			fn: (word, pos) => {
				if (pos < 2 || pos >= word.length) return null;
				const velars = new Set(["k", "g"]);
				if (word[pos - 1] === "ṅ" && velars.has(word[pos])) {
					const left = word.slice(0, pos - 1) + "ṁ";
					const right = word.slice(pos);
					return [
						{
							left,
							right,
							rule: "niggahita_velar",
							splitPos: pos,
						},
					];
				}
				return null;
			},
		},

		// -----------------------------------------------------------------
		// 12. Niggahīta → n before dentals (t, d, n)
		//     ṁ + t → nt  (evaṁ + tattha → evañtattha is palatal,
		//                but also ṁ + n → nn etc.)
		// -----------------------------------------------------------------
		{
			name: "niggahita_dental",
			fn: (word, pos) => {
				if (pos < 2 || pos >= word.length) return null;
				const dentals = new Set(["t", "d", "n"]);
				if (word[pos - 1] === "n" && dentals.has(word[pos])) {
					const left = word.slice(0, pos - 1) + "ṁ";
					const right = word.slice(pos);
					return [
						{
							left,
							right,
							rule: "niggahita_dental",
							splitPos: pos,
						},
					];
				}
				return null;
			},
		},

		// -----------------------------------------------------------------
		// 13. Drop final -ā before vowel (3 occurrences)
		//     pāṇabhūtā + atthi → pāṇabhūtatthi
		//     Reverse: try inserting 'ā' at end of left
		// -----------------------------------------------------------------
		{
			name: "elide_final_long_a",
			fn: (word, pos) => {
				if (pos < 2 || pos >= word.length) return null;
				if (isVowel(word[pos])) {
					const left = word.slice(0, pos) + "ā";
					const right = word.slice(pos);
					return [
						{
							left,
							right,
							rule: "elide_final_long_a",
							splitPos: pos,
						},
					];
				}
				return null;
			},
		},

		// -----------------------------------------------------------------
		// 14. Drop final -i before vowel (2 occurrences)
		//     gacchāmi + ahaṁ → gacchāmahaṁ
		// -----------------------------------------------------------------
		{
			name: "elide_final_i",
			fn: (word, pos) => {
				if (pos < 2 || pos >= word.length) return null;
				if (isVowel(word[pos])) {
					const left = word.slice(0, pos) + "i";
					const right = word.slice(pos);
					return [
						{
							left,
							right,
							rule: "elide_final_i",
							splitPos: pos,
						},
					];
				}
				return null;
			},
		},

		// -----------------------------------------------------------------
		// 15. aṁ + a → ā  (evaṁ + abhijānaṁ → evābhijānaṁ)
		//     Reverse: if junction has 'ā', try left+'aṁ' and 'a'+right
		// -----------------------------------------------------------------
		{
			name: "am_a_to_long_a",
			fn: (word, pos) => {
				if (pos < 1 || pos >= word.length) return null;
				if (word[pos - 1] === "ā") {
					const left = word.slice(0, pos - 1) + "aṁ";
					const right = "a" + word.slice(pos);
					return [
						{
							left,
							right,
							rule: "am_a_to_long_a",
							splitPos: pos,
						},
					];
				}
				return null;
			},
		},
	];
}

const REVERSE_RULES = buildReverseSandhiRules();

// ---------------------------------------------------------------------------
// Core splitting algorithm
// ---------------------------------------------------------------------------

/**
 * Attempt to split a compound Pali word into constituents using reverse
 * sandhi rules and dictionary validation.
 *
 * @param word       The compound word to split
 * @param dictFind   A function that checks if a word exists in the dictionary.
 *                   Should return truthy if found, falsy otherwise.
 * @param maxDepth     Maximum recursion depth for multi-part compounds (default 3)
 * @param timeBudgetMs Wall-clock budget in ms (default 1300 for interactive;
 *                     pass a shorter value e.g. 200 for batch/API contexts)
 * @returns            A SandhiSplitResult if a valid split is found, or null.
 */
export async function trySandhiSplit(
	word: string,
	dictFind: (w: string) => any,
	maxDepth: number = 3,
	timeBudgetMs: number = 1300
): Promise<SandhiSplitResult | null> {
	if (!word || word.length < 4) return null;

	const lowerWord = word.toLowerCase();

	interface ScoredSplit {
		parts: string[];
		rules: string[];
		score: number;
	}

	const validSplits: ScoredSplit[] = [];

	// Candidates where one side needs recursive splitting
	const recursiveCandidates: {
		found: string;
		unfound: string;
		foundSide: "left" | "right";
		rule: string;
		score: number;
	}[] = [];

	const minPartLen = 2;
	// Hard wall-time cap so the UI stays responsive (ms)
	const deadline = Date.now() + timeBudgetMs;
	let timedOut = false;

	// Cache dictionary lookups to avoid redundant work across rules/positions
	const dictCache = new Map<string, any>();
	const cachedDictFind = (w: string) => {
		const cached = dictCache.get(w);
		if (cached !== undefined) return cached;
		const result = dictFind(w);
		dictCache.set(w, result);
		return result;
	};

	// Helper: try all rules at a given split position
	const tryPosition = (pos: number) => {
		for (const { name, fn } of REVERSE_RULES) {
			if (timedOut) break;
			const candidates = fn(lowerWord, pos);
			if (!candidates) continue;

			for (const candidate of candidates) {
				if (Date.now() >= deadline) { timedOut = true; break; }
				const { left, right } = candidate;
				if (left.length < minPartLen || right.length < minPartLen)
					continue;

				// Check left first — only look up right if left exists (saves ~50% of lookups)
				const leftFound = cachedDictFind(left);
				if (leftFound?.data?.length) {
					const rightFound = cachedDictFind(right);
					if (rightFound?.data?.length) {
						const score = scoreSplit(left, right, name);
						validSplits.push({
							parts: [left, right],
							rules: [name],
							score,
						});
					} else if (maxDepth > 1 && recursiveCandidates.length < 10 && right.length >= 4) {
						recursiveCandidates.push({
							found: left,
							unfound: right,
							foundSide: "left",
							rule: name,
							score: scoreSplit(left, right, name),
						});
					}
				} else if (maxDepth > 1 && recursiveCandidates.length < 10 && left.length >= 4) {
					// Left not found — check right for reverse-side recursive candidate
					const rightFound = cachedDictFind(right);
					if (rightFound?.data?.length) {
						recursiveCandidates.push({
							found: right,
							unfound: left,
							foundSide: "right",
							rule: name,
							score: scoreSplit(left, right, name),
						});
					}
				}
			}
		}
	};

	// --- Phase 1: Priority positions based on junction markers in the word ---
	// These are characters that strongly indicate a sandhi junction at or near
	// that position, so we try them first before the general scan.
	const visited = new Set<number>();
	const VOWELS = new Set("aāiīuūeo");
	const tryPriority = (pos: number) => {
		if (pos >= minPartLen && pos <= lowerWord.length - minPartLen && !visited.has(pos)) {
			visited.add(pos);
			tryPosition(pos);
		}
	};

	for (let i = minPartLen; i <= lowerWord.length - minPartLen && !timedOut; i++) {
		const ch = lowerWord[i - 1]; // character just before split
		// Pass 1: highly specific junction markers (niggahīta indicators)
		if (ch === "m") tryPriority(i);
		if (ch === "ñ") tryPriority(i);
		if (ch === "ṅ") tryPriority(i);
	}

	// If niggahita markers found valid splits, return immediately
	if (validSplits.length > 0) {
		validSplits.sort((a, b) => b.score - a.score);
		return { word, parts: validSplits[0].parts, rules: validSplits[0].rules };
	}

	for (let i = minPartLen; i <= lowerWord.length - minPartLen && !timedOut; i++) {
		const ch = lowerWord[i - 1];
		const ch2 = lowerWord[i];
		// Pass 2: vowel-based junction markers
		if (ch === "ā" && !VOWELS.has(ch2)) tryPriority(i);
		if (VOWELS.has(ch) && VOWELS.has(ch2)) { tryPriority(i); tryPriority(i + 1); }
		// Pass 2b: general consonant + vowel transitions
		if (!VOWELS.has(ch) && VOWELS.has(ch2)) tryPriority(i);
	}

	// If priority scan found valid splits, return best immediately
	if (validSplits.length > 0) {
		validSplits.sort((a, b) => b.score - a.score);
		const best = validSplits[0];
		return { word, parts: best.parts, rules: best.rules };
	}

	// --- Phase 2: Bidirectional scan of remaining positions ---
	let lo = minPartLen;
	let hi = lowerWord.length - minPartLen;
	while (lo <= hi && !timedOut) {
		if (!visited.has(hi)) { visited.add(hi); tryPosition(hi); }
		if (lo !== hi && !visited.has(lo) && !timedOut) { visited.add(lo); tryPosition(lo); }
		lo++;
		hi--;
	}

	// Return the best direct split if any (including partial results on timeout)
	if (validSplits.length > 0) {
		validSplits.sort((a, b) => b.score - a.score);
		const best = validSplits[0];
		return { word, parts: best.parts, rules: best.rules };
	}

	// If we timed out with no direct split, skip expensive recursive step
	if (timedOut) return null;

	// Otherwise try recursive splitting on the best candidates (limit to top 3)
	recursiveCandidates.sort((a, b) => b.score - a.score);
	const topRecursive = recursiveCandidates.slice(0, 3);
	for (const { found, unfound, foundSide, rule } of topRecursive) {
		const subSplit = await trySandhiSplit(unfound, dictFind, maxDepth - 1, timeBudgetMs);
		if (subSplit) {
			const parts =
				foundSide === "left"
					? [found, ...subSplit.parts]
					: [...subSplit.parts, found];
			const rules =
				foundSide === "left"
					? [rule, ...subSplit.rules]
					: [...subSplit.rules, rule];
			return { word, parts, rules };
		}
	}

	return null;
}

/**
 * Score a split to rank competing decompositions.
 * Higher is better.
 */
function scoreSplit(left: string, right: string, rule: string): number {
	let score = 0;

	// Strongly penalize very short parts (2 chars)
	const shorter = Math.min(left.length, right.length);
	if (shorter <= 2) score -= 15;
	else if (shorter <= 3) score -= 5;
	else score += shorter * 2;

	// Prefer more even splits
	const ratio = Math.min(left.length, right.length) / Math.max(left.length, right.length);
	score += ratio * 5;

	// Transformation rules get a bonus over direct splits,
	// because a transformation that yields dictionary words is stronger
	// evidence than coincidental direct matches.
	const ruleBonus: Record<string, number> = {
		direct: 3,
		niggahita_m: 10,
		elide_final_a: 9,
		elide_initial_a: 7,
		aa_to_long_a: 9,
		ii_to_long_i: 9,
		uu_to_long_u: 9,
		a_i_to_long_a: 8,
		a_i_to_o: 8,
		niggahita_palatal: 10,
		niggahita_velar: 10,
		niggahita_dental: 10,
		elide_final_long_a: 6,
		elide_final_i: 6,
		am_a_to_long_a: 5,
	};
	score += ruleBonus[rule] ?? 0;

	return score;
}

// ---------------------------------------------------------------------------
// Frequently seen second-words in sandhi (from paliSandhi.json analysis).
// These are tried as known suffixes for a quick targeted split before the
// exhaustive scan.
// ---------------------------------------------------------------------------

export const COMMON_SANDHI_SUFFIXES = [
	"iti",
	"eva",
	"api",
	"assa",
	"ahaṁ",
	"etaṁ",
	"ca",
	"idaṁ",
	"hi",
	"idha",
	"āhu",
	"pana",
	"atthi",
	"ānanda",
	"ettha",
];

/**
 * Try splitting by checking if the compound ends with a known common
 * suffix word (after applying reverse sandhi at the junction).
 * This is faster than the full exhaustive scan.
 */
export async function tryCommonSuffixSplit(
	word: string,
	dictFind: (w: string) => any
): Promise<SandhiSplitResult | null> {
	const lowerWord = word.toLowerCase();

	for (const suffix of COMMON_SANDHI_SUFFIXES) {
		// Direct ending
		if (lowerWord.endsWith(suffix) && lowerWord.length > suffix.length + 1) {
			const left = lowerWord.slice(0, lowerWord.length - suffix.length);
			if (left.length >= 2) {
				const leftFound = dictFind(left);
				if (leftFound?.data?.length) {
					return {
						word,
						parts: [left, suffix],
						rules: ["common_suffix_direct"],
					};
				}
				// Try restoring elided final -a on left
				const leftWithA = left + "a";
				const leftWithAFound = dictFind(leftWithA);
				if (leftWithAFound?.data?.length) {
					return {
						word,
						parts: [leftWithA, suffix],
						rules: ["common_suffix_elide_a"],
					};
				}
			}
		}

		// Iti-specific: a + iti → āti
		if (
			suffix === "iti" &&
			lowerWord.endsWith("āti") &&
			lowerWord.length > 4
		) {
			const left = lowerWord.slice(0, lowerWord.length - 3) + "a";
			const leftFound = dictFind(left);
			if (leftFound?.data?.length) {
				return {
					word,
					parts: [left, "iti"],
					rules: ["iti_a_contraction"],
				};
			}
		}

		// Iti-specific: o + ti → a + iti (pahātabboti)
		if (
			suffix === "iti" &&
			lowerWord.endsWith("oti") &&
			lowerWord.length > 4
		) {
			const left = lowerWord.slice(0, lowerWord.length - 3) + "a";
			const leftFound = dictFind(left);
			if (leftFound?.data?.length) {
				return {
					word,
					parts: [left, "iti"],
					rules: ["iti_o_contraction"],
				};
			}
		}

		// Iti-specific: i + iti → īti
		if (
			suffix === "iti" &&
			lowerWord.endsWith("īti") &&
			lowerWord.length > 4
		) {
			const left = lowerWord.slice(0, lowerWord.length - 3) + "i";
			const leftFound = dictFind(left);
			if (leftFound?.data?.length) {
				return {
					word,
					parts: [left, "iti"],
					rules: ["iti_i_contraction"],
				};
			}
		}

		// Iti-specific: word ending in -a + iti → -anti
		// e.g. patta + iti → pattanti (final 'a' absorbed, 'n' inserted before 'ti')
		// Reverse: strip '-anti', restore '-a', suffix is 'iti'
		if (
			suffix === "iti" &&
			lowerWord.endsWith("anti") &&
			lowerWord.length > 5
		) {
			const left = lowerWord.slice(0, lowerWord.length - 4) + "a";
			const leftFound = dictFind(left);
			if (leftFound?.data?.length) {
				return {
					word,
					parts: [left, "iti"],
					rules: ["iti_anti_pattern"],
				};
			}
		}

		// Hi-specific: ṁ + hi → ñhi (niggahīta palatal assimilation)
		// e.g. dhammaṁ + hi → dhammañhi
		if (
			suffix === "hi" &&
			lowerWord.endsWith("ñhi") &&
			lowerWord.length > 4
		) {
			const left = lowerWord.slice(0, lowerWord.length - 3) + "ṁ";
			const leftFound = dictFind(left);
			if (leftFound?.data?.length) {
				return {
					word,
					parts: [left, "hi"],
					rules: ["niggahita_palatal_hi"],
				};
			}
		}
	}

	return null;
}
