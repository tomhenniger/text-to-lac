// Gemeinsame UI-Helfer: Dark Mode + Onboarding-Tour
// Verwendung:  UI.initTheme();  UI.onThemeChange(draw);  UI.initTour("key", STEPS);
"use strict";
window.UI = (function () {
  /* ============================== Theme ============================== */
  const THEME_KEY = "ui_theme";
  const listeners = [];

  function theme() { return document.documentElement.dataset.theme || "light"; }

  function apply(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem(THEME_KEY, t); } catch {}
    const b = document.getElementById("btnTheme");
    if (b) { b.innerHTML = icon(t === "dark" ? "sun" : "moon", 15); b.title = t === "dark" ? "Heller Modus" : "Dunkler Modus"; }
    for (const f of listeners) f();
  }

  /* ============================== Icons ============================== */
  const ICONS = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/>',
    text: '<path d="M4 7V4h16v3"/><path d="M12 4v16"/><path d="M9 20h6"/>',
    pen: '<path d="M17 3l4 4L8.5 19.5 3 21l1.5-5.5L17 3z"/><path d="M14.5 5.5l4 4"/>',
    pencil: '<path d="M16.5 3.5l4 4L7 21H3v-4L16.5 3.5z"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15.5 16 10.5 5 19.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.1 1-1.1 1.8"/><path d="M12 16.8h.01"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01"/>',
    trash: '<path d="M4 7h16"/><path d="M9.5 7V4.5h5V7"/><path d="M6.5 7l1 13h9l1-13"/><path d="M10 11v5M14 11v5"/>',
    eraser: '<path d="M16.5 3.5 21 8l-9.5 9.5H6.5L3 14.5z"/><path d="M10.5 7 17 13.5"/><path d="M6 21h15"/>',
    camera: '<path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13.3" r="3.2"/>',
    file: '<path d="M6.5 3H14l4.5 4.5V21h-12z"/><path d="M14 3v4.5h4.5"/>',
    undo: '<path d="M8 13 3 8l5-5"/><path d="M3 8h11a6 6 0 0 1 0 12h-4"/>',
  };

  function icon(name, size = 15) {
    return `<svg class="icn" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
           `stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ` +
           `style="vertical-align:-${Math.round(size * 0.16)}px">${ICONS[name] || ""}</svg>`;
  }

  function initIcons(root) {
    (root || document).querySelectorAll("[data-icon]").forEach(el => {
      el.innerHTML = icon(el.dataset.icon, +el.dataset.iconSize || 15);
    });
  }

  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch {}
    apply(saved || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
    const b = document.getElementById("btnTheme");
    if (b) b.onclick = () => apply(theme() === "dark" ? "light" : "dark");
    initIcons();
  }

  function onThemeChange(f) { listeners.push(f); }

  // Farbpalette für die Canvas-Vorschauen
  function palette() {
    return theme() === "dark"
      ? { mat: "#17231b", matBorder: "#2e5c40", grid: "rgba(90,200,130,0.10)",
          ink: "#e3e9f2", frame: "rgba(255,255,255,0.22)", marker: "#34d27b" }
      : { mat: "#e8f4ec", matBorder: "#9fc8ab", grid: "rgba(0,140,60,0.10)",
          ink: "#16243d", frame: "rgba(0,0,0,0.15)", marker: "#00ae42" };
  }

  /* ============================== Sprache ============================== */
  const LANG_KEY = "ui_lang";
  const langListeners = [];
  let dict = {};                      // Deutsch -> Englisch (Text-Knoten)
  const origText = new WeakMap();     // Knoten -> deutscher Originaltext (Weak: tote Knoten werden freigegeben)

  function lang() {
    try { const l = localStorage.getItem(LANG_KEY); if (l) return l; } catch {}
    return (navigator.language || "de").toLowerCase().startsWith("de") ? "de" : "en";
  }

  // t("deutsch", "english") für dynamisch erzeugte Strings
  function t(de, en) { return lang() === "en" ? en : de; }

  function setLang(l) {
    try { localStorage.setItem(LANG_KEY, l); } catch {}
    applyLang();
    for (const f of langListeners) f();
  }

  function onLangChange(f) { langListeners.push(f); }

  function initLang(map) {
    dict = map || {};
    const b = document.getElementById("btnLang");
    if (b) b.onclick = () => setLang(lang() === "de" ? "en" : "de");
    applyLang();
  }

  // Schlüssel-Normalisierung: typografische Anführungszeichen + Mehrfach-Leerraum
  function normKey(s) { return s.replace(/[„“”]/g, '"').replace(/\s+/g, " ").trim(); }

  function applyLang() {
    const en = lang() === "en";
    const b = document.getElementById("btnLang");
    if (b) { b.textContent = en ? "DE" : "EN"; b.title = en ? "Auf Deutsch umschalten" : "Switch to English"; }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const pe = n.parentElement;
      if (!pe || pe.closest("script, style, textarea")) continue;
      if (!origText.has(n)) {
        const k = normKey(n.nodeValue);
        if (k && dict[k] !== undefined) origText.set(n, n.nodeValue);
      }
      if (origText.has(n)) {
        const orig = origText.get(n);
        n.nodeValue = en ? orig.replace(orig.trim(), dict[normKey(orig)]) : orig;
      }
    }
  }

  /* ============================== Tour ============================== */
  let tour = null;       // {key, steps: Array|Function, i}
  let tourEls = null;    // {card, hl}

  function tourSteps() {
    return typeof tour.steps === "function" ? tour.steps() : tour.steps;
  }

  function initTour(key, steps) {
    tour = { key, steps, i: 0 };
    const b = document.getElementById("btnTour");
    if (b) { b.onclick = () => startTour(); b.title = t("Tour neu starten", "Restart tour"); }
    let seen = null;
    try { seen = localStorage.getItem("tour_" + key); } catch {}
    if (!seen) setTimeout(startTour, 400);
  }

  function startTour() {
    if (!tour) return;
    tour.i = 0;
    buildUi();
    render();
  }

  function endTour() {
    try { localStorage.setItem("tour_" + tour.key, "1"); } catch {}
    cleanup();
  }

  function cleanup() {
    if (tourEls) { tourEls.card.remove(); }
    document.querySelectorAll(".tour-hl").forEach(el => el.classList.remove("tour-hl"));
    tourEls = null;
    document.removeEventListener("keydown", onKey);
  }

  function onKey(e) {
    if (e.key === "Escape") endTour();
    else if (e.key === "ArrowRight" || e.key === "Enter") next();
    else if (e.key === "ArrowLeft") prev();
  }

  function next() { if (tour.i < tourSteps().length - 1) { tour.i++; render(); } else endTour(); }
  function prev() { if (tour.i > 0) { tour.i--; render(); } }

  function buildUi() {
    cleanup();
    injectCss();
    const card = document.createElement("div");
    card.className = "tour-card";
    document.body.appendChild(card);
    tourEls = { card };
    document.addEventListener("keydown", onKey);
  }

  function render() {
    const steps = tourSteps();
    const st = steps[tour.i];
    document.querySelectorAll(".tour-hl").forEach(el => el.classList.remove("tour-hl"));

    let el = st.el ? document.querySelector(st.el) : null;
    if (el) {
      const det = el.closest("details");
      if (det) det.open = true;
      // zugeklappte Eltern-Sektionen öffnen, dann hervorheben
      el.classList.add("tour-hl");
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    const last = tour.i === steps.length - 1;
    tourEls.card.innerHTML = `
      <div class="tour-step">${t("Schritt", "Step")} ${tour.i + 1} ${t("von", "of")} ${steps.length}</div>
      <h3>${st.title}</h3>
      <p>${st.text}</p>
      <div class="tour-btns">
        <button class="tour-skip">${t("Tour beenden", "End tour")}</button>
        <span style="flex:1"></span>
        <button class="tour-prev" ${tour.i === 0 ? "disabled" : ""}>${t("← Zurück", "← Back")}</button>
        <button class="tour-next">${last ? t("✓ Fertig", "✓ Done") : t("Weiter →", "Next →")}</button>
      </div>`;
    tourEls.card.querySelector(".tour-next").onclick = next;
    tourEls.card.querySelector(".tour-prev").onclick = prev;
    tourEls.card.querySelector(".tour-skip").onclick = endTour;

    // Karte positionieren: rechts neben dem Element, sonst zentriert
    const card = tourEls.card;
    requestAnimationFrame(() => {
      const cw = card.offsetWidth, chh = card.offsetHeight;
      const vw = innerWidth, vh = innerHeight;
      let x, y;
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > vw * 0.55) { x = (vw - cw) / 2; y = Math.min(vh - chh - 16, r.top + 40); }
        else if (r.right + cw + 24 < vw) { x = r.right + 16; y = r.top; }
        else if (r.left - cw - 24 > 0) { x = r.left - cw - 16; y = r.top; }
        else { x = (vw - cw) / 2; y = r.bottom + 12; }
        y = Math.max(12, Math.min(vh - chh - 12, y));
      } else { x = (vw - cw) / 2; y = (vh - chh) / 2; }
      card.style.left = x + "px";
      card.style.top = y + "px";
    });
  }

  let cssDone = false;
  function injectCss() {
    if (cssDone) return;
    cssDone = true;
    const s = document.createElement("style");
    s.textContent = `
      .tour-hl { position: relative; z-index: 1001;
                 box-shadow: 0 0 0 3px var(--accent), 0 0 0 9999px rgba(0,0,0,0.45) !important;
                 border-radius: 8px; }
      .tour-card { position: fixed; z-index: 1002; width: 320px; max-width: calc(100vw - 24px);
                   background: var(--panel); color: var(--text); border: 1px solid var(--border);
                   border-radius: 12px; padding: 16px 16px 12px; box-shadow: 0 12px 40px rgba(0,0,0,0.35);
                   font-size: 13px; transition: left .2s, top .2s; }
      .tour-card h3 { margin: 4px 0 8px; font-size: 15px; }
      .tour-card p { margin: 0 0 14px; line-height: 1.55; color: var(--text); }
      .tour-card p b { color: var(--accent); }
      .tour-step { font-size: 11px; color: var(--muted); }
      .tour-btns { display: flex; gap: 8px; align-items: center; }
      .tour-btns button { padding: 6px 12px; font-size: 12.5px; border: 1px solid var(--border);
                          border-radius: 6px; background: var(--panel); color: var(--text); cursor: pointer; }
      .tour-btns .tour-next { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
      .tour-btns .tour-skip { border: none; background: none; color: var(--muted); padding-left: 0; }
      .tour-btns button:disabled { opacity: 0.4; cursor: default; }
      .topbtns { float: right; display: flex; gap: 6px; }
      .topbtns button { padding: 4px 8px; font-size: 14px; line-height: 1; border: 1px solid var(--border);
                        border-radius: 6px; background: var(--panel); cursor: pointer; }
    `;
    document.head.appendChild(s);
  }

  return { initTheme, onThemeChange, palette, theme, initTour, startTour,
           initLang, onLangChange, lang, t, icon, initIcons };
})();
