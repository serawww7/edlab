// Виправляє помилкове вставлення edlab-core.js всередину template-literal
// рядків друку чека (перший </body> у файлі був усередині JS-рядка).
// Також оновлює apply-core.js, щоб надалі вставляти лише перед ОСТАННІМ </body>.
const fs = require('fs');
const path = require('path');

const DIRS = ['agro_II_kyrs','elect_II_kyrs','gas_II_kyrs','mech_II_kyrs','tech_II_kyrs','coach'];
const CORE_TAG = '<script src="/assets/edlab-core.js" data-chrome="minimal" defer></script>';

// Патерн: core-тег безпосередньо перед </body></html>`  (усередині JS-рядка)
const BROKEN = /\s*<script src="\/assets\/edlab-core\.js" data-chrome="minimal" defer><\/script>\s*(<\/body><\/html>`)/g;

function fixFile(file) {
  let html = fs.readFileSync(file, 'utf8');
  if (!BROKEN.test(html)) {
    // reset lastIndex because we used /g and test() advances it
    BROKEN.lastIndex = 0;
    return false;
  }
  BROKEN.lastIndex = 0;

  // 1) Прибираємо помилкову вставку з template-literal
  html = html.replace(BROKEN, '\n$1');

  // 2) Якщо після цього core-тег відсутній у документі — додаємо перед останнім </body>
  if (!html.includes(CORE_TAG)) {
    const last = html.lastIndexOf('</body>');
    if (last >= 0) {
      html = html.slice(0, last) + CORE_TAG + '\n' + html.slice(last);
    } else {
      html = html + '\n' + CORE_TAG + '\n';
    }
  }

  fs.writeFileSync(file, html);
  return true;
}

let fixed = 0, total = 0;
DIRS.forEach(dir => {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).filter(f => /\.html$/i.test(f)).forEach(f => {
    total++;
    if (fixFile(path.join(dir, f))) fixed++;
  });
});
console.log(`fix-core-injection: перевірено ${total}, виправлено ${fixed}`);
