#!/usr/bin/env python3
"""Erzeugt eine druckbare PDF-Vorlage zum Erfassen der eigenen Handschrift.

Pro Zeichen mehrere Kästchen (= Varianten) mit Hilfslinien (Großbuchstaben-
Höhe, x-Höhe, Grundlinie, Unterlänge). Eckmarker + Seiten-ID-Boxen erlauben
dem Importer (handschrift_scan.py) die automatische Entzerrung.

Nutzung:
    python3 handschrift_vorlage.py [--varianten 3] [--charset "abc..."] [--out vorlage]

Erzeugt vorlage.pdf + vorlage_layout.json (wird vom Importer gebraucht).
"""
import argparse
import json
from pathlib import Path

# ---------- Layout-Konstanten (mm) ----------
PAGE_W, PAGE_H = 210.0, 297.0
MARGIN = 12.0
MARKER = 6.0                  # Kantenlänge der Eck-Quadrate
PAGEID_Y, PAGEID_BOX, PAGEID_GAP, PAGEID_BITS = MARGIN + 1.5, 3.0, 2.0, 6
HEADER_H = 14.0
CELL_W, CELL_H = 24.0, 16.0
LABEL_W = 4.0                 # Zone links im Kästchen für das gedruckte Zeichen
CAP_MM = 7.0                  # Schreibhöhe der Großbuchstaben in mm
# Font-Einheiten: 700 Einheiten = CAP_MM  ->  100 Einheiten pro mm
CAP_OFF = 3.0                 # Abstand Zellrand oben -> Großbuchstaben-Linie
BASE_OFF = CAP_OFF + CAP_MM   # Zellrand oben -> Grundlinie
XH_OFF = BASE_OFF - CAP_MM * 480 / 700
DESC_OFF = BASE_OFF + CAP_MM * 250 / 700

