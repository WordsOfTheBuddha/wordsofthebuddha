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
		if (found) return found;
	}

	// 4) Final fallback: match by basename only (handles arbitrary relative paths)
	const basename = raw.split("/").pop();
	if (!basename) return undefined;
	return imageByBasenameLower.get(basename.toLowerCase());
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
export function findContentImages(
	id: string,
	frontmatter?: ContentImageFrontmatter,
	title?: string,
): ContentImageData[] {
	// Normalize ID for file matching (lowercase, handle edge cases)
	const normalizedId = id.toLowerCase();
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
		if (imageModules[path]) {
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
		if (path.toLowerCase().startsWith(prefix)) {
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
export function hasContentImage(
	id: string,
	frontmatter?: ContentImageFrontmatter,
): boolean {
	// Check custom path first
	if (frontmatter?.image) {
		if (resolveFrontmatterImage(frontmatter.image)) return true;
	}

	// Check convention-based path
	const normalizedId = id.toLowerCase();
	const extensions = ["webp", "jpg", "jpeg", "png", "svg"];

	for (const ext of extensions) {
		const path = `/src/assets/content-images/${normalizedId}.${ext}`;
		if (imageModules[path]) {
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
		// Extract ID from path: /src/assets/content-images/an3.65.webp -> an3.65
		const match = path.match(/\/content-images\/([^.]+)\./);
		if (match) {
			ids.push(match[1]);
		}
	}

	return [...new Set(ids)]; // Dedupe in case multiple formats exist
}
