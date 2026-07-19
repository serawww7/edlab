// WCAG AA: пов'язує <label> з наступним input/select/textarea через for=id.
// Також: type="button" для кнопок з onclick; id="main-content" на <main>;
// aria-hidden на декоративних emoji у типових місцях не чіпаємо масово.
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

function processFile(file) {
  let html = fs.readFileSync(file, 'utf8');
  const orig = html;
  let labels = 0, buttons = 0, mains = 0;

  // 1) <main ...> → додати id="main-content" якщо немає id
  html = html.replace(/<main(\b[^>]*)>/gi, (full, attrs) => {
    if (/\bid\s*=/i.test(attrs)) return full;
    mains++;
    return `<main id="main-content"${attrs}>`;
  });

  // 2) <label>Text</label><input id="x"...>  (і з пробілами/переносами)
  //    також <label>Text</label>\n<input
  html = html.replace(
    /<label(\b(?![^>]*\bfor\s*=)[^>]*)>([\s\S]*?)<\/label>(\s*)<(input|select|textarea)(\b[^>]*\bid\s*=\s*(["'])([^"']+)\6[^>]*)>/gi,
    (full, labelAttrs, labelInner, ws, tag, ctrlAttrs, q, id) => {
      // не чіпати, якщо label вже містить контрол всередині
      if (/<(input|select|textarea)\b/i.test(labelInner)) return full;
      labels++;
      return `<label${labelAttrs} for="${id}">${labelInner}</label>${ws}<${tag}${ctrlAttrs}>`;
    }
  );

  // 3) Кнопки з onclick без type → type="button"
  html = html.replace(/<button(\b(?![^>]*\btype\s*=)[^>]*\bonclick\s*=[^>]*)>/gi, (full, attrs) => {
    buttons++;
    return `<button type="button"${attrs}>`;
  });
  // також звичайні <button class="btn"> без type (не submit у формах)
  html = html.replace(/<button(\b(?![^>]*\btype\s*=)(?![^>]*\bonclick\s*=)[^>]*)>/gi, (full, attrs) => {
    // skip if inside a form and looks like submit - hard; default to button for .btn
    if (/\bclass\s*=\s*(["'])[^"']*\bbtn\b/i.test(attrs) || /\bclass\s*=\s*(["'])[^"']*\btheme-toggle\b/i.test(attrs)) {
      buttons++;
      return `<button type="button"${attrs}>`;
    }
    return full;
  });

  if (html !== orig) fs.writeFileSync(file, html);
  return { labels, buttons, mains, changed: html !== orig };
}

let totals = { files: 0, labels: 0, buttons: 0, mains: 0 };
for (const f of walk('.')) {
  const r = processFile(f);
  if (r.changed) {
    totals.files++;
    totals.labels += r.labels;
    totals.buttons += r.buttons;
    totals.mains += r.mains;
  }
}
console.log(totals);
