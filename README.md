абсолютно розумію. Щоб не «гасити пожежі» по одній сторінці, потрібні спільні правила та кістяк. Ось проста, робоча схема для **статичного сайту без збірок і зовнішніх бібліотек** (добре лягає і на GitHub Pages, і на Moodle/iframe).

# Каркас проєкту

```
/assets/
  core.css        ← спільні базові стилі
  print.css       ← єдині правила друку (чек 58 мм)
  core.js         ← утиліти: дата, CSV, clipboard, safePrintIframe, initEmbeddedMode
  ticket.js       ← єдиний механізм формування+друку чеків
  page.css        ← (необов’язково) дрібні доповнення для окремих курсів
/index.html
/mechanic/para1.html
/mechanic/para2.html
/tech/para1.html
/elec/para1.html
... інші сторінки
```

## 1) Єдиний HTML-шаблон сторінки (скелет)

Кожна сторінка починається однаково (без кнопки «Додому», як ти і хочеш):

```html
<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="light dark">
  <title>Назва пари</title>

  <!-- Спільні стилі -->
  <link rel="stylesheet" href="/assets/core.css">
  <link rel="stylesheet" href="/assets/print.css">

  <!-- (Опц.) локальні стилі саме для цієї сторінки -->
  <!-- <link rel="stylesheet" href="/assets/page.css"> -->
</head>
<body>
  <div class="wrap">
    <!-- Весь контент сторінки тут -->
    <!-- Блок з чеком завжди має id="ticket" і клас .ticket -->
    <div class="ticket" id="ticket">…контент чека…</div>
  </div>

  <!-- Спільні утиліти та модулі -->
  <script src="/assets/core.js"></script>
  <script src="/assets/ticket.js"></script>

  <!-- Локальний сценарій сторінки (логіка саме цієї пари) -->
  <script>
    // приклад — ініціалізація і прив’язка кнопок
    initEmbeddedMode(); // робить світлу тему всередині iframe Moodle
    // ...твоя логіка таблиць/розрахунків...
    document.getElementById('btnPrint')?.addEventListener('click', ()=>{
      ensureTicketFilled(buildTicket); // 1) згенерує чек, якщо порожній
      printTicketByIframe('#ticket');  // 2) надрукує тільки чек (58 мм)
    });
  </script>
</body>
</html>
```

## 2) Єдині стилі

### `/assets/core.css`

* базова типографіка, сітка, .card/.box/.table, темні клітинки `.dark`
* вигляд `.ticket` на екрані (НЕ друк)

### `/assets/print.css`

* **тільки правила друку чека**, однакові всюди:

```css
/* НІКОЛИ не ховаємо весь body. Друкуємо через iframe */
@page { size: 58mm auto; margin: 0 }
.ticket{ width:58mm; padding:6mm 4mm; background:#fff; color:#000;
         font-family:"Courier New", ui-monospace, monospace; }
.ticket h4{ margin:0 0 6px; font-size:13px; text-align:center; font-weight:700 }
.ticket p{ margin:2px 0; font-size:12px; font-weight:700 } /* жирніший для слабких принтерів */
.ticket .line{ border-top:1px dashed #111; margin:6px 0 }
.ticket small{ font-size:10px; font-weight:700 }
```

> Ми **взагалі не використовуємо `@media print` для сторінки**. Друк робить `ticket.js` через прихований iframe з чистим HTML — тому браузеру нема що «переплутати».

## 3) Єдині утиліти

### `/assets/core.js`

```js
// Світлий вигляд у Moodle iFrame
function initEmbeddedMode(){
  try{ if (window.self !== window.top) document.documentElement.classList.add('embedded'); }catch(e){}
}

// Копі-паста, CSV, дати — за потреби (приклади)
function copyText(txt){ return navigator.clipboard.writeText(txt); }
function fmtDate(d){ return new Date(d).toISOString().slice(0,10); }

// Безпечний друк HTML через прихований iframe
function safePrintHtml(html){
  let frame = document.getElementById('printFrame');
  if(!frame){
    frame = document.createElement('iframe');
    frame.id = 'printFrame';
    frame.style.position='fixed'; frame.style.right='0'; frame.style.bottom='0';
    frame.style.width='1px'; frame.style.height='1px'; frame.style.opacity='0'; frame.style.border='0';
    document.body.appendChild(frame);
  }
  const doc = frame.contentWindow.document;
  doc.open(); doc.write(html); doc.close();

  const tryPrint = () => {
    try { frame.contentWindow.focus(); frame.contentWindow.print(); }
    finally { setTimeout(()=>frame.remove(), 800); }
  };
  if ('requestAnimationFrame' in frame.contentWindow){
    frame.contentWindow.requestAnimationFrame(()=>frame.contentWindow.requestAnimationFrame(tryPrint));
  } else {
    setTimeout(tryPrint, 150);
  }
}
```

