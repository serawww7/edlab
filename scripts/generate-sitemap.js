// Генерує sitemap.xml (всі .html у проекті)
// Якщо robots.txt не існує — створює базовий

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const SITE = 'https://edlab.pp.ua';

// зібрати всі HTML
const files = glob.sync('**/*.html', {
  nodir: true,
  ignore: [
    'node_modules/**',
    '.github/**'
  ]
});

// робимо абсолютні URL
const urls = files
  .map(f => '/' + f.replace(/\\/g,'/'))
  .sort((a,b)=>a.localeCompare(b, 'uk'));

const sitemap =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(u => `  <url><loc>${SITE}${u}</loc></url>`).join('\n') +
  `\n</urlset>\n`;

fs.writeFileSync('sitemap.xml', sitemap, 'utf8');
console.log(`Sitemap: згенеровано ${urls.length} URL → sitemap.xml`);

if (!fs.existsSync('robots.txt')) {
  const robots =
`User-agent: *
Allow: /
Sitemap: ${SITE}/sitemap.xml
`;
  fs.writeFileSync('robots.txt', robots, 'utf8');
  console.log('robots.txt створено');
}
