# patch_print_all.py
import os
import re
import sys

PATCH_MARK = "PRINT PATCH v1"

JS_PATCH = f"""\
<!-- {PATCH_MARK} START -->
<script>
function printTicketNewTab(){{
  var ticket = document.getElementById('ticket');
  if(!ticket){{ alert('Немає #ticket на сторінці'); return; }}
  // Якщо чек порожній — спробуємо згенерувати
  try {{
    var idText = (document.getElementById('tId')||{{}}).textContent||'';
    if(!idText || idText.trim()==='—'){{ if(typeof buildTicket==='function') buildTicket(); }}
  }} catch(_){{
    // ignore
  }}

  var css = `
    @media print {{ @page {{ size:58mm auto; margin:0 }} }}
    html,body{{ margin:0; padding:0; background:#fff; color:#000 }}
    .ticket{{ width:58mm; margin:0; padding:6mm 4mm; background:#fff; color:#000;
             font-family:"Courier New", Courier, monospace; font-weight:700; letter-spacing:0.1px;
             border:none; box-shadow:none; border-radius:0 }}
    .ticket h4{{margin:0 0 6px; font-size:13px; text-align:center; font-weight:700}}
    .ticket p{{margin:2px 0; font-size:12px; font-weight:700}}
    .ticket b,.ticket strong,.ticket span{{font-weight:700}}
    .line{{border-top:1px dashed #111; margin:6px 0}}
    small{{font-size:10px; font-weight:700}}
  `;
  var html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Чек 58 мм</title><style>${{css}}</style></head><body>${{ticket.outerHTML}}
  <script>
    window.addEventListener('load',()=>{{
      try{{ window.focus(); window.print(); if(window.opener) window.opener.postMessage({{type:'ticketPrint',status:'invoked'}},'*'); }}
      catch(e){{ if(window.opener) window.opener.postMessage({{type:'ticketPrint',status:'error'}},'*'); }}
    }});
  <\/script>
  </body></html>`;

  var w = window.open('', '_blank');
  if(!w){{  // попап заблокований
    openTicketOnly();
    return;
  }}
  w.document.open(); w.document.write(html); w.document.close();

  // Якщо протягом ~1.2с не прийде відповідь — вважай, що друк не спрацював і зроби фолбек
  var timer = setTimeout(()=>{{ openTicketOnly(); }}, 1200);
  window.addEventListener('message', (ev)=>{{
    if(ev && ev.data && ev.data.type==='ticketPrint'){{ clearTimeout(timer); }}
  }}, {{once:true}});
}}

function openTicketOnly(){{
  var ticket = document.getElementById('ticket');
  if(!ticket){{ alert('Немає #ticket на сторінці'); return; }}
  try {{
    var idText = (document.getElementById('tId')||{{}}).textContent||'';
    if(!idText || idText.trim()==='—'){{ if(typeof buildTicket==='function') buildTicket(); }}
  }} catch(_){{
    // ignore
  }}

  var css = `
    @media print {{ @page {{ size:58mm auto; margin:0 }} }}
    html,body{{ margin:0; padding:0; background:#fff; color:#000 }}
    .ticket{{ width:58mm; margin:0; padding:6mm 4mm; background:#fff; color:#000;
             font-family:"Courier New", Courier, monospace; font-weight:700; letter-spacing:0.1px;
             border:none; box-shadow:none; border-radius:0 }}
    .ticket h4{{margin:0 0 6px; font-size:13px; text-align:center; font-weight:700}}
    .ticket p{{margin:2px 0; font-size:12px; font-weight:700}}
    .ticket b,.ticket strong,.ticket span{{font-weight:700}}
    .line{{border-top:1px dashed #111; margin:6px 0}}
    small{{font-size:10px; font-weight:700}}
  `;
  var html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Чек 58 мм</title><style>${{css}}</style></head><body>${{ticket.outerHTML}}
  <script>window.addEventListener('load',()=>{{ try{{ window.focus(); window.print(); }}catch(e){{}} }});<\/script>
  </body></html>`;

  var blob = new Blob([html], {{type:'text/html'}});
  var url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(()=>URL.revokeObjectURL(url), 60000);
}
</script>
<!-- {PATCH_MARK} END -->
"""

CSS_PATCH = f"""\
<!-- {PATCH_MARK} CSS -->
<style>
/* Підсилюємо контраст друку на екрані теж */
.ticket{{ font-weight:700; letter-spacing:0.1px }}
.ticket h4{{ font-weight:700 }}
.ticket p, .ticket b, .ticket strong, .ticket span, .ticket small{{ font-weight:700 }}
</style>
"""

# 1) заміна window.print() → printTicketNewTab()
PRINT_BTN_RX = re.compile(r'onclick\s*=\s*"window\.print\(\)"')

# 2) вставка JS перед </body> або перед останнім </script>
BODY_CLOSE_RX = re.compile(r'</body\s*>', re.IGNORECASE)
HEAD_CLOSE_RX = re.compile(r'</head\s*>', re.IGNORECASE)

def patch_file(path):
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        text = f.read()

    original = text
    changed = False

    # Пропускаємо, якщо явно немає #ticket — нема сенсу патчити друк
    if '#ticket' not in text:
        return False

    # A) Заміна onclick="window.print()" на printTicketNewTab()
    if PRINT_BTN_RX.search(text):
        text = PRINT_BTN_RX.sub('onclick="printTicketNewTab()"', text)
        changed = True

    # B) Додати CSS-патч у <head>, якщо ще не додано
    if PATCH_MARK not in text:
        # Вставляємо CSS перед </head>, якщо є, інакше на початок файлу
        if HEAD_CLOSE_RX.search(text):
            text = HEAD_CLOSE_RX.sub(CSS_PATCH + '\n</head>', text, count=1)
        else:
            text = CSS_PATCH + '\n' + text
        changed = True

    # C) Додати JS-патч перед </body>, якщо ще не додано
    if PATCH_MARK not in text:
        if BODY_CLOSE_RX.search(text):
            text = BODY_CLOSE_RX.sub(JS_PATCH + '\n</body>', text, count=1)
        else:
            # якщо чомусь немає </body> — просто додамо в кінець
            text = text + '\n' + JS_PATCH
        changed = True

    if changed:
        # створюємо .bak
        bak_path = path + '.bak'
        with open(bak_path, 'w', encoding='utf-8', errors='ignore') as b:
            b.write(original)
        with open(path, 'w', encoding='utf-8', errors='ignore') as w:
            w.write(text)
    return changed

def walk_and_patch(root):
    total = 0
    touched = 0
    for dirpath, _, filenames in os.walk(root):
        for name in filenames:
            if not name.lower().endswith('.html'):
                continue
            total += 1
            p = os.path.join(dirpath, name)
            try:
                if patch_file(p):
                    touched += 1
                    print(f'Patched: {p}')
            except Exception as e:
                print(f'ERROR: {p} -> {e}')
    print(f'\nDone. HTML files scanned: {total}, patched: {touched}')

if __name__ == '__main__':
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    walk_and_patch(root)
