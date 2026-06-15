# Changelog — 2026-06-15

## Neue Features

- **Bild-Modus „Strichzeichnung (Mittellinie)"**: Neuer Stil in `app/bild.html`, der die Mittellinie (Centerline) jeder gezeichneten Linie nachzieht — ideal für Line Art, Logos und Cartoons. Im Gegensatz zum Kontur-Modus (Sobel-Kanten → Doppellinien) wird das Bild binarisiert, per Zhang-Suen skelettiert und als Polylinien getract, sodass der Stift jede Linie genau einmal fährt. Mit automatischer Schwelle (Otsu), manuellem Schwellen-Override, einstellbarem Detailgrad und Mindest-Strichlänge (Despeckle). Für helle Linien auf dunklem Grund über „Invertieren".

## UI-Änderungen

- Neuer Eintrag „Strichzeichnung (Mittellinie)" in der Stil-Auswahl des Bild-Modus inkl. eigenem Parameter-Block (Otsu-Checkbox, Schwelle, Auflösung, Mindest-Strichlänge) und Hilfetext (DE/EN).
