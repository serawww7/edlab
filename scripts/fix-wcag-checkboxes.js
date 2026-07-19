// Чекбокси/радіо без імені + декоративні SVG без aria-hidden.
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

function processPart(html) {
  let n = 0;

  // SVG without accessible attrs → decorative
  html = html.replace(/<svg\b([^>]*)>/gi, (full, attrs) => {
    if (/\baria-hidden\s*=/i.test(attrs) || /\brole\s*=/i.test(attrs) || /\baria-label\s*=/i.test(attrs)) return full;
    n++;
    return `<svg${attrs} aria-hidden="true" focusable="false">`;
  });

  // checkbox/radio with data-name
  html = html.replace(/<(input)(\b[^>]*\btype\s*=\s*(["'])(checkbox|radio)\3[^>]*)>/gi, (full, tag, attrs) => {
    if (/\baria-label\s*=/i.test(attrs) || /\baria-labelledby\s*=/i.test(attrs) || /\btitle\s*=/i.test(attrs)) return full;
    const id = (attrs.match(/\bid\s*=\s*(["'])([^"']+)\1/i) || [])[2];
    if (id && new RegExp(`<label[^>]*\\bfor\\s*=\\s*(["'])${id}\\1`, 'i').test(html)) return full;

    const dataName = (attrs.match(/\bdata-name\s*=\s*(["'])([^"']*)\1/i) || [])[2];
    const val = (attrs.match(/\bvalue\s*=\s*(["'])([^"']*)\1/i) || [])[2];
    const dataId = (attrs.match(/\bdata-id\s*=\s*(["'])([^"']*)\1/i) || [])[2];
    const label = (dataName || val || dataId || id || 'Опція').trim();
    n++;
    return `<${tag}${attrs} aria-label="${label.replace(/"/g, '&quot;')}">`;
  });

  // checkbox without type attr written as type=checkbox already covered
  // bare <input type="checkbox"/> without any name
  html = html.replace(/<input(\b[^>]*\btype\s*=\s*(["'])checkbox\2[^>]*)>/gi, (full, attrs) => {
    if (/\baria-label\s*=/i.test(attrs) || /\btitle\s*=/i.test(attrs)) return full;
    // already handled above in same pass - skip if just added
    return full;
  });

  return { html, n };
}

// More careful checkbox pass: any checkbox missing aria-label and not having for= label
function processFile(html) {
  let total = 0;
  const parts = html.split(/(<script[\s\S]*?<\/script>)/gi);
  const out = parts.map((part) => {
    if (/^<script/i.test(part)) return part;
    let p = part;
    let n = 0;

    p = p.replace(/<svg\b([^>]*)>/gi, (full, attrs) => {
      if (/\baria-hidden\s*=/i.test(attrs) || /\brole\s*=/i.test(attrs) || /\baria-label\s*=/i.test(attrs)) return full;
      n++;
      return `<svg${attrs} aria-hidden="true" focusable="false">`;
    });

    p = p.replace(/<input\b([^>]*\btype\s*=\s*(["'])(checkbox|radio)\2[^>]*)>/gi, (full, attrs) => {
      if (/\baria-label\s*=/i.test(attrs) || /\baria-labelledby\s*=/i.test(attrs) || /\btitle\s*=/i.test(attrs)) return full;
      const id = (attrs.match(/\bid\s*=\s*(["'])([^"']+)\1/i) || [])[2];
      if (id) {
        const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`<label[^>]*\\bfor\\s*=\\s*(["'])${esc}\\1`, 'i').test(p)) return full;
      }
      // wrapped in label? check nearby — if <label> before without close, skip
      // Use attributes for name
      const dataName = (attrs.match(/\bdata-name\s*=\s*(["'])([^"']*)\1/i) || [])[2];
      const val = (attrs.match(/\bvalue\s*=\s*(["'])([^"']*)\1/i) || [])[2];
      const dataId = (attrs.match(/\bdata-id\s*=\s*(["'])([^"']*)\1/i) || [])[2];
      const cls = (attrs.match(/\bclass\s*=\s*(["'])([^"']*)\1/i) || [])[2] || '';
      let label = (dataName || val || dataId || id || '').trim();
      if (!label) {
        if (/\bppe\b/i.test(cls)) label = 'ЗІЗ';
        else if (/\bmission\b/i.test(cls)) label = 'Місія';
        else if (/\bcrit\b/i.test(cls)) label = 'Критерій';
        else if (/\brule\b/i.test(cls)) label = 'Правило';
        else if (/\bchk\b|\bcl\b/i.test(cls)) label = 'Пункт';
        else label = 'Прапорець';
      }
      n++;
      return `<input${attrs} aria-label="${label.replace(/"/g, '&quot;')}">`;
    });

    // number/text without id still missing — add generic aria from value
    p = p.replace(/<(input|textarea)\b([^>]*?)(\/?)>/gi, (full, tag, attrs, slash) => {
      const type = ((attrs.match(/\btype\s*=\s*(["'])(.*?)\1/i) || [])[2] || (tag === 'textarea' ? 'text' : 'text')).toLowerCase();
      if (['hidden', 'submit', 'button', 'reset', 'image', 'checkbox', 'radio'].includes(type)) return full;
      if (/\baria-label\s*=/i.test(attrs) || /\baria-labelledby\s*=/i.test(attrs) || /\btitle\s*=/i.test(attrs)) return full;
      const id = (attrs.match(/\bid\s*=\s*(["'])([^"']+)\1/i) || [])[2];
      if (id) {
        const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`<label[^>]*\\bfor\\s*=\\s*(["'])${esc}\\1`, 'i').test(p)) return full;
      }
      if (id) return full; // already handled by previous script
      const ph = (attrs.match(/\bplaceholder\s*=\s*(["'])([^"']*)\1/i) || [])[2];
      const val = (attrs.match(/\bvalue\s*=\s*(["'])([^"']*)\1/i) || [])[2];
      const label = (ph || val || (type === 'number' ? 'Числове значення' : 'Текстове поле')).trim().slice(0, 80);
      n++;
      return `<${tag}${attrs} aria-label="${label.replace(/"/g, '&quot;')}"${slash}>`;
    });

    total += n;
    return p;
  });
  // fix: total is outer - need return n from map
  return { html: out.join(''), n: total };
}

let files = 0, total = 0;
for (const f of walk('.')) {
  const orig = fs.readFileSync(f, 'utf8');
  // rewrite processFile to return count properly
  const parts = orig.split(/(<script[\s\S]*?<\/script>)/gi);
  let n = 0;
  const out = parts.map((part) => {
    if (/^<script/i.test(part)) return part;
    let p = part;
    p = p.replace(/<svg\b([^>]*)>/gi, (full, attrs) => {
      if (/\baria-hidden\s*=/i.test(attrs) || /\brole\s*=/i.test(attrs) || /\baria-label\s*=/i.test(attrs)) return full;
      n++;
      return `<svg${attrs} aria-hidden="true" focusable="false">`;
    });
    p = p.replace(/<input\b([^>]*\btype\s*=\s*(["'])(checkbox|radio)\2[^>]*)>/gi, (full, attrs) => {
      if (/\baria-label\s*=/i.test(attrs) || /\baria-labelledby\s*=/i.test(attrs) || /\btitle\s*=/i.test(attrs)) return full;
      const id = (attrs.match(/\bid\s*=\s*(["'])([^"']+)\1/i) || [])[2];
      if (id) {
        const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`<label[^>]*\\bfor\\s*=\\s*(["'])${esc}\\1`, 'i').test(p)) return full;
      }
      const dataName = (attrs.match(/\bdata-name\s*=\s*(["'])([^"']*)\1/i) || [])[2];
      const val = (attrs.match(/\bvalue\s*=\s*(["'])([^"']*)\1/i) || [])[2];
      const dataId = (attrs.match(/\bdata-id\s*=\s*(["'])([^"']*)\1/i) || [])[2];
      const cls = (attrs.match(/\bclass\s*=\s*(["'])([^"']*)\1/i) || [])[2] || '';
      let label = (dataName || val || dataId || id || '').trim();
      if (!label) {
        if (/\bppe\b/i.test(cls)) label = 'ЗІЗ';
        else if (/\bmission\b/i.test(cls)) label = 'Місія';
        else if (/\bcrit\b/i.test(cls)) label = 'Критерій';
        else if (/\brule\b/i.test(cls)) label = 'Правило';
        else if (/\bchk\b|\bcl\b/i.test(cls)) label = 'Пункт перевірки';
        else label = 'Прапорець';
      }
      n++;
      return `<input${attrs} aria-label="${label.replace(/"/g, '&quot;')}">`;
    });
    p = p.replace(/<(input|textarea)\b([^>]*?)(\/?)>/gi, (full, tag, attrs, slash) => {
      const type = ((attrs.match(/\btype\s*=\s*(["'])(.*?)\1/i) || [])[2] || (tag === 'textarea' ? 'text' : 'text')).toLowerCase();
      if (['hidden', 'submit', 'button', 'reset', 'image', 'checkbox', 'radio'].includes(type)) return full;
      if (/\baria-label\s*=/i.test(attrs) || /\baria-labelledby\s*=/i.test(attrs) || /\btitle\s*=/i.test(attrs)) return full;
      const id = (attrs.match(/\bid\s*=\s*(["'])([^"']+)\1/i) || [])[2];
      if (id) {
        const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`<label[^>]*\\bfor\\s*=\\s*(["'])${esc}\\1`, 'i').test(p)) return full;
        return full;
      }
      const ph = (attrs.match(/\bplaceholder\s*=\s*(["'])([^"']*)\1/i) || [])[2];
      const val = (attrs.match(/\bvalue\s*=\s*(["'])([^"']*)\1/i) || [])[2];
      const label = (ph || (val && val.length < 60 ? val : '') || (type === 'number' ? 'Числове значення' : 'Текстове поле')).trim().slice(0, 80);
      n++;
      return `<${tag}${attrs} aria-label="${label.replace(/"/g, '&quot;')}"${slash}>`;
    });
    return p;
  }).join('');

  if (n) {
    fs.writeFileSync(f, out);
    files++;
    total += n;
  }
}
console.log({ files, fixes: total });
