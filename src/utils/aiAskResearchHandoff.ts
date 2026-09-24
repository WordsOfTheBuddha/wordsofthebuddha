import { ASK_FUNCTION_BUDGET_MS, ASK_WRITER_MIN_MS } from "./aiAskAnswer";

/**
 * Headroom reserved at the end of a pass for the chained-state Firestore
 * write plus the self-fetch POST to `/api/ai/research/run`. Writer retries
 * and Pali re-reads are skipped once the remaining budget drops to this, so
 * the handoff can still fire before Vercel's 300s function cap kills us.
 */
export const RESEARCH_HANDOFF_MARGIN_MS = 30_000;
/** Per-attempt timeout for the self-fetch handoff to the next function run. */
export const RESEARCH_ENQUEUE_TIMEOUT_MS = 10_000;

/**
 * Retry the report writer only when enough budget remains for another
 * writer attempt plus the handoff margin. Prevents the double-writer
 * timeout seen in prod (593 matches, writer ran twice past the 300s cap).
 */
export function shouldRetryResearchWriter(timeLeftMs: number): boolean {
	return timeLeftMs > RESEARCH_HANDOFF_MARGIN_MS + ASK_WRITER_MIN_MS;
}

/** Run the Pali re-read only when the handoff margin is still intact. */
export function shouldRunResearchPaliReread(timeLeftMs: number): boolean {
	return timeLeftMs > RESEARCH_HANDOFF_MARGIN_MS;
}

/**
 * Yield the first pass before the report writer when the remaining budget
 * cannot cover a minimal writer run plus the handoff. Callers should skip
 * the writer and chain with the current artifact so `enqueueResearchContinue`
 * still fires while time remains.
 */
export function shouldYieldResearchFirstPass(timeLeftMs: number): boolean {
	return timeLeftMs <= RESEARCH_HANDOFF_MARGIN_MS + ASK_WRITER_MIN_MS;
}

export interface ResearchChainPassDecision {
	batchSize: number;
	extraQueryCount: number;
	extraPaliCount: number;
	/**
	 * No real report was written yet (raw report empty before the fallback
	 * filler). Forces a chain while results exist so a fallback never ships
	 * as final when a rewrite pass could still run.
	 */
	needsFirstWrite: boolean;
	resultCount: number;
}

/**
 * Whether the first pass should chain to pass 2. Besides new queries/reads,
 * a missing first write with results on hand always chains — completing
 * there would ship the fallback as the final report.
 */
export function shouldChainResearchPass(
	input: ResearchChainPassDecision,
): boolean {
	if (
		input.batchSize > 0 ||
		input.extraQueryCount > 0 ||
		input.extraPaliCount > 0
	) {
		return true;
	}
	return input.needsFirstWrite && input.resultCount > 0;
}

/**
 * Writer budget that always leaves the handoff margin on the table.
 * A fast planner keeps its unused time for the report; there is no flat
 * 150s cap. Returns 0 when the remaining time cannot cover a minimal write.
 */
export function researchWriterBudgetWithMargin(elapsedMs: number): number {
	const remaining = ASK_FUNCTION_BUDGET_MS - Math.max(0, elapsedMs);
	const usable = remaining - RESEARCH_HANDOFF_MARGIN_MS;
	if (usable <= ASK_WRITER_MIN_MS) return 0;
	return usable;
}
