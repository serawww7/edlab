/**
 * Комплексне технічне SEO для всіх індексованих HTML (без зовнішніх залежностей).
 * Idempotent: повторний запуск оновлює ті самі теги.
 *
 * Індексуються: shell + заняття + coach
 * Не індексуються: print-ticket.html, tools/**
 */
const fs = require('fs');
const path = require('path');

const SITE = 'https://edlab.pp.ua';
const AUTHOR = 'Сергій Поліщук';
const PUBLISHER = 'EDLab';
const OG_IMAGE = `${SITE}/preview.jpg`;
const LOGO = `${SITE}/assets/icon-512.png`;

const SECTIONS = {
  agro_II_kyrs: { label: 'Агрономія', short: 'agro', fileRe: /^agro_para(\d+)\.html$/i },
  elect_II_kyrs: { label: 'Електроенергетика', short: 'elect', fileRe: /^electric_para(\d+)\.html$/i },
  mech_II_kyrs: { label: 'Механізація', short: 'mech', fileRe: /^mechanic_para(\d+)\.html$/i },
  gas_II_kyrs: { label: 'Газовики', short: 'gas', fileRe: /^gas_para(\d+)\.html$/i },
  tech_II_kyrs: { label: 'Технології тваринництва', short: 'tech', fileRe: /^tech_para(\d+)\.html$/i },
  coach: { label: 'Психологічні тренінги', short: 'coach', fileRe: /^(.*)\.html$/i }
};

const IGNORE_DIRS = new Set(['node_modules', '.git', '.github', 'scripts']);
// tools/ обробляємо окремо як noindex

function walkHtml(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (IGNORE_DIRS.has(name)) continue;
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) walkHtml(abs, out);
    else if (/\.html$/i.test(name)) out.push(abs);
  }
  return out;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function trim155(s) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > 155 ? t.slice(0, 152).trimEnd() + '…' : t;
}

function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function getTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripTags(m[1]) : '';
}

