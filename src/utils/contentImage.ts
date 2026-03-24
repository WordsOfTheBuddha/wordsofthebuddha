/**
 * Content Image Utilities
 *
 * Handles discovery and resolution of discourse header images.
 * Images are stored in src/assets/content-images/ with convention-based naming.
 *
 * Naming convention: {discourse-id}.{webp|jpg|jpeg|png}
 * Example: an3.65.webp, sn56.11.jpg
 *
 * Frontmatter can override with:
 * - image: custom filename (e.g., "custom-name.webp") or full path
 * - imageCaption: caption with optional credit (e.g., "A lotus · Generated with ChatGPT")
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { determineRouteType } from "./routeHandler";

/** True if the asset file exists under the project root (modulePath is e.g. /src/assets/...). */
function assetFileExists(modulePath: string): boolean {
	try {
		const relative = modulePath.startsWith("/") ? modulePath.slice(1) : modulePath;
		return existsSync(resolve(process.cwd(), relative));
	} catch {
		return false;
	}
}

// Import all images from content-images directory at build time
const imageModules = import.meta.glob<{ default: ImageMetadata }>(
	"/src/assets/content-images/*.{webp,jpg,jpeg,png,svg}",
	{ eager: true },
);

// Build case-insensitive indices so frontmatter overrides work reliably
// across filesystems (macOS can be case-insensitive; Vercel/Linux is not)
type ResolvedImage = { image: ImageMetadata; modulePath: string };

const imageByPathLower = new Map<string, ResolvedImage>();
const imageByBasenameLower = new Map<string, ResolvedImage>();

for (const [path, mod] of Object.entries(imageModules)) {
	// Skip entries whose file was removed/renamed while Vite’s glob cache is stale (avoids ImageNotFound in dev).
	if (!assetFileExists(path)) continue;
	const metadata = mod.default;
	imageByPathLower.set(path.toLowerCase(), {
		image: metadata,
		modulePath: path,
	});
	const basename = path.split("/").pop();
	if (basename)
		imageByBasenameLower.set(basename.toLowerCase(), {
			image: metadata,
			modulePath: path,
		});
}

function resolveFrontmatterImage(
	frontmatterImage: string,
): ResolvedImage | undefined {
	const raw = frontmatterImage.trim();
	if (!raw) return undefined;

	const candidates: string[] = [];

	// 1) If they provided an absolute module path (e.g. /src/assets/content-images/foo.webp)
	if (raw.startsWith("/")) {
		candidates.push(raw);
	}

	// 2) If they provided a filename (e.g. foo.webp)
	candidates.push(`/src/assets/content-images/${raw}`);

	// 3) If they provided a relative path that includes content-images (e.g. ../assets/content-images/foo.webp)
	const contentImagesIndex = raw.toLowerCase().lastIndexOf("content-images/");
	if (contentImagesIndex !== -1) {
		const tail = raw.slice(contentImagesIndex); // keep original casing for now
		candidates.push(`/src/assets/${tail}`);
	}

	for (const candidate of candidates) {
		const found = imageByPathLower.get(candidate.toLowerCase());
		if (found && assetFileExists(found.modulePath)) return found;
	}

	// 4) Final fallback: match by basename only (handles arbitrary relative paths)
	const basename = raw.split("/").pop();
	if (!basename) return undefined;
	const byBase = imageByBasenameLower.get(basename.toLowerCase());
	if (byBase && assetFileExists(byBase.modulePath)) return byBase;
	return undefined;
}

export interface ContentImageData {
	/** Resolved image metadata for Astro's Image component */
	image: ImageMetadata;
	/** Module path used for resolution, e.g. /src/assets/content-images/foo.jpg */
	modulePath: string;
	/** Optional caption (may include credit, e.g., "Description · Credit") */
	caption?: string;
	/** Alt text for accessibility */
	alt: string;
}

export interface ContentImageFrontmatter {
	/** Custom image filename or path (overrides convention-based lookup) */
	image?: string;
	/** Caption with optional credit, e.g., "A lotus flower · Generated with ChatGPT" */
	imageCaption?: string;
}

