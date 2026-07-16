# Handschrift — Pen-Plotter-Tools für Bambu Lab

🇬🇧 **[English version](README.md)** · Live: **https://handschrift.art**


**Handschrift** ist eine Browser-App, die Text und Bilder in
`.lac`-Projektdateien für die Bambu Suite umwandelt — zum Zeichnen mit dem Pen
Holder des A2L/H2D. Es ist ein einziges **Layer Studio**: Text und Bilder liegen
als eigenständige Ebenen auf einer Matte, mit Live-Vorschau, frei wählbaren
Ein-Linien-Schriften, Handschrift-Variation (kein Buchstabe gleicht dem anderen)
und deiner eigenen erfassten Handschrift. Kein Server, kein Build — alles läuft
im Browser.

## Benutzung

`app/index.html` im Browser öffnen (Doppelklick genügt, kein Server nötig) —
oder die oben verlinkte Live-Version. Das Studio startet mit einer Text-Ebene;
weitere Text- und Bild-Ebenen kommen nach Bedarf dazu.

1. **Text** in die aktive Text-Ebene eingeben (mehrzeilig, Umlaute und ß
   funktionieren)
2. **Schrift** wählen — 18 eingebaute Ein-Linien-Fonts (Hershey/EMS, ideal für
   Stifte), die **eigene Handschrift** (siehe unten) oder TTF/OTF (wird als
   Umriss gezeichnet, braucht Internet)
