// Генерує маніфести розділів із <title>/<meta description> сторінок-занять.
// Наслідок: spec.html бере назви/описи з маніфесту й НЕ вантажить кожну
// сторінку окремо (велика економія трафіку). Єдине джерело — самі HTML-файли.
// Пише глобальний assets/manifest.json та локальні <dir>/manifest.json.
const fs = require('fs');
const path = require('path');

const DIRS = ['coach','elect_II_kyrs','agro_II_kyrs','mech_II_kyrs','gas_II_kyrs','tech_II_kyrs'];

function decode(s){
  return (s||'')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ')
    .replace(/\s+/g,' ').trim();
}
function extract(html){
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const mTag = html.match(/<meta[^>]*name=["']description["'][^>]*>/i);
  let desc = '';
  if (mTag){ const c = mTag[0].match(/content=["']([\s\S]*?)["']/i); if(c) desc = c[1]; }
  return { title: decode(t && t[1]), desc: decode(desc) };
}
function num(f){ const m = f.match(/(\d+)/); return m ? parseInt(m[1],10) : 1e9; }

const global = {};
DIRS.forEach(dir => {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir)
    .filter(f => /\.html$/i.test(f) && f !== 'manifest.json')
    .sort((a,b) => (num(a)-num(b)) || a.localeCompare(b,'uk'));

  const items = files.map(f => {
    const { title, desc } = extract(fs.readFileSync(path.join(dir,f),'utf8'));
    return { url: `/${dir}/${f}`, title, desc };
  });

  global[dir] = items;
  fs.writeFileSync(path.join(dir,'manifest.json'), JSON.stringify(items, null, 2) + '\n');
});

fs.writeFileSync('assets/manifest.json', JSON.stringify(global, null, 2) + '\n');
const totals = Object.entries(global).map(([k,v]) => `${k}:${v.length}`).join(', ');
console.log(`build-manifest: ${totals}`);
