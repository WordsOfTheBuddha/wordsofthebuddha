import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const CACHE_FILE = ".timestamp-cache.json";

try {
  console.log("Updating timestamp cache...");

  // Handle shallow clones (like in Vercel)
  if (process.env.VERCEL_GIT_FETCH_DEPTH) {
    try {
      console.log("Fetching full git history...");
      execSync("git fetch --unshallow", { stdio: "pipe" });
    } catch (e) {
      console.log("Repository might already have full history");
    }
  }

  // Debug: Print git status and current depth
  console.log(
    "Git status:",
    execSync("git status --short", { encoding: "utf-8" })
  );
  console.log(
    "Commit count:",
    execSync("git rev-list --count HEAD", { encoding: "utf-8" })
  );

  // Get all file modifications using the working approach
  const gitLog = execSync(
    'git ls-files --stage "src/content/**/*.mdx" | cut -f3- | xargs git log -1 --format="%H %ct %aI" --',
    { encoding: "utf-8" }
  );

  // Load existing cache
  const cache = fs.existsSync(CACHE_FILE)
    ? JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"))
    : {};

  // Parse and update cache with improved filepath handling
  gitLog
    .trim()
    .split("\n")
    .forEach((line) => {
      if (!line) return;
      const [hash, _, dateStr] = line.split(" ");
      if (!hash) return;

      // Get actual filepath using diff-tree and clean it
      const filepath = execSync(
        `git diff-tree --no-commit-id --name-only -r ${hash}`,
        { encoding: "utf-8" }
      )
        .trim()
        .replace(/[\n\r]/g, ""); // Remove any newlines

      if (
        filepath &&
        filepath.startsWith("src/content/") &&
        filepath.endsWith(".mdx")
      ) {
        console.log(
          `Debug: Processing clean path: "${filepath}" with date ${dateStr}`
        );
        cache[filepath] = dateStr;
      }
    });

  // Save updated cache
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  console.log(`Updated timestamp cache for ${Object.keys(cache).length} files`);

  // Debug: Print some cache entries (with quotes to see any whitespace issues)
  console.log(
    "Sample cache entries:",
    Object.entries(cache)
      .slice(0, 3)
      .map(([k, v]) => `\n"${k}": "${v}"`)
  );
} catch (error) {
  console.error("Failed to update timestamps:", error);
  process.exit(1);
}
