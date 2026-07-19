/**
 * Генерує sitemap.xml за рекомендаціями Google Search Central:
 * - офіційний XML Sitemap 0.9
 * - абсолютні URL
 * - <loc> + <lastmod> (без priority / changefreq)
 * - лише індексовані HTML-сторінки
 *
 * lastmod: дата останнього коміту Git для файлу → mtime файлу → сьогодні.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SITE = 'https://edlab.pp.ua';
const ROOT = path.resolve(__dirname, '..');

const IGNORE_DIR = new Set(['node_modules', '.git', '.github', 'tools', 'scripts']);
const IGNORE_FILE = new Set(['print-ticket.html', '404.html']);

function walkHtml(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (IGNORE_DIR.has(name)) continue;
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      walkHtml(abs, out);
      continue;
    }
    if (!/\.html$/i.test(name)) continue;
    if (IGNORE_FILE.has(name)) continue;
    if (/old/i.test(name)) continue;
    if (/\.bak\.html$/i.test(name)) continue;
    out.push(path.relative(ROOT, abs));
  }
  return out;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function gitLastmod(relPosix) {
  try {
    const out = execFileSync(
      'git',
      ['log', '-1', '--format=%cs', '--', relPosix],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(out)) return out;
  } catch (_) { /* no git history for file */ }
  return null;
}

function fileLastmod(absPath) {
  try {
    return fs.statSync(absPath).mtime.toISOString().slice(0, 10);
  } catch (_) {
    return null;
  }
}

function lastmodFor(relPosix, absPath) {
  return gitLastmod(relPosix) || fileLastmod(absPath) || todayISO();
}

/** index.html → / ; інші → /path/file.html */
function toLocPath(relPosix) {
  if (relPosix === 'index.html') return '/';
  return '/' + relPosix;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function collectPages() {
  const files = walkHtml(ROOT);

  const seen = new Set();
  const pages = [];

  for (const rel of files.sort((a, b) => a.localeCompare(b, 'en'))) {
    const relPosix = rel.replace(/\\/g, '/');
    const locPath = toLocPath(relPosix);
    if (seen.has(locPath)) continue;
    seen.add(locPath);

    const abs = path.join(ROOT, rel);
    pages.push({
      file: relPosix,
      loc: SITE + locPath,
      lastmod: lastmodFor(relPosix, abs)
    });
  }

  return pages;
}

function buildSitemap(pages) {
  const body = pages.map((p) =>
    [
      '  <url>',
      `    <loc>${escapeXml(p.loc)}</loc>`,
      `    <lastmod>${p.lastmod}</lastmod>`,
      '  </url>'
    ].join('\n')
  ).join('\n');

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    body +
    `\n</urlset>\n`
  );
}

function ensureRobots() {
  const robotsPath = path.join(ROOT, 'robots.txt');
  const sitemapLine = `Sitemap: ${SITE}/sitemap.xml`;

  if (!fs.existsSync(robotsPath)) {
    const robots =
      `User-agent: *\n` +
      `Allow: /\n` +
      `\n` +
      `${sitemapLine}\n`;
    fs.writeFileSync(robotsPath, robots, 'utf8');
    console.log('robots.txt створено');
    return;
  }

  let text = fs.readFileSync(robotsPath, 'utf8').replace(/\r\n/g, '\n');
  let changed = false;

  // CSS/JS потрібні Google для рендерингу — не блокуємо /assets/
  if (/^Disallow:\s*\/assets\/?\s*$/im.test(text)) {
    text = text.replace(/^Disallow:\s*\/assets\/?\s*\n?/gim, '');
    changed = true;
  }

  if (!/^User-agent:\s*\*/im.test(text)) {
    text = `User-agent: *\nAllow: /\n\n` + text;
    changed = true;
  }

  if (!/^Allow:\s*\/\s*$/im.test(text)) {
    text = text.replace(/^(User-agent:\s*\*\s*)$/im, `$1\nAllow: /`);
    changed = true;
  }

  if (!/^Sitemap:\s*https:\/\/edlab\.pp\.ua\/sitemap\.xml\s*$/im.test(text)) {
    if (/^Sitemap:\s*.+$/im.test(text)) {
      text = text.replace(/^Sitemap:\s*.+$/im, sitemapLine);
    } else {
      text = text.replace(/\s*$/, `\n\n${sitemapLine}\n`);
    }
    changed = true;
  }

  // Прибрати зайві порожні рядки
  text = text.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').replace(/\n*$/, '\n');

  if (changed) {
    fs.writeFileSync(robotsPath, text, 'utf8');
    console.log('robots.txt оновлено');
  } else {
    console.log('robots.txt — без змін');
  }
}

function validate(pages, xml) {
  const errors = [];

  if (!xml.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')) {
    errors.push('відсутній namespace sitemap 0.9');
  }
  if (/<priority>|<changefreq>/i.test(xml)) {
    errors.push('застарілі priority/changefreq не повинні бути в sitemap');
  }

  const locs = pages.map((p) => p.loc);
  if (new Set(locs).size !== locs.length) errors.push('дублікати <loc>');

  for (const p of pages) {
    if (!p.loc.startsWith(SITE + '/')) errors.push(`не абсолютний URL: ${p.loc}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.lastmod)) errors.push(`поганий lastmod: ${p.file}`);
    if (p.file !== 'index.html') {
      const abs = path.join(ROOT, p.file);
      if (!fs.existsSync(abs)) errors.push(`файл відсутній: ${p.file}`);
    }
  }

  // грубий XML: парні теги
  const open = (xml.match(/<url>/g) || []).length;
  const close = (xml.match(/<\/url>/g) || []).length;
  if (open !== close || open !== pages.length) {
    errors.push(`розсинхрон url-тегів: open=${open} close=${close} pages=${pages.length}`);
  }

  return errors;
}

const pages = collectPages();
const xml = buildSitemap(pages);
const outPath = path.join(ROOT, 'sitemap.xml');
fs.writeFileSync(outPath, xml, 'utf8');

const errors = validate(pages, xml);
if (errors.length) {
  console.error('Sitemap validation FAILED:');
  errors.forEach((e) => console.error(' -', e));
  process.exit(1);
}

ensureRobots();

console.log(`Sitemap: ${pages.length} URL → sitemap.xml`);
console.log(`Приклад: ${pages[0].loc} (${pages[0].lastmod})`);
