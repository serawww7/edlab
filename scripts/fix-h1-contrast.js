// Прибирає transparent fill у h1 (Lighthouse Color Contrast) на сторінках-заняттях.
// Замінює градієнтний clip на суцільний доступний колір, зберігаючи розмір/відступи.
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

let n = 0;
for (const file of walk('.')) {
  let html = fs.readFileSync(file, 'utf8');
  if (!/-webkit-text-fill-color\s*:\s*transparent/i.test(html)) continue;

  // 1) У правилах h1: прибрати clip + transparent, додати/залишити color
  html = html.replace(/h1\s*\{([^}]*)\}/gi, (full, body) => {
    let b = body;
    // прибрати clip/fill
    b = b.replace(/-webkit-background-clip\s*:\s*text\s*;?/gi, '');
    b = b.replace(/background-clip\s*:\s*text\s*;?/gi, '');
    b = b.replace(/-webkit-text-fill-color\s*:\s*transparent\s*;?/gi, '');
    // прибрати gradient background що був лише для тексту
    b = b.replace(/background\s*:\s*linear-gradient\([^;]+\)\s*;?/gi, '');
    // якщо немає color — додати
    if (!/color\s*:/i.test(b)) {
      b += 'color:#93c5fd;';
    }
    return 'h1{' + b + '}';
  });

  // 2) Залишки transparent fill поза h1-блоком (напр. окремі рядки)
  html = html.replace(/-webkit-text-fill-color\s*:\s*transparent\s*;?/gi, '');
  html = html.replace(/background-clip\s*:\s*text\s*;?/gi, '');
  html = html.replace(/-webkit-background-clip\s*:\s*text\s*;?/gi, '');

  // 3) embedded override що скидає fill — лишаємо color:#111
  html = html.replace(
    /html\.embedded\s+h1\{[^}]*\}/gi,
    'html.embedded h1{background:none;color:#111;-webkit-text-fill-color:unset}'
  );

  fs.writeFileSync(file, html);
  n++;
}
console.log('Pages with h1 contrast fix:', n);
