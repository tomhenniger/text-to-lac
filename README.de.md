# Handschrift — Pen-Plotter-Tools für Bambu Lab

🇬🇧 **[English version](README.md)** · Live: **https://handschrift.art**


**Handschrift** ist eine Webapp-Suite, die Text und Bilder in `.lac`-Projektdateien für die Bambu Suite umwandelt —
zum Schreiben mit dem Pen Holder des A2L. Mit Live-Vorschau, frei wählbaren
Schriften und Handschrift-Variation (kein Buchstabe gleicht dem anderen).

## Benutzung

`app/index.html` im Browser öffnen (Doppelklick genügt, kein Server nötig).

1. **Text** eingeben (mehrzeilig, Umlaute und ß funktionieren)
2. **Schrift** wählen — 18 eingebaute Ein-Linien-Fonts (Hershey/EMS, ideal für
   Stifte), die **eigene Handschrift** (siehe unten) oder TTF/OTF
   (wird als Umriss gezeichnet, braucht Internet)
3. **Handschrift-Variation** einstellen: Drehung, Größe, Grundlinie, Abstand,
   Neigung und Linien-Zittern streuen pro Buchstabe (deterministisch über Seed,
   „Neu würfeln" erzeugt eine neue Variante)
4. **Positionieren**: Zeile ziehen = Zeile verschieben, Shift+Ziehen = ganzer
   Text, Mausrad = Zoom
5. **Als .lac exportieren** → Datei in der Bambu Suite öffnen. Der Prozess
   „Stift zeichnen" (KCPenDraw) und das Material „Generic 80g Printer Paper"
   sind bereits zugewiesen; Material lässt sich in der Suite einfach ändern.

## Eigene Handschrift erfassen

`app/handschrift.html` (oder Button „🖊 Eigene Handschrift erfassen" in der App):
Jeden Buchstaben mit Maus/Trackpad/Stift auf die Hilfslinien schreiben und
**mehrere Varianten pro Buchstabe** speichern — beim Schreiben wählt die App
pro Vorkommen zufällig eine Variante (zusätzlich zur normalen Variation).
Die grüne gestrichelte Linie bestimmt den Vorlauf (Buchstabenbreite).
Gespeichert wird automatisch im Browser (localStorage); „Als Datei sichern"
exportiert ein `.handschrift.json` als Backup bzw. zum Weitergeben.

## Handschrift per Papier-Vorlage erfassen (PDF → Stift → Scan)

Bequemer als Maus/Trackpad: die Vorlage drucken und mit echtem Stift ausfüllen.

Die Vorlage (`vorlage.pdf`, in der Erfassungsseite verlinkt) drucken
(100 %, tatsächliche Größe), mit dunklem Stift ausfüllen, abfotografieren
oder scannen — und die Bilder direkt in `app/handschrift.html` über
**„📷 Ausgefüllte Scans einlesen"** importieren. Die komplette Bildverarbeitung
läuft im Browser (`app/scan.js`); erkannte Buchstaben landen als Varianten in
der aktuellen Schrift, wo sich jede Glyphe prüfen und nachbessern lässt.

Alternativ gibt es denselben Importer als CLI:

```bash
python3 tools/handschrift_vorlage.py --varianten 3   # erzeugt vorlage.pdf neu
python3 tools/handschrift_scan.py scan1.jpg scan2.jpg --name "Meine Handschrift"
```

Die Eckmarker auf der Vorlage entzerren
Schräglage, Perspektive und Druck-Skalierung automatisch; die Seiten-ID-Boxen
erkennen, welche Seite fotografiert wurde (Reihenfolge egal). Leere Kästchen
werden übersprungen. Die Tinte wird auf ihre Mittellinie skelettiert —
der Stift fährt also echte Schreiblinien, keine Umrisse.

## Bild-Plotter

`app/bild.html`: wandelt ein Foto/Bild in Stift-Zeichenpfade um. Sechs Stile:
Parallele Linien, Kreuzschraffur, Wellenlinien (Squiggle), Spirale, ASCII-Art
(gezeichnet mit Ein-Linien-Fonts oder der eigenen Handschrift) und Konturen
(Kantenerkennung). Mit Helligkeit/Kontrast/Invertieren, Live-Vorschau und
.lac-/SVG-Export wie im Text-Schreiber.

## Projektstruktur

- `app/index.html` — die komplette App (Vorschau, Variation, .lac-/SVG-Export)
- `app/handschrift.html` — Handschrift-Erfassung (Varianten pro Buchstabe)
- `app/bild.html` — Bild-Plotter (sechs Zeichen-Stile)
- `app/lac.js` — gemeinsamer .lac-Export (ZIP-Writer, PathObjects, Prozesse)
- `app/scan.js` — Scan-Import im Browser (Port von handschrift_scan.py)
- `app/ui.js` — Dark Mode, Onboarding-Touren, Sprach-Umschaltung (DE/EN)
- `app/fonts.js` — generierte Fontdaten (nicht von Hand editieren)
- `app/configs.js` — generierte Maschinen-/Material-/Prozess-Configs (A2L)
- `tools/convert_fonts.py` — SVG-Fonts → `fonts.js`
- `tools/build_configs.py` — Suite-Presets → `configs.js`
- `tools/handschrift_vorlage.py` — druckbare PDF-Vorlage + Layout-Datei
- `tools/handschrift_scan.py` — Scan → Mittellinien-Strokes → `.handschrift.json`
- `tools/test_export.mjs` — End-to-End-Test (Playwright): Vorschau + Export
- `tools/test_handwriting.mjs` / `test_scan.py` / `test_scan_import.mjs` — Tests
  für Handschrift-Erfassung und Scan-Pipeline
- `tools/svg_fonts/` — Quell-Fonts (Hershey/EMS, SIL OFL, aus techninja/hersheytextjs)

## .lac-Format (Kurzfassung, reverse-engineered)

Eine `.lac` ist ein ZIP (OPC) mit:

- `2D/2dmodel.json` — `canvas_list` mit `obj_list` (Objekte) und `components`
  (Platzierung als Affine `"a b c d tx ty"`). Vektorpfade sind `PathObject`s
  mit `path_data` (`M x y L x y …`, absolute Koordinaten in mm, y nach unten,
  Ursprung = Arbeitsbereich oben links; mehrere `M` = mehrere Teilpfade).
- `Metadata2D/project_settings.json` — `object_settings` (`process_type`, z.B.
  `KCPenDraw`), `making_batch_list` (Material + Plattenplatzierung,
  `process_category: 4` = DRAW). **Darf nicht leer sein**, sonst verweigert
  die Suite das Laden.
- `Metadata2D/*.config` — geflachte Maschinen-/Material-/Prozess-Presets.
  Die Maschinen-Config muss die von der Suite angereicherte Version sein
  (Presets auf Platte sind unvollständig); `build_configs.py` zieht sie aus
  dem neuesten Suite-Autosave-Projekt.

## Neu generieren

```bash
python3 tools/convert_fonts.py    # Fonts neu konvertieren
python3 tools/build_configs.py   # Configs neu aus Suite-Presets ziehen
node tools/test_export.mjs       # E2E-Test (Screenshot + .lac nach /tmp/lac_test)
```

Getestet mit Bambu Suite 1.3 (FileVersion 01.03.00.00) auf macOS, Juni 2026.
