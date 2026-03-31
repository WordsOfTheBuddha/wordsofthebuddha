const fs = require('fs');
const path = require('path');

// Default: read drafts next to this script; write ../mn106.svg (parent = content-images).
const draftsDir = process.argv[2] || __dirname;
const outPath = process.argv[3] || path.join(__dirname, '..', 'mn106.svg');
const files = [
  '01-header.svg', '02-step1.svg', '03-step2.svg',
  '04-step3.svg', '05-step4.svg', '06-step5.svg',
  '07-step6.svg', '08-step7.svg', '09-nibbana.svg',
  '10-footer.svg'
];

// Content bounds [contentStart, contentEnd] — manually determined from each SVG.
// contentStart: y of first visual element; contentEnd: y of last element's bottom edge.
const bounds = [
  [22, 130],  // 01: title block
  [14, 359],  // 02: tier heading, Māra panel, 1ST WAY label, card bottom y=230+130=360
  [8, 149],   // 03: sub-label y14, card y=24+125=149
  [8, 164],   // 04: sub-label y14, card y=24+140=164
  [14, 202],  // 05: tier heading, 1ST WAY, card y=72+130=202
  [8, 154],   // 06: sub-label y14, card y=24+130=154
  [8, 154],   // 07: sub-label y14, card y=24+130=154
  [24, 188],  // 08: tier heading, 1ST WAY, card y=58+130=188
  [14, 650],  // 09: tier line y14, liberation panel bottom y650+55=705
  [14, 118],  // 10: exhortation top y14, lotus motif ~y118
];

const GAP = 28; // consistent visual gap between section contents (px)

// ── Compute y-offsets ──────────────────────────────────────────
const yOffsets = [0];
for (let i = 1; i < files.length; i++) {
  const prevEndGlobal = yOffsets[i - 1] + bounds[i - 1][1];
  const nextContentStart = bounds[i][0];
  yOffsets.push(prevEndGlobal + GAP - nextContentStart);
}

// ── Read and process each component ────────────────────────────
const components = [];

for (let i = 0; i < files.length; i++) {
  const f = files[i];
  const svg = fs.readFileSync(path.join(draftsDir, f), 'utf8');
  const prefix = 'c' + f.slice(0, 2) + '_';
  const height = parseInt(svg.match(/height="(\d+)"/)[1]);

  // Strip outer <svg> tags
  let inner = svg.replace(/<svg[^>]*>\s*/, '').replace(/\s*<\/svg>\s*$/, '');

  // Separate <defs> from body
  const defsMatch = inner.match(/<defs>([\s\S]*?)<\/defs>/);
  let defs = defsMatch ? defsMatch[1] : '';
  let body = inner.replace(/<defs>[\s\S]*?<\/defs>/, '');

  // Remove background rect (fill="url(#bg)")
  body = body.replace(/\s*<rect\s+width="920"\s+height="\d+"\s+fill="url\(#bg\)"\s*\/>/g, '');

  // Remove bg gradient from defs (we use one merged gradient)
  defs = defs.replace(/<linearGradient\s+id="bg"[\s\S]*?<\/linearGradient>/g, '');

  // ── Prefix all element IDs to avoid conflicts ──
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

// ── Compute total height ───────────────────────────────────────
const last = components[components.length - 1];
const totalHeight = last.yOffset + last.height;

// ── Assemble merged SVG ────────────────────────────────────────
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
