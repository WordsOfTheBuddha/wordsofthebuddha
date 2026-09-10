import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import type { UserRecord } from "firebase-admin/auth";
import { db, isFirebaseInitialized } from "../service/firebase/server";
import { looksLikePersonalCrisis } from "./aiQueryRewrite";
import {
	canStartResearchClarify,
	declineCopy,
	parseResearchClarify,
	parseResearchClarifyAnswers,
	RESEARCH_CLARIFY_SYSTEM,
	RESEARCH_CLARIFY_TTL_MS,
	RESEARCH_DECLINE_CRISIS,
	researchClarifyAnswersOutOfScope,
	sanitizeResearchClarifyQuestions,
	toPublicResearchClarify,
	type ResearchClarifyAnswer,
	type ResearchClarifyDecline,
	type ResearchClarifyQuestion,
} from "./aiAskResearchClarify";
import {
	ASK_PLANNER_PAID_FALLBACK_MODEL,
	ASK_RESEARCH_VERIFY_REASONING_EFFORT,
	getOpenRouterApiKey,
	openRouterChat,
} from "./openrouter";

export const RESEARCH_CLARIFY_MS = 20_000;

export interface ResearchClarifyDraft {
	id: string;
	uid: string;
	question: string;
	history: unknown;
	inScope: boolean;
	decline?: ResearchClarifyDecline;
	questions: ResearchClarifyQuestion[];
	used: boolean;
	createdAt: number;
	expiresAt: number;
}

const memory = new Map<string, ResearchClarifyDraft>();

