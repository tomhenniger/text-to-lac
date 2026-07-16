// Bild-Ebenentyp für das Layer Studio.
// Portiert 1:1 die sechs Render-Stile (Schraffur, Kreuzschraffur, Wellenlinien,
// Spirale, ASCII-Art, Konturen) samt Helligkeit/Kontrast/Invertierung aus der
// früheren app/bild.html. Alle Funktionen sind rein bzw. arbeiten auf einem
// übergebenen Layer-Objekt — keine DOM-Zugriffe (Verkabelung liegt in studio.js).
//
// Rechenmodell: Die teure Raster→Vektor-Berechnung hängt NICHT von x/y ab.
// Deshalb hält jede Bild-Ebene einen "Roh"-Cache (_raw) relativ zur Bild-Ecke
// (0,0 .. W,H). compute() baut daraus die absoluten Matten-Strokes durch bloßes
// Verschieben um x/y — Ziehen des Bildes ist damit billig (kein Neu-Rendern).
"use strict";
window.ImageLayer = (function () {

  /* ============================== Bild laden ============================== */
  // Datei -> Graustufen-Puffer (0..255, y-down). Ergebnis via cb(srcObj).
  let loadCounter = 0;
  function loadImageFile(file, cb) {
    const img = new Image();
    img.onload = () => {
      const MAXPX = 900;
      const sc = Math.min(1, MAXPX / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0, c.width, c.height);
      const data = g.getImageData(0, 0, c.width, c.height).data;
      const gray = new Float32Array(c.width * c.height);
      for (let i = 0; i < gray.length; i++) {
        const r = data[i * 4], gg = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3] / 255;
        gray[i] = (0.2126 * r + 0.7152 * gg + 0.0722 * b) * a + 255 * (1 - a);
      }
      const src = {
        gray, gw: c.width, gh: c.height,
        aspect: c.height / c.width,
        fileName: file.name, w0: img.width, h0: img.height,
        _id: ++loadCounter,
      };
      URL.revokeObjectURL(img.src);
      cb(src);
    };
    img.src = URL.createObjectURL(file);
  }

  // Bild darf das Arbeitsfeld nicht verlassen.
  function clampPos(layer, matW, matH) {
    if (!layer.src) return;
    const iw = layer.widthMM, ih = iw * layer.src.aspect;
    layer.x = iw <= matW ? Math.max(0, Math.min(matW - iw, layer.x)) : Math.min(0, Math.max(matW - iw, layer.x));
    layer.y = ih <= matH ? Math.max(0, Math.min(matH - ih, layer.y)) : Math.min(0, Math.max(matH - ih, layer.y));
  }

  /* ============================== Helligkeit ============================== */
  // Liefert eine lum(xMM,yMM)-Funktion (0 dunkel .. 1 hell) über das Bildfeld W×H.
  function makeLum(layer, W, H) {
    const src = layer.src, gw = src.gw, gh = src.gh, gray = src.gray;
    const contrast = layer.contrast, bright = layer.bright, invert = layer.invert;
    return function (xMM, yMM) {
      const px = xMM / W * (gw - 1), py = yMM / H * (gh - 1);
      const x0 = Math.max(0, Math.min(gw - 1, Math.floor(px)));
      const y0 = Math.max(0, Math.min(gh - 1, Math.floor(py)));
      const x1 = Math.min(gw - 1, x0 + 1), y1 = Math.min(gh - 1, y0 + 1);
      const fx = px - x0, fy = py - y0;
      const v = gray[y0 * gw + x0] * (1 - fx) * (1 - fy) + gray[y0 * gw + x1] * fx * (1 - fy)
              + gray[y1 * gw + x0] * (1 - fx) * fy + gray[y1 * gw + x1] * fx * fy;
      let l = (v / 255 - 0.5) * contrast + 0.5 + bright / 100;
      l = Math.max(0, Math.min(1, l));
      return invert ? 1 - l : l;
    };
  }

  /* ============================== Geometrie-Helfer ============================== */
  function segLen(p) {
    let l = 0;
    for (let i = 1; i < p.length; i++) l += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    return l;
  }
  function simplify(p) { return p.length > 2 ? [p[0], p[p.length - 1]] : p; }

  function rdp(pts, eps) {
    if (pts.length < 3) return pts;
    const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
    const dx = bx - ax, dy = by - ay, n = Math.hypot(dx, dy);
    let mi = 0, md = -1;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = n ? Math.abs(dx * (ay - pts[i][1]) - dy * (ax - pts[i][0])) / n
                  : Math.hypot(pts[i][0] - ax, pts[i][1] - ay);
      if (d > md) { md = d; mi = i; }
    }
    if (md > eps) {
      const l = rdp(pts.slice(0, mi + 1), eps), r = rdp(pts.slice(mi), eps);
      return l.slice(0, -1).concat(r);
    }
    return [pts[0], pts[pts.length - 1]];
  }

  /* ============================== Stile ============================== */
  function hatchLines(lum, W, H, spacing, angleDeg, thresh, phase, step) {
    const a = angleDeg * Math.PI / 180;
    const dir = [Math.cos(a), Math.sin(a)];
    const nrm = [-dir[1], dir[0]];
    const diag = Math.hypot(W, H);
    const cx = W / 2, cy = H / 2;
    const STEP = 0.45 * step;
    const out = [];
    const n0 = Math.ceil(diag / 2 / spacing);
    for (let k = -n0; k <= n0; k++) {
      const off = (k + phase) * spacing;
      let seg = null;
      for (let t = -diag / 2; t <= diag / 2; t += STEP) {
        const x = cx + dir[0] * t + nrm[0] * off;
        const y = cy + dir[1] * t + nrm[1] * off;
        const inside = x >= 0 && x <= W && y >= 0 && y <= H;
        const on = inside && lum(x, y) < thresh;
        if (on) { (seg = seg || []).push([x, y]); }
        else if (seg) {
          if (segLen(seg) > 0.7) out.push(simplify(seg));
          seg = null;
        }
      }
      if (seg && segLen(seg) > 0.7) out.push(simplify(seg));
    }
    return out;
  }

  function styleHatch(lum, W, H, o, cross, step) {
    const spacing = o.space, base = o.angle, levels = o.levels;
    const ANG = [0, 90, 45, -45, 22.5];
    const out = [];
    for (let lv = 0; lv < levels; lv++) {
      const thresh = 1 - (lv + 1) / (levels + 0.3);
      const angle = cross ? base + ANG[lv % ANG.length] : base;
      const phase = cross ? 0 : lv / levels;
      out.push(...hatchLines(lum, W, H, spacing, angle, thresh, phase, step));
    }
    return out;
  }

  function styleSquiggle(lum, W, H, o, step) {
    const spacing = o.space;
    const maxAmp = o.amp * spacing / 2;
    const freq = o.freq;
    const skipWhite = o.whiteSkip;
    const out = [];
    const STEP = 0.35 * step;
    for (let y = spacing / 2; y < H; y += spacing) {
      let phase = 0, seg = null;
      for (let x = 0; x <= W; x += STEP) {
        const d = 1 - lum(x, y);
        if (skipWhite && d < 0.08) {
          if (seg && seg.length > 2) out.push(seg);
          seg = null; continue;
        }
        phase += (0.5 + d * d * 7 * freq) * STEP;
        const yy = y + maxAmp * d * Math.sin(phase);
        (seg = seg || []).push([x, yy]);
      }
      if (seg && seg.length > 2) out.push(seg);
    }
    return out;
  }

  function styleSpiral(lum, W, H, o, step) {
    const spacing = o.space;
    const maxAmp = o.amp * spacing / 2;
    const freq = o.freq;
    const skipWhite = o.whiteSkip;
    const cx = W / 2, cy = H / 2;
    const maxR = Math.hypot(W, H) / 2;
    const out = [];
    let seg = null, phase = 0, theta = 0;
    while (true) {
      const r = spacing * theta / (2 * Math.PI) + 0.3;
      if (r > maxR) break;
      const ds = 0.4 * step;
      theta += ds / Math.max(r, 0.5);
      const bx = cx + r * Math.cos(theta), by = cy + r * Math.sin(theta);
      const inside = bx >= 0 && bx <= W && by >= 0 && by <= H;
      if (!inside) { if (seg && seg.length > 2) out.push(seg); seg = null; continue; }
      const d = 1 - lum(bx, by);
      if (skipWhite && d < 0.08) { if (seg && seg.length > 2) out.push(seg); seg = null; continue; }
      phase += (0.5 + d * d * 7 * freq) * ds;
      const rr = r + maxAmp * d * Math.sin(phase);
      (seg = seg || []).push([cx + rr * Math.cos(theta), cy + rr * Math.sin(theta)]);
    }
    if (seg && seg.length > 2) out.push(seg);
    return out;
  }

  /* ---------- ASCII ---------- */
  function styleAscii(lum, W, H, o, font) {
    const cell = o.cell;
    const ramp = (o.ramp && o.ramp.trim()) ? o.ramp : " .,:;+ox*XOM@";
    const cw = cell * 0.72, chh = cell;
    const scale = cell * 0.72 / (font.capheight || 700);
    const mul = window.TextLayer.mulberry32;
    const pick = window.TextLayer.pickGlyph;
    const out = [];
    let idx = 0;
    for (let y = 0; y < H - chh * 0.5; y += chh) {
      for (let x = 0; x < W - cw * 0.5; x += cw) {
        const l = lum(x + cw / 2, y + chh / 2);
        const ch = ramp[Math.min(ramp.length - 1, Math.floor((1 - l) * ramp.length))];
        idx++;
        if (ch === " ") continue;
        const g = pick(font, ch, mul(idx * 7919)());
        if (!g || !g.strokes.length) continue;
        const baseY = y + chh * 0.8;
        const xoff = x + Math.max(0, (cw - g.adv * scale) / 2);
        for (const st of g.strokes)
          out.push(st.map(([gx, gy]) => [xoff + gx * scale, baseY - gy * scale]));
      }
    }
    return out;
  }

  /* ---------- Konturen ---------- */
  function styleContour(lum, W, H, o, step) {
    const res = o.res;
    const thresh = o.thresh;
    const w = Math.max(8, Math.round(W * res)), h = Math.max(8, Math.round(H * res));
    const buf = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        buf[y * w + x] = lum((x + 0.5) / res, (y + 0.5) / res) * 255;
    const sm = boxBlur(buf, w, h);
    const edge = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const gx = -sm[i - w - 1] - 2 * sm[i - 1] - sm[i + w - 1] + sm[i - w + 1] + 2 * sm[i + 1] + sm[i + w + 1];
        const gy = -sm[i - w - 1] - 2 * sm[i - w] - sm[i - w + 1] + sm[i + w - 1] + 2 * sm[i + w] + sm[i + w + 1];
        if (Math.hypot(gx, gy) / 8 > thresh) edge[i] = 1;
      }
    thin(edge, w, h);
    const paths = traceBinary(edge, w, h);
    const out = paths.map(p => p.map(([x, y]) => [(x + 0.5) / res, (y + 0.5) / res]))
                     .map(p => rdp(p, 0.25 * step)).filter(p => segLen(p) > 1.2);
    if (o.hatch)
      out.push(...hatchLines(lum, W, H, 1.6, 45, 0.35, 0, step));
    return out;
  }
  function boxBlur(buf, w, h) {
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let s = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy >= 0 && yy < h && xx >= 0 && xx < w) { s += buf[yy * w + xx]; n++; }
        }
        out[y * w + x] = s / n;
      }
    return out;
  }
  function thin(img, w, h) {                           // Zhang-Suen
    let changed = true;
    const idx = (x, y) => y * w + x;
    while (changed) {
      changed = false;
      for (const step of [0, 1]) {
        const kill = [];
        for (let y = 1; y < h - 1; y++)
          for (let x = 1; x < w - 1; x++) {
            if (!img[idx(x, y)]) continue;
            const p = [img[idx(x, y - 1)], img[idx(x + 1, y - 1)], img[idx(x + 1, y)], img[idx(x + 1, y + 1)],
                       img[idx(x, y + 1)], img[idx(x - 1, y + 1)], img[idx(x - 1, y)], img[idx(x - 1, y - 1)]];
            const B = p.reduce((a, b) => a + b, 0);
            if (B < 2 || B > 6) continue;
            let A = 0;
            for (let i = 0; i < 8; i++) if (!p[i] && p[(i + 1) % 8]) A++;
            if (A !== 1) continue;
            if (step === 0 ? (p[0] * p[2] * p[4] || p[2] * p[4] * p[6]) : (p[0] * p[2] * p[6] || p[0] * p[4] * p[6])) continue;
            kill.push(idx(x, y));
          }
        if (kill.length) { changed = true; for (const i of kill) img[i] = 0; }
      }
    }
  }
  function traceBinary(img, w, h) {
    const pts = new Set();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (img[y * w + x]) pts.add(y * 100000 + x);
    const key = (y, x) => y * 100000 + x;
    const NB = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
    function nbrs(y, x) {
      const out = [];
      for (const [dy, dx] of NB) {
        if (!pts.has(key(y + dy, x + dx))) continue;
        if (dy && dx && (pts.has(key(y + dy, x)) || pts.has(key(y, x + dx)))) continue;
        out.push([y + dy, x + dx]);
      }
      return out;
    }
    const deg = new Map();
    for (const k of pts) deg.set(k, nbrs(Math.floor(k / 100000), k % 100000).length);
    const used = new Set();
    const ekey = (a, b) => a < b ? a + "|" + b : b + "|" + a;
    const paths = [];
    function walk(sy, sx, ny, nx) {
      const path = [[sx, sy], [nx, ny]];
      used.add(ekey(key(sy, sx), key(ny, nx)));
      let cy = ny, cx = nx, py = sy, px = sx;
      while (deg.get(key(cy, cx)) === 2) {
        const cand = nbrs(cy, cx).filter(([qy, qx]) => !(qy === py && qx === px) &&
          !used.has(ekey(key(cy, cx), key(qy, qx))));
        if (!cand.length) break;
        [py, px] = [cy, cx];
        [cy, cx] = cand[0];
        used.add(ekey(key(py, px), key(cy, cx)));
        path.push([cx, cy]);
      }
      return path;
    }
    const all = [...pts].sort((a, b) => a - b);
    for (const pass of [0, 1]) {
      for (const k of all) {
        const y = Math.floor(k / 100000), x = k % 100000;
        if (pass === 0 && deg.get(k) === 2) continue;
        for (const [qy, qx] of nbrs(y, x))
          if (!used.has(ekey(k, key(qy, qx)))) paths.push(walk(y, x, qy, qx));
      }
    }
    return paths;
  }

  /* ============================== Berechnung ============================== */
  // Roh-Strokes relativ zur Bild-Ecke (0,0 .. W,H).
  function styleStrokes(layer, W, H, step) {
    const lum = makeLum(layer, W, H);
    const style = layer.style;
    if (style === "hatch")   return styleHatch(lum, W, H, layer.opts.hatch, false, step);
    if (style === "cross")   return styleHatch(lum, W, H, layer.opts.hatch, true, step);
    if (style === "squiggle") return styleSquiggle(lum, W, H, layer.opts.squiggle, step);
    if (style === "spiral")  return styleSpiral(lum, W, H, layer.opts.squiggle, step);
    if (style === "ascii") {
      const font = window.TextLayer.allFonts()[layer.opts.ascii.fontId]
                || Object.values(window.TextLayer.allFonts())[0];
      return styleAscii(lum, W, H, layer.opts.ascii, font);
    }
    return styleContour(lum, W, H, layer.opts.contour, step);
  }

  function bboxOfStrokes(strokes) {
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (const st of strokes) for (const [x, y] of st) {
      minx = Math.min(minx, x); miny = Math.min(miny, y);
      maxx = Math.max(maxx, x); maxy = Math.max(maxy, y);
    }
    return maxx < minx ? null : [minx, miny, maxx, maxy];
  }

  /* ============================== Registrierung ============================== */
  const type = {
    label: ["Bild", "Image"],
    icon: "image",
    create() {
      return {
        type: "image",
        x: 75, y: 60,
        widthMM: 150,
        bright: 0, contrast: 1, invert: false,
        style: "squiggle",
        opts: {
          hatch:    { space: 1.4, angle: 45, levels: 4 },
          squiggle: { space: 2, amp: 0.9, freq: 1.8, whiteSkip: true },
          ascii:    { fontId: null, cell: 3, ramp: " .,:;+ox*XOM@" },
          contour:  { thresh: 22, res: 2, hatch: false },
        },
        src: null,
      };
    },
    // Neuberechnung → {strokes, bbox}. Teurer Teil (_raw) hängt nicht von x/y ab.
    compute(layer, Q) {
      if (!layer.src) return { strokes: [], bbox: null };
      const step = (Q && Q.step) || 1;
      const W = layer.widthMM, H = W * layer.src.aspect;
      const key = [W, layer.bright, layer.contrast, layer.invert, layer.style,
                   JSON.stringify(layer.opts), layer.src._id, step].join("|");
      if (!layer._raw || layer._raw.key !== key) {
        const t0 = (performance || Date).now();
        let strokes;
        try { strokes = styleStrokes(layer, W, H, step); }
        catch (err) { console.error(err); strokes = []; layer._raw = { key, strokes, ms: 0, error: err.message }; }
        if (!layer._raw || layer._raw.key !== key)
          layer._raw = { key, strokes, ms: Math.round((performance || Date).now() - t0) };
      }
      const ox = layer.x, oy = layer.y;
      const strokes = layer._raw.strokes.map(st => st.map(([x, y]) => [ox + x, oy + y]));
      return { strokes, bbox: [layer.x, layer.y, layer.x + W, layer.y + H], calcMs: layer._raw.ms, calcErr: layer._raw.error };
    },
  };

  return { type, loadImageFile, clampPos, styleStrokes, segLen };
})();
