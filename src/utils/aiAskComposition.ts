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
/** Invisible marker inserted in the composer where the context chip is anchored. */
export const COMPOSITION_CONTEXT_CHIP_MARKER = "\u2060";
/** Non-collapsing pad after the marker so the caret sits past the chip overlay. */
export const COMPOSITION_CHIP_PAD_CHAR = "\u00a0";

/** sessionStorage draft for an in-progress Research compose (not revise). */
export const RESEARCH_COMPOSITION_DRAFT_STORAGE_KEY =
	"ai-mode-research-composition-draft";

const IMAGE_EXTENSIONS = new Set([
	"jpg",
	"jpeg",
	"png",
	"gif",
	"webp",
	"heic",
	"heif",
]);
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

export function stripCompositionChipMarkers(value: string): string {
	return value
		.replaceAll(COMPOSITION_CONTEXT_CHIP_MARKER, "")
		.replaceAll(COMPOSITION_CHIP_PAD_CHAR, "");
}

export function compositionMarkerPadLength(value: string, markerIndex: number): number {
	const after = value.slice(markerIndex + COMPOSITION_CONTEXT_CHIP_MARKER.length);
	const match = after.match(/^[\u00a0]+/);
	return match ? match[0].length : 0;
}

export function compositionDroppedImageFiles(dt: DataTransfer): File[] {
	const files: File[] = [];
	if (dt.files?.length) {
		for (const file of dt.files) {
			if (isCompositionImageFile(file)) files.push(file);
		}
	}
	if (files.length > 0) return files;
	for (const item of dt.items) {
		if (item.kind !== "file") continue;
		const file = item.getAsFile();
		if (file && isCompositionImageFile(file)) files.push(file);
	}
	return files;
}

export function shouldAutoAttachPasteText(text: string): boolean {
	return text.length > RESEARCH_CONTEXT_AUTO_ATTACH_CHARS;
}

/** Whether a paste should become an attached context chip. */
export function shouldAttachPasteAsCompositionContext(
	pastedText: string,
	options: {
		composerTextLength: number;
		selectionLength: number;
		maxQuestionChars?: number;
	},
): boolean {
	if (!pastedText.trim()) return false;
	if (shouldAutoAttachPasteText(pastedText)) return true;
	const max = options.maxQuestionChars ?? MAX_QUESTION_CHARS;
	const nextLength =
		options.composerTextLength - options.selectionLength + pastedText.length;
	return nextLength > max;
}

export function compositionMarkerIndices(value: string): number[] {
	const indices: number[] = [];
	let from = 0;
	while (from < value.length) {
		const index = value.indexOf(COMPOSITION_CONTEXT_CHIP_MARKER, from);
		if (index < 0) break;
		indices.push(index);
		from = index + 1;
	}
	return indices;
}

export function mergeCompositionContexts(contexts: readonly string[]): string {
	return clipResearchContext(
		contexts
			.map((context) => context.trim())
			.filter(Boolean)
			.join("\n\n"),
	);
}

/** Where to anchor the next context chip relative to existing markers. */
export function compositionLineStart(value: string, index: number): number {
	const clamped = Math.max(0, Math.min(index, value.length));
	const lineBreak = value.lastIndexOf("\n", clamped - 1);
	return lineBreak < 0 ? 0 : lineBreak + 1;
}

export function compositionChipPadCount(
	chipWidthPx: number,
	charWidthPx: number,
	existingPad = 0,
): number {
	if (chipWidthPx <= 0 || charWidthPx <= 0) {
		return Math.max(existingPad, 1);
	}
	const needed = Math.max(1, Math.ceil(chipWidthPx / charWidthPx) + 1);
	return Math.max(existingPad, needed);
}

export function compositionContextInsertPosition(
	value: string,
	start: number,
): { insertIndex: number; at: number } {
	let at = Math.max(0, Math.min(start, value.length));
	for (const region of compositionMarkerRegions(value)) {
		if (at > region.start && at < region.end) {
			at = region.end;
		}
	}
	const insertIndex = compositionMarkerIndices(value).filter(
		(index) => index < at,
	).length;
	return { insertIndex, at };
}

export function insertCompositionContextClip(
	contexts: readonly string[],
	pastedText: string,
	insertIndex: number,
): string[] {
	const clip = clipResearchContext(pastedText);
	if (!clip) return [...contexts];
	const index = Math.max(0, Math.min(insertIndex, contexts.length));
	return [...contexts.slice(0, index), clip, ...contexts.slice(index)];
}

export function guessImageMimeFromName(name: string): string | null {
	const ext = name.split(".").pop()?.toLowerCase();
	if (!ext) return null;
	if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
	if (ext === "png") return "image/png";
	if (ext === "gif") return "image/gif";
	if (ext === "webp") return "image/webp";
	if (ext === "heic" || ext === "heif") return "image/heic";
	return null;
}

export function isCompositionImageFile(file: File): boolean {
	if (file.type.startsWith("image/")) return true;
	const ext = file.name.split(".").pop()?.toLowerCase();
	return Boolean(ext && IMAGE_EXTENSIONS.has(ext));
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

export interface ResearchCompositionDraft {
	question: string;
	context: string;
	images: ResearchContextImage[];
}

export function compositionMarkerRegions(
	value: string,
): { start: number; end: number }[] {
	return compositionMarkerIndices(value).map((start) => ({
		start,
		end:
			start +
			COMPOSITION_CONTEXT_CHIP_MARKER.length +
			compositionMarkerPadLength(value, start),
	}));
}

export function compositionMarkerRegion(
	value: string,
): { start: number; end: number } | null {
	return compositionMarkerRegions(value)[0] ?? null;
}

/** Keep the caret out of the inline chip marker + pad. */
export function normalizeCompositionCaret(
	value: string,
	start: number,
	end: number = start,
): { start: number; end: number } {
	for (const region of compositionMarkerRegions(value)) {
		const insideStart = start > region.start && start < region.end;
		const insideEnd = end > region.start && end < region.end;
		if (!insideStart && !insideEnd) continue;
		if (start !== end) return { start: region.end, end: region.end };
		return { start: region.end, end: region.end };
	}
	return { start, end };
}

export function compositionMarkerArrowAdjust(
	value: string,
	key: "ArrowLeft" | "ArrowRight",
	start: number,
	end: number,
): { start: number; end: number } | null {
	if (start !== end) return null;
	for (const region of compositionMarkerRegions(value)) {
		if (key === "ArrowLeft" && start === region.end) {
			return { start: region.start, end: region.start };
		}
		if (key === "ArrowRight" && start === region.start) {
			return { start: region.end, end: region.end };
		}
	}
	return null;
}

export function parseResearchCompositionDraft(
	raw: string | null | undefined,
): ResearchCompositionDraft | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		const question = stripCompositionChipMarkers(
			typeof parsed.question === "string"
				? parsed.question.slice(0, MAX_QUESTION_CHARS)
				: "",
		);
		const images = sanitizeResearchContextImages(parsed.images);
		if (!question.trim() && images.length === 0) {
			return null;
		}
		// Pasted context is session-only; do not restore from storage.
		return { question, context: "", images };
	} catch {
		return null;
	}
}

export function serializeResearchCompositionDraft(
	draft: ResearchCompositionDraft,
): string {
	return JSON.stringify({
		question: stripCompositionChipMarkers(draft.question).slice(
			0,
			MAX_QUESTION_CHARS,
		),
		images: sanitizeResearchContextImages(draft.images),
	});
}
