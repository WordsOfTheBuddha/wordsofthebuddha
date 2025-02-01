import { execSync } from "child_process";
import fs from "fs";

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

  // Get all file modifications with full history
  const gitLog = execSync(
    'git ls-files "src/content/**/*.mdx" | xargs -I {} git log --follow -1 --format="%H %aI {}" -- {}',
    { encoding: "utf-8" }
  );

  // Load existing cache
  const cache = fs.existsSync(CACHE_FILE)
    ? JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"))
    : {};

  // Parse and update cache
  gitLog
    .trim()
    .split("\n")
    .forEach((line) => {
      if (!line) return;
      const [_, dateStr, ...filePathParts] = line.split(" ");
      const filepath = filePathParts.join(" "); // Handle paths with spaces
      if (filepath && dateStr) {
        cache[filepath] = dateStr;
      }
    });

  // Save updated cache
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  console.log(`Updated timestamp cache for ${Object.keys(cache).length} files`);
} catch (error) {
  console.error("Failed to update timestamps:", error);
  process.exit(1);
}
