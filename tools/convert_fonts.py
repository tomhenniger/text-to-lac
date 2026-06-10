#!/usr/bin/env python3
"""Konvertiert Single-Line-SVG-Fonts (Hershey/EMS) in kompaktes JS-Format.

Output: ../app/fonts.js  —  window.SL_FONTS = {fontId: {name, upem, ascent,
descent, xheight, glyphs: {char: {adv, strokes: [[[x,y],...], ...]}}}}
Koordinaten bleiben in Font-Units, y-up (Renderer flippt).
Fehlende Umlaute (äöüÄÖÜ) werden aus Basisglyphe + Punkten synthetisiert.
"""
import json
import math
import re
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

SVG_NS = "{http://www.w3.org/2000/svg}"
CURVE_SEGS = 10

TOKEN_RE = re.compile(r"([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:[eE][-+]?\d+)?)")


def parse_path(d):
    """SVG-Pfad -> Liste von Polylinien (Strokes), y unverändert."""
    tokens = TOKEN_RE.findall(d)
    items = [(t[0] or None, t[1] or None) for t in tokens]
    strokes = []
    cur = []
    pos = (0.0, 0.0)
    start = (0.0, 0.0)
    prev_cubic_ctrl = None
    prev_quad_ctrl = None
    i = 0
    cmd = None

    def nums(n):
        nonlocal i
        vals = []
        while len(vals) < n:
            c, v = items[i]
            if c is not None:
                raise ValueError(f"Zahl erwartet, Befehl {c} gefunden")
            vals.append(float(v))
            i += 1
        return vals

    def flush():
        nonlocal cur
        if len(cur) >= 2:
            strokes.append(cur)
        cur = []

    def line_to(p):
        nonlocal pos
        if not cur:
            cur.append(list(pos))
        cur.append(list(p))
        pos = p

    def cubic_to(c1, c2, p):
        nonlocal pos, prev_cubic_ctrl
        if not cur:
            cur.append(list(pos))
        x0, y0 = pos
        for k in range(1, CURVE_SEGS + 1):
            t = k / CURVE_SEGS
            mt = 1 - t
            x = mt**3 * x0 + 3 * mt**2 * t * c1[0] + 3 * mt * t**2 * c2[0] + t**3 * p[0]
            y = mt**3 * y0 + 3 * mt**2 * t * c1[1] + 3 * mt * t**2 * c2[1] + t**3 * p[1]
            cur.append([x, y])
        pos = p
        prev_cubic_ctrl = c2

    def quad_to(c1, p):
        # Quadratisch -> kubisch
        x0, y0 = pos
        cc1 = (x0 + 2 / 3 * (c1[0] - x0), y0 + 2 / 3 * (c1[1] - y0))
        cc2 = (p[0] + 2 / 3 * (c1[0] - p[0]), p[1] + 2 / 3 * (c1[1] - p[1]))
        cubic_to(cc1, cc2, p)

    while i < len(items):
        c, v = items[i]
        if c is not None:
            cmd = c
            i += 1
        elif cmd is None:
            raise ValueError("Pfad beginnt ohne Befehl")
        rel = cmd.islower()
        C = cmd.upper()
        px, py = pos
        new_cubic = None
        new_quad = None
        if C == "M":
            x, y = nums(2)
            if rel:
                x += px; y += py
            flush()
            pos = (x, y)
            start = pos
            cmd = "l" if rel else "L"
        elif C == "L":
            x, y = nums(2)
            if rel:
                x += px; y += py
            line_to((x, y))
        elif C == "H":
            (x,) = nums(1)
            if rel:
                x += px
            line_to((x, py))
        elif C == "V":
            (y,) = nums(1)
            if rel:
                y += py
            line_to((px, y))
        elif C == "C":
            x1, y1, x2, y2, x, y = nums(6)
            if rel:
                x1 += px; y1 += py; x2 += px; y2 += py; x += px; y += py
            cubic_to((x1, y1), (x2, y2), (x, y))
            new_cubic = (x2, y2)
        elif C == "S":
            x2, y2, x, y = nums(4)
            if rel:
                x2 += px; y2 += py; x += px; y += py
            if prev_cubic_ctrl:
                x1, y1 = 2 * px - prev_cubic_ctrl[0], 2 * py - prev_cubic_ctrl[1]
            else:
                x1, y1 = px, py
            cubic_to((x1, y1), (x2, y2), (x, y))
            new_cubic = (x2, y2)
        elif C == "Q":
            x1, y1, x, y = nums(4)
            if rel:
                x1 += px; y1 += py; x += px; y += py
            quad_to((x1, y1), (x, y))
            new_quad = (x1, y1)
        elif C == "T":
            x, y = nums(2)
            if rel:
                x += px; y += py
            if prev_quad_ctrl:
                x1, y1 = 2 * px - prev_quad_ctrl[0], 2 * py - prev_quad_ctrl[1]
            else:
                x1, y1 = px, py
            quad_to((x1, y1), (x, y))
            new_quad = (x1, y1)
        elif C == "A":
            rx, ry, rot, laf, sf, x, y = nums(7)
            if rel:
                x += px; y += py
            # Bogen grob sampeln (in diesen Fonts praktisch nicht vorhanden)
            for pt in sample_arc(pos, (rx, ry), rot, laf, sf, (x, y)):
                line_to(pt)
        elif C == "Z":
            if cur:
                line_to(start)
        prev_cubic_ctrl = new_cubic
        prev_quad_ctrl = new_quad
    flush()
    return strokes


