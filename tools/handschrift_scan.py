#!/usr/bin/env python3
"""Liest ausgefüllte Handschrift-Vorlagen (Scan/Foto) ein und erzeugt eine
.handschrift.json für die Erfassungsseite (app/handschrift.html → „Laden …").

Ablauf pro Bild: Eckmarker finden → Homographie (entzerrt auch Schräglage und
Druck-Skalierung) → Seiten-ID lesen → pro Kästchen Tinte extrahieren →
Skelettieren (Mittellinie) → Polylinien verfolgen → Font-Einheiten.

Nutzung:
    python3 handschrift_scan.py scan1.jpg scan2.jpg \
        [--layout ../vorlage_layout.json] [--name "Meine Handschrift"] [--out datei.json]

Benötigt: numpy, Pillow, scipy.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

RES = 10           # px pro mm im entzerrten Zellenraster
MIN_COMP = 10      # Mindest-Pixelfläche einer Tintenkomponente (despeckle)
MIN_INK = 25       # Mindest-Tintenpixel, damit eine Zelle als „ausgefüllt" gilt
DOT_MAX = 95       # Komponenten bis zu dieser Fläche werden als Punkt übernommen


# ---------------- Geometrie ----------------
def homography(src, dst):
    """4-Punkt-Homographie src(mm) -> dst(px)."""
    A, b = [], []
    for (X, Y), (x, y) in zip(src, dst):
        A.append([X, Y, 1, 0, 0, 0, -x * X, -x * Y]); b.append(x)
        A.append([0, 0, 0, X, Y, 1, -y * X, -y * Y]); b.append(y)
    h = np.linalg.solve(np.array(A, float), np.array(b, float))
    return np.array([[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1.0]])


def apply_h(H, pts):
    p = np.asarray(pts, float)
    q = (H @ np.vstack([p.T, np.ones(len(p))])).T
    return q[:, :2] / q[:, 2:3]


def sample_region(gray, H, x_mm, y_mm, w_mm, h_mm, res=RES):
    """Rechteck (mm) per Homographie aus dem Bild abtasten (nearest)."""
    gx, gy = np.meshgrid(x_mm + (np.arange(int(w_mm * res)) + 0.5) / res,
                         y_mm + (np.arange(int(h_mm * res)) + 0.5) / res)
    pts = apply_h(H, np.column_stack([gx.ravel(), gy.ravel()]))
    xi = np.clip(np.round(pts[:, 0]).astype(int), 0, gray.shape[1] - 1)
    yi = np.clip(np.round(pts[:, 1]).astype(int), 0, gray.shape[0] - 1)
    return gray[yi, xi].reshape(gx.shape)


# ---------------- Markererkennung ----------------
def find_markers(gray):
    """Zentren der 4 Eck-Quadrate (TL, TR, BL, BR) in Bild-px."""
    h, w = gray.shape
    white = np.percentile(gray, 90)
    dark = gray < white * 0.5
    wh, ww = int(h * 0.30), int(w * 0.30)
    windows = {"tl": (slice(0, wh), slice(0, ww)),
               "tr": (slice(0, wh), slice(w - ww, w)),
               "bl": (slice(h - wh, h), slice(0, ww)),
               "br": (slice(h - wh, h), slice(w - ww, w))}
    centers = {}
    for key, (sy, sx) in windows.items():
        sub = dark[sy, sx]
        lab, n = ndimage.label(sub)
        if not n:
            raise RuntimeError(f"Kein Marker in Ecke {key} gefunden")
        best, best_score = None, -1
        objs = ndimage.find_objects(lab)
        for i, sl in enumerate(objs):
            bh, bw = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
            area = (lab[sl] == i + 1).sum()
            if bh < 6 or bw < 6 or not (0.6 < bh / bw < 1.7):
                continue
            fill = area / (bh * bw)
            if fill < 0.6:
                continue
            if area > best_score:
                best, best_score = i + 1, area
        if best is None:
            raise RuntimeError(f"Kein quadratischer Marker in Ecke {key}")
        cy, cx = ndimage.center_of_mass(lab == best)
        centers[key] = (cx + sx.start, cy + sy.start)
    return centers


def read_pageid(gray, H, layout):
    pid = layout["pageid"]
    val = 0
    for b in range(pid["bits"]):
        x = pid["x"] + b * (pid["box"] + pid["gap"]) + pid["box"] / 2
        y = pid["y"] + pid["box"] / 2
        patch = sample_region(gray, H, x - 0.8, y - 0.8, 1.6, 1.6)
        white = np.percentile(gray, 90)
        if patch.mean() < white * 0.6:
            val |= 1 << b
    return val


# ---------------- Tinte -> Strokes ----------------
def remove_guides(mask, guide_rows):
    """Gedruckte Hilfslinien entfernen: lange dünne horizontale Strukturen,
    aber NUR in schmalen Bändern um die bekannten Linienpositionen — sonst
    würden flache Bogenpartien (oben/unten bei a, o, e …) mitgefressen."""
    work = mask.copy()
    band = np.zeros_like(mask)
    for r in guide_rows:
        r = int(round(r))
        band[max(0, r - 5):r + 6, :] = True
    # horizontale Runs finden: Erosion mit breitem horizontalem Element
    horiz = ndimage.binary_erosion(work, structure=np.ones((1, 35)))
    horiz = ndimage.binary_dilation(horiz, structure=np.ones((3, 41)))
    work &= ~(horiz & band)
    # durch Linienentfernung getrennte Striche vertikal wieder verbinden
    work = ndimage.binary_closing(work, structure=np.ones((7, 1)))
    return work


def skeletonize(img):
    """Zhang-Suen-Skelettierung (bool-Array)."""
    img = img.astype(np.uint8)
    def neighbors(p):
        return [np.roll(np.roll(p, -dy, 0), -dx, 1) for dy, dx in
                [(-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1)]]
    changed = True
    while changed:
        changed = False
        for step in (0, 1):
            n = neighbors(img)
            B = sum(n)
            seq = n + [n[0]]
            A = sum(((seq[i] == 0) & (seq[i + 1] == 1)) for i in range(8))
            if step == 0:
                c3, c4 = n[0] * n[2] * n[4], n[2] * n[4] * n[6]
            else:
                c3, c4 = n[0] * n[2] * n[6], n[0] * n[4] * n[6]
            cond = (img == 1) & (B >= 2) & (B <= 6) & (A == 1) & (c3 == 0) & (c4 == 0)
            if cond.any():
                img[cond] = 0
                changed = True
    return img.astype(bool)


NB8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def skel_neighbors(pts, p):
    """8er-Nachbarn, aber ohne redundante Diagonalkanten: Wenn ein orthogonaler
    Umweg existiert (Pixel-Dreieck an Treppenstufen), zählt die Diagonale nicht —
    sonst werden saubere Linien voller falscher „Kreuzungen" und zerfallen."""
    out = []
    for dy, dx in NB8:
        q = (p[0] + dy, p[1] + dx)
        if q not in pts:
            continue
        if dy and dx and ((p[0] + dy, p[1]) in pts or (p[0], p[1] + dx) in pts):
            continue
        out.append(q)
    return out


