const fs = require('fs');
const path = require('path');

// Special labels for the Nikaya directories
const specialLabels = {
  sn: 'Linked Discourses (SN)',
  an: 'Numbered Discourses (AN)',
  mn: 'Middle Length Discourses (MN)',
  snp: 'Sutta Nipāta (SnP)',
  dhp: 'Dhamma Pada (DhP)',
  iti: 'As It Was Said (ITI)',
  ud: 'Inspired Utterances (Ud)'
};

const countTranslations = (dir) => {
  let count = 0;

  const items = fs.readdirSync(dir);
  items.forEach(item => {
    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);

    if (stat.isDirectory()) {
      count += countTranslations(itemPath);
    } else if (stat.isFile() && (item.endsWith('.en.md') || item.endsWith('.en.mdx'))) {
      count++;
    }
  });

  return count;
};

const generateTranslationCounts = () => {
  const counts = {};

  Object.keys(specialLabels).forEach(folderName => {
    const dirPath = path.join(__dirname, '../pages', folderName);
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      counts[folderName] = {
        label: specialLabels[folderName],
        translationCount: countTranslations(dirPath)
      };
    }
  });

  const outputPath = path.join(__dirname, '../public/translationCounts.json');
  fs.writeFileSync(outputPath, JSON.stringify(counts, null, 2));

  console.log(`Translation counts generated successfully.`);
};

generateTranslationCounts();
