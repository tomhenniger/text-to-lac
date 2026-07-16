// Handschrift-Erfassung als In-Studio-Modal.
// Port des früheren app/handschrift.html-Inline-Skripts: Zeichen-Canvas mit
// Hilfslinien, mehrere Varianten pro Zeichen, Radiergummi, Scan-Import (scan.js),
// localStorage-Vertrag "hw_fonts" (unverändert), .handschrift.json Export/Import.
// Wird lazily beim ersten Öffnen verkabelt. window.Capture = { open, close }.
"use strict";
window.Capture = (function () {
  const $ = id => document.getElementById(id);
  let cv, ctx;

  /* ====== Font-Metriken (Einheiten wie bei den eingebauten Fonts) ====== */
  const UPEM = 1000, CAP = 700, XH = 480, ASC = 750, DESC = -250;
  const STORE_KEY = "hw_fonts";

  /* ====== Zustand ====== */
  let curChar = "a";
  let strokes = [];          // aktuelle Zeichnung, Font-Einheiten y-up
  let curStroke = null;
  let advance = null;        // null = automatisch
  let view = {};             // px-Mapping, in resize() berechnet
  let mode = null;           // "draw" | "adv" | "erase"
  let tool = "pen";          // "pen" | "eraser"
  let eraserPos = null;      // Cursor-Position in Font-Einheiten
  const ERASER_R = 32;

  let wired = false;
  let applyTarget = null;    // Callback (fontId) beim Übernehmen

  function notifyFonts() {
    if (window.Studio && window.Studio.onFontsChanged) window.Studio.onFontsChanged();
  }

  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "schrift"; }
  function fontId() { return "hw_" + slug($("inpName").value); }

  function loadStore() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; } }
  function saveStore(s) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); }
    catch (e) {
      alert(UI.t("Browser-Speicher voll — die Schrift konnte nicht gesichert werden. Alte Schriften löschen oder als Datei exportieren.",
                 "Browser storage full — the font could not be saved. Delete old fonts or export as a file."));
      throw e;
    }
  }

  function curFont() {
    const s = loadStore();
    if (!s[fontId()]) {
      s[fontId()] = { name: $("inpName").value, upem: UPEM, ascent: ASC, descent: DESC,
                      capheight: CAP, xheight: XH, glyphsVar: {} };
    }
    s[fontId()].name = $("inpName").value;
    return [s, s[fontId()]];
  }
  function variants(ch) {
    const [, f] = curFont();
    return f.glyphsVar[ch] || [];
  }

  /* ====== Koordinaten: Canvas-px <-> Font-Einheiten ====== */
  function resize() {
    if ($("captureModal").hidden) return;
    const r = cv.parentElement.getBoundingClientRect();
    if (!r.width || !r.height) return;
    cv.width = r.width * devicePixelRatio; cv.height = r.height * devicePixelRatio;
    // Skala: Ascent..Descent soll ~86% der Höhe füllen
    const unitsPerPx = (ASC - DESC) / (r.height * 0.86);
    view = { upp: unitsPerPx, baseY: r.height * 0.72, left: r.width * 0.18 };
    draw();
  }
  const px2u = (x, y) => [(x - view.left) * view.upp, (view.baseY - y) * view.upp];
  const u2px = (ux, uy) => [view.left + ux / view.upp, view.baseY - uy / view.upp];

  function autoAdv() {
    let mx = 0;
    for (const st of strokes) for (const [x] of st) mx = Math.max(mx, x);
    return Math.round(mx + 70);
  }
  function effAdv() { return advance !== null ? advance : (strokes.length ? autoAdv() : 350); }

  /* ====== Zeichnen ====== */
  function draw() {
    if (!view.upp) return;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    const w = cv.width / devicePixelRatio, h = cv.height / devicePixelRatio;
    ctx.clearRect(0, 0, w, h);

    // Hilfslinien
    const lines = [[CAP, UI.t("Großbuchstaben", "Capitals"), "#c4b5fd"],
                   [XH, UI.t("x-Höhe", "x-height"), "#bae6fd"],
                   [0, UI.t("Grundlinie", "Baseline"), "#9ca3af"],
                   [DESC, UI.t("Unterlänge", "Descender"), "#fecaca"]];
    ctx.font = "10px -apple-system"; ctx.textBaseline = "bottom";
    for (const [uy, name, col] of lines) {
      const [, y] = u2px(0, uy);
      ctx.strokeStyle = col; ctx.lineWidth = uy === 0 ? 1.6 : 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      ctx.fillStyle = col; ctx.fillText(name, 6, y - 2);
    }
    // Startlinie (x=0)
    ctx.strokeStyle = "#9ca3af"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(view.left, 0); ctx.lineTo(view.left, h); ctx.stroke();

    // Vorlauf-Linie
    const [ax] = u2px(effAdv(), 0);
    ctx.strokeStyle = "#00ae42"; ctx.setLineDash([6, 5]); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, h); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#00ae42";
    ctx.beginPath(); ctx.moveTo(ax - 8, h); ctx.lineTo(ax + 8, h); ctx.lineTo(ax, h - 12); ctx.closePath(); ctx.fill();
    ctx.fillText(advance === null ? UI.t("Vorlauf (auto)", "Advance (auto)") : UI.t("Vorlauf", "Advance"), ax + 5, h - 6);

    // Anleitung, solange noch nichts gezeichnet ist
    if (!strokes.length && !curStroke) {
      ctx.fillStyle = "#9ca3af";
      ctx.font = "14px -apple-system";
      ctx.textAlign = "center";
      ctx.fillText(UI.t(`„${curChar}“ mit der Maus auf die Grundlinie schreiben`,
                        `Write "${curChar}" on the baseline with your mouse`), w / 2, 30);
      ctx.fillText(UI.t("⏎ = speichern & weitere Variante schreiben · ⇧⏎ = speichern & nächstes Zeichen",
                        "⏎ = save & write another variant · ⇧⏎ = save & next character"), w / 2, 50);
      ctx.textAlign = "left";
    }
    // Striche
    ctx.strokeStyle = "#16243d"; ctx.lineWidth = +$("inpPen").value;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    for (const st of strokes.concat(curStroke ? [curStroke] : [])) {
      if (st.length < 1) continue;
      const [x0, y0] = u2px(st[0][0], st[0][1]);
      ctx.moveTo(x0, y0);
      for (let i = 1; i < st.length; i++) {
        const [x, y] = u2px(st[i][0], st[i][1]);
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Radiergummi-Cursor
    if (tool === "eraser" && eraserPos) {
      const [ex, ey] = u2px(eraserPos[0], eraserPos[1]);
      ctx.strokeStyle = "#dc2626"; ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(ex, ey, ERASER_R / view.upp, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function setTool(t) {
    if (mode === "draw") curStroke = null;   // laufenden Strich verwerfen
    mode = null;
    tool = t;
    $("btnPen").classList.toggle("toolactive", t === "pen");
    $("btnEraser").classList.toggle("toolactive", t === "eraser");
    $("btnPen").title = UI.t("Stift (E wechselt)", "Pen (E toggles)");
    $("btnEraser").title = UI.t("Radiergummi (E wechselt)", "Eraser (E toggles)");
    cv.style.cursor = t === "eraser" ? "none" : "crosshair";
    if (t !== "eraser") eraserPos = null;
    draw();
  }

  function eraseAt([ux, uy]) {
    const out = [];
    for (const st of strokes) {
      let cur = [];
      for (const p of st) {
        if (Math.hypot(p[0] - ux, p[1] - uy) <= ERASER_R) {
          if (cur.length > 1) out.push(cur);
          cur = [];
        } else cur.push(p);
      }
      if (cur.length > 1) out.push(cur);
    }
    strokes = out;
  }

  function smooth(pts) {
    if (pts.length < 5) return pts;
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++)
      out.push([(pts[i - 1][0] + 2 * pts[i][0] + pts[i + 1][0]) / 4,
                (pts[i - 1][1] + 2 * pts[i][1] + pts[i + 1][1]) / 4]);
    out.push(pts[pts.length - 1]);
    return out;
  }

  /* ====== Zeichensatz-Raster ====== */
  function buildGrid() {
    const grid = $("charGrid");
    grid.innerHTML = "";
    for (const ch of $("inpCharset").value) {
      const b = document.createElement("button");
      b.textContent = ch;
      if (ch === curChar) b.classList.add("sel");
      const n = variants(ch).length;
      if (n) b.innerHTML += `<span class="n">${n}</span>`;
      b.onclick = () => selectChar(ch);
      grid.appendChild(b);
    }
  }
  function selectChar(ch) {
    curChar = ch;
    $("curChar").textContent = ch;
    strokes = []; curStroke = null; advance = null;
    buildGrid(); buildVariantBar(); draw();
  }

  /* ====== Varianten ====== */
  function buildVariantBar() {
    const bar = $("variantBar");
    bar.innerHTML = "";
    const vars = variants(curChar);
    const lab = document.createElement("span");
    lab.id = "varLabel";
    lab.textContent = vars.length ? `„${curChar}“ — ${vars.length} ${UI.t(vars.length > 1 ? "Varianten" : "Variante", vars.length > 1 ? "variants" : "variant")}:` : UI.t(`„${curChar}“ — noch keine Varianten`, `"${curChar}" — no variants yet`);
    bar.appendChild(lab);
    vars.forEach((v, i) => {
      const d = document.createElement("div");
      d.className = "vth";
      d.title = UI.t("Ansehen/Bearbeiten — „Speichern“ legt danach eine neue Variante an",
                     "View/edit — hitting save afterwards adds a new variant");
      const c = document.createElement("canvas");
      c.width = 156; c.height = 156;
      const g = c.getContext("2d");
      g.strokeStyle = "#16243d"; g.lineWidth = 5; g.lineCap = "round"; g.lineJoin = "round";
      const sc = 110 / (ASC - DESC);
      g.beginPath();
      for (const st of v.strokes) {
        g.moveTo(23 + st[0][0] * sc, 120 - st[0][1] * sc);
        for (let k = 1; k < st.length; k++) g.lineTo(23 + st[k][0] * sc, 120 - st[k][1] * sc);
      }
      g.stroke();
      d.appendChild(c);
      const del = document.createElement("button");
      del.className = "del"; del.innerHTML = UI.icon("trash", 11);
      del.title = UI.t("Variante löschen", "Delete variant");
      del.onclick = ev => { ev.stopPropagation(); removeVariant(i); };
      d.onclick = () => viewVariant(i);
      d.appendChild(del);
      bar.appendChild(d);
    });
  }
  function persist(mutate) {
    const [s, f] = curFont();
    mutate(f);
    saveStore(s);
    buildGrid(); buildVariantBar();
    notifyFonts();
  }
  function removeVariant(i) {
    persist(f => { f.glyphsVar[curChar].splice(i, 1); if (!f.glyphsVar[curChar].length) delete f.glyphsVar[curChar]; });
  }
  function viewVariant(i) {
    const v = variants(curChar)[i];
    strokes = v.strokes.map(st => st.map(p => [...p]));
    advance = v.adv;
    draw();
  }
  function saveVariant(jump) {
    if (!strokes.length) { alert(UI.t("Erst etwas zeichnen :)", "Draw something first :)")); return; }
    const adv = effAdv();
    const data = { adv, strokes: strokes.map(st => st.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10])) };
    persist(f => {
      (f.glyphsVar[curChar] = f.glyphsVar[curChar] || []).push(data);
      f.glyphsVar[" "] = [{ adv: +$("inpSpaceAdv").value, strokes: [] }];
    });
    strokes = []; advance = null; draw();
    if (jump) {
      const cs = [...$("inpCharset").value];
      const next = cs.find(c => !variants(c).length);
      if (next) selectChar(next);
    }
  }
  function stepChar(d) {
    const cs = [...$("inpCharset").value];
    const i = cs.indexOf(curChar);
    selectChar(cs[(i + d + cs.length) % cs.length]);
  }

  /* ====== Sprach-Defaults (Schriftname) ====== */
  const DEFAULT_NAME = { de: "Meine Handschrift", en: "My Handwriting" };
  function applyLangDefaults() {
    // Standard-Schriftnamen nur tauschen, solange unter dem Namen nichts erfasst ist
    const other = UI.lang() === "en" ? "de" : "en";
    if ($("inpName").value === DEFAULT_NAME[other]) {
      const store = loadStore();
      const oldId = "hw_" + slug(DEFAULT_NAME[other]);
      const f = store[oldId];
      const leer = !f || !Object.keys(f.glyphsVar).some(c => c !== " ");
      if (leer) {
        if (f) { delete store[oldId]; saveStore(store); }
        $("inpName").value = DEFAULT_NAME[UI.lang()];
        buildGrid(); buildVariantBar();
      }
    }
  }

  /* ====== Tour ====== */
  const TOUR = [
    { el: null, title: "Willkommen bei der Handschrift-Erfassung!",
      text: "Hier baust du deine eigene Ein-Linien-Schrift — mit <b>mehreren Varianten pro Buchstabe</b>, aus denen das Studio später zufällig wählt. So sieht geplotteter Text aus wie echt geschrieben. (← → blättern, Esc beendet.)" },
    { el: "#inpName", title: "1 · Schrift benennen",
      text: "Gib deiner Schrift einen Namen. Unter diesem Namen taucht sie später im Schriften-Menü der Text-Ebene auf (mit ✎-Symbol)." },
    { el: "#charGrid", title: "2 · Zeichen wählen",
      text: "Klick ein Zeichen an, um es zu erfassen. Die <b>blaue Zahl</b> zeigt, wie viele Varianten du schon hast — 2 bis 4 pro Zeichen sind ideal für einen lebendigen Look." },
    { el: "#drawWrap", title: "3 · Schreiben",
      text: "Zeichne das Zeichen mit Maus/Trackpad auf die <b>Grundlinie</b> — kleine Buchstaben bis zur x-Höhe, große bis zur oberen Linie. Die grüne gestrichelte Linie ist der <b>Vorlauf</b> (Abstand zum nächsten Buchstaben), am Griff unten ziehbar. Verzeichnet? Mit dem <b>Radiergummi</b> oben links (Taste E) korrigierst du Stellen, ↩ nimmt den letzten Strich zurück." },
    { el: "#btnSaveVar2", title: "4 · Variante speichern",
      text: "<b>⏎ Enter</b> speichert die Variante und du bleibst beim Zeichen — gleich noch eine schreiben! <b>⇧ Shift+Enter</b> speichert und springt zum nächsten leeren Zeichen. In der Leiste unten siehst du alle Varianten: Klick zeigt eine groß im Editor (zum Ansehen oder Überarbeiten), der Papierkorb löscht sie." },
    { el: "#btnVorlage", title: "5 · Oder: auf Papier schreiben",
      text: "Bequemer mit echtem Stift: <b>Papier-Vorlage drucken</b> (öffnet in neuem Tab), ausfüllen, abfotografieren oder scannen und die Bilder direkt hier über <b>„Scans einlesen“</b> importieren — alles läuft im Browser. Danach kannst du jede Glyphe prüfen und nachbessern." },
    { el: "#btnHwUse", title: "6 · Übernehmen & schließen",
      text: "„Übernehmen & schließen“ setzt deine Schrift direkt in der aktiven Text-Ebene ein und schließt die Erfassung. Alles speichert sich automatisch im Browser; „Als Datei sichern“ erstellt ein Backup zum Weitergeben." },
  ];
  const TOUR_EN = [
    { el: null, title: "Welcome to handwriting capture!",
      text: "Here you build your own single-line font — with <b>multiple variants per letter</b> that the studio later picks at random. That is what makes plotted text look genuinely handwritten. (← → to browse, Esc closes.)" },
    { el: "#inpName", title: "1 · Name your font",
      text: "Give your font a name. It will show up in the text layer's font menu under this name (with a ✎ icon)." },
    { el: "#charGrid", title: "2 · Pick a character",
      text: "Click a character to capture it. The <b>blue number</b> shows how many variants you already have — 2 to 4 per character give the most lively look." },
    { el: "#drawWrap", title: "3 · Write",
      text: "Draw the character with mouse/trackpad onto the <b>baseline</b> — lowercase up to the x-height, capitals up to the top line. The dashed green line is the <b>advance width</b> (spacing to the next letter), draggable at its handle. Made a mistake? Use the <b>eraser</b> at the top left (key E), ↩ undoes the last stroke." },
    { el: "#btnSaveVar2", title: "4 · Save variant",
      text: "<b>⏎ Enter</b> saves the variant and keeps the character selected — write another one right away! <b>⇧ Shift+Enter</b> saves and jumps to the next empty character. The bar below shows all variants: click one to view or rework it in the editor, the trash button deletes it." },
    { el: "#btnVorlage", title: "5 · Or: write on paper",
      text: "More comfortable with a real pen: <b>print the paper template</b> (opens in a new tab), fill it in, photograph or scan it and import the images right here via <b>Import scans</b> — everything runs in your browser. Then review and touch up every glyph." },
    { el: "#btnHwUse", title: "6 · Apply & close",
      text: "Apply & close inserts your font straight into the active text layer and closes capture. Everything saves automatically in the browser; Save as file creates a backup you can share." },
  ];

  /* ====== Verkabelung (einmalig beim ersten Öffnen) ====== */
  function wire() {
    if (wired) return;
    wired = true;
    cv = $("draw"); ctx = cv.getContext("2d");

    window.addEventListener("resize", resize);

    cv.addEventListener("pointerdown", e => {
      cv.setPointerCapture(e.pointerId);
      if (tool === "eraser") {
        mode = "erase";
        eraserPos = px2u(e.offsetX, e.offsetY);
        eraseAt(eraserPos);
        draw();
        return;
      }
      const [ax] = u2px(effAdv(), 0);
      if (Math.abs(e.offsetX - ax) < 9) { mode = "adv"; return; }
      mode = "draw";
      curStroke = [px2u(e.offsetX, e.offsetY)];
    });
    cv.addEventListener("pointermove", e => {
      if (tool === "eraser") {
        eraserPos = px2u(e.offsetX, e.offsetY);
        if (mode === "erase") eraseAt(eraserPos);
        draw();
        return;
      }
      if (mode === "adv") {
        advance = Math.max(20, Math.round(px2u(e.offsetX, 0)[0]));
        draw(); return;
      }
      if (mode !== "draw" || !curStroke) return;
      const p = px2u(e.offsetX, e.offsetY);
      const last = curStroke[curStroke.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 4) { curStroke.push(p); draw(); }
    });
    cv.addEventListener("pointerleave", () => { if (tool === "eraser") { eraserPos = null; draw(); } });
    cv.addEventListener("pointerup", () => {
      if (mode === "draw" && curStroke && curStroke.length > 1) {
        strokes.push($("inpSmooth").checked ? smooth(curStroke) : curStroke);
      }
      curStroke = null; mode = null; draw();
    });

    $("btnPen").onclick = () => setTool("pen");
    $("btnEraser").onclick = () => setTool("eraser");
    $("btnSaveVar").onclick = () => saveVariant(false);
    $("btnSaveVar2").onclick = () => saveVariant(false);
    $("btnSaveNext").onclick = () => saveVariant(true);
    $("btnUndo").onclick = () => { strokes.pop(); draw(); };
    $("btnUndo2").onclick = () => { strokes.pop(); draw(); };
    $("btnClear").onclick = () => { strokes = []; advance = null; draw(); };
    $("btnPrev").onclick = () => stepChar(-1);
    $("btnNext").onclick = () => stepChar(1);

    $("inpPen").addEventListener("input", () => { $("valPen").textContent = $("inpPen").value; draw(); });
    $("inpCharset").addEventListener("input", buildGrid);
    $("inpName").addEventListener("change", () => { buildGrid(); buildVariantBar(); });
    $("inpSpaceAdv").addEventListener("change", () => persist(f => { f.glyphsVar[" "] = [{ adv: +$("inpSpaceAdv").value, strokes: [] }]; }));

    document.addEventListener("keydown", e => {
      if ($("captureModal").hidden) return;
      if (document.querySelector(".tour-card")) return;   // Tour nutzt die Tasten selbst
      if (e.target.matches("input, textarea, select")) {
        if (e.key === "Escape") { e.target.blur(); }
        return;
      }
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "Enter") { e.preventDefault(); saveVariant(e.shiftKey); }
      else if (e.key === "e" || e.key === "E") { setTool(tool === "pen" ? "eraser" : "pen"); }
      else if ((e.metaKey || e.ctrlKey) && e.key === "z") { e.preventDefault(); strokes.pop(); draw(); }
    });

    /* ====== Übernehmen / Export / Import / Löschen ====== */
    $("btnHwUse").onclick = () => {
      const [s] = curFont(); saveStore(s);
      const id = fontId();
      const store = loadStore();
      const n = store[id] ? Object.keys(store[id].glyphsVar).filter(c => c !== " ").length : 0;
      if (!n) { alert(UI.t("Noch keine Zeichen erfasst.", "No characters captured yet.")); return; }
      notifyFonts();
      if (applyTarget) applyTarget(id);
      close();
    };
    $("btnHwExport").onclick = () => {
      const [s] = curFont(); saveStore(s);
      const blob = new Blob([JSON.stringify(loadStore()[fontId()], null, 1)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = slug($("inpName").value) + ".handschrift.json";
      a.click(); URL.revokeObjectURL(a.href);
    };
    $("btnHwImport").onclick = () => $("fileHwImport").click();
    $("fileHwImport").onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const f = JSON.parse(await file.text());
        if (!f.glyphsVar) throw new Error("kein glyphsVar-Feld");
        $("inpName").value = f.name || file.name.replace(/\.handschrift\.json$|\.json$/, "");
        const s = loadStore(); s[fontId()] = f; saveStore(s);
        buildGrid(); buildVariantBar(); notifyFonts();
      } catch (err) { alert(UI.t("Datei konnte nicht gelesen werden: ", "Could not read the file: ") + err.message); }
    };
    $("btnDelFont").onclick = () => {
      if (!confirm(UI.t(`Schrift „${$("inpName").value}“ wirklich löschen?`, `Really delete the font "${$("inpName").value}"?`))) return;
      const s = loadStore(); delete s[fontId()]; saveStore(s);
      buildGrid(); buildVariantBar(); notifyFonts();
    };

    /* ====== Scan-Import (Papier-Vorlage) ====== */
    $("btnScan").onclick = () => $("fileScan").click();
    $("fileScan").onchange = async e => {
      const files = [...e.target.files];
      e.target.value = "";
      if (!files.length) return;
      $("btnScan").disabled = true;
      const status = $("scanStatus");
      try {
        const q = (window.__studio && window.__studio.S) ? window.__studio.S.quality : 3;
        const { glyphsVar, log } = await window.ScanImport.processFiles(
          files, window.VORLAGE_LAYOUT, msg => { status.textContent = msg; }, q);
        const chars = Object.keys(glyphsVar);
        if (!chars.length) {
          status.textContent = UI.t("Keine Zeichen erkannt — Fotos zu schräg/unscharf? ", "No characters recognized — photos too skewed/blurry? ") + log.join(" · ");
          return;
        }
        persist(f => {
          for (const [ch, vars] of Object.entries(glyphsVar))
            f.glyphsVar[ch] = (f.glyphsVar[ch] || []).concat(vars);
          if (!f.glyphsVar[" "]) f.glyphsVar[" "] = [{ adv: +$("inpSpaceAdv").value, strokes: [] }];
        });
        const total = chars.reduce((a, c) => a + glyphsVar[c].length, 0);
        status.textContent = `✓ ${chars.length} ${UI.t("Zeichen", "characters")}, ${total} ${UI.t("Varianten übernommen", "variants imported")} — ${log.join(" · ")}`;
      } catch (err) {
        console.error(err);
        status.textContent = UI.t("Fehler beim Einlesen: ", "Import error: ") + err.message;
      } finally {
        $("btnScan").disabled = false;
      }
    };

    $("btnHwClose").onclick = () => close();
    $("btnHwTour").onclick = () => UI.startTour();

    // Sprach-/Theme-Reaktion nur, solange verkabelt und Modal offen
    UI.onLangChange(() => { if (!wired) return; applyLangDefaults(); if (!$("captureModal").hidden) { setTool(tool); buildVariantBar(); } });
    UI.onThemeChange(() => { if (!$("captureModal").hidden) draw(); });
  }

  /* ====== Öffnen / Schließen ====== */
  function open(opts) {
    opts = opts || {};
    wire();
    applyTarget = opts.onApply || null;
    // Vorauswahl einer bestehenden Handschrift (z. B. via ?font=hw_…)
    if (opts.fontId) {
      const f = loadStore()[opts.fontId];
      if (f) $("inpName").value = f.name;
    } else if (!$("inpName").value) {
      $("inpName").value = DEFAULT_NAME[UI.lang()];
    }
    applyLangDefaults();
    // Leerzeichen-Breite aus bestehender Schrift übernehmen
    const existing = loadStore()[fontId()];
    if (existing && existing.glyphsVar[" "]) $("inpSpaceAdv").value = existing.glyphsVar[" "][0].adv;
    $("valPen").textContent = $("inpPen").value;

    $("captureModal").hidden = false;
    // Tour dieses Modals aktiv machen (autostartet beim ersten Öffnen)
    UI.initTour("handschrift", () => UI.lang() === "en" ? TOUR_EN : TOUR);

    // Zeichen-Startzustand
    if (!$("inpCharset").value.includes(curChar)) curChar = $("inpCharset").value[0] || "a";
    $("curChar").textContent = curChar;
    strokes = []; curStroke = null; advance = null;
    buildGrid(); buildVariantBar();
    resize(); setTool("pen");
  }

  function close() {
    $("captureModal").hidden = true;
    applyTarget = null;
    // Studio-Tour wieder an #btnTour binden
    if (window.Studio && window.Studio.initTour) window.Studio.initTour();
  }

  // Kleiner Debug-Zugriff für die Testsuite (analog window.__studio) — keine
  // Produktions-API. Liest/steuert Interna, die sonst im IIFE gekapselt sind.
  const _debug = {
    selectChar: ch => selectChar(ch),
    variants: ch => variants(ch),
    curChar: () => curChar,
    strokeCount: () => strokes.length,
    tool: () => tool,
    fontId: () => fontId(),
  };
  return { open, close, _debug };
})();