def trace_skeleton(skel):
    """Skelett-Pixel zu Polylinien (Liste von [(x,y),...]) verfolgen."""
    pts = set(zip(*np.nonzero(skel)))           # (y,x)
    if not pts:
        return []
    def nbrs(p):
        return skel_neighbors(pts, p)
    degree = {p: len(nbrs(p)) for p in pts}
    used = set()                                 # verbrauchte Kanten (a,b) sortiert
    paths = []

    def walk(start, nxt):
        path = [start, nxt]
        used.add((min(start, nxt), max(start, nxt)))
        cur, prev = nxt, start
        while degree[cur] == 2:
            cand = [q for q in nbrs(cur) if q != prev and (min(cur, q), max(cur, q)) not in used]
            if not cand:
                break
            prev, cur = cur, cand[0]
            used.add((min(prev, cur), max(prev, cur)))
            path.append(cur)
        return path

    # von Endpunkten und Verzweigungen aus
    for p in sorted(pts):
        if degree[p] == 2:
            continue
        for q in nbrs(p):
            if (min(p, q), max(p, q)) not in used:
                paths.append(walk(p, q))
    # Reste: geschlossene Schleifen
    for p in sorted(pts):
        for q in nbrs(p):
            if (min(p, q), max(p, q)) not in used:
                paths.append(walk(p, q))
    return [[(x, y) for y, x in path] for path in paths if len(path) >= 2]


