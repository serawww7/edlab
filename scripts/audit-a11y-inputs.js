const fs = require('fs');
const path = require('path');

function walk(d, a = []) {
  for (const n of fs.readdirSync(d)) {
    if (['node_modules', '.git', 'scripts', 'tools'].includes(n)) continue;
    const p = path.join(d, n);
    const s = fs.statSync(p);
    if (s.isDirectory()) walk(p, a);
    else if (/\.html$/i.test(n)) a.push(p);
  }
  return a;
}

function analyzePart(part, file, bucket) {
  const re = /<(input|select|textarea)\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(part))) {
    const tag = m[1].toLowerCase();
    const attrs = m[2];
    const type = ((attrs.match(/\btype\s*=\s*(["'])(.*?)\1/i) || [])[2] || (tag === 'input' ? 'text' : '')).toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) continue;
    const id = (attrs.match(/\bid\s*=\s*(["'])([^"']+)\1/i) || [])[2];
    const hasAria = /\baria-label\s*=/i.test(attrs) || /\baria-labelledby\s*=/i.test(attrs) || /\btitle\s*=/i.test(attrs);
    let hasLabel = false;
    if (id) {
      const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      hasLabel = new RegExp(`<label[^>]*\\bfor\\s*=\\s*(["'])${esc}\\1`, 'i').test(part);
    }
    if (!hasAria && !hasLabel) {
      bucket.push({
        file: path.relative('.', file).replace(/\\/g, '/'),
        tag,
        type,
        id: id || '',
        snippet: m[0].slice(0, 140)
      });
    }
  }
}

const staticMiss = [];
const scriptMiss = [];
let dynPatterns = 0;

for (const f of walk('.')) {
  const html = fs.readFileSync(f, 'utf8');
  const parts = html.split(/(<script[\s\S]*?<\/script>)/gi);
  for (const part of parts) {
    if (/^<script/i.test(part)) {
      analyzePart(part, f, scriptMiss);
      if (/createElement\(\s*['"]input['"]/i.test(part) || /innerHTML\s*[+=].*<input/i.test(part) || /<input[^>]*>/.test(part)) {
        if (/createElement\(\s*['"]input['"]/i.test(part) || /innerHTML\s*[+=][\s\S]{0,200}<input/i.test(part)) dynPatterns++;
      }
    } else {
      analyzePart(part, f, staticMiss);
    }
  }
}

const byFile = {};
for (const x of staticMiss.concat(scriptMiss)) {
  byFile[x.file] = (byFile[x.file] || 0) + 1;
}
const top = Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 20);

console.log(JSON.stringify({
  staticUnlabeled: staticMiss.length,
  inScriptStrings: scriptMiss.length,
  topFiles: top,
  samplesStatic: staticMiss.slice(0, 12),
  samplesScript: scriptMiss.slice(0, 12)
}, null, 2));
