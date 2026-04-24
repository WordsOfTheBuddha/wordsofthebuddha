#!/usr/bin/env node
/**
 * Generate src/data/audioStatus.ts — same contract as generate_audio_status.py.
 *
 * `audioSlugs` is treated as a **whitelist hint**, never a blacklist:
 *   - Slugs in the set definitely have audio (badge + Listen pre-link).
 *   - Slugs *not* in the set may still have audio added later — the reading
 *     page should show the Listen trigger optimistically (the runtime fetch
 *     is the final source of truth).
 *
 * Single source rule (no unions):
 *   - If `PUBLIC_AUDIO_BASE_URL` is set, the runtime fetches audio from that
 *     origin (R2 in production). The build status MUST reflect that origin.
 *     We try Node S3 first (R2 creds present), then `python --from-r2`.
 *   - Otherwise, audio is served from local `public/audio/`. The build status
 *     reflects the local filesystem only.
 * Mixing the two would lie to readers (a page with a manifest only on disk
 * but not on R2 would 404 in production, and vice-versa).
 *
 * On fatal error, writes an empty Set so Astro can always import ../data/audioStatus.
 *
 * Usage: node scripts/generate-audio-status.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const AUDIO_DIR = path.join(REPO_ROOT, "public", "audio");
const OUT = path.join(REPO_ROOT, "src", "data", "audioStatus.ts");

function isRemoteSource() {
	const url = process.env.PUBLIC_AUDIO_BASE_URL;
	return Boolean(url && url.trim().length > 0);
}

function hasR2NodeCreds() {
	return Boolean(
		process.env.R2_ACCOUNT_ID &&
			process.env.R2_ACCESS_KEY_ID &&
			process.env.R2_SECRET_ACCESS_KEY,
	);
}

/** Same key rules as scripts/generate_audio_status.py slugs_from_r2 (bucket root only). */
async function slugsFromR2Node() {
	const { S3Client, ListObjectsV2Command } = await import("@aws-sdk/client-s3");
	const accountId = process.env.R2_ACCOUNT_ID;
	const accessKeyId = process.env.R2_ACCESS_KEY_ID;
	const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
	const client = new S3Client({
		region: "auto",
		endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
		credentials: { accessKeyId, secretAccessKey },
	});
	const bucket = process.env.R2_BUCKET || "dhamma-audio";
	const opus = new Set();
	const manifests = new Set();
	let continuationToken;
	do {
		const out = await client.send(
			new ListObjectsV2Command({
				Bucket: bucket,
				ContinuationToken: continuationToken,
			}),
		);
		for (const obj of out.Contents || []) {
			const key = obj.Key;
			if (!key || key.includes("/")) continue;
			if (key.endsWith(".webm")) opus.add(key.slice(0, -".webm".length));
			else if (key.endsWith(".manifest.json")) {
				manifests.add(key.slice(0, -".manifest.json".length));
			}
		}
		continuationToken = out.IsTruncated ? out.NextContinuationToken : undefined;
	} while (continuationToken);
	return [...opus].filter((s) => manifests.has(s)).sort();
}

/**
 * After Python --from-r2, ensure output exists and is parseable (spawn can exit 0
 * while leaving a partial or missing file).
 */
function isValidAudioStatusOutput() {
	if (!fs.existsSync(OUT)) return false;
	const s = fs.readFileSync(OUT, "utf8");
	if (s.length < 60) return false;
	if (!s.includes("export const audioSlugs")) return false;
	if (!/ReadonlySet<string>\s*=\s*new Set\(/.test(s)) return false;
	const m = s.match(/new Set\((\[[\s\S]*\])\)\s*;?\s*$/);
	if (!m) return false;
	try {
		const arr = JSON.parse(m[1]);
		return Array.isArray(arr) && arr.every((x) => typeof x === "string");
	} catch {
		return false;
	}
}

function tryPythonFromR2() {
	const py = path.join(REPO_ROOT, ".venv-voice", "bin", "python");
	if (!fs.existsSync(py)) return false;
	if (!process.env.R2_ACCOUNT_ID) return false;
	const script = path.join(REPO_ROOT, "scripts", "generate_audio_status.py");
	const r = spawnSync(py, [script, "--from-r2"], {
		cwd: REPO_ROOT,
		stdio: "inherit",
		env: process.env,
	});
	if (r.status !== 0) {
		if (r.error) {
			console.warn("generate-audio-status: Python spawn error:", r.error.message || r.error);
		}
		return false;
	}
	if (!isValidAudioStatusOutput()) {
		console.warn(
			"generate-audio-status: Python --from-r2 exited 0 but audioStatus.ts is missing or invalid.",
		);
		return false;
	}
	return true;
}

function slugsFromLocal() {
	if (!fs.existsSync(AUDIO_DIR)) return [];
	const opus = new Set();
	for (const f of fs.readdirSync(AUDIO_DIR)) {
		if (f.endsWith(".webm")) opus.add(path.basename(f, ".webm"));
	}
	const manifests = new Set();
	for (const f of fs.readdirSync(AUDIO_DIR)) {
		if (!f.endsWith(".manifest.json")) continue;
		const slug = f.slice(0, -".manifest.json".length);
		try {
			const raw = fs.readFileSync(path.join(AUDIO_DIR, f), "utf8");
			const data = JSON.parse(raw);
			if (
				typeof data.version === "number" &&
				Array.isArray(data.paragraphs) &&
				data.paragraphs.length > 0
			) {
				manifests.add(slug);
			}
		} catch {
			/* skip invalid */
		}
	}
	return [...opus].filter((s) => manifests.has(s)).sort();
}

function writeStatus(slugs) {
	const rel = path.relative(REPO_ROOT, OUT);
	const content =
		"// Auto-generated by scripts/generate-audio-status.mjs — do not edit\n" +
		`export const audioSlugs: ReadonlySet<string> = new Set(${JSON.stringify(slugs)});\n`;
	fs.mkdirSync(path.dirname(OUT), { recursive: true });
	fs.writeFileSync(OUT, content, "utf8");
	console.log(`✅ ${rel}: ${slugs.length} discourse(s)`);
}

async function main() {
	if (isRemoteSource()) {
		// Production / preview: PUBLIC_AUDIO_BASE_URL is set — runtime fetches
		// from R2. Reflect R2 contents only.
		if (hasR2NodeCreds()) {
			try {
				const r2Slugs = await slugsFromR2Node();
				writeStatus(r2Slugs);
				return;
			} catch (err) {
				console.warn("generate-audio-status: R2 list (Node) failed:", err?.message || err);
				if (tryPythonFromR2()) return;
				throw err;
			}
		}
		if (tryPythonFromR2()) return;
		console.warn(
			"generate-audio-status: PUBLIC_AUDIO_BASE_URL is set but no R2 creds — writing empty whitelist (runtime fetch is the fallback).",
		);
		writeStatus([]);
		return;
	}

	// Dev / local: serve from public/audio. Reflect local filesystem only.
	writeStatus(slugsFromLocal());
}

try {
	await main();
} catch (err) {
	console.error("generate-audio-status: fatal:", err?.stack || err?.message || err);
	try {
		writeStatus([]);
		console.warn(
			"generate-audio-status: wrote empty audioSlugs fallback so imports (Layout, PostCard) resolve.",
		);
	} catch (writeErr) {
		console.error("generate-audio-status: could not write fallback:", writeErr);
		process.exitCode = 1;
	}
}