## 4) Єдиний модуль друку чеків

### `/assets/ticket.js`

```js
// Забезпечуємо: якщо чек порожній — викликати builder() перед друком
function ensureTicketFilled(builder){
  const idEl = document.getElementById('tId'); // або будь-який ключовий елемент у твоєму чеку
  if (!idEl || (idEl.textContent||'').trim()==='—'){
    if (typeof builder === 'function') builder();
  }
}

function printTicketByIframe(ticketSelector){
  const ticket = document.querySelector(ticketSelector);
  if(!ticket){ alert('Немає елемента з чеком'); return; }

  const css = `
    @page { size:58mm auto; margin:0 }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html,body{ margin:0; padding:0; background:#fff; color:#000 }
    .ticket{ width:58mm; margin:0; padding:6mm 4mm; background:#fff; color:#000;
             font-family:"Courier New",ui-monospace,monospace; border:none; box-shadow:none; border-radius:0 }
    .ticket h4{ margin:0 0 6px; font-size:13px; text-align:center; font-weight:700 }
    .ticket p{ margin:2px 0; font-size:12px; font-weight:700 }
    .line{ border-top:1px dashed #111; margin:6px 0 }
    small{ font-size:10px; font-weight:700 }
  `;

  const html = `<!doctype html><html><head><meta charset="utf-8">
    <title>Чек 58 мм</title><style>${css}</style></head><body>${ticket.outerHTML}</body></html>`;

  safePrintHtml(html);
}
```

> От тепер **будь-яка сторінка** просто викликає:
>
> ```js
> ensureTicketFilled(buildTicket);
> printTicketByIframe('#ticket');
> ```
>
> і незалежно від браузера/телефону/iframe друкується **тільки чек** з однаковими правилами.

---

# Чіткі конвенції (договір по сторінках)

1. **ID і класи чека** однакові всюди:

   * контейнер: `<div class="ticket" id="ticket">…</div>`
   * всередині обов’язково є хоча б один «ключовий» елемент з ID (наприклад, `#tId`), щоб `ensureTicketFilled` зміг визначити, що заповнено.
2. **Кнопка “Друк”** у всіх сторінках викликає **один і той самий** код:

   ```js
   btn.onclick = () => { ensureTicketFilled(buildTicket); printTicketByIframe('#ticket'); };
   ```
3. **Жодних `@media print` що ховають/показують сторінку.** Винятково iframe-друк.
4. **Жирніший шрифт** у чеку за замовчуванням (щоб дешеві термопринтери давали читабельний результат).
5. **Утиліти для CSV/NFC/форматів** — в `core.js`. Сторінки не дублюють код.

---

# Як упорядкувати те, що вже є (поступовий план)

1. **Створити `/assets/`** і додати туди `core.css`, `print.css`, `core.js`, `ticket.js` (зверху).
2. **Оновити 1 сторінку** (наприклад, ту, що вже “механіки — пара 1”) до шаблону:

   * підключити `core.css`, `print.css`, `core.js`, `ticket.js`;
   * прибрати локальні `@media print`;
   * кнопку «Друк» прив’язати до `ensureTicketFilled + printTicketByIframe`.
3. Якщо все ок — **масово**:

   * простим find/replace підключити 4 файли в `<head>/<body>` на всіх сторінках;
   * у кожній сторінці **перейменувати** контейнер чека під єдину схему (`id="ticket" class="ticket"`);
   * у функції побудови конкретного чека (`buildTicket` на сторінці) **заповнювати** елементи `#tXXX`.
4. **Прибрати «домашні» кнопки** із сторінок (ти й так хочеш це зробити) — не чіпаємо зовнішній вигляд.
5. За потреби — **невеличкі локальні стилі** в `/assets/page.css`, але логіку й друк не чіпати.

---

# Мінімальний чек-лист для рев’ю кожної сторінки

* [ ] Підключено `/assets/core.css`, `/assets/print.css`, `/assets/core.js`, `/assets/ticket.js`.
* [ ] Є `<div id="ticket" class="ticket">…</div>`.
* [ ] Є `buildTicket()` і кнопка «Друк» викликає:
  `ensureTicketFilled(buildTicket); printTicketByIframe('#ticket');`
* [ ] Відсутні локальні `@media print`, що ховають `body`.
* [ ] Жирний текст у чеку читається з термопринтера.

---

Хочеш — скину невеличкий Python-скрипт, який:

* перевіряє, що сторінка відповідає конвенціям (є `#ticket`, є підключені `/assets/...`);
* підказує, що саме не так.
