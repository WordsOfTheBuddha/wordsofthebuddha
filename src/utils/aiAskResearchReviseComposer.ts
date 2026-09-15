import {
	clipResearchReviseHeading,
	clipResearchReviseInstruction,
	clipResearchReviseQuote,
	RESEARCH_REVISE_EDITS_MAX,
	reportBlocksContainingText,
	splitReportBlocks,
	type ResearchReviseEdit,
} from "./aiAskResearchRevise";
import {
	RESEARCH_REVISE_PLACEHOLDER,
	RESEARCH_REVISE_SELECTION_PLACEHOLDER,
	RESEARCH_REVISE_MULTI_HINT,
} from "./aiAskResearchUi";

export { RESEARCH_REVISE_EDITS_MAX };

export interface ResearchReviseEditScope {
	heading?: string;
	quote?: string;
	blockIds?: string[];
}

export interface ResearchReviseEditRow {
	scope?: ResearchReviseEditScope;
	instruction: string;
}

export interface ResearchReviseEditDraft {
	committed: ResearchReviseEditRow[];
	draftScope: ResearchReviseEditScope | null;
	draftInstruction: string;
}

export function emptyReviseEditDraft(): ResearchReviseEditDraft {
	return { committed: [], draftScope: null, draftInstruction: "" };
}

export function scopeFromReportPin(
	reportMarkdown: string,
	input: { quote?: string; heading?: string },
): ResearchReviseEditScope | null {
	const heading = clipResearchReviseHeading(input.heading || "");
	const quote = clipResearchReviseQuote(input.quote || "");
	if (!heading && !quote) return null;
	const blocks = splitReportBlocks(reportMarkdown);
	const blockIds = quote ? reportBlocksContainingText(blocks, quote) : [];
	return {
		...(heading ? { heading } : {}),
		...(quote ? { quote } : {}),
		...(blockIds.length > 0 ? { blockIds } : {}),
	};
}

/** Pin a heading section when the selection sits in one; otherwise pin the quote. */
export function scopeFromDomSelection(
	reportMarkdown: string,
	selection: string,
	anchor: Node | null,
	blockIds?: readonly string[],
): ResearchReviseEditScope | null {
	const el =
		anchor instanceof Element ? anchor : anchor?.parentElement ?? null;
	const headingEl = el?.closest<HTMLElement>("[data-report-heading]");
	if (headingEl) {
		return scopeFromReportPin(reportMarkdown, {
			heading: headingEl.getAttribute("data-report-heading") || "",
		});
	}
	const scope = scopeFromReportPin(reportMarkdown, { quote: selection });
	if (!scope) return null;
	if (blockIds?.length) {
		return { ...scope, blockIds: [...blockIds] };
	}
	return scope;
}

export const REVISE_QUOTE_CHIP_MAX = 150;

/** Short quotes verbatim; long ones as opening … closing words. */
export function abbreviateReviseQuote(
	quote: string,
	max = REVISE_QUOTE_CHIP_MAX,
): string {
	const text = quote.replace(/\s+/g, " ").trim();
	if (!text) return "";
	if (text.length <= max) return text;
	const headBudget = Math.floor(max * 0.55);
	const tailBudget = max - headBudget;
	let head = text.slice(0, headBudget);
	const headSpace = head.lastIndexOf(" ");
	if (headSpace > headBudget * 0.6) head = head.slice(0, headSpace);
	let tail = text.slice(text.length - tailBudget);
	const tailSpace = tail.indexOf(" ");
	if (tailSpace >= 0 && tailSpace < tailBudget * 0.4) {
		tail = tail.slice(tailSpace + 1);
	}
	return `${head.trim()} … ${tail.trim()}`;
}

