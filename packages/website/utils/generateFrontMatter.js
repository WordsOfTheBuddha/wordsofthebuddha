const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const simpleGit = require("simple-git");
const { object } = require("prop-types");

const CONTENT_DIRECTORY = path.join(__dirname, "..", "pages");
const OUTPUT_FILE = path.join(__dirname, "..", "public", "frontMatter.json");

const git = simpleGit();
let isDev = process.env.NODE_ENV !== "production";

const getAllFiles = (dirPath, arrayOfFiles) => {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach((file) => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
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

const extractNumericBeforeDot = (str) => {
  const match = str.match(/(\d+)\./);
  return match ? match[1] : "";
};

const generateFrontMatterJSON = async () => {
  let frontMatterData = {};

  // Read existing data if available
  if (fs.existsSync(OUTPUT_FILE)) {
    const existingData = fs.readFileSync(OUTPUT_FILE, "utf8");
    try {
      frontMatterData = JSON.parse(existingData);
    } catch (error) {
      console.error("Error parsing existing front matter data:", error);
      frontMatterData = {};
    }
    console.log('Existing frontmatter: ', Object.keys(frontMatterData).length);
    if (Object.keys(frontMatterData).length === 0) {
      isDev = false;
    }
  }

  const allFiles = getAllFiles(CONTENT_DIRECTORY).filter(
    (file) => file.endsWith(".md") || file.endsWith(".mdx")
  );

  let filesToProcess = allFiles;

  if (isDev) {
    // In development mode, process only modified or untracked files
    const gitRoot = await git.revparse(["--show-toplevel"]);
    const status = await git.status();
    const modifiedFiles = status.modified.concat(status.not_added);
    const modifiedFilesAbs = modifiedFiles.map((file) =>
      path.resolve(gitRoot, file)
    );

    // Filter files within CONTENT_DIRECTORY
    filesToProcess = modifiedFilesAbs.filter((file) =>
      file.startsWith(CONTENT_DIRECTORY)
    );
  }

  // Create a set of relative paths of files to process
  const filesToProcessSet = new Set(
    filesToProcess.map((file) => path.relative(CONTENT_DIRECTORY, file))
  );

  // Process each file
  for (const file of filesToProcess) {
    const fileContent = fs.readFileSync(file, "utf8");
    const { data: frontMatter } = matter(fileContent);
    if (Object.keys(frontMatter).length > 0) {
      const relativePath = path.relative(CONTENT_DIRECTORY, file);
      const key = relativePath
        .replace(/\.(md|mdx)$/, "")
        .split("/")
        .pop();
      const keyWithoutLocale = key.replace(/\.[a-z]{2,3}$/, "");

      const updatedTime = isDev
        ? fs.statSync(file).mtime.toISOString()
        : await getLastCommitDate(file);

      frontMatterData[key] = {
        ...frontMatter,
        path: `/${relativePath.split(path.sep).slice(0, -1).join("/")}/`,
        updatedTime,
        relativePath,
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
            path: `/${newRelativePath
              .split(path.sep)
              .slice(0, -1)
              .join("/")}/`,
            fullPath: `/${newRelativePath
              .split(path.sep)
              .slice(0, -1)
              .join("/")}/${key}#${extractNumericBeforeDot(
              keyWithoutLocale
            )}${i}`,
            updatedTime,
            relativePath: newRelativePath,
          };
        }
      }
    }
  }

  // In dev mode, remove entries for deleted files
  if (isDev) {
    // Create a set of all existing relative paths
    const currentFilesSet = new Set(
      allFiles.map((file) => path.relative(CONTENT_DIRECTORY, file))
    );
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(frontMatterData, null, 2));
  console.log(
    `FrontMatter data written to ${OUTPUT_FILE} from ${Object.keys(
      frontMatterData
    ).length} entries`
  );
};

generateFrontMatterJSON();