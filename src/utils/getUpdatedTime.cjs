const fs = require("fs");
const path = require("path");

const pagesDir = path.join(__dirname, "../", "pages");
const pages = {};

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
    } else if (path.extname(file) === ".astro") {
      const mtime = stat.mtime.toISOString();
      const relativePath = fullPath.replace(pagesDir, "").replace(/\\/g, "/");
      pages[relativePath] = mtime;
    }
  }
}

walk(pagesDir);

fs.writeFileSync(
  path.join(__dirname, "../", "data", "lastUpdated.json"),
  JSON.stringify(pages, null, 2)
);
