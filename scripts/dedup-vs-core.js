/* ==========================================================================
   Безпечна дедуплікація inline-CSS: прибирає зі сторінок-занять ЛИШЕ ті
   правила, що БАЙТ-ІДЕНТИЧНІ правилу в assets/edlab-core.css.

   Чому безпечно: core.css підключено на КОЖНІЙ сторінці й вантажиться ПЕРШИМ.
   Якщо inline-правило дослівно дублює core-правило — після видалення діє
   ідентичне core-правило, і computed style не змінюється. Жодних чужих правил
   не додається. Додатково кожну сторінку валідуємо каскадною мапою
   (ДО == ПІСЛЯ), тож рідкісні внутрішні перевизначення теж відсіюються.

   Запуск:
     node scripts/dedup-vs-core.js           (dry-run)
     node scripts/dedup-vs-core.js --apply
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const DIRS = ['agro_II_kyrs','elect_II_kyrs','gas_II_kyrs','mech_II_kyrs','tech_II_kyrs','coach'];
const CORE = fs.readFileSync('assets/edlab-core.css','utf8');

function parseUnits(css){
  const units=[]; let i=0; const n=css.length;
  while(i<n){
    while(i<n && /\s/.test(css[i])) i++;
    if(i>=n) break;
    if(css[i]==='/'&&css[i+1]==='*'){ const e=css.indexOf('*/',i+2); i=e<0?n:e+2; continue; }
    const start=i;
    while(i<n && css[i]!=='{' && css[i]!==';'){
      if(css[i]==='/'&&css[i+1]==='*'){ const e=css.indexOf('*/',i+2); i=e<0?n:e+2; continue; }
      i++;
    }
    if(i>=n) break;
    if(css[i]===';'){ units.push({type:'at', raw:css.slice(start,i+1)}); i++; continue; }
    const prelude=css.slice(start,i).trim();
    let depth=0; const bodyStart=i;
    for(; i<n; i++){
      if(css[i]==='/'&&css[i+1]==='*'){ const e=css.indexOf('*/',i+2); i=e<0?n:e+1; continue; }
      if(css[i]==='{') depth++;
      else if(css[i]==='}'){ depth--; if(depth===0){ i++; break; } }
    }
    units.push({ type:prelude.startsWith('@')?'at':'rule', prelude, body:css.slice(bodyStart+1,i-1), raw:css.slice(start,i) });
  }
  return units;
}
const norm = s => s.replace(/\s+/g,' ').trim();
function decls(body){
  const out=[];
  body.split(';').forEach(d=>{ const k=d.indexOf(':'); if(k<0) return;
    const p=d.slice(0,k).trim().toLowerCase(); const v=norm(d.slice(k+1)); if(p) out.push([p,v]); });
  return out;
}
// Канонічний ключ: селектори і властивості нормалізовані та впорядковані,
// тож правила, що відрізняються лише форматуванням, вважаються однаковими.
function ruleKey(u){
  const sel = u.prelude.split(',').map(norm).sort().join(',');
  const body = decls(u.body).map(([p,v])=>p+':'+v).sort().join(';');
  return sel+'{'+body+'}';
}
function cascade(lists){
  const map=new Map();
  lists.forEach(us=>us.forEach(u=>{ if(u.type!=='rule') return;
    const sels=u.prelude.split(',').map(norm); const ds=decls(u.body);
    sels.forEach(s=>ds.forEach(([p,v])=>map.set(s+'|'+p,v))); }));
  return map;
}
const eq=(a,b)=>{ if(a.size!==b.size) return false; for(const[k,v]of a) if(b.get(k)!==v) return false; return true; };

const coreUnits = parseUnits(CORE);
const coreKeys = new Set(coreUnits.filter(u=>u.type==='rule').map(ruleKey));

function styleBlocks(html){
  const re=/<style[^>]*>([\s\S]*?)<\/style>/gi; const b=[]; let m;
  while((m=re.exec(html))) b.push({full:m[0],css:m[1],index:m.index});
  return b;
}

let deduped=0, skipped=0, rulesRemoved=0, bytesSaved=0; const skippedFiles=[];
DIRS.forEach(dir=>{
  if(!fs.existsSync(dir)) return;
  fs.readdirSync(dir).filter(f=>/\.html$/i.test(f)).forEach(f=>{
    const file=path.join(dir,f);
    let html=fs.readFileSync(file,'utf8');
    const blocks=styleBlocks(html);
    const allUnits=[].concat(...blocks.map(b=>parseUnits(b.css)));
    const isDup = u => u.type==='rule' && coreKeys.has(ruleKey(u)) && !/^:root/i.test(u.prelude);
    if(!allUnits.some(isDup)) return;

    const newUnits=allUnits.filter(u=>!isDup(u));
    const before=cascade([coreUnits, allUnits]);
    const after =cascade([coreUnits, newUnits]);
    if(!eq(before,after)){ skipped++; skippedFiles.push(f); return; }

    deduped++;
    const removed=allUnits.filter(isDup);
    rulesRemoved+=removed.length;
    bytesSaved+=removed.reduce((a,u)=>a+u.raw.length,0);

    if(APPLY){
      for(let bi=blocks.length-1; bi>=0; bi--){
        const b=blocks[bi];
        const kept=parseUnits(b.css).filter(u=>!isDup(u));
        const rebuilt=kept.map(u=>u.raw.trim()).join('\n').trim();
        const repl = rebuilt ? `<style>\n${rebuilt}\n</style>` : '';
        html = html.slice(0,b.index)+repl+html.slice(b.index+b.full.length);
      }
      fs.writeFileSync(file,html);
    }
  });
});

console.log(`Правил у core.css: ${coreKeys.size}`);
console.log(`Сторінок дедупльовано (безпечно): ${deduped}`);
console.log(`Сторінок пропущено: ${skipped}${skipped?' ('+skippedFiles.join(', ')+')':''}`);
console.log(`Правил прибрано (дублі core): ${rulesRemoved}`);
console.log(`Байтів inline-CSS звільнено: ${bytesSaved}`);
console.log(APPLY?'>> APPLIED':'>> DRY-RUN (додай --apply)');
