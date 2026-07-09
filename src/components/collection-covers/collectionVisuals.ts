import type { CollectionBadge } from "../../data/collectionHome";

export type CollectionCoverItem = {
	slug: string;
	englishName: string;
	paliName: string;
	suffix: string;
	badge?: CollectionBadge;
	translatedCount: number;
	readableCount: number;
	total: number;
	/** Primary display count (readable when available). */
	count: number;
	/** Optional count of discourses with SVG illustrations in content-images. */
	illustratedCount?: number;
	/** True when ≥50% of published discourses have audio (listen indicator on cover). */
	hasListeningMode?: boolean;
	/** Listen-mode entry point when `hasListeningMode` is true. */
	listenHref?: string;
};

export type CollectionVisual = {
	abbrev: string;
	accent: string;
	accentMuted: string;
	/** Inline SVG string for emblem motifs. */
	emblemSvg: string;
};

const badgeLabel: Record<CollectionBadge, string> = {
	"new-translation": "New translation",
};

export function badgeText(badge?: CollectionBadge): string | undefined {
	return badge ? badgeLabel[badge] : undefined;
}

/** Per-collection accent palette and abbreviations for cover demos. */
export const collectionVisuals: Record<string, CollectionVisual> = {
	dhp: {
		abbrev: "Dhp",
		accent: "#c9a227",
		accentMuted: "color-mix(in srgb, #c9a227 18%, var(--surface-elevated))",
		emblemSvg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M24 6L8 14v20l16 8 16-8V14L24 6z" stroke="currentColor" stroke-width="1.5" opacity="0.7"/><path d="M24 14v20M8 14l16 8 16-8" stroke="currentColor" stroke-width="1.5" opacity="0.5"/></svg>`,
	},
	iti: {
		abbrev: "Iti",
		accent: "#7a9e6e",
		accentMuted: "color-mix(in srgb, #7a9e6e 18%, var(--surface-elevated))",
		emblemSvg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="24" cy="24" r="14" stroke="currentColor" stroke-width="1.5" opacity="0.7"/><path d="M18 24h12M24 18v12" stroke="currentColor" stroke-width="1.5" opacity="0.5"/></svg>`,
	},
	ud: {
		abbrev: "Ud",
		accent: "#6b8cae",
		accentMuted: "color-mix(in srgb, #6b8cae 18%, var(--surface-elevated))",
		emblemSvg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M24 8c-8 6-12 14-12 20a12 12 0 1024 0c0-6-4-14-12-20z" stroke="currentColor" stroke-width="1.5" opacity="0.7"/></svg>`,
	},
	dn: {
		abbrev: "DN",
		accent: "#8b5a6b",
		accentMuted: "color-mix(in srgb, #8b5a6b 18%, var(--surface-elevated))",
		emblemSvg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="10" y="8" width="28" height="32" rx="2" stroke="currentColor" stroke-width="1.5" opacity="0.7"/><path d="M16 16h16M16 24h16M16 32h10" stroke="currentColor" stroke-width="1.5" opacity="0.5"/></svg>`,
	},
	mn: {
		abbrev: "MN",
		accent: "#d47445",
		accentMuted: "color-mix(in srgb, #d47445 18%, var(--surface-elevated))",
		emblemSvg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 36V12l16-6 16 6v24l-16 6-16-6z" stroke="currentColor" stroke-width="1.5" opacity="0.7"/><path d="M24 6v36M8 12l16 6 16-6" stroke="currentColor" stroke-width="1.5" opacity="0.4"/></svg>`,
	},
	sn: {
		abbrev: "SN",
		accent: "#5c7a8a",
		accentMuted: "color-mix(in srgb, #5c7a8a 18%, var(--surface-elevated))",
		emblemSvg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="24" cy="24" r="6" stroke="currentColor" stroke-width="1.5"/><circle cx="24" cy="10" r="3" stroke="currentColor" stroke-width="1.2" opacity="0.6"/><circle cx="12" cy="32" r="3" stroke="currentColor" stroke-width="1.2" opacity="0.6"/><circle cx="36" cy="32" r="3" stroke="currentColor" stroke-width="1.2" opacity="0.6"/><path d="M24 16v4M20 28l3-4M28 28l-3-4" stroke="currentColor" stroke-width="1.2" opacity="0.5"/></svg>`,
	},
	an: {
		abbrev: "AN",
		accent: "#9a7b4f",
		accentMuted: "color-mix(in srgb, #9a7b4f 18%, var(--surface-elevated))",
		emblemSvg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 36V16l12-8 12 8v20" stroke="currentColor" stroke-width="1.5" opacity="0.7"/><path d="M18 28h4v8h-4zM26 22h4v14h-4zM34 16h4v20h-4z" fill="currentColor" opacity="0.35"/></svg>`,
	},
	snp: {
		abbrev: "Snp",
		accent: "#7d6b8a",
		accentMuted: "color-mix(in srgb, #7d6b8a 18%, var(--surface-elevated))",
		emblemSvg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M14 36c0-10 4-18 10-22 6 4 10 12 10 22" stroke="currentColor" stroke-width="1.5" opacity="0.7"/><path d="M18 20c2-4 6-6 6-6s4 2 6 6" stroke="currentColor" stroke-width="1.2" opacity="0.5"/></svg>`,
	},
	kp: {
		abbrev: "Kp",
		accent: "#6e8f7a",
		accentMuted: "color-mix(in srgb, #6e8f7a 18%, var(--surface-elevated))",
		emblemSvg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M24 10l4 8h9l-7 6 3 9-9-5-9 5 3-9-7-6h9l4-8z" stroke="currentColor" stroke-width="1.3" opacity="0.7"/></svg>`,
	},
};

const fallbackVisual: CollectionVisual = {
	abbrev: "—",
	accent: "var(--primary-color)",
	accentMuted: "color-mix(in srgb, var(--primary-color) 18%, var(--surface-elevated))",
	emblemSvg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="12" y="10" width="24" height="28" rx="2" stroke="currentColor" stroke-width="1.5"/></svg>`,
};

export function getCollectionVisual(slug: string): CollectionVisual {
	return collectionVisuals[slug] ?? fallbackVisual;
}

export function formatCount(n: number): string {
	return n.toLocaleString();
}

export function illustrationsLabel(count: number): string {
	return `with ${formatCount(count)} illustrations`;
}

export function listeningLabel(): string {
	return "Listen";
}
