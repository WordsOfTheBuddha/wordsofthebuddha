import { extractJsonObject } from "./extractJsonObject";

/** Keep this module free of server-only imports — Ask’s browser bundle loads it. */

export const RESEARCH_CLARIFY_TTL_MS = 15 * 60 * 1000;
export const RESEARCH_CLARIFY_MAX_QUESTIONS = 3;
export const RESEARCH_CLARIFY_MIN_QUESTIONS = 1;
export const RESEARCH_CLARIFY_MAX_CHOICES = 5;
export const RESEARCH_CLARIFY_MAX_PROMPT = 180;
export const RESEARCH_CLARIFY_MAX_LABEL = 72;
export const RESEARCH_CLARIFY_MAX_OTHER = 480;
export const RESEARCH_CLARIFY_OTHER_ID = "other";
export const RESEARCH_CLARIFY_NO_PREF_ID = "no_preference";
export const RESEARCH_CLARIFY_OTHER_LABEL = "Other";
export const RESEARCH_CLARIFY_NO_PREF_LABEL = "No preference";
export const RESEARCH_CLARIFY_TITLE = "A few questions first";

export type ResearchClarifyDeclineKind =
	| "off_corpus"
	| "unrelated"
	| "crisis";

export interface ResearchClarifyChoice {
	id: string;
	label: string;
	outOfScope?: boolean;
	other?: boolean;
}

export interface ResearchClarifyQuestion {
	id: string;
	prompt: string;
	choices: ResearchClarifyChoice[];
}

export interface ResearchClarifyDecline {
	kind: ResearchClarifyDeclineKind;
	message: string;
}

export interface ResearchClarifyAnswer {
	questionId: string;
	choiceId: string;
	otherText?: string;
}

export interface ResearchClarifyParsed {
	inScope: boolean;
	decline?: ResearchClarifyDecline;
	questions: ResearchClarifyQuestion[];
}

const ID_RE = /^[a-z][a-z0-9_]{0,39}$/;

export const RESEARCH_DECLINE_OFF_CORPUS =
	"This Research only reads the early discourses on this site. It does not search the open web, later commentaries, or other Buddhist schools.";

export const RESEARCH_DECLINE_UNRELATED =
	"This Research only looks in the early discourses of the Buddha on this site — not the open web, news, or other topics.";

export const RESEARCH_DECLINE_CRISIS =
	"This is not something AI research can help with. Please reach a person nearby or local emergency / crisis resources.";

export const RESEARCH_CLARIFY_SYSTEM = `You prepare 2–3 clarifying questions before a closed-corpus research job on Words of the Buddha.

The library is fixed: only the early Buddhist discourses on this site (Pali nikāyas and related early collections). It cannot use the open web, later commentaries (Visuddhimagga, Abhidhamma as a later layer), other Buddhist schools, academic papers, or news. Do not offer those as options and do not ask the reader to accept or reject that limit.

Return JSON only:
{"inScope":true,"decline":{"kind":"off_corpus","message":""},"questions":[{"id":"focus","prompt":"…","choices":[{"id":"a","label":"…","outOfScope":false}]}]}

Rules:
- Decide inScope first from the question itself.
- inScope false when they want something this library cannot do: open-web research, later commentarial layers as the object of study, other schools, tools/news/weather/coding, or help with their own acute crisis. Then set decline.kind to off_corpus, unrelated, or crisis, put a short polite message, and questions [].
- A mixed question that needs later layers or the open web to be answered is off_corpus — decline the whole topic. Do not ask them to pick nikāyas vs commentary.
- Hard teaching questions (killing, sexuality, undeclared points, caste, politics as Dhamma) stay inScope true. Do not refuse them.
- When inScope, ask only how to shape the report: emphasis, evidence, audience, depth, or how to handle Pali. Never ask about source scope, later layers, Abhidhamma, Visuddhimagga, other schools, or the open web. Do not ask for a word count or page length.
- 2 or 3 short questions. Each has 2–4 concrete choice labels. Do not add “Other” or “No preference” — the harness appends those.
- Choice labels are short (a few words). Question prompts are one sentence.
- Do not search. Do not invent discourse IDs. Do not spend a research credit.`;

