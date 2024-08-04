const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const simpleGit = require("simple-git");

const CONTENT_DIRECTORY = path.join(__dirname, "..", "pages");
const OUTPUT_FILE = path.join(__dirname, "..", "public", "frontMatter.json");

const git = simpleGit();

const getAllFiles = (dirPath, arrayOfFiles) => {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach((file) => {
    if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
      arrayOfFiles = getAllFiles(path.join(dirPath, file), arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, file));
    }
  });

  return arrayOfFiles;
};

const getLastCommitDate = async (filePath) => {
  try {
    const log = await git.log({ file: filePath });
    return log.latest
      ? new Date(log.latest.date).toISOString()
      : new Date().toISOString();
  } catch (error) {
    console.error(`Error fetching git log for ${filePath}:`, error);
    return new Date().toISOString();
  }
};

const generateFrontMatterJSON = async () => {
  const files = getAllFiles(CONTENT_DIRECTORY).filter(
    (file) => file.endsWith(".md") || file.endsWith(".mdx")
  );
  const frontMatterData = {};
  let frontMatterCount = 0;

  for (const file of files) {
    const fileContent = fs.readFileSync(file, "utf8");
    const { data: frontMatter } = matter(fileContent);
    if (Object.keys(frontMatter).length > 0) {
      const relativePath = path.relative(CONTENT_DIRECTORY, file);
      const key = relativePath
        .replace(/\.(md|mdx)$/, "")
        .split("/")
        .pop();
      const keyWithoutLocale = key.replace(/\.[a-z]{2,3}$/, "");
      const updatedTime = await getLastCommitDate(file);
      frontMatterData[key] = {
        ...frontMatter,
        path: `/${relativePath.split(path.sep).slice(0, -1).join("/")}/`,
        updatedTime,
      };
      // if key has a `-` in it surrounded by two numbers, e.g. an1.1-10.en, dhp1-20.en, then generate a range of keys for the two numbers, e.g. an1.1.en, an1.2.en, an1.3.en, ... an1.10.en. Note: key should also have the suffix of the original key after the digits
      const match = key.match(/(\d+)-(\d+)(\..+)$/);
      if (match) {
        const [_, start, end, suffix] = match;
        for (let i = Number(start); i <= Number(end); i++) {
          const newKey = `${key.replace(match[0], i + suffix)}`;
          const newRelativePath = relativePath.replace(match[0], i + suffix);
          frontMatterData[newKey] = {
            ...frontMatter,
            path: `/${newRelativePath.split(path.sep).slice(0, -1).join("/")}/`,
            fullPath: `/${newRelativePath
              .split(path.sep)
              .slice(0, -1)
              .join("/")}/${key}#${extractNumericBeforeDot(
              keyWithoutLocale
            )}${i}`,
            updatedTime,
          };
          frontMatterCount++;
        }
      }
      frontMatterCount++;
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(frontMatterData, null, 2));
  console.log(
    `FrontMatter data written to ${OUTPUT_FILE} from ${frontMatterCount} files`
  );
};

const extractNumericBeforeDot = (str) => {
  const match = str.match(/(\d+)\./);
  return match ? match[1] : "";
};

generateFrontMatterJSON();
