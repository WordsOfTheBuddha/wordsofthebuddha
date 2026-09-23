/**
 * Discourse-page Ask context (browser-safe — no server-only imports).
 * Auto-attached, invisible to the user: current discourse EN + Pali text
 * travels with the question so the pipeline can ground the answer.
 */

export interface AskPageContext {
	slug: string;
	title?: string;
	english?: string;
	pali?: string;
}

/** Per-field caps keep long MN/DN suttas inside prompt budgets. */
export const ASK_PAGE_ENGLISH_MAX = 6000;
export const ASK_PAGE_PALI_MAX = 4000;
/** Hard total after combining both sides. */
export const ASK_PAGE_TOTAL_MAX = 10_000;
export const ASK_PAGE_SLUG_MAX = 64;
export const ASK_PAGE_TITLE_MAX = 160;

function cleanText(value: unknown, max: number): string {
	if (typeof value !== "string") return "";
	const cleaned = value.replace(/\s+/g, " ").trim();
	if (!cleaned) return "";
	return cleaned.length > max ? cleaned.slice(0, max).trim() : cleaned;
}

/** Parse + clip untrusted `pageContext` from the POST body. Null when unusable. */
export function parseAskPageContext(raw: unknown): AskPageContext | null {
	if (!raw || typeof raw !== "object") return null;
	const record = raw as Record<string, unknown>;
	const slug = cleanText(record.slug, ASK_PAGE_SLUG_MAX).toLowerCase();
	if (!slug) return null;
	const title = cleanText(record.title, ASK_PAGE_TITLE_MAX);
	let english = cleanText(record.english, ASK_PAGE_ENGLISH_MAX);
	let pali = cleanText(record.pali, ASK_PAGE_PALI_MAX);
	if (!english && !pali) return null;
	const total = english.length + pali.length;
	if (total > ASK_PAGE_TOTAL_MAX) {
		const overflow = total - ASK_PAGE_TOTAL_MAX;
		// Trim Pali first — English carries the answer; Pali grounds terms.
		const paliCut = Math.min(pali.length, overflow);
		pali = pali.slice(0, Math.max(0, pali.length - paliCut)).trim();
		const remaining = english.length + pali.length - ASK_PAGE_TOTAL_MAX;
		if (remaining > 0) {
			english = english.slice(0, Math.max(0, english.length - remaining)).trim();
		}
	}
	if (!english && !pali) return null;
	return {
		slug,
		...(title ? { title } : {}),
		...(english ? { english } : {}),
		...(pali ? { pali } : {}),
	};
}

/** Short hint merged into rerank/writer guidance so the current page is preferred. */
export function pageContextGuidance(ctx: AskPageContext | null): string {
	if (!ctx) return "";
	const label = ctx.title ? `${ctx.slug} — ${ctx.title}` : ctx.slug;
	return `User is reading ${label}. Prefer it when relevant; its full text is provided as the current page.`;
}

/**
 * Full block for the thinking writer evidence (and rerank context).
 * Empty string when there is nothing to attach.
 */
export function formatAskPageContextBlock(ctx: AskPageContext | null): string {
	if (!ctx) return "";
	const english = (ctx.english || "").trim();
	const pali = (ctx.pali || "").trim();
	if (!english && !pali) return "";
	const label = ctx.title ? `${ctx.slug} — ${ctx.title}` : ctx.slug;
	const parts = [`Current discourse (${label}):`];
	if (english) parts.push(`English:\n${english}`);
	if (pali) parts.push(`Pali:\n${pali}`);
	return parts.join("\n\n").slice(0, ASK_PAGE_TOTAL_MAX + 200);
}

/**
 * Short planner hint (via `attachedContext`). The planner only writes
 * search queries, so it gets the page pointer — not the full text. A full
 * 10K block here doubled prompt tokens (dashboard: 14.7K vs ~7K) and
 * pushed slow-provider calls past the fixed 45s planner attempt budget.
 * Grounding still reaches the answer through rerank guidance + writer
 * evidence, which keep the full block.
 */
export function pageContextPlannerHint(ctx: AskPageContext | null): string {
	if (!ctx) return "";
	const label = ctx.title ? `${ctx.slug} — ${ctx.title}` : ctx.slug;
	return `The user is asking from the discourse page ${label}, so their question is likely about this discourse.`;
}
