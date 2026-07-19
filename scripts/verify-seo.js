const fs = require('fs');
const path = require('path');

function walk(d, a = []) {
  for (const n of fs.readdirSync(d)) {
    if (['node_modules', '.git', 'scripts', 'tools'].includes(n)) continue;
    const p = path.join(d, n);
    const s = fs.statSync(p);
    if (s.isDirectory()) walk(p, a);
    else if (n.endsWith('.html')) a.push(p);
  }
  return a;
}

const titles = {};
const canons = {};
const issues = [];

for (const f of walk('.')) {
  const h = fs.readFileSync(f, 'utf8');
  if (/content="noindex/i.test(h)) continue;
  const t = (h.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1];
  const c = (h.match(/rel="canonical"[^>]*href="([^"]+)"/i) ||
    h.match(/href="([^"]+)"[^>]*rel="canonical"/i) || [])[1];
  const rob = /name="robots"[^>]*content="index, follow"/i.test(h);
  const tw = /name="twitter:card"/i.test(h);
  const pub = /name="publisher"/i.test(h);
  const auth = /name="author"/i.test(h);
  const ld = /edlab-ld-primary/i.test(h);
  const ogImg = /property="og:image"/i.test(h);
  const man = /site\.webmanifest/i.test(h);
  if (!rob || !tw || !pub || !auth || !ld || !c || !ogImg || !man) {
    issues.push(path.relative('.', f));
  }
  if (t) {
    titles[t] = titles[t] || [];
    titles[t].push(path.relative('.', f));
  }
  if (c) canons[c] = (canons[c] || 0) + 1;
}

const dupT = Object.entries(titles).filter(([, a]) => a.length > 1);
const dupC = Object.entries(canons).filter(([, n]) => n > 1);

console.log({
  indexedChecked: Object.values(titles).flat().length,
  dupTitles: dupT.length,
  dupTitleSample: dupT.slice(0, 5).map(([t, a]) => ({ title: t.slice(0, 50), n: a.length })),
  dupCanons: dupC,
  missingTagPages: issues.length,
  missingSample: issues.slice(0, 8)
});
