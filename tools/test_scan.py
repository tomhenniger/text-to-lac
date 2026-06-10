#!/usr/bin/env python3
"""Simulationstest für handschrift_scan.py: rendert die Vorlage, „schreibt"
mit PIL Kunst-Handschrift in einige Kästchen, dreht das Bild leicht
(Scan-Schräglage) und prüft, ob der Importer die Striche korrekt zurückliest.
"""
import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).parent.parent
OUT = Path("/tmp/lac_test")
SCALE = 10  # px pro mm im Testbild


def squiggle(ch, variant, cell):
    """Erzeugt pro Zeichen/Variante unterschiedliche Teststriche (Zell-mm)."""
    x0, base, cap = cell["x0"], cell["base_y"], cell["cap_y"]
    w = 8 + variant  # Schreibbreite variiert pro Variante
    if ch == "a":
        arc = [(x0 + 1 + w * (0.5 - 0.5 * math.cos(t)), base - 3.5 + 2.8 * math.sin(t + variant))
               for t in np.linspace(0.4, 5.9, 14)]
        return [arc, [(x0 + 1 + w, base - 4.6), (x0 + 1.2 + w, base)]]
    if ch == "b":
        return [[(x0 + 1, cap), (x0 + 1.2, base)],
                [(x0 + 1.2, base - 4), (x0 + 5 + variant, base - 5), (x0 + 5, base - 1), (x0 + 1.2, base)]]
    if ch == "i":
        return [[(x0 + 2, base - 4.5), (x0 + 2.2, base)],
                [(x0 + 2, base - 6.4), (x0 + 2.8, base - 6.1)]]     # i-Punkt (realistisch ~0.8mm)
    return [[(x0 + 1, base), (x0 + 2 + w, base - 5 - variant * 0.5)]]


def main():
    # 1) Vorlage frisch erzeugen + Seite 1 rendern
    subprocess.run([sys.executable, str(ROOT / "tools/handschrift_vorlage.py")], check=True)
    layout = json.loads((ROOT / "vorlage_layout.json").read_text())
    subprocess.run(["sips", "-s", "format", "png", "--resampleWidth", str(210 * SCALE),
                    str(ROOT / "vorlage.pdf"), "--out", str(OUT / "scan_raw.png")],
                   check=True, capture_output=True)
    im = Image.open(OUT / "scan_raw.png").convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    bg.alpha_composite(im)
    page = bg.convert("L")

    # 2) „Handschrift" in die Kästchen von a, b, i malen
    d = ImageDraw.Draw(page)
    expected = {}
    for cell in layout["cells"]:
        if cell["page"] != 0 or cell["char"] not in "abi":
            continue
        strokes = squiggle(cell["char"], cell["variant"], cell)
        expected.setdefault(cell["char"], 0)
        expected[cell["char"]] += 1
        for st in strokes:
            pts = [((cell["x"] + x) * SCALE, (cell["y"] + y) * SCALE) for x, y in st]
            d.line(pts, fill=40, width=4, joint="curve")

    # 3) Scan-Artefakte: 1.5° Drehung + leichte Verkleinerung + Rauschen
    rot = page.rotate(1.5, resample=Image.BICUBIC, expand=True, fillcolor=235)
    rot = rot.resize((int(rot.width * 0.85), int(rot.height * 0.85)), Image.LANCZOS)
    arr = np.asarray(rot, float) + np.random.default_rng(7).normal(0, 4, (rot.height, rot.width))
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(OUT / "scan_filled.png")

    # 4) Importer laufen lassen
    r = subprocess.run([sys.executable, str(ROOT / "tools/handschrift_scan.py"),
                        str(OUT / "scan_filled.png"), "--layout", str(ROOT / "vorlage_layout.json"),
                        "--name", "Scan Test", "--out", str(OUT / "scan_test.handschrift.json")],
                       capture_output=True, text=True)
    print(r.stdout, r.stderr)
    if r.returncode:
        sys.exit("Importer fehlgeschlagen")

    # 5) Ergebnis prüfen
    font = json.loads((OUT / "scan_test.handschrift.json").read_text())
    gv = font["glyphsVar"]
    ok = True
    for ch, want in expected.items():
        got = len(gv.get(ch, []))
        status = "OK" if got == want else "FEHLER"
        if got != want:
            ok = False
        nstrokes = [len(v["strokes"]) for v in gv.get(ch, [])]
        print(f"{status}: '{ch}' — {got}/{want} Varianten, Striche je Variante: {nstrokes}")
    extra = [c for c in gv if c not in expected and c != " "]
    if extra:
        ok = False
        print("FEHLER: unerwartete Zeichen erkannt:", extra)
    print("Gesamtergebnis:", "BESTANDEN" if ok else "DURCHGEFALLEN")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
