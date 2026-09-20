import {
	isResearchJobReviseClarifying,
	isResearchJobRevising,
	isResearchJobTerminal,
	type ResearchJobStatus,
} from "./aiAskResearchJob";

/** No writes for this long means the serverless worker is gone. */
export const RESEARCH_STALE_RECOVERY_MS = 10 * 60_000;

export const RESEARCH_STALE_RECOVERY_ERROR =
	"Research timed out before it could finish. Try again.";

export interface ResearchJobRecoveryClock {
	updatedAt?: number;
	createdAt?: number;
}

export function researchJobUpdatedAtMs(
	record: ResearchJobRecoveryClock,
): number {
	const updated = record.updatedAt;
	if (typeof updated === "number" && Number.isFinite(updated) && updated > 0) {
		return Math.floor(updated);
	}
	const created = record.createdAt;
	if (typeof created === "number" && Number.isFinite(created) && created > 0) {
		return Math.floor(created);
	}
	return 0;
}

export function researchJobStaleMs(
	record: ResearchJobRecoveryClock,
	nowMs = Date.now(),
): number {
	const at = researchJobUpdatedAtMs(record);
	if (!at) return 0;
	return Math.max(0, nowMs - at);
}

export function isResearchJobStaleForRecovery(
	record: ResearchJobRecoveryClock,
	nowMs = Date.now(),
	staleMs = RESEARCH_STALE_RECOVERY_MS,
): boolean {
	const at = researchJobUpdatedAtMs(record);
	if (!at) return false;
	return nowMs - at >= staleMs;
}

const RECOVERABLE_STATUSES = new Set<ResearchJobStatus>([
	"queued",
	"running",
	"verify",
	"searching",
	"crunching",
	"reviewing",
	"answering",
]);

export function shouldRecoverStuckResearchJob(
	record: {
		status: ResearchJobStatus;
		updatedAt?: number;
		createdAt?: number;
	},
	nowMs = Date.now(),
): boolean {
	if (isResearchJobTerminal(record.status)) return false;
	if (isResearchJobRevising(record.status)) return false;
	if (isResearchJobReviseClarifying(record.status)) return false;
	if (!RECOVERABLE_STATUSES.has(record.status)) return false;
	return isResearchJobStaleForRecovery(record, nowMs);
}
