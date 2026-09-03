/** Optional “what brings you here?” collected at registration. */

export const SIGNUP_INTENT_OPTIONS = [
	{ id: "practice", label: "Personal practice" },
	{ id: "study", label: "Study or research" },
	{ id: "teaching", label: "Teaching or sharing with others" },
	{ id: "exploring", label: "Exploring the discourses" },
	{ id: "other", label: "Other" },
] as const;

export type SignupIntentId = (typeof SIGNUP_INTENT_OPTIONS)[number]["id"];

const INTENT_IDS = new Set<string>(
	SIGNUP_INTENT_OPTIONS.map((option) => option.id),
);

export const SIGNUP_INTENT_NOTE_MAX = 280;

export function normalizeSignupIntentId(
	value: string | null | undefined,
): SignupIntentId | null {
	const id = (value || "").trim().toLowerCase();
	if (!id || !INTENT_IDS.has(id)) return null;
	return id as SignupIntentId;
}

export function normalizeSignupIntentNote(
	value: string | null | undefined,
): string {
	return (value || "").replace(/\s+/g, " ").trim().slice(0, SIGNUP_INTENT_NOTE_MAX);
}

export function parseSignupIntentFields(input: {
	intent?: string | null;
	note?: string | null;
}): { intent: SignupIntentId | null; note: string } {
	return {
		intent: normalizeSignupIntentId(input.intent),
		note: normalizeSignupIntentNote(input.note),
	};
}