export const RESEARCH_FALLBACK_QUESTIONS: ResearchClarifyQuestion[] = [
	{
		id: "focus",
		prompt: "What should the report emphasize?",
		choices: [
			{ id: "survey", label: "A wide survey across the nikāyas" },
			{ id: "definitions", label: "Definitions and key passages" },
			{ id: "compare", label: "Compare how collections treat it" },
		],
	},
	{
		id: "pali",
		prompt: "How should the answer handle Pali terms?",
		choices: [
			{ id: "quote", label: "Quote key Pali passages with translations" },
			{ id: "gloss", label: "English only, with Pali terms glossed briefly" },
		],
	},
];

function clip(value: string, max: number): string {
	return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function clipOtherNote(value: string): string {
	return value
		.replace(/\r\n/g, "\n")
		.replace(/[^\S\n]+/g, " ")
		.replace(/\n{3,}/g, "\n\n")
		.trim()
		.slice(0, RESEARCH_CLARIFY_MAX_OTHER);
}

function slugId(value: string, fallback: string): string {
	const slug = value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_|_$/g, "")
		.slice(0, 40);
	return ID_RE.test(slug) ? slug : fallback;
}

function parseKind(value: unknown): ResearchClarifyDeclineKind {
	if (value === "crisis" || value === "unrelated" || value === "off_corpus") {
		return value;
	}
	return "off_corpus";
}

export function declineCopy(kind: ResearchClarifyDeclineKind): string {
	if (kind === "crisis") return RESEARCH_DECLINE_CRISIS;
	if (kind === "unrelated") return RESEARCH_DECLINE_UNRELATED;
	return RESEARCH_DECLINE_OFF_CORPUS;
}

function parseChoice(
	raw: unknown,
	index: number,
	seen: Set<string>,
): ResearchClarifyChoice | null {
	if (!raw || typeof raw !== "object") return null;
	const record = raw as Record<string, unknown>;
	const label = clip(
		typeof record.label === "string" ? record.label : "",
		RESEARCH_CLARIFY_MAX_LABEL,
	);
	if (!label) return null;
	let id = clip(
		typeof record.id === "string" ? record.id.toLowerCase() : "",
		40,
	);
	if (!ID_RE.test(id)) id = slugId(label, `c${index + 1}`);
	if (id === RESEARCH_CLARIFY_OTHER_ID || id === RESEARCH_CLARIFY_NO_PREF_ID) {
		return null;
	}
	if (seen.has(id)) id = `${id}_${index + 1}`;
	if (seen.has(id)) return null;
	seen.add(id);
	return {
		id,
		label,
		...(record.outOfScope === true ? { outOfScope: true } : {}),
	};
}

function withRequiredChoices(
	choices: ResearchClarifyChoice[],
): ResearchClarifyChoice[] {
	const out = choices.slice(0, RESEARCH_CLARIFY_MAX_CHOICES - 2);
	if (!out.some((choice) => choice.id === RESEARCH_CLARIFY_NO_PREF_ID)) {
		out.push({
			id: RESEARCH_CLARIFY_NO_PREF_ID,
			label: RESEARCH_CLARIFY_NO_PREF_LABEL,
		});
	}
	if (!out.some((choice) => choice.id === RESEARCH_CLARIFY_OTHER_ID)) {
		out.push({
			id: RESEARCH_CLARIFY_OTHER_ID,
			label: RESEARCH_CLARIFY_OTHER_LABEL,
			other: true,
		});
	} else {
		out.forEach((choice) => {
			if (choice.id === RESEARCH_CLARIFY_OTHER_ID) choice.other = true;
		});
	}
	return out;
}

