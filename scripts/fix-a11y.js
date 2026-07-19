// Виправляє пропуски рівнів заголовків + замінює слабкі muted-кольори.
// Зовнішній вигляд зберігається CSS-правилами .tile h2 / .ticket h3.
const fs = require('fs');
const path = require('path');
const SKIP = new Set(['node_modules', '.git', 'tools', 'scripts']);

function walk(d, out = []) {
  for (const f of fs.readdirSync(d)) {
    if (SKIP.has(f)) continue;
    const p = path.join(d, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.html$/i.test(f)) out.push(p);
  }
  return out;
}

function stripNoise(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '')
             .replace(/<style[\s\S]*?<\/style>/gi, '');
}

function headingLevels(html) {
  const clean = stripNoise(html);
  const out = [];
  const re = /<(h[1-6])\b[^>]*>/gi;
  let m;
  while ((m = re.exec(clean))) out.push(+m[1][1]);
  return out;
}

function hasSkip(levels) {
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] > levels[i - 1] + 1) return true;
  }
  return false;
}

const files = walk('.');
let headingFixed = 0;
let colorFixed = 0;
const headingLog = [];

for (const file of files) {
  let html = fs.readFileSync(file, 'utf8');
  let changed = false;
  const rel = file.replace(/\\/g, '/');

  // ---- Color contrast: failing muted grays on dark UI ----
  // #6b7280 ≈ 3.7:1 on dark cards → #94a3b8 ≈ 7:1
  if (html.includes('#6b7280')) {
    html = html.replace(/#6b7280/gi, '#94a3b8');
    changed = true;
    colorFixed++;
  }
  // #64748b on dark lesson pages (not light-theme token in core)
  // Only replace in lesson dirs / when used as CSS color on dark pages
  if (/agro_|elect_|gas_|mech_|tech_|coach\//.test(rel) && html.includes('#64748b')) {
    html = html.replace(/#64748b/gi, '#94a3b8');
    changed = true;
    colorFixed++;
  }

  // ---- Heading order ----
  // index.html: tile h3 → h2 (after h1)
  if (rel === 'index.html' || rel.endsWith('/index.html')) {
    const before = html;
    // Only h3 inside tiles
    html = html.replace(
      /(<a class="tile"[^>]*>\s*)<h3>/g,
      '$1<h2>'
    ).replace(
      /(<\/h3>)(\s*<p>[\s\S]*?<\/p>\s*<span class="badge2">)/g,
      (m, a, b) => {
        // safer: already changed opens; fix closes for tiles
        return m;
      }
    );
    // Fix closing tags for tiles: match <h2>...content...</h3> → </h2>
    html = html.replace(/<h2>([^<]*)<\/h3>/g, '<h2>$1</h2>');
    if (html !== before) {
      changed = true;
      headingFixed++;
      headingLog.push(rel + ': tile h3→h2');
    }
  }

  // Pages with h2→h4 (usually ticket titles): demote h4→h3 and mirror CSS
  const levels = headingLevels(html);
  if (hasSkip(levels)) {
    const before = html;
    // Change ticket-like h4 to h3 (most common skip)
    html = html.replace(/<h4(\b[^>]*)>/gi, '<h3$1>');
    html = html.replace(/<\/h4>/gi, '</h3>');
    // Update inline CSS selectors .ticket h4 → .ticket h3 (keep both if needed)
    html = html.replace(/\.ticket\s+h4\b/g, '.ticket h3');
    html = html.replace(/\.ticket\s*h4\b/g, '.ticket h3');
    // Generic "h4{" in style blocks that only styled tickets
    if (html !== before) {
      changed = true;
      if (!headingLog.some(l => l.startsWith(rel))) {
        headingFixed++;
        headingLog.push(rel + ': h4→h3 (skip fix)');
      }
    }
  }

  if (changed) fs.writeFileSync(file, html);
}

console.log('Color files touched:', colorFixed);
console.log('Heading pages fixed:', headingFixed);
headingLog.forEach(l => console.log(' ', l));

// Re-check skips
let remaining = 0;
for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const lv = headingLevels(html);
  if (hasSkip(lv)) {
    remaining++;
    console.log('STILL SKIP:', file.replace(/\\/g, '/'), lv.join('→'));
  }
}
console.log('Remaining skips:', remaining);
