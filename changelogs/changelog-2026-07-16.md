# Changelog — 2026-07-16

## Neue Features

- Layer Studio (Fundament): Der Text-Schreiber wird zur Ebenen-App
  umgebaut. Statt eines einzelnen globalen Textblocks arbeitet `app/index.html`
  jetzt mit einem Ebenen-Modell — mehrere unabhängige Text-Ebenen liegen
  gemeinsam auf einer Matte, jede mit eigenem Text, eigener Schrift, eigener
  Handschrift-Variation, eigenem Seed und eigenen Buchstaben-/Zeilen-Anpassungen.
- Handschrift-Erfassung als Modal im Studio: Die frühere Seite „Handschrift
  erfassen" ist jetzt ein Vollflächen-Modal, erreichbar über „Eigene Handschrift
  erfassen …" im Schrift-Bereich einer Text-Ebene. Jeden Buchstaben selbst
  zeichnen (mit Hilfslinien, Radiergummi und mehreren Varianten pro Zeichen),
  per Papier-Vorlage einscannen oder als `.handschrift.json` sichern/laden — die
  erfasste Schrift steht sofort im Schriften-Menü zur Verfügung („Übernehmen &
  schließen" setzt sie direkt in der aktiven Text-Ebene ein). Der bestehende
  Speichervertrag (`localStorage` „hw_fonts") bleibt unverändert, bereits
  erfasste Handschriften gehen nicht verloren.
- Bild-Ebenen: Der frühere Bild-Plotter ist jetzt ein Ebenentyp im Studio.
  Ein Foto per „+ Bild" oder Drag-and-drop laden und in sechs Stilen plotten —
  parallele Linien, Kreuzschraffur, Wellenlinien (Squiggle), Spirale,
  ASCII-Art (auch in eigener Handschrift) und Konturen (Kanten). Mit
  Helligkeit, Kontrast, Invertieren und allen stilspezifischen Reglern.
  Bild-Ebenen liegen gemeinsam mit Text-Ebenen auf der Matte, lassen sich per
  Maus verschieben und werden in .lac/SVG mit exportiert.
- Ebenen-Panel in der Sidebar: Ebenen anlegen (+ Text, + Bild), auswählen, per
  Doppelklick umbenennen, ein-/ausblenden, in der Reihenfolge verschieben
  (↑/↓), duplizieren, sperren und löschen.
- Export ebenenübergreifend: neue Objekt-Aufteilung „Ein Objekt pro Ebene"
  (Standard) neben „Alles als ein Objekt"; „pro Zeile"/„pro Buchstabe" wirken
  weiter auf Text-Ebenen. .lac, SVG und Thumbnail berücksichtigen alle
  sichtbaren Ebenen.
- Kurvenauflösungs-Regler im Export-Bereich (5 Stufen: Grob · Reduziert ·
  Standard · Fein · Sehr fein). Ein einziger projektweiter Regler steuert
  zentral, wie fein Kurven in Punkte aufgelöst werden, und wirkt live auf
  Vorschau, Statuszeile, .lac und SVG (echtes WYSIWYG). Er ersetzt die früher
  fest verdrahteten Konstanten: TTF-Bezier-Auflösung, die Unterteilung des
  Linien-Zitterns, die Abtast-Schrittweiten aller Bild-Stile (Schraffur,
  Wellenlinien, Spirale, Kontur) und die Glättung neu gescannter Handschrift.
  Fein = weichere Kurven, aber größere Datei und längerer Plot; „Standard" (3)
  entspricht dem bisherigen Verhalten.

## UI-Änderungen

- Sidebar neu strukturiert: Ebenen-Panel oben, darunter die kontextuellen
  Eigenschaften der aktiven Ebene — bei Text-Ebenen Text/Schrift/Variation,
  bei Bild-Ebenen Bild/Stil — darunter die projektweiten Bereiche
  (Arbeitsbereich & Stift, Export).
- Kopfbereich schlanker: Wortmarke „Handschrift" als Link zur Startseite statt
  Tool-Navigationsleiste; Titel „Layer Studio".
- Auf dem Canvas: gestrichelte Auswahl-Markierung um die aktive Ebene, sobald
  mehr als eine Ebene existiert; anderes Ebenen-Objekt anklicken wählt es aus
  und zieht es.
- Neue Studio-Tour in acht Schritten (DE/EN): Konzept Ebenen → Ebenen-Panel →
  Text → Schrift & eigene Handschrift → Variation → Vorschau → Bild-Ebenen →
  Export & Kurvenauflösung. Wird auch Bestandsnutzern einmal gezeigt (die UI ist
  grundlegend neu). Ebenen-Zeilen sind jetzt per Tastatur bedienbar
  (Fokus/Enter/Leertaste wählt aus).
- Startseite (`index.html`) auf ein Ziel umgestellt: statt drei Tool-Karten ein
  primärer Button „Layer Studio öffnen" und darunter eine schlichte
  Feature-Liste (Text schreiben · Handschrift erfassen · Bilder plotten).

## Bugfixes

- Export einer „leeren" Zeichnung (nur Leerzeichen im Text oder eine Bild-Ebene
  ohne Striche) zeigt jetzt einen sauberen Hinweis („Nichts zum Exportieren")
  statt einen unbehandelten Fehler zu werfen — die Prüfung achtet auf tatsächlich
  vorhandene Pfade und fängt den Export-Fehler zusätzlich ab.

## Sonstiges

- Inline-Script von `app/index.html` in Module aufgeteilt: `app/layers.js`
  (Ebenen-Modell, Registry, Export-Gruppierung), `app/text-layer.js`
  (Text-Ebenentyp: Layout/Variation/Fonts/TTF-Import/Hit-Test — 1:1 portiert),
  `app/image-layer.js` (Bild-Ebenentyp: alle sechs Stile inkl. Sobel/
  Zhang-Suen/Trace/RDP — 1:1 aus `bild.html` portiert; teure Raster→Vektor-
  Berechnung wird pro Ebene gecacht und ist unabhängig von der Position),
  `app/studio.js` (Shell-Verkabelung, I18N, Tour, URL-Parameter). Neue Icons in
  `app/ui.js` (layers/eye/lock/plus/chevron/copy/close/sliders).
- `window.__studio` als Debug-Handle für die Testsuite (ersetzt die früheren
  Globals `cachedLayout`/`S`).
- Handschrift-Erfassung nach `app/capture.js` portiert (IIFE `window.Capture`
  mit `open`/`close`, lazy beim ersten Öffnen verkabelt). `app/index.html` lädt
  jetzt zusätzlich `scan.js` und `vorlage_layout.js` (für den Scan-Import im
  Modal). Neue Schnittstelle `window.Studio` (`onFontsChanged`, `initTour`,
  `openCapture`) für die Verzahnung Studio↔Modal; Font-Änderungen im Modal
  aktualisieren den Schriften-Picker sofort (kein Tab-Wechsel nötig).
  URL-Parameter `?panel=capture` öffnet das Modal direkt (mit `?font=hw_…` zur
  Vorauswahl) — Grundlage für die späteren Weiterleitungs-Stubs.
- Kurvenauflösung technisch: gemeinsamer Funnel in `app/lac.js`
  (`quality(q)`-Tabelle, `resampleStrokes`, `rdp`). Alle fertigen Strokes jeder
  Ebene laufen in `Layers.strokesOf()` (und beim Zeilen-/Buchstaben-Export)
  durch dieselbe RDP-Vereinfachung, sodass Vorschau und Export identische Pfade
  sehen. `app/text-layer.js` liest `Q.maxSeg`/`Q.ttfSeg`; TTF-Fonts werden bei
  Regler-Änderung aus dem gepufferten `ArrayBuffer` neu geflattet.
  `app/image-layer.js` skaliert die Abtastung über `Q.step`.
  `app/scan.js` (`processFiles(..., quality)`) koppelt Chaikin-Iterationen und
  RDP-Toleranz an die Auflösung.
- Alte Tool-Seiten als Weiterleitungen erhalten: `app/handschrift.html` und
  `app/bild.html` sind jetzt schlanke Stubs, die (unter Erhalt vorhandener
  Query-Parameter wie `?font=…`) ins Layer Studio weiterleiten —
  `handschrift.html` → `index.html?panel=capture` (öffnet das Erfassungs-Modal),
  `bild.html` → `index.html?layer=image` (legt eine Bild-Ebene an). So bleiben
  externe Links (MakerWorld/Reddit) gültig. Kein Goatcounter in den Stubs (keine
  Doppelzählung).
- Dokumentation auf die Ein-App-Struktur umgestellt: README.md und README.de.md
  beschreiben jetzt das Layer Studio mit Ebenen-Konzept, Erfassungs-Modal,
  Bild-Ebenen und Kurvenauflösung (Projektstruktur auf die neuen Module
  aktualisiert); PRODUCT.md (Register/Purpose) und DESIGN.md (Komponenten)
  angepasst.
- Testsuite migriert: alle `tools/test_*.mjs` zielen auf das zusammengeführte
  Studio (Handschrift-Flows über `?panel=capture`, Bild-Flows über
  `?layer=image`, Interna über `window.__studio` statt der früheren Globals
  `cachedLayout`/`S`, Tour-Schlüssel `tour_studio`/`tour_handschrift`). Neu:
  `test_layers.mjs` (Ebenen anlegen/umbenennen/sichtbar/umsortieren/duplizieren/
  löschen + Export-Objektzahl), `test_resolution.mjs` (Punktzahl monoton über
  die fünf Auflösungsstufen, .lac-Größe) und `test_redirects.mjs` (Stub-Params).
  Einmalige Screenshot-/Demo-Skripte gegen die alten Einzelseiten entfernt
  (`demo_handschrift`, `demo2`, `shot_brand`, `shot_nav`, `shot_polish`,
  `shot_tour`).