function parseQuestion(
	raw: unknown,
	index: number,
	seen: Set<string>,
): ResearchClarifyQuestion | null {
	if (!raw || typeof raw !== "object") return null;
	const record = raw as Record<string, unknown>;
	const prompt = clip(
		typeof record.prompt === "string" ? record.prompt : "",
		RESEARCH_CLARIFY_MAX_PROMPT,
	);
	if (!prompt) return null;
	let id = clip(
		typeof record.id === "string" ? record.id.toLowerCase() : "",
		40,
	);
	if (!ID_RE.test(id)) id = slugId(prompt, `q${index + 1}`);
	if (seen.has(id)) id = `q${index + 1}`;
	seen.add(id);
	const choiceSeen = new Set<string>();
	const choices: ResearchClarifyChoice[] = [];
	const rawChoices = Array.isArray(record.choices) ? record.choices : [];
	for (const [choiceIndex, item] of rawChoices.entries()) {
		const choice = parseChoice(item, choiceIndex, choiceSeen);
		if (!choice) continue;
		choices.push(choice);
		if (choices.length >= RESEARCH_CLARIFY_MAX_CHOICES - 2) break;
	}
	if (choices.length < 1) return null;
	return { id, prompt, choices: withRequiredChoices(choices) };
}

export function parseResearchClarify(raw: string): ResearchClarifyParsed {
	const parsed = extractJsonObject(raw);
	if (!parsed || typeof parsed !== "object") {
		return {
			inScope: true,
			questions: RESEARCH_FALLBACK_QUESTIONS.map(cloneQuestion),
		};
	}
	const record = parsed as Record<string, unknown>;
	const inScope = record.inScope !== false;
	if (!inScope) {
		const kind = parseKind(
			record.decline && typeof record.decline === "object"
				? (record.decline as Record<string, unknown>).kind
				: record.kind,
		);
		const fromModel =
			record.decline && typeof record.decline === "object"
				? clip(
						typeof (record.decline as Record<string, unknown>).message ===
							"string"
							? ((record.decline as Record<string, unknown>).message as string)
							: "",
						280,
					)
				: "";
		return {
			inScope: false,
			decline: {
				kind,
				message: fromModel || declineCopy(kind),
			},
			questions: [],
		};
	}
	const seen = new Set<string>();
	const questions: ResearchClarifyQuestion[] = [];
	const rawQuestions = Array.isArray(record.questions) ? record.questions : [];
	for (const [index, item] of rawQuestions.entries()) {
		const question = parseQuestion(item, index, seen);
		if (!question) continue;
		questions.push(question);
		if (questions.length >= RESEARCH_CLARIFY_MAX_QUESTIONS) break;
	}
	if (questions.length < RESEARCH_CLARIFY_MIN_QUESTIONS) {
		return {
			inScope: true,
			questions: RESEARCH_FALLBACK_QUESTIONS.map(cloneQuestion),
		};
	}
	return { inScope: true, questions };
}

function cloneQuestion(question: ResearchClarifyQuestion): ResearchClarifyQuestion {
	return {
		id: question.id,
		prompt: question.prompt,
		choices: withRequiredChoices(
			question.choices.filter(
				(choice) =>
					choice.id !== RESEARCH_CLARIFY_OTHER_ID &&
					choice.id !== RESEARCH_CLARIFY_NO_PREF_ID,
			),
		),
	};
}

export function sanitizeResearchClarifyQuestions(
	raw: unknown,
): ResearchClarifyQuestion[] {
	if (!Array.isArray(raw)) return [];
	const seen = new Set<string>();
	const out: ResearchClarifyQuestion[] = [];
	for (const [index, item] of raw.entries()) {
		const question = parseQuestion(item, index, seen);
		if (!question) continue;
		out.push(question);
		if (out.length >= RESEARCH_CLARIFY_MAX_QUESTIONS) break;
	}
	return out;
}

export function parseResearchClarifyAnswers(
	raw: unknown,
): ResearchClarifyAnswer[] {
	if (!Array.isArray(raw)) return [];
	const out: ResearchClarifyAnswer[] = [];
	const seen = new Set<string>();
	for (const item of raw) {
		if (!item || typeof item !== "object") continue;
		const record = item as Record<string, unknown>;
		const questionId = clip(
			typeof record.questionId === "string" ? record.questionId.toLowerCase() : "",
			40,
		);
		const choiceId = clip(
			typeof record.choiceId === "string" ? record.choiceId.toLowerCase() : "",
			40,
		);
		if (!questionId || !choiceId || seen.has(questionId)) continue;
		seen.add(questionId);
		const otherText = clipOtherNote(
			typeof record.otherText === "string" ? record.otherText : "",
		);
		out.push({
			questionId,
			choiceId,
			...(otherText ? { otherText } : {}),
		});
	}
	return out;
}

