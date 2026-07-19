// Видаляє дубльований <style> блок "PRINT PATCH v1" зі сторінок-занять.
// Ці правила повністю покриває assets/edlab-core.css (.ticket{font-weight:700}).
// Ідемпотентний, безпечний (нічого унікального не чіпає).
const fs = require('fs');
const path = require('path');

const DIRS = ['agro_II_kyrs','elect_II_kyrs','gas_II_kyrs','mech_II_kyrs','tech_II_kyrs','coach'];
// <style> ... /* PRINT PATCH ... </style> разом із зайвими порожніми рядками довкола
const RE = /\s*<style>\s*\/\*\s*PRINT PATCH[\s\S]*?<\/style>/gi;

let changed = 0, total = 0;
DIRS.forEach(dir => {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).filter(f => /\.html$/i.test(f)).forEach(f => {
    const p = path.join(dir, f); total++;
    const html = fs.readFileSync(p, 'utf8');
    if (!/PRINT PATCH/i.test(html)) return;
    const out = html.replace(RE, '\n');
    if (out !== html) { fs.writeFileSync(p, out); changed++; }
  });
});
console.log(`remove-print-patch: оброблено ${total}, очищено ${changed} файлів`);
