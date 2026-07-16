// Text-Ebenentyp für das Layer Studio.
// Portiert 1:1 die Layout-/Variations-/Font-Logik der früheren app/index.html.
// Alle Funktionen sind rein bzw. arbeiten auf einem übergebenen Layer-Objekt —
// keine DOM-Zugriffe (die Verkabelung mit den Eingabefeldern liegt in studio.js).
"use strict";
window.TextLayer = (function () {

  /* ============================== PRNG ============================== */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  // deterministischer Hash pro Buchstabe (Seed, Zeile, Spalte)
  function glyphRng(seed, line, col) {
    return mulberry32((seed * 374761393 + line * 668265263 + col * 2246822519) >>> 0);
  }

  /* ============================== Fonts ============================== */
  // Provider für die per TTF importierten Fonts (aus dem Studio-Zustand),
  // via setCustomFonts() gesetzt. Bleibt projektweit (Asset, kein Layer-Feld).
  let getCustom = () => ({});
  function setCustomFonts(fn) { getCustom = fn; }

  // Handschrift-Fonts aus der Erfassung (localStorage, Schlüssel hw_fonts)
  function hwFonts() {
    try {
      const s = JSON.parse(localStorage.getItem("hw_fonts")) || {};
      const out = {};
      for (const [id, f] of Object.entries(s))
        out[id] = Object.assign({}, f, { name: "✎︎ " + f.name });
      return out;
    } catch { return {}; }
  }
  function allFonts() { return Object.assign({}, window.SL_FONTS, hwFonts(), getCustom()); }
  function fontById(id) { return allFonts()[id] || Object.values(allFonts())[0]; }

  // Ersatzzeichen, falls eine Glyphe fehlt (typografische Varianten)
  const CHAR_FALLBACK = { "—": "-", "–": "-", "„": '"', "“": '"', "”": '"',
                          "’": "'", "‘": "'", "…": "." };

  // Glyphe holen; bei Handschrift-Fonts wählt r (0..1) eine Variante,
  // forced (Index) übersteuert die Zufallswahl.
  function pickGlyph(font, ch, r, forced) {
    const get = c => {
      if (font.glyphsVar) {
        const v = font.glyphsVar[c];
        if (!v || !v.length) return null;
        const idx = forced != null ? ((forced % v.length) + v.length) % v.length
                                   : Math.min(v.length - 1, Math.floor(r * v.length));
        return v[idx];
      }
      return font.glyphs[c] || null;
    };
    return get(ch) || (CHAR_FALLBACK[ch] ? get(CHAR_FALLBACK[ch]) : null);
  }

  function variantCount(font, ch) {
    if (!font.glyphsVar) return font.glyphs[ch] ? 1 : 0;
    return (font.glyphsVar[ch] || font.glyphsVar[CHAR_FALLBACK[ch]] || []).length;
  }

  /* ============================== Layout ============================== */
  // Liefert pro Buchstabe: Strokes in mm (y-down, Ursprung = Arbeitsbereich oben links).
  // layer: Text-Layer-Objekt; Q: {maxSeg,...} Kurvenauflösungs-Parameter (Stage 4).
  function layout(layer, Q) {
    const font = fontById(layer.fontId);
    const sizeMM = layer.sizeMM;
    const scale = sizeMM / (font.capheight || font.upem * 0.7);
    const lineH = layer.lineH * sizeMM;
    const track = layer.track;
    const align = layer.align;
    const wordSp = layer.wordSp;
    const seed = layer.seed;
    const v = layer.varn;
    const varOn = v.on;
    const vRot = varOn ? v.rot : 0;
    const vSize = varOn ? v.size / 100 : 0;
    const vBase = varOn ? v.base : 0;
    const vSpace = varOn ? v.space : 0;
    const vSlant = varOn ? v.slant : 0;
    const vWob = varOn ? v.wob : 0;
    const maxSeg = (Q && Q.maxSeg) || 0.9;

    const lines = String(layer.text).replace(/\r/g, "").split("\n");
    const glyphs = [];
    const missing = new Set();
    const lineWidths = [];

    // Erst Breiten messen (mit Abstands-Jitter, damit Ausrichtung stimmt)
    const advCache = [];
    lines.forEach((ln, li) => {
      let w = 0; const advs = [];
      [...ln].forEach((ch, ci) => {
        const rng = glyphRng(seed, li, ci);
        const vPick = rng();
        rng(); rng(); rng(); rng(); rng();                  // gleiche Reihenfolge wie unten
        const spJit = (rng() * 2 - 1) * vSpace;
        const cv = layer.charVar[li + ":" + ci];
        const g = pickGlyph(font, ch, vPick, cv && cv.ch === ch ? cv.v : null);
        const sp = pickGlyph(font, " ", 0);
        let base = g ? g.adv * scale : (sp ? sp.adv * scale : sizeMM * 0.5);
        if (ch === " ") base *= wordSp;
        const adv = base + track + spJit;
        advs.push(adv); w += adv;
      });
      advCache.push(advs); lineWidths.push(w);
    });
    const maxW = Math.max(0, ...lineWidths);

    lines.forEach((ln, li) => {
      const off = layer.lineOff[li] || { dx: 0, dy: 0 };
      let x = layer.x + off.dx +
        (align === "center" ? (maxW - lineWidths[li]) / 2 : align === "right" ? maxW - lineWidths[li] : 0);
      const baseY = layer.y + off.dy + li * lineH;
      [...ln].forEach((ch, ci) => {
        const rng = glyphRng(seed, li, ci);
        const vPick = rng();
        const cvr = layer.charVar[li + ":" + ci];
        const g = pickGlyph(font, ch, vPick, cvr && cvr.ch === ch ? cvr.v : null);
        const rRot = (rng() * 2 - 1) * vRot * Math.PI / 180;
        const rScale = 1 + (rng() * 2 - 1) * vSize;
        const rBase = (rng() * 2 - 1) * vBase;
        const rSlant = (rng() * 2 - 1) * vSlant * Math.PI / 180;
        const wPhase = rng() * Math.PI * 2;
        rng();                                              // spJit (oben verbraucht)
        if (!g || !g.strokes.length) {
          if (ch.trim() && !g) missing.add(ch);
          x += advCache[li][ci];
          return;
        }
        const adv = advCache[li][ci];
        const coRaw = layer.charOff[li + ":" + ci];
        // Offsets gelten nur, solange an der Position dasselbe Zeichen steht
        const co = (coRaw && coRaw.ch === ch) ? coRaw : { dx: 0, dy: 0 };
        const s = scale * rScale;
        const cx = g.adv * s / 2, cy = -sizeMM / 2;         // Drehpunkt: Mitte des Buchstabens
        const cosR = Math.cos(rRot), sinR = Math.sin(rRot);
        const tanS = Math.tan(rSlant);
        const strokes = g.strokes.map(st => {
          let pts = st.map(p => [p[0] * s, -p[1] * s]);     // Font-Units -> mm, y-Flip
          if (vWob > 0) pts = wobble(pts, vWob, wPhase, maxSeg);
          return pts.map(([px0, py0]) => {
            const px = px0 - tanS * py0;                    // Shear: oben kippt zur Seite
            const py = py0;
            const dx = px - cx, dy = py - cy;
            return [x + co.dx + cx + dx * cosR - dy * sinR,
                    baseY + rBase + co.dy + cy + dx * sinR + dy * cosR];
          });
        });
        glyphs.push({ char: ch, line: li, col: ci, strokes });
        x += adv;
      });
    });
    return { glyphs, missing, lines };
  }

  // Polylinie unterteilen + weiche, deterministische Störung senkrecht zur Linie
  function wobble(pts, amp, phase, maxSeg) {
    const MAXSEG = maxSeg || 0.9; // mm
    const out = [];
    let dist = 0;
    for (let i = 0; i < pts.length; i++) {
      if (i === 0) { out.push({ p: pts[0], d: 0 }); continue; }
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const len = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.max(1, Math.ceil(len / MAXSEG));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        out.push({ p: [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t], d: dist + len * t });
      }
      dist += len;
    }
    return out.map(({ p, d }, i) => {
      if (i === 0 || i === out.length - 1) return p;
      const noise = Math.sin(d * 2.1 + phase) * 0.6 + Math.sin(d * 5.3 + phase * 1.7) * 0.4;
      const prev = out[i - 1].p, next = out[i + 1].p;
      const dx = next[0] - prev[0], dy = next[1] - prev[1];
      const l = Math.hypot(dx, dy) || 1;
      return [p[0] + (-dy / l) * noise * amp, p[1] + (dx / l) * noise * amp];
    });
  }

  /* ====================== Hit-Test / Geometrie ====================== */
  function glyphBBox(g) {
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (const st of g.strokes) for (const [x, y] of st) {
      minx = Math.min(minx, x); miny = Math.min(miny, y);
      maxx = Math.max(maxx, x); maxy = Math.max(maxy, y);
    }
    return [minx, miny, maxx, maxy];
  }

  // Buchstabe unter dem Cursor (bei Überlappung: der mit der nächsten Mitte)
  function hitChar(layout, mx, my) {
    if (!layout) return null;
    const pad = 0.8;
    let best = null, bestD = Infinity;
    for (const g of layout.glyphs) {
      const [minx, miny, maxx, maxy] = glyphBBox(g);
      if (mx < minx - pad || mx > maxx + pad || my < miny - pad || my > maxy + pad) continue;
      const d = Math.hypot(mx - (minx + maxx) / 2, my - (miny + maxy) / 2);
      if (d < bestD) { bestD = d; best = g; }
    }
    return best;
  }

  function hitLine(layout, mx, my) {
    if (!layout) return -1;
    const boxes = {};
    for (const g of layout.glyphs)
      for (const st of g.strokes)
        for (const [x, y] of st) {
          const b = boxes[g.line] || (boxes[g.line] = [1e9, 1e9, -1e9, -1e9]);
          b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y);
          b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
        }
    for (const [li, b] of Object.entries(boxes))
      if (mx >= b[0] - 2 && mx <= b[2] + 2 && my >= b[1] - 2 && my <= b[3] + 2) return +li;
    return -1;
  }

  /* ============================== TTF-Import ============================== */
  // Wandelt eine geparste opentype-Font (window.opentype) in ein Font-Objekt mit
  // geflatteten Polylinien um. buf bleibt für spätere Neu-Flattung erhalten.
  function parseTtf(f, fileName, buf, Q) {
    const upem = f.unitsPerEm;
    const cap = (f.tables.os2 && f.tables.os2.sCapHeight) || upem * 0.7;
    const fontObj = { name: "✎︎ " + (f.names.fullName?.en || fileName), upem,
                      ascent: f.ascender, descent: f.descender, capheight: cap,
                      xheight: (f.tables.os2 && f.tables.os2.sxHeight) || upem * 0.5,
                      glyphs: {}, _buf: buf };
    const SEG = (Q && Q.ttfSeg) || 12;
    const chars = ' abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      + 'äöüÄÖÜßéèêàáçñ'
      + '.,;:!?\'"„“«»()[]{}<>/-–—_+=*#@&%€$§°^~|';
    for (const ch of chars) {
      const gl = f.charToGlyph(ch);
      if (!gl || (gl.index === 0 && ch !== " ")) continue;
      const p = gl.getPath(0, 0, upem);                      // y-down!
      const strokes = []; let cur = null; let startPt = null;
      for (const c of p.commands) {
        if (c.type === "M") { if (cur && cur.length > 1) strokes.push(cur); cur = [[c.x, -c.y]]; startPt = [c.x, -c.y]; }
        else if (c.type === "L") cur && cur.push([c.x, -c.y]);
        else if (c.type === "C" && cur) {
          const [x0, y0] = cur[cur.length - 1];
          for (let k = 1; k <= SEG; k++) { const t = k / SEG, m = 1 - t;
            cur.push([m*m*m*x0 + 3*m*m*t*c.x1 + 3*m*t*t*c.x2 + t*t*t*c.x,
                      m*m*m*y0 + 3*m*m*t*-c.y1 + 3*m*t*t*-c.y2 + t*t*t*-c.y]); }
        }
        else if (c.type === "Q" && cur) {
          const [x0, y0] = cur[cur.length - 1];
          for (let k = 1; k <= SEG; k++) { const t = k / SEG, m = 1 - t;
            cur.push([m*m*x0 + 2*m*t*c.x1 + t*t*c.x, m*m*y0 + 2*m*t*-c.y1 + t*t*-c.y]); }
        }
        else if (c.type === "Z" && cur) { if (startPt) cur.push([...startPt]); strokes.push(cur); cur = null; }
      }
      if (cur && cur.length > 1) strokes.push(cur);
      fontObj.glyphs[ch] = { adv: gl.advanceWidth || upem * 0.5,
        strokes: strokes.map(st => st.map(p2 => [Math.round(p2[0] * 10) / 10, Math.round(p2[1] * 10) / 10])) };
    }
    return fontObj;
  }

  /* ============================== Registrierung ============================== */
  function bboxOfStrokes(strokes) {
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (const st of strokes) for (const [x, y] of st) {
      minx = Math.min(minx, x); miny = Math.min(miny, y);
      maxx = Math.max(maxx, x); maxy = Math.max(maxy, y);
    }
    return maxx < minx ? null : [minx, miny, maxx, maxy];
  }

  const type = {
    label: ["Text", "Text"],
    icon: "text",
    create() {
      return {
        type: "text",
        x: 20, y: 30,
        text: "", fontId: "EMSReadability",
        sizeMM: 10, lineH: 1.5, track: 0, wordSp: 1, align: "left",
        varn: { on: true, rot: 2.5, size: 4, base: 0.35, space: 0.25, slant: 2, wob: 0.12 },
        seed: 42,
        lineOff: [], charOff: {}, charVar: {},
      };
    },
    // Neuberechnung → {strokes, layout, bbox}
    compute(layer, Q) {
      const lo = layout(layer, Q);
      const strokes = lo.glyphs.flatMap(g => g.strokes);
      return { strokes, layout: lo, bbox: bboxOfStrokes(strokes) };
    },
    // Export-Untergruppierung für Modus "line"/"char"
    exportGroups(layer, mode, cache, tt) {
      const glyphs = cache.layout.glyphs;
      if (mode === "line") {
        const m = new Map();
        for (const g of glyphs) {
          if (!m.has(g.line)) m.set(g.line, { name: tt("Zeile ", "Line ") + (g.line + 1), strokes: [] });
          m.get(g.line).strokes.push(...g.strokes);
        }
        return [...m.values()];
      }
      return glyphs.map((g, i) => ({ name: g.char + " " + (i + 1), strokes: g.strokes }));
    },
  };

  return {
    type,
    mulberry32, glyphRng, hwFonts, allFonts, fontById, pickGlyph, variantCount,
    layout, wobble, glyphBBox, hitChar, hitLine, parseTtf, bboxOfStrokes,
    setCustomFonts, CHAR_FALLBACK,
  };
})();
