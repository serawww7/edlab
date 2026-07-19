// Додає <meta name="description"> сторінкам, де його немає (без cheerio).
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

function decode(s) {
  return (s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function trim155(s) {
  const t = decode(s);
  return t.length > 155 ? t.slice(0, 155).trimEnd() : t;
}

let n = 0;
for (const file of walk('.')) {
  let html = fs.readFileSync(file, 'utf8');
  if (/<meta[^>]*name=["']description["']/i.test(html)) continue;

  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const h1M = html.replace(/<script[\s\S]*?<\/script>/gi, '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const pM = html.replace(/<script[\s\S]*?<\/script>/gi, '').match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const raw = (h1M && h1M[1]) || (pM && pM[1]) || (titleM && titleM[1]) || 'Навчальний матеріал EDLab';
  const desc = trim155(raw.replace(/<[^>]+>/g, ''));
  if (!desc) continue;

  const meta = `<meta name="description" content="${desc.replace(/"/g, '&quot;')}">`;
  if (/<\/title>/i.test(html)) {
    html = html.replace(/<\/title>/i, `</title>\n${meta}`);
  } else if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, (m) => m + '\n' + meta);
  } else continue;

  fs.writeFileSync(file, html);
  n++;
}
console.log('meta description додано до', n, 'сторінок');