DEFAULT_CHARSET = ("abcdefghijklmnopqrstuvwxyz"
                   "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                   "0123456789äöüÄÖÜß.,;:!?-'()\"@€&+=/%")

MM2PT = 72 / 25.4


def esc(s):
    return s.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")


class PDF:
    """Minimaler PDF-Writer (Linien, Rechtecke, Helvetica-Text)."""

    def __init__(self):
        self.pages = []

    def page(self):
        self.pages.append([])
        return self.pages[-1]

    @staticmethod
    def _y(mm):  # PDF-Ursprung ist unten links, wir rechnen von oben
        return (PAGE_H - mm) * MM2PT

    def rect(self, c, x, y, w, h, gray=0.0):
        c.append(f"{gray:.2f} g {x*MM2PT:.2f} {self._y(y+h):.2f} {w*MM2PT:.2f} {h*MM2PT:.2f} re f")

    def line(self, c, x1, y1, x2, y2, gray=0.8, width=0.25, dash=None):
        d = f"[{dash*MM2PT:.1f} {dash*MM2PT:.1f}] 0 d " if dash else "[] 0 d "
        c.append(f"{gray:.2f} G {width*MM2PT:.2f} w {d}"
                 f"{x1*MM2PT:.2f} {self._y(y1):.2f} m {x2*MM2PT:.2f} {self._y(y2):.2f} l S")

    def text(self, c, x, y, s, size=8, gray=0.55):
        c.append(f"BT /F1 {size} Tf {gray:.2f} g {x*MM2PT:.2f} {self._y(y):.2f} Td ({esc(s)}) Tj ET")

    def build(self):
        objs = []  # (num, bytes)
        n_pages = len(self.pages)
        font_num = 3 + 2 * n_pages
        kids = " ".join(f"{3+2*i} 0 R" for i in range(n_pages))
        objs.append((1, f"<< /Type /Catalog /Pages 2 0 R >>".encode()))
        objs.append((2, f"<< /Type /Pages /Kids [{kids}] /Count {n_pages} >>".encode()))
        for i, content in enumerate(self.pages):
            stream = "\n".join(content).encode("cp1252")
            objs.append((3 + 2 * i,
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_W*MM2PT:.2f} {PAGE_H*MM2PT:.2f}] "
                f"/Resources << /Font << /F1 {font_num} 0 R >> >> /Contents {4+2*i} 0 R >>".encode()))
            objs.append((4 + 2 * i,
                b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream"))
        objs.append((font_num,
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"))

        out = bytearray(b"%PDF-1.4\n")
        offsets = {}
        for num, body in objs:
            offsets[num] = len(out)
            out += f"{num} 0 obj\n".encode() + body + b"\nendobj\n"
        xref = len(out)
        count = len(objs) + 1
        out += f"xref\n0 {count}\n0000000000 65535 f \n".encode()
        for num in range(1, count):
            out += f"{offsets[num]:010d} 00000 n \n".encode()
        out += (f"trailer\n<< /Size {count} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF").encode()
        return bytes(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--varianten", type=int, default=3, help="Kästchen pro Zeichen")
    ap.add_argument("--charset", default=DEFAULT_CHARSET)
    ap.add_argument("--out", default=str(Path(__file__).parent.parent / "vorlage"))
    args = ap.parse_args()

    cols = int((PAGE_W - 2 * MARGIN) // CELL_W)
    rows = int((PAGE_H - MARGIN - HEADER_H - MARGIN - MARKER) // CELL_H)
    grid_x = MARGIN
    grid_y = MARGIN + HEADER_H

    # Zellen über Seiten verteilen: Zeichen für Zeichen, Varianten nebeneinander
    cells = []
    slot = 0
    per_page = cols * rows
    for ch in args.charset:
        for v in range(args.varianten):
            page, idx = divmod(slot, per_page)
            r, c = divmod(idx, cols)
            cells.append({
                "page": page, "char": ch, "variant": v,
                "x": grid_x + c * CELL_W, "y": grid_y + r * CELL_H,
                "w": CELL_W, "h": CELL_H,
                "x0": LABEL_W,                       # Schreibbeginn (relativ zur Zelle)
                "cap_y": CAP_OFF, "xh_y": XH_OFF, "base_y": BASE_OFF, "desc_y": DESC_OFF,
            })
            slot += 1
    n_pages = cells[-1]["page"] + 1

    marker_pos = [
        (MARGIN, MARGIN), (PAGE_W - MARGIN - MARKER, MARGIN),
        (MARGIN, PAGE_H - MARGIN - MARKER), (PAGE_W - MARGIN - MARKER, PAGE_H - MARGIN - MARKER),
    ]

    pdf = PDF()
    for p in range(n_pages):
        c = pdf.page()
        for mx, my in marker_pos:
            pdf.rect(c, mx, my, MARKER, MARKER, 0.0)
        # Seiten-ID als Bit-Boxen (gefüllt = 1), LSB links
        idx_x = MARGIN + MARKER + 4
        for b in range(PAGEID_BITS):
            x = idx_x + b * (PAGEID_BOX + PAGEID_GAP)
            filled = (p + 1) >> b & 1
            pdf.rect(c, x, PAGEID_Y, PAGEID_BOX, PAGEID_BOX, 0.0 if filled else 0.92)
        pdf.text(c, idx_x + PAGEID_BITS * (PAGEID_BOX + PAGEID_GAP) + 3, PAGEID_Y + PAGEID_BOX,
                 f"Handschrift-Vorlage  ·  Seite {p+1}/{n_pages}  ·  ohne Skalierung drucken "
                 f"(100%, tatsächliche Größe)", 8, 0.3)
        pdf.text(c, idx_x, PAGEID_Y + PAGEID_BOX + 5.5,
                 "Mit dunklem Stift schreiben. Auf die Grundlinie achten — kleine Zeichen bis zur "
                 "mittleren Linie, große bis zur oberen.", 7, 0.45)

        for cell in cells:
            if cell["page"] != p:
                continue
            x, y = cell["x"], cell["y"]
            pdf.line(c, x, y, x, y + CELL_H, 0.85, 0.2)              # Zellgrenze links
            pdf.line(c, x + CELL_W, y, x + CELL_W, y + CELL_H, 0.85, 0.2)
            pdf.line(c, x, y, x + CELL_W, y, 0.85, 0.2)
            pdf.line(c, x, y + CELL_H, x + CELL_W, y + CELL_H, 0.85, 0.2)
            wx = x + LABEL_W
            pdf.line(c, wx, y + cell["cap_y"], x + CELL_W - 1, y + cell["cap_y"], 0.8, 0.2, dash=1.0)
            pdf.line(c, wx, y + cell["xh_y"], x + CELL_W - 1, y + cell["xh_y"], 0.8, 0.2, dash=1.0)
            pdf.line(c, wx, y + cell["base_y"], x + CELL_W - 1, y + cell["base_y"], 0.65, 0.3)
            pdf.line(c, wx, y + cell["desc_y"], x + CELL_W - 1, y + cell["desc_y"], 0.88, 0.2, dash=1.0)
            try:
                cell["char"].encode("cp1252")
                pdf.text(c, x + 0.8, y + cell["base_y"], cell["char"], 9, 0.6)
            except UnicodeEncodeError:
                pass

    out = Path(args.out)
    out.with_suffix(".pdf").write_bytes(pdf.build())
    layout = {
        "page_w": PAGE_W, "page_h": PAGE_H,
        "marker": {"size": MARKER, "positions": marker_pos},
        "pageid": {"x": MARGIN + MARKER + 4, "y": PAGEID_Y, "box": PAGEID_BOX,
                   "gap": PAGEID_GAP, "bits": PAGEID_BITS},
        "units_per_mm": 700 / CAP_MM,
        "space_adv": 280,
        "cells": cells,
    }
    out.with_suffix(".pdf").with_name(out.name + "_layout.json").write_text(
        json.dumps(layout, ensure_ascii=False), encoding="utf-8")
    print(f"→ {out}.pdf  ({n_pages} Seiten, {len(args.charset)} Zeichen × {args.varianten} Varianten)")
    print(f"→ {out}_layout.json (für handschrift_scan.py)")


if __name__ == "__main__":
    main()