/**
 * Finds a content image for a discourse by ID.
 * Priority: frontmatter.image > convention-based path (src/assets/content-images/{id}.{ext})
 *
 * @param id - Discourse ID (e.g., "an3.65", "sn56.11")
 * @param frontmatter - Optional frontmatter data with image overrides
 * @param title - Discourse title for default alt text
 * @returns ContentImageData if image found, undefined otherwise
 */
export function findContentImage(
	id: string,
	frontmatter?: ContentImageFrontmatter,
	title?: string,
): ContentImageData | undefined {
	const images = findContentImages(id, frontmatter, title);
	return images.length > 0 ? images[0] : undefined;
}

/**
 * Finds all content images for a discourse by ID.
 * Supports comma-separated values in frontmatter.image (e.g., "img1.svg, img2.svg").
 * Falls back to convention-based discovery for all files matching {id}*.{ext}.
 *
 * @param id - Discourse ID (e.g., "an3.65", "sn56.11")
 * @param frontmatter - Optional frontmatter data with image overrides
 * @param title - Discourse title for default alt text
 * @returns Array of ContentImageData (may be empty)
 */
/** e.g. `en/sn/sn36.6` or `sn/sn36.6` → `sn36.6` for asset file names */
export function normalizeDiscourseIdForContentImages(id: string): string {
	const t = id.trim().toLowerCase();
	if (!t.includes("/")) return t;
	return t.split("/").filter(Boolean).pop() ?? t;
}

/** Lowercased SVG basenames (no extension) from src/assets/content-images */
const svgBasenamesLower: string[] = (() => {
	const out: string[] = [];
	for (const path of Object.keys(imageModules)) {
		if (!path.toLowerCase().endsWith(".svg")) continue;
		const base =
			path.split("/").pop()?.replace(/\.svg$/i, "").toLowerCase() ?? "";
		if (base) out.push(base);
	}
	return out;
})();

/**
 * True if `basenameNoExt` (e.g. mn118-alt, sn36.6) belongs to this discourse id
 * (mn118, sn36.6). Avoids sn36.6 matching sn36.66 (next char must be delimiter or end).
 */
export function discourseSvgBasenameMatchesDiscourseId(
	basenameNoExtLower: string,
	discourseId: string,
): boolean {
	const fn = basenameNoExtLower;
	const d = normalizeDiscourseIdForContentImages(discourseId);
	if (fn === d) return true;
	if (!fn.startsWith(d)) return false;
	if (fn.length === d.length) return true;
	const next = fn[d.length];
	return next === "-" || next === "_" || next === ".";
}

/** Any SVG in content-images whose basename matches the discourse id (prefix-safe). */
export function discourseHasSvgAssetForExport(discourseId: string): boolean {
	for (const fn of svgBasenamesLower) {
		if (discourseSvgBasenameMatchesDiscourseId(fn, discourseId)) return true;
	}
	return false;
}

/**
 * True if basename looks like a discourse file for a top-level collection root
 * (e.g. root `sn` → sn36.6, sn56.11, sn36-alt; root `mn` → mn118).
 */
function svgBasenameLooksLikeDiscourseInRoot(fn: string, root: string): boolean {
	const f = fn.toLowerCase();
	const r = root.toLowerCase();
	if (!f.startsWith(r)) return false;
	const tail = f.slice(r.length);
	// Plain chapter number (mn118), dotted sutta id (sn36.6), or hyphen suffix (sn36-alt)
	return (
		/^\d+$/.test(tail) ||
		/^\d+\./.test(tail) ||
		/^\d+[-_]/.test(tail)
	);
}

/**
 * When MDX entry lists are empty at build time, detect whether this collection’s export
 * scope could include any discourse SVG. Preview chapters are often range keys (sn35-44),
 * not leaf keys (sn36), so entry-based checks alone miss sn36.6.svg for /sn.
 */
export function collectionHasSvgVizAssetByRootPrefix(
	collectionSlug: string,
): boolean {
	const route = determineRouteType(collectionSlug);
	if (route.type !== "collection" || !route.metadata) return false;
	const root = collectionSlug.toLowerCase().split(/[-/]/)[0];
	if (!/^[a-z]{1,8}$/.test(root)) return false;
	for (const fn of svgBasenamesLower) {
		if (svgBasenameLooksLikeDiscourseInRoot(fn, root)) return true;
	}
	return false;
}

