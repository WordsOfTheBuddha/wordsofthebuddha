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
	"/src/assets/content-images/*.{webp,jpg,jpeg,png}",
	{ eager: true },
);

export interface ContentImageData {
	/** Resolved image metadata for Astro's Image component */
	image: ImageMetadata;
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
	// Normalize ID for file matching (lowercase, handle edge cases)
	const normalizedId = id.toLowerCase();
	const extensions = ["webp", "jpg", "jpeg", "png"];

	// 1. Check for custom path in frontmatter
	if (frontmatter?.image) {
		const customPath = frontmatter.image.startsWith("/")
			? frontmatter.image
			: `/src/assets/content-images/${frontmatter.image}`;

		if (imageModules[customPath]) {
			return {
				image: imageModules[customPath].default,
				caption: frontmatter.imageCaption,
				alt: `Illustration for ${title || id}`,
			};
		}
	}

	// 2. Try convention-based path: /src/assets/content-images/{id}.{ext}
	for (const ext of extensions) {
		const path = `/src/assets/content-images/${normalizedId}.${ext}`;
		if (imageModules[path]) {
			return {
				image: imageModules[path].default,
				caption: frontmatter?.imageCaption,
				alt: `Illustration for ${title || id}`,
			};
		}
	}

	return undefined;
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
		const customPath = frontmatter.image.startsWith("/")
			? frontmatter.image
			: `/src/assets/content-images/${frontmatter.image}`;
		if (imageModules[customPath]) return true;
	}

	// Check convention-based path
	const normalizedId = id.toLowerCase();
	const extensions = ["webp", "jpg", "jpeg", "png"];

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
