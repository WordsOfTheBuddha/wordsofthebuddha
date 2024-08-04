const fs = require("fs");
const path = require("path");

// Special labels for the Nikaya directories
const specialLabels = {
  sn: "Linked Discourses (SN)",
  an: "Numbered Discourses (AN)",
  mn: "Middle Length Discourses (MN)",
  snp: "Sutta Nipāta (SnP)",
  dhp: "Dhamma Pada (DhP)",
  iti: "As It Was Said (ITI)",
  ud: "Inspired Utterances (Ud)",
};

// Load the frontMatter.json file
const frontMatterPath = path.join(__dirname, "../public/frontMatter.json");
const frontMatter = JSON.parse(fs.readFileSync(frontMatterPath, "utf-8"));

const countTranslations = () => {
  const counts = {};

  // Iterate over each key in frontMatter
  Object.keys(frontMatter).forEach((key) => {
    if (key.endsWith(".en") && !key.includes("-")) {
      // Extract the prefix from the key to match with specialLabels
      const prefix = key.match(/^[a-z]+/)[0]; // Match all leading alphabet characters

      if (specialLabels[prefix]) {
        // Initialize the count for this prefix if not already
        if (!counts[prefix]) {
          counts[prefix] = {
            label: specialLabels[prefix],
            translationCount: 0,
          };
        }

        // Increment the count for this prefix
        counts[prefix].translationCount++;
      }
    }
  });

  return counts;
};

const generateTranslationCounts = () => {
  const counts = countTranslations();
  const orderedCounts = {};
  Object.keys(specialLabels).forEach((key) => {
    if (counts[key]) {
      orderedCounts[key] = counts[key];
    }
  });

  const outputPath = path.join(__dirname, "../public/translationCounts.json");
  fs.writeFileSync(outputPath, JSON.stringify(orderedCounts, null, 2));

  console.log("Translation counts generated successfully.");
};

generateTranslationCounts();