export function findContentImages(
	id: string,
	frontmatter?: ContentImageFrontmatter,
	title?: string,
): ContentImageData[] {
	// Normalize ID for file matching (lowercase, path-shaped slugs from content collections)
	const normalizedId = normalizeDiscourseIdForContentImages(id);
	const extensions = ["webp", "jpg", "jpeg", "png", "svg"];

	// 1. Check for custom path(s) in frontmatter — comma-separated support
	if (frontmatter?.image) {
		const imageNames = frontmatter.image.split(",").map((s) => s.trim()).filter(Boolean);
		const results: ContentImageData[] = [];

		for (const imageName of imageNames) {
			const resolved = resolveFrontmatterImage(imageName);
			if (resolved) {
				results.push({
					image: resolved.image,
					modulePath: resolved.modulePath,
					caption: frontmatter.imageCaption,
					alt: `Illustration for ${title || id}`,
				});
			}
		}

		if (results.length > 0) return results;
	}

	// 2. Try convention-based path: /src/assets/content-images/{id}.{ext}
	//    Also discover additional images matching {id}-*.{ext}
	const results: ContentImageData[] = [];

	// Primary image: exact ID match
	for (const ext of extensions) {
		const path = `/src/assets/content-images/${normalizedId}.${ext}`;
		if (imageModules[path] && assetFileExists(path)) {
			results.push({
				image: imageModules[path].default,
				modulePath: path,
				caption: frontmatter?.imageCaption,
				alt: `Illustration for ${title || id}`,
			});
			break; // Only one primary image per extension priority
		}
	}

	// Additional images: {id}-*.{ext} (e.g., an10.61-vijjavimutti.svg)
	const prefix = `/src/assets/content-images/${normalizedId}-`;
	for (const [path, mod] of Object.entries(imageModules)) {
		if (!path.toLowerCase().startsWith(prefix) || !assetFileExists(path)) continue;
		// Avoid duplicates
		if (!results.some((r) => r.modulePath === path)) {
			results.push({
				image: mod.default,
				modulePath: path,
				caption: frontmatter?.imageCaption,
				alt: `Illustration for ${title || id}`,
			});
		}
	}

	return results;
}

/**
 * Check if a discourse has a content image available.
 * Useful for conditional rendering of image toggle.
 *
 * @param id - Discourse ID
 * @param frontmatter - Optional frontmatter with custom image path
 * @returns true if image exists
 */
/**
 * True if the discourse has at least one SVG in the PDF/site “discourse viz” pipeline
 * (same discovery rules as {@link findContentImages}).
 */
export function discourseHasSvgViz(
	id: string,
	frontmatter?: ContentImageFrontmatter,
	title?: string,
): boolean {
	const images = findContentImages(id, frontmatter, title);
	return images.some((img) =>
		img.modulePath.toLowerCase().endsWith(".svg"),
	);
}

export function hasContentImage(
	id: string,
	frontmatter?: ContentImageFrontmatter,
): boolean {
	// Check custom path first
	if (frontmatter?.image) {
		if (resolveFrontmatterImage(frontmatter.image)) return true;
	}

	// Check convention-based path
	const normalizedId = normalizeDiscourseIdForContentImages(id);
	const extensions = ["webp", "jpg", "jpeg", "png", "svg"];

	for (const ext of extensions) {
		const path = `/src/assets/content-images/${normalizedId}.${ext}`;
		if (imageModules[path] && assetFileExists(path)) {
			return true;
		}
	}

	return false;
}

/**
 * Get all available content image IDs.
 * Useful for debugging or generating image inventory.
 */
export function getAllContentImageIds(): string[] {
	const ids: string[] = [];

	for (const path of Object.keys(imageModules)) {
		if (!assetFileExists(path)) continue;
		// Extract ID from path: /src/assets/content-images/an3.65.webp -> an3.65
		const match = path.match(/\/content-images\/([^.]+)\./);
		if (match) {
			ids.push(match[1]);
		}
	}

	return [...new Set(ids)]; // Dedupe in case multiple formats exist
}
