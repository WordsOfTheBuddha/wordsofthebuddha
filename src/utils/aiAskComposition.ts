/**
 * Research composition limits and helpers. Browser-safe — no server-only imports.
 */

import { normalizeAskQuestionText } from "./aiAskQuestionText";

/** Unchanged for Ask + Research question field. */
export const MAX_QUESTION_CHARS = 8_000;

/** ~50K words at ~6 chars/word. Research-only attached context. */
export const MAX_RESEARCH_CONTEXT_CHARS = 300_000;
export const MAX_RESEARCH_CONTEXT_WORDS = 50_000;
export const MAX_RESEARCH_CONTEXT_IMAGES = 4;
/** Per image after client resize. */
export const MAX_RESEARCH_CONTEXT_IMAGE_BYTES = 500_000;
/** ~2 MB total base64 payload for all images. */
export const MAX_RESEARCH_CONTEXT_IMAGES_TOTAL_BYTES = 2_000_000;
/** Text that does not fit in the composer overflows to the context chip (Research). */
export const RESEARCH_CONTEXT_AUTO_ATTACH_CHARS = 500;
/** Preview stored in session/history sync. */
export const RESEARCH_CONTEXT_PREVIEW_CHARS = 200;

const ALLOWED_IMAGE_MIMES = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
]);

export interface ResearchContextImage {
	mime: string;
	/** Raw base64 without data-URL prefix. */
	data: string;
}

export function countContextWords(text: string): number {
	const normalized = text.replace(/\s+/g, " ").trim();
	if (!normalized) return 0;
	return normalized.split(" ").length;
}

export function countContextLines(text: string): number {
	if (!text) return 0;
	return text.replace(/\r\n/g, "\n").split("\n").length;
}

export function normalizeResearchContextText(value: string): string {
	return value
		.replace(/\r\n/g, "\n")
		.replace(/\n{4,}/g, "\n\n\n")
		.trim();
}

export function clipResearchContext(
	value: string,
	maxChars = MAX_RESEARCH_CONTEXT_CHARS,
): string {
	const normalized = normalizeResearchContextText(value);
	let clipped = normalized.slice(0, maxChars);
	const words = countContextWords(clipped);
	if (words > MAX_RESEARCH_CONTEXT_WORDS) {
		const parts = clipped.split(/\s+/);
		clipped = parts.slice(0, MAX_RESEARCH_CONTEXT_WORDS).join(" ");
	}
	return clipped;
}

export function researchContextPreview(
	value: string,
	max = RESEARCH_CONTEXT_PREVIEW_CHARS,
): string {
	const text = value.replace(/\s+/g, " ").trim();
	if (!text) return "";
	if (text.length <= max) return text;
	return `${text.slice(0, max - 1)}…`;
}

export function formatContextChipLabel(text: string): string {
	const lines = countContextLines(text);
	const words = countContextWords(text);
	if (lines > 1) return `Clipboard (${lines.toLocaleString()} lines)`;
	if (words > 0) return `Notes (${words.toLocaleString()} words)`;
	return "Attached notes";
}

export function formatAttachedMaterialBlock(context: string): string {
	const clipped = clipResearchContext(context);
	if (!clipped) return "";
	const words = countContextWords(clipped);
	return `\n\nAttached material (${words.toLocaleString()} words):\n${clipped}`;
}

function base64ByteLength(data: string): number {
	const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
	return Math.floor((data.length * 3) / 4) - padding;
}

export function sanitizeResearchContextImages(
	raw: unknown,
): ResearchContextImage[] {
	if (!Array.isArray(raw)) return [];
	const images: ResearchContextImage[] = [];
	let totalBytes = 0;
	for (const item of raw.slice(0, MAX_RESEARCH_CONTEXT_IMAGES)) {
		if (!item || typeof item !== "object") continue;
		const record = item as Record<string, unknown>;
		const mime =
			typeof record.mime === "string"
				? record.mime.trim().toLowerCase()
				: "";
		const data =
			typeof record.data === "string"
				? record.data.replace(/\s+/g, "").trim()
				: "";
		if (!mime || !ALLOWED_IMAGE_MIMES.has(mime) || !data) continue;
		if (!/^[A-Za-z0-9+/]+=*$/.test(data)) continue;
		const bytes = base64ByteLength(data);
		if (bytes <= 0 || bytes > MAX_RESEARCH_CONTEXT_IMAGE_BYTES) continue;
		if (totalBytes + bytes > MAX_RESEARCH_CONTEXT_IMAGES_TOTAL_BYTES) break;
		images.push({ mime, data });
		totalBytes += bytes;
	}
	return images;
}

export function parseResearchCompositionPayload(body: Record<string, unknown>): {
	question: string;
	context: string;
	images: ResearchContextImage[];
} {
	const question = normalizeAskQuestionText(
		typeof body.question === "string" ? body.question : "",
	).slice(0, MAX_QUESTION_CHARS);
	const context = clipResearchContext(
		typeof body.context === "string" ? body.context : "",
	);
	const images = sanitizeResearchContextImages(body.images);
	return { question, context, images };
}

export function hasResearchCompositionContent(input: {
	question: string;
	context: string;
	images?: readonly ResearchContextImage[];
}): boolean {
	return Boolean(
		input.question.trim() ||
			input.context.trim() ||
			(input.images && input.images.length > 0),
	);
}
