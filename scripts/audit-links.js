/**
 * Аудит внутрішніх посилань: биті URL, «сироти» відносно статичних зв’язків + manifests.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IGNORE_DIRS = new Set(['node_modules', '.git', '.github', 'scripts']);

function walkHtml(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (IGNORE_DIRS.has(name)) continue;
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) walkHtml(abs, out);
    else if (/\.html$/i.test(name)) out.push(abs);
  }
  return out;
}

function toPosix(p) {
  return p.replace(/\\/g, '/');
}

function resolveHref(fromFile, href) {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return null;
  if (/^(https?:|data:|javascript:|blob:)/i.test(href)) {
    if (/^https?:\/\/edlab\.pp\.ua\//i.test(href)) {
      let p = href.replace(/^https?:\/\/edlab\.pp\.ua/i, '');
      p = p.split('#')[0].split('?')[0];
      if (p === '' || p === '/') return 'index.html';
      return p.replace(/^\//, '');
    }
    return null; // external
  }
  let clean = href.split('#')[0].split('?')[0];
  if (!clean) return null;
  if (clean.startsWith('/')) clean = clean.slice(1);
  else clean = toPosix(path.normalize(path.join(path.dirname(fromFile), clean)));
  if (clean === '' || clean.endsWith('/')) clean = (clean + 'index.html').replace(/^\//, '');
  return clean.replace(/\\/g, '/');
}

function extractHrefs(html) {
  const out = [];
  const re = /\b(?:href|src)=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

const htmlFiles = walkHtml(ROOT);
const allPages = new Set(htmlFiles.map((f) => toPosix(path.relative(ROOT, f))));
const linked = new Set();
const broken = [];

for (const abs of htmlFiles) {
  const rel = toPosix(path.relative(ROOT, abs));
  const html = fs.readFileSync(abs, 'utf8');
  // ignore links inside <script> print templates roughly by stripping scripts
  const noScript = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  for (const href of extractHrefs(noScript)) {
    const target = resolveHref(rel, href);
    if (!target) continue;
    if (!/\.html$/i.test(target) && !allPages.has(target)) {
      // non-html asset — check exists
      if (!fs.existsSync(path.join(ROOT, target)) && !fs.existsSync(path.join(ROOT, target.replace(/^\//, '')))) {
        // only report missing .html as broken links for SEO
        continue;
      }
      continue;
    }
    if (/\.html$/i.test(target)) {
      linked.add(target);
      if (!allPages.has(target) && !fs.existsSync(path.join(ROOT, target))) {
        broken.push({ from: rel, href, target });
      }
    }
  }
}

// Manifests link lessons dynamically
for (const man of [
  'assets/manifest.json',
  'agro_II_kyrs/manifest.json',
  'elect_II_kyrs/manifest.json',
  'mech_II_kyrs/manifest.json',
  'gas_II_kyrs/manifest.json',
  'tech_II_kyrs/manifest.json',
  'coach/manifest.json'
]) {
  const p = path.join(ROOT, man);
  if (!fs.existsSync(p)) continue;
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    const stack = [j];
    while (stack.length) {
      const cur = stack.pop();
      if (!cur) continue;
      if (Array.isArray(cur)) cur.forEach((x) => stack.push(x));
      else if (typeof cur === 'object') {
        for (const [k, v] of Object.entries(cur)) {
          if (typeof v === 'string' && /\.html$/i.test(v)) {
            let t = v.replace(/^\//, '');
            if (!t.includes('/')) {
              // relative to section folder
              const dir = path.dirname(man);
              if (dir !== '.') t = toPosix(path.join(dir, t));
            }
            linked.add(t.replace(/\\/g, '/'));
          } else stack.push(v);
        }
      }
    }
  } catch (_) { /* ignore */ }
}

// Shell always "linked"
['index.html', 'about.html', 'legal.html', 'spec.html'].forEach((p) => linked.add(p));

const skipOrphan = new Set(['print-ticket.html']);
const orphans = [...allPages].filter((p) => !linked.has(p) && !skipOrphan.has(p) && !p.startsWith('tools/'));

console.log(JSON.stringify({
  pages: allPages.size,
  broken: broken.length,
  brokenSample: broken.slice(0, 10),
  orphans: orphans.length,
  orphanSample: orphans.slice(0, 15)
}, null, 2));
