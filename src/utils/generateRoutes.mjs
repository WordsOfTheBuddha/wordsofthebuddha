// scripts/generateRoutes.mjs
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CONTENT_DIR = resolve(__dirname, "../content/en");
const OUTPUT_FILE = resolve(__dirname, "../utils/routes.ts");

async function getFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry.name);

      // Skip hidden files/directories
      if (entry.name.startsWith(".")) return [];

      return entry.isDirectory() ? await getFiles(fullPath) : fullPath;
    })
  );
  return files.flat();
}

async function generateRoutes() {
  try {
    const files = await getFiles(CONTENT_DIR);

    // Process files to get base names without extensions
    const routes = files
      .map((file) => basename(file)) // Get just the filename
      .map((file) => file.replace(extname(file), "")); // Remove extension

    const routesContent = `// Auto-generated by utils/generateRoutes.mjs
export const routes = [
${routes.map((id) => `  { params: { id: ${JSON.stringify(id)} } }`).join(",\n")}
];\n`;

    await writeFile(OUTPUT_FILE, routesContent);
    console.log(`✅ Generated ${routes.length} routes in ${OUTPUT_FILE}`);
  } catch (error) {
    console.error("❌ Route generation failed:", error);
    process.exit(1);
  }
}

generateRoutes();
