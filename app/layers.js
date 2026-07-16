// Layer-Datenmodell + Registry + generische Ebenen-API für das Layer Studio.
// Jeder Ebenentyp registriert sich in window.LayerTypes und liefert über
// compute() fertige Strokes (Polylinien in mm, y-down, Ursprung Matte oben links).
// Das Studio rendert, hit-testet und exportiert alle Ebenen einheitlich.
"use strict";

// Registry: wird von text-layer.js / image-layer.js (später) befüllt.
window.LayerTypes = window.LayerTypes || {};

window.Layers = (function () {
  let S = null;                 // Studio-Zustand (per init gesetzt)
  let getQ = () => ({});        // Kurvenauflösungs-Parameter-Provider (Stage 4)

  function init(state, qProvider) {
    S = state;
    if (qProvider) getQ = qProvider;
    // Registry-Einträge in S.LayerTypes spiegeln (Bequemlichkeit)
  }

  function typeOf(layer) { return window.LayerTypes[layer.type]; }

  /* ---------- Cache (Strokes/Layout/BBox pro Ebene) ---------- */
  function cacheOf(layer) {
    if (!layer._cache) layer._cache = typeOf(layer).compute(layer, getQ());
    return layer._cache;
  }
  function strokesOf(layer) {
    // Funnel-Stelle für die Kurvenauflösung (Stage 4: resampleStrokes hier).
    const c = cacheOf(layer);
    if (!c._resampled && window.LacExport && window.LacExport.resampleStrokes && S && S.quality != null) {
      c.strokes = window.LacExport.resampleStrokes(c.strokes, S.quality);
      c._resampled = true;
    }
    return c.strokes;
  }
  function layoutOf(layer) { return cacheOf(layer).layout; }
  function bboxOf(layer) { return cacheOf(layer).bbox; }

  function invalidate(which) {
    if (!S) return;
    if (which === "fonts" || which == null) { for (const l of S.layers) l._cache = null; return; }
    const l = get(which);
    if (l) l._cache = null;
    else for (const x of S.layers) x._cache = null;   // Fallback: alles
  }

  /* ---------- CRUD / Reihenfolge ---------- */
  function get(id) { return S.layers.find(l => l.id === id) || null; }
  function active() { return get(S.sel); }
  function index(id) { return S.layers.findIndex(l => l.id === id); }

  function autoName(type) {
    const l = window.LayerTypes[type].label;
    const label = (window.UI && UI.lang() === "en") ? l[1] : l[0];
    let n = 1;
    const used = new Set(S.layers.map(l => l.name));
    while (used.has(label + " " + n)) n++;
    return label + " " + n;
  }

  function add(type, patch) {
    const base = window.LayerTypes[type].create();
    const layer = Object.assign(base, {
      id: "L" + (S.nextId++),
      name: autoName(type),
      visible: true, locked: false,
      _cache: null,
    }, patch || {});
    S.layers.push(layer);
    S.sel = layer.id;
    return layer;
  }

  function remove(id) {
    const i = index(id);
    if (i < 0) return;
    S.layers.splice(i, 1);
    if (S.sel === id) {
      const next = S.layers[Math.max(0, i - 1)] || S.layers[S.layers.length - 1] || null;
      S.sel = next ? next.id : null;
    }
  }

  function duplicate(id) {
    const src = get(id);
    if (!src) return null;
    // _cache/_raw/src beim Serialisieren auslassen (Puffer sind nicht JSON-fähig).
    const copy = JSON.parse(JSON.stringify(src, (k, v) =>
      (k === "_cache" || k === "_raw" || k === "src") ? undefined : v));
    copy.id = "L" + (S.nextId++);
    copy.name = src.name + " " + (window.UI ? window.UI.t("Kopie", "copy") : "Kopie");
    copy.x = (src.x || 0) + 5; copy.y = (src.y || 0) + 5;
    copy._cache = null; copy._raw = null;
    // Bild-Quelle ist nach dem Laden unveränderlich → per Referenz teilen.
    if (src.src) copy.src = src.src;
    const i = index(id);
    S.layers.splice(i + 1, 0, copy);
    S.sel = copy.id;
    return copy;
  }

  function move(id, dir) {           // dir: +1 = nach oben (später gezeichnet), -1 = nach unten
    const i = index(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= S.layers.length) return false;
    const [l] = S.layers.splice(i, 1);
    S.layers.splice(j, 0, l);
    return true;
  }

  function select(id) { if (get(id)) S.sel = id; }

  /* ---------- Export-Gruppierung (ebenenübergreifend) ---------- */
  // mode: "layer" (Default) | "all" | "line" | "char"
  // tt: Übersetzungsfunktion (UI.t)
  function buildGroups(mode, tt) {
    const vis = S.layers.filter(l => l.visible);
    if (!vis.length) return [];
    if (mode === "all")
      return [{ name: tt("Zeichnung", "Drawing"), strokes: vis.flatMap(l => strokesOf(l)) }];
    const groups = [];
    for (const l of vis) {
      const t = typeOf(l);
      if ((mode === "line" || mode === "char") && t.exportGroups) {
        const sub = t.exportGroups(l, mode, cacheOf(l), tt);
        // exportGroups liefert Roh-Strokes aus dem Layout-Cache → durch den
        // Kurvenauflösungs-Funnel schicken, damit line/char exakt wie die
        // Vorschau (strokesOf) und der .lac-Standardexport aussehen.
        const funnel = (window.LacExport && window.LacExport.resampleStrokes && S && S.quality != null)
          ? (st => window.LacExport.resampleStrokes(st, S.quality)) : (st => st);
        for (const grp of sub) groups.push({ name: grp.name, strokes: funnel(grp.strokes) });
      } else {
        groups.push({ name: l.name, strokes: strokesOf(l) });
      }
    }
    return groups;
  }

  return {
    init, get, active, index, add, remove, duplicate, move, select,
    strokesOf, layoutOf, bboxOf, cacheOf, invalidate, buildGroups,
  };
})();
