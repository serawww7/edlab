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
