import { spawnSync } from "node:child_process";

type VisitsCountResponse = {
	query?: { since?: string; until?: string };
	data?: { visitors?: number; pageviews?: number };
	error?: { code?: string; message?: string };
};

export type SupportImpactStat = {
	value: string;
	label: string;
};

/** Structured reach block for the untitled Support impact section. */
export type SupportImpact = {
	dateLine: string;
	stats: SupportImpactStat[];
	/** Honest note when visitor/pageview counts could not be fetched. */
	note?: string;
};

function env(key: string): string | undefined {
	const fromProcess =
		typeof process !== "undefined" ? process.env[key] : undefined;
	const meta = import.meta.env as Record<string, string | undefined> | undefined;
	const fromMeta = meta?.[key];
	const value = fromProcess || fromMeta;
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function utcDateOnly(d: Date): string {
	return d.toISOString().slice(0, 10);
}

function daysAgoUtc(days: number): Date {
	const d = new Date();
	d.setUTCHours(0, 0, 0, 0);
	d.setUTCDate(d.getUTCDate() - days);
	return d;
}

function formatCount(n: number): string {
	return new Intl.NumberFormat("en-US").format(n);
}

function utcDateParts(
	iso: string,
): { day: number; month: string; year: number } | null {
	const d = /^\d{4}-\d{2}-\d{2}$/.test(iso)
		? new Date(`${iso}T00:00:00.000Z`)
		: new Date(iso);
	if (Number.isNaN(d.getTime())) return null;
	return {
		day: d.getUTCDate(),
		month: d.toLocaleString("en-US", { month: "long", timeZone: "UTC" }),
		year: d.getUTCFullYear(),
	};
}

/** “19 July – 20 August 2026” — year once when the range shares it. */
function formatDateLine(sinceIso: string, untilIso: string): string {
	const start = utcDateParts(sinceIso);
	const end = utcDateParts(untilIso);
	if (!start || !end) return "";
	if (start.year === end.year) {
		return `${start.day} ${start.month} – ${end.day} ${end.month} ${end.year}`;
	}
	return `${start.day} ${start.month} ${start.year} – ${end.day} ${end.month} ${end.year}`;
}

function nextUtcDateOnly(iso: string): string | null {
	const d = /^\d{4}-\d{2}-\d{2}$/.test(iso)
		? new Date(`${iso}T00:00:00.000Z`)
		: new Date(iso);
	if (Number.isNaN(d.getTime())) return null;
	d.setUTCDate(d.getUTCDate() + 1);
	return utcDateOnly(d);
}

function gitRangeBounds(
	sinceIso: string,
	untilIso: string,
): { since: string; until: string } | null {
	const start = utcDateParts(sinceIso);
	const untilExclusive = nextUtcDateOnly(untilIso);
	if (!start || !untilExclusive) return null;
	const sinceDay = /^\d{4}-\d{2}-\d{2}$/.test(sinceIso)
		? sinceIso
		: utcDateOnly(new Date(sinceIso));
	if (!/^\d{4}-\d{2}-\d{2}$/.test(sinceDay)) return null;
	return {
		since: `${sinceDay}T00:00:00Z`,
		until: `${untilExclusive}T00:00:00Z`,
	};
}

function isEnglishDiscoursePath(file: string): boolean {
	return /^src\/content\/en\/(?!anthologies\/)[^/]+\/[^/]+\.mdx$/.test(file);
}

function discourseStat(count: number): SupportImpactStat {
	return {
		value: formatCount(count),
		label: count === 1 ? "new discourse added" : "new discourses added",
	};
}

/**
 * Unique English discourse files *added* in commits whose messages match
 * `add (content)` (case-insensitive). Counts files, not commits: one commit
 * can add several suttas; diagram-only commits add none.
 * Returns null if git is missing or the log cannot be read (omit the stat).
 */
function countDiscoursesAdded(sinceIso: string, untilIso: string): number | null {
	const bounds = gitRangeBounds(sinceIso, untilIso);
	if (!bounds) return null;
	try {
		const result = spawnSync(
			"git",
			[
				"log",
				"-i",
				"-F",
				"--grep=add (content)",
				`--since=${bounds.since}`,
				`--until=${bounds.until}`,
				"--diff-filter=A",
				"--name-only",
				"--pretty=format:",
				"--",
				"src/content/en/**/*.mdx",
			],
			{
				encoding: "utf8",
				timeout: 8000,
				maxBuffer: 2 * 1024 * 1024,
				stdio: ["ignore", "pipe", "pipe"],
			},
		);
		if (result.error || result.status !== 0) return null;
		const files = new Set(
			(result.stdout ?? "")
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter(isEnglishDiscoursePath),
		);
		return files.size;
	} catch {
		return null;
	}
}

function buildImpact(params: {
	sinceIso: string;
	untilIso: string;
	visitors?: number;
	pageviews?: number;
}): SupportImpact {
	const dateLine = formatDateLine(params.sinceIso, params.untilIso);
	const discourses = countDiscoursesAdded(params.sinceIso, params.untilIso);
	const stats: SupportImpactStat[] = [];
	if (discourses !== null) {
		stats.push(discourseStat(discourses));
	}

	const visitors = params.visitors;
	const pageviews = params.pageviews;
	const analyticsOk =
		typeof visitors === "number" &&
		typeof pageviews === "number" &&
		Number.isFinite(visitors) &&
		Number.isFinite(pageviews) &&
		visitors > 0 &&
		pageviews > 0;

	if (analyticsOk) {
		stats.push({
			value: formatCount(Math.round(visitors)),
			label: "visitors",
		});
		stats.push({
			value: formatCount(Math.round(pageviews)),
			label: "pages viewed",
		});
		return { dateLine, stats };
	}

	if (discourses !== null) {
		return {
			dateLine,
			stats,
			note: "Visitor and pageview counts were unavailable.",
		};
	}
	return {
		dateLine,
		stats,
		note: "Reach figures were unavailable.",
	};
}

async function fetchVisitsCount(params: {
	token: string;
	projectId: string;
	teamId?: string;
	slug?: string;
	since: string;
	until: string;
}): Promise<VisitsCountResponse> {
	const url = new URL("https://api.vercel.com/v1/query/web-analytics/visits/count");
	url.searchParams.set("projectId", params.projectId);
	url.searchParams.set("since", params.since);
	url.searchParams.set("until", params.until);
	if (params.teamId) url.searchParams.set("teamId", params.teamId);
	else if (params.slug) url.searchParams.set("slug", params.slug);

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 8000);
	try {
		const res = await fetch(url, {
			headers: { Authorization: `Bearer ${params.token}` },
			signal: controller.signal,
		});
		return (await res.json()) as VisitsCountResponse;
	} finally {
		clearTimeout(timeout);
	}
}

