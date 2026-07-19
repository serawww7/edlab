/* ==========================================================================
   EDLab core — єдиний рантайм: Header, Footer, embedded-режим, утиліти.
   Підключення:
     <link rel="stylesheet" href="/assets/edlab-core.css">
     <script src="/assets/edlab-core.js" data-chrome="full|minimal|none" defer></script>
   data-chrome:
     full    — повний site Header + Footer (оболонкові сторінки).
     minimal — лише рядок атрибуції «© EDLab» (сторінки-заняття). За замовч.
     none    — нічого не рендерити (лише утиліти/embedded).
   ========================================================================== */
(function () {
  "use strict";

  var YEAR = new Date().getFullYear();

  // Єдине джерело істини для навігації та контактів.
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
        '<nav class="site-header__nav">' + nav + "</nav>" +
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

  // Мінімальна атрибуція для сторінок-занять.
  function buildAttribution() {
    var el = document.createElement("div");
    el.className = "edlab-attribution";
    el.innerHTML = "© " + YEAR + ' Сергій Поліщук · <a href="https://edlab.pp.ua">EDLab</a>';
    return el;
  }

  // --- Chrome mount ------------------------------------------------------
  function mountChrome() {
    var script = currentScript();
    var mode = (script && script.getAttribute("data-chrome")) || "minimal";
    if (mode === "none") return;
    if (document.documentElement.classList.contains("embedded")) return;

    // Не дублюємо, якщо на сторінці вже є розмітка (перехідний період).
    var hasHeader = document.querySelector(".site-header");
    var hasFooter = document.querySelector(".site-footer");

    if (mode === "full") {
      if (!hasHeader) document.body.insertBefore(buildHeader(), document.body.firstChild);
      if (!hasFooter) document.body.appendChild(buildFooter());
    } else { // minimal
      if (!document.querySelector(".edlab-attribution")) {
        document.body.appendChild(buildAttribution());
      }
    }
  }

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

  // --- Clipboard (сучасний API + fallback) -------------------------------
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

  // --- Друк через прихований iframe (єдиний механізм) --------------------
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

  // --- CSV / дата --------------------------------------------------------
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

  // --- Public API --------------------------------------------------------
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
    buildHeader: buildHeader,
    buildFooter: buildFooter
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountChrome);
  } else {
    mountChrome();
  }
})();
