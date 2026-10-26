/**
 * Аудит сторінок: наявність edlab-core.css і типові «темні» :root / hardcoded.
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
  "coach",
  "."
];

const ROOT_FILES = [
  "index.html",
  "about.html",
  "legal.html",
  "spec.html",
  "404.html",
  "print-ticket.html"
];

function collectHtml() {
  const out = [];
  for (const d of DIRS) {
    if (d === ".") {
      for (const f of ROOT_FILES) {
        if (fs.existsSync(f)) out.push(f);
      }
      continue;
    }
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
let withCore = 0;
let withoutCore = [];
let withDarkRoot = 0;
let withHardBtn = 0;
const rootVarFreq = new Map();

for (const file of files) {
  const html = fs.readFileSync(file, "utf8");
  if (html.includes("edlab-core.css")) withCore++;
  else withoutCore.push(file.replace(/\\/g, "/"));

  const css = styleBlocks(html);
  const root = css.match(/:root\s*\{([^}]{0,1200})\}/);
  if (root && /--bg\s*:\s*#0/.test(root[1])) withDarkRoot++;
  if (root) {
    for (const v of root[1].matchAll(/--([a-zA-Z0-9_-]+)\s*:/g)) {
      rootVarFreq.set(v[1], (rootVarFreq.get(v[1]) || 0) + 1);
    }
  }
  if (/background\s*:\s*#0[0-9a-fA-F]{5}/.test(css)) withHardBtn++;
}

console.log(JSON.stringify({
  total: files.length,
  withCore,
  withoutCore,
  withDarkRootTokens: withDarkRoot,
  pagesWithHardcodedDarkBg: withHardBtn,
  topRootVars: [...rootVarFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
}, null, 2));
