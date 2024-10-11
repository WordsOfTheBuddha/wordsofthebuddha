const fs = require("fs");
const path = require("path");

// Special labels for the Nikaya directories
const specialLabels = {
  sn: "Linked Discourses (SN)",
  an: "Numbered Discourses (AN)",
  mn: "Middle Length Discourses (MN)",
  dhp: "Dhamma Pada (DhP)",
  snp: "Sutta Nipāta (SnP)",
  iti: "As It Was Said (ITI)",
  ud: "Inspired Utterances (Ud)",
};

// Load the frontMatter.json file
const frontMatterPath = path.join(__dirname, "../public/frontMatter.json");
const frontMatter = JSON.parse(fs.readFileSync(frontMatterPath, "utf-8"));

// Define the countTranslations function
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

// Define the generateTranslationCounts function
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

  // Path to NikayaTable.js
  const nikayaTablePath = path.join(__dirname, "../components/NikayaTable.js");

  // If the file doesn't exist, create and initialize it
  if (!fs.existsSync(nikayaTablePath)) {
    const initialContent = `
import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import styles from "/styles/NikayaTable.module.css";

const fallbackTranslationsCounts = ${JSON.stringify(orderedCounts, null, 2)};

export const NikayaTable = () => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
      setData(fallbackTranslationsCounts);
  }, []);

  if (!mounted || !data) {
    return <p>Loading...</p>;
  }

  return (
    <div
      className={\`\${styles.tableContainer} \${resolvedTheme === "dark" ? styles["dark-theme"] : styles["light-theme"]}\`}
    >
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Section</th>
            <th>English Translation Count</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(data).map((key) => (
            <tr key={key}>
              <td>
                <a href={key}>{data[key].label}</a>
              </td>
              <td>{data[key].translationCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default NikayaTable;
`;
    fs.writeFileSync(nikayaTablePath, initialContent.trim());
    console.log("NikayaTable.js initialized successfully.");
    return;
  }

  // Update fallbackTranslationsCounts if file already exists
  let nikayaTableContent = fs.readFileSync(nikayaTablePath, "utf-8");

  const fallbackStart = nikayaTableContent.indexOf(
    "const fallbackTranslationsCounts = {"
  );
  const fallbackEnd = nikayaTableContent.indexOf("};", fallbackStart) + 2;

  const newFallbackTranslationsCounts = `const fallbackTranslationsCounts = ${JSON.stringify(
    orderedCounts,
    null,
    2
  )};`;
  nikayaTableContent =
    nikayaTableContent.slice(0, fallbackStart) +
    newFallbackTranslationsCounts +
    nikayaTableContent.slice(fallbackEnd);

  fs.writeFileSync(nikayaTablePath, nikayaTableContent);
  console.log("NikayaTable.js updated successfully.");
};

// Call the function to generate translation counts
generateTranslationCounts();
