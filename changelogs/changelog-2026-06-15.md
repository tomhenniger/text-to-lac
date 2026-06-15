# Changelog — 2026-06-15

## Neue Features

- **Bild-Modus „Strichzeichnung (Mittellinie)"**: Neuer Stil in `app/bild.html`, der die Mittellinie (Centerline) jeder gezeichneten Linie nachzieht — ideal für Line Art, Logos und Cartoons. Im Gegensatz zum Kontur-Modus (Sobel-Kanten → Doppellinien) wird das Bild binarisiert, per Zhang-Suen skelettiert und als Polylinien getract, sodass der Stift jede Linie genau einmal fährt. Mit automatischer Schwelle (Otsu), manuellem Schwellen-Override, einstellbarem Detailgrad und Mindest-Strichlänge (Despeckle). Für helle Linien auf dunklem Grund über „Invertieren".

- **Multicolor-Modus im Bild-Plotter**: Neue „Multicolor"-Sektion in `app/bild.html` mit Paletten-Editor (Farben hinzufügen/entfernen, Farbwähler). Jeder Bildpunkt wird der ähnlichsten Paletten-Farbe zugeordnet; pro Farbe entsteht eine eigene, farbig benannte Gruppe in der `.lac`. Eine Legende zeigt die Zeichen-Reihenfolge inkl. „Stift wechseln"-Hinweisen, die Vorschau rendert jede Gruppe in ihrer echten Farbe. Funktioniert mit jedem Stil. `makeLac()` (`app/lac.js`) übernimmt jetzt eine Farbe pro Gruppe (statt fest Schwarz), sodass die Bambu Suite die Objekte farblich unterscheidet. `lac.js`-Cache-Version auf `v=4` erhöht.

## UI-Änderungen

- Neuer Eintrag „Strichzeichnung (Mittellinie)" in der Stil-Auswahl des Bild-Modus inkl. eigenem Parameter-Block (Otsu-Checkbox, Schwelle, Auflösung, Mindest-Strichlänge) und Hilfetext (DE/EN).
- Neue „Multicolor"-Sektion mit Paletten-Editor, Farb-Legende (Zeichen-Reihenfolge) und farbiger Vorschau pro Gruppe.
