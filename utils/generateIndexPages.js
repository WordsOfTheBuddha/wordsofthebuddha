const fs = require("fs");
const path = require("path");

// Path to the pages directory and the frontmatter JSON file
const pagesDir = path.join(__dirname, "../pages");
const frontMatterFile = path.join(__dirname, "../public/frontMatter.json");

// Load frontMatter.json data
const frontMatterData = JSON.parse(fs.readFileSync(frontMatterFile, "utf8"));

// Helper function to create card HTML
const createCard = ({ title, description, id, path }) => `
  <Card 
    title="${title}"
    description="${description}"
    link="${path}${id}"
    id="${id}"
  />
`;

// Helper function to create directory link HTML with full path
const createDirectoryLink = (dir, subdir) => {
  const fullPath = path.relative(pagesDir, path.join(dir, subdir));
  return `
    <div className="directory-link">
      <a href="/${fullPath}/">Go to ${subdir}</a>
    </div>
  `;
};

// Function to generate index.mdx content for pages
const generatePagesIndexContent = (items) => `
import { Card } from '/components/Card';

export default function Index() {
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
    gap: '1rem',
    padding: '1rem 1rem 1rem 0'
  };

  return (
    <div style={gridStyle}>
      ${items.map(createCard).join("\n")}
    </div>
  );
}
`;

// Function to generate index.mdx content for directories
const generateDirectoriesIndexContent = (dir, subdirs) => `
export default function Index() {
  return (
    <div className="directories-container">
      ${subdirs.map((subdir) => createDirectoryLink(dir, subdir)).join("\n")}
    </div>
  );
}
`;

// Function to get all directories and generate index pages
const generateIndexPages = (dir) => {
  const items = fs.readdirSync(dir).filter((item) => item.endsWith(".en.mdx"));

  const cards = items
    .map((item) => {
      const id = item.replace(".en.mdx", "");
      const frontmatter = frontMatterData[id + ".en"];
      if (frontmatter) {
        return {
          title: frontmatter.title,
          description: frontmatter.description,
          id: frontmatter.id,
          path: frontmatter.path,
        };
      }
    })
    .filter((card) => card !== undefined)
    .sort((a, b) =>
      a.id.localeCompare(b.id, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );

  const subdirs = fs
    .readdirSync(dir)
    .filter((item) => fs.lstatSync(path.join(dir, item)).isDirectory());

  let contentCount = 0;
  if (cards.length > 0 && subdirs.length === 0) {
    const indexContent = generatePagesIndexContent(cards);
    fs.writeFileSync(path.join(dir, "index.mdx"), indexContent);
    contentCount++;
    //console.log(`Created index.mdx for pages in ${dir}`);
  } else if (subdirs.length > 0 && cards.length === 0) {
    const indexContent = generateDirectoriesIndexContent(dir, subdirs);
    fs.writeFileSync(path.join(dir, "index.mdx"), indexContent);
    contentCount++;
    //console.log(`Created index.mdx for directories in ${dir}`);
  } else {
    //console.log(`No content to create index.mdx in ${dir}`);
  }

  let totalCount = contentCount;
  subdirs.forEach((subdir) => {
    totalCount += generateIndexPages(path.join(dir, subdir));
  });
  return totalCount;
};

// Start generating index pages from the base pages directory
const contentCount = generateIndexPages(pagesDir);
console.log(`Updated ${contentCount} index.mdx files in pages directory.`);
