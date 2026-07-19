# EDLab

Статичний освітній сайт для GitHub Pages: інтерактивні лабораторні роботи,
цифрові журнали та коуч-тренінги для коледжів.

**Прод:** https://edlab.pp.ua  
**Автор:** Сергій Поліщук

---

## Структура

```
/
├── index.html              ← головна (розділи)
├── spec.html               ← каталог занять + генератор iFrame для Moodle
├── about.html / legal.html ← про проєкт / правова інформація
├── print-ticket.html       ← технічна сторінка друку чека 58 мм
├── assets/
│   ├── edlab-core.css      ← спільні стилі, токени, Header/Footer, тема
│   ├── edlab-core.js       ← Header/Footer, тема, prev/next, утиліти
│   ├── manifest.json       ← глобальний маніфест розділів (генерується)
│   └── favicon.*
├── agro_II_kyrs/           ← 25 пар (агрономія)
├── elect_II_kyrs/          ← 25 пар (електроенергетика)
├── gas_II_kyrs/            ← 25 пар (газовики)
├── mech_II_kyrs/           ← 25 пар (механіки)
├── tech_II_kyrs/           ← 25 пар (технологи)
├── coach/                  ← психологічні тренінги
├── scripts/                ← Node-скрипти збірки / міграції
└── tools/                  ← службові інструменти (не в sitemap)
```

Кожна сторінка-заняття — **самодостатній HTML** (працює в Moodle через iFrame,
через QR/NFC, офлайн). Спільний шар підключається адитивно:

```html
<link rel="stylesheet" href="/assets/edlab-core.css">
…
<script src="/assets/edlab-core.js" data-chrome="minimal" defer></script>
```

---

## Спільний шар (`assets/edlab-core.*`)

### CSS
- Єдині семантичні токени (`--bg`, `--text`, `--accent`, …)
- Компоненти: кнопки, картки, таблиці, форми, toast, чек 58 мм
- Єдиний `.site-header` / `.site-footer`
- **Світла / темна тема** через `html[data-theme="light|dark"]`
- Режим Moodle: `html.embedded` (світлий вигляд, без chrome)

### JS (`window.EDLab`)
| API | Призначення |
|-----|-------------|
| `EDLab.toast(msg)` | Сповіщення |
| `EDLab.copy(text)` | Clipboard (сучасний API + fallback) |
| `EDLab.printTicket('#ticket')` | Друк чека 58 мм через iframe |
| `EDLab.toCSV` / `download` / `fmtDate` | CSV / файли / дати |
| `EDLab.getTheme` / `setTheme` / `toggleTheme` | Тема |

### `data-chrome`
| Значення | Поведінка |
|----------|-----------|
| `full` | Header + Footer + перемикач теми (оболонкові сторінки) |
| `minimal` | Атрибуція «© EDLab» + **попередня/наступна пара** + тема (заняття) |
| `none` | Лише утиліти |

У iframe (`embedded`) chrome автоматично ховається.

---

## Тема (світла / темна)

1. За замовчуванням — системна перевага (`prefers-color-scheme`).
2. Вибір зберігається в `localStorage` (`edlab-theme`).
3. Перемикач ☀/☾ у хедері (оболонка) або біля атрибуції (заняття).
4. На оболонкових сторінках тема застосовується повністю (токени core).
5. На сторінках-заняттях тема впливає на chrome (nav/атрибуція); локальні
   inline-стилі уроку лишаються своїми, щоб не зламати калькулятори/контраст.

---

## Навігація «попередня / наступна пара»

На сторінках-заняттях `edlab-core.js` читає `/<розділ>/manifest.json` і
показує блок «← Попередня / Наступна →» перед атрибуцією.
У Moodle-iframe блок не показується.

---

## Маніфести

Маніфести **генеруються** з HTML (`<title>` + `<meta description>`):

```bash
npm run build-manifest
```

Пише `assets/manifest.json` і локальні `*/manifest.json`.
`spec.html` бере назви з маніфесту (без важкого fetch кожної сторінки).

---

## Скрипти збірки

```bash
npm run apply-core       # підключити core.css/js до нових сторінок
npm run fix-meta         # SEO: title, description, canonical, OG, JSON-LD
npm run dedup-css        # безпечна дедуплікація inline-CSS vs core
npm run build-manifest   # маніфести з title/desc
npm run generate-sitemap # sitemap.xml
npm run build            # усе послідовно
```

Додаткові утиліти:
- `scripts/remove-print-patch.js` — прибрав дубль PRINT PATCH CSS
- `scripts/fix-core-injection.js` — виправив помилкове вставлення core.js
  всередину template-literal рядків друку чека
- `scripts/dedup-vs-core.js` — dry-run / `--apply` дедуп vs core

GitHub Action `.github/workflows/seo-autofix.yml` запускає `npm run build`
і відкриває PR з SEO-оновленнями.

---

## Конвенції для нової сторінки-заняття

1. Файл у відповідній теці: `*_paraN.html` або `coach/*.html`.
2. Після створення: `npm run apply-core` (або повний `npm run build`).
3. Чек для друку: `<div class="ticket" id="ticket">…</div>`.
4. Не дублювати Header/Footer — їх рендерить core.
5. Локальні стилі — лише те, що специфічне для цієї пари.
6. URL / імена файлів **не змінювати** (зовнішні посилання, Moodle, QR).

---

## Ліцензія / використання

Див. [legal.html](https://edlab.pp.ua/legal.html).
Освітнє некомерційне використання з атрибуцією дозволене.
Комерційне — за згодою автора.
