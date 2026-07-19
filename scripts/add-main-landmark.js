// Додає landmark <main> на всіх HTML-сторінках, де його немає.
// Стратегія: зовнішній <div class="wrap"> → <main class="wrap">
// (стилі .wrap лишаються → дизайн без змін). Ідемпотентний.
const fs = require('fs');
const path = require('path');

const SKIP_DIRS = new Set(['node_modules', '.git', 'tools', 'scripts']);

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(f)) continue;
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.html$/i.test(f)) out.push(p);
  }
  return out;
}

function classHasWrap(classAttr) {
  return classAttr.split(/\s+/).includes('wrap');
}

/** Знайти перший <div ... class="... wrap ..."> у body (не ticket-wrap). */
function findOuterWrapDiv(html) {
  const bodyIdx = html.search(/<body\b/i);
  if (bodyIdx < 0) return null;
  const re = /<div\b([^>]*)>/gi;
  re.lastIndex = bodyIdx;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    const cm = attrs.match(/\bclass\s*=\s*(["'])([\s\S]*?)\1/i);
    if (!cm) continue;
    if (!classHasWrap(cm[2])) continue;
    return { start: m.index, end: m.index + m[0].length, full: m[0], attrs };
  }
  return null;
}

/** Знайти закриваючий </div>, що відповідає відкриваючому на openEnd.
 *  Пропускає вміст <script> / <style>. */
function findMatchingCloseDiv(html, openEnd) {
  let i = openEnd;
  let depth = 1;
  const n = html.length;
  while (i < n && depth > 0) {
    // skip script
    if (html.slice(i, i + 7).toLowerCase() === '<script') {
      const end = html.toLowerCase().indexOf('</script>', i + 7);
      i = end < 0 ? n : end + 9;
      continue;
    }
    if (html.slice(i, i + 6).toLowerCase() === '<style') {
      const end = html.toLowerCase().indexOf('</style>', i + 6);
      i = end < 0 ? n : end + 8;
      continue;
    }
    if (html.slice(i, i + 4).toLowerCase() === '<div') {
      // only if it's a real tag start
      const ch = html[i + 4];
      if (ch === '>' || /\s/.test(ch)) { depth++; i += 4; continue; }
    }
    if (html.slice(i, i + 6).toLowerCase() === '</div>') {
      depth--;
      if (depth === 0) return { start: i, end: i + 6 };
      i += 6;
      continue;
    }
    i++;
  }
  return null;
}

/** Чи відкритий тег знаходиться всередині <script>/<style> (евристика). */
function insideScriptOrStyle(html, pos) {
  const before = html.slice(0, pos);
  const lastScript = Math.max(before.lastIndexOf('<script'), before.lastIndexOf('<SCRIPT'));
  const lastStyle = Math.max(before.lastIndexOf('<style'), before.lastIndexOf('<STYLE'));
  const last = Math.max(lastScript, lastStyle);
  if (last < 0) return false;
  const closeScript = before.lastIndexOf('</script>');
  const closeStyle = before.lastIndexOf('</style>');
  if (last === lastScript) return closeScript < lastScript;
  return closeStyle < lastStyle;
}

function convertWrapToMain(html) {
  if (/<main[\s>]/i.test(html)) return { html, changed: false, reason: 'already-has-main' };

  const open = findOuterWrapDiv(html);
  if (!open) return { html, changed: false, reason: 'no-wrap-div' };
  if (insideScriptOrStyle(html, open.start)) {
    return { html, changed: false, reason: 'wrap-inside-script' };
  }

  const close = findMatchingCloseDiv(html, open.end);
  if (!close) return { html, changed: false, reason: 'no-matching-close' };

  // Замінюємо з кінця, щоб індекси не зсунулись
  let out = html;
  out = out.slice(0, close.start) + '</main>' + out.slice(close.end);
  const newOpen = open.full.replace(/^<div\b/i, '<main');
  out = out.slice(0, open.start) + newOpen + out.slice(open.end);
  return { html: out, changed: true, reason: 'ok' };
}

function fixPrintTicket(html) {
  // Динамічний контент через body.innerHTML — обгортаємо в <main>
  let out = html;
  let changed = false;
  // Помилкові повідомлення
  out = out.replace(
    /document\.body\.innerHTML\s*=\s*'(<p>[^']*<\/p>)'/g,
    (m, p) => {
      changed = true;
      return `document.body.innerHTML = '<main>${p}</main>'`;
    }
  );
  // Основне присвоєння чека
  if (/document\.body\.innerHTML\s*=\s*html\s*;/.test(out) && !/innerHTML\s*=\s*'<main>'/.test(out)) {
    out = out.replace(
      /document\.body\.innerHTML\s*=\s*html\s*;/,
      "document.body.innerHTML = '<main>' + html + '</main>';"
    );
    changed = true;
  }
  // Статичний порожній main до скрипта (для випадку до виконання JS)
  if (!/<main[\s>]/i.test(out.replace(/innerHTML[\s\S]*?<\/script>/gi, ''))) {
    // додамо <main id="print-root" hidden></main> — ні, краще просто лишити динаміку
  }
  return { html: out, changed };
}

const files = walk('.');
let changed = 0, skipped = 0;
const reasons = {};

for (const file of files) {
  let html = fs.readFileSync(file, 'utf8');
  const rel = file.replace(/\\/g, '/');

  if (rel === 'print-ticket.html' || rel.endsWith('/print-ticket.html')) {
    const r = fixPrintTicket(html);
    if (r.changed) {
      fs.writeFileSync(file, r.html);
      changed++;
      console.log('FIXED print-ticket:', rel);
    } else {
      skipped++;
      (reasons['print-no-change'] = reasons['print-no-change'] || []).push(rel);
    }
    continue;
  }

  const r = convertWrapToMain(html);
  if (r.changed) {
    fs.writeFileSync(file, r.html);
    changed++;
  } else {
    skipped++;
    (reasons[r.reason] = reasons[r.reason] || []).push(rel);
  }
}

console.log(`\nChanged: ${changed}, skipped: ${skipped}`);
Object.keys(reasons).forEach(k => {
  console.log(`  ${k}: ${reasons[k].length}`);
});
