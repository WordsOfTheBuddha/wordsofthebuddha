const fs = require("fs");
const path = require("path");

// Path to the pages directory and the frontmatter JSON files
const pagesDir = path.join(__dirname, "../pages");
const frontMatterFile = path.join(__dirname, "../public/frontMatter.json");
const directoryFrontMatterFile = path.join(
  __dirname,
  "../public/directoryFrontMatter.json"
);

// Load frontMatter.json and directoryFrontMatter.json data
const frontMatterData = JSON.parse(fs.readFileSync(frontMatterFile, "utf8"));
const directoryFrontMatterData = JSON.parse(
  fs.readFileSync(directoryFrontMatterFile, "utf8")
);

// Helper function to create card data
const createCardData = ({ title, description, id, path }) => ({
  title,
  description,
  id,
  path,
});

// Function to generate index.mdx content for pages and directories
const generateIndexContent = (items) => `
import CardGrid from '/components/CardGrid';

export default function Index() {
  return (
    <CardGrid items={${JSON.stringify(items)}} />
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
        return createCardData({
          title: frontmatter.title,
          description: frontmatter.description,
          id: id,
          path: `${dir.replace(pagesDir, "").replace(/\\/g, "/")}/`, // Convert path to URL format
        });
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
    .filter((item) => fs.lstatSync(path.join(dir, item)).isDirectory())
    .sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );

  const directoryCards = subdirs.map((subdir) => {
    const dirData = directoryFrontMatterData[subdir] || {};
    return createCardData({
      title: dirData.title || subdir,
      description: dirData.description || "",
      id: subdir,
      path: `${dir.replace(pagesDir, "").replace(/\\/g, "/")}/`, // Convert path to URL format
    });
  });

  let contentCount = 0;
  const allCards = [...cards, ...directoryCards];

  if (allCards.length > 0) {
    const indexContent = generateIndexContent(allCards);
    fs.writeFileSync(path.join(dir, "index.mdx"), indexContent);
    contentCount++;
    //console.log(`Created index.mdx for content in ${dir}`);
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
