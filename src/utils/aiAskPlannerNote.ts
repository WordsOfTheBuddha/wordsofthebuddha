import { curatedAskModelLabel } from "./openrouter";

export type AskPlannerFailureKind =
	| "unusable"
	| "not_available"
	| "busy"
	| "timeout"
	| "quota"
	| "error";

export interface AskPlannerFailure {
	model: string;
	status?: number;
	message: string;
}

export interface BuildAskPlannerNoteInput {
	requested: string;
	used: string;
	provider: "openrouter" | "gemini";
	failed: readonly AskPlannerFailure[];
	skippedCooldown: readonly string[];
	/** True when the accepted plan includes reader-visible reasoning. */
	acceptedHasReasoning: boolean;
}

/** Short picker name (“M3”) rather than the provider-prefixed catalog label. */
export function plannerDisplayName(id: string): string {
	const trimmed = (id || "").trim();
	if (!trimmed) return "the model";
	if (/gemini/i.test(trimmed)) return "Gemini";
	return curatedAskModelLabel(trimmed).replace(/^[^:]+:\s*/, "") || trimmed;
}

export function classifyPlannerFailure(
	item: AskPlannerFailure,
): AskPlannerFailureKind {
	const message = item.message || "";
	const status = item.status || 0;
	if (/unusable/i.test(message)) return "unusable";
	if (status === 403 || status === 404) return "not_available";
	if (
		status === 408 ||
		(typeof DOMException !== "undefined" &&
			message.includes("TimeoutError")) ||
		/timeout|aborted|AbortError/i.test(message)
	) {
		return "timeout";
	}
	if (/quota|RESOURCE_EXHAUSTED/i.test(message)) return "quota";
	if (
		status === 429 ||
		status === 502 ||
		status === 503 ||
		/rate.?limit|too many requests|overloaded|temporar|unavailable/i.test(
			message,
		)
	) {
		return "busy";
	}
	return "error";
}

function failureClause(
	kind: AskPlannerFailureKind,
	label: string,
): string {
	switch (kind) {
		case "unusable":
			return `${label} didn’t produce a usable search plan`;
		case "not_available":
			return `${label} isn’t available on this key`;
		case "busy":
			return `${label} was busy`;
		case "timeout":
			return `${label} timed out`;
		case "quota":
			return `${label} hit its quota`;
		default:
			return `${label} couldn’t complete the plan`;
	}
}

function groupFailureClause(
	kind: AskPlannerFailureKind,
	requestedLabel: string,
): string {
	switch (kind) {
		case "unusable":
			return `${requestedLabel} and the other free models didn’t produce a usable search plan`;
		case "not_available":
			return `${requestedLabel} and the other free models aren’t available on this key`;
		case "busy":
			return `${requestedLabel} and the other free models were busy`;
		case "timeout":
			return `${requestedLabel} and the other free models timed out`;
		case "quota":
			return `${requestedLabel} and the other free models hit their quota`;
		default:
			return `${requestedLabel} and the other free models couldn’t complete the plan`;
	}
}

function geminiSuffix(lead: string, acceptedHasReasoning: boolean): string {
	const planned = `${lead} — planned with Gemini instead`;
	if (acceptedHasReasoning) return `${planned}.`;
	return `${planned}, which does not share its thinking.`;
}

function sameModel(a: string, b: string): boolean {
	return a.trim() === b.trim();
}

function geminiLead(
	requestedLabel: string,
	requested: string,
	failed: readonly AskPlannerFailure[],
	skippedCooldown: readonly string[],
): string {
	if (failed.length === 0) {
		if (
			skippedCooldown.length === 1 &&
			sameModel(skippedCooldown[0] || "", requested)
		) {
			return `${requestedLabel} was recently unavailable`;
		}
		return "Free models were recently unavailable";
	}

	const kinds = failed.map(classifyPlannerFailure);
	const unique = [...new Set(kinds)];
	const mentionOthers = failed.length + skippedCooldown.length > 1;
	const requestedFailure = failed.find((item) =>
		sameModel(item.model, requested),
	);

	if (!mentionOthers) {
		return failureClause(kinds[0] || "error", requestedLabel);
	}
	if (unique.length === 1 && skippedCooldown.length === 0) {
		return groupFailureClause(unique[0] || "error", requestedLabel);
	}
	if (requestedFailure) {
		return `${failureClause(classifyPlannerFailure(requestedFailure), requestedLabel)}, and the other free models couldn’t complete the plan`;
	}
	if (skippedCooldown.some((id) => sameModel(id, requested))) {
		return `${requestedLabel} was recently unavailable, and the other free models couldn’t complete the plan`;
	}
	return "Free models couldn’t complete the plan";
}

/**
 * Reader-facing note when Ask did not use the requested planner.
 * Does not say “busy” unless the failure actually was a rate-limit/outage,
 * and only mentions Gemini’s missing reasoning when the accepted plan has none.
 */
export function buildAskPlannerNote(
	input: BuildAskPlannerNoteInput,
): string | undefined {
	const requested = input.requested.trim();
	const used = input.used.trim();
	if (!requested && !used) return undefined;

	if (input.provider === "gemini") {
		if (input.failed.length === 0 && input.skippedCooldown.length === 0) {
			return undefined;
		}
		const requestedLabel = plannerDisplayName(requested || used);
		return geminiSuffix(
			geminiLead(
				requestedLabel,
				requested,
				input.failed,
				input.skippedCooldown,
			),
			input.acceptedHasReasoning,
		);
	}

	if (!requested || sameModel(used, requested)) return undefined;

	const requestedLabel = plannerDisplayName(requested);
	const usedLabel = plannerDisplayName(used);
	let lead: string;
	if (input.skippedCooldown.some((id) => sameModel(id, requested))) {
		lead = `${requestedLabel} was recently unavailable`;
	} else {
		const reason =
			input.failed.find((item) => sameModel(item.model, requested)) ||
			input.failed[0];
		lead = reason
			? failureClause(classifyPlannerFailure(reason), requestedLabel)
			: `${requestedLabel} couldn’t complete the plan`;
	}
	return `${lead} — planned with ${usedLabel} instead.`;
}
