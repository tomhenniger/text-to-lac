// Scan-Import im Browser: ausgefüllte Papier-Vorlagen -> Handschrift-Varianten.
// JS-Port von tools/handschrift_scan.py (Marker -> Homographie -> Seiten-ID ->
// Tinte -> Zhang-Suen-Skelett -> Pfadverfolgung -> Font-Einheiten).
"use strict";
window.ScanImport = (function () {
  const T = (de, en) => (window.UI ? window.UI.t(de, en) : de);
  const RES = 10;          // px pro mm im entzerrten Zellenraster
  const MIN_COMP = 10;     // Mindest-Pixelfläche einer Tintenkomponente
  const MIN_INK = 25;      // Mindest-Tintenpixel pro Kästchen
  const DOT_MAX = 95;      // bis hierhin gilt eine runde Komponente als Punkt

  /* ---------------- Lineare Algebra ---------------- */
  function gauss(A, b) {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r][c] / M[c][c];
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    return M.map((row, i) => row[n] / row[i]);
  }

  function homography(src, dst) {     // 4 Punktpaare mm -> px
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [X, Y] = src[i], [x, y] = dst[i];
      A.push([X, Y, 1, 0, 0, 0, -x * X, -x * Y]); b.push(x);
      A.push([0, 0, 0, X, Y, 1, -y * X, -y * Y]); b.push(y);
    }
    const h = gauss(A, b);
    return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
  }

  const applyH = (H, x, y) => {
    const w = H[6] * x + H[7] * y + H[8];
    return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
  };

  /* ---------------- Bild laden ---------------- */
  async function loadGray(file) {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    URL.revokeObjectURL(img.src);
    // Erst bei voller Auflösung in Graustufen wandeln, dann mit einem
    // dunkelheitserhaltenden Min-Pool verkleinern (dunkelster Quellwert je
    // Zielpixel). Würde man wie üblich per Canvas mitteln, verwäscht der Browser
    // dünne (farbmanaged/ICC dekodierte) Tinte mit dem weißen Papier — die Linie
    // wird heller und reißt beim Schwellwert ab. Der Min-Pool hält den dunklen
    // Tintenkern; dickere Striche normalisiert später die Skelettierung.
    const nw = img.naturalWidth || img.width, nh = img.naturalHeight || img.height;
    const CAP = 8000;                        // Speichergrenze fürs Zwischenbild
    const pre = Math.min(1, CAP / Math.max(nw, nh));
    const sw = Math.max(1, Math.round(nw * pre)), sh = Math.max(1, Math.round(nh * pre));
    const src = document.createElement("canvas");
    src.width = sw; src.height = sh;
    const sg = src.getContext("2d", { willReadFrequently: true });
    sg.imageSmoothingEnabled = true; sg.imageSmoothingQuality = "high";
    sg.drawImage(img, 0, 0, sw, sh);
    const rgba = sg.getImageData(0, 0, sw, sh).data;
    const gfull = new Uint8ClampedArray(sw * sh);
    for (let i = 0; i < gfull.length; i++) {
      const a = rgba[i * 4 + 3] / 255;
      gfull[i] = (0.2126 * rgba[i * 4] + 0.7152 * rgba[i * 4 + 1] + 0.0722 * rgba[i * 4 + 2]) * a + 255 * (1 - a);
    }
    const sc = Math.min(1, 3500 / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * sc)), h = Math.max(1, Math.round(sh * sc));
    if (w === sw && h === sh) return { gray: gfull, w, h };   // klein genug, kein Pooling
    const gray = new Uint8ClampedArray(w * h);
    const bxf = sw / w, byf = sh / h;
    for (let oy = 0; oy < h; oy++) {
      const y0 = Math.floor(oy * byf), y1 = Math.max(y0 + 1, Math.min(sh, Math.round((oy + 1) * byf)));
      for (let ox = 0; ox < w; ox++) {
        const x0 = Math.floor(ox * bxf), x1 = Math.max(x0 + 1, Math.min(sw, Math.round((ox + 1) * bxf)));
        let mn = 255;
        for (let sy = y0; sy < y1; sy++) {
          const row = sy * sw;
          for (let sx = x0; sx < x1; sx++) { const v = gfull[row + sx]; if (v < mn) mn = v; }
        }
        gray[oy * w + ox] = mn;
      }
    }
    return { gray, w, h };
  }

  function percentile(arr, p, stride = 1) {
    const s = [];
    for (let i = 0; i < arr.length; i += stride) s.push(arr[i]);
    s.sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(s.length * p / 100))];
  }

  /* ---------------- Markererkennung ---------------- */
  function components(mask, w, h) {     // BFS-Labeling, liefert Liste von Komponenten
    const lab = new Int32Array(w * h);
    const comps = [];
    const stack = [];
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i] || lab[i]) continue;
      const id = comps.length + 1;
      const comp = { px: [], minx: 1e9, miny: 1e9, maxx: -1, maxy: -1, sx: 0, sy: 0 };
      stack.push(i); lab[i] = id;
      while (stack.length) {
        const j = stack.pop();
        const x = j % w, y = (j - x) / w;
        comp.px.push(j);
        comp.sx += x; comp.sy += y;
        if (x < comp.minx) comp.minx = x;
        if (x > comp.maxx) comp.maxx = x;
        if (y < comp.miny) comp.miny = y;
        if (y > comp.maxy) comp.maxy = y;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const k = ny * w + nx;
          if (mask[k] && !lab[k]) { lab[k] = id; stack.push(k); }
        }
      }
      comps.push(comp);
    }
    return comps;
  }

  function findMarkers(gray, w, h) {
    const white = percentile(gray, 90, 17);
    const thr = white * 0.5;
    const ww = Math.floor(w * 0.30), wh = Math.floor(h * 0.30);
    const windows = {
      tl: [0, 0], tr: [w - ww, 0], bl: [0, h - wh], br: [w - ww, h - wh],
    };
    const centers = {};
    for (const [key, [x0, y0]] of Object.entries(windows)) {
      const sub = new Uint8Array(ww * wh);
      for (let y = 0; y < wh; y++)
        for (let x = 0; x < ww; x++)
          sub[y * ww + x] = gray[(y0 + y) * w + (x0 + x)] < thr ? 1 : 0;
      let best = null;
      for (const c of components(sub, ww, wh)) {
        const bw = c.maxx - c.minx + 1, bh = c.maxy - c.miny + 1;
        if (bw < 6 || bh < 6) continue;
        const aspect = bh / bw;
        if (aspect < 0.6 || aspect > 1.7) continue;
        if (c.px.length / (bw * bh) < 0.6) continue;
        if (!best || c.px.length > best.px.length) best = c;
      }
      if (!best) throw new Error(T(`Kein Marker in Ecke ${key} gefunden`, `No marker found in corner ${key}`));
      centers[key] = [x0 + best.sx / best.px.length, y0 + best.sy / best.px.length];
    }
    return centers;
  }

  function sampleRegion(gray, w, h, H, xMM, yMM, wMM, hMM) {
    const pw = Math.round(wMM * RES), ph = Math.round(hMM * RES);
    const out = new Float32Array(pw * ph);
    for (let py = 0; py < ph; py++)
      for (let px = 0; px < pw; px++) {
        const [ix, iy] = applyH(H, xMM + (px + 0.5) / RES, yMM + (py + 0.5) / RES);
        const xi = Math.max(0, Math.min(w - 1, Math.round(ix)));
        const yi = Math.max(0, Math.min(h - 1, Math.round(iy)));
        out[py * pw + px] = gray[yi * w + xi];
      }
    return { data: out, w: pw, h: ph };
  }

  function readPageId(gray, w, h, H, layout, white) {
    const pid = layout.pageid;
    let val = 0;
    for (let b = 0; b < pid.bits; b++) {
      const x = pid.x + b * (pid.box + pid.gap) + pid.box / 2;
      const y = pid.y + pid.box / 2;
      const patch = sampleRegion(gray, w, h, H, x - 0.8, y - 0.8, 1.6, 1.6);
      let s = 0;
      for (const v of patch.data) s += v;
      if (s / patch.data.length < white * 0.6) val |= 1 << b;
    }
    return val;
  }

  /* ---------------- Tinte -> Strokes ---------------- */
  function gaussBlur(patch) {           // ~σ 0.9: zweimal [1 2 1]/4 separabel
    const { data, w, h } = patch;
    const tmp = new Float32Array(data.length);
    const out = new Float32Array(data.length);
    out.set(data);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const l = out[y * w + Math.max(0, x - 1)], r = out[y * w + Math.min(w - 1, x + 1)];
          tmp[y * w + x] = (l + 2 * out[y * w + x] + r) / 4;
        }
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const u = tmp[Math.max(0, y - 1) * w + x], d = tmp[Math.min(h - 1, y + 1) * w + x];
          out[y * w + x] = (u + 2 * tmp[y * w + x] + d) / 4;
        }
    }
    return { data: out, w, h };
  }

  function removeGuides(mask, w, h, guideRows) {
    // lange horizontale Runs nur in Bändern um die Hilfslinien entfernen
    const inBand = new Uint8Array(h);
    for (const r of guideRows) {
      const ri = Math.round(r);
      for (let y = Math.max(0, ri - 5); y <= Math.min(h - 1, ri + 5); y++) inBand[y] = 1;
    }
    for (let y = 0; y < h; y++) {
      if (!inBand[y]) continue;
      let run = 0;
      for (let x = 0; x <= w; x++) {
        if (x < w && mask[y * w + x]) { run++; continue; }
        if (run >= 35) {
          for (let yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy++)
            for (let xx = Math.max(0, x - run - 3); xx < Math.min(w, x + 3); xx++)
              mask[yy * w + xx] = 0;
        }
        run = 0;
      }
    }
    // vertikales Closing: Lücken bis 6 px schließen
    for (let x = 0; x < w; x++) {
      let last = -99;
      for (let y = 0; y < h; y++) {
        if (!mask[y * w + x]) continue;
        if (y - last <= 7 && y - last > 1)
          for (let yy = last + 1; yy < y; yy++) mask[yy * w + x] = 1;
        last = y;
      }
    }
    return mask;
  }

  function skeletonize(img, w, h) {     // Zhang-Suen (in-place auf Kopie)
    img = Uint8Array.from(img);
    const idx = (x, y) => y * w + x;
    let changed = true;
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
    return img;
  }

  /* ---- Pfadverfolgung (mit Diagonal-Fix wie in handschrift_scan.py) ---- */
  const KEY = (y, x) => y * 100000 + x;

  function traceSkeleton(skel, w, h) {
    const pts = new Set();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (skel[y * w + x]) pts.add(KEY(y, x));
    const NB = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
    function nbrs(y, x) {
      const out = [];
      for (const [dy, dx] of NB) {
        if (!pts.has(KEY(y + dy, x + dx))) continue;
        if (dy && dx && (pts.has(KEY(y + dy, x)) || pts.has(KEY(y, x + dx)))) continue;
        out.push([y + dy, x + dx]);
      }
      return out;
    }
    const deg = new Map();
    for (const k of pts) deg.set(k, nbrs(Math.floor(k / 100000), k % 100000).length);
    const used = new Set();
    const ek = (a, b) => a < b ? a + "|" + b : b + "|" + a;
    const paths = [];
    function walk(sy, sx, ny, nx) {
      const path = [[sx, sy], [nx, ny]];
      used.add(ek(KEY(sy, sx), KEY(ny, nx)));
      let cy = ny, cx = nx, py = sy, px = sx;
      while (deg.get(KEY(cy, cx)) === 2) {
        const cand = nbrs(cy, cx).filter(([qy, qx]) =>
          !(qy === py && qx === px) && !used.has(ek(KEY(cy, cx), KEY(qy, qx))));
        if (!cand.length) break;
        [py, px] = [cy, cx];
        [cy, cx] = cand[0];
        used.add(ek(KEY(py, px), KEY(cy, cx)));
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
          if (!used.has(ek(k, KEY(qy, qx)))) paths.push(walk(y, x, qy, qx));
      }
    }
    return { paths: paths.filter(p => p.length >= 2), pts, nbrs };
  }

  function pathLen(p) {
    let l = 0;
    for (let i = 1; i < p.length; i++) l += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    return l;
  }

  function pruneSpurs(paths, pts, nbrs) {
    const junctions = new Set();
    for (const k of pts) {
      const y = Math.floor(k / 100000), x = k % 100000;
      if (nbrs(y, x).length >= 3) junctions.add(x + "," + y);
    }
    const out = paths.filter(p => {
      const atJ = (junctions.has(p[0][0] + "," + p[0][1]) ? 1 : 0) +
                  (junctions.has(p[p.length - 1][0] + "," + p[p.length - 1][1]) ? 1 : 0);
      return !(pathLen(p) < 5 && atJ === 1 && paths.length > 1);
    });
    return out.length ? out : paths;
  }

  function joinPaths(paths, maxGap, minDot, requirePair) {
    paths = paths.map(p => [...p]);
    function direction(p, atEnd) {
      const seg = atEnd ? p.slice(-4) : p.slice(0, 4);
      if (seg.length < 2) return null;
      const dx = seg[seg.length - 1][0] - seg[0][0], dy = seg[seg.length - 1][1] - seg[0][1];
      const n = Math.hypot(dx, dy);
      return n ? [dx / n, dy / n] : null;
    }
    function endpointCount(pt) {
      let c = 0;
      for (const p of paths)
        for (const e of [p[0], p[p.length - 1]])
          if (Math.hypot(e[0] - pt[0], e[1] - pt[1]) <= maxGap / 2 + 1.5) c++;
      return c;
    }
    let merged = true;
    while (merged) {
      merged = false;
      outer:
      for (let i = 0; i < paths.length; i++) {
        for (let j = 0; j < paths.length; j++) {
          if (i === j) continue;
          for (const [ei, ej, revI, revJ] of [[-1, 0, 0, 0], [-1, -1, 0, 1], [0, 0, 1, 0], [0, -1, 1, 1]]) {
            const a = paths[i].at(ei), b = paths[j].at(ej);
            if (Math.hypot(a[0] - b[0], a[1] - b[1]) > maxGap) continue;
            const di = direction(revI ? [...paths[i]].reverse() : paths[i], true);
            const dj = direction(revJ ? [...paths[j]].reverse() : paths[j], false);
            if (!di || !dj || di[0] * dj[0] + di[1] * dj[1] < minDot) continue;
            if (requirePair && endpointCount([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]) !== 2) continue;
            const pi = revI ? [...paths[i]].reverse() : paths[i];
            const pj = revJ ? [...paths[j]].reverse() : paths[j];
            paths[i] = pi.concat(pj);
            paths.splice(j, 1);
            merged = true;
            break outer;
          }
        }
      }
    }
    return paths;
  }

  function smoothPath(p, passes = 2) {
    let a = p.map(q => [...q]);
    for (let k = 0; k < passes; k++) {
      if (a.length < 5) break;
      const b = a.map(q => [...q]);
      for (let i = 1; i < a.length - 1; i++) {
        b[i][0] = (a[i - 1][0] + 2 * a[i][0] + a[i + 1][0]) / 4;
        b[i][1] = (a[i - 1][1] + 2 * a[i][1] + a[i + 1][1]) / 4;
      }
      a = b;
    }
    return a;
  }

  function chaikin(p, iter = 2) {     // Ecken-Schneiden: macht Pixel-Treppen zu weichen Kurven
    for (let k = 0; k < iter; k++) {
      if (p.length < 3) break;
      const q = [p[0]];
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1];
        q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
        q.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
      }
      q.push(p[p.length - 1]);
      p = q;
    }
    return p;
  }

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

  function cellToStrokes(patchRaw, cell, unitsPerMm) {
    const patch = gaussBlur(patchRaw);
    const { data, w, h } = patch;
    const white = percentile(data, 85, 3);
    const mask = new Uint8Array(w * h);
    const x0px = Math.round(cell.x0 * RES);
    for (let i = 0; i < mask.length; i++)
      mask[i] = (data[i] < white * 0.55 && (i % w) >= x0px) ? 1 : 0;
    removeGuides(mask, w, h, ["cap_y", "xh_y", "base_y", "desc_y"].map(k => cell[k] * RES));
    let inkSum = 0;
    for (const v of mask) inkSum += v;
    if (inkSum < MIN_INK) return null;

    // runde Mini-Komponenten = Punkte; Rest gemeinsam skelettieren
    const strokeMask = new Uint8Array(w * h);
    let paths = [];
    for (const c of components(mask, w, h)) {
      const area = c.px.length;
      if (area < MIN_COMP) continue;
      const bw = c.maxx - c.minx + 1, bh = c.maxy - c.miny + 1;
      if (area <= DOT_MAX && bw <= 13 && bh <= 13) {
        const cx = c.sx / area, cy = c.sy / area;
        const r = Math.max(1.5, Math.sqrt(area) / 3);
        paths.push([[cx - r, cy], [cx + r, cy + 0.5]]);
        continue;
      }
      for (const j of c.px) strokeMask[j] = 1;
    }
    if (strokeMask.some(v => v)) {
      const skel = skeletonize(strokeMask, w, h);
      const { paths: traced, pts, nbrs } = traceSkeleton(skel, w, h);
      let joined = joinPaths(pruneSpurs(traced, pts, nbrs), 7.0, 0.25, false);
      joined = joinPaths(joined, 7.0, -0.4, true);
      joined = joinPaths(joined, 3.5, -1.0, false);
      paths.push(...joined.filter(p => pathLen(p) >= 5));
    }
    paths = paths.map(p => rdp(chaikin(rdp(smoothPath(p), 0.8)), 0.3)).filter(p => p.length >= 2);
    if (!paths.length) return null;

    let minX = 1e9, maxX = 0;
    const strokes = paths.map(p => p.map(([x, y]) => {
      const ux = (x / RES - cell.x0) * unitsPerMm;
      const uy = (cell.base_y - y / RES) * unitsPerMm;
      if (ux < minX) minX = ux;
      if (ux > maxX) maxX = ux;
      return [ux, uy];
    }));
    const LSB = 20, RSB = 35;
    return {
      adv: Math.round(maxX - minX + LSB + RSB),
      strokes: strokes.map(st => st.map(([x, y]) =>
        [Math.round((x - minX + LSB) * 10) / 10, Math.round(y * 10) / 10])),
    };
  }

  /* ---------------- Hauptablauf ---------------- */
  const tick = () => new Promise(r => setTimeout(r, 0));

  async function processFiles(files, layout, onProgress) {
    const glyphsVar = {};
    const log = [];
    const half = layout.marker.size / 2;
    const mmPts = layout.marker.positions.map(([x, y]) => [x + half, y + half]);

    for (const file of files) {
      onProgress?.(file.name + " …");
      let gray, w, h;
      try { ({ gray, w, h } = await loadGray(file)); }
      catch { log.push(`${file.name}: ` + T("Bild konnte nicht gelesen werden", "could not read the image")); continue; }
      let centers;
      try { centers = findMarkers(gray, w, h); }
      catch (e) { log.push(`${file.name}: ${e.message}`); continue; }
      const white = percentile(gray, 90, 17);

      let H = homography(mmPts, ["tl", "tr", "bl", "br"].map(k => centers[k]));
      let page = readPageId(gray, w, h, H, layout, white);
      if (!(page >= 1 && page <= 63)) {        // evtl. kopfüber
        const H2 = homography(mmPts, ["br", "bl", "tr", "tl"].map(k => centers[k]));
        const p2 = readPageId(gray, w, h, H2, layout, white);
        if (p2 >= 1 && p2 <= 63) { H = H2; page = p2; }
      }
      if (!(page >= 1 && page <= 63)) {
        log.push(`${file.name}: ` + T("Seiten-ID nicht lesbar — Foto zu schräg oder unscharf?", "page ID unreadable — photo too skewed or blurry?"));
        continue;
      }

      const cells = layout.cells.filter(c => c.page === page - 1);
      let filled = 0;
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (i % 8 === 0) {
          onProgress?.(`${file.name}: ${T("Seite", "page")} ${page}, ${T("Kästchen", "box")} ${i + 1}/${cells.length} …`);
          await tick();
        }
        const patch = sampleRegion(gray, w, h, H, cell.x, cell.y, cell.w, cell.h);
        const res = cellToStrokes(patch, cell, layout.units_per_mm);
        if (res) {
          (glyphsVar[cell.char] = glyphsVar[cell.char] || []).push(res);
          filled++;
        }
      }
      log.push(`${file.name}: ${T("Seite", "page")} ${page}, ${filled}/${cells.length} ${T("Kästchen mit Tinte", "boxes with ink")}`);
    }
    return { glyphsVar, log };
  }

  return { processFiles };
})();
