import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	RESEARCH_REVISE_SELECTION_PLACEHOLDER,
	RESEARCH_REVISE_PLACEHOLDER,
	RESEARCH_REVISE_MULTI_HINT,
} from "./aiAskResearchUi";
import {
	applyReviseSelectionToDraft,
	buildSubmittableReviseEdits,
	canSubmitReviseEdits,
	clearCommittedReviseRowScope,
	clearReviseDraftScope,
	emptyReviseEditDraft,
	formatParagraphBlockLabel,
	formatReviseEditScopeLabel,
	hasReviseEditScope,
	isReviseEditsCapped,
	reviseEditSlotCount,
	removeCommittedReviseRow,
	reviseCompactDockPlaceholder,
	reviseExpandedPlaceholder,
	reviseStackRenderKey,
	shouldDeferReviseComposerDraftPersist,
	updateCommittedReviseInstruction,
	RESEARCH_REVISE_EDITS_MAX,
} from "./aiAskResearchReviseComposer";

describe("formatReviseEditScopeLabel", () => {
	it("formats heading and paragraph pins", () => {
		assert.equal(formatReviseEditScopeLabel({ heading: "Faculties" }), "§ Faculties");
		assert.equal(formatReviseEditScopeLabel({ blockIds: ["p57"] }), "¶57");
		assert.equal(
			formatReviseEditScopeLabel({ blockIds: ["p57", "p58"] }),
			"¶57–58",
		);
	});

	it("shows paragraph prefix with abbreviated quote text", () => {
		const quote =
			"The discourses do not present mindfulness as a stress-relief technique or a pleasant mental habit.";
		const label = formatReviseEditScopeLabel({
			blockIds: ["p1"],
			quote,
		});
		assert.match(label, /^¶1 · “The discourses/);
	});

	it("shows a paragraph range when a selection spans blocks", () => {
		assert.equal(
			formatReviseEditScopeLabel({
				blockIds: ["p3", "p4"],
				quote: "Spanning two paragraphs",
			}),
			"¶3–4 · “Spanning two paragraphs”",
		);
	});
});

describe("formatParagraphBlockLabel", () => {
	it("joins non-consecutive paragraphs", () => {
		assert.equal(formatParagraphBlockLabel(["p1", "p3"]), "¶1, ¶3");
	});

	it("labels code and table block ids", () => {
		assert.equal(formatParagraphBlockLabel(["c1"]), "c1");
		assert.equal(formatParagraphBlockLabel(["t2"]), "t2");
		assert.equal(formatParagraphBlockLabel(["p24", "t1"]), "¶24, t1");
		assert.equal(formatParagraphBlockLabel(["p57", "c4"]), "¶57, c4");
	});
});

