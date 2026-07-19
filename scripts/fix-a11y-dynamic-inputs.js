/**
 * A11y: aria-label для динамічних input/select/textarea у <script>,
 * createElement('input'), плюс покращення підписів за заголовками стовпців.
 */
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

function strip(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function typeFallback(attrs) {
  const type = ((attrs.match(/\btype\s*=\s*(["'])(.*?)\1/i) || [])[2] || 'text').toLowerCase();
  const map = {
    text: 'Текст',
    number: 'Число',
    date: 'Дата',
    time: 'Час',
    'datetime-local': 'Дата і час',
    email: 'Email',
    tel: 'Телефон',
    url: 'URL',
    search: 'Пошук',
    password: 'Пароль',
    range: 'Повзунок',
    checkbox: 'Прапорець',
    radio: 'Вибір',
    file: 'Файл',
    color: 'Колір',
    month: 'Місяць',
    week: 'Тиждень'
  };
  return map[type] || 'Поле';
}

function labelFromValueAttr(attrs) {
  // value="${s.name}" or value='${foo.bar}'
  const m = attrs.match(/\bvalue\s*=\s*(["'])\$\{([^}]+)\}\1/i);
  if (!m) return '';
  const expr = m[2].trim();
  // s.name / r.id / g.foo
  const prop = (expr.match(/\.([A-Za-z_][\w]*)$/) || [])[1];
  if (!prop) return '';
  const known = {
    name: 'Назва', id: 'ID', model: 'Модель', note: 'Нотатка', date: 'Дата',
    field: 'Поле', crop: 'Культура', weight: 'Вага', job: 'Тип робіт',
    hours: 'Години', parts: 'Матеріали', addr: 'Адреса', risk: 'Ризик',
    freq: 'Частота', ccp: 'Критичні точки', obj: 'Об’єкт', sol: 'Розчин',
    exp: 'Експозиція', ppe: 'ЗІЗ', tool: 'Інструмент', surf: 'Поверхня',
    val: 'Значення', thr: 'Поріг', q: 'Питання', w: 'Вага', s: 'Оцінка'
  };
  return known[prop] || prop.replace(/_/g, ' ');
}

function extractTheads(htmlNoScript) {
  const theads = [];
  const re = /<thead\b[^>]*>([\s\S]*?)<\/thead>/gi;
  let m;
  while ((m = re.exec(htmlNoScript))) {
    const labels = [...m[1].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((x) => strip(x[1]));
    if (labels.length) theads.push(labels);
  }
  return theads;
}

function pickThead(theads, tdCount) {
  if (!theads.length) return null;
  const exact = theads.find((t) => t.length === tdCount);
  if (exact) return exact;
  const ge = theads.filter((t) => t.length >= tdCount).sort((a, b) => a.length - b.length)[0];
  return ge || theads[0];
}

function addAriaToControl(tag, attrs, label) {
  if (/\baria-label\s*=/i.test(attrs) || /\baria-labelledby\s*=/i.test(attrs)) {
    return `<${tag}${attrs}>`;
  }
  const type = ((attrs.match(/\btype\s*=\s*(["'])(.*?)\1/i) || [])[2] || '').toLowerCase();
  if (type === 'hidden') return `<${tag}${attrs}>`;
  const lab = (label || typeFallback(attrs) || 'Поле').slice(0, 120);
  return `<${tag}${attrs} aria-label="${escAttr(lab)}">`;
}

function processTemplateFragment(frag, theads) {
  // If looks like a table row, map by columns
  if (/<t[dh]\b/i.test(frag)) {
    const tdCount = (frag.match(/<td\b/gi) || []).length;
    const ths = pickThead(theads, tdCount) || [];
    let col = -1;
    return frag.replace(/<(t[dh])(\b[^>]*)>([\s\S]*?)<\/\1>/gi, (cell, tag, cellAttrs, inner) => {
      col += 1;
      const colLabel = ths[col] || '';
      const newInner = inner.replace(/<(input|select|textarea)(\b[^>]*?)>/gi, (full, t, attrs) => {
        if (/\baria-label\s*=/i.test(attrs)) return full;
        const fromVal = labelFromValueAttr(attrs);
        return addAriaToControl(t, attrs, colLabel || fromVal || typeFallback(attrs));
      });
      return `<${tag}${cellAttrs}>${newInner}</${tag}>`;
    });
  }
  // Generic inputs in template
  return frag.replace(/<(input|select|textarea)(\b[^>]*?)>/gi, (full, t, attrs) => {
    if (/\baria-label\s*=/i.test(attrs)) return full;
    const fromVal = labelFromValueAttr(attrs);
    return addAriaToControl(t, attrs, fromVal || typeFallback(attrs));
  });
}

function processScript(scriptBody, theads) {
  let s = scriptBody;
  let n = 0;

  // Template literals that build rows/HTML with inputs
  s = s.replace(/(`)((?:\\`|[^`])*)(`)/g, (full, a, body, c) => {
    if (!/<(input|select|textarea)\b/i.test(body)) return full;
    const before = body;
    const after = processTemplateFragment(body, theads);
    if (after !== before) n++;
    return a + after + c;
  });

  // Quoted HTML strings with inputs (less common)
  s = s.replace(/(['"])((?:\\\1|(?!\1).)*<(?:input|select|textarea)\b(?:\\\1|(?!\1).)*)\1/gi, (full) => {
    // skip if too risky — template literals cover most cases
    return full;
  });

  // createElement('input') → ensure aria-label on common var names
  s = s.replace(
    /(const|let|var)\s+(input|inp)\s*=\s*document\.createElement\(\s*(['"])input\3\s*\)\s*;?/g,
    (full, kw, varName, q, offset, whole) => {
      const after = whole.slice(offset + full.length, offset + full.length + 160);
      if (/setAttribute\(\s*['"]aria-label['"]/i.test(after) || /setAttribute\(\s*['"]aria-label['"]/i.test(full)) {
        return full;
      }
      n++;
      return `${kw} ${varName}=document.createElement('input'); ${varName}.setAttribute('aria-label', (typeof key!=='undefined'&&key)?String(key): (typeof k!=='undefined'&&k)?String(k):'Редагування комірки');`;
    }
  );

  return { script: s, n };
}

function processFile(file) {
  const orig = fs.readFileSync(file, 'utf8');
  const theads = extractTheads(orig.replace(/<script[\s\S]*?<\/script>/gi, ''));
  let total = 0;
  const out = orig.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (full, open, body, close) => {
    if (/\bsrc\s*=/i.test(open)) return full;
    const r = processScript(body, theads);
    total += r.n;
    // Also count individual aria additions inside templates as changes even if n from createElement is 0
    if (r.script !== body) {
      if (!r.n) total += 1;
      return open + r.script + close;
    }
    return full;
  });
  if (out !== orig) {
    fs.writeFileSync(file, out, 'utf8');
    return total || 1;
  }
  return 0;
}

let files = 0, hits = 0;
for (const f of walk('.')) {
  const n = processFile(f);
  if (n) {
    files++;
    hits += n;
  }
}
console.log(`fix-a11y-dynamic-inputs: ${files} files, ~${hits} patches`);
