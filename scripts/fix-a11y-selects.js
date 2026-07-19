/** Добиває залишкові <select>/<input> без aria-label всередині <script>. */
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

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function typeLab(attrs) {
  const type = ((attrs.match(/\btype\s*=\s*(["'])(.*?)\1/i) || [])[2] || '').toLowerCase();
  if (type === 'hidden') return null;
  if (!type) return 'Вибір'; // select
  const map = {
    text: 'Текст', number: 'Число', date: 'Дата', time: 'Час', file: 'Файл',
    checkbox: 'Прапорець', radio: 'Вибір', range: 'Повзунок'
  };
  return map[type] || 'Поле';
}

let files = 0, n = 0;
for (const f of walk('.')) {
  const orig = fs.readFileSync(f, 'utf8');
  const out = orig.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (full, open, body, close) => {
    if (/\bsrc\s*=/i.test(open)) return full;
    const next = body.replace(/<(input|select|textarea)(\b[^>]*?)>/gi, (m, tag, attrs) => {
      if (/\baria-label\s*=/i.test(attrs) || /\baria-labelledby\s*=/i.test(attrs)) return m;
      if (/type\s*=\s*(["'])hidden\1/i.test(attrs)) return m;
      let lab = 'Поле';
      if (tag.toLowerCase() === 'select') {
        if (/soapSel/i.test(attrs)) lab = 'Тип мийного засобу';
        else if (/selId|id=\"\$\{/i.test(attrs)) lab = 'Вибір значення';
        else lab = 'Вибір';
      } else {
        lab = typeLab(attrs) || 'Поле';
      }
      // allergen selects in tech
      if (/allergen/i.test(body.slice(Math.max(0, body.indexOf(m) - 80), body.indexOf(m) + 80))) {
        lab = 'Алерген';
      }
      n++;
      return `<${tag}${attrs} aria-label="${esc(lab)}">`;
    });
    return open + next + close;
  });
  if (out !== orig) {
    fs.writeFileSync(f, out, 'utf8');
    files++;
  }
}
console.log(`fix-a11y-selects: ${files} files, ${n} controls`);
