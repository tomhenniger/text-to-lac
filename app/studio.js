// Layer Studio — Shell-Verkabelung: Zustand, Canvas-Rendering, Ebenen-Panel,
// kontextuelle Eigenschaften, Export, Statusleiste, Tour, I18N, URL-Parameter.
// Ebenentyp-Logik liegt in text-layer.js / image-layer.js (später); dieses Modul
// dirigiert nur und hält keine typ-spezifischen Algorithmen.
"use strict";
(function () {

/* ============================== Registrierung ============================== */
window.LayerTypes.text = window.TextLayer.type;
if (window.ImageLayer) window.LayerTypes.image = window.ImageLayer.type;

/* ============================== Zustand ============================== */
const S = {
  layers: [],
  sel: null,
  nextId: 1,
  view: { scale: 3, ox: 40, oy: 40 },
  customFonts: {},        // per TTF geladene Fonts (projektweit, Asset)
  quality: 3,             // Kurvenauflösung 1..5 (Stage 4)
};

const $ = id => document.getElementById(id);
const cv = $("cv"), ctx = cv.getContext("2d");

// Kurvenauflösungs-Parameter (Stage 4 füllt LacExport.quality; hier Fallback)
function Q() {
  return (window.LacExport && window.LacExport.quality)
    ? window.LacExport.quality(S.quality)
    : { maxSeg: 0.9, ttfSeg: 12 };
}

window.TextLayer.setCustomFonts(() => S.customFonts);
window.Layers.init(S, Q);

/* ============================== Fonts (UI) ============================== */
function allFonts() { return window.TextLayer.allFonts(); }

function fillFontSelect(keep) {
  const sel = $("inpFont"), prev = keep ? sel.value : "EMSReadability";
  sel.innerHTML = "";
  for (const [id, f] of Object.entries(allFonts())) {
    const o = document.createElement("option");
    o.value = id;
    o.textContent = (UI.lang() === "en" && f.name_en) ? f.name_en : f.name;
    sel.appendChild(o);
  }
  sel.value = allFonts()[prev] ? prev : Object.keys(allFonts())[0];
}

// Handschrift/ASCII-Fonts haben sich geändert (Stage 3): Caches invalidieren.
function onFontsChanged() {
  fillFontSelect(true);
  if (Layers.active() && Layers.active().type === "image") fillAsciiFonts();
  Layers.invalidate("fonts");
  relayout();
}
window.addEventListener("storage", e => { if (e.key === "hw_fonts") onFontsChanged(); });

/* ====================== Eigenschaften <-> Layer ====================== */
// Text-Ebene: Layer-Felder in die (gemeinsamen) Eingabefelder schreiben …
function textToDOM(l) {
  $("inpText").value = l.text;
  fillFontSelect(false);
  if (allFonts()[l.fontId]) $("inpFont").value = l.fontId; else l.fontId = $("inpFont").value;
  $("inpSize").value = l.sizeMM;
  $("inpLineH").value = l.lineH;
  $("inpTrack").value = l.track;
  $("inpWordSp").value = l.wordSp;
  $("inpAlign").value = l.align;
  $("inpVarOn").checked = l.varn.on;
  $("inpVRot").value = l.varn.rot;
  $("inpVSize").value = l.varn.size;
  $("inpVBase").value = l.varn.base;
  $("inpVSpace").value = l.varn.space;
  $("inpVSlant").value = l.varn.slant;
  $("inpVWob").value = l.varn.wob;
  refreshSliderLabels();
  $("stLen").textContent = l.text.length + UI.t(" Zeichen", " characters");
}
// … und wieder zurücklesen.
function textFromDOM(l) {
  l.text = $("inpText").value;
  l.fontId = $("inpFont").value;
  l.sizeMM = +$("inpSize").value;
  l.lineH = +$("inpLineH").value;
  l.track = +$("inpTrack").value;
  l.wordSp = +$("inpWordSp").value;
  l.align = $("inpAlign").value;
  l.varn.on = $("inpVarOn").checked;
  l.varn.rot = +$("inpVRot").value;
  l.varn.size = +$("inpVSize").value;
  l.varn.base = +$("inpVBase").value;
  l.varn.space = +$("inpVSpace").value;
  l.varn.slant = +$("inpVSlant").value;
  l.varn.wob = +$("inpVWob").value;
}

// Bild-Ebene: Layer-Felder in die Eingabefelder schreiben …
function imageToDOM(l) {
  $("inpBright").value = l.bright;
  $("inpContrast").value = l.contrast;
  $("inpInvert").checked = l.invert;
  $("inpImgW").value = l.widthMM;
  $("inpStyle").value = l.style;
  const h = l.opts.hatch, s = l.opts.squiggle, a = l.opts.ascii, c = l.opts.contour;
  $("inpHSpace").value = h.space; $("inpHAngle").value = h.angle; $("inpHLevels").value = h.levels;
  $("inpSSpace").value = s.space; $("inpSAmp").value = s.amp; $("inpSFreq").value = s.freq; $("inpWhiteSkip").checked = s.whiteSkip;
  fillAsciiFonts();
  if (a.fontId && window.TextLayer.allFonts()[a.fontId]) $("inpAsciiFont").value = a.fontId;
  else l.opts.ascii.fontId = $("inpAsciiFont").value;
  $("inpACell").value = a.cell; $("inpARamp").value = a.ramp;
  $("inpCThresh").value = c.thresh; $("inpCRes").value = c.res; $("inpCHatch").checked = c.hatch;
  refreshImgSliderLabels();
  showStyleOpts();
  updateDropHint(l);
}
// … und wieder zurücklesen.
function imageFromDOM(l) {
  l.bright = +$("inpBright").value;
  l.contrast = +$("inpContrast").value;
  l.invert = $("inpInvert").checked;
  l.widthMM = +$("inpImgW").value;
  l.style = $("inpStyle").value;
  l.opts.hatch = { space: +$("inpHSpace").value, angle: +$("inpHAngle").value, levels: +$("inpHLevels").value };
  l.opts.squiggle = { space: +$("inpSSpace").value, amp: +$("inpSAmp").value, freq: +$("inpSFreq").value, whiteSkip: $("inpWhiteSkip").checked };
  l.opts.ascii = { fontId: $("inpAsciiFont").value, cell: +$("inpACell").value, ramp: $("inpARamp").value };
  l.opts.contour = { thresh: +$("inpCThresh").value, res: +$("inpCRes").value, hatch: $("inpCHatch").checked };
  window.ImageLayer.clampPos(l, +$("inpMatW").value, +$("inpMatH").value);
}

function updateDropHint(l) {
  const dh = $("dropHint");
  if (l.src) {
    dh.classList.add("has");
    dh.innerHTML = `✓ ${l.src.fileName}<br>${l.src.w0}×${l.src.h0}px — ${UI.t("anderes Bild: klicken", "click for another image")}`;
    $("rowImgRemove").style.display = "flex";
  } else {
    dh.classList.remove("has");
    dh.innerHTML = UI.t("Bild hierher ziehen oder klicken<br>(JPG, PNG, …)", "Drop an image here or click<br>(JPG, PNG, …)");
    $("rowImgRemove").style.display = "none";
  }
}

function showStyleOpts() {
  const style = $("inpStyle").value;
  document.querySelectorAll(".styleopts").forEach(el =>
    el.classList.toggle("active", el.dataset.style.split(" ").includes(style)));
}

function fillAsciiFonts() {
  const sel = $("inpAsciiFont"), prev = sel.value;
  const fonts = window.TextLayer.allFonts();
  sel.innerHTML = "";
  for (const [id, f] of Object.entries(fonts)) {
    const o = document.createElement("option");
    o.value = id;
    o.textContent = (UI.lang() === "en" && f.name_en) ? f.name_en : f.name;
    sel.appendChild(o);
  }
  const hw = Object.keys(window.TextLayer.hwFonts());
  sel.value = fonts[prev] ? prev : (hw[0] || "EMSReadability");
}

// Eigenschaften-Panel an die aktive Ebene anpassen (Sichtbarkeit + Werte).
function syncPropsToDOM() {
  const l = Layers.active();
  const isText = l && l.type === "text";
  const isImage = l && l.type === "image";
  $("propsText").hidden = !isText;
  $("propsImage").hidden = !isImage;
  if (isText) textToDOM(l);
  else if (isImage) imageToDOM(l);
}
// Eingabe-Änderung → in aktive Ebene übernehmen, Cache invalidieren, neu zeichnen.
function syncDOMToProps() {
  const l = Layers.active();
  if (!l) return;
  if (l.type === "text") textFromDOM(l);
  else if (l.type === "image") imageFromDOM(l);
  Layers.invalidate(l.id);
  relayout();
}
// Bild-Eigenschaften ändern sich oft per Slider-Drag → Neuberechnung entprellen.
let imgTimer = null;
function syncImageDebounced() {
  const l = Layers.active();
  if (!l || l.type !== "image") return;
  imageFromDOM(l);
  clearTimeout(imgTimer);
  imgTimer = setTimeout(() => { Layers.invalidate(l.id); relayout(); }, 120);
}

/* ============================== Ebenen-Panel ============================== */
function renderPanel() {
  const list = $("layerList");
  list.innerHTML = "";
  // Anzeige: oberste Ebene (letztes Array-Element) zuoberst
  for (let i = S.layers.length - 1; i >= 0; i--) {
    const l = S.layers[i];
    const row = document.createElement("div");
    row.className = "layer-row" + (l.id === S.sel ? " sel" : "") + (l.visible ? "" : " hidden");
    row.dataset.id = l.id;
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-pressed", l.id === S.sel ? "true" : "false");
    row.setAttribute("aria-label", l.name);
    row.onkeydown = ev => {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); selectLayer(l.id); }
    };

    const eye = document.createElement("button");
    eye.className = "iconbtn";
    eye.innerHTML = UI.icon(l.visible ? "eye" : "eyeOff", 15);
    eye.title = l.visible ? UI.t("Ausblenden", "Hide") : UI.t("Einblenden", "Show");
    eye.onclick = ev => { ev.stopPropagation(); l.visible = !l.visible; renderPanel(); relayout(); };

    const icn = document.createElement("span");
    icn.className = "licn";
    icn.innerHTML = UI.icon(LayerTypes[l.type].icon, 15);

    const name = document.createElement("span");
    name.className = "lname";
    name.textContent = l.name;
    name.title = UI.t("Doppelklick zum Umbenennen", "Double-click to rename");
    name.ondblclick = ev => { ev.stopPropagation(); startRename(row, l, name); };

    const up = document.createElement("button");
    up.className = "iconbtn"; up.innerHTML = UI.icon("chevron-up", 15);
    up.title = UI.t("Nach oben", "Move up"); up.disabled = i === S.layers.length - 1;
    up.onclick = ev => { ev.stopPropagation(); if (Layers.move(l.id, +1)) { renderPanel(); relayout(); } };

    const down = document.createElement("button");
    down.className = "iconbtn"; down.innerHTML = UI.icon("chevron-down", 15);
    down.title = UI.t("Nach unten", "Move down"); down.disabled = i === 0;
    down.onclick = ev => { ev.stopPropagation(); if (Layers.move(l.id, -1)) { renderPanel(); relayout(); } };

    row.append(eye, icn, name, up, down);
    row.onclick = () => selectLayer(l.id);
    list.appendChild(row);
  }
  updateLayerActions();
}