def sample_arc(p0, r, rot_deg, laf, sf, p1, segs=16):
    """Elliptischen Bogen als Punktliste sampeln (SVG F.6.5)."""
    rx, ry = abs(r[0]), abs(r[1])
    if rx == 0 or ry == 0:
        return [p1]
    phi = math.radians(rot_deg)
    cosp, sinp = math.cos(phi), math.sin(phi)
    dx, dy = (p0[0] - p1[0]) / 2, (p0[1] - p1[1]) / 2
    x1p = cosp * dx + sinp * dy
    y1p = -sinp * dx + cosp * dy
    lam = x1p**2 / rx**2 + y1p**2 / ry**2
    if lam > 1:
        s = math.sqrt(lam)
        rx *= s; ry *= s
    num = rx**2 * ry**2 - rx**2 * y1p**2 - ry**2 * x1p**2
    den = rx**2 * y1p**2 + ry**2 * x1p**2
    co = math.sqrt(max(0, num / den)) if den else 0
    if laf == sf:
        co = -co
    cxp = co * rx * y1p / ry
    cyp = -co * ry * x1p / rx
    cx = cosp * cxp - sinp * cyp + (p0[0] + p1[0]) / 2
    cy = sinp * cxp + cosp * cyp + (p0[1] + p1[1]) / 2

    def ang(ux, uy, vx, vy):
        d = math.hypot(ux, uy) * math.hypot(vx, vy)
        c = max(-1, min(1, (ux * vx + uy * vy) / d))
        a = math.acos(c)
        return -a if ux * vy - uy * vx < 0 else a

    th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
    if not sf and dth > 0:
        dth -= 2 * math.pi
    elif sf and dth < 0:
        dth += 2 * math.pi
    pts = []
    for k in range(1, segs + 1):
        th = th1 + dth * k / segs
        x = cx + rx * math.cos(th) * cosp - ry * math.sin(th) * sinp
        y = cy + rx * math.cos(th) * sinp + ry * math.sin(th) * cosp
        pts.append((x, y))
    return pts


def round_strokes(strokes, nd=1):
    return [[[round(x, nd), round(y, nd)] for x, y in s] for s in strokes]


def glyph_bounds(strokes):
    xs = [p[0] for s in strokes for p in s]
    ys = [p[1] for s in strokes for p in s]
    if not xs:
        return None
    return min(xs), min(ys), max(xs), max(ys)


def synth_umlaut(base, adv, xheight, upem, capital):
    """Basisglyphe + zwei Punkte (kurze Striche) darüber."""
    strokes = [list(map(list, s)) for s in base]
    b = glyph_bounds(strokes)
    top = b[3] if b else xheight
    y = max(top, xheight) + upem * (0.06 if capital else 0.10)
    if capital:
        y = top + upem * 0.07
    cx = adv / 2
    off = max(adv * 0.16, upem * 0.045)
    dot = upem * 0.012
    for dx in (-off, off):
        strokes.append([[cx + dx - dot, y], [cx + dx + dot, y + dot]])
    return strokes


