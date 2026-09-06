import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "node:url";
import { globSync } from "glob";
import {
	DISCOURSE_ADDITIONS_PATH,
	isEnglishDiscoursePath,
	mergeDiscourseAdditions,
	serializeDiscourseAdditions,
	slugFromEnglishPath,
	type DiscourseAdditions,
} from "./recentDiscourses";

const DISCOURSE_ADDITIONS_FILE = path.join(
	process.cwd(),
	DISCOURSE_ADDITIONS_PATH,
);

const GIT_LOG_MAX_BUFFER = 50 * 1024 * 1024;

function loadExisting(): DiscourseAdditions {
	try {
		if (!fs.existsSync(DISCOURSE_ADDITIONS_FILE)) return {};
		const parsed = JSON.parse(
			fs.readFileSync(DISCOURSE_ADDITIONS_FILE, "utf-8"),
		) as unknown;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return {};
		}
		const additions: DiscourseAdditions = {};
		for (const [slug, value] of Object.entries(parsed)) {
			if (typeof value === "string" && value) additions[slug] = value;
		}
		return additions;
	} catch (error) {
		console.warn("discourse-additions: could not read state file:", error);
		return {};
	}
}

function listEnglishDiscourseFiles(): string[] {
	return globSync("src/content/en/**/*.mdx").filter(isEnglishDiscoursePath);
}

/**
 * First-add dates from git. Skipped on Vercel: shallow clones treat old files
 * that happen to appear in the window as new, and miss true adds outside it.
 */
function gitFirstAddedBySlug(): DiscourseAdditions {
	if (process.env.VERCEL) return {};
	try {
		const log = execSync(
			'git log --diff-filter=A --name-only --pretty=format:"COMMIT %aI" -- "src/content/en/**/*.mdx"',
			{ encoding: "utf-8", maxBuffer: GIT_LOG_MAX_BUFFER },
		);
		const dates: DiscourseAdditions = {};
		let currentDate: string | null = null;
		for (const raw of log.split("\n")) {
			const line = raw.trim();
			if (!line) continue;
			if (line.startsWith("COMMIT ")) {
				currentDate = line.slice("COMMIT ".length).trim();
				continue;
			}
			if (!currentDate || !isEnglishDiscoursePath(line)) continue;
			const slug = slugFromEnglishPath(line);
			if (slug && !(slug in dates)) dates[slug] = currentDate;
		}
		return dates;
	} catch {
		return {};
	}
}

function fileAddedFallback(filePath: string, nowIso: string): string {
	try {
		const st = fs.statSync(path.join(process.cwd(), filePath));
		const birth =
			st.birthtime && st.birthtime.getTime() > 0 ? st.birthtime : null;
		return (birth ?? st.mtime).toISOString();
	} catch {
		return nowIso;
	}
}

export function updateDiscourseAdditions(
	now: Date = new Date(),
): DiscourseAdditions {
	const existing = loadExisting();
	const files = listEnglishDiscourseFiles();
	const slugs: string[] = [];
	const discovered: DiscourseAdditions = {};
	const gitDates = gitFirstAddedBySlug();
	const nowIso = now.toISOString();

	for (const filePath of files) {
		const slug = slugFromEnglishPath(filePath);
		if (!slug) continue;
		slugs.push(slug);
		if (existing[slug]) continue;
		discovered[slug] = gitDates[slug] ?? fileAddedFallback(filePath, nowIso);
	}

	const next = mergeDiscourseAdditions(existing, slugs, discovered, nowIso);
	const serialized = serializeDiscourseAdditions(next);
	const previous = fs.existsSync(DISCOURSE_ADDITIONS_FILE)
		? fs.readFileSync(DISCOURSE_ADDITIONS_FILE, "utf-8")
		: "";
	if (serialized !== previous) {
		fs.mkdirSync(path.dirname(DISCOURSE_ADDITIONS_FILE), { recursive: true });
		fs.writeFileSync(DISCOURSE_ADDITIONS_FILE, serialized);
	}
	const added = slugs.filter((slug) => !existing[slug]).length;
	console.log(
		`discourse-additions: ${slugs.length} discourses (${added} newly recorded)`,
	);
	return next;
}

const invokedAsScript =
	Boolean(process.argv[1]) &&
	import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) {
	updateDiscourseAdditions();
}
