#!/usr/bin/env node
/**
 * Copies src/assets/content-images to public/content-images so images
 * are available at clean permalink URLs: /content-images/{filename}
 *
 * Usage:
 *   node copyContentImages.mjs          # Copy once
 *   node copyContentImages.mjs --watch  # Watch for changes and copy
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { watch } from "node:fs";
import { join } from "node:path";

const src = join(process.cwd(), "src/assets/content-images");
const dest = join(process.cwd(), "public/content-images");

const isWatchMode = process.argv.includes("--watch");

function copy() {
	if (existsSync(src)) {
		mkdirSync(dest, { recursive: true });
		cpSync(src, dest, { recursive: true });
		console.log(`[${new Date().toLocaleTimeString()}] Copied content images to public/`);
	}
}

// Initial copy
copy();

// Watch mode
if (isWatchMode) {
	console.log(`Watching ${src} for changes...`);
	let debounceTimeout;

	watch(
		src,
		{ recursive: true },
		(eventType, filename) => {
			clearTimeout(debounceTimeout);
			// Debounce rapid changes (e.g., multiple file writes)
			debounceTimeout = setTimeout(() => {
				console.log(`[${new Date().toLocaleTimeString()}] Detected change: ${filename}`);
				copy();
			}, 300);
		}
	);

	// Keep process alive
	process.stdin.resume();
}