function newId(): string {
	try {
		return randomUUID();
	} catch {
		return `rc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
	}
}

function key(uid: string, id: string): string {
	return `${uid}:${id}`;
}

function clarifiesCol(uid: string) {
	return db!.collection("users").doc(uid).collection("researchClarifies");
}

function clipId(value: string): string {
	return value.replace(/\s+/g, "").trim().slice(0, 80);
}

export function resetResearchClarifyMemoryForTests(): void {
	memory.clear();
}

function fromRecord(
	id: string,
	uid: string,
	data: Record<string, unknown>,
): ResearchClarifyDraft | null {
	const question = typeof data.question === "string" ? data.question : "";
	if (!question) return null;
	const createdAt =
		typeof data.createdAt === "number" ? data.createdAt : Date.now();
	const expiresAt =
		typeof data.expiresAt === "number"
			? data.expiresAt
			: createdAt + RESEARCH_CLARIFY_TTL_MS;
	const inScope = data.inScope !== false;
	const declineRaw = data.decline;
	let decline: ResearchClarifyDecline | undefined;
	if (declineRaw && typeof declineRaw === "object") {
		const rec = declineRaw as Record<string, unknown>;
		const kind =
			rec.kind === "crisis" || rec.kind === "unrelated"
				? rec.kind
				: "off_corpus";
		decline = {
			kind,
			message:
				typeof rec.message === "string" && rec.message.trim()
					? rec.message.trim().slice(0, 280)
					: declineCopy(kind),
		};
	}
	return {
		id,
		uid,
		question,
		history: data.history,
		inScope,
		...(decline ? { decline } : {}),
		questions: sanitizeResearchClarifyQuestions(data.questions),
		used: data.used === true,
		createdAt,
		expiresAt,
	};
}

export async function readResearchClarifyDraft(
	uid: string,
	clarifyId: string,
): Promise<ResearchClarifyDraft | null> {
	const id = clipId(clarifyId);
	if (!uid || !id) return null;
	const cached = memory.get(key(uid, id));
	if (cached) return cached;
	if (!isFirebaseInitialized || !db) return null;
	const snap = await clarifiesCol(uid).doc(id).get();
	if (!snap.exists) return null;
	const draft = fromRecord(id, uid, snap.data() as Record<string, unknown>);
	if (draft) memory.set(key(uid, id), draft);
	return draft;
}

async function writeDraft(
	draft: ResearchClarifyDraft,
): Promise<ResearchClarifyDraft> {
	memory.set(key(draft.uid, draft.id), draft);
	if (!isFirebaseInitialized || !db) return draft;
	const { uid, id, ...rest } = draft;
	await clarifiesCol(uid).doc(id).set(
		{
			...rest,
			updatedAt: FieldValue.serverTimestamp(),
		},
		{ merge: true },
	);
	return draft;
}

export function isResearchClarifyExpired(draft: ResearchClarifyDraft): boolean {
	return Date.now() > draft.expiresAt;
}

export async function markResearchClarifyUsed(
	uid: string,
	clarifyId: string,
): Promise<void> {
	const draft = await readResearchClarifyDraft(uid, clarifyId);
	if (!draft) return;
	await writeDraft({ ...draft, used: true });
}

export async function createResearchClarifyDraft(options: {
	user: UserRecord;
	question: string;
	history?: unknown;
	parsed: ReturnType<typeof parseResearchClarify>;
}): Promise<ResearchClarifyDraft> {
	const now = Date.now();
	const draft: ResearchClarifyDraft = {
		id: newId(),
		uid: options.user.uid,
		question: options.question,
		history: options.history ?? [],
		inScope: options.parsed.inScope,
		...(options.parsed.decline ? { decline: options.parsed.decline } : {}),
		questions: options.parsed.questions,
		used: false,
		createdAt: now,
		expiresAt: now + RESEARCH_CLARIFY_TTL_MS,
	};
	return writeDraft(draft);
}

async function generateClarify(
	question: string,
	history: unknown,
): Promise<ReturnType<typeof parseResearchClarify>> {
	if (looksLikePersonalCrisis(question)) {
		return {
			inScope: false,
			decline: { kind: "crisis", message: RESEARCH_DECLINE_CRISIS },
			questions: [],
		};
	}
	if (!getOpenRouterApiKey()) {
		return parseResearchClarify("{}");
	}
	try {
		const generated = await openRouterChat({
			model: ASK_PLANNER_PAID_FALLBACK_MODEL,
			messages: [
				{ role: "system", content: RESEARCH_CLARIFY_SYSTEM },
				{
					role: "user",
					content: `Question: ${question}${
						Array.isArray(history) && history.length > 0
							? `\nEarlier turns: ${history.length}`
							: ""
					}\nThe corpus is fixed to the early discourses on this site. Decide inScope from the question, then either decline or ask 2–3 questions about how to shape the report. Never ask about commentaries, later layers, or the open web.`,
				},
			],
			maxTokens: 900,
			reasoningEffort: ASK_RESEARCH_VERIFY_REASONING_EFFORT,
			jsonMode: false,
			signal: AbortSignal.timeout(RESEARCH_CLARIFY_MS),
		});
		return parseResearchClarify(
			[generated.content, generated.reasoning].filter(Boolean).join("\n"),
		);
	} catch (error) {
		console.warn(
			"[ai/research/clarify] model failed — using fallback questions",
			error instanceof Error ? error.message : error,
		);
		return parseResearchClarify("{}");
	}
}

export async function runResearchClarify(options: {
	user: UserRecord;
	question: string;
	history?: unknown;
}): Promise<ReturnType<typeof toPublicResearchClarify>> {
	const parsed = await generateClarify(options.question, options.history);
	const draft = await createResearchClarifyDraft({
		user: options.user,
		question: options.question,
		history: options.history,
		parsed,
	});
	return toPublicResearchClarify(draft);
}

export function validateResearchClarifyStart(options: {
	draft: ResearchClarifyDraft;
	answers: ResearchClarifyAnswer[];
}):
	| { ok: true; answers: ResearchClarifyAnswer[] }
	| { ok: false; code: "expired" | "used" | "declined" | "incomplete"; decline?: ResearchClarifyDecline } {
	if (options.draft.used) {
		return { ok: false, code: "used" };
	}
	if (isResearchClarifyExpired(options.draft)) {
		return { ok: false, code: "expired" };
	}
	if (!options.draft.inScope && options.draft.decline) {
		return { ok: false, code: "declined", decline: options.draft.decline };
	}
	const answers = parseResearchClarifyAnswers(options.answers);
	if (
		researchClarifyAnswersOutOfScope(options.draft.questions, answers)
	) {
		return {
			ok: false,
			code: "declined",
			decline: {
				kind: "off_corpus",
				message: declineCopy("off_corpus"),
			},
		};
	}
	if (!canStartResearchClarify(options.draft.questions, answers)) {
		return { ok: false, code: "incomplete" };
	}
	return { ok: true, answers };
}