3. **Handschrift-Variation** einstellen: Drehung, Größe, Grundlinie, Abstand,
   Neigung und Linien-Zittern streuen pro Buchstabe (deterministisch über einen
   Seed pro Ebene, „Neu würfeln" erzeugt eine neue Variante)
4. **Positionieren**: einzelne Buchstaben ziehen, Buchstabe anklicken blättert
   seine erfassten Varianten, Zeile oder ganze Ebene ziehen, andere Ebene
   anklicken wählt sie aus und verschiebt sie, Mausrad = Zoom
5. **Kurvenauflösung** wählen (siehe unten) und **als .lac exportieren** →
   Datei in der Bambu Suite öffnen. Der Prozess „Stift zeichnen" (KCPenDraw)
   und das Material „Generic 80g Printer Paper" sind bereits zugewiesen;
   Material lässt sich in der Suite einfach ändern.

## Ebenen

Das Studio behandelt alles als Ebenen auf einer Matte. Über das
**Ebenen-Panel** oben in der Sidebar legst du Ebenen an (**+ Text**,
**+ Bild**), wählst sie aus, benennst sie um (Doppelklick), blendest sie
ein/aus, verschiebst sie in der Reihenfolge (↑/↓), duplizierst, sperrst und
löschst sie. Die Eigenschaften darunter sind kontextabhängig zur ausgewählten
Ebene — Text / Schrift / Handschrift-Variation bei Text-Ebenen, Bild / Stil bei
Bild-Ebenen. Beim Export ist die Standard-Aufteilung **ein Objekt pro Ebene**
(außerdem „alles als ein Objekt" bzw. pro Zeile / pro Buchstabe bei
Text-Ebenen). `.lac`, SVG und Thumbnail berücksichtigen jede sichtbare Ebene.

## Eigene Handschrift erfassen

Im Schrift-Bereich einer Text-Ebene auf **„Eigene Handschrift erfassen …"**
klicken (oder `app/index.html?panel=capture` öffnen). Das öffnet das
Erfassungs-Modal: jeden Buchstaben mit Maus/Trackpad/Stift auf die Hilfslinien
schreiben und **mehrere Varianten pro Buchstabe** speichern — beim Schreiben
wählt die App pro Vorkommen zufällig eine Variante (zusätzlich zur normalen
Variation). Die grüne gestrichelte Linie bestimmt den Vorlauf
(Buchstabenbreite). **„Übernehmen & schließen"** speichert die Schrift und wählt
sie in der aufrufenden Text-Ebene aus. Gespeichert wird automatisch im Browser
(localStorage, Schlüssel `hw_fonts`); „Als Datei sichern" exportiert ein
`.handschrift.json` als Backup bzw. zum Weitergeben.

## Handschrift per Papier-Vorlage erfassen (PDF → Stift → Scan)

Bequemer als Maus/Trackpad: die Vorlage drucken und mit echtem Stift ausfüllen.

Die Vorlage (`vorlage.pdf`, im Erfassungs-Modal verlinkt) drucken (100 %,
tatsächliche Größe), mit dunklem Stift ausfüllen, abfotografieren oder scannen —
und die Bilder direkt im Modal über **„Ausgefüllte Scans einlesen"**
importieren. Die komplette Bildverarbeitung läuft im Browser (`app/scan.js`);
erkannte Buchstaben landen als Varianten in der aktuellen Schrift, wo sich jede
Glyphe prüfen und nachbessern lässt. (Die Kurvenauflösung wirkt auf neu
gescannte Glyphen; bereits gespeicherte Varianten sind gebackene Assets.)

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

## Bild-Ebenen

Eine **Bild-Ebene** anlegen (+ Bild, oder `app/index.html?layer=image`) und ein
Foto/Bild laden, um es in Stift-Zeichenpfade umzuwandeln. Sechs Stile:
Parallele Linien, Kreuzschraffur, Wellenlinien (Squiggle), Spirale, ASCII-Art
(gezeichnet mit Ein-Linien-Fonts oder der eigenen Handschrift) und Konturen
(Kantenerkennung). Mit Helligkeit/Kontrast/Invertieren und allen
stilspezifischen Reglern. Bild-Ebenen liegen auf derselben Matte wie
Text-Ebenen, lassen sich per Maus verschieben und werden nach .lac/SVG
mitexportiert.

## Kurvenauflösung

Ein einziger projektweiter **Kurvenauflösungs-Regler** im Export-Bereich (fünf
Stufen: Grob · Reduziert · Standard · Fein · Sehr fein) steuert, wie fein Kurven
in Punkte aufgelöst werden. Er wirkt live auf Vorschau, Punktzahl in der
Statuszeile, `.lac` und SVG (echtes WYSIWYG). Er ersetzt zentral, was früher pro
Tool fest verdrahtet war: TTF-Bezier-Auflösung, die Unterteilung des
Linien-Zitterns, die Abtast-Schrittweite jedes Bild-Stils und die Glättung neu
gescannter Handschrift. Fein = weichere Kurven, aber größere Datei und längerer
Plot; „Standard" (3) entspricht dem bisherigen Verhalten. Nicht zu verwechseln
mit den stilbezogenen Dichte-Reglern (Linien-/Windungsabstand) — die bestimmen,
wie eng die Bahnen liegen; die Auflösung bestimmt die Punktdichte entlang jeder
Bahn.

## Projektstruktur

- `app/index.html` — das Layer Studio (Shell-Markup, Canvas, Erfassungs-Modal)
- `app/handschrift.html` / `app/bild.html` — schlanke Weiterleitungs-Stubs ins
  Studio (`?panel=capture` / `?layer=image`), erhalten, damit alte externe
  Links weiter funktionieren
- `app/layers.js` — Ebenen-Modell, Typ-Registry, ebenenübergreifende
  Export-Gruppierung
- `app/text-layer.js` — Text-Ebenentyp (Layout, Variation, Fonts, TTF-Import,
  Hit-Test)
- `app/image-layer.js` — Bild-Ebenentyp (die sechs Zeichen-Stile,
  Kantenerkennung, Pfadverfolgung)
- `app/capture.js` — Handschrift-Erfassungs-Modal (Varianten pro Zeichen,
  Scan-Import)
- `app/studio.js` — Shell-Verkabelung (Zustand, Canvas, Ebenen-Panel,
  Eigenschaften, Export, I18N, Tour, URL-Parameter)
- `app/lac.js` — gemeinsamer .lac-Export (ZIP-Writer, PathObjects, Prozesse)
  plus Kurvenauflösungs-Funnel (`quality`, `resampleStrokes`, `rdp`)
- `app/scan.js` — Scan-Import im Browser (Port von handschrift_scan.py)
- `app/ui.js` — Dark Mode, Onboarding-Touren, Sprach-Umschaltung (DE/EN), Icons
- `app/fonts.js` — generierte Fontdaten (nicht von Hand editieren)
- `app/configs.js` — generierte Maschinen-/Material-/Prozess-Configs (A2L)
- `tools/convert_fonts.py` — SVG-Fonts → `fonts.js`
- `tools/build_configs.py` — Suite-Presets → `configs.js`
- `tools/handschrift_vorlage.py` — druckbare PDF-Vorlage + Layout-Datei
- `tools/handschrift_scan.py` — Scan → Mittellinien-Strokes → `.handschrift.json`
- `tools/test_*.mjs` — End-to-End-Tests (Playwright), die das Studio steuern
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
