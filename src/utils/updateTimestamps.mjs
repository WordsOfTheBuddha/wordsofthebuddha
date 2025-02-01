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
  console.log("Debug: Starting git log command...");
  const gitLog = execSync(
    'git ls-files --stage "src/content/**/*.mdx" | cut -f3- | xargs git log -1 --format="%H %ai" --',
    { encoding: "utf-8" }
  );

  console.log("Debug: Raw git log output first line:", gitLog.split("\n")[0]);

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
      console.log("Debug: Processing line:", JSON.stringify(line));

      // Split on first space for hash, then take rest as date
      const [hash, ...dateParts] = line.split(" ");
      const dateStr = dateParts.join(" "); // Rejoin date parts in case they contain spaces
      if (!hash) return;

      const filepath = execSync(
        `git diff-tree --no-commit-id --name-only -r ${hash}`,
        { encoding: "utf-8" }
      ).trim();

      console.log("Debug: Found filepath:", JSON.stringify(filepath));
      console.log("Debug: Found date:", JSON.stringify(dateStr));

      if (
        filepath &&
        filepath.startsWith("src/content/") &&
        filepath.endsWith(".mdx")
      ) {
        // Store clean values without any extra whitespace
        cache[filepath.trim()] = dateStr.trim();
      }
    });

  // Save updated cache with pretty printing but no extra whitespace
  const cleanCache = Object.fromEntries(
    Object.entries(cache).map(([k, v]) => [k.trim(), v.trim()])
  );
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cleanCache, null, 2));

  // Debug output without any string formatting
  console.log(
    `Updated timestamp cache for ${Object.keys(cleanCache).length} files`
  );
  console.log("Sample cache entries (raw):");
  Object.entries(cleanCache)
    .slice(0, 3)
    .forEach(([k, v]) => console.log(k, ":", v));
} catch (error) {
  console.error("Failed to update timestamps:", error);
  process.exit(1);
}
