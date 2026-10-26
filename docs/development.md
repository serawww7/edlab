# Development log


## 2026-10-26 — Універсальне меню/хедер/футер на заняттях

### Summary
Розширено `data-chrome="minimal"` у `edlab-core.js`: на сторінках-парах з'являється компактний sticky-хедер (EDLab + розділ + select усіх пар з manifest) і повний site-footer. HTML сторінок не змінювались — один спільний хук.

### Modified files
- `assets/edlab-core.js` — lesson header, manifest cache (memory + sessionStorage), footer на minimal
- `assets/edlab-core.css` — стилі `.site-header--lesson`, `.lesson-jump__select`
- `README.md` — опис поведінки `minimal`
- `docs/development.md` — цей запис

### Notes
- Moodle iframe (`.embedded`) як і раніше без chrome.
- `buildAttribution` лишився в API/коді на випадок ручного використання, але minimal його більше не монтує.
- Потенційна увага: на дуже старих сторінках з власним `.site-footer` дубль не створиться (є guard).

## 2026-10-26 — Прибрано бейджі «Пара N · … · спеціальність»

### Summary
Видалено видимі `<span class=\"badge\">Пара …</span>` підказки над `<h1>` на сторінках занять (дубль інформації з нового хедера).

### Modified files
- 45 сторінок `agro_II_kyrs`, `mech_II_kyrs`, `tech_II_kyrs`
- 20 сторінок `elect_II_kyrs`
- Разом: 65 HTML

### Notes
- Функціональні `.badge` (статуси NFC, кейсів тощо) не чіпались.
- HTML-коментарі на кшталт `<!-- ПАРА N (аудиторно) … -->` залишені.
- gas/coach таких підказок не мали.

## 2026-10-26 — Прибрано рядок `footer-bottom`

### Summary
Видалено текст «Зроблено з турботою про зручність викладача і студента» з універсального футера.

### Modified files
- `assets/edlab-core.js` — прибрано `.footer-bottom` з `buildFooter()`
- `assets/edlab-core.css` — видалено невикористаний стиль `.footer-bottom`

## 2026-10-26 — Текст у футері (brand)

### Summary
Опис у футері: прибрано «для коледжів.»

### Modified files
- `assets/edlab-core.js`

## 2026-10-26 — about.html: світла тема

### Summary
Inline-стилі `about.html` переведені на CSS-змінні `edlab-core` (`--card`, `--soft`, `--surface-line` тощо), тож світла/темна теми працюють без дубльованих правил.

### Modified files
- `about.html`

## 2026-10-26 — legal.html: світла тема

### Summary
Inline-стилі `legal.html` переведені на CSS-змінні `edlab-core`; для `.note.ok` / `.note.warn` додано світлі варіанти.

### Modified files
- `legal.html`

## 2026-10-26 — Badge у хедері

### Summary
`brandBadge`: «цифрові пари для коледжу» (прибрано «ОПП»).

### Modified files
- `assets/edlab-core.js`

## 2026-10-26 — Світла тема для всіх занять (через core)

### Summary
Підсилено `edlab-core.css`: аліаси токенів занять (`--fg`, `--border`, `--ok`/`--danger`…) і overrides для типових блоків (card/box/level/header/btn/input/textarea/good/badbox). Локальні HTML не чіпались.

### Аудит стилів
- `137/138` HTML мають `/assets/edlab-core.css` (без `print-ticket.html`)
- `132` сторінок мають власний темний `:root` — саме його перебиває light-блок core
- Скрипт: `scripts/audit-light-theme.js`

### Modified files
- `assets/edlab-core.css`
- `README.md`
- `scripts/audit-light-theme.js` (новий)
- `docs/development.md`
