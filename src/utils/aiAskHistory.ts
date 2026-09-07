/**
 * Shared Ask follow-up history helpers (client + server).
 * Tail-only slices drop the original question; keep that turn when clipping.
 */

/** Prior turns forwarded to planner / rescorer / stored thread. */
export const ASK_HISTORY_MAX_TURNS = 6;
/** Parse this many raw payload turns before clipping (abuse cap). */
export const ASK_HISTORY_PARSE_CAP = 24;
/** Soft cap for prior-turn summary text in follow-up payloads. */
export const ASK_HISTORY_SUMMARY_MAX = 800;

export interface AiAskFollowUpHistoryTurn {
	question: string;
	lookingFor: string;
	queries: string[];
	resultSlugs?: string[];
	summary?: string;
}

/**
 * Keep the opening turn plus the newest turns when history exceeds `maxTurns`.
 * Follow-ups need the original question; `slice(-N)` drops it.
 */
export function clipAskHistoryTurns<T>(
	turns: readonly T[],
	maxTurns = ASK_HISTORY_MAX_TURNS,
): T[] {
	if (maxTurns <= 0 || turns.length === 0) return [];
	if (turns.length <= maxTurns) return turns.slice();
	if (maxTurns === 1) return [turns[0]];
	return [turns[0], ...turns.slice(-(maxTurns - 1))];
}

export function collectAskHistoryShownSlugs(
	history: readonly { resultSlugs?: readonly string[] }[],
	limit = 200,
): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const turn of history) {
		for (const raw of turn.resultSlugs || []) {
			const slug = raw.replace(/\s+/g, " ").trim().toLowerCase();
			if (!slug || seen.has(slug)) continue;
			seen.add(slug);
			out.push(slug);
			if (out.length >= limit) return out;
		}
	}
	return out;
}

export function dropAlreadyShownHits<T extends { slug: string }>(
	hits: readonly T[],
	shownSlugs: readonly string[],
): T[] {
	if (shownSlugs.length === 0) return hits.slice();
	const shown = new Set(
		shownSlugs.map((slug) => slug.replace(/\s+/g, " ").trim().toLowerCase()),
	);
	return hits.filter((hit) => !shown.has(hit.slug.toLowerCase()));
}

/**
 * “Tell me more about the second one” / a named ID — keep those hits.
 */
export function isRefiningAskFollowUp(question: string): boolean {
	const text = question.replace(/\s+/g, " ").trim();
	if (!text) return false;
	if (
		/\b(the )?(first|second|third|fourth|fifth|sixth|last|previous) one\b/i.test(
			text,
		)
	) {
		return true;
	}
	if (
		/\b(tell me more|more) about\b/i.test(text) &&
		!/\b(other|another|different|else|besides)\b/i.test(text)
	) {
		return true;
	}
	if (
		/\b(go deeper|elaborat\w+|explain (the|that|this|it)|what does (it|that|this) say|that discourse|this discourse|this sutta|that sutta)\b/i.test(
			text,
		) &&
		!isDiversifyingAskFollowUp(text)
	) {
		return true;
	}
	if (
		/\b((mn|sn|an|dn|dhp|iti|ud|snp|thig|thag|kp|vv|pv|ja)\s*\d[\d.]*)\b/i.test(
			text,
		) &&
		/\b(about|explain|mean|say|said|tell me|deeper|elaborat)\b/i.test(text) &&
		!isDiversifyingAskFollowUp(text)
	) {
		return true;
	}
	return false;
}

/**
 * “Other discourses” / “more like this” / “not those” — diversify away
 * from already-shown IDs.
 */
export function isDiversifyingAskFollowUp(question: string): boolean {
	const text = question.replace(/\s+/g, " ").trim();
	if (!text) return false;
	return (
		/\b(other|another|different|additional|further)\s+(discourses?|suttas?|ones?|examples?|citations?|references?|hits?|results?)\b/i.test(
			text,
		) ||
		/\bmore\s+(discourses?|suttas?|examples?|citations?|like\s+(this|that|those))\b/i.test(
			text,
		) ||
		/\b(not|besides|except|excluding)\s+(those|these|the same|already\s+(shown|listed|included|returned|recommended))\b/i.test(
			text,
		) ||
		/\b(what|anything)\s+else\b/i.test(text) ||
		/\bnot included yet\b/i.test(text) ||
		/\bdivers(e|ify|ification)\b/i.test(text) ||
		/\bshow (me )?(some )?more\b/i.test(text) ||
		/\bmore like (this|that|those)\b/i.test(text)
	);
}

/**
 * Degraded fallback when the planner omitted `excludeSlugs` / `followUpIntent`.
 * Regex on the user question — not a policy the Flash rescorer should infer.
 */
export function shouldExcludeAlreadyShownAskHits(
	question: string,
	history: readonly { resultSlugs?: readonly string[] }[],
): boolean {
	if (collectAskHistoryShownSlugs(history, 1).length === 0) return false;
	if (isRefiningAskFollowUp(question)) return false;
	return isDiversifyingAskFollowUp(question);
}

/**
 * Drop already-shown hits when the follow-up asks for other/more/different
 * discourses. Prefer a planner-owned `excludeSlugs` list when provided
 * (`[]` means keep prior IDs). If that would empty the pool, keep the
 * original candidates.
 *
 * When `excludeSlugs` is omitted, a light regex on the question is the
 * degraded fallback — the Flash rescorer must not infer this policy.
 */
export function candidatesForAskFollowUp<T extends { slug: string }>(
	candidates: readonly T[],
	question: string,
	history: readonly { resultSlugs?: readonly string[] }[],
	excludeSlugs?: readonly string[],
): T[] {
	const slugs =
		excludeSlugs !== undefined
			? excludeSlugs
			: shouldExcludeAlreadyShownAskHits(question, history)
				? collectAskHistoryShownSlugs(history)
				: [];
	if (slugs.length === 0) return candidates.slice();
	const next = dropAlreadyShownHits(candidates, slugs);
	return next.length > 0 ? next : candidates.slice();
}

export function formatAskAlreadyShownIds(
	slugs: readonly string[],
	formatSlug: (slug: string) => string = (slug) => slug,
	limit = 200,
): string {
	const ids = slugs
		.slice(0, limit)
		.map((slug) => formatSlug(slug))
		.filter(Boolean);
	return ids.join(", ");
}

/**
 * Client follow-up payload: prior turns, oldest first, with shown slugs.
 * Clips with the opening turn preserved.
 */
export function buildAskFollowUpHistory(
	priorTurns: readonly {
		question: string;
		lookingFor: string;
		queries: readonly string[];
		results: readonly { slug: string }[];
		summary?: string;
	}[],
	maxTurns = ASK_HISTORY_MAX_TURNS,
): AiAskFollowUpHistoryTurn[] {
	const mapped: AiAskFollowUpHistoryTurn[] = priorTurns.map((item) => {
		const resultSlugs = item.results
			.map((hit) => hit.slug)
			.filter(Boolean);
		const summary = (item.summary || "").replace(/\s+/g, " ").trim().slice(
			0,
			ASK_HISTORY_SUMMARY_MAX,
		);
		return {
			question: item.question,
			lookingFor: item.lookingFor,
			queries: [...item.queries],
			...(resultSlugs.length > 0 ? { resultSlugs } : {}),
			...(summary ? { summary } : {}),
		};
	});
	return clipAskHistoryTurns(mapped, maxTurns);
}
