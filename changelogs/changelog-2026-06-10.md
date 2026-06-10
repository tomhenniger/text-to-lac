# Changelog — 2026-06-10

## Neue Features

- Projekt „Text → .lac" angelegt: Webapp (`app/index.html`), die Text als
  Stift-Schreibprojekt für den Bambu Lab A2L (Pen Holder) exportiert
- 18 Ein-Linien-Schriften (Hershey/EMS) eingebaut, alle mit Umlauten und ß;
  Konverter `tools/convert_fonts.py` (SVG-Font → Polylinien-JS)
- TTF/OTF-Import als Umriss-Schrift (via opentype.js, CDN)
- Handschrift-Variation pro Buchstabe: Drehung, Größenstreuung,
  Grundlinien-Tanz, Abstands-Streuung, Neigung, Linien-Zittern —
  deterministisch per Seed, „Neu würfeln"-Button
- Live-Vorschau mit A2L-Matte (300×300 mm), Zoom, Pan, Drag-Positionierung
  (einzelne Zeilen oder ganzer Textblock)
- .lac-Export mit eigenem ZIP-Writer: PathObjects, zugewiesenem
  KCPenDraw-Prozess, Material „Generic 80g Printer Paper",
  Plattenplatzierung und Thumbnail; zusätzlich SVG-Export
- `tools/build_configs.py`: zieht vollständige (von der Suite angereicherte)
  Maschinen-/Material-/Prozess-Configs aus Suite-Autosaves/Presets
- End-to-End-Test `tools/test_export.mjs` (Playwright, headless)
- Handschrift-Erfassung (`app/handschrift.html`): eigene Buchstaben mit
  Maus/Trackpad/Stift auf Hilfslinien zeichnen, mehrere Varianten pro
  Buchstabe, einstellbarer Vorlauf, Glättung, Export/Import als JSON,
  Speicherung im localStorage; die Schreib-App wählt pro Buchstaben-Vorkommen
  zufällig eine Variante (Test: `tools/test_handwriting.mjs`)
- Papier-Workflow für Handschrift: `tools/handschrift_vorlage.py` erzeugt
  druckbare PDF-Vorlage (Kästchen mit Hilfslinien, Eckmarker, Seiten-ID);
  `tools/handschrift_scan.py` liest Scans/Fotos ein (Homographie-Entzerrung,
  Hilfslinien-Filterung, Zhang-Suen-Skelettierung, Pfadverfolgung mit
  Spur-Pruning und mehrstufigem Verbinden) und erzeugt `.handschrift.json`
  zum Import in die Erfassungsseite (Test: `tools/test_scan.py`)

## Bugfixes

- Scan-Pipeline an echten Scans kalibriert: redundante Diagonalkanten in der
  Skelett-Verfolgung erzeugten falsche Kreuzungen und zerhackten saubere
  Striche in Dutzende Fragmente (Median 5 → 2 Striche/Glyphe, Max 26 → 6);
  Mindest-Tinte pro Kästchen gesenkt, damit Punkt und Doppelpunkt erkannt
  werden; Vorlaufbreite gestrafft (+70 → +45 Einheiten)
- Schreib-App: typografische Zeichen (— – „ " … ') fallen auf erfasste
  Ersatzzeichen zurück statt stillschweigend zu fehlen
- Buchstabenabstand beim Scan-Import: linker Leerraum im Kästchen wurde in
  jede Glyphe eingebacken (riesige Lücken zwischen Buchstaben, Leerzeichen
  wirkten zu schmal) → Vorlauf wird jetzt normalisiert (20u links + 35u
  rechts um die Tinte); Leerzeichen-Standard 280 → 350 Einheiten

- Neue Seite `app/bild.html` — Bild-Plotter: wandelt ein Bild in
  Stift-Zeichenpfade um, sechs Stile: Parallele Linien, Kreuzschraffur,
  Wellenlinien (Squiggle), Spirale, ASCII-Art (mit Ein-Linien-Fonts oder
  eigener Handschrift!) und Konturen (Sobel-Kanten + Skelettierung);
  Helligkeit/Kontrast/Invertieren, Live-Vorschau auf der Matte mit
  Drag-Positionierung, Export als .lac (KCPenDraw) und SVG
- Gemeinsames Export-Modul `app/lac.js` (ZIP-Writer + .lac-Aufbau),
  von Text-Schreiber und Bild-Plotter genutzt

## UI-Änderungen

- Neuer „Wortabstand"-Regler (0,4–3×) in der Schreib-App;
  Buchstabenabstand-Regler erweitert auf −2 mm
- Einzelne Buchstaben sind jetzt direkt per Maus verschiebbar (Buchstabe
  ziehen; Lücke/Rand oder Alt = Zeile, Shift = ganzer Text); gezogener
  Buchstabe bekommt einen Markierungsrahmen
- Klick auf einen Buchstaben blättert durch seine Handschrift-Varianten
  (Anzeige „Variante 2/3" in der Statusleiste); „Anpassungen zurücksetzen"
  setzt Verschiebungen und Varianten-Wahl gemeinsam zurück

- Leere `making_batch_list` führte zu „Datei kann nicht geöffnet werden" in
  der Bambu Suite → vollständige Batch-Struktur mit Material und Platte
- Canvas-Ursprung der Suite ist oben links des Arbeitsbereichs (nicht Mitte)
  → Texte landen jetzt exakt an der Vorschau-Position im Arbeitsbereich

## Sonstiges

- Zielmaschine von H2D auf A2L umgestellt (Nutzer hat A2L)
- Export in Bambu Suite verifiziert (öffnet fehlerfrei, Objekte als
  „Drawing Line", Text korrekt orientiert, Umlaute intakt)