describe("revise edit draft state", () => {
	it("clears draft scope visibility when the pin is removed", () => {
		let draft = applyReviseSelectionToDraft(emptyReviseEditDraft(), {
			blockIds: ["p1"],
			quote: "Alpha beta",
		}).draft;
		assert.equal(hasReviseEditScope(draft.draftScope), true);
		draft = clearReviseDraftScope(draft);
		assert.equal(hasReviseEditScope(draft.draftScope), false);
	});

	it("reopens the last committed row when the empty draft pin is cleared", () => {
		let draft = applyReviseSelectionToDraft(emptyReviseEditDraft(), {
			blockIds: ["p44"],
			quote: "The four establishments",
		}).draft;
		draft = { ...draft, draftInstruction: "Fix the survey image." };
		draft = applyReviseSelectionToDraft(draft, {
			blockIds: ["p46"],
			quote: "Even mindfulness",
		}).draft;
		assert.equal(draft.committed.length, 1);
		assert.equal(draft.committed[0]?.instruction, "Fix the survey image.");
		assert.equal(draft.draftScope?.blockIds?.[0], "p46");
		draft = clearReviseDraftScope(draft);
		assert.equal(draft.committed.length, 0);
		assert.equal(draft.draftScope?.blockIds?.[0], "p44");
		assert.equal(draft.draftInstruction, "Fix the survey image.");
	});

	it("keeps draft text when only the draft pin is cleared", () => {
		let draft = applyReviseSelectionToDraft(emptyReviseEditDraft(), {
			blockIds: ["p1"],
			quote: "Alpha",
		}).draft;
		draft = { ...draft, draftInstruction: "Tighten this" };
		draft = applyReviseSelectionToDraft(draft, {
			blockIds: ["p5"],
			quote: "Beta",
		}).draft;
		draft = { ...draft, draftInstruction: "Second edit draft" };
		draft = clearReviseDraftScope(draft);
		assert.equal(draft.committed.length, 1);
		assert.equal(draft.draftScope, null);
		assert.equal(draft.draftInstruction, "Second edit draft");
	});

	it("replaces draft scope until instruction commits a row", () => {
		let draft = emptyReviseEditDraft();
		const first = applyReviseSelectionToDraft(draft, { blockIds: ["p1"] }).draft;
		assert.equal(first.draftScope?.blockIds?.[0], "p1");
		const second = applyReviseSelectionToDraft(first, { blockIds: ["p2"] }).draft;
		assert.equal(second.draftScope?.blockIds?.[0], "p2");
		assert.equal(second.committed.length, 0);
	});

	it("commits draft when selecting again after instruction", () => {
		let draft = applyReviseSelectionToDraft(emptyReviseEditDraft(), {
			blockIds: ["p1"],
			quote: "Alpha",
		}).draft;
		draft = { ...draft, draftInstruction: "Tighten this" };
		draft = applyReviseSelectionToDraft(draft, {
			blockIds: ["p5"],
			quote: "Beta",
		}).draft;
		assert.equal(draft.committed.length, 1);
		assert.equal(draft.committed[0]?.instruction, "Tighten this");
		assert.equal(draft.committed[0]?.scope?.blockIds?.[0], "p1");
		assert.equal(draft.draftScope?.blockIds?.[0], "p5");
		assert.equal(draft.draftInstruction, "");
	});

	it("ignores selection-only rows on submit and disables send", () => {
		const draft = applyReviseSelectionToDraft(emptyReviseEditDraft(), {
			blockIds: ["p3"],
		}).draft;
		const edits = buildSubmittableReviseEdits(draft);
		assert.deepEqual(edits, []);
		assert.equal(canSubmitReviseEdits(edits), false);
	});

	it("caps committed rows", () => {
		let draft = emptyReviseEditDraft();
		for (let i = 0; i < RESEARCH_REVISE_EDITS_MAX + 1; i += 1) {
			draft = {
				committed: [
					...draft.committed,
					{ instruction: `Edit ${i + 1}`, scope: { blockIds: [`p${i + 1}`] } },
				],
				draftScope: null,
				draftInstruction: "",
			};
		}
		draft = removeCommittedReviseRow(draft, 0);
		assert.equal(buildSubmittableReviseEdits(draft).length, RESEARCH_REVISE_EDITS_MAX);
	});

	it("keeps committed instructions editable and scopes removable", () => {
		let draft = applyReviseSelectionToDraft(emptyReviseEditDraft(), {
			blockIds: ["p2"],
			quote: "Alpha",
		}).draft;
		draft = { ...draft, draftInstruction: "Change this" };
		draft = applyReviseSelectionToDraft(draft, {
			blockIds: ["p5"],
			quote: "Beta",
		}).draft;
		draft = updateCommittedReviseInstruction(draft, 0, "Updated instruction");
		assert.equal(draft.committed[0]?.instruction, "Updated instruction");
		draft = clearCommittedReviseRowScope(draft, 0);
		assert.equal(draft.committed[0]?.scope, undefined);
		assert.equal(draft.committed[0]?.instruction, "Updated instruction");
	});
});

