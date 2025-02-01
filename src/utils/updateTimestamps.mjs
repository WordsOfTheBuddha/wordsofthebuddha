import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const CACHE_FILE = ".timestamp-cache.json";

try {
  console.log("Updating timestamp cache...");

  // Get all content files in a single git command
  const output = execSync('git ls-files "src/content/**/*.mdx"', {
    encoding: "utf-8",
  });
  const files = output.trim().split("\n");

  // Load existing cache
  const cache = fs.existsSync(CACHE_FILE)
    ? JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"))
    : {};

  // Get timestamps in bulk for better performance
  const timestamps = execSync(
    `git log -1 --format="%H %aI" -- ${files.map((f) => `"${f}"`).join(" ")}`,
    { encoding: "utf-8" }
  )
    .trim()
    .split("\n");

  // Update cache
  timestamps.forEach((line, index) => {
    const [hash, dateStr] = line.split(" ");
    if (dateStr && files[index]) {
      cache[files[index]] = dateStr;
    }
  });

  // Save updated cache
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  console.log(`Updated timestamp cache for ${files.length} files`);
} catch (error) {
  console.error("Failed to update timestamps:", error);
  process.exit(1); // Fail build if cache update fails
}
