/**
 * Аудит: edlab-core.css підключений; у page <style> немає :root/--bg і dark-hex.
 * Exit 1 якщо є порушення (для CI).
 * Запуск: node scripts/audit-light-theme.js
 */
const fs = require("fs");
const path = require("path");

const DIRS = [
  "agro_II_kyrs",
  "elect_II_kyrs",
  "gas_II_kyrs",
  "mech_II_kyrs",
  "tech_II_kyrs",
  "coach"
];

const ROOT_FILES = [
  "index.html",
  "about.html",
  "legal.html",
  "spec.html",
  "404.html"
];

const DARK_HEX_RE = /#0b1220|#0f172a|#0a1020|#0c1426|#0b1528|#0b162a|#0c182a|#0d152b|#0a1426/i;

function collectHtml() {
  const out = [];
  for (const f of ROOT_FILES) if (fs.existsSync(f)) out.push(f);
  for (const d of DIRS) {
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (f.endsWith(".html")) out.push(path.join(d, f));
    }
  }
  return out;
}

function styleBlocks(html) {
  const blocks = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = re.exec(html))) blocks.push(m[1]);
  return blocks.join("\n");
}

const files = collectHtml();
const report = {
  total: files.length,
  withCore: 0,
  withoutCore: [],
  withRootTokens: [],
  withDarkHex: []
};

for (const file of files) {
  const rel = file.replace(/\\/g, "/");
  const html = fs.readFileSync(file, "utf8");
  if (html.includes("edlab-core.css")) report.withCore++;
  else report.withoutCore.push(rel);

  const css = styleBlocks(html);
  if (/:root\s*\{[^}]*--bg\s*:/i.test(css)) report.withRootTokens.push(rel);
  if (DARK_HEX_RE.test(css)) report.withDarkHex.push(rel);
}

console.log(JSON.stringify(report, null, 2));

const failed =
  report.withoutCore.length > 0 ||
  report.withRootTokens.length > 0 ||
  report.withDarkHex.length > 0;

if (failed) {
  console.error("audit-light-theme: FAIL");
  process.exit(1);
}
console.log("audit-light-theme: OK");
