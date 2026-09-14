#!/usr/bin/env node
/**
 * Copies src/assets/content-images to public/content-images so images
 * are available at clean permalink URLs: /content-images/{filename}
 *
 * Usage:
 *   node copyContentImages.mjs          # Copy once
 *   node copyContentImages.mjs --watch  # Watch for changes and copy
 *
 * Also exported as a Vite plugin so `astro dev` (including the pm2
 * astro-dev process) keeps public/ in sync without `yarn predev`.
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const src = join(process.cwd(), "src/assets/content-images");
const dest = join(process.cwd(), "public/content-images");

const srcResolved = resolve(src);

export function copyContentImages() {
	if (existsSync(src)) {
		mkdirSync(dest, { recursive: true });
		cpSync(src, dest, { recursive: true });
		console.log(`[${new Date().toLocaleTimeString()}] Copied content images to public/`);
	}
}

function isContentImageSrcPath(file) {
	const resolved = resolve(file);
	const rel = relative(srcResolved, resolved);
	return rel === "" || (!rel.startsWith(`..${sep}`) && !rel.startsWith(".."));
}

export function contentImagesVitePlugin() {
	let debounceTimeout;
	const scheduleCopy = (filename) => {
		clearTimeout(debounceTimeout);
		debounceTimeout = setTimeout(() => {
			if (filename) {
				console.log(
					`[${new Date().toLocaleTimeString()}] Detected change: ${filename}`,
				);
			}
			copyContentImages();
		}, 300);
	};

	return {
		name: "copy-content-images",
		buildStart() {
			copyContentImages();
		},
		configureServer(server) {
			copyContentImages();
			server.watcher.add(src);
			const onFsEvent = (file) => {
				if (!isContentImageSrcPath(file)) return;
				scheduleCopy(relative(srcResolved, resolve(file)));
			};
			server.watcher.on("change", onFsEvent);
			server.watcher.on("add", onFsEvent);
			server.watcher.on("unlink", onFsEvent);
		},
	};
}

const invoked =
	Boolean(process.argv[1]) &&
	fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (invoked) {
	copyContentImages();

	if (process.argv.includes("--watch")) {
		console.log(`Watching ${src} for changes...`);
		const { default: chokidar } = await import("chokidar");
		let debounceTimeout;
		const watcher = chokidar.watch(src, {
			ignoreInitial: true,
			awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
		});
		const onFsEvent = (filename) => {
			clearTimeout(debounceTimeout);
			debounceTimeout = setTimeout(() => {
				console.log(`[${new Date().toLocaleTimeString()}] Detected change: ${filename}`);
				copyContentImages();
			}, 300);
		};
		watcher.on("add", onFsEvent);
		watcher.on("change", onFsEvent);
		watcher.on("unlink", onFsEvent);
	}
}
