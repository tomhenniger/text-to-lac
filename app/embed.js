// Embed-Modus für das Studio: nur aktiv mit ?embed (sonst No-Op).
// Bettet eine Tool-Seite chrome-los ein und streamt deren Striche (mm, content-lokal) ans Parent.
(function () {
  "use strict";
  const EMBED = /[?&#]embed\b/.test(location.search + location.hash);
  window.HS_EMBED = EMBED;
  if (!EMBED) return;                       // normaler Betrieb: 100% unverändert

  document.documentElement.classList.add("embed");
  const st = document.createElement("style");
  st.textContent =
    "html.embed .topnav,html.embed #main,html.embed #statusbar,html.embed .embed-hide{display:none!important}" +
    "html.embed #sidebar{width:100%!important;min-width:0!important;border-right:none!important}" +
    "html.embed body{height:auto!important;overflow:auto!important}";
  (document.head || document.documentElement).appendChild(st);

  let api = null, raf = 0;
  function snapshot() {
    const o = {};
    document.querySelectorAll("#sidebar input,#sidebar select,#sidebar textarea").forEach(el => {
      if (!el.id || el.type === "file") return;
      o[el.id] = el.type === "checkbox" ? el.checked : el.value;
    });
    return o;
  }
  function restore(p) {
    if (!p) return;
    for (const id in p) {
      const el = document.getElementById(id); if (!el) continue;
      if (el.type === "checkbox") el.checked = p[id]; else el.value = p[id];
    }
  }
  function post(m) { if (window.parent && window.parent !== window) window.parent.postMessage(Object.assign({ source: "ttl-tool" }, m), "*"); }
  function emit() {
    if (!api) return;
    let d; try { d = api.getStrokes(); } catch (e) { return; }
    if (!d) return;
    post({ type: "strokes", tool: api.tool, subtool: api.subtool ? api.subtool() : "", cw: d.cw, ch: d.ch, groups: d.groups, hasSource: !!d.hasSource, params: snapshot() });
  }
  function schedule() { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; emit(); }); }

  window.addEventListener("message", e => {
    const m = e.data; if (!m || m.source !== "ttl-studio") return;
    if (m.type === "restoreParams") { restore(m.params); if (api && api.recompute) api.recompute(); }
    else if (m.type === "selectTool" && api && api.selectTool) { api.selectTool(m.tool); }
    else if (m.type === "requestExport") { emit(); }
    else if (m.type === "setTheme") { const b = document.getElementById("btnTheme"); if (b && window.UI && UI.theme() !== m.theme) b.click(); }
    else if (m.type === "setLang") { const b = document.getElementById("btnLang"); if (b && window.UI && UI.lang() !== m.lang) b.click(); }
  });

  // Vom Seiten-Skript am Ende der Initialisierung aufgerufen.
  window.HSEmbed = {
    register(a) {
      api = a;
      if (typeof window.draw === "function") {          // universeller Funnel: nach jedem draw() Striche posten
        const _d = window.draw;
        window.draw = function () { const r = _d.apply(this, arguments); schedule(); return r; };
      }
      post({ type: "ready", tool: a.tool, tools: a.toolList ? a.toolList() : null });
      schedule();
    },
    emit
  };
})();
