/**
 * WCAG AA contrast for lesson pages:
 * 1) Early FOUC theme script (data-theme before paint)
 * 2) Replace hardcoded dark UI colors with CSS variables so light/dark both work
 * 3) Soften page :root --muted/--text overrides that fight core theme tokens
 */
const fs = require('fs');
const path = require('path');

const DIRS = [
  'agro_II_kyrs', 'elect_II_kyrs', 'gas_II_kyrs',
  'mech_II_kyrs', 'tech_II_kyrs', 'coach'
];

const FOUC = `<script>(function(){try{var t=localStorage.getItem('edlab-theme');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme:light)').matches?'light':'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();</script>`;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.html$/i.test(f)) out.push(p);
  }
  return out;
}

function ensureFouc(html) {
  if (html.includes("edlab-theme") && html.includes("data-theme")) return html;
  if (/<meta\s+charset[^>]*>/i.test(html)) {
    return html.replace(/(<meta\s+charset[^>]*>)/i, `$1\n${FOUC}`);
  }
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/(<head[^>]*>)/i, `$1\n${FOUC}`);
  }
  return html;
}

/** Only touch <style>…</style> blocks (not ticket print JS). */
function mapStyles(html, fn) {
  return html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, (block) => fn(block));
}

function fixStyleBlock(css) {
  let s = css;

  // Page tokens: align muted with AA-safe core default (don't freeze slate-400)
  s = s.replace(/--muted:\s*#94a3b8\b/gi, '--muted:#b0bcc9');
  s = s.replace(/--muted:\s*#9aa5b1\b/gi, '--muted:#b0bcc9');
  s = s.replace(/--muted:\s*#93a4bf\b/gi, '--muted:#b0bcc9');
  s = s.replace(/--muted:\s*#93a3b5\b/gi, '--muted:#b0bcc9');

  // Body / card backgrounds → tokens (light theme can recolor)
  s = s.replace(
    /background:\s*linear-gradient\(\s*180deg\s*,\s*#0b1220\s*,\s*#111827\s+30%\s*,\s*#0b1220\s*\)/gi,
    'background:linear-gradient(180deg,var(--bg),var(--bg2) 30%,var(--bg))'
  );
  s = s.replace(
    /background:\s*linear-gradient\(\s*180deg\s*,\s*#0b1220\s+0%\s*,\s*#111827\s+40%\s*,\s*#0b1220\s+100%\s*\)/gi,
    'background:linear-gradient(180deg,var(--bg),var(--bg2) 40%,var(--bg))'
  );
  s = s.replace(
    /background:\s*linear-gradient\(\s*180deg\s*,\s*#0f172a\s*,\s*#0b1220\s*\)/gi,
    'background:linear-gradient(180deg,var(--card),var(--bg))'
  );

  // Buttons
  s = s.replace(/\.btn\{([^}]*)\}/g, (m, body) => {
    let b = body;
    b = b.replace(/color:\s*#dbeafe\b/gi, 'color:var(--btn-fg,#e2e8f0)');
    b = b.replace(/background:\s*#0d1a2e\b/gi, 'background:var(--surface)');
    b = b.replace(/border:\s*1px\s+solid\s+#223049\b/gi, 'border:1px solid var(--surface-line)');
    b = b.replace(/border-color:\s*#223049\b/gi, 'border-color:var(--surface-line)');
    return `.btn{${b}}`;
  });
  s = s.replace(/\.btn:hover\{background:\s*#0f1f39\b/gi, '.btn:hover{background:var(--surface-hover)');

  // Steps
  s = s.replace(/\.step\{([^}]*)\}/g, (m, body) => {
    let b = body;
    b = b.replace(/background:\s*#0b1324\b/gi, 'background:var(--soft)');
    b = b.replace(/border:\s*1px\s+solid\s+#1f2937\b/gi, 'border:1px solid var(--line)');
    return `.step{${b}}`;
  });
  s = s.replace(/\.step\s*\.n\{([^}]*)\}/g, (m, body) => {
    let b = body;
    b = b.replace(/background:\s*#0e1a2e\b/gi, 'background:var(--surface)');
    b = b.replace(/color:\s*#a5b4fc\b/gi, 'color:var(--chip-fg,#c7d2fe)');
    return `.step .n{${b}}`;
  });

  // Pills / tags / surfaces
  s = s.replace(/color:\s*#a5b4fc\b/gi, 'color:var(--chip-fg,#c7d2fe)');
  s = s.replace(/color:\s*#dbeafe\b/gi, 'color:var(--btn-fg,#e2e8f0)');
  s = s.replace(/color:\s*#e5e7eb\b/gi, 'color:var(--text)');
  s = s.replace(/background:\s*#0d1a2e\b/gi, 'background:var(--surface)');
  s = s.replace(/background:\s*#0b1220\b/gi, 'background:var(--bg)');
  s = s.replace(/background:\s*#0c1629\b/gi, 'background:var(--soft)');

  // Muted / footer / explanatory
  s = s.replace(/color:\s*#94a3b8\b/gi, 'color:var(--muted)');
  s = s.replace(/color:\s*#93a3b5\b/gi, 'color:var(--muted)');
  s = s.replace(/color:\s*#9aa5b1\b/gi, 'color:var(--muted)');
  s = s.replace(/color:\s*#93a4bf\b/gi, 'color:var(--muted)');
  s = s.replace(/color:\s*#a3b2c4\b/gi, 'color:var(--muted)');
  s = s.replace(/\.muted\{color:\s*var\(--muted\)\}/gi, '.muted{color:var(--muted)}');

  // Labels
  s = s.replace(/color:\s*#cbd5e1\b/gi, 'color:var(--muted)');

  // Field inputs on dark surface → tokens
  s = s.replace(
    /border:\s*1px\s+solid\s+#223049;\s*background:\s*#0d1a2e;\s*color:\s*#e5e7eb/gi,
    'border:1px solid var(--surface-line); background:var(--surface); color:var(--text)'
  );

  // Embedded footer was too light on white
  s = s.replace(
    /html\.embedded\s+\.footer\{color:\s*var\(--muted\)/gi,
    'html.embedded .footer{color:#475569'
  );
  s = s.replace(
    /html\.embedded\s+\.footer\{color:\s*#94a3b8/gi,
    'html.embedded .footer{color:#475569'
  );

  return s;
}

function fixInlineMuted(html) {
  // style="... color:#a3b2c4 ..." outside print templates — only in body markup
  return html.replace(
    /style="([^"]*?)color:\s*#(a3b2c4|94a3b8|93a3b5|9aa5b1|93a4bf)\b([^"]*)"/gi,
    'style="$1color:var(--muted)$3"'
  );
}

let files = 0, changed = 0;
for (const dir of DIRS) {
  for (const file of walk(dir)) {
    files++;
    let html = fs.readFileSync(file, 'utf8');
    const before = html;
    html = ensureFouc(html);
    html = mapStyles(html, fixStyleBlock);
    html = fixInlineMuted(html);
    if (html !== before) {
      fs.writeFileSync(file, html);
      changed++;
    }
  }
}
console.log(`fix-lesson-contrast: ${changed}/${files} files updated`);
