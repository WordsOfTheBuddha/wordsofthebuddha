import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const CACHE_FILE = path.join(process.cwd(), ".timestamp-cache.json");
const GIT_LOG_MAX_BUFFER = 50 * 1024 * 1024;

function git(command) {
	return execSync(command, {
		encoding: "utf-8",
		maxBuffer: GIT_LOG_MAX_BUFFER,
	});
}

function listLines(command) {
	return git(command)
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
}

/**
 * Parse `git log --name-only --pretty=format:"COMMIT %aI"` output.
 * Newest-first: the first time a path appears is the date we keep.
 */
function firstSeenDates(logOutput) {
	const dates = {};
	let currentDate = null;
	for (const raw of logOutput.split("\n")) {
		const line = raw.trim();
		if (!line) continue;
		if (line.startsWith("COMMIT ")) {
			currentDate = line.slice("COMMIT ".length).trim();
			continue;
		}
		if (currentDate && !(line in dates)) {
			dates[line] = currentDate;
		}
	}
	return dates;
}

function isoFromStat(date) {
	return date.toISOString();
}

try {
	// Handle shallow clones (like in Vercel) so first-added dates are real.
	if (process.env.VERCEL_GIT_FETCH_DEPTH) {
		try {
			execSync("git fetch --unshallow", { stdio: "pipe" });
		} catch {
			// Repository might already have full history
		}
	}

	const trackedMdx = listLines('git ls-files -- "src/content/**/*.mdx"');
	const untrackedMdx = listLines(
		'git ls-files --others --exclude-standard -- "src/content/**/*.mdx"',
	);

	const lastModified = firstSeenDates(
		git(
			'git log --name-only --pretty=format:"COMMIT %aI" -- "src/content/**/*.mdx"',
		),
	);
	const firstAdded = firstSeenDates(
		git(
			'git log --diff-filter=A --name-only --pretty=format:"COMMIT %aI" -- "src/content/**/*.mdx"',
		),
	);

	const cache = {};

	for (const file of trackedMdx) {
		const modified = lastModified[file];
		const added = firstAdded[file];
		if (!modified && !added) continue;
		cache[file] = {
			modified: modified || added,
			added: added || null,
		};
	}

	for (const file of untrackedMdx) {
		try {
			const st = fs.statSync(path.join(process.cwd(), file));
			const modified = isoFromStat(st.mtime);
			const added = isoFromStat(
				st.birthtime && st.birthtime.getTime() > 0 ? st.birthtime : st.mtime,
			);
			cache[file] = { modified, added };
		} catch {
			console.warn(`timestamps: could not stat untracked ${file}`);
		}
	}

	const cacheDir = path.dirname(CACHE_FILE);
	if (!fs.existsSync(cacheDir)) {
		fs.mkdirSync(cacheDir, { recursive: true });
	}

	fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
	const addedCount = Object.values(cache).filter((entry) => entry.added).length;
	console.log(
		`timestamps: cached ${Object.keys(cache).length} file(s) (${addedCount} with added date, ${untrackedMdx.length} untracked)`,
	);
} catch (error) {
	console.error("Failed to update timestamps:", error);
	console.error("Cache file path:", CACHE_FILE);
	process.exit(1);
}
