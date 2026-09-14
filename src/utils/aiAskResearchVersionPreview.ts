/** Tab-scoped preview version for a research report (not the job head). */
export const RESEARCH_PREVIEW_VERSION_KEY = "ai-research-preview-version-v1";

export interface ResearchPreviewVersionRef {
	/** Owner job id on /search?research=… */
	jobId?: string;
	/** Public share slug on /research/:slug */
	shareSlug?: string;
	n: number;
}

function sessionStorageOrNull(): Storage | null {
	if (typeof sessionStorage === "undefined") return null;
	return sessionStorage;
}

export function writeResearchPreviewVersion(
	ref: ResearchPreviewVersionRef,
	storage: Storage | null | undefined = sessionStorageOrNull(),
): void {
	if (!storage) return;
	const jobId = (ref.jobId || "").trim();
	const shareSlug = (ref.shareSlug || "").trim().toLowerCase();
	const n = Math.floor(Number(ref.n));
	if (!Number.isFinite(n) || n < 1) return;
	if (!jobId && !shareSlug) return;
	try {
		storage.setItem(
			RESEARCH_PREVIEW_VERSION_KEY,
			JSON.stringify({
				...(jobId ? { jobId } : {}),
				...(shareSlug ? { shareSlug } : {}),
				n,
			}),
		);
	} catch {
		/* quota / private mode */
	}
}

export function readResearchPreviewVersion(
	storage: Storage | null | undefined = sessionStorageOrNull(),
): ResearchPreviewVersionRef | null {
	if (!storage) return null;
	try {
		const raw = storage.getItem(RESEARCH_PREVIEW_VERSION_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		const n = Math.floor(Number(parsed.n));
		if (!Number.isFinite(n) || n < 1) return null;
		const jobId =
			typeof parsed.jobId === "string" ? parsed.jobId.trim() : "";
		const shareSlug =
			typeof parsed.shareSlug === "string"
				? parsed.shareSlug.trim().toLowerCase()
				: "";
		if (!jobId && !shareSlug) return null;
		return {
			...(jobId ? { jobId } : {}),
			...(shareSlug ? { shareSlug } : {}),
			n,
		};
	} catch {
		return null;
	}
}

export function clearResearchPreviewVersion(
	storage: Storage | null | undefined = sessionStorageOrNull(),
): void {
	if (!storage) return;
	try {
		storage.removeItem(RESEARCH_PREVIEW_VERSION_KEY);
	} catch {
		/* ignore */
	}
}

/** Append ?version=N when sharing a non-head preview. */
export function shareUrlWithVersion(
	path: string,
	version: number | null | undefined,
): string {
	const base = (path || "").trim();
	if (!base) return base;
	const n = Math.floor(Number(version));
	if (!Number.isFinite(n) || n < 1) return base;
	const url = new URL(base, "https://example.invalid");
	url.searchParams.set("version", String(n));
	return `${url.pathname}${url.search}`;
}
