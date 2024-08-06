const fs = require("fs");
const path = require("path");

// Natural sort function to handle numerical sorting
const naturalSort = (a, b) => {
  const aParts = a
    .split(/(\d+)/)
    .map((part) => (isNaN(part) ? part : parseInt(part, 10)));
  const bParts = b
    .split(/(\d+)/)
    .map((part) => (isNaN(part) ? part : parseInt(part, 10)));

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    if (aParts[i] === undefined) return -1;
    if (bParts[i] === undefined) return 1;
    if (aParts[i] < bParts[i]) return -1;
    if (aParts[i] > bParts[i]) return 1;
  }
  return 0;
};

// Special labels and ordering for the pages directory
const specialLabels = {
  index: {
    title: "Home",
    theme: {
      breadcrumb: false,
    },
  },
  sn: "Linked (SN)",
  an: "Numbered (AN)",
  mn: "Middle (MN)",
  snp: "Sutta Nipāta (SnP)",
  dhp: "DhammaPada (DhP)",
  iti: "As It Was Said (ITI)",
  ud: "Inspired Utterances (Ud)",
};

const specialOrder = ["index", "sn", "an", "mn", "snp", "dhp", "iti", "ud"];

const transformLabel = (name) => {
  // Capitalize all initial characters before the first number and add space before the first number
  return name.replace(
    /([a-zA-Z]+)(\d)/,
    (match, p1, p2) => `${p1.toUpperCase()} ${p2}`
  );
};

let enMetaCount = 0;
let pliMetaCount = 0;

const generateMetaFiles = (dir) => {
  const enMeta = {};
  const pliMeta = {};

  const items = fs.readdirSync(dir).sort(naturalSort);

  items.forEach((item) => {
    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);

    if (stat.isDirectory()) {
      // Recurse into the directory
      generateMetaFiles(itemPath);

      // Transform and add folder to both locales
      const folderName = path.basename(item).toLowerCase();
      const label = specialLabels[folderName] || transformLabel(folderName);
      enMeta[folderName] = label;
      pliMeta[folderName] = label;
    } else if (stat.isFile()) {
      const fileName = path.basename(item, path.extname(item));
      const pageName = fileName.toLowerCase().replace(/(\.en|\.pli)$/, "");
      const label = specialLabels[pageName] || transformLabel(pageName);

      if (item.endsWith(".en.md") || item.endsWith(".en.mdx")) {
        enMeta[pageName] = label;
        pliMeta[`${pageName}.en`] = { display: "hidden" };
      } else if (item.endsWith(".pli.md") || item.endsWith(".pli.mdx")) {
        pliMeta[pageName] = label;
        enMeta[`${pageName}.pli`] = { display: "hidden" };
      } else {
        const locale = path.extname(fileName).substring(1);
        enMeta[`${pageName}`] = {
          display: "hidden",
          theme: { pagination: false },
        };
        pliMeta[`${pageName}`] = { display: "hidden" };
      }
    }
  });

  // Apply special order and labels for the top-level directory
  if (dir === path.join(__dirname, "../pages")) {
    const enMetaOrdered = applySpecialOrder(enMeta);
    const pliMetaOrdered = applySpecialOrder(pliMeta);

    const enMetaPath = path.join(dir, "_meta.en.json");
    fs.writeFileSync(enMetaPath, JSON.stringify(enMetaOrdered, null, 2));
    enMetaCount++;

    const pliMetaPath = path.join(dir, "_meta.pli.json");
    fs.writeFileSync(pliMetaPath, JSON.stringify(pliMetaOrdered, null, 2));
    pliMetaCount++;
  } else {
    // Write meta files for other directories
    if (Object.keys(enMeta).length > 0) {
      const enMetaPath = path.join(dir, "_meta.en.json");
      fs.writeFileSync(enMetaPath, JSON.stringify(enMeta, null, 2));
      enMetaCount++;
    }
    if (Object.keys(pliMeta).length > 0) {
      const pliMetaPath = path.join(dir, "_meta.pli.json");
      fs.writeFileSync(pliMetaPath, JSON.stringify(pliMeta, null, 2));
      pliMetaCount++;
    }
  }
};

const applySpecialOrder = (meta) => {
  const orderedMeta = {};
  specialOrder.forEach((key) => {
    if (meta[key]) {
      orderedMeta[key] = meta[key];
    }
  });
  // Add any remaining items not in the special order
  Object.keys(meta).forEach((key) => {
    if (!orderedMeta[key]) {
      orderedMeta[key] = meta[key];
    }
  });
  return orderedMeta;
};

const startDir = path.join(__dirname, "../pages");
generateMetaFiles(startDir);

console.log(
  `Meta files generated successfully. EN: ${enMetaCount}, PLI: ${pliMetaCount}`
);
