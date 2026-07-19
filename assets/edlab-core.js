/* ==========================================================================
   EDLab core — єдиний рантайм: Header, Footer, тема, навігація пар, утиліти.
   Підключення:
     <link rel="stylesheet" href="/assets/edlab-core.css">
     <script src="/assets/edlab-core.js" data-chrome="full|minimal|none" defer></script>
   data-chrome:
     full    — повний site Header + Footer (оболонкові сторінки).
     minimal — атрибуція + prev/next (сторінки-заняття). За замовч.
     none    — нічого не рендерити (лише утиліти/embedded).
   ========================================================================== */
(function () {
  "use strict";

  var YEAR = new Date().getFullYear();
  var THEME_KEY = "edlab-theme";

  var CONFIG = {
    brandEmoji: "🎓",
    brandName: "EDLab",
    brandBadge: "цифрові пари для ОПП коледжу",
    facebook: "https://www.facebook.com/coach.Sergiy",
    infoSite: "https://www.serawww.pp.ua",
    nav: [
      { href: "/index.html", label: "Головна" },
      { href: "/about.html", label: "Про EDLab" },
      { href: "/legal.html", label: "Правова інформація" }
    ]
  };

  // --- embedded (iframe) -------------------------------------------------
  function inIframe() {
    try { return window.self !== window.top; } catch (e) { return true; }
  }
  if (inIframe()) document.documentElement.classList.add("embedded");

  // --- helpers -----------------------------------------------------------
  function currentScript() {
    return document.currentScript ||
      document.querySelector('script[src*="edlab-core.js"]');
  }
  function normalize(path) {
    return (path || "").replace(/index\.html$/, "").replace(/\/+$/, "/") || "/";
  }
  function isCurrent(href) {
    var here = normalize(location.pathname);
    var there = normalize(href);
    return here === there || here === there.replace(/\.html$/, "");
  }
  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // --- Theme -------------------------------------------------------------
  function systemTheme() {
    try {
      return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    } catch (e) { return "dark"; }
  }
  function getTheme() {
    try {
      var t = localStorage.getItem(THEME_KEY);
      if (t === "light" || t === "dark") return t;
    } catch (e) {}
    return systemTheme();
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var btns = document.querySelectorAll(".theme-toggle");
    for (var i = 0; i < btns.length; i++) {
      var isLight = theme === "light";
      btns[i].textContent = isLight ? "☾" : "☀";
      btns[i].setAttribute("aria-label", isLight ? "Увімкнути темну тему" : "Увімкнути світлу тему");
      btns[i].title = isLight ? "Темна тема" : "Світла тема";
    }
  }
  function setTheme(theme) {
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
    applyTheme(theme);
  }
  function toggleTheme() {
    setTheme(getTheme() === "light" ? "dark" : "light");
  }
  function themeButton() {
    return '<button type="button" class="theme-toggle" aria-label="Перемкнути тему">☀</button>';
  }
  // Застосувати одразу (навіть до DOMContentLoaded), щоб зменшити FOUC
  applyTheme(getTheme());

  // --- Header ------------------------------------------------------------
  function buildHeader() {
    var nav = CONFIG.nav.map(function (i) {
      var cur = isCurrent(i.href) ? ' aria-current="page"' : "";
      return '<a href="' + i.href + '"' + cur + ">" + i.label + "</a>";
    }).join("");

    var el = document.createElement("header");
    el.className = "site-header";
    el.innerHTML =
      '<div class="site-header__inner">' +
        '<a class="site-header__brand" href="/index.html">' +
          '<span class="emoji">' + CONFIG.brandEmoji + "</span>" +
          "<b>" + CONFIG.brandName + "</b>" +
          '<span class="badge">' + CONFIG.brandBadge + "</span>" +
        "</a>" +
        '<nav class="site-header__nav">' + nav + themeButton() + "</nav>" +
      "</div>";
    return el;
  }

  // --- Footer ------------------------------------------------------------
  function buildFooter() {
    var el = document.createElement("footer");
    el.className = "site-footer";
    el.innerHTML =
      '<div class="footer-inner">' +
        '<div class="col brand">' +
          '<div class="brand-line"><span class="emoji">🌾</span><strong>' + CONFIG.brandName + "</strong></div>" +
          "<p>Інтерактивні лабораторні роботи та цифрові освітні інструменти для коледжів.</p>" +
        "</div>" +
        '<div class="col legal">' +
          "<h3>Правова інформація</h3>" +
          "<p>© " + YEAR + " <b>Сергій ПОЛІЩУК</b>. Матеріали захищені авторським правом.</p>" +
          '<ul><li><a href="/legal.html">Умови використання</a></li></ul>' +
        "</div>" +
        '<div class="col links">' +
          "<h3>Офіційні ресурси</h3>" +
          "<ul>" +
            '<li><a href="/about.html">Про EDLab</a></li>' +
            '<li><a href="' + CONFIG.infoSite + '" target="_blank" rel="noopener">Сторінка інформатика</a></li>' +
            '<li><a href="' + CONFIG.facebook + '" target="_blank" rel="noopener">Facebook</a></li>' +
          "</ul>" +
        "</div>" +
      "</div>" +
      '<div class="footer-bottom"><span>Зроблено з турботою про зручність викладача і студента</span></div>';
    return el;
  }

  function buildAttribution() {
    var el = document.createElement("div");
    el.className = "edlab-attribution";
    el.innerHTML =
      '<span>© ' + YEAR + ' Сергій Поліщук · <a href="https://edlab.pp.ua">EDLab</a></span>' +
      ' · ' + themeButton();
    return el;
  }

  // --- Prev / Next lesson ------------------------------------------------
  function sectionDirFromPath() {
    var parts = (location.pathname || "").split("/").filter(Boolean);
    if (parts.length < 2) return null;
    var dir = parts[parts.length - 2];
    var known = {
      coach: 1, agro_II_kyrs: 1, elect_II_kyrs: 1,
      mech_II_kyrs: 1, gas_II_kyrs: 1, tech_II_kyrs: 1
    };
    return known[dir] ? dir : null;
  }
  function shortTitle(item) {
    var t = (item && (item.title || item.url)) || "";
    t = t.replace(/\s*[—–-]\s*.*$/, "").trim();
    if (t.length > 48) t = t.slice(0, 46) + "…";
    return t || "Пара";
  }
  function mountLessonNav(items) {
    if (!items || !items.length || document.querySelector(".edlab-lesson-nav")) return;
    var here = location.pathname.replace(/\/+$/, "");
    var idx = -1;
    for (var i = 0; i < items.length; i++) {
      var u = (items[i].url || "").replace(/\/+$/, "");
      if (u === here || here.endsWith(u) || u.endsWith(here)) { idx = i; break; }
    }
    if (idx < 0) return;

    var prev = idx > 0 ? items[idx - 1] : null;
    var next = idx < items.length - 1 ? items[idx + 1] : null;
    var nav = document.createElement("nav");
    nav.className = "edlab-lesson-nav";
    nav.setAttribute("aria-label", "Навігація між парами");

    var prevHtml = prev
      ? '<a class="prev" href="' + escapeHtml(prev.url) + '">' +
          '<span class="lbl">← Попередня</span>' +
          '<span class="ttl">' + escapeHtml(shortTitle(prev)) + "</span></a>"
      : '<a class="prev" aria-disabled="true"><span class="lbl">← Попередня</span><span class="ttl">—</span></a>';

    var nextHtml = next
      ? '<a class="next" href="' + escapeHtml(next.url) + '">' +
          '<span class="lbl">Наступна →</span>' +
          '<span class="ttl">' + escapeHtml(shortTitle(next)) + "</span></a>"
      : '<a class="next" aria-disabled="true"><span class="lbl">Наступна →</span><span class="ttl">—</span></a>';

    nav.innerHTML = prevHtml + nextHtml;

    var attr = document.querySelector(".edlab-attribution");
    if (attr) document.body.insertBefore(nav, attr);
    else document.body.appendChild(nav);
  }
  function loadLessonNav() {
    var dir = sectionDirFromPath();
    if (!dir) return;
    fetch("/" + dir + "/manifest.json", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (Array.isArray(data)) mountLessonNav(data);
      })
      .catch(function () {});
  }

  // --- Chrome mount ------------------------------------------------------
  function mountChrome() {
    var script = currentScript();
    var mode = (script && script.getAttribute("data-chrome")) || "minimal";
    if (mode === "none") return;
    if (document.documentElement.classList.contains("embedded")) return;

    var hasHeader = document.querySelector(".site-header");
    var hasFooter = document.querySelector(".site-footer");

    if (mode === "full") {
      if (!hasHeader) document.body.insertBefore(buildHeader(), document.body.firstChild);
      if (!hasFooter) document.body.appendChild(buildFooter());
    } else {
      if (!document.querySelector(".edlab-attribution")) {
        document.body.appendChild(buildAttribution());
      }
      loadLessonNav();
    }
    applyTheme(getTheme());
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest(".theme-toggle");
    if (btn) { e.preventDefault(); toggleTheme(); }
  });

  // --- Toast -------------------------------------------------------------
  function toast(message) {
    var host = document.getElementById("edlab-toast");
    if (!host) {
      host = document.createElement("div");
      host.id = "edlab-toast";
      host.setAttribute("aria-live", "polite");
      host.setAttribute("aria-atomic", "true");
      document.body.appendChild(host);
    }
    var div = document.createElement("div");
    div.className = "toast-item";
    div.textContent = message;
    host.appendChild(div);
    requestAnimationFrame(function () { div.classList.add("show"); });
    setTimeout(function () {
      div.classList.remove("show");
      setTimeout(function () { div.remove(); }, 220);
    }, 1800);
  }

  // --- Clipboard ---------------------------------------------------------
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        document.execCommand("copy");
        ta.remove();
        resolve();
      } catch (e) { reject(e); }
    });
  }

  // --- Друк через прихований iframe --------------------------------------
  function safePrintHtml(html) {
    var frame = document.getElementById("edlab-print-frame");
    if (!frame) {
      frame = document.createElement("iframe");
      frame.id = "edlab-print-frame";
      frame.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0;border:0";
      document.body.appendChild(frame);
    }
    var doc = frame.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    var run = function () {
      try { frame.contentWindow.focus(); frame.contentWindow.print(); }
      finally { setTimeout(function () { frame.remove(); }, 800); }
    };
    if ("requestAnimationFrame" in frame.contentWindow) {
      frame.contentWindow.requestAnimationFrame(function () {
        frame.contentWindow.requestAnimationFrame(run);
      });
    } else { setTimeout(run, 150); }
  }

  function printTicket(selectorOrEl) {
    var el = typeof selectorOrEl === "string"
      ? document.querySelector(selectorOrEl) : selectorOrEl;
    if (!el) { toast("Немає елемента з чеком"); return; }
    var css =
      "@page{size:58mm auto;margin:0}" +
      "*{-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
      "html,body{margin:0;padding:0;background:#fff;color:#000}" +
      '.ticket{width:58mm;margin:0;padding:6mm 4mm;background:#fff;color:#000;' +
      'font-family:"Courier New",ui-monospace,monospace;font-weight:700;border:0;box-shadow:none;border-radius:0}' +
      ".ticket h4{margin:0 0 6px;font-size:13px;text-align:center;font-weight:700}" +
      ".ticket p{margin:2px 0;font-size:12px;font-weight:700}" +
      ".line{border-top:1px dashed #111;margin:6px 0}small{font-size:10px;font-weight:700}";
    safePrintHtml(
      '<!doctype html><html><head><meta charset="utf-8"><title>Чек 58 мм</title>' +
      "<style>" + css + "</style></head><body>" + el.outerHTML + "</body></html>"
    );
  }

  function toCSV(rows) {
    return rows.map(function (r) {
      return r.map(function (c) {
        var s = String(c == null ? "" : c);
        return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(",");
    }).join("\n");
  }
  function download(filename, text, type) {
    var blob = new Blob([text], { type: type || "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }
  function fmtDate(d) { return new Date(d || Date.now()).toISOString().slice(0, 10); }

  window.EDLab = {
    config: CONFIG,
    inIframe: inIframe,
    toast: toast,
    copy: copyText,
    printTicket: printTicket,
    safePrintHtml: safePrintHtml,
    toCSV: toCSV,
    download: download,
    fmtDate: fmtDate,
    getTheme: getTheme,
    setTheme: setTheme,
    toggleTheme: toggleTheme,
    buildHeader: buildHeader,
    buildFooter: buildFooter
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountChrome);
  } else {
    mountChrome();
  }
})();
