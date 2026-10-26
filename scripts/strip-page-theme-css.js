/**
 * Прибирає з HTML занять локальні :root і дубльовані/темні inline-правила.
 * Залишає лише унікальний layout без dark-hex (або порожній <style>).
 *
 * Usage: node scripts/strip-page-theme-css.js [dir...]
 * Default dirs: agro_II_kyrs elect_II_kyrs gas_II_kyrs mech_II_kyrs tech_II_kyrs
 */
const fs = require("fs");
const path = require("path");

const DEFAULT_DIRS = [
  "agro_II_kyrs",
  "elect_II_kyrs",
  "gas_II_kyrs",
  "mech_II_kyrs",
  "tech_II_kyrs"
];

const DARK_HEX = new Set([
  "#0b1220", "#0f172a", "#0b1324", "#0c1426", "#0e1a32", "#0a1020",
  "#0b1528", "#0d152b", "#0b162a", "#0a1426", "#0c182a", "#0f1f39",
  "#111827", "#0d1b2a", "#0b1a2f", "#12341b", "#0f2a1c", "#2a0f0f",
  "#230b0b", "#0a1020", "#204b2a"
].map((h) => h.toLowerCase()));

const BORDER_HEX = new Set([
  "#223049", "#1f2937", "#1f2a44", "#334155", "#263042", "#274364",
  "#1e293b", "#20314a", "#1f5135", "#5b2020", "#8a2b2b"
].map((h) => h.toLowerCase()));

const TEXT_HEX = new Set([
  "#e6eefc", "#e2e8f0", "#e6eef9", "#e5e7eb", "#e5edfb", "#cde1ff",
  "#cbd5e1", "#ffd4d4", "#93c5fd"
].map((h) => h.toLowerCase()));

/** Селектори, які повністю покриває edlab-core — правило можна викинути */
const DROP_SELECTORS = new Set([
  ":root", "html", "body", "html,body", "html, body",
  "a", "h1", "h2", "h3", "p", "label",
  ".wrap", ".badge", ".badge2", ".card", ".btn", ".btn:hover",
  ".btn.secondary", ".btn.primary", ".btn.ghost", ".btn.good",
  ".muted", ".small", ".mono", ".pill", ".hint", ".subtitle",
  ".title", ".head", ".btn-row", ".topbar", ".toolbar",
  ".grid", ".g2", ".g3", ".cols-2", ".grid.cols-2",
  ".field", ".box", ".out", ".good", ".badbox", ".ok", ".warn", ".bad",
  ".danger", ".table", ".tbl", ".kbd", ".note", ".script", ".callout",
  ".agenda", ".level", ".step", ".panel", ".kpi", ".logo", ".input",
  ".chips", ".chip", ".drop", ".list", ".divider", ".two", ".stack",
  ".row", ".timer", ".time", ".q", ".emoji"
]);

function mapHex(hex) {
  const h = hex.toLowerCase();
  if (DARK_HEX.has(h)) return "var(--surface)";
  if (BORDER_HEX.has(h)) return "var(--line)";
  if (TEXT_HEX.has(h)) return "var(--text)";
  if (h === "#ffffff" || h === "#fff") return "#fff";
  if (h === "#000000" || h === "#000") return "#000";
  return null;
}

function splitRules(css) {
  const rules = [];
  let i = 0;
  while (i < css.length) {
    while (i < css.length && /\s/.test(css[i])) i++;
    if (i >= css.length) break;
    if (css.startsWith("@keyframes", i)) {
      const start = i;
      const open = css.indexOf("{", i);
      if (open < 0) break;
      let depth = 0, j = open;
      for (; j < css.length; j++) {
        if (css[j] === "{") depth++;
        else if (css[j] === "}") {
          depth--;
          if (depth === 0) { j++; break; }
        }
      }
      rules.push({ type: "at", text: css.slice(start, j) });
      i = j;
      continue;
    }
    if (css[i] === "@") {
      const start = i;
      const open = css.indexOf("{", i);
      if (open < 0) break;
      let depth = 0, j = open;
      for (; j < css.length; j++) {
        if (css[j] === "{") depth++;
        else if (css[j] === "}") {
          depth--;
          if (depth === 0) { j++; break; }
        }
      }
      rules.push({ type: "at", text: css.slice(start, j) });
      i = j;
      continue;
    }
    const open = css.indexOf("{", i);
    if (open < 0) break;
    const selector = css.slice(i, open).trim();
    let depth = 0, j = open;
    for (; j < css.length; j++) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") {
        depth--;
        if (depth === 0) { j++; break; }
      }
    }
    const body = css.slice(open + 1, j - 1);
    rules.push({ type: "rule", selector, body, text: css.slice(i, j) });
    i = j;
  }
  return rules;
}

function normalizeSelector(sel) {
  return sel.replace(/\s+/g, " ").trim();
}

function shouldDropRule(selector) {
  const parts = selector.split(",").map((s) => normalizeSelector(s));
  return parts.every((p) => {
    if (DROP_SELECTORS.has(p)) return true;
    if (/^html\.embedded/.test(p)) return true;
    if (/^@/.test(p)) return false;
    // .btn.something covered if base btn
    if (/^\.btn(\.|$|:)/.test(p) && !/\.row|\.grid/.test(p)) return true;
    if (/^\.card(\.|$|:)/.test(p)) return true;
    if (/^\.badge(\.|$|:)/.test(p)) return true;
    if (/^\.table[\s.]/.test(p) || p === ".table") return true;
    if (/^media /.test(p)) return false;
    return false;
  });
}

function rewriteBody(body) {
  return body.replace(/#([0-9a-fA-F]{3,8})\b/g, (m) => {
    const mapped = mapHex(m);
    return mapped || m;
  });
}

function cleanCss(css) {
  // drop :root blocks first (nested-safe enough for flat tokens)
  css = css.replace(/:root\s*\{[^}]*\}/g, "");

  const rules = splitRules(css);
  const kept = [];
  for (const r of rules) {
    if (r.type === "at") {
      if (/^@media\s+print/i.test(r.text.trim())) continue; // print у core
      // rewrite hex inside media queries
      kept.push(rewriteBody(r.text));
      continue;
    }
    const sel = normalizeSelector(r.selector);
    if (shouldDropRule(sel)) continue;
    if (/^html\s*,\s*body|^body$|^html$/i.test(sel)) continue;
    const body = rewriteBody(r.body);
    // drop empty / only whitespace
    if (!body.replace(/\/\*[\s\S]*?\*\//g, "").trim()) continue;
    kept.push(`${sel}{${body}}`);
  }
  return kept.join("\n").trim();
}

function processFile(file) {
  let html = fs.readFileSync(file, "utf8");
  if (!html.includes("edlab-core.css")) return { file, status: "skip-no-core" };

  let changed = false;
  const next = html.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (full, attrs, css) => {
    const cleaned = cleanCss(css);
    changed = true;
    if (!cleaned) return "";
    return `<style${attrs}>\n${cleaned}\n</style>`;
  });

  if (!changed || next === html) return { file, status: "unchanged" };
  fs.writeFileSync(file, next);
  return { file, status: "updated" };
}

const dirs = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_DIRS;
const stats = { updated: 0, unchanged: 0, skip: 0 };
for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".html"))) {
    const res = processFile(path.join(dir, f));
    const rel = res.file.replace(/\\/g, "/");
    if (res.status === "updated") { stats.updated++; console.log("updated", rel); }
    else if (res.status === "unchanged") stats.unchanged++;
    else { stats.skip++; console.log("skip", rel, res.status); }
  }
}
console.log(JSON.stringify(stats));