def path_len(p):
    a = np.asarray(p, float)
    return float(np.linalg.norm(np.diff(a, axis=0), axis=1).sum()) if len(p) > 1 else 0.0


def prune_spurs(paths, skel):
    """Kurze „Barthaare" entfernen, die an Kreuzungen hängen (Skelett-Artefakte)."""
    pts = set(zip(*np.nonzero(skel)))
    junctions = {(x, y) for (y, x) in pts if len(skel_neighbors(pts, (y, x))) >= 3}
    out = []
    for p in paths:
        at_junc = (p[0] in junctions) + (p[-1] in junctions)
        # Nur echte Barthaare (ein Ende frei, eines an der Kreuzung) entfernen —
        # kurze Verbindungsstücke ZWISCHEN zwei Kreuzungen müssen bleiben.
        if path_len(p) < 5 and at_junc == 1 and len(paths) > 1:
            continue
        out.append(p)
    return out or paths


def smooth_path(p, passes=2):
    a = np.asarray(p, float)
    for _ in range(passes):
        if len(a) < 5:
            break
        b = a.copy()
        b[1:-1] = (a[:-2] + 2 * a[1:-1] + a[2:]) / 4
        a = b
    return [tuple(q) for q in a]


def join_paths(paths, max_gap=7.0, min_dot=0.25, require_pair=False):
    """Greedy: Pfade verbinden, deren Enden praktisch aufeinanderliegen
    und deren Richtung weiterläuft (glättet Kreuzungen wie bei t oder x).
    require_pair: nur verbinden, wenn sich dort genau zwei Pfadenden treffen
    (Krümmungsbruch in einer Schlinge — keine echte Kreuzung)."""
    paths = [list(p) for p in paths]

    def endpoint_count(pt):
        c = 0
        for p in paths:
            for e in (p[0], p[-1]):
                if np.linalg.norm(np.array(e, float) - pt) <= max_gap / 2 + 1.5:
                    c += 1
        return c
    def direction(p, at_end):
        # Laufrichtung: am Ende auf das Ende zu, am Anfang vom Anfang weg —
        # beides ist seg[-1]-seg[0], dann heißt Fortsetzung dot(di,dj) > 0
        seg = p[-4:] if at_end else p[:4]
        if len(seg) < 2:
            return None
        d = np.array(seg[-1], float) - np.array(seg[0], float)
        n = np.linalg.norm(d)
        return d / n if n else None
    merged = True
    while merged:
        merged = False
        for i in range(len(paths)):
            if merged:
                break
            for j in range(len(paths)):
                if i == j or merged:
                    continue
                for ei, ej, rev_i, rev_j in [(-1, 0, False, False), (-1, -1, False, True),
                                             (0, 0, True, False), (0, -1, True, True)]:
                    a, b = np.array(paths[i][ei], float), np.array(paths[j][ej], float)
                    if np.linalg.norm(a - b) > max_gap:
                        continue
                    di = direction(paths[i][::-1] if rev_i else paths[i], True)
                    dj = direction(paths[j] if not rev_j else paths[j][::-1], False)
                    if di is None or dj is None or np.dot(di, dj) < min_dot:
                        continue
                    if require_pair and endpoint_count((a + b) / 2) != 2:
                        continue
                    pi = paths[i][::-1] if rev_i else paths[i]
                    pj = paths[j][::-1] if rev_j else paths[j]
                    paths[i] = pi + pj
                    del paths[j]
                    merged = True
                    break
    return paths


