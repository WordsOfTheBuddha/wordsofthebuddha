import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	ASK_HISTORY_HINT_PINNED,
	ASK_HISTORY_HINT_RECENT,
	ASK_HISTORY_LABEL,
	RESEARCH_HISTORY_LABEL,
} from "./aiAskResearchUi";
import {
	reviewRoomAskHistoryView,
	reviewRoomHistoryRowHidden,
} from "./reviewRoomAskHistory";

const counts = {
	ask: 4,
	research: 2,
	pinnedAsk: 1,
	pinnedResearch: 0,
};

describe("reviewRoomAskHistoryView", () => {
	it("keeps Recent | Pinned on the active lane and hashes Reports separately", () => {
		const asks = reviewRoomAskHistoryView("ask", "pinned", counts);
		assert.equal(asks.hashId, "asks");
		assert.equal(asks.showPinTabs, true);
		assert.equal(asks.showLabel, false);
		assert.equal(asks.pinTab, "pinned");
		assert.equal(asks.hint, ASK_HISTORY_HINT_PINNED);
		assert.equal(asks.empty, null);

		const reports = reviewRoomAskHistoryView("research", "pinned", counts);
		assert.equal(reports.hashId, "reports");
		assert.equal(reports.showPinTabs, false);
		assert.equal(reports.showLabel, true);
		assert.equal(reports.pinTab, "recent");
		assert.equal(reports.label, RESEARCH_HISTORY_LABEL);
		assert.equal(reports.hint, ASK_HISTORY_HINT_RECENT);
	});

	it("hides Recent chrome when the lane is empty", () => {
		const empty = reviewRoomAskHistoryView("research", "recent", {
			ask: 4,
			research: 0,
			pinnedAsk: 1,
			pinnedResearch: 0,
		});
		assert.equal(empty.showMeta, false);
		assert.equal(empty.empty, "research");
		assert.equal(empty.label, RESEARCH_HISTORY_LABEL);
	});

	it("labels an unpinned Asks lane as Recent Asks", () => {
		const view = reviewRoomAskHistoryView("ask", "recent", {
			ask: 3,
			research: 1,
			pinnedAsk: 0,
			pinnedResearch: 1,
		});
		assert.equal(view.showPinTabs, false);
		assert.equal(view.showLabel, true);
		assert.equal(view.label, ASK_HISTORY_LABEL);
	});
});

describe("reviewRoomHistoryRowHidden", () => {
	it("filters Pinned on the active lane only", () => {
		assert.equal(
			reviewRoomHistoryRowHidden("ask", false, "ask", "pinned"),
			true,
		);
		assert.equal(
			reviewRoomHistoryRowHidden("ask", true, "ask", "pinned"),
			false,
		);
		assert.equal(
			reviewRoomHistoryRowHidden("research", false, "ask", "pinned"),
			false,
		);
		assert.equal(
			reviewRoomHistoryRowHidden("ask", false, "ask", "recent"),
			false,
		);
	});
});