function startRename(row, l, nameEl) {
  const inp = document.createElement("input");
  inp.className = "rename"; inp.value = l.name;
  nameEl.replaceWith(inp);
  inp.focus(); inp.select();
  const done = commit => {
    if (commit) { const v = inp.value.trim(); if (v) l.name = v; }
    renderPanel();
  };
  inp.onblur = () => done(true);
  inp.onkeydown = e => {
    if (e.key === "Enter") { e.preventDefault(); inp.blur(); }
    else if (e.key === "Escape") { e.preventDefault(); inp.onblur = null; done(false); }
    e.stopPropagation();
  };
  inp.onclick = e => e.stopPropagation();
}

function updateLayerActions() {
  const l = Layers.active();
  const lockBtn = $("btnLockLayer");
  lockBtn.innerHTML = UI.icon(l && l.locked ? "lock" : "unlock", 15);
  lockBtn.classList.toggle("on", !!(l && l.locked));
  lockBtn.title = l && l.locked ? UI.t("Entsperren", "Unlock") : UI.t("Sperren", "Lock");
  $("btnDelLayer").disabled = S.layers.length <= 1;
}

function selectLayer(id) {
  Layers.select(id);
  syncPropsToDOM();
  renderPanel();
  draw();
  updateStatus();
}

/* ============================== Vorschau ============================== */
function resize() {
  const r = cv.parentElement.getBoundingClientRect();
  cv.width = r.width * devicePixelRatio; cv.height = r.height * devicePixelRatio;
  draw();
}
window.addEventListener("resize", resize);

function relayout() { draw(); updateStatus(); }

function mm2px(x, y) { return [(x * S.view.scale + S.view.ox) * devicePixelRatio, (y * S.view.scale + S.view.oy) * devicePixelRatio]; }
function px2mm(x, y) { return [(x - S.view.ox) / S.view.scale, (y - S.view.oy) / S.view.scale]; }

