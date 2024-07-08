const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const simpleGit = require('simple-git');

const CONTENT_DIRECTORY = path.join(__dirname, '..', 'pages');
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'frontMatter.json');

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
    return log.latest ? new Date(log.latest.date).toISOString() : new Date().toISOString();
  } catch (error) {
    console.error(`Error fetching git log for ${filePath}:`, error);
    return new Date().toISOString();;
  }
};

const generateFrontMatterJSON = async () => {
  const files = getAllFiles(CONTENT_DIRECTORY).filter(file => file.endsWith('.md') || file.endsWith('.mdx'));
  const frontMatterData = {};
  let frontMatterCount = 0;

  for (const file of files) {
    const fileContent = fs.readFileSync(file, 'utf8');
    const { data: frontMatter } = matter(fileContent);
    if (Object.keys(frontMatter).length > 0) {
      const relativePath = path.relative(CONTENT_DIRECTORY, file);
      const key = relativePath.replace(/\.(md|mdx)$/, '').split('/').pop();
      const updatedTime = await getLastCommitDate(file);
      frontMatterData[key] = { ...frontMatter, path: `/${relativePath.split(path.sep).slice(0, -1).join('/')}/`, updatedTime };
      frontMatterCount++;
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(frontMatterData, null, 2));
  console.log(`FrontMatter data written to ${OUTPUT_FILE} from ${frontMatterCount} files`);
};

generateFrontMatterJSON();