const fs = require('fs');
const path = require('path');

const draftsDir = process.argv[2] || __dirname;
const outPath = process.argv[3] || path.join(__dirname, '..', 'mn39.svg');
const files = [
  '01-header.svg',
  '02-training-staircase.svg',
  '03-five-hindrances.svg',
  '04-jhanas.svg',
  '05-three-knowledges.svg',
  '06-epithets-footer.svg'
];

// Content bounds [contentStart, contentEnd] — measured from each part SVG.
const bounds = [
  [22, 130],  // 01: title y38 to tagline y122+8
  [14, 777],  // 02: tier line y14 to step7 bottom y695+82
  [14, 670],  // 03: bridge text y20 to summary bottom y656+14
  [14, 468],  // 04: tier y14 to outer jhāna rect bottom (y52+416)
  [14, 300],  // 05: mind-state y18 to liberation + Pali footer y420+
  [14, 476],  // 06: content through lotus (~y474)
];

const GAP = 28;

const yOffsets = [0];
for (let i = 1; i < files.length; i++) {
  const prevEndGlobal = yOffsets[i - 1] + bounds[i - 1][1];
  const nextContentStart = bounds[i][0];
  yOffsets.push(prevEndGlobal + GAP - nextContentStart);
}

const components = [];

for (let i = 0; i < files.length; i++) {
  const f = files[i];
  const svg = fs.readFileSync(path.join(draftsDir, f), 'utf8');
  const prefix = 'c' + f.slice(0, 2) + '_';
  const height = parseInt(svg.match(/height="(\d+)"/)[1]);

  let inner = svg.replace(/<svg[^>]*>\s*/, '').replace(/\s*<\/svg>\s*$/, '');

  const defsMatch = inner.match(/<defs>([\s\S]*?)<\/defs>/);
  let defs = defsMatch ? defsMatch[1] : '';
  let body = inner.replace(/<defs>[\s\S]*?<\/defs>/, '');

  body = body.replace(/\s*<rect\s+width="920"\s+height="\d+"\s+fill="url\(#bg\)"\s*\/>/g, '');
  defs = defs.replace(/<linearGradient\s+id="bg"[\s\S]*?<\/linearGradient>/g, '');

  const ids = new Set();
  const combined = defs + body;
  const idRegex = /\bid="([^"]+)"/g;
  let m;
  while ((m = idRegex.exec(combined)) !== null) ids.add(m[1]);

  for (const id of ids) {
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefixed = prefix + id;
    const rId  = new RegExp(`id="${esc}"`, 'g');
    const rUrl = new RegExp(`url\\(#${esc}\\)`, 'g');
    const rHr  = new RegExp(`href="#${esc}"`, 'g');
    defs = defs.replace(rId, `id="${prefixed}"`).replace(rUrl, `url(#${prefixed})`).replace(rHr, `href="#${prefixed}"`);
    body = body.replace(rId, `id="${prefixed}"`).replace(rUrl, `url(#${prefixed})`).replace(rHr, `href="#${prefixed}"`);
  }

  components.push({ file: f, height, defs: defs.trim(), body: body.trim(), yOffset: yOffsets[i] });
}

const last = components[components.length - 1];
const totalHeight = last.yOffset + last.height;

let allDefs = `    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0b1528" />
      <stop offset="30%" stop-color="#0e1a30" />
      <stop offset="100%" stop-color="#101e36" />
    </linearGradient>`;

for (const c of components) {
  if (c.defs) allDefs += `\n\n    <!-- ${c.file} -->\n    ${c.defs}`;
}

let mergedBody = `  <rect width="920" height="${totalHeight}" fill="url(#bg)" />\n`;

for (const c of components) {
  mergedBody += `\n  <!-- ═══ ${c.file} (y=${c.yOffset}) ═══ -->\n`;
  mergedBody += `  <g transform="translate(0,${c.yOffset})">\n`;
  mergedBody += `    ${c.body}\n`;
  mergedBody += `  </g>\n`;
}

const merged = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 920 ${totalHeight}" width="920" height="${totalHeight}">
  <defs>
${allDefs}
  </defs>

${mergedBody}
</svg>`;

fs.writeFileSync(outPath, merged, 'utf8');

console.log('✓ Merged SVG written to:', outPath);
console.log('  Total height:', totalHeight, 'px');
console.log('  Visual gap between sections:', GAP, 'px');
console.log('  Section offsets:');
for (let i = 0; i < components.length; i++) {
  const c = components[i];
  const gap = i > 0 ? `gap=${c.yOffset + bounds[i][0] - yOffsets[i-1] - bounds[i-1][1]}px` : 'top';
  console.log(`    ${c.file}: y=${c.yOffset} h=${c.height} [${gap}]`);
}