export function formatParagraphBlockLabel(blockIds: readonly string[]): string {
	const labels = blockIds.map((id) => formatReportBlockIdLabel(id)).filter(Boolean);
	if (labels.length === 0) return blockIds.join(", ");
	const paraNums = blockIds
		.map((id) => /^p(\d+)$/i.exec(id.trim()))
		.filter((match): match is RegExpExecArray => Boolean(match))
		.map((match) => Number(match[1]))
		.filter((n) => Number.isFinite(n) && n > 0)
		.sort((a, b) => a - b);
	if (paraNums.length === blockIds.length && paraNums.length > 0) {
		if (paraNums.length === 1) return `¶${paraNums[0]}`;
		const first = paraNums[0];
		const last = paraNums[paraNums.length - 1];
		if (last - first + 1 === paraNums.length) {
			return first === last ? `¶${first}` : `¶${first}–${last}`;
		}
		return paraNums.map((n) => `¶${n}`).join(", ");
	}
	return labels.join(", ");
}

export function formatReportBlockIdLabel(id: string): string {
	const match = /^([phtc])(\d+)$/i.exec(id.trim());
	if (!match) return id.trim();
	const kind = match[1].toLowerCase();
	const n = match[2];
	if (kind === "p") return `¶${n}`;
	return `${kind}${n}`;
}

export function formatReviseEditScopeLabel(
	scope?: ResearchReviseEditScope | null,
): string {
	if (!scope) return "";
	if (scope.heading?.trim()) return `§ ${scope.heading.trim()}`;
	const quote = abbreviateReviseQuote(scope.quote || "");
	const paraLabel = scope.blockIds?.length
		? formatParagraphBlockLabel(scope.blockIds)
		: "";
	if (quote && paraLabel) return `${paraLabel} · “${quote}”`;
	if (quote) return `“${quote}”`;
	if (paraLabel) return paraLabel;
	return "";
}

export function hasReviseEditScope(scope?: ResearchReviseEditScope | null): boolean {
	return Boolean(formatReviseEditScopeLabel(scope));
}

export function commitDraftReviseRow(
	draft: ResearchReviseEditDraft,
): ResearchReviseEditDraft {
	const instruction = clipResearchReviseInstruction(draft.draftInstruction);
	if (!instruction) return draft;
	return {
		committed: [
			...draft.committed,
			{ scope: draft.draftScope || undefined, instruction },
		],
		draftScope: null,
		draftInstruction: "",
	};
}

export function applyReviseSelectionToDraft(
	draft: ResearchReviseEditDraft,
	nextScope: ResearchReviseEditScope | null,
): { draft: ResearchReviseEditDraft; capped: boolean } {
	if (!nextScope) return { draft, capped: false };
	const instruction = clipResearchReviseInstruction(draft.draftInstruction);
	if (instruction) {
		if (draft.committed.length >= RESEARCH_REVISE_EDITS_MAX) {
			return { draft, capped: true };
		}
		const committed = commitDraftReviseRow(draft);
		return {
			draft: { ...committed, draftScope: nextScope },
			capped: false,
		};
	}
	return {
		draft: { ...draft, draftScope: nextScope },
		capped: false,
	};
}

function scopeToPayload(
	scope: ResearchReviseEditScope | undefined,
	instruction: string,
): ResearchReviseEdit {
	const payload: ResearchReviseEdit = { instruction };
	if (scope?.blockIds?.length) payload.blockIds = [...scope.blockIds];
	if (scope?.heading) payload.heading = scope.heading;
	if (scope?.quote) payload.quote = scope.quote;
	return payload;
}

export function buildSubmittableReviseEdits(
	draft: ResearchReviseEditDraft,
): ResearchReviseEdit[] {
	const out: ResearchReviseEdit[] = [];
	for (const row of draft.committed) {
		const instruction = clipResearchReviseInstruction(row.instruction);
		if (!instruction) continue;
		out.push(scopeToPayload(row.scope, instruction));
	}
	const draftInstruction = clipResearchReviseInstruction(draft.draftInstruction);
	if (draftInstruction) {
		out.push(scopeToPayload(draft.draftScope || undefined, draftInstruction));
	}
	return out.slice(0, RESEARCH_REVISE_EDITS_MAX);
}

export function canSubmitReviseEdits(edits: readonly ResearchReviseEdit[]): boolean {
	return edits.some((edit) => clipResearchReviseInstruction(edit.instruction));
}

