/**
 * Listen mode shared helpers.
 *
 * Listen mode is a dedicated audio-first surface (`/listen/[discourse]`) for
 * hands-free queue playback. It coexists with reading mode without touching it.
 */

import { routes } from "./routes";
import { audioSlugs } from "../data/audioStatus";
import { slugMatchesCollectionPattern } from "./collectionPatterns";

/** Published discourse slugs in nav order for a collection root (e.g. mn, dhp). */
export function countCollectionRoutes(collectionSlug: string): number {
	let count = 0;
	for (const slug of routes) {
		if (slugMatchesCollectionPattern(slug, collectionSlug)) count++;
	}
	return count;
}

/**
 * Format a discourse slug as a human-friendly display ID.
 * `sn14.3` -> `SN 14.3`, `dhp1-20` -> `DHP 1-20`.
 */
export function formatDisplayId(slug: string): string {
	return slug.replace(/([a-z]+)(\d)/i, "$1 $2").toUpperCase();
}

/**
 * Subset of `routes` that have audio. The listen-mode "next/prev discourse"
 * queue only walks slugs we can actually play.
 */
export function audioRoutes(): readonly string[] {
	return routes.filter((r) => audioSlugs.has(r));
}

/** True when the slug has a known audio entry. */
export function isAudioSlug(slug: string): boolean {
	return audioSlugs.has(slug);
}

/** Count audio-bearing discourses in a collection root slug (e.g. mn, dhp). */
export function countCollectionAudioDiscourses(collectionSlug: string): number {
	let count = 0;
	for (const slug of audioSlugs) {
		if (slugMatchesCollectionPattern(slug, collectionSlug)) count++;
	}
	return count;
}

/** Minimum share of discourses with audio before showing the collection listen indicator. */
export const LISTENING_MODE_THRESHOLD = 0.5;

/**
 * True when enough published discourses in a collection have audio for the
 * cover listen badge. Compares audio slugs to route slugs (same granularity).
 */
export function collectionHasListeningMode(collectionSlug: string): boolean {
	const routeCount = countCollectionRoutes(collectionSlug);
	if (routeCount <= 0) return false;
	const audioCount = countCollectionAudioDiscourses(collectionSlug);
	return (
		audioCount > 0 && audioCount / routeCount >= LISTENING_MODE_THRESHOLD
	);
}

/** First audio-bearing slug in a collection, in site nav order. */
export function firstCollectionAudioSlug(
	collectionSlug: string,
): string | null {
	for (const slug of routes) {
		if (
			slugMatchesCollectionPattern(slug, collectionSlug) &&
			audioSlugs.has(slug)
		) {
			return slug;
		}
	}
	return null;
}

/** Listen-mode entry URL for a collection, or null when none. */
export function collectionListenHref(collectionSlug: string): string | null {
	const first = firstCollectionAudioSlug(collectionSlug);
	return first ? `/listen/${first}` : null;
}

/** Adjacent audio-bearing slugs in nav-mode queue order. */
export function nextAudioSlug(slug: string): string | null {
	const ar = audioRoutes();
	const i = ar.indexOf(slug);
	if (i < 0 || i + 1 >= ar.length) return null;
	return ar[i + 1];
}

export function prevAudioSlug(slug: string): string | null {
	const ar = audioRoutes();
	const i = ar.indexOf(slug);
	if (i <= 0) return null;
	return ar[i - 1];
}

/**
 * Symmetric queue window around `slug`: up to `n` items before and `n` after,
 * restricted to audio-bearing routes. Used by the queue drawer (Phase 2.4).
 */
export function queueWindow(
	slug: string,
	n: number,
): { before: string[]; current: string | null; after: string[] } {
	const ar = audioRoutes();
	const i = ar.indexOf(slug);
	if (i < 0) return { before: [], current: null, after: [] };
	return {
		before: ar.slice(Math.max(0, i - n), i),
		current: ar[i],
		after: ar.slice(i + 1, i + 1 + n),
	};
}

import {
	playlists,
	type Playlist,
	type PlaylistEntry,
} from "../data/playlists.generated";
import {
	buildListenHref,
	type ParagraphRange,
	paragraphRangesEqual,
} from "./listenParagraphRange";

