#!/usr/bin/env node
/**
 * Copy mermaid's browser builds into public/:
 * - ESM (`mermaid.esm.min.mjs` + chunks) so the production browser can load
 *   `/vendor/mermaid/mermaid.esm.min.mjs` as native ESM (via a concatenated
 *   dynamic specifier) without Vite rewriting mermaid's lazy diagram chunks
 *   (those 404 on the Vercel client build).
 * - UMD (`mermaid.min.js`) so server PDF/EPUB export can `addScriptTag` it
 *   into headless Chromium (researchReportMermaidServer.ts). The UMD file is
 *   shipped to serverless via the adapter's `includeFiles` — server code must
 *   reference `public/vendor/mermaid/…`, never `node_modules/mermaid`, so the
 *   file tracer cannot drag the ~140 MB package into the function.
 */
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	rmSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function mermaidVendorDest(root = ROOT) {
	return join(root, "public/vendor/mermaid");
}

export function copyMermaidVendor(root = ROOT) {
	const mermaidRoot = join(root, "node_modules/mermaid/dist");
	const entry = join(mermaidRoot, "mermaid.esm.min.mjs");
	const chunks = join(mermaidRoot, "chunks/mermaid.esm.min");
	const umd = join(mermaidRoot, "mermaid.min.js");
	if (!existsSync(entry) || !existsSync(chunks)) {
		throw new Error(
			"copy-mermaid-vendor: mermaid ESM build is missing (yarn add mermaid)",
		);
	}
	if (!existsSync(umd)) {
		throw new Error(
			"copy-mermaid-vendor: mermaid UMD build is missing (yarn add mermaid)",
		);
	}
	const dest = mermaidVendorDest(root);
	rmSync(dest, { recursive: true, force: true });
	mkdirSync(join(dest, "chunks/mermaid.esm.min"), { recursive: true });
	copyFileSync(entry, join(dest, "mermaid.esm.min.mjs"));
	copyFileSync(umd, join(dest, "mermaid.min.js"));
	for (const name of readdirSync(chunks)) {
		if (!name.endsWith(".mjs")) continue;
		copyFileSync(
			join(chunks, name),
			join(dest, "chunks/mermaid.esm.min", name),
		);
	}
}

export function mermaidVendorVitePlugin(root = ROOT) {
	return {
		name: "mermaid-vendor",
		buildStart() {
			copyMermaidVendor(root);
		},
		configureServer() {
			copyMermaidVendor(root);
		},
	};
}

const invoked =
	Boolean(process.argv[1]) &&
	fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invoked) copyMermaidVendor();