describe("revise placeholders", () => {
	it("uses compact count for two committed edits", () => {
		const draft = {
			committed: [
				{ instruction: "One", scope: { blockIds: ["p1"] } },
				{ instruction: "Two", scope: { blockIds: ["p2"] } },
			],
			draftScope: null,
			draftInstruction: "",
		};
		assert.equal(reviseCompactDockPlaceholder(draft), "2 edits");
		assert.equal(
			reviseCompactDockPlaceholder({
				committed: [{ instruction: "One", scope: { blockIds: ["p1"] } }],
				draftScope: null,
				draftInstruction: "",
			}),
			"1 edit",
		);
		assert.equal(reviseCompactDockPlaceholder(emptyReviseEditDraft()), RESEARCH_REVISE_PLACEHOLDER);
	});

	it("expands selection-aware placeholders", () => {
		assert.equal(
			reviseExpandedPlaceholder(emptyReviseEditDraft()),
			RESEARCH_REVISE_PLACEHOLDER,
		);
		assert.equal(
			reviseExpandedPlaceholder({
				committed: [],
				draftScope: { blockIds: ["p4"] },
				draftInstruction: "",
			}),
			RESEARCH_REVISE_SELECTION_PLACEHOLDER,
		);
		const multiDraft = {
			committed: [{ instruction: "One", scope: { blockIds: ["p1"] } }],
			draftScope: null,
			draftInstruction: "",
		};
		assert.equal(
			reviseExpandedPlaceholder(multiDraft, false),
			RESEARCH_REVISE_PLACEHOLDER,
		);
		assert.equal(
			reviseExpandedPlaceholder(
				{
					...multiDraft,
					draftScope: { blockIds: ["p2"] },
				},
				true,
			),
			`${RESEARCH_REVISE_SELECTION_PLACEHOLDER} ${RESEARCH_REVISE_MULTI_HINT}`,
		);
	});

	it("commits the sixth edit without treating it as capped", () => {
		let draft = emptyReviseEditDraft();
		for (let i = 0; i < RESEARCH_REVISE_EDITS_MAX - 1; i += 1) {
			draft = {
				committed: [
					...draft.committed,
					{ instruction: `Edit ${i + 1}`, scope: { blockIds: [`p${i + 1}`] } },
				],
				draftScope: null,
				draftInstruction: "",
			};
		}
		draft = {
			...draft,
			draftScope: { blockIds: [`p${RESEARCH_REVISE_EDITS_MAX}`] },
			draftInstruction: `Edit ${RESEARCH_REVISE_EDITS_MAX}`,
		};
		const result = applyReviseSelectionToDraft(draft, {
			blockIds: [`p${RESEARCH_REVISE_EDITS_MAX + 1}`],
		});
		assert.equal(result.capped, false);
		assert.equal(result.draft.committed.length, RESEARCH_REVISE_EDITS_MAX);
		assert.equal(
			reviseEditSlotCount(result.draft),
			RESEARCH_REVISE_EDITS_MAX,
		);
		assert.equal(isReviseEditsCapped(result.draft), true);
	});

	it("detects when the edit cap is reached", () => {
		const draft = {
			committed: Array.from({ length: RESEARCH_REVISE_EDITS_MAX - 1 }, (_, i) => ({
				instruction: `Edit ${i + 1}`,
				scope: { blockIds: [`p${i + 1}`] },
			})),
			draftScope: { blockIds: ["p6"] },
			draftInstruction: "Edit 6",
		};
		assert.equal(reviseEditSlotCount(draft), RESEARCH_REVISE_EDITS_MAX);
		assert.equal(isReviseEditsCapped(draft), true);
		const draftBelowCap = {
			committed: draft.committed,
			draftScope: { blockIds: ["p6"] },
			draftInstruction: "",
		};
		assert.equal(reviseEditSlotCount(draftBelowCap), RESEARCH_REVISE_EDITS_MAX);
		assert.equal(isReviseEditsCapped(draftBelowCap), true);
		assert.equal(isReviseEditsCapped(emptyReviseEditDraft()), false);
	});
});

describe("shouldDeferReviseComposerDraftPersist", () => {
	it("defers only when compact mode would drop committed rows", () => {
		assert.equal(
			shouldDeferReviseComposerDraftPersist(emptyReviseEditDraft(), 1),
			true,
		);
		assert.equal(
			shouldDeferReviseComposerDraftPersist(
				{
					committed: [],
					draftScope: { blockIds: ["p2"] },
					draftInstruction: "Fix the diagram.",
				},
				1,
			),
			false,
		);
	});
});