/** Playlist entries whose base discourse has recorded audio. */
export function playlistAudioEntries(playlist: Playlist): PlaylistEntry[] {
	return playlist.entries.filter((entry) => audioSlugs.has(entry.slug));
}

/**
 * Resolve a `?pl=` query value to a Playlist. Returns `null` when the id is
 * unknown or the playlist contains no audio-bearing entries (would be a
 * dead queue source).
 */
export function getPlaylist(id: string | null | undefined): Playlist | null {
	if (!id) return null;
	const pl = playlists[id] ?? null;
	if (!pl) return null;
	const hasAudio = playlistAudioEntries(pl).length > 0;
	return hasAudio ? pl : null;
}

/** First audio-bearing playlist entry, or null if none. */
export function firstAudioEntryIn(playlist: Playlist): PlaylistEntry | null {
	return playlistAudioEntries(playlist)[0] ?? null;
}

/** First audio-bearing slug in a playlist, or null if none. */
export function firstAudioSlugIn(playlist: Playlist): string | null {
	return firstAudioEntryIn(playlist)?.slug ?? null;
}

export function listenHrefForPlaylistEntry(
	entry: PlaylistEntry,
	playlistId?: string,
): string {
	return buildListenHref(entry.slug, {
		pl: playlistId ?? null,
		pp: entry.pp ?? null,
	});
}

export function findPlaylistEntryIndex(
	playlist: Playlist,
	opts: { href?: string | null; slug: string; pp?: ParagraphRange | null },
): number {
	if (opts.href) {
		const byHref = playlist.entries.findIndex((e) => e.href === opts.href);
		if (byHref >= 0) return byHref;
	}
	return playlist.entries.findIndex(
		(e) =>
			e.slug === opts.slug &&
			paragraphRangesEqual(e.pp ?? null, opts.pp ?? null),
	);
}

function audioEntryIndex(
	playlist: Playlist,
	opts: { href?: string | null; slug: string; pp?: ParagraphRange | null },
): number {
	const audio = playlistAudioEntries(playlist);
	const href = opts.href ?? null;
	if (href) {
		const byHref = audio.findIndex((e) => e.href === href);
		if (byHref >= 0) return byHref;
	}
	return audio.findIndex(
		(e) =>
			e.slug === opts.slug &&
			paragraphRangesEqual(e.pp ?? null, opts.pp ?? null),
	);
}

/**
 * Adjacent audio-bearing playlist entries. Mirrors global next/prev helpers but
 * preserves paragraph excerpts as distinct queue items.
 */
export function nextPlaylistEntry(
	playlist: Playlist,
	opts: { href?: string | null; slug: string; pp?: ParagraphRange | null },
): PlaylistEntry | null {
	const audio = playlistAudioEntries(playlist);
	const i = audioEntryIndex(playlist, opts);
	if (i < 0 || i + 1 >= audio.length) return null;
	return audio[i + 1];
}

export function prevPlaylistEntry(
	playlist: Playlist,
	opts: { href?: string | null; slug: string; pp?: ParagraphRange | null },
): PlaylistEntry | null {
	const audio = playlistAudioEntries(playlist);
	const i = audioEntryIndex(playlist, opts);
	if (i <= 0) return null;
	return audio[i - 1];
}

/** @deprecated Use `nextPlaylistEntry` when paragraph excerpts may be present. */
export function nextAudioSlugInPlaylist(
	playlist: Playlist,
	slug: string,
): string | null {
	return nextPlaylistEntry(playlist, { slug })?.slug ?? null;
}

/** @deprecated Use `prevPlaylistEntry` when paragraph excerpts may be present. */
export function prevAudioSlugInPlaylist(
	playlist: Playlist,
	slug: string,
): string | null {
	return prevPlaylistEntry(playlist, { slug })?.slug ?? null;
}

/** Symmetric playlist-scoped window around the current entry href. */
export function playlistQueueWindow(
	playlist: Playlist,
	href: string,
	n: number,
): { before: string[]; current: string | null; after: string[] } {
	const audio = playlistAudioEntries(playlist);
	const keys = audio.map((e) => e.href);
	const i = keys.indexOf(href);
	if (i < 0) return { before: [], current: null, after: [] };
	return {
		before: keys.slice(Math.max(0, i - n), i),
		current: keys[i],
		after: keys.slice(i + 1, i + 1 + n),
	};
}
