# Changelog — 2026-06-16

## Neue Features

- **Layer-Studio: Werkzeug „Knoten bearbeiten"** — neben den beiden Stift-Varianten (Freihand, Bézier-Pfad) gibt es jetzt ein eigenes Werkzeug zum Bearbeiten von Pfaden. Mit aktivem Werkzeug einen Bézier-Pfad anklicken und Anker bzw. Kurvengriffe direkt auf der Fläche ziehen; war der Anker glatt, wird der Gegengriff gespiegelt, an Ecken (Cusps) bleiben die Griffe unabhängig. Bearbeitung per Enter/Esc beenden. Der gewählte Pfad lässt sich weiterhin auch per Doppelklick (Auswahl-Werkzeug) bearbeiten.

## UI-Änderungen

- **Layer-Studio: Größe in echten Millimetern statt Skalierungsfaktor** — die Kontext-Leiste zeigt jetzt **Breite und Höhe in mm** (gekoppelt an die Skalierung: B = Inhaltsmaß × Skalierung), statt eines einheitenlosen Faktors. Wer die Breite/Höhe einträgt, skaliert die Ebene direkt auf das gewünschte Maß; da skaliert wird wie bisher uniform (Seitenverhältnis bleibt erhalten), zieht die jeweils andere Achse automatisch nach. Ein kleines Schloss-Symbol zwischen den Feldern zeigt die proportionale Kopplung an. Skalieren per Griff aktualisiert die mm-Anzeige live. Solange die Maße einer Ebene noch nicht feststehen (z. B. ein gerade geladenes 3D-Modell), sind die Felder deaktiviert statt „0" anzuzeigen.
- **Layer-Studio: Maschinen-Bereiche am oberen Plattenrand verankert** — die Hilfslinien für Zeichnen (300×255 mm) und Schneiden (300×285 mm) liegen jetzt unten verankert, sodass die Grenze (das Limit) oben sitzt; die Beschriftungen stehen entsprechend an der oberen Kante des jeweiligen Bereichs.

## Bugfixes

- **Layer-Studio: Pfad-Bearbeitung an die echte Ansicht gekoppelt** — Anker/Griffe wurden im falschen Koordinatenraum getroffen (Maschinen-mm statt Geräte-px), sodass die Bearbeitung bei realem Zoom/Pan nicht griff. Hit-Test und Overlay rechnen jetzt korrekt über `mm2px` in CSS-Screen-px.
- **Layer-Studio: gedrehte Pfade taumeln beim Bearbeiten nicht mehr** — während des Ziehens bleiben `cw/ch` (und damit der Rotations-Pivot) eingefroren; beim Beenden wird die Welt-Position über eine Pivot-Verschiebungs-Kompensation exakt erhalten, auch bei Rotation/Skalierung.
- **Layer-Studio: Duplizieren kopiert die Pfad-Daten mit** — duplizierte Pfad-Ebenen waren ohne `pen`-Daten nicht editierbar (Absturz beim Doppelklick); die Geometrie wird jetzt mitkopiert.
- **Layer-Studio: Freihand-Abtastung zoom-unabhängig** — die Mindest-Punktdistanz beim Freihand-Zeichnen wird in Screen-px gemessen (statt mm), sodass die Glättung bei jedem Zoom gleich dicht ist. Pfad schließt erst ab 3 Ankern.
- **Layer-Studio: Pfad-Bearbeitung räumt ihren Zustand sauber auf** — wird die gerade bearbeitete Pfad-Ebene gelöscht, verschwindet das Bearbeitungs-Overlay statt als „Geist" stehen zu bleiben; ein Auswahlwechsel bei aktivem Knoten-Werkzeug beendet die laufende Bearbeitung sauber (kein Hängenbleiben an der alten Ebene). Während einer Pfad-Bearbeitung pausiert das Autospeichern, damit kein unfertiger Zwischenstand gespeichert wird (der gedrehte Pfade beim Neuladen versetzt hätte) — gesichert wird erst nach dem Beenden.
- **Layer-Studio: einheitliche Skalierungsgrenzen** — getippte Breite/Höhe werden auf denselben Skalierungsbereich (0,05–50×) begrenzt wie das Skalieren per Griff; nach der Eingabe zeigen die Felder das tatsächlich angewandte Maß.
- **Layer-Studio: wiederhergestellte SVG-/Bild-/Audio-/3D-Ebenen verschwinden nicht mehr beim Auswählen** — datei-basierte Ebenen verlieren ihre Datei beim Neuladen der Seite, behalten aber ihre gecachten Striche. Beim Auswählen wurde bisher ein frisches (leeres) Werkzeug-iframe erzeugt, dessen leerer Anfangszustand die wiederhergestellten Striche überschrieb — die SVG war weg. Jetzt wird ein leerer Anfangs-Stand eines gerade erzeugten iframes ignoriert, solange die Ebene noch gecachte Striche hat; erst echte Striche (nach erneutem Datei-Laden oder Neuaufbau aus Parametern) übernehmen. Betrifft auch Duplikate datei-basierter Ebenen.