function getMetaDesc(html) {
  const m = html.match(/<meta\s+[^>]*name=["']description["'][^>]*>/i);
  if (!m) return '';
  const c = m[0].match(/content=["']([^"']*)["']/i);
  return c ? c[1] : '';
}

function firstParagraph(html) {
  const body = html.match(/<body[^>]*>([\s\S]*)/i);
  if (!body) return '';
  const m = body[1].match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  return m ? trim155(stripTags(m[1])) : '';
}

function firstH1(html) {
  const m = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? stripTags(m[1]) : '';
}

function ensureHead(html) {
  if (/<head\b/i.test(html)) return html;
  if (/<html\b[^>]*>/i.test(html)) {
    return html.replace(/<html\b[^>]*>/i, (m) => `${m}\n<head></head>`);
  }
  return `<!DOCTYPE html><html lang="uk"><head></head><body>${html}</body></html>`;
}

function ensureLang(html) {
  if (/<html\b[^>]*>/i.test(html)) {
    return html.replace(/<html\b([^>]*)>/i, (full, attrs) => {
      let a = attrs.replace(/\blang\s*=\s*["'][^"']*["']/i, '').replace(/\s+/g, ' ').trim();
      a = a ? ` ${a}` : '';
      return `<html lang="uk"${a}>`;
    });
  }
  return html;
}

function removeTag(html, re) {
  return html.replace(re, '');
}

function removeLegacy(html) {
  html = removeTag(html, /<meta\s+[^>]*name=["']keywords["'][^>]*>\s*/gi);
  html = removeTag(html, /<meta\s+[^>]*name=["']revisit-after["'][^>]*>\s*/gi);
  html = removeTag(html, /<meta\s+[^>]*name=["']rating["'][^>]*>\s*/gi);
  html = removeTag(html, /<meta\s+[^>]*name=["']copyright["'][^>]*>\s*/gi);
  html = removeTag(html, /<meta\s+[^>]*name=["']generator["'][^>]*>\s*/gi);
  return html;
}

function upsertMetaName(html, name, content) {
  const tag = `<meta name="${name}" content="${esc(content)}">`;
  const re = new RegExp(`<meta\\s+[^>]*name=["']${name}["'][^>]*>`, 'i');
  if (re.test(html)) return html.replace(re, tag);
  return injectHead(html, tag);
}

function upsertMetaNameMedia(html, name, content, media) {
  const tag = `<meta name="${name}" content="${esc(content)}" media="${esc(media)}">`;
  const re = new RegExp(
    `<meta\\s+[^>]*name=["']${name}["'][^>]*media=["']${media.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`,
    'i'
  );
  // also match media before name
  const re2 = new RegExp(
    `<meta\\s+[^>]*media=["']${media.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*name=["']${name}["'][^>]*>`,
    'i'
  );
  if (re.test(html)) return html.replace(re, tag);
  if (re2.test(html)) return html.replace(re2, tag);
  return injectHead(html, tag);
}

function upsertMetaProp(html, prop, content) {
  const tag = `<meta property="${prop}" content="${esc(content)}">`;
  const re = new RegExp(`<meta\\s+[^>]*property=["']${prop}["'][^>]*>`, 'i');
  if (re.test(html)) return html.replace(re, tag);
  return injectHead(html, tag);
}

function upsertLink(html, rel, href, extra = '') {
  const tag = `<link rel="${rel}" href="${esc(href)}"${extra}>`;
  const re = new RegExp(`<link\\s+[^>]*rel=["']${rel}["'][^>]*>`, 'i');
  // For icons with multiple rel=icon, replace only exact match if sizes/type in extra — simpler: remove all then inject bundle once via marker
  if (rel === 'canonical' || rel === 'image_src' || rel === 'manifest' || rel === 'apple-touch-icon') {
    if (re.test(html)) return html.replace(re, tag);
    return injectHead(html, tag);
  }
  return injectHead(html, tag);
}

function upsertLinkHreflang(html, lang, href) {
  const tag = `<link rel="alternate" hreflang="${lang}" href="${esc(href)}">`;
  const re = new RegExp(`<link\\s+[^>]*hreflang=["']${lang}["'][^>]*>`, 'i');
  if (re.test(html)) return html.replace(re, tag);
  return injectHead(html, tag);
}

function injectHead(html, tag) {
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${tag}\n</head>`);
  }
  if (/<meta\s+charset=[^>]*>/i.test(html)) {
    return html.replace(/(<meta\s+charset=[^>]*>)/i, `$1\n${tag}`);
  }
  return html.replace(/<head([^>]*)>/i, `<head$1>\n${tag}`);
}

function removeIconLinks(html) {
  html = html.replace(/<link\s+[^>]*rel=["']icon["'][^>]*>\s*/gi, '');
  html = html.replace(/<link\s+[^>]*rel=["']shortcut icon["'][^>]*>\s*/gi, '');
  html = html.replace(/<link\s+[^>]*rel=["']apple-touch-icon["'][^>]*>\s*/gi, '');
  html = html.replace(/<link\s+[^>]*rel=["']manifest["'][^>]*>\s*/gi, '');
  html = html.replace(/<link\s+[^>]*rel=["']image_src["'][^>]*>\s*/gi, '');
  return html;
}

function upsertJsonLd(html, id, obj) {
  const json = JSON.stringify(obj, null, 2);
  const block = `<script type="application/ld+json" id="${id}">${json}</script>`;
  const re = new RegExp(`<script\\s+[^>]*id=["']${id}["'][^>]*>[\\s\\S]*?<\\/script>`, 'i');
  if (re.test(html)) return html.replace(re, block);
  // remove old LearningResource without id on lessons (optional cleanup of duplicates from fix-meta)
  return injectHead(html, block);
}

function pageKind(relPosix) {
  if (relPosix === 'print-ticket.html' || relPosix === '404.html' || relPosix.startsWith('tools/')) return 'noindex';
  if (relPosix === 'index.html') return 'home';
  if (relPosix === 'about.html') return 'about';
  if (relPosix === 'legal.html') return 'legal';
  if (relPosix === 'spec.html') return 'spec';
  const dir = relPosix.split('/')[0];
  if (SECTIONS[dir]) return 'lesson';
  return 'page';
}

function canonicalFor(relPosix) {
  if (relPosix === 'index.html') return `${SITE}/`;
  return `${SITE}/${relPosix}`;
}

function orgNode() {
  return {
    '@type': 'Organization',
    '@id': `${SITE}/#organization`,
    name: PUBLISHER,
    url: `${SITE}/`,
    logo: {
      '@type': 'ImageObject',
      url: LOGO
    },
    founder: {
      '@type': 'Person',
      name: AUTHOR
    }
  };
}

function personNode() {
  return {
    '@type': 'Person',
    '@id': `${SITE}/#author`,
    name: AUTHOR,
    url: 'https://www.facebook.com/sergiy.polishchuk.ua'
  };
}

function breadcrumbsFor(relPosix, title) {
  const items = [
    { name: 'EDLab', item: `${SITE}/` }
  ];
  const parts = relPosix.split('/');
  if (parts.length === 1) {
    if (relPosix !== 'index.html') {
      items.push({ name: title, item: canonicalFor(relPosix) });
    }
  } else {
    const dir = parts[0];
    const sec = SECTIONS[dir];
    if (sec) {
      items.push({
        name: sec.label,
        item: `${SITE}/spec.html?spec=${sec.short}`
      });
      items.push({ name: title, item: canonicalFor(relPosix) });
    } else {
      items.push({ name: title, item: canonicalFor(relPosix) });
    }
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.item
    }))
  };
}

function primaryLd(kind, title, desc, url, relPosix) {
  const org = orgNode();
  const author = personNode();

  if (kind === 'home') {
    return {
      '@context': 'https://schema.org',
      '@graph': [
        org,
        author,
        {
          '@type': 'WebSite',
          '@id': `${SITE}/#website`,
          name: 'EDLab',
          url: `${SITE}/`,
          description: desc,
          inLanguage: 'uk',
          publisher: { '@id': `${SITE}/#organization` },
          author: { '@id': `${SITE}/#author` }
        },
        {
          '@type': 'EducationalApplication',
          '@id': `${SITE}/#app`,
          name: 'EDLab',
          url: `${SITE}/`,
          applicationCategory: 'EducationalApplication',
          operatingSystem: 'Web',
          description: desc,
          inLanguage: 'uk',
          image: OG_IMAGE,
          publisher: { '@id': `${SITE}/#organization` },
          author: { '@id': `${SITE}/#author` }
        }
      ]
    };
  }

  if (kind === 'lesson') {
    return {
      '@context': 'https://schema.org',
      '@type': 'LearningResource',
      name: title,
      description: desc,
      url,
      inLanguage: 'uk',
      educationalLevel: 'CollegeOrUniversity',
      learningResourceType: 'Lab / Interactive lesson',
      isAccessibleForFree: true,
      image: OG_IMAGE,
      provider: { '@id': `${SITE}/#organization`, '@type': 'Organization', name: PUBLISHER, url: `${SITE}/`, logo: LOGO },
      publisher: { '@type': 'Organization', name: PUBLISHER, url: `${SITE}/`, logo: LOGO },
      author: { '@type': 'Person', name: AUTHOR }
    };
  }

  if (kind === 'spec') {
    return {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description: desc,
      url,
      inLanguage: 'uk',
      isPartOf: { '@id': `${SITE}/#website`, '@type': 'WebSite', name: 'EDLab', url: `${SITE}/` },
      publisher: { '@type': 'Organization', name: PUBLISHER, url: `${SITE}/`, logo: LOGO },
      author: { '@type': 'Person', name: AUTHOR }
    };
  }

  if (kind === 'about') {
    return {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      name: title,
      description: desc,
      url,
      inLanguage: 'uk',
      publisher: { '@type': 'Organization', name: PUBLISHER, url: `${SITE}/`, logo: LOGO },
      author: { '@type': 'Person', name: AUTHOR }
    };
  }

  // legal / generic
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description: desc,
    url,
    inLanguage: 'uk',
    publisher: { '@type': 'Organization', name: PUBLISHER, url: `${SITE}/`, logo: LOGO },
    author: { '@type': 'Person', name: AUTHOR }
  };
}

function defaultTitle(kind, relPosix, html) {
  const h1 = firstH1(html);
  if (h1) return h1;
  const existing = getTitle(html);
  if (existing) return existing;
  if (kind === 'home') return 'EDLab – інтерактивні лабораторні роботи та цифрові заняття для коледжів';
  if (kind === 'spec') return 'EDLab — навчальні розділи та матеріали';
  if (kind === 'about') return 'Про EDLab';
  if (kind === 'legal') return 'Правова інформація — EDLab';
  return path.basename(relPosix, '.html');
}

function defaultDesc(kind, html, title) {
  const existing = getMetaDesc(html);
  if (existing && existing.trim() && existing !== 'Розділ') return trim155(existing);
  const p = firstParagraph(html);
  if (p) return p;
  if (kind === 'home') {
    return 'EDLab — платформа інтерактивних лабораторних робіт, цифрових журналів, тренажерів та освітніх інструментів для коледжів.';
  }
  if (kind === 'spec') {
    return 'Каталог навчальних розділів EDLab: агрономія, електрика, механіка, газовики, технології тваринництва та коучинг. Генератор iFrame для Moodle.';
  }
  return trim155(`${title} — навчальний матеріал EDLab для коледжів.`);
}

function applyIconsAndTheme(html) {
  html = removeIconLinks(html);
  const bundle = [
    `<link rel="icon" href="/favicon.ico" sizes="any">`,
    `<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">`,
    `<link rel="icon" href="/assets/favicon.png" type="image/png" sizes="32x32">`,
    `<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">`,
    `<link rel="manifest" href="/assets/site.webmanifest">`,
    `<link rel="image_src" href="${OG_IMAGE}">`
  ].join('\n');
  html = injectHead(html, bundle);
  html = upsertMetaNameMedia(html, 'theme-color', '#0b1220', '(prefers-color-scheme: dark)');
  html = upsertMetaNameMedia(html, 'theme-color', '#f4f7fb', '(prefers-color-scheme: light)');
  // fallback without media for older clients
  if (!/<meta\s+[^>]*name=["']theme-color["'][^>]*(?!media)/i.test(html.replace(/media=["'][^"']*["']/gi, ''))) {
    // keep media versions only — OK for modern SEO
  }
  return html;
}

function processIndexable(absPath, relPosix) {
  let html = fs.readFileSync(absPath, 'utf8');
  const kind = pageKind(relPosix);
  const url = canonicalFor(relPosix);
  const ogType = kind === 'lesson' ? 'article' : 'website';

  html = ensureHead(html);
  html = ensureLang(html);
  html = removeLegacy(html);

  const title = (() => {
    const existing = getTitle(html);
    if (existing && existing.trim()) return existing.trim();
    return defaultTitle(kind, relPosix, html);
  })();
  const desc = defaultDesc(kind, html, title);

  // title — лише якщо порожній
  if (!/<title[^>]*>\s*<\/title>/i.test(html) && /<title[^>]*>[\s\S]*?<\/title>/i.test(html)) {
    // keep existing non-empty title
  } else if (/<title[^>]*>[\s\S]*?<\/title>/i.test(html)) {
    html = html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`);
  } else {
    html = injectHead(html, `<title>${esc(title)}</title>`);
  }

  html = upsertMetaName(html, 'description', desc);
  html = upsertMetaName(html, 'robots', 'index, follow');
  html = upsertMetaName(html, 'author', AUTHOR);
  html = upsertMetaName(html, 'publisher', PUBLISHER);
  html = upsertMetaName(html, 'color-scheme', 'light dark');

  // canonical (single)
  html = html.replace(/<link\s+[^>]*rel=["']canonical["'][^>]*>\s*/gi, '');
  html = injectHead(html, `<link rel="canonical" href="${esc(url)}">`);

  html = upsertLinkHreflang(html, 'uk', url);
  html = upsertLinkHreflang(html, 'x-default', url);

  // Open Graph
  html = upsertMetaProp(html, 'og:title', title);
  html = upsertMetaProp(html, 'og:description', desc);
  html = upsertMetaProp(html, 'og:type', ogType);
  html = upsertMetaProp(html, 'og:url', url);
  html = upsertMetaProp(html, 'og:image', OG_IMAGE);
  html = upsertMetaProp(html, 'og:image:alt', 'EDLab — цифрові лабораторні роботи');
  html = upsertMetaProp(html, 'og:locale', 'uk_UA');
  html = upsertMetaProp(html, 'og:site_name', 'EDLab');

  // Twitter
  html = upsertMetaName(html, 'twitter:card', 'summary_large_image');
  html = upsertMetaName(html, 'twitter:title', title);
  html = upsertMetaName(html, 'twitter:description', desc);
  html = upsertMetaName(html, 'twitter:image', OG_IMAGE);

  html = applyIconsAndTheme(html);

  // Remove unlabeled duplicate LearningResource from old fix-meta to avoid spam (keep only our ids)
  html = html.replace(
    /<script\s+type=["']application\/ld\+json["']\s*>([\s\S]*?)<\/script>/gi,
    (full, body) => {
      if (/id=["']edlab-ld-/i.test(full)) return full;
      try {
        const j = JSON.parse(body);
        const t = j['@type'];
        const types = Array.isArray(t) ? t : [t];
        if (types.includes('LearningResource') || types.includes('EducationalApplication') || types.includes('CreativeWork')) {
          return ''; // замінимо нашими блоками
        }
      } catch (_) { /* keep invalid/other */ }
      return full;
    }
  );

  html = upsertJsonLd(html, 'edlab-ld-primary', primaryLd(kind, title, desc, url, relPosix));
  if (kind !== 'home') {
    html = upsertJsonLd(html, 'edlab-ld-breadcrumb', breadcrumbsFor(relPosix, title));
  } else {
    // home: compact breadcrumb not required; remove if present
    html = html.replace(/<script\s+[^>]*id=["']edlab-ld-breadcrumb["'][^>]*>[\s\S]*?<\/script>\s*/i, '');
  }

  return html;
}

function processNoindex(absPath) {
  let html = fs.readFileSync(absPath, 'utf8');
  html = ensureHead(html);
  html = ensureLang(html);
  html = removeLegacy(html);
  html = upsertMetaName(html, 'robots', 'noindex, nofollow');
  // strip index robots if any duplicate — already replaced
  html = html.replace(/<link\s+[^>]*rel=["']canonical["'][^>]*>\s*/gi, '');
  html = html.replace(/<script\s+[^>]*id=["']edlab-ld-[^"']+["'][^>]*>[\s\S]*?<\/script>\s*/gi, '');
  return html;
}

function run() {
  const root = path.resolve(__dirname, '..');
  const files = walkHtml(root);
  let changed = 0;
  let indexed = 0;
  let noindex = 0;

  for (const abs of files) {
    const rel = path.relative(root, abs).replace(/\\/g, '/');
    const kind = pageKind(rel);
    const before = fs.readFileSync(abs, 'utf8');
    const after = kind === 'noindex' ? processNoindex(abs) : processIndexable(abs, rel);
    if (kind === 'noindex') noindex++;
    else indexed++;
    if (after !== before) {
      fs.writeFileSync(abs, after, 'utf8');
      changed++;
    }
  }

  console.log(`SEO optimize: змінено ${changed}/${files.length} (indexable≈${indexed}, noindex=${noindex})`);
}

run();
