const fs = require('fs');
const path = require('path');

// Default: read drafts next to this script; write ../mn10.svg (parent = content-images).
const draftsDir = process.argv[2] || __dirname;
const outPath = process.argv[3] || path.join(__dirname, '..', 'mn10.svg');
const files = [
  '01-title-overview.svg', '02-body.svg', '03-feelings.svg',
  '04-mind.svg', '05-hindrances.svg', '06-aggregates.svg',
  '07-sense-bases.svg', '08-awakening-factors.svg',
  '09-noble-truths.svg', '10-refrain-fruits-footer.svg'
];

// Content bounds [contentStart, contentEnd] — manually determined from each SVG.
// contentStart: y of first visual element; contentEnd: y of last element's bottom edge.
const bounds = [
  [22, 334],  // 01: title visual ~y22, last text y332+descent
  [14, 300],  // 02: tier line y14, last card rect bottom y296
  [14, 244],  // 03: tier line, last row rect y198+h36=234
  [20, 435],  // 04: title visual ~y32, last knob cy429+r5.5
  [4, 214],  // 05: tier line y34, hindrance card rects y114+h100=214
  [14, 142],  // 06: tier line, card rects y90+h52=142
  [14, 258],  // 07: tier line, card rects y186+h72=258
  [14, 148],  // 08: tier line, card rects y96+h52=148
  [14, 152],  // 09: tier line, card rects y84+h68=152
  [14, 418],  // 10: tier line, lotus motif ~y418
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