function isHobbyWindowError(body: VisitsCountResponse): boolean {
	const message = body.error?.message ?? "";
	return /hobby plan only grants access to the latest 31 days/i.test(message);
}

function warnAnalyticsFallback(): void {
	console.warn(
		"[support] Vercel analytics unavailable; omitting visitor and pageview counts.",
	);
}

/**
 * Build-time reach figures from Vercel Web Analytics and git history.
 * Hobby plans only expose the latest ~31 days when a date range is set.
 * Does not invent visitor or pageview numbers when the API is unavailable.
 */
export async function getSupportImpact(): Promise<SupportImpact> {
	const until = utcDateOnly(new Date());
	const defaultSince = utcDateOnly(daysAgoUtc(31));

	try {
		const token = env("VERCEL_TOKEN") || env("VERCEL_ACCESS_TOKEN");
		const projectId = env("VERCEL_PROJECT_ID");
		const teamId = env("VERCEL_TEAM_ID") || env("VERCEL_ORG_ID");
		const slug = env("VERCEL_TEAM_SLUG");
		if (!token || !projectId) {
			warnAnalyticsFallback();
			return buildImpact({ sinceIso: defaultSince, untilIso: until });
		}

		const lookbacks = [31, 30, 28];
		let lastError: unknown;

		for (const days of lookbacks) {
			try {
				const since = utcDateOnly(daysAgoUtc(days));
				const body = await fetchVisitsCount({
					token,
					projectId,
					teamId,
					slug,
					since,
					until,
				});
				if (body.error) {
					if (isHobbyWindowError(body)) continue;
					lastError = body.error.message ?? body.error.code;
					continue;
				}
				const visitors = body.data?.visitors;
				const pageviews = body.data?.pageviews;
				if (typeof visitors !== "number" || typeof pageviews !== "number") {
					continue;
				}
				const sinceIso = body.query?.since ?? since;
				const untilIso = body.query?.until ?? until;
				const impact = buildImpact({
					sinceIso,
					untilIso,
					visitors,
					pageviews,
				});
				if (impact.stats.some((s) => s.label === "visitors")) {
					return impact;
				}
			} catch (err) {
				lastError = err;
			}
		}

		if (lastError) warnAnalyticsFallback();
		return buildImpact({ sinceIso: defaultSince, untilIso: until });
	} catch {
		warnAnalyticsFallback();
		return buildImpact({ sinceIso: defaultSince, untilIso: until });
	}
}
