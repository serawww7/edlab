// Другий прохід: знайти input/select/textarea без доступного імені і спробувати виправити.
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

function hasAccessibleName(attrs, body, id) {
  if (/\baria-label\s*=/i.test(attrs)) return true;
  if (/\baria-labelledby\s*=/i.test(attrs)) return true;
  if (/\btitle\s*=/i.test(attrs)) return true;
  if (/\bplaceholder\s*=/i.test(attrs) && !/\bid\s*=/i.test(attrs)) {
    // placeholder alone is NOT sufficient for WCAG, but we'll upgrade later
  }
  if (id && new RegExp(`<label[^>]*\\bfor\\s*=\\s*(["'])${id.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\1`, 'i').test(body)) return true;
  return false;
}

function process(html) {
  let changed = 0;
  // Pattern: <label>...</label> then maybe wrappers then <input id= without for already linked
  // Broader: label immediately before input inside same parent already handled.
  // Here: controls with id that have a preceding label sibling text in same div:
  // <div...><label>X</label><input id="y">  — already done
  // <label>X</label>\n  <input id="y"  with attributes between on separate structure

  // Add aria-label from placeholder if no name
  html = html.replace(/<(input|select|textarea)(\b[^>]*?)(\/?)>/gi, (full, tag, attrs, slash) => {
    const type = ((attrs.match(/\btype\s*=\s*(["'])(.*?)\1/i) || [])[2] || (tag === 'input' ? 'text' : '')).toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image', 'checkbox', 'radio'].includes(type)) return full;
    const id = (attrs.match(/\bid\s*=\s*(["'])([^"']+)\1/i) || [])[2];
    if (hasAccessibleName(attrs, html, id)) return full;

    // try placeholder as aria-label
    const ph = (attrs.match(/\bplaceholder\s*=\s*(["'])([^"']*)\1/i) || [])[2];
    if (ph && ph.trim()) {
      changed++;
      return `<${tag}${attrs} aria-label="${ph.trim().replace(/"/g, '&quot;')}"${slash}>`;
    }

    // try name attribute
    const name = (attrs.match(/\bname\s*=\s*(["'])([^"']+)\1/i) || [])[2];
    if (name) {
      changed++;
      return `<${tag}${attrs} aria-label="${name.replace(/"/g, '&quot;')}"${slash}>`;
    }

    // try id as last resort humanized
    if (id) {
      const label = id.replace(/[-_]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
      changed++;
      return `<${tag}${attrs} aria-label="${label.replace(/"/g, '&quot;')}"${slash}>`;
    }
    return full;
  });

  return { html, changed };
}

let files = 0, total = 0;
for (const f of walk('.')) {
  const orig = fs.readFileSync(f, 'utf8');
  // Only process body-ish - but aria on inputs in scripts? rare. Process whole file carefully —
  // avoid changing inside <script> by splitting
  const parts = orig.split(/(<script[\s\S]*?<\/script>)/gi);
  let changedSum = 0;
  const out = parts.map((part) => {
    if (/^<script/i.test(part)) return part;
    const r = process(part);
    changedSum += r.changed;
    return r.html;
  }).join('');
  if (changedSum) {
    fs.writeFileSync(f, out);
    files++;
    total += changedSum;
  }
}
console.log({ files, ariaLabelsAdded: total });
