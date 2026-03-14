/**
 * Analyse an SVG string to find Y-coordinates where it is safe to slice
 * the image for print pagination — i.e. gaps between visual content regions
 * where no text, shapes or lines are drawn.
 *
 * Returns an array of Y values (in viewBox units) suitable for use as
 * viewBox split boundaries.  The array always starts with the viewBox
 * origin and ends with the viewBox bottom, so callers can simply iterate
 * consecutive pairs to build strips.
 *
 * Works purely with regex on the SVG source — no DOM required — so it can
 * run at build time (Astro component) or on the server (PDF renderer).
 */

interface Extent {
	top: number;
	bottom: number;
}

/** Pad above text to avoid clipping ascenders. */
const TEXT_PAD_ABOVE = 18;
const TEXT_PAD_BELOW = 4;
const SHAPE_PAD = 2;

/**
 * Minimum gap size (viewBox units) to consider as a safe cut zone.
 * Lines and thin separators are ignored entirely (OK to cut through),
 * so only genuine spacing between blocks needs to meet this threshold.
 */
const MIN_GAP = 4;

export function findSvgSafeCuts(svgSource: string): number[] | null {
	// --- Extract viewBox ---
	const vbMatch = svgSource.match(/viewBox="([\d.\s,]+)"/i);
	if (!vbMatch) return null;
	const [vbX, vbY, vbW, vbH] = vbMatch[1].split(/[\s,]+/).map(Number);
	if (!vbW || !vbH) return null;

	const extents: Extent[] = [];

	// Helper: resolve a Y offset inside a <g transform="translate(x,y)"> block.
	// We process top-level transformed groups separately.
	const addExtent = (top: number, bottom: number) => {
		extents.push({ top: Math.min(top, bottom), bottom: Math.max(top, bottom) });
	};

	// --- 1. <text y="Y"> (with optional font-size) ---
	for (const m of svgSource.matchAll(/<text[^>]*?\by="([0-9.]+)"[^>]*/gi)) {
		const y = parseFloat(m[1]);
		// Try to read font-size for better extent estimation
		const fsMatch = m[0].match(/font-size="([0-9.]+)/);
		const fs = fsMatch ? parseFloat(fsMatch[1]) : 16;
		addExtent(y - fs - 2, y + TEXT_PAD_BELOW);
	}

	// --- 2. <rect y="Y" height="H"> (order-independent) ---
	for (const m of svgSource.matchAll(/<rect\b([^>]*?)>/gi)) {
		const attrs = m[1];
		const yM = attrs.match(/\by="([0-9.]+)"/);
		const hM = attrs.match(/\bheight="([0-9.]+)"/);
		if (yM && hM) {
			const y = parseFloat(yM[1]);
			const h = parseFloat(hM[1]);
			// Skip full-background rect or low-opacity decorative wash
			if (h >= vbH - 1) continue;
			const opM = attrs.match(/\bopacity="([0-9.]+)"/);
			if (opM && parseFloat(opM[1]) <= 0.1) continue;
			addExtent(y - SHAPE_PAD, y + h + SHAPE_PAD);
		}
	}

	// --- 3. <circle cy="CY" r="R"> ---
	for (const m of svgSource.matchAll(/<circle\b([^>]*?)>/gi)) {
		const attrs = m[1];
		const cyM = attrs.match(/\bcy="([0-9.]+)"/);
		const rM = attrs.match(/\br="([0-9.]+)"/);
		if (cyM && rM) {
			// Skip low-opacity decorative circles (background glow/wash effects)
			const opM = attrs.match(/\bopacity="([0-9.]+)"/);
			if (opM && parseFloat(opM[1]) <= 0.1) continue;
			const cy = parseFloat(cyM[1]);
			const r = parseFloat(rM[1]);
			addExtent(cy - r - SHAPE_PAD, cy + r + SHAPE_PAD);
		}
	}

	// --- 5. <ellipse cy="CY" ry="RY"> ---
	for (const m of svgSource.matchAll(/<ellipse\b([^>]*?)>/gi)) {
		const attrs = m[1];
		const cyM = attrs.match(/\bcy="([0-9.]+)"/);
		const ryM = attrs.match(/\bry="([0-9.]+)"/);
		if (cyM && ryM) {
			// Skip low-opacity decorative ellipses (background wash effects)
			const opM = attrs.match(/\bopacity="([0-9.]+)"/);
			if (opM && parseFloat(opM[1]) <= 0.1) continue;
			const cy = parseFloat(cyM[1]);
			const ry = parseFloat(ryM[1]);
			addExtent(cy - ry - SHAPE_PAD, cy + ry + SHAPE_PAD);
		}
	}

	// --- 6. <g transform="translate(X, Y)"> blocks ---
	// Lines and paths inside groups are also ignored (OK to cut through).
	const gBlockRe = /<g\s[^>]*?transform="translate\(\s*[0-9.]+\s*,\s*([0-9.]+)\s*\)"[^>]*>([\s\S]*?)<\/g>/gi;
	for (const gm of svgSource.matchAll(gBlockRe)) {
		const ty = parseFloat(gm[1]);
		const inner = gm[2];

		let hasChildren = false;

		for (const cm of inner.matchAll(/<text[^>]*?\by="(-?[0-9.]+)"[^>]*/gi)) {
			const y = ty + parseFloat(cm[1]);
			const fsMatch = cm[0].match(/font-size="([0-9.]+)/);
			const fs = fsMatch ? parseFloat(fsMatch[1]) : 16;
			addExtent(y - fs - 2, y + TEXT_PAD_BELOW);
			hasChildren = true;
		}
		for (const cm of inner.matchAll(/<circle\b([^>]*?)>/gi)) {
			const cyM = cm[1].match(/\bcy="(-?[0-9.]+)"/);
			const rM = cm[1].match(/\br="([0-9.]+)"/);
			if (cyM && rM) {
				const cy = ty + parseFloat(cyM[1]);
				const r = parseFloat(rM[1]);
				addExtent(cy - r - SHAPE_PAD, cy + r + SHAPE_PAD);
				hasChildren = true;
			}
		}
		for (const cm of inner.matchAll(/<rect\b([^>]*?)>/gi)) {
			const yM = cm[1].match(/\by="(-?[0-9.]+)"/);
			const hM = cm[1].match(/\bheight="([0-9.]+)"/);
			if (yM && hM) {
				addExtent(ty + parseFloat(yM[1]) - SHAPE_PAD, ty + parseFloat(yM[1]) + parseFloat(hM[1]) + SHAPE_PAD);
				hasChildren = true;
			}
		}
		// Lines and paths inside groups: skip (OK to cut through)

		// Fallback: if we couldn't parse children, be conservative
		if (!hasChildren) {
			addExtent(ty - 40, ty + 40);
		}
	}

	// --- 7. Top-level <path> elements: skip ---
	// Paths are decorative curves/shapes; it is acceptable to cut through them.

	if (extents.length === 0) return null;

	// --- Merge overlapping extents ---
	extents.sort((a, b) => a.top - b.top);
	const merged: Extent[] = [{ ...extents[0] }];
	for (let i = 1; i < extents.length; i++) {
		const last = merged[merged.length - 1];
		if (extents[i].top <= last.bottom + MIN_GAP) {
			last.bottom = Math.max(last.bottom, extents[i].bottom);
		} else {
			merged.push({ ...extents[i] });
		}
	}

	// --- Build cut positions ---
	// Start with viewBox origin, add midpoints of each gap, end with viewBox bottom.
	const cuts: number[] = [vbY];

	for (let i = 0; i < merged.length - 1; i++) {
		const gapTop = merged[i].bottom;
		const gapBottom = merged[i + 1].top;
		if (gapBottom - gapTop >= MIN_GAP) {
			// Cut at the midpoint of the gap
			cuts.push(Math.round((gapTop + gapBottom) / 2));
		}
	}

	cuts.push(vbY + vbH);

	return cuts;
}

/**
 * Convert safe-cut Y positions into strip definitions { y, h } for
 * viewBox slicing, given the viewBox parameters.
 */
export function cutsToSlices(
	cuts: number[],
): { y: number; h: number }[] {
	const slices: { y: number; h: number }[] = [];
	for (let i = 0; i < cuts.length - 1; i++) {
		slices.push({ y: cuts[i], h: cuts[i + 1] - cuts[i] });
	}
	return slices;
}