function draw() {
  const W = +$("inpMatW").value, H = +$("inpMatH").value;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.save();
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.translate(S.view.ox, S.view.oy);
  ctx.scale(S.view.scale, S.view.scale);

  const P = UI.palette();
  // Matte
  ctx.fillStyle = P.mat;
  ctx.strokeStyle = P.matBorder; ctx.lineWidth = 0.4;
  ctx.beginPath(); ctx.roundRect(0, 0, W, H, 3); ctx.fill(); ctx.stroke();
  // Raster 10mm
  ctx.strokeStyle = P.grid; ctx.lineWidth = 0.15;
  ctx.beginPath();
  for (let x = 10; x < W; x += 10) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 10; y < H; y += 10) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();

  // Ebenen (Array-Reihenfolge = Z-Order, unterste zuerst)
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = +$("inpPenW").value;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const l of S.layers) {
    if (!l.visible) continue;
    ctx.beginPath();
    for (const st of Layers.strokesOf(l)) {
      if (st.length < 1) continue;
      ctx.moveTo(st[0][0], st[0][1]);
      for (let i = 1; i < st.length; i++) ctx.lineTo(st[i][0], st[i][1]);
    }
    ctx.stroke();
  }

  // Overlay der aktiven Ebene
  const act = Layers.active();
  if (act && act.visible) {
    // gezogener Buchstabe: Markierungsrahmen
    if (act.type === "text" && drag && drag.mode === "char" && drag.layer === act) {
      const lo = Layers.layoutOf(act);
      const g = lo.glyphs.find(g => g.line + ":" + g.col === drag.key);
      if (g) {
        const [minx, miny, maxx, maxy] = window.TextLayer.glyphBBox(g);
        ctx.strokeStyle = P.marker; ctx.lineWidth = 0.3;
        ctx.setLineDash([1.2, 1]);
        ctx.strokeRect(minx - 1, miny - 1, maxx - minx + 2, maxy - miny + 2);
        ctx.setLineDash([]);
      }
    }
    // Auswahl-Markierung um die aktive Ebene (nur bei >1 Ebene oder aktiver Bild-Ebene,
    // die sonst keine sichtbare Auswahl-Affordanz hätte)
    if (S.layers.length > 1 || act.type === "image") {
      const bb = Layers.bboxOf(act);
      if (bb) {
        ctx.strokeStyle = P.marker; ctx.lineWidth = 0.3;
        ctx.setLineDash([1.5, 1.2]);
        ctx.strokeRect(bb[0] - 1.5, bb[1] - 1.5, bb[2] - bb[0] + 3, bb[3] - bb[1] + 3);
        ctx.setLineDash([]);
      }
    }
  }
  ctx.restore();
}

function updateStatus() {
  let glyphCount = 0, segs = 0, textLayers = 0;
  const missing = new Set();
  for (const l of S.layers) {
    if (!l.visible) continue;
    const c = Layers.cacheOf(l);
    for (const st of Layers.strokesOf(l)) segs += st.length;
    if (l.type === "text" && c.layout) {
      glyphCount += c.layout.glyphs.length;
      textLayers++;
      for (const m of c.layout.missing) missing.add(m);
    }
  }
  const nLay = S.layers.filter(l => l.visible).length;
  $("stInfo").textContent = `${nLay} ${UI.t(nLay === 1 ? "Ebene" : "Ebenen", nLay === 1 ? "layer" : "layers")}`
    + ` · ${glyphCount} ${UI.t("Buchstaben", "letters")} · ${segs.toLocaleString(UI.lang())} ${UI.t("Punkte", "points")}`;
  const act = Layers.active();
  $("stSeed").textContent = (act && act.type === "text") ? `Seed ${act.seed}` : "";
  if (act && act.type === "image" && act.src && act.visible) {
    const c = Layers.cacheOf(act);
    $("stCalc").textContent = c.calcErr ? (UI.t("Fehler: ", "Error: ") + c.calcErr)
      : (UI.t("berechnet in ", "computed in ") + (c.calcMs || 0) + " ms");
  } else $("stCalc").textContent = "";
  const w = $("warnBox");
  if (missing.size) {
    w.style.display = "block";
    w.textContent = UI.t("Nicht in der Schrift enthalten (werden übersprungen): ", "Not in this font (will be skipped): ") + [...missing].join(" ");
  } else w.style.display = "none";
}

/* ============================== Interaktion ============================== */
let drag = null;

cv.addEventListener("mousedown", e => {
  const [mx, my] = px2mm(e.offsetX, e.offsetY);
  const act = Layers.active();
  let handled = false;

  if (act && act.visible && !act.locked && act.type === "text") {
    const lo = Layers.layoutOf(act);
    const g = (!e.shiftKey && !e.altKey) ? window.TextLayer.hitChar(lo, mx, my) : null;
    if (g) {
      const key = g.line + ":" + g.col;
      drag = { mode: "char", layer: act, key, sx: mx, sy: my, glyph: g, total: 0,
               off0: act.charOff[key] ? { ...act.charOff[key] } : null };
      handled = true;
    } else {
      const li = window.TextLayer.hitLine(lo, mx, my);
      if (li >= 0) { drag = { mode: e.shiftKey ? "all" : "line", layer: act, li, sx: mx, sy: my }; handled = true; }
    }
  } else if (act && act.visible && !act.locked && act.type === "image") {
    const bb = Layers.bboxOf(act);
    if (bb && mx >= bb[0] - 2 && mx <= bb[2] + 2 && my >= bb[1] - 2 && my <= bb[3] + 2) {
      drag = { mode: "all", layer: act, sx: mx, sy: my }; handled = true;
    }
  }

  // Andere Ebene unter dem Cursor auswählen und als Ganzes ziehen (topmost first)
  if (!handled) {
    for (let i = S.layers.length - 1; i >= 0; i--) {
      const l = S.layers[i];
      if (l === act || !l.visible || l.locked) continue;
      const bb = Layers.bboxOf(l);
      if (bb && mx >= bb[0] - 1 && mx <= bb[2] + 1 && my >= bb[1] - 1 && my <= bb[3] + 1) {
        selectLayer(l.id);
        drag = { mode: "all", layer: l, sx: mx, sy: my };
        handled = true; break;
      }
    }
  }
  // Aktive Ebene als Ganzes ziehen (Shift), auch wenn nicht auf Glyphe getroffen
  if (!handled && act && act.visible && !act.locked && e.shiftKey) {
    drag = { mode: "all", layer: act, sx: mx, sy: my }; handled = true;
  }

  if (!handled) drag = { mode: "pan", sx: e.offsetX, sy: e.offsetY, ox: S.view.ox, oy: S.view.oy };
  cv.style.cursor = drag.mode === "pan" ? "grabbing" : "move";
});

cv.addEventListener("mousemove", e => {       // Hover-Cursor (ohne Drag)
  if (drag) return;
  const [mx, my] = px2mm(e.offsetX, e.offsetY);
  const act = Layers.active();
  let over = false;
  if (act && act.visible && !act.locked && act.type === "text") {
    const lo = Layers.layoutOf(act);
    over = !!window.TextLayer.hitChar(lo, mx, my) || window.TextLayer.hitLine(lo, mx, my) >= 0;
  }
  if (!over) {
    for (let i = S.layers.length - 1; i >= 0; i--) {
      const l = S.layers[i];
      if (!l.visible || l.locked) continue;
      const bb = Layers.bboxOf(l);
      if (bb && mx >= bb[0] - 1 && mx <= bb[2] + 1 && my >= bb[1] - 1 && my <= bb[3] + 1) { over = true; break; }
    }
  }
  cv.style.cursor = over ? "move" : "grab";
});