def rdp(pts, eps):
    """Ramer-Douglas-Peucker."""
    if len(pts) < 3:
        return pts
    p = np.asarray(pts, float)
    a, b = p[0], p[-1]
    ab = b - a
    n = np.linalg.norm(ab)
    d = (np.abs(np.cross(ab, a - p)) / n) if n else np.linalg.norm(p - a, axis=1)
    i = int(np.argmax(d))
    if d[i] > eps:
        return rdp(pts[:i + 1], eps)[:-1] + rdp(pts[i:], eps)
    return [pts[0], pts[-1]]


def cell_to_strokes(patch, cell, units_per_mm):
    """Grauwert-Zellraster -> Strokes in Font-Einheiten (y-up, x ab Schreibbeginn)."""
    patch = ndimage.gaussian_filter(patch, 0.9)
    white = np.percentile(patch, 85)
    mask = patch < white * 0.55
    # Beschriftungszone links ausblenden
    mask[:, :int(cell["x0"] * RES)] = False
    mask = remove_guides(mask, [cell[k] * RES for k in ("cap_y", "xh_y", "base_y", "desc_y")])
    if mask.sum() < MIN_INK:
        return None

    # Runde Mini-Komponenten = Punkte (i-Punkt, Umlaut-Punkte); Rest gemeinsam
    # skelettieren, damit Fragmente (z.B. durch Hilfslinien-Entfernung
    # zerschnittene Striche) über Komponentengrenzen hinweg verbunden werden.
    lab, n = ndimage.label(mask)
    paths = []
    stroke_mask = np.zeros_like(mask)
    for i, sl in enumerate(ndimage.find_objects(lab)):
        comp = lab[sl] == i + 1
        area = int(comp.sum())
        if area < MIN_COMP:
            continue
        bh, bw = comp.shape
        if area <= DOT_MAX and bh <= 13 and bw <= 13:
            cy, cx = ndimage.center_of_mass(comp)
            r = max(1.5, math.sqrt(area) / 3)
            cx += sl[1].start; cy += sl[0].start
            paths.append([(cx - r, cy), (cx + r, cy + 0.5)])
            continue
        stroke_mask[sl] |= comp
    if stroke_mask.any():
        skel = skeletonize(stroke_mask)
        joined = join_paths(prune_spurs(trace_skeleton(skel), skel))
        # 2. Durchgang: Krümmungsbrüche in Schlingen (a, o, e …) schließen
        joined = join_paths(joined, max_gap=7.0, min_dot=-0.4, require_pair=True)
        # 3. Durchgang: direkt anliegende Enden bedingungslos verketten
        # (weniger Stift-Abhebungen, identisches Schriftbild)
        joined = join_paths(joined, max_gap=3.5, min_dot=-1.0)
        # Kreuzungs-Trümmer: was nach dem Verbinden noch winzig ist, fliegt raus
        # (echte Punkte kommen über den DOT_MAX-Zweig, nicht hierher)
        paths.extend(p for p in joined if path_len(p) >= 5)
    paths = [rdp(smooth_path(p), 1.0) for p in paths]
    paths = [p for p in paths if len(p) >= 2]
    if not paths:
        return None
    strokes, min_x, max_x = [], 1e9, 0.0
    for p in paths:
        st = []
        for x, y in p:
            ux = (x / RES - cell["x0"]) * units_per_mm
            uy = (cell["base_y"] - y / RES) * units_per_mm
            st.append([ux, uy])
            min_x = min(min_x, ux)
            max_x = max(max_x, ux)
        strokes.append(st)
    # Linken Leerraum normalisieren: wo im Kästchen geschrieben wurde, ist egal —
    # sonst bekommt jede Glyphe eine zufällige Vorlauf-Lücke eingebacken
    LSB, RSB = 20, 35
    strokes = [[[round(x - min_x + LSB, 1), round(y, 1)] for x, y in st] for st in strokes]
    return {"adv": round(max_x - min_x + LSB + RSB), "strokes": strokes}