export function reviseCompactDockPlaceholder(draft: ResearchReviseEditDraft): string {
	const count = buildSubmittableReviseEdits(draft).length;
	if (count === 1) return "1 edit";
	if (count > 1) return `${count} edits`;
	if (hasReviseComposerContent(draft)) return "Draft edit";
	return RESEARCH_REVISE_PLACEHOLDER;
}

export function reviseExpandedPlaceholder(
	draft: ResearchReviseEditDraft,
	showMultiHint = false,
): string {
	if (!hasReviseEditScope(draft.draftScope)) {
		return RESEARCH_REVISE_PLACEHOLDER;
	}
	if (showMultiHint && draft.committed.length >= 1 && hasReviseEditScope(draft.draftScope)) {
		return `${RESEARCH_REVISE_SELECTION_PLACEHOLDER} ${RESEARCH_REVISE_MULTI_HINT}`;
	}
	return RESEARCH_REVISE_SELECTION_PLACEHOLDER;
}

/** Skip persisting when compact mode would wipe committed rows with no draft replacement. */
export function shouldDeferReviseComposerDraftPersist(
	draft: ResearchReviseEditDraft,
	storedCommittedCount: number,
): boolean {
	return (
		draft.committed.length === 0 &&
		storedCommittedCount > 0 &&
		!hasReviseComposerContent(draft)
	);
}

export function reviseEditSlotCount(draft: ResearchReviseEditDraft): number {
	const draftOccupied =
		hasReviseEditScope(draft.draftScope) ||
		Boolean(clipResearchReviseInstruction(draft.draftInstruction))
			? 1
			: 0;
	if (draft.committed.length >= RESEARCH_REVISE_EDITS_MAX) {
		return draft.committed.length;
	}
	return draft.committed.length + draftOccupied;
}

export function isReviseEditsCapped(draft: ResearchReviseEditDraft): boolean {
	return reviseEditSlotCount(draft) >= RESEARCH_REVISE_EDITS_MAX;
}

export function hasReviseComposerContent(draft: ResearchReviseEditDraft): boolean {
	return (
		draft.committed.length > 0 ||
		hasReviseEditScope(draft.draftScope) ||
		Boolean(clipResearchReviseInstruction(draft.draftInstruction))
	);
}

export function removeCommittedReviseRow(
	draft: ResearchReviseEditDraft,
	index: number,
): ResearchReviseEditDraft {
	if (index < 0 || index >= draft.committed.length) return draft;
	return {
		...draft,
		committed: draft.committed.filter((_row, i) => i !== index),
	};
}

export function updateCommittedReviseInstruction(
	draft: ResearchReviseEditDraft,
	index: number,
	instruction: string,
): ResearchReviseEditDraft {
	if (index < 0 || index >= draft.committed.length) return draft;
	return {
		...draft,
		committed: draft.committed.map((row, i) =>
			i === index ? { ...row, instruction } : row,
		),
	};
}

export function clearCommittedReviseRowScope(
	draft: ResearchReviseEditDraft,
	index: number,
): ResearchReviseEditDraft {
	if (index < 0 || index >= draft.committed.length) return draft;
	return {
		...draft,
		committed: draft.committed.map((row, i) =>
			i === index ? { ...row, scope: undefined } : row,
		),
	};
}

/** Re-render the stack when row count or pins change, not on every keystroke. */
export function reviseStackRenderKey(draft: ResearchReviseEditDraft): string {
	return draft.committed
		.map((row) => {
			const scope = row.scope;
			return [
				scope?.heading || "",
				scope?.quote || "",
				(scope?.blockIds || []).join(","),
			].join("|");
		})
		.join(";");
}

/** Drop the draft pin; reopen the last committed row when the draft slot is empty. */
export function clearReviseDraftScope(draft: ResearchReviseEditDraft): ResearchReviseEditDraft {
	if (!hasReviseEditScope(draft.draftScope)) return draft;
	if (clipResearchReviseInstruction(draft.draftInstruction)) {
		return { ...draft, draftScope: null };
	}
	if (draft.committed.length === 0) {
		return { ...draft, draftScope: null };
	}
	const last = draft.committed[draft.committed.length - 1];
	return {
		committed: draft.committed.slice(0, -1),
		draftScope: last.scope || null,
		draftInstruction: last.instruction,
	};
}