export function findClarifyChoice(
	question: ResearchClarifyQuestion,
	choiceId: string,
): ResearchClarifyChoice | undefined {
	return question.choices.find((choice) => choice.id === choiceId);
}

export function isClarifyAnswerComplete(
	question: ResearchClarifyQuestion,
	answer: ResearchClarifyAnswer | undefined,
): boolean {
	if (!answer) return false;
	const choice = findClarifyChoice(question, answer.choiceId);
	if (!choice) return false;
	if (choice.other || choice.id === RESEARCH_CLARIFY_OTHER_ID) {
		return Boolean((answer.otherText || "").trim());
	}
	return true;
}

export function canStartResearchClarify(
	questions: readonly ResearchClarifyQuestion[],
	answers: readonly ResearchClarifyAnswer[],
): boolean {
	if (questions.length === 0) return false;
	const byId = new Map(answers.map((item) => [item.questionId, item]));
	return questions.every((question) =>
		isClarifyAnswerComplete(question, byId.get(question.id)),
	);
}

export function researchClarifyAnswersOutOfScope(
	questions: readonly ResearchClarifyQuestion[],
	answers: readonly ResearchClarifyAnswer[],
): boolean {
	const byId = new Map(answers.map((item) => [item.questionId, item]));
	for (const question of questions) {
		const answer = byId.get(question.id);
		if (!answer) continue;
		const choice = findClarifyChoice(question, answer.choiceId);
		if (choice?.outOfScope === true) return true;
	}
	return false;
}

export function formatResearchClarifyBrief(
	question: string,
	questions: readonly ResearchClarifyQuestion[],
	answers: readonly ResearchClarifyAnswer[],
): string {
	const byId = new Map(answers.map((item) => [item.questionId, item]));
	const lines = [`Topic: ${clip(question, 500)}`];
	for (const item of questions) {
		const answer = byId.get(item.id);
		if (!answer) continue;
		const choice = findClarifyChoice(item, answer.choiceId);
		const label =
			choice?.other || choice?.id === RESEARCH_CLARIFY_OTHER_ID
				? clip(answer.otherText || "", RESEARCH_CLARIFY_MAX_OTHER)
				: choice?.label || answer.choiceId;
		if (!label) continue;
		lines.push(`${item.prompt} → ${label}`);
	}
	return lines.join("\n").slice(0, 1200);
}

export function answersFromClarifyState(
	answers: Record<string, { choiceId: string; otherText?: string }>,
): ResearchClarifyAnswer[] {
	return parseResearchClarifyAnswers(
		Object.entries(answers).map(([questionId, value]) => ({
			questionId,
			choiceId: value.choiceId,
			otherText: value.otherText,
		})),
	);
}

export function toPublicResearchClarify(input: {
	id: string;
	inScope: boolean;
	decline?: ResearchClarifyDecline;
	questions?: readonly ResearchClarifyQuestion[];
}): {
	clarifyId: string;
	inScope: boolean;
	decline?: ResearchClarifyDecline;
	questions?: ResearchClarifyQuestion[];
} {
	if (!input.inScope && input.decline) {
		return {
			clarifyId: input.id,
			inScope: false,
			decline: input.decline,
		};
	}
	return {
		clarifyId: input.id,
		inScope: true,
		questions: (input.questions || []).map((question) => ({
			id: question.id,
			prompt: question.prompt,
			choices: question.choices.map((choice) => ({
				id: choice.id,
				label: choice.label,
				...(choice.outOfScope ? { outOfScope: true } : {}),
				...(choice.other || choice.id === RESEARCH_CLARIFY_OTHER_ID
					? { other: true }
					: {}),
			})),
		})),
	};
}