# ---------------- Hauptablauf ----------------
def process_image(path, layout, glyphs_var):
    gray = np.asarray(Image.open(path).convert("L"), float)
    if max(gray.shape) > 3500:                  # große Fotos verkleinern
        sc = 3500 / max(gray.shape)
        im = Image.fromarray(gray.astype(np.uint8)).resize(
            (int(gray.shape[1] * sc), int(gray.shape[0] * sc)), Image.LANCZOS)
        gray = np.asarray(im, float)

    centers = find_markers(gray)
    m = layout["marker"]
    half = m["size"] / 2
    mm_pts = [(x + half, y + half) for x, y in m["positions"]]   # TL TR BL BR

    def build(order):
        return homography(mm_pts, [centers[k] for k in order])

    H = build(["tl", "tr", "bl", "br"])
    page = read_pageid(gray, H, layout)
    if not (1 <= page <= 63):                   # evtl. kopfüber gescannt
        H2 = build(["br", "bl", "tr", "tl"])
        page2 = read_pageid(gray, H2, layout)
        if 1 <= page2 <= 63:
            H, page = H2, page2
    if not (1 <= page <= 63):
        raise RuntimeError(f"{path}: Seiten-ID nicht lesbar — Foto zu schräg/unscharf?")

    n_cells = n_filled = 0
    for cell in layout["cells"]:
        if cell["page"] != page - 1:
            continue
        n_cells += 1
        patch = sample_region(gray, H, cell["x"], cell["y"], cell["w"], cell["h"])
        res = cell_to_strokes(patch, cell, layout["units_per_mm"])
        if res:
            glyphs_var.setdefault(cell["char"], []).append(res)
            n_filled += 1
    print(f"{Path(path).name}: Seite {page}, {n_filled}/{n_cells} Kästchen mit Tinte")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("bilder", nargs="+", help="Scans/Fotos der ausgefüllten Vorlage")
    ap.add_argument("--layout", default=str(Path(__file__).parent.parent / "vorlage_layout.json"))
    ap.add_argument("--name", default="Meine Handschrift")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    layout = json.loads(Path(args.layout).read_text())
    glyphs_var = {}
    for img in args.bilder:
        try:
            process_image(img, layout, glyphs_var)
        except RuntimeError as e:
            print(f"FEHLER: {e}", file=sys.stderr)

    if not glyphs_var:
        sys.exit("Keine Zeichen erkannt.")
    glyphs_var[" "] = [{"adv": 350, "strokes": []}]
    font = {"name": args.name, "upem": 1000, "ascent": 750, "descent": -250,
            "capheight": 700, "xheight": 480, "glyphsVar": glyphs_var}
    out = Path(args.out or (Path(args.bilder[0]).parent /
               (args.name.lower().replace(" ", "_") + ".handschrift.json")))
    out.write_text(json.dumps(font, ensure_ascii=False), encoding="utf-8")
    n = sum(len(v) for k, v in glyphs_var.items() if k != " ")
    print(f"→ {out}  ({len(glyphs_var)-1} Zeichen, {n} Varianten)")
    print("In app/handschrift.html über 'Laden …' importieren, prüfen/nachbearbeiten,")
    print("dann 'In der Schreib-App verwenden'.")


if __name__ == "__main__":
    main()
