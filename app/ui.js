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
    if (b) { b.textContent = t === "dark" ? "☀️" : "🌙"; b.title = t === "dark" ? "Heller Modus" : "Dunkler Modus"; }
    for (const f of listeners) f();
  }

  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch {}
    apply(saved || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
    const b = document.getElementById("btnTheme");
    if (b) b.onclick = () => apply(theme() === "dark" ? "light" : "dark");
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

  /* ============================== Tour ============================== */
  let tour = null;       // {key, steps, i}
  let tourEls = null;    // {card, hl}

  function initTour(key, steps) {
    tour = { key, steps, i: 0 };
    const b = document.getElementById("btnTour");
    if (b) { b.onclick = () => startTour(); b.title = "Tour starten"; }
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

  function next() { if (tour.i < tour.steps.length - 1) { tour.i++; render(); } else endTour(); }
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
    const st = tour.steps[tour.i];
    document.querySelectorAll(".tour-hl").forEach(el => el.classList.remove("tour-hl"));

    let el = st.el ? document.querySelector(st.el) : null;
    if (el) {
      const det = el.closest("details");
      if (det) det.open = true;
      // zugeklappte Eltern-Sektionen öffnen, dann hervorheben
      el.classList.add("tour-hl");
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    const last = tour.i === tour.steps.length - 1;
    tourEls.card.innerHTML = `
      <div class="tour-step">Schritt ${tour.i + 1} von ${tour.steps.length}</div>
      <h3>${st.title}</h3>
      <p>${st.text}</p>
      <div class="tour-btns">
        <button class="tour-skip">Tour beenden</button>
        <span style="flex:1"></span>
        <button class="tour-prev" ${tour.i === 0 ? "disabled" : ""}>← Zurück</button>
        <button class="tour-next">${last ? "✓ Fertig" : "Weiter →"}</button>
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

  return { initTheme, onThemeChange, palette, theme, initTour, startTour };
})();
