import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const CACHE_FILE = path.join(process.cwd(), ".timestamp-cache.json");

try {
  console.log("Updating timestamp cache at:", CACHE_FILE);

  // Handle shallow clones (like in Vercel)
  if (process.env.VERCEL_GIT_FETCH_DEPTH) {
    try {
      console.log("Fetching full git history...");
      execSync("git fetch --unshallow", { stdio: "pipe" });
    } catch (e) {
      console.log("Repository might already have full history");
    }
  }

  // Get all file modifications using the working approach
  const gitLog = execSync(
    'git ls-files --stage "src/content/**/*.mdx" | cut -f3- | xargs git log -1 --format="%H %ai" --',
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

      // Split on first space for hash, then take rest as date
      const [hash, ...dateParts] = line.split(" ");
      const dateStr = dateParts.join(" "); // Rejoin date parts in case they contain spaces
      if (!hash) return;

      const filepath = execSync(
        `git diff-tree --no-commit-id --name-only -r ${hash}`,
        { encoding: "utf-8" }
      ).trim();

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

  const cacheDir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(cleanCache, null, 2));
  console.log(
    `Updated timestamp cache with ${Object.keys(cleanCache).length} files`
  );
} catch (error) {
  console.error("Failed to update timestamps:", error);
  console.error("Cache file path:", CACHE_FILE);
  process.exit(1);
}
