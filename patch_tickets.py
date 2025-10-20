# patch_tickets.py
# Масове виправлення друку чека (#ticket) у всіх *.html:
# - onclick="window.print()"  -> onclick="printTicketNewTab()"
# - (агресивно) будь-який window.print() у JS -> printTicketNewTab()
# - додає жирний стиль для .ticket
# - додає функції printTicketNewTab() + openTicketOnly() перед </body>
# - є --dry-run (нічого не пише), робить .bak перед зміною
# Python 3.8+

import os, re, sys, argparse

EXCLUDE_DIRS = {'.git', 'node_modules', 'dist', 'build', '.next', '.cache'}
ENCODING = 'utf-8'

CSS_MARKER = '/* PRINT PATCH v1 CSS (auto) */'
JS_MARKER  = '// PRINT PATCH v1 (auto)'
JS_PLACEHOLDER = '__PRINT_PATCH_JS_BLOCK__'

# Важливо: звичайні трійні рядки (НЕ f-string), щоб не ламати ${...} у JS
CSS_BLOCK = """
<style>
/* PRINT PATCH v1 CSS (auto) */
.ticket{ font-weight:700; letter-spacing:0.1px }
.ticket h4{ font-weight:700 }
.ticket p,
.ticket b,
.ticket strong,
.ticket span,
.ticket small{ font-weight:700 }
</style>
"""

JS_BLOCK = """
<script>
// PRINT PATCH v1 (auto)
function printTicketNewTab(){
  var ticket = document.getElementById('ticket');
  if(!ticket){ alert('Немає #ticket на сторінці'); return; }
  try{
    var someTxt = (document.querySelector('#ticket span, #ticket p, #ticket h4')||{}).textContent||'';
    if(!someTxt || someTxt.trim()==='—'){ if(typeof buildTicket==='function') buildTicket(); }
  }catch(_){}

  var css = `
    @media print { @page { size:58mm auto; margin:0 } }
    html,body{ margin:0; padding:0; background:#fff; color:#000 }
    .ticket{
      width:58mm; margin:0; padding:6mm 4mm; background:#fff; color:#000;
      font-family:"Courier New", Courier, monospace; font-weight:700; letter-spacing:0.1px;
      border:none; box-shadow:none; border-radius:0
    }
    .ticket h4{ margin:0 0 6px; font-size:13px; text-align:center; font-weight:700 }
    .ticket p{ margin:2px 0; font-size:12px; font-weight:700 }
    .ticket b,.ticket strong,.ticket span{ font-weight:700 }
    .line{ border-top:1px dashed #111; margin:6px 0 }
    small{ font-size:10px; font-weight:700 }
  `;
  var html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Чек 58 мм</title><style>${css}</style></head><body>${ticket.outerHTML}
  <script>
    window.addEventListener('load',()=>{
      try{ window.focus(); window.print(); if(window.opener) window.opener.postMessage({type:'ticketPrint',status:'invoked'},'*'); }
      catch(e){ if(window.opener) window.opener.postMessage({type:'ticketPrint',status:'error'},'*'); }
    });
  <\\/script>
  </body></html>`;

  var w = window.open('', '_blank');
  if(!w){ openTicketOnly(); return; }  // попап заблоковано — фолбек
  w.document.open(); w.document.write(html); w.document.close();

  var timer = setTimeout(()=>{ openTicketOnly(); }, 1200);
  window.addEventListener('message', (ev)=>{
    if(ev && ev.data && ev.data.type==='ticketPrint'){ clearTimeout(timer); }
  }, {once:true});
}

function openTicketOnly(){
  var ticket = document.getElementById('ticket');
  if(!ticket){ alert('Немає #ticket на сторінці'); return; }
  try{
    var someTxt = (document.querySelector('#ticket span, #ticket p, #ticket h4')||{}).textContent||'';
    if(!someTxt || someTxt.trim()==='—'){ if(typeof buildTicket==='function') buildTicket(); }
  }catch(_){}

  var css = `
    @media print { @page { size:58mm auto; margin:0 } }
    html,body{ margin:0; background:#fff; color:#000 }
    .ticket{
      width:58mm; margin:0; padding:6mm 4mm; background:#fff; color:#000;
      font-family:"Courier New", Courier, monospace; font-weight:700; letter-spacing:0.1px;
      border:none; box-shadow:none; border-radius:0
    }
    .ticket h4{ margin:0 0 6px; font-size:13px; text-align:center; font-weight:700 }
    .ticket p{ margin:2px 0; font-size:12px; font-weight:700 }
    .line{ border-top:1px dashed #111; margin:6px 0 }
    small{ font-size:10px; font-weight:700 }
  `;
  var html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Чек 58 мм</title><style>${css}</style></head><body>${ticket.outerHTML}
<script>window.addEventListener('load',()=>{ try{ window.focus(); window.print(); }catch(e){} });<\/script>
</body></html>`;

  var blob = new Blob([html], {type:'text/html'});
  var url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(()=>URL.revokeObjectURL(url), 60000);
}
</script>
"""

