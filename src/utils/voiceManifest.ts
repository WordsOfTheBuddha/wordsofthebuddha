/**
 * Voice manifest loader (build artefact: per-discourse `.manifest.json` + `.webm`).
 *
 * Originally part of the in-page voice-mode bar (removed). The listen-mode
 * client still needs the manifest to drive playback, MediaSession metadata,
 * and paragraph-level highlighting, so the loader + types live here.
 */

export type VoiceWord = { w: string; s: number; e: number };
export type VoiceParagraph = {
	id: number;
	start: number;
	end: number;
	words: VoiceWord[];
	/** Backfill (metadataSchemaVersion >= 2): true when the paragraph is verse-shaped. */
	isVerse?: boolean;
	/** Backfill (metadataSchemaVersion >= 2, verse paragraphs only): per-line word counts. */
	lineSizes?: number[];
};
export type VoiceManifest = {
	version: number;
	textHash: string;
	audioHash?: string | null;
	voice: string;
	generatedAt: string | null;
	duration: number | null;
	paragraphs: VoiceParagraph[];
	/** Optional, additive (Phase 1). Populated by future regenerations of generate_voice.py. */
	slug?: string;
	title?: string;
	description?: string;
	displayId?: string;
	metadataSchemaVersion?: number;
};

function isValidVoiceManifest(v: unknown): v is VoiceManifest {
	if (!v || typeof v !== "object") return false;
	const m = v as Record<string, unknown>;
	if (typeof m.version !== "number") return false;
	if (!Array.isArray(m.paragraphs) || m.paragraphs.length === 0) return false;
	return true;
}

/** Base URL for `{base}.manifest.json` and `{base}.webm` (no file suffix). */
function voiceAudioBase(discourseId: string): string {
	const audioRoot = import.meta.env.PUBLIC_AUDIO_BASE_URL as string | undefined;
	return audioRoot
		? `${audioRoot.replace(/\/$/, "")}/${encodeURIComponent(discourseId)}`
		: `/audio/${encodeURIComponent(discourseId)}`;
}

/** Ensure the audio file exists (manifest alone is not enough). */
async function audioAssetExists(url: string): Promise<boolean> {
	let res = await fetch(url, { method: "HEAD" });
	if (res.ok) return true;
	if (res.status === 405) {
		// Some CDNs reject HEAD; fall back to a 1-byte ranged GET.
		res = await fetch(url, { headers: { Range: "bytes=0-0" } });
		return res.ok || res.status === 206;
	}
	return false;
}

/**
 * Single GET manifest + validate + HEAD .webm. Deduplicates concurrent callers.
 */
const voiceManifestLoadBySlug = new Map<string, Promise<VoiceManifest | null>>();

export function loadVoiceManifestForDiscourse(
	discourseId: string,
): Promise<VoiceManifest | null> {
	const hit = voiceManifestLoadBySlug.get(discourseId);
	if (hit) return hit;
	const base = voiceAudioBase(discourseId);
	const p = (async (): Promise<VoiceManifest | null> => {
		try {
			// Default cache: manifest path is stable per slug; .webm uses ?h= cache bust.
			const res = await fetch(`${base}.manifest.json`);
			if (!res.ok) return null;
			const data: unknown = await res.json();
			if (!isValidVoiceManifest(data)) return null;
			const audioUrl = `${base}.webm`;
			if (!(await audioAssetExists(audioUrl))) return null;
			return data;
		} catch {
			return null;
		}
	})();
	voiceManifestLoadBySlug.set(discourseId, p);
	return p;
}
