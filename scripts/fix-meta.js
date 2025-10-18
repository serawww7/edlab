// Автовиправлення <title>, <meta description>, canonical, OG, JSON-LD, lang="uk"
// Папки: agro_II_kyrs, elect_II_kyrs, mech_II_kyrs, tech_II_kyrs, coach

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const cheerio = require('cheerio');

const SITE = 'https://edlab.pp.ua'; // твій прод-домен
const SECTIONS = [
  { dir: 'agro_II_kyrs',  label: 'Агрономія',            pat: /^agro_para(\d+)\.html$/i,       titleFmt: (n)=>`Агрономія — Пара ${n}` },
  { dir: 'elect_II_kyrs', label: 'Електроенергетика',    pat: /^electric_para(\d+)\.html$/i,   titleFmt: (n)=>`Електроенергетика — Пара ${n}` },
  { dir: 'mech_II_kyrs',  label: 'Механізація (механіки)', pat: /^mechanic_para(\d+)\.html$/i, titleFmt: (n)=>`Механізація — Пара ${n}` },
  { dir: 'gas_II_kyrs',  label: 'Будівництво та цивільна інженерія (газовики)', pat: /^gas_para(\d+)\.html$/i, titleFmt: (n)=>`Газовики — Пара ${n}` },
  { dir: 'tech_II_kyrs',  label: 'Технології тваринництва', pat: /^tech_para(\d+)\.html$/i,    titleFmt: (n)=>`Технології тваринництва — Пара ${n}` },
  { dir: 'coach',         label: 'Coach',                pat: /^(.*)\.html$/i,                 titleFmt: (n, base)=>`Коучинг — ${humanize(base)}` }
];

// обрізання до 155 символів
function trim155(s) {
  if (!s) return '';
  const t = s.replace(/\s+/g,' ').trim();
  return t.length > 155 ? t.slice(0, 155).trimEnd() : t;
}
function humanize(fileBase) {
  return fileBase
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\.html?$/i, '')
    .trim()
    .replace(/\bpara\b/i, 'Пара');
}
function ensureHead($) {
  if ($('head').length === 0) {
    $('html').prepend('<head></head>');
  }
}
function ensureLangUk($) {
  const html = $('html');
  if (!html.attr('lang')) html.attr('lang', 'uk');
}
function firstParagraphText($) {
  const p = $('body p').first().text().replace(/\s+/g,' ').trim();
  return p || '';
}
function ensureTitle($, fallback) {
  let t = $('head > title');
  if (t.length === 0) {
    $('head').prepend(`<title>${fallback}</title>`);
  } else if (!t.text().trim()) {
    t.text(fallback);
  }
}
function ensureMetaDescription($, desc) {
  let m = $('head meta[name="description"]');
  if (m.length === 0) {
    $('head').append(`<meta name="description" content="${desc}">`);
  } else if (!m.attr('content') || !m.attr('content').trim()) {
    m.attr('content', desc);
  }
}
function ensureCanonical($, absUrl) {
  let l = $('head link[rel="canonical"]');
  if (l.length === 0) {
    $('head').append(`<link rel="canonical" href="${absUrl}">`);
  } else if (!l.attr('href') || !l.attr('href').trim()) {
    l.attr('href', absUrl);
  }
}
function ensureOG($, title, desc, absUrl) {
  const ensure = (prop, content) => {
    let m = $(`head meta[property="${prop}"]`);
    if (m.length === 0) $('head').append(`<meta property="${prop}" content="${content}">`);
    else if (!m.attr('content') || !m.attr('content').trim()) m.attr('content', content);
  };
  ensure('og:type', 'article');
  ensure('og:title', title);
  ensure('og:description', desc);
  ensure('og:url', absUrl);
}
function ensureJSONLD($, title, desc, absUrl) {
  // якщо вже є LearningResource — залишаємо
  const hasLR = $('script[type="application/ld+json"]').toArray().some(s=>{
    try {
      const j = JSON.parse($(s).text());
      return j && (j['@type']==='LearningResource' || (Array.isArray(j['@type']) && j['@type'].includes('LearningResource')));
    } catch { return false; }
  });
  if (hasLR) return;

  const ld = {
    "@context":"https://schema.org",
    "@type":"LearningResource",
    "name": title,
    "description": desc,
    "inLanguage":"uk",
    "educationalLevel":"college",
    "url": absUrl,
    "provider":{"@type":"Organization","name":"EDLab"}
  };
  $('head').append(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`);
}

function buildTitleFromFilename(section, fileName, $) {
  // якщо є H1 — беремо його як основу
  const h1 = $('body h1').first().text().replace(/\s+/g,' ').trim();
  if (h1) return h1;

  const m = fileName.match(section.pat);
  if (m) {
    const num = m[1] || '';
    const base = fileName.replace(/\.html?$/i,'');
    return section.titleFmt(num, base);
  }
  // запасний варіант
  return `${section.label} — ${humanize(fileName)}`;
}

function processFile(absPath, webPath, sectionLabel, sectionDef) {
  const html = fs.readFileSync(absPath, 'utf8');
  const $ = cheerio.load(html);

  ensureHead($);
  ensureLangUk($);

  const fileName = path.basename(absPath);
  const absUrl = `${SITE}${webPath}`; // canonical
  const title = buildTitleFromFilename(sectionDef, fileName, $);
  const descCandidate = firstParagraphText($) || `${sectionLabel}: навчальний матеріал`;
  const desc = trim155(descCandidate);

  ensureTitle($, title);
  ensureMetaDescription($, desc);
  ensureCanonical($, absUrl);
  ensureOG($, title, desc, absUrl);
  ensureJSONLD($, title, desc, absUrl);

  const newHtml = $.html({ decodeEntities: false });
  if (newHtml !== html) {
    fs.writeFileSync(absPath, newHtml);
    return true;
  }
  return false;
}

function run() {
  let changed = 0;
  SECTIONS.forEach(section=>{
    const dir = section.dir;
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return;

    const files = glob.sync(`${dir}/**/*.html`, { nodir: true });
    files.forEach(f=>{
      // шлях для веба (починається зі слеша)
      const webPath = '/' + f.replace(/\\/g,'/');
      const ok = processFile(path.resolve(f), webPath, section.label, section);
      if (ok) changed++;
    });
  });

  console.log(`SEO autofix: оновлено файлів: ${changed}`);
  // Не падаємо, навіть якщо 0 — це ок.
}
run();
