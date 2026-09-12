import {
	reviewRoomAsksHashId,
} from "./aiAskHref";
import {
	ASK_HISTORY_ARIA,
	ASK_HISTORY_HINT_PINNED,
	ASK_HISTORY_HINT_RECENT,
	ASK_HISTORY_LABEL,
	RESEARCH_HISTORY_ARIA,
	RESEARCH_HISTORY_LABEL,
} from "./aiAskResearchUi";

export type ReviewRoomAskLane = "ask" | "research";
export type ReviewRoomPinTab = "recent" | "pinned";

export interface ReviewRoomAskHistoryCounts {
	ask: number;
	research: number;
	pinnedAsk: number;
	pinnedResearch: number;
}

export interface ReviewRoomAskHistoryView {
	lane: ReviewRoomAskLane;
	pinTab: ReviewRoomPinTab;
	hashId: string;
	showMeta: boolean;
	showPinTabs: boolean;
	showLabel: boolean;
	empty: ReviewRoomAskLane | null;
	label: string;
	hint: string;
	pinAria: string;
}

export function reviewRoomAskHistoryView(
	lane: ReviewRoomAskLane,
	pinTab: ReviewRoomPinTab,
	counts: ReviewRoomAskHistoryCounts,
): ReviewRoomAskHistoryView {
	const count = lane === "research" ? counts.research : counts.ask;
	const pinned =
		lane === "research" ? counts.pinnedResearch : counts.pinnedAsk;
	const tab: ReviewRoomPinTab =
		pinned > 0 && pinTab === "pinned" ? "pinned" : "recent";
	return {
		lane,
		pinTab: tab,
		hashId: reviewRoomAsksHashId(lane === "research"),
		showMeta: count > 0,
		showPinTabs: pinned > 0,
		showLabel: count > 0 && pinned === 0,
		empty: count === 0 ? lane : null,
		label:
			lane === "research" ? RESEARCH_HISTORY_LABEL : ASK_HISTORY_LABEL,
		hint:
			tab === "pinned" ? ASK_HISTORY_HINT_PINNED : ASK_HISTORY_HINT_RECENT,
		pinAria:
			lane === "research" ? RESEARCH_HISTORY_ARIA : ASK_HISTORY_ARIA,
	};
}

export function reviewRoomHistoryRowHidden(
	rowLane: string | null,
	rowPinned: boolean,
	activeLane: ReviewRoomAskLane,
	pinTab: ReviewRoomPinTab,
): boolean {
	if ((rowLane || "ask") !== activeLane) return false;
	return pinTab === "pinned" && !rowPinned;
}