window.addEventListener("mousemove", e => {
  if (!drag) return;
  if (drag.mode === "pan") {
    const r = cv.getBoundingClientRect();
    S.view.ox = drag.ox + (e.clientX - r.left - drag.sx);
    S.view.oy = drag.oy + (e.clientY - r.top - drag.sy);
    draw();
    return;
  }
  const r = cv.getBoundingClientRect();
  const [mx, my] = px2mm(e.clientX - r.left, e.clientY - r.top);
  const dx = mx - drag.sx, dy = my - drag.sy;
  drag.sx = mx; drag.sy = my;
  const l = drag.layer;
  if (drag.mode === "all") {
    l.x += dx; l.y += dy;
    if (l.type === "image") window.ImageLayer.clampPos(l, +$("inpMatW").value, +$("inpMatH").value);
  }
  else if (drag.mode === "char") {
    let o = l.charOff[drag.key];
    if (!o || o.ch !== drag.glyph.char) o = l.charOff[drag.key] = { dx: 0, dy: 0, ch: drag.glyph.char };
    o.dx += dx; o.dy += dy;
    drag.total += Math.hypot(dx, dy);
  } else { // line
    if (!l.lineOff[drag.li]) l.lineOff[drag.li] = { dx: 0, dy: 0 };
    l.lineOff[drag.li].dx += dx; l.lineOff[drag.li].dy += dy;
  }
  Layers.invalidate(l.id);
  relayout();
});

window.addEventListener("mouseup", () => {
  if (drag && drag.mode === "char" && drag.total < 0.5) {
    // Klick statt Ziehen: Mini-Verschiebung zurücknehmen, Variante weiterblättern
    const l = drag.layer;
    if (drag.off0) l.charOff[drag.key] = drag.off0; else delete l.charOff[drag.key];
    cycleVariant(drag);
  }
  drag = null; cv.style.cursor = "grab"; draw();
});

function cycleVariant(d) {
  const l = d.layer;
  const font = window.TextLayer.fontById(l.fontId);
  const n = window.TextLayer.variantCount(font, d.glyph.char);
  if (n < 2) { flashVar(UI.t(`„${d.glyph.char}“ hat nur eine Variante`, `"${d.glyph.char}" has only one variant`)); Layers.invalidate(l.id); relayout(); return; }
  const [li, ci] = d.key.split(":").map(Number);
  const prev = l.charVar[d.key];
  const cur = (prev && prev.ch === d.glyph.char) ? prev.v
            : Math.min(n - 1, Math.floor(window.TextLayer.glyphRng(l.seed, li, ci)() * n));
  l.charVar[d.key] = { v: (cur + 1) % n, ch: d.glyph.char };
  flashVar(`„${d.glyph.char}“ → ${UI.t("Variante", "variant")} ${l.charVar[d.key].v + 1}/${n}`);
  Layers.invalidate(l.id);
  relayout();
}

let flashTimer = null;
function flashVar(msg) {
  $("stVar").textContent = msg;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { $("stVar").textContent = ""; }, 2500);
}

cv.addEventListener("wheel", e => {
  e.preventDefault();
  const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  const ns = Math.min(40, Math.max(0.4, S.view.scale * f));
  S.view.ox = e.offsetX - (e.offsetX - S.view.ox) * ns / S.view.scale;
  S.view.oy = e.offsetY - (e.offsetY - S.view.oy) * ns / S.view.scale;
  S.view.scale = ns;
  draw();
}, { passive: false });

function fitView() {
  const W = +$("inpMatW").value, H = +$("inpMatH").value;
  const r = cv.getBoundingClientRect();
  const sc = Math.min(r.width / (W + 30), r.height / (H + 30));
  S.view.scale = sc;
  S.view.ox = (r.width - W * sc) / 2; S.view.oy = (r.height - H * sc) / 2;
  draw();
}

/* ============================== TTF-Import ============================== */
$("btnTtf").onclick = () => {
  if (!window.opentype) loadOpentype(() => $("fileTtf").click());
  else $("fileTtf").click();
};
function loadOpentype(cb) {
  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/dist/opentype.min.js";
  s.onload = cb;
  s.onerror = () => alert(UI.t("opentype.js konnte nicht geladen werden (Internet nötig für TTF-Import).",
                               "opentype.js could not be loaded (internet needed for TTF import)."));
  document.head.appendChild(s);
}
$("fileTtf").onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  const buf = await file.arrayBuffer();
  let f;
  try { f = opentype.parse(buf); }
  catch (err) { alert(UI.t("Schrift konnte nicht gelesen werden: ", "Font could not be read: ") + err.message); return; }
  const fontObj = window.TextLayer.parseTtf(f, file.name, buf, Q());
  const id = "ttf_" + file.name.replace(/\W/g, "_");
  S.customFonts[id] = fontObj;
  const l = Layers.active();
  if (l && l.type === "text") { l.fontId = id; Layers.invalidate("fonts"); }
  fillFontSelect(false);
  $("inpFont").value = id;
  syncDOMToProps();
};

// Bei geänderter Kurvenauflösung: alle per TTF importierten Fonts aus ihrem
// gepufferten ArrayBuffer mit der neuen Bezier-Auflösung (Q.ttfSeg) neu flatten.
// TTF-Glyphen werden beim Import geflattet und gecacht — nachträgliches Resampling
// kann Treue nur wegnehmen, nie hinzufügen; darum an der Quelle neu erzeugen.
function reflattenTtf() {
  if (!window.opentype) return;                 // ohne opentype nichts zu tun
  for (const [id, f] of Object.entries(S.customFonts)) {
    if (!f || !f._buf) continue;
    try {
      const parsed = opentype.parse(f._buf);
      S.customFonts[id] = window.TextLayer.parseTtf(parsed, f.name.replace(/^✎︎ /, ""), f._buf, Q());
    } catch (err) { console.error("TTF-Reflatten fehlgeschlagen", err); }
  }
}

/* ============================== Export ============================== */
const fmtN = window.LacExport.fmtN;

function makeThumbnail() {
  return new Promise(res => {
    const W = +$("inpMatW").value, H = +$("inpMatH").value;
    const c = document.createElement("canvas");
    const sc = 512 / Math.max(W, H);
    c.width = Math.round(W * sc); c.height = Math.round(H * sc);
    const g = c.getContext("2d");
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, c.width, c.height);
    g.scale(sc, sc);
    g.strokeStyle = "#16243d"; g.lineWidth = Math.max(0.4, +$("inpPenW").value);
    g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath();
    for (const l of S.layers) {
      if (!l.visible) continue;
      for (const st of Layers.strokesOf(l)) {
        if (st.length < 1) continue;
        g.moveTo(st[0][0], st[0][1]);
        for (let i = 1; i < st.length; i++) g.lineTo(st[i][0], st[i][1]);
      }
    }
    g.stroke();
    c.toBlob(b => b.arrayBuffer().then(buf => res(new Uint8Array(buf))), "image/png");
  });
}

