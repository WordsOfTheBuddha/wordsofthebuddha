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

  // Get all MDX files
  const allMdxFiles = execSync('git ls-files "src/content/**/*.mdx"', {
    encoding: "utf-8",
  })
    .trim()
    .split("\n")
    .filter(Boolean);

  // Initialize fresh cache
  const cache = {};

  // Get timestamps for each file individually
  allMdxFiles.forEach((file) => {
    try {
      const fileLog = execSync(`git log -1 --format="%ai" -- "${file}"`, {
        encoding: "utf-8",
      }).trim();

      if (fileLog) {
        cache[file] = fileLog;
      }
    } catch (e) {
      console.warn(`Could not get timestamp for ${file}`);
    }
  });

  // Save cache with pretty printing
  const cacheDir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  console.log(
    `Created fresh timestamp cache with ${Object.keys(cache).length} files`
  );
} catch (error) {
  console.error("Failed to update timestamps:", error);
  console.error("Cache file path:", CACHE_FILE);
  process.exit(1);
}
