# Changelog — 2026-07-21

## Neue Features


## UI-Änderungen


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