def convert(svg_path):
    tree = ET.parse(svg_path)
    root = tree.getroot()
    font = root.find(f".//{SVG_NS}font")
    face = root.find(f".//{SVG_NS}font-face")
    upem = float(face.get("units-per-em", 1000))
    ascent = float(face.get("ascent", upem * 0.8))
    descent = float(face.get("descent", -upem * 0.2))
    xheight = float(face.get("x-height", upem * 0.5))
    cap = float(face.get("cap-height", upem * 0.7))
    default_adv = float(font.get("horiz-adv-x", upem * 0.5))
    missing = font.find(f"{SVG_NS}missing-glyph")
    glyphs = {}
    for g in font.findall(f"{SVG_NS}glyph"):
        uni = g.get("unicode")
        if uni is None or len(uni) != 1:
            continue
        adv = float(g.get("horiz-adv-x", default_adv))
        d = g.get("d")
        strokes = round_strokes(parse_path(d)) if d else []
        glyphs[uni] = {"adv": round(adv, 1), "strokes": strokes}

    # Umlaute synthetisieren falls nicht vorhanden
    for um, base_ch, capital in [("ä", "a", False), ("ö", "o", False), ("ü", "u", False),
                                 ("Ä", "A", True), ("Ö", "O", True), ("Ü", "Ü", True)]:
        pass
    for um, base_ch, capital in [("ä", "a", False), ("ö", "o", False), ("ü", "u", False),
                                 ("Ä", "A", True), ("Ö", "O", True), ("Ü", "U", True)]:
        if um not in glyphs and base_ch in glyphs and glyphs[base_ch]["strokes"]:
            b = glyphs[base_ch]
            glyphs[um] = {
                "adv": b["adv"],
                "strokes": round_strokes(synth_umlaut(b["strokes"], b["adv"], xheight, upem, capital)),
            }
    return {
        "upem": upem, "ascent": ascent, "descent": descent,
        "xheight": xheight, "capheight": cap,
        "glyphs": glyphs,
    }


NICE_NAMES = {
    "EMSAllure": "EMS Allure (Schreibschrift)",
    "EMSElfin": "EMS Elfin (verspielt)",
    "EMSFelix": "EMS Felix (locker)",
    "EMSNixish": "EMS Nixish",
    "EMSNixishItalic": "EMS Nixish Kursiv",
    "EMSOsmotron": "EMS Osmotron (Retro)",
    "EMSReadability": "EMS Readability (klar)",
    "EMSReadabilityItalic": "EMS Readability Kursiv",
    "EMSTech": "EMS Tech",
    "HersheyGothEnglish": "Hershey Gotisch",
    "HersheySans1": "Hershey Sans dünn",
    "HersheySansMed": "Hershey Sans",
    "HersheyScript1": "Hershey Schreibschrift dünn",
    "HersheyScriptMed": "Hershey Schreibschrift",
    "HersheySerifBold": "Hershey Serif Fett",
    "HersheySerifBoldItalic": "Hershey Serif Fett-Kursiv",
    "HersheySerifMed": "Hershey Serif",
    "HersheySerifMedItalic": "Hershey Serif Kursiv",
}


def main():
    src = Path(__file__).parent / "svg_fonts"
    out_dir = Path(__file__).parent.parent / "app"
    out_dir.mkdir(exist_ok=True)
    fonts = {}
    for f in sorted(src.glob("*.svg")):
        fid = f.stem
        data = convert(f)
        data["name"] = NICE_NAMES.get(fid, fid)
        n = len(data["glyphs"])
        uml = "".join(c for c in "äöüÄÖÜß" if c in data["glyphs"])
        print(f"{fid:28s} {n:4d} Glyphen, Umlaute: {uml or '—'}")
        fonts[fid] = data
    out = out_dir / "fonts.js"
    js = "// generiert von tools/convert_fonts.py — nicht von Hand editieren\nwindow.SL_FONTS = " + json.dumps(
        fonts, ensure_ascii=False, separators=(",", ":")) + ";\n"
    out.write_text(js, encoding="utf-8")
    print(f"\n→ {out}  ({out.stat().st_size//1024} KB)")


if __name__ == "__main__":
    main()
