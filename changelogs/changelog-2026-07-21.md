# Changelog — 2026-07-21

## Neue Features


## UI-Änderungen

- **Sichtbare Build-Kennung.** Dezent in der unteren rechten Ecke jeder App-Seite
  wird jetzt der Build-Stand angezeigt (Format `JJJJ-MM-TT.N`, z.B. „Build
  2026-07-21.2"; `N` = Release-Zähler des Tages für mehrere Releases/Tag), zentral
  aus `ui.js` (`UI.build`) injiziert. Im Studio-Embed (iframe) unterdrückt, damit
  der Tag nicht doppelt erscheint. Bei jedem Deploy zusammen mit den
  `?v=`-Cache-Versionen erhöhen.
- **Studio: „Im Layer-Studio verwenden".** Der frühere „In der Schreib-App
  verwenden"-Button auf der Handschrift-Seite öffnet jetzt das Layer-Studio und
  legt dort direkt eine Text-Ebene in der erfassten Schrift an (statt in den
  einfachen Text-Schreiber zu wechseln). Text-Ebenen tragen ihre Schrift-Auswahl
  jetzt persistent (`L.font`).
- **Studio: Freihand in hoher Auflösung.** Das Freihand-Werkzeug tastet dichter
  ab und glättet mit Chaikin statt grob per RDP (0,4 mm) zu vereinfachen — keine
  „Low-Poly"-Kanten mehr, sondern weiche Kurven.
- **Studio: Duplizieren/Löschen pro Ebene.** Die beiden Aktionen sind aus der
  oberen Optionsleiste in jede Ebenen-Zeile gewandert (Kopie-/Papierkorb-Icon).
- **Studio: klarere Werkzeug-Namen.** Das Bézier-Werkzeug heißt jetzt „Stift/Pen"
  (statt „Pfad/Path" — es erzeugt weiterhin eine Pfad-Ebene), Freihand und
  „Knoten/Nodes" (Anker bearbeiten) mit geschärften Tooltips.

## Bugfixes

- **Handschrift-Scan (Browser): dünne Tinte reißt nicht mehr ab.** Beim Import
  ausgefüllter Vorlagen erzeugte der Browser deutlich schlechtere Glyphen als die
  Python-Referenz — Buchstaben waren zerbrochen und spinnwebartig, R/Q/&/@/€
  wurden teils zu Fragment-Müll. Ursache: der Browser dekodiert Scans farbmanaged
  (ICC) und verwusch beim Herunterskalieren per Mittelung die dünne Stift-Linie
  mit dem weißen Papier, sodass sie unter den Tinten-Schwellwert fiel. `loadGray`
  in `app/scan.js` wandelt jetzt zuerst bei voller Auflösung in Graustufen und
  verkleinert mit einem dunkelheitserhaltenden Min-Pool (dunkelster Quellwert je
  Zielpixel). Ergebnis: Browser-Import deckt sich exakt mit der Referenz
  (87 Zeichen, 259 Varianten, ~100 % der Strichlänge statt zuvor ~81 %).

## Sonstiges

