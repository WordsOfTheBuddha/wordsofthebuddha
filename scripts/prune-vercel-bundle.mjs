#!/usr/bin/env node
/**
 * Trim traced-but-unused files from Vercel serverless bundles after `astro build`.
 * Vercel's NFT tracer is conservative: it includes optional deps (all sharp
 * platforms), dynamic-import language packs, and dev-only packages.
 */
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const RENDER_FUNC = join(ROOT, ".vercel/output/functions/_render.func");

/** Vercel Node.js functions run on Amazon Linux x64 (glibc). */
const SHARP_LINUX_X64 = new Set([
	"sharp-linux-x64",
	"sharp-libvips-linux-x64",
]);

function dirSizeBytes(dir) {
	if (!existsSync(dir)) return 0;
	let total = 0;
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		const st = statSync(path);
		if (st.isDirectory()) total += dirSizeBytes(path);
		else total += st.size;
	}
	return total;
}

function rmDir(path, label) {
	if (!existsSync(path)) return 0;
	const before = dirSizeBytes(path);
	rmSync(path, { recursive: true, force: true });
	console.log(`prune-vercel-bundle: removed ${label} (~${(before / 1024 / 1024).toFixed(1)} MB)`);
	return before;
}

function pruneRenderFunction() {
	if (!existsSync(RENDER_FUNC)) {
		console.log("prune-vercel-bundle: no _render.func output (skip)");
		return;
	}

	let saved = 0;
	const nm = join(RENDER_FUNC, "node_modules");

	// Full playwright must not ship in serverless (PDF uses playwright-core + Sparticuz).
	saved += rmDir(join(nm, "playwright"), "node_modules/playwright");

	// ms-dpd dynamically imports all language packs; site only uses English.
	for (const lang of ["ru", "de", "fr", "es", "pt"]) {
		saved += rmDir(
			join(nm, "@sc-voice", `ms-dpd-${lang}`),
			`node_modules/@sc-voice/ms-dpd-${lang}`,
		);
	}

	// sharp optional deps: keep glibc linux-x64 only.
	const imgDir = join(nm, "@img");
	if (existsSync(imgDir)) {
		for (const name of readdirSync(imgDir)) {
			if (SHARP_LINUX_X64.has(name)) continue;
			if (name.startsWith("sharp") || name.startsWith("sharp-libvips")) {
				saved += rmDir(join(imgDir, name), `node_modules/@img/${name}`);
			}
		}
	}

	const totalMb = saved / 1024 / 1024;
	const funcMb = dirSizeBytes(RENDER_FUNC) / 1024 / 1024;
	console.log(
		`prune-vercel-bundle: saved ~${totalMb.toFixed(1)} MB; _render.func now ~${funcMb.toFixed(1)} MB`,
	);
}

pruneRenderFunction();
