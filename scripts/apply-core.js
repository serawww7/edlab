// Адитивно підключає спільні assets/edlab-core.css та assets/edlab-core.js
// до всіх сторінок-занять. Нічого не видаляє: core.css вставляється ПЕРЕД
// локальним <style>, тож локальні правила лишаються пріоритетними (нульовий
// ризик для верстки, калькуляторів і друку). Скрипт ідемпотентний.

const fs = require('fs');
const path = require('path');

const CONTENT_DIRS = [
  'agro_II_kyrs',
  'elect_II_kyrs',
  'gas_II_kyrs',
  'mech_II_kyrs',
  'tech_II_kyrs',
  'coach'
];

function htmlFilesIn(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => /\.html$/i.test(f))
    .map(f => path.join(dir, f));
}

const CSS_TAG  = '<link rel="stylesheet" href="/assets/edlab-core.css">';
const JS_TAG   = '<script src="/assets/edlab-core.js" data-chrome="minimal" defer></script>';

function processFile(file) {
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes('edlab-core.css')) return false; // вже підключено

  // 1) CSS одразу після <head ...>
  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/(<head[^>]*>)/i, `$1\n${CSS_TAG}`);
  } else if (/<html[^>]*>/i.test(html)) {
    html = html.replace(/(<html[^>]*>)/i, `$1\n<head>\n${CSS_TAG}\n</head>`);
  } else {
    html = `${CSS_TAG}\n` + html;
  }

  // 2) JS перед </body> (або в кінці файлу)
  if (/<\/body>/i.test(html)) {
    html = html.replace(/<\/body>/i, `${JS_TAG}\n</body>`);
  } else {
    html = html + `\n${JS_TAG}\n`;
  }

  fs.writeFileSync(file, html);
  return true;
}

let changed = 0, total = 0;
CONTENT_DIRS.forEach(dir => {
  htmlFilesIn(dir).forEach(f => {
    total++;
    if (processFile(f)) changed++;
  });
});
console.log(`apply-core: оброблено ${total}, підключено core у ${changed} файлах`);