# 1) onclick="window.print()" у HTML-атрибуті
RE_ONCLICK_PRINT = re.compile(
    r'onclick\s*=\s*([\'"])\s*window\s*\.\s*print\s*\(\s*\)\s*;?\s*\1',
    re.IGNORECASE
)

# 2) агресивно: будь-який window.print() токен поза нашим JS-блоком
RE_ANY_PRINT = re.compile(r'window\s*\.\s*print\s*\(\s*\)', re.IGNORECASE)

def should_skip_dir(dirname: str) -> bool:
    name = os.path.basename(dirname)
    return name in EXCLUDE_DIRS

def protect_js_block(text: str):
    """Вирізаємо наш JS-блок (між JS_MARKER та наступним </script>) і повертаємо текст без нього + сам блок."""
    start = text.find(JS_MARKER)
    if start == -1:
        return text, None
    # Знайти початок <script> перед маркером
    script_start = text.rfind('<script', 0, start)
    if script_start == -1:
        return text, None
    # Знайти закриваючий </script> після маркера
    script_end = text.find('</script>', start)
    if script_end == -1:
        return text, None
    script_end += len('</script>')
    block = text[script_start:script_end]
    text_wo = text[:script_start] + JS_PLACEHOLDER + text[script_end:]
    return text_wo, block

def restore_js_block(text: str, block: str):
    if block is None:
        return text
    return text.replace(JS_PLACEHOLDER, block)

def patch_file(path: str, dry_run: bool=False, aggressive: bool=True) -> bool:
    try:
        with open(path, 'r', encoding=ENCODING) as f:
            text = f.read()
    except Exception as e:
        print(f"[! ] read fail {path}: {e}")
        return False

    # Працюємо лише з файлами, де є #ticket
    if 'id="ticket"' not in text and "id='ticket'" not in text:
        return False

    original = text
    changed = False

    # 1) onclick="window.print()" -> onclick="printTicketNewTab()"
    def _repl(m):
        quote = m.group(1)
        return f'onclick={quote}printTicketNewTab(){quote}'
    text2, nrep_attr = RE_ONCLICK_PRINT.subn(_repl, text)
    if nrep_attr > 0:
        text = text2
        changed = True

    # 2) агресивна заміна window.print() у JS (поза нашим блоком)
    if aggressive:
        text_wo, saved_block = protect_js_block(text)
        text3, nrep_js = RE_ANY_PRINT.subn('printTicketNewTab()', text_wo)
        if nrep_js > 0:
            text = restore_js_block(text3, saved_block)
            changed = True

    # 3) CSS-блок (жирний .ticket) — вставити, якщо ще нема
    if CSS_MARKER not in text:
        if '</head>' in text:
            text = text.replace('</head>', CSS_BLOCK + '\n</head>')
        else:
            text = text.replace('<body', CSS_BLOCK + '\n<body')
        changed = True

    # 4) JS-функції друку — якщо ще не додавали
    if JS_MARKER not in text:
        if '</body>' in text:
            text = text.replace('</body>', JS_BLOCK + '\n</body>')
        else:
            text = text + '\n' + JS_BLOCK + '\n'
        changed = True

    if not changed or text == original:
        return False

    if dry_run:
        print(f"[DRY] would patch: {path}")
        return True

    # реальний запис з бекапом
    try:
        with open(path + '.bak', 'w', encoding=ENCODING) as b:
            b.write(original)
    except Exception as e:
        print(f"[! ] backup fail {path}: {e}")
        return False

    try:
        with open(path, 'w', encoding=ENCODING) as f:
            f.write(text)
    except Exception as e:
        print(f"[! ] write fail {path}: {e}")
        return False

    print(f"[✔] patched: {path}")
    return True

def main():
    ap = argparse.ArgumentParser(description="Патч друку чеків у всіх *.html")
    ap.add_argument('--dry-run', action='store_true', help='Лише показати, які файли будуть змінені')
    ap.add_argument('--no-aggressive', action='store_true', help='Вимкнути агресивну заміну window.print() у JS')
    args = ap.parse_args()

    aggressive = not args.no_aggressive
    dry = args.dry_run

    root = os.getcwd()
    changed = 0
    scanned = 0
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if os.path.basename(d) not in EXCLUDE_DIRS]
        for fn in filenames:
            if not fn.lower().endswith('.html'):
                continue
            path = os.path.join(dirpath, fn)
            scanned += 1
            ok = patch_file(path, dry_run=dry, aggressive=aggressive)
            if ok:
                changed += 1

    print(f"\\nDone. scanned={scanned}, affected={changed} (dry_run={dry}, aggressive={aggressive})")

if __name__ == '__main__':
    main()
