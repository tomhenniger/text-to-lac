# Handschrift — Pen-Plotter-Tools für Bambu Lab

🇬🇧 **[English version](README.md)** · Live: **https://handschrift.art**


**Handschrift** ist eine Webapp-Suite, die Text und Bilder in `.lac`-Projektdateien für die Bambu Suite umwandelt —
zum Schreiben mit dem Pen Holder des A2L. Zentrale Oberfläche ist das
**Layer-Studio** (`app/studio.html`): eine Photoshop-artige Ebenen-Werkstatt, in
der sich alle Werkzeuge — Text (mit eigener erfasster Handschrift), Bild-Plotter,
3D, QR-Codes und mehr — als frei platzierbare Ebenen kombinieren, ausrichten und
gemeinsam als eine `.lac` exportieren lassen. Die Landing führt direkt hinein. Die
einzelnen Tool-Seiten funktionieren weiterhin eigenständig und dienen dem Studio
zugleich als eingebettete Ebenen-Engines. Kein Server, kein Build — alles läuft
im Browser.

## Benutzung

`index.html` im Browser öffnen (Doppelklick genügt, kein Server nötig) — sie
führt direkt ins **Layer-Studio** (`app/studio.html`; diese Datei lässt sich auch
direkt öffnen). Die einzelnen Tool-Seiten (`app/index.html`, `app/bild.html`, …)
funktionieren ebenfalls weiterhin eigenständig.

Der Text-Schreiber, ob im Studio (als Text-Ebene) oder eigenständig:

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

## Layer-Studio

`app/studio.html` ist die zentrale Oberfläche. Ebenen anlegen für Text, eigene
Handschrift (über die Text-Ebene), Bilder, 3D-Modelle, QR-Codes und die übrigen
Werkzeuge; jede Ebene ist die zugehörige Tool-Seite, eingebettet über `?embed=1`,
die ihre berechneten Striche ins Studio streamt. Ebenen verschieben, skalieren,
drehen und ausrichten (mit Einrasten und Verteilen), pro Ebene den Plotter-Modus
(Stift zeichnen / Schneiden) und die Farbe setzen und dann alles gemeinsam als
eine `.lac` oder als SVG exportieren. Layouts werden als `.handschrift`-Datei
gesichert und automatisch im Browser gespeichert.

**Kurvenauflösung.** Das **Datei**-Menü bietet eine einzige exportweite
Einstellung (Stufen *Niedrig → Maximal*, Standard *Standard*), die die Pfade
jeder Ebene mit einer gemeinsamen Ramer-Douglas-Peucker-Vereinfachung am
Export-Trichter ausdünnt — kleinere `.lac`-Dateien und glattere/gröbere Kurven,
einheitlich über alle Ebenentypen. Sie wirkt identisch auf Live-Vorschau,
Thumbnail, SVG und `.lac`; *Maximal (unverändert)* umgeht sie und liefert die
Original-Striche exakt. Die gewählte Stufe steckt in der `.handschrift`-Datei und
im Autospeicher.

## Eigene Handschrift erfassen

`app/handschrift.html` (oder Button „🖊 Eigene Handschrift erfassen" im
Text-Werkzeug): Jeden Buchstaben mit Maus/Trackpad/Stift auf die Hilfslinien
schreiben und **mehrere Varianten pro Buchstabe** speichern — beim Schreiben
wählt die App pro Vorkommen zufällig eine Variante (zusätzlich zur normalen
Variation). Die grüne gestrichelte Linie bestimmt den Vorlauf (Buchstabenbreite).
Gespeichert wird automatisch im Browser (localStorage); „Als Datei sichern"
exportiert ein `.handschrift.json` als Backup bzw. zum Weitergeben.

**Aus dem Layer-Studio heraus** öffnet der Button die Erfassungsseite in einem
**neuen Tab** (damit die Text-Ebene ihre Identität behält); erfasste Buchstaben
erscheinen dann automatisch im Schrift-Auswähler des Studios, ohne Neuladen.

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

- `app/studio.html` — das Layer-Studio (zentrale Oberfläche: Ebenen, Transform,
  Ausrichten, `.handschrift`-Sicherung/Autospeicher, kombinierter .lac-/SVG-Export,
  Kurvenauflösung)
- `app/index.html` — der Text-Schreiber (Vorschau, Variation, .lac-/SVG-Export;
  zugleich die Text-Ebenen-Engine des Studios über `?embed=1`)
- `app/handschrift.html` — Handschrift-Erfassung (Varianten pro Buchstabe)
- `app/bild.html` — Bild-Plotter (Zeichen-Stile; Bild-Ebenen-Engine des Studios)
- `app/misc.html` — Misc-Tools (QR, SVG-Import, 3D/STL, Spirograph, Labyrinth,
  Funktionsplotter, TSP-Stipple, Audio-Wellenform, …; Misc-Ebenen-Engine)
- `app/embed.js` — Embed-Vertrag (`?embed=1`): blendet die Tool-Chrome aus und
  streamt Striche per postMessage ins Studio
- `app/lac.js` — gemeinsamer .lac-Export (ZIP-Writer, PathObjects, Prozesse) plus
  der gemeinsame Kurvenauflösungs-Trichter (`rdp`/`resampleEps`/`resampleStrokes`)
- `app/scan.js` — Scan-Import im Browser (Port von handschrift_scan.py)
- `app/qrcode.js` — QR-Code-Erzeugung (von misc.html genutzt)
- `app/vendor/three.min.js` — Three.js (vendored, für das 3D/STL-Misc-Tool)
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