$("btnExport").onclick = async () => {
  const groups = Layers.buildGroups($("inpGroup").value, UI.t);
  // makeLac filtert leere Gruppen; wenn danach nichts übrig bleibt (z. B. nur
  // Leerzeichen oder ein leeres Bild), sauberer Hinweis statt geworfenem Fehler.
  const hasPaths = groups.some(g => g.strokes.some(st => st.length >= 2));
  if (!hasPaths) { alert(UI.t("Nichts zum Exportieren.", "Nothing to export.")); return; }
  const thumb = await makeThumbnail();
  let bytes;
  try {
    bytes = window.LacExport.makeLac(groups, {
      matW: +$("inpMatW").value, matH: +$("inpMatH").value,
      processType: $("inpProcess").value, flipY: $("inpFlipY").checked,
      thumbnail: thumb,
    });
  } catch (e) {
    alert(UI.t("Nichts zum Exportieren.", "Nothing to export.")); return;
  }
  window.LacExport.download(bytes, ($("inpFname").value || "text") + ".lac");
};

$("btnSvg").onclick = () => {
  const W = +$("inpMatW").value, H = +$("inpMatH").value;
  let paths = "";
  for (const l of S.layers) {
    if (!l.visible) continue;
    for (const st of Layers.strokesOf(l)) {
      if (st.length < 2) continue;
      paths += `<path d="M ${st.map(p => fmtN(p[0]) + "," + fmtN(p[1])).join(" L ")}"/>\n`;
    }
  }
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">
<g fill="none" stroke="#000" stroke-width="${$("inpPenW").value}" stroke-linecap="round" stroke-linejoin="round">
${paths}</g>
</svg>`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  a.download = ($("inpFname").value || "text") + ".svg";
  a.click();
  URL.revokeObjectURL(a.href);
};

/* ============================== Verkabelung ============================== */
const SLIDERS = [["inpSize", "valSize", " mm"], ["inpLineH", "valLineH", "×"], ["inpTrack", "valTrack", " mm"],
  ["inpWordSp", "valWordSp", "×"],
  ["inpVRot", "valVRot", "°"], ["inpVSize", "valVSize", " %"], ["inpVBase", "valVBase", " mm"],
  ["inpVSpace", "valVSpace", " mm"], ["inpVSlant", "valVSlant", "°"], ["inpVWob", "valVWob", " mm"],
  ["inpPenW", "valPenW", " mm"]];
function refreshSliderLabels() {
  for (const [id, vid, unit] of SLIDERS) { const el = $(vid); if (el) el.textContent = $(id).value + unit; }
}
for (const [id, vid, unit] of SLIDERS) {
  $(id).addEventListener("input", () => { $(vid).textContent = $(id).value + unit; });
}
// Bild-Slider (Label-Einheiten wie in der früheren bild.html)
const IMG_SLIDERS = [["inpBright", "valBright", ""], ["inpContrast", "valContrast", "×"],
  ["inpImgW", "valImgW", " mm"], ["inpHSpace", "valHSpace", " mm"], ["inpHAngle", "valHAngle", "°"],
  ["inpHLevels", "valHLevels", ""], ["inpSSpace", "valSSpace", " mm"], ["inpSAmp", "valSAmp", "×"],
  ["inpSFreq", "valSFreq", "×"], ["inpACell", "valACell", " mm"], ["inpCThresh", "valCThresh", ""],
  ["inpCRes", "valCRes", " px/mm"]];
function refreshImgSliderLabels() {
  for (const [id, vid, unit] of IMG_SLIDERS) { const el = $(vid); if (el) el.textContent = $(id).value + unit; }
}
for (const [id, vid, unit] of IMG_SLIDERS) {
  $(id).addEventListener("input", () => { $(vid).textContent = $(id).value + unit; syncImageDebounced(); });
}
for (const id of ["inpInvert", "inpWhiteSkip", "inpCHatch", "inpARamp"])
  $(id).addEventListener("input", syncImageDebounced);
for (const id of ["inpStyle", "inpAsciiFont"])
  $(id).addEventListener("input", () => { showStyleOpts(); syncImageDebounced(); });
// Stiftbreite ist projektweit → nur neu zeichnen (kein Layer-Cache betroffen)
$("inpPenW").addEventListener("input", draw);
// Text-Eigenschaften → aktive Ebene aktualisieren
for (const id of ["inpText", "inpFont", "inpAlign", "inpVarOn", "inpSize", "inpLineH",
                  "inpTrack", "inpWordSp", "inpVRot", "inpVSize", "inpVBase", "inpVSpace", "inpVSlant", "inpVWob"])
  $(id).addEventListener("input", syncDOMToProps);
// Matte ist projektweit (Bild-Ebenen ggf. neu klemmen)
for (const id of ["inpMatW", "inpMatH"]) $(id).addEventListener("input", () => {
  const W = +$("inpMatW").value, H = +$("inpMatH").value;
  for (const l of S.layers) if (l.type === "image" && l.src) { window.ImageLayer.clampPos(l, W, H); Layers.invalidate(l.id); }
  relayout();
});

/* ============================== Kurvenauflösung (Stage 4) ============================== */
// Ein projektweiter Regler steuert die Punktdichte aller Ebenentypen.
const RES_WORDS = {
  de: ["Grob", "Reduziert", "Standard", "Fein", "Sehr fein"],
  en: ["Coarse", "Reduced", "Standard", "Fine", "Very fine"],
};
function refreshResLabel() {
  const words = UI.lang() === "en" ? RES_WORDS.en : RES_WORDS.de;
  $("valRes").textContent = words[Math.min(4, Math.max(0, S.quality - 1))];
}
$("inpRes").value = S.quality;
$("inpRes").addEventListener("input", () => {
  S.quality = +$("inpRes").value;
  refreshResLabel();
  reflattenTtf();          // TTF-Fonts an der Quelle neu flatten (Q.ttfSeg)
  Layers.invalidate();     // alle Ebenen-Caches (Text: maxSeg; Bild: step; + Funnel-RDP)
  relayout();              // Vorschau + Statuszeilen-Punktzahl aktualisieren sofort
});

/* ============================== Bild laden ============================== */
$("dropHint").onclick = () => $("fileImg").click();
$("fileImg").onchange = e => { if (e.target.files[0]) loadImageInto(Layers.active(), e.target.files[0]); };
document.addEventListener("dragover", e => e.preventDefault());
document.addEventListener("drop", e => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (!file || !/^image\//.test(file.type)) return;
  let l = Layers.active();
  if (!l || l.type !== "image") { l = Layers.add("image"); }
  selectLayer(l.id);
  loadImageInto(l, file);
});

function loadImageInto(layer, file) {
  if (!layer || layer.type !== "image") return;
  window.ImageLayer.loadImageFile(file, src => {
    layer.src = src;
    layer._raw = null;
    window.ImageLayer.clampPos(layer, +$("inpMatW").value, +$("inpMatH").value);
    if ($("inpFname").value.trim() === "" || isDefaultFname())
      $("inpFname").value = file.name.replace(/\.[^.]+$/, "");
    Layers.invalidate(layer.id);
    if (Layers.active() === layer) updateDropHint(layer);
    relayout();
    fitView();
  });
}
function isDefaultFname() {
  return $("inpFname").value === DEFAULT_FNAME.de || $("inpFname").value === DEFAULT_FNAME.en;
}

$("btnImgRemove").onclick = () => {
  const l = Layers.active();
  if (!l || l.type !== "image") return;
  l.src = null; l._raw = null;
  Layers.invalidate(l.id);
  updateDropHint(l);
  relayout();
};
$("inpText").addEventListener("input", () => { $("stLen").textContent = $("inpText").value.length + UI.t(" Zeichen", " characters"); });

$("btnReroll").onclick = () => { const l = Layers.active(); if (l && l.type === "text") { l.seed = (Math.random() * 1e9) | 0; Layers.invalidate(l.id); relayout(); } };
$("btnVarReset").onclick = () => {
  const d = { inpVRot: 2.5, inpVSize: 4, inpVBase: 0.35, inpVSpace: 0.25, inpVSlant: 2, inpVWob: 0.12 };
  for (const [id, v] of Object.entries(d)) { $(id).value = v; $(id).dispatchEvent(new Event("input")); }
};
$("btnFit").onclick = fitView;
$("btnResetPos").onclick = () => {
  const l = Layers.active();
  if (l && l.type === "text") { l.lineOff = []; l.charOff = {}; l.charVar = {}; Layers.invalidate(l.id); relayout(); }
};
// Handschrift-Erfassung als In-Studio-Modal öffnen (Stage 3).
function openCapture(preFontId) {
  if (!window.Capture) return;
  const l = Layers.active();
  const forId = (l && l.type === "text") ? l.id : null;
  const pre = preFontId || (l && l.type === "text" ? l.fontId : null);
  window.Capture.open({
    fontId: (pre && String(pre).startsWith("hw_")) ? pre : null,
    onApply: (fid) => {
      const t = forId ? Layers.get(forId) : Layers.active();
      if (t && t.type === "text") t.fontId = fid;
      onFontsChanged();     // Font-Select neu füllen, Caches invalidieren, neu zeichnen
      syncPropsToDOM();     // fontId der aktiven Ebene in #inpFont spiegeln
      relayout();
    },
  });
}
$("btnHw").onclick = () => openCapture();

// Ebenen-Panel-Buttons
$("btnAddText").onclick = () => {
  const l = Layers.add("text", { text: DEFAULT_TXT[UI.lang()] });
  selectLayer(l.id); fitOrDraw();
};
$("btnAddImage").onclick = () => {
  const l = Layers.add("image");
  selectLayer(l.id); fitOrDraw();
};
$("btnDupLayer").onclick = () => { const l = Layers.active(); if (l) { const c = Layers.duplicate(l.id); if (c) selectLayer(c.id); } };
$("btnDelLayer").onclick = () => {
  if (S.layers.length <= 1) return;
  const l = Layers.active(); if (!l) return;
  Layers.remove(l.id); syncPropsToDOM(); renderPanel(); relayout();
};
$("btnLockLayer").onclick = () => { const l = Layers.active(); if (l) { l.locked = !l.locked; updateLayerActions(); } };

function fitOrDraw() { relayout(); }

/* ============================== Tour (8 Schritte, DE + EN) ============================== */
const TOUR = [
  { el: null, title: "Willkommen im Layer Studio!",
    text: "Baue deine Zeichnung aus <b>Ebenen</b> — mehrere Texte und Bilder auf einer Matte. Das Ergebnis exportierst du als .lac für die Bambu Suite (Pen Holder). Mit ← → blätterst du, Esc beendet." },
  { el: "#layersPanel", title: "1 · Ebenen",
    text: "Hier legst du Ebenen an, wählst, benennst und sortierst sie, blendest sie aus, sperrst oder duplizierst sie. Jede Ebene hat ihre <b>eigenen Eigenschaften</b> direkt darunter." },
  { el: "#inpText", title: "2 · Text eingeben",
    text: "Schreib hier deinen Text — mehrzeilig, mit Umlauten und ß. Alles Weitere passiert live in der Vorschau." },
  { el: "#inpFont", title: "3 · Schrift & eigene Handschrift",
    text: "Eingebaute <b>Ein-Linien-Schriften</b> — oder erfasse deine <b>eigene Handschrift</b> und schreibe damit. Der Stift zieht echte Linien statt Umrisse." },
  { el: "#inpVarOn", title: "4 · Handschrift-Variation",
    text: "Jeder Buchstabe bekommt eigene Zufallswerte — <b>kein Zeichen gleicht dem anderen</b>. „Neu würfeln“ erzeugt eine neue Variante." },
  { el: "#canvasWrap", title: "5 · Vorschau",
    text: "Ziehen = verschieben · <b>Klick auf Buchstabe</b> = nächste Variante · andere Ebene anklicken = auswählen · Mausrad = Zoom." },
  { el: "#btnAddImage", title: "6 · Bild-Ebenen",
    text: "Füge Bilder als eigene Ebenen hinzu — als <b>Schraffur, Wellenlinien, Spirale, Konturen</b> oder ASCII-Art. Text und Bild liegen gemeinsam auf einer Matte." },
  { el: "#inpRes", title: "7 · Export & Kurvenauflösung",
    text: "Die <b>Kurvenauflösung</b> steuert, wie fein Kurven aufgelöst werden — fein = weicher, aber größere Datei. Dann als <b>.lac exportieren</b> und in der Bambu Suite öffnen (oder als SVG)." },
];
const TOUR_EN = [
  { el: null, title: "Welcome to the Layer Studio!",
    text: "Build your drawing from <b>layers</b> — several texts and images on one mat. The result exports as a .lac file for Bambu Suite (pen holder). Browse with ← →, Esc closes." },
  { el: "#layersPanel", title: "1 · Layers",
    text: "Add, select, rename and reorder layers here, hide, lock or duplicate them. Each layer has its <b>own properties</b> right below." },
  { el: "#inpText", title: "2 · Enter text",
    text: "Type your text here — multi-line, umlauts and ß included. Everything updates live in the preview." },
  { el: "#inpFont", title: "3 · Font & your own handwriting",
    text: "Built-in <b>single-line fonts</b> — or capture your <b>own handwriting</b> and write with it. The pen draws real lines instead of outlines." },
  { el: "#inpVarOn", title: "4 · Handwriting variation",
    text: "Every letter gets its own random values — <b>no two characters look alike</b>. Hit „Reroll“ for a fresh look." },
  { el: "#canvasWrap", title: "5 · Preview",
    text: "Drag = move · <b>click a letter</b> = next variant · click another layer = select it · wheel = zoom." },
  { el: "#btnAddImage", title: "6 · Image layers",
    text: "Add images as their own layers — as <b>hatching, squiggle lines, spiral, contours</b> or ASCII art. Text and image live together on one mat." },
  { el: "#inpRes", title: "7 · Export & curve resolution",
    text: "<b>Curve resolution</b> controls how finely curves are resolved — fine = smoother but larger files. Then <b>export as .lac</b> and open it in Bambu Suite (or as SVG)." },
];

/* ============================== I18N ============================== */
const I18N_EN = {
  'Stift-Plotter für Bambu Lab (Pen Holder)': 'Pen plotter for Bambu Lab (pen holder)',
  'Ebenen': 'Layers',
  'Duplizieren': 'Duplicate',
  'Löschen': 'Delete',
  'Text': 'Text',
  'Schrift': 'Font',
  'Schriftart (Ein-Linien-Fonts, ideal für Stifte)': 'Typeface (single-line fonts, ideal for pens)',
  'Eigene Handschrift erfassen …': 'Capture your handwriting …',
  'Mit "Handschrift erfassen" zeichnest du jeden Buchstaben selbst — mit mehreren Varianten pro Buchstabe, aus denen beim Schreiben zufällig gewählt wird. TTF/OTF-Schriften sind dagegen Kontur-Schriften: Der Stift fährt nur den Umriss nach.':
    'With "Capture your handwriting" you draw every letter yourself — with multiple variants per character that are picked at random while writing. TTF/OTF fonts are outline fonts: the pen only traces the contour.',
  'Schriftgröße (Höhe Großbuchstaben)': 'Font size (capital height)',
  'Zeilenabstand': 'Line spacing',
  'Buchstabenabstand': 'Letter spacing',
  'Wortabstand': 'Word spacing',
  'Ausrichtung': 'Alignment',
  'Linksbündig': 'Left', 'Zentriert': 'Centered', 'Rechtsbündig': 'Right',
  'Handschrift-Variation': 'Handwriting variation',
  'Variation aktiv (kein Buchstabe gleicht dem anderen)': 'Variation on (no two letters look alike)',
  'Drehung pro Buchstabe (±°)': 'Rotation per letter (±°)',
  'Größenstreuung (±%)': 'Size scatter (±%)',
  'Grundlinien-Tanz (±mm)': 'Baseline dance (±mm)',
  'Abstands-Streuung (±mm)': 'Spacing scatter (±mm)',
  'Neigungs-Streuung (±°)': 'Slant scatter (±°)',
  'Linien-Zittern (mm)': 'Line jitter (mm)',
  'Neu würfeln': 'Reroll',
  'Zurücksetzen': 'Reset',
  'Jeder Buchstabe bekommt eigene Zufallswerte — derselbe Buchstabe sieht an jeder Stelle anders aus. "Neu würfeln" erzeugt eine neue Zufallsvariante.':
    'Every letter gets its own random values — the same letter looks different in every spot. "Reroll" creates a new random variation.',
  'Arbeitsbereich & Stift': 'Work area & pen',
  'Breite (mm)': 'Width (mm)', 'Höhe (mm)': 'Height (mm)',
  'Standard: 300 × 300 mm = Arbeitsbereich des A2L (nur als visuelle Hilfe).': 'Default: 300 × 300 mm = A2L work area (visual guide only).',
  'Stiftbreite Vorschau (mm)': 'Pen width preview (mm)',
  'Kurvenauflösung': 'Curve resolution',
  'Steuert, wie fein Kurven in Punkte aufgelöst werden — wirkt live auf Vorschau und Export. Fein = weichere Kurven, aber größere Datei und längerer Plot. Nicht zu verwechseln mit Linien-/Windungsabstand: Die Auflösung bestimmt die Punktdichte entlang jeder Linie.':
    'Controls how finely curves are resolved into points — updates preview and export live. Fine = smoother curves but larger files and longer plots. Not to be confused with line/turn spacing: resolution sets the point density along each line.',
  'Die Kurvenauflösung (Export-Bereich) bestimmt die Glättung neu gescannter Glyphen. Bereits gespeicherte Varianten bleiben unverändert.':
    'The curve resolution (export section) controls the smoothing of newly scanned glyphs. Already-saved variants stay unchanged.',
  'Dateiname': 'File name',
  'Objekt-Aufteilung in Bambu Suite': 'Object grouping in Bambu Suite',
  'Ein Objekt pro Ebene': 'One object per layer',
  'Alles als ein Objekt (Layout bleibt sicher erhalten)': 'Everything as one object (layout stays intact)',
  'Ein Objekt pro Zeile (nur Text-Ebenen)': 'One object per line (text layers only)',
  'Ein Objekt pro Buchstabe (nur Text-Ebenen)': 'One object per letter (text layers only)',
  'Prozess': 'Process',
  'Stift zeichnen (KCPenDraw)': 'Pen draw (KCPenDraw)',
  'Stift ausmalen (KCPenDrawFill)': 'Pen fill (KCPenDrawFill)',
  'Y-Achse spiegeln (falls der Text in der Suite kopfüber erscheint)': 'Flip Y axis (if text appears upside down in the Suite)',
  'Als .lac exportieren': 'Export as .lac',
  'Als SVG exportieren': 'Export as SVG',
  'Die .lac-Datei in der Bambu Suite öffnen, Material/Stift wählen und "Vorbereiten" — der Prozess "Stift zeichnen" ist bereits zugewiesen.':
    'Open the .lac file in Bambu Suite, choose material/pen and hit Prepare — the pen-draw process is already assigned.',
  'Maus: Buchstabe ziehen = verschieben ·': 'Mouse: drag a letter = move it ·',
  'Klick auf Buchstabe = nächste Variante': 'click a letter = next variant',
  '· Lücke/Rand ziehen (oder Alt) = Zeile · Shift+Ziehen = ganze Ebene · andere Ebene anklicken = auswählen · Mausrad = Zoom · Fläche ziehen = Ansicht':
    '· drag a gap/edge (or Alt) = line · Shift+drag = whole layer · click another layer = select · wheel = zoom · drag empty space = pan',
  'Ansicht einpassen': 'Fit view',
  'Anpassungen zurücksetzen': 'Reset adjustments',
  // ---- Bild-Ebene ----
  'Bild': 'Image',
  'Bild hierher ziehen oder klicken': 'Drop an image here or click',
  '(JPG, PNG, …)': '(JPG, PNG, …)',
  'Bild entfernen': 'Remove image',
  'Helligkeit': 'Brightness',
  'Kontrast': 'Contrast',
  'Invertieren (für dunkle Motive)': 'Invert (for dark subjects)',
  'Breite auf der Matte (mm)': 'Width on the mat (mm)',
  'Stil': 'Style',
  'Parallele Linien': 'Parallel lines',
  'Kreuzschraffur': 'Cross hatching',
  'Wellenlinien (Squiggle)': 'Squiggle lines',
  'Spirale': 'Spiral',
  'ASCII-Art (mit Schrift)': 'ASCII art (with a font)',
  'Konturen (Kanten)': 'Contours (edges)',
  'Linienabstand (mm)': 'Line spacing (mm)',
  'Winkel (°)': 'Angle (°)',
  'Helligkeits-Stufen': 'Brightness levels',
  'Zeilen-/Windungsabstand (mm)': 'Row/turn spacing (mm)',
  'Max. Amplitude (× Abstand/2)': 'Max amplitude (× spacing/2)',
  'Frequenz': 'Frequency',
  'Helle Flächen auslassen': 'Skip bright areas',
  'Zeichengröße (mm)': 'Character size (mm)',
  'Zeichen-Rampe (hell → dunkel)': 'Character ramp (bright → dark)',
  "Leerzeichen am Anfang = helle Stellen bleiben leer. Mit deiner Handschrift wird's ein handgeschriebenes Bild!":
    'A leading space keeps bright areas empty. Use your own handwriting for a hand-written picture!',
  'Kanten-Schwelle (niedrig = mehr Details)': 'Edge threshold (lower = more detail)',
  'Detailgrad (Auflösung)': 'Level of detail (resolution)',
  'Mit Schraffur kombinieren (dunkle Flächen füllen)': 'Combine with hatching (fill dark areas)',
  // ---- Handschrift-Erfassung (Modal) ----
  'Handschrift erfassen': 'Capture handwriting',
  'Eigene Ein-Linien-Schrift mit Buchstaben-Varianten': 'Your own single-line font with letter variants',
  'Name der Schrift': 'Font name',
  'Zeichensatz': 'Character set',
  'Blaue Zahl = Anzahl erfasster Varianten. Je mehr Varianten pro Buchstabe, desto lebendiger die Schrift — 2 bis 4 sind ideal.':
    'Blue number = captured variants. More variants per letter make the font livelier — 2 to 4 are ideal.',
  'Leerzeichen-Breite (Font-Einheiten, Großbuchstabe = 700)': 'Space width (font units, capital = 700)',
  'Striche glätten': 'Smooth strokes',
  'Stiftbreite Vorschau': 'Pen width preview',
  '✓ Variante speichern': '✓ Save variant',
  '✓ Speichern (⏎)': '✓ Save (⏎)',
  '✓ + nächstes Zeichen (⇧⏎)': '✓ + next character (⇧⏎)',
  '↩ Strich rückgängig': '↩ Undo stroke',
  'Leeren': 'Clear',
  'Lieber auf Papier schreiben?': 'Prefer writing on paper?',
  'Papier-Vorlage (PDF) öffnen': 'Open paper template (PDF)',
  'Ausgefüllte Scans einlesen …': 'Import filled-in scans …',
  'Vorlage drucken (100 %, tatsächliche Größe), mit dunklem Stift ausfüllen, abfotografieren oder scannen und die Bilder hier einlesen — die erkannten Buchstaben landen direkt in dieser Schrift.':
    'Print the template (100 %, actual size), fill it in with a dark pen, photograph or scan it and import the images here — recognized letters go straight into this font.',
  'Übernehmen & schließen': 'Apply & close',
  'Als Datei sichern (.json)': 'Save as file (.json)',
  'Laden …': 'Load …',
  'Schrift löschen': 'Delete font',
  'Alles wird automatisch im Browser gespeichert (localStorage). "Als Datei sichern" erstellt zusätzlich ein Backup zum Weitergeben.':
    'Everything is saved automatically in the browser (localStorage). "Save as file" additionally creates a backup you can share.',
  'Schreibe das Zeichen auf die Grundlinie. Grüne gestrichelte Linie = Vorlaufbreite (bestimmt den Abstand zum nächsten Buchstaben) — am Griff unten ziehen.':
    'Write the character on the baseline. Dashed green line = advance width (spacing to the next letter) — drag it at the handle below.',
  'Noch keine Varianten': 'No variants yet',
};

/* ============================== Init ============================== */
const DEFAULT_TXT = {
  de: "Hallo Welt!\nDies ist ein Test —\ngeschrieben mit dem Stift.",
  en: "Hello world!\nThis is a test —\nwritten with a pen.",
};
const DEFAULT_FNAME = { de: "Mein Text", en: "My text" };

function applyLangDefaults() {
  document.title = UI.t("Layer Studio — Handschrift", "Layer Studio — Handschrift");
  const other = UI.lang() === "en" ? "de" : "en";
  // Start-Textebene bei Sprachwechsel nur ersetzen, wenn noch Default-Text drin steht
  const l = Layers.active();
  if (l && l.type === "text" && l.text.trim() === DEFAULT_TXT[other].trim()) {
    l.text = DEFAULT_TXT[UI.lang()]; Layers.invalidate(l.id);
  }
  if ($("inpFname").value === DEFAULT_FNAME[other]) $("inpFname").value = DEFAULT_FNAME[UI.lang()];
}

UI.initTheme();
UI.onThemeChange(() => draw());

// Genau eine Default-Text-Ebene beim Start
Layers.add("text", { text: DEFAULT_TXT[UI.lang()] });

UI.initLang(I18N_EN);
applyLangDefaults();
UI.onLangChange(() => {
  applyLangDefaults();
  fillFontSelect(true);
  syncPropsToDOM();
  renderPanel();
  refreshResLabel();
  relayout();
  $("stLen").textContent = ($("inpText").value.length) + UI.t(" Zeichen", " characters");
});
function initStudioTour() { UI.initTour("studio", () => UI.lang() === "en" ? TOUR_EN : TOUR); }
initStudioTour();

fillFontSelect(false);

// URL-Parameter: ?font=… setzt Schrift der Start-Text-Ebene (Kompatibilität)
const params = new URLSearchParams(location.search);
const fontParam = params.get("font");
if (fontParam && allFonts()[fontParam]) {
  const l = Layers.active();
  if (l && l.type === "text") l.fontId = fontParam;
}
// ?layer=image → gleich eine Bild-Ebene anlegen und auswählen (bild.html-Stub)
if (params.get("layer") === "image" && window.LayerTypes.image) {
  const l = Layers.add("image");
  S.sel = l.id;
}

syncPropsToDOM();
renderPanel();
refreshResLabel();
resize();
relayout();
fitView();

// ?panel=capture → Handschrift-Erfassung öffnen (handschrift.html-Stub / interner Link)
if (params.get("panel") === "capture") {
  requestAnimationFrame(() => openCapture(fontParam));
}

/* ============================== Öffentliche Schnittstelle für Capture-Modal ============================== */
window.Studio = {
  onFontsChanged,          // ruft das Modal nach jedem persist()
  initTour: initStudioTour, // Capture-Modal stellt beim Schließen die Studio-Tour wieder her
  openCapture,
};

/* ============================== Debug-Handle für Tests ============================== */
window.__studio = {
  S, Layers,
  activeLayout: () => { const a = Layers.active(); return (a && a.type === "text") ? Layers.layoutOf(a) : null; },
  draw, relayout, fitView, selectLayer, openCapture,
};

})();
