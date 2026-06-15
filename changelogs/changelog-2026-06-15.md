# Changelog — 2026-06-15

## Neue Features

- **Bild-Modus „Strichzeichnung (Mittellinie)"**: Neuer Stil in `app/bild.html`, der die Mittellinie (Centerline) jeder gezeichneten Linie nachzieht — ideal für Line Art, Logos und Cartoons. Im Gegensatz zum Kontur-Modus (Sobel-Kanten → Doppellinien) wird das Bild binarisiert, per Zhang-Suen skelettiert und als Polylinien getract, sodass der Stift jede Linie genau einmal fährt. Mit automatischer Schwelle (Otsu), manuellem Schwellen-Override, einstellbarem Detailgrad und Mindest-Strichlänge (Despeckle). Für helle Linien auf dunklem Grund über „Invertieren".

- **Bild-Stil „Flächen füllen + Kontur"**: Neuer Stil in `app/bild.html`, der zusammenhängende Flächen mit dichter Schraffur komplett ausfüllt (Füll-Abstand ≈ Stiftbreite = deckend) und optional die Außenkante einmal als saubere Kontur nachfährt (crispe Ränder). Steuerbar über Flächen-Schwelle, Füll-Abstand, Füll-Winkel, Kontur-Auflösung und Kontur-Checkbox. In Kombination mit dem Multicolor-Modus füllt es jede Farbfläche separat — ideal für flächige Logos, Sticker und Cliparts.
- **Multicolor: Farben automatisch aus dem Bild ziehen**: Neuer Button „🎨 Farben aus Bild ziehen" in der Multicolor-Sektion (`app/bild.html`) mit einstellbarer Anzahl (2–8). Ermittelt per k-Means-Quantisierung (deterministisch, k-Means++-Init) die dominantesten Bildfarben und füllt damit die Palette, nach Häufigkeit sortiert. Da jeder Pixel der nächsten Palettenfarbe zugeordnet wird, entspricht das einem Posterize des Bildes.
- **Multicolor-Modus im Bild-Plotter**: Neue „Multicolor"-Sektion in `app/bild.html` mit Paletten-Editor (Farben hinzufügen/entfernen, Farbwähler). Jeder Bildpunkt wird der ähnlichsten Paletten-Farbe zugeordnet; pro Farbe entsteht eine eigene, farbig benannte Gruppe in der `.lac`. Eine Legende zeigt die Zeichen-Reihenfolge inkl. „Stift wechseln"-Hinweisen, die Vorschau rendert jede Gruppe in ihrer echten Farbe. Funktioniert mit jedem Stil. `makeLac()` (`app/lac.js`) übernimmt jetzt eine Farbe pro Gruppe (statt fest Schwarz), sodass die Bambu Suite die Objekte farblich unterscheidet. `lac.js`-Cache-Version auf `v=4` erhöht.

## UI-Änderungen

- Neuer Eintrag „Strichzeichnung (Mittellinie)" in der Stil-Auswahl des Bild-Modus inkl. eigenem Parameter-Block (Otsu-Checkbox, Schwelle, Auflösung, Mindest-Strichlänge) und Hilfetext (DE/EN).
- Neue „Multicolor"-Sektion mit Paletten-Editor, Farb-Legende (Zeichen-Reihenfolge) und farbiger Vorschau pro Gruppe.
- **Einstellbare Hintergrundfarbe der Vorschau-Platte** (Standard Weiß) im Bild-Modus *und* im Text-Writer. Die Platte folgt nicht mehr dem Dark/Light-Theme, sondern der gewählten Papierfarbe — so stimmen die Farbkontraste (besonders im Multicolor) immer (Papier-WYSIWYG). Rand, Raster und Einfarb-Tinte leiten sich automatisch aus der Helligkeit der Hintergrundfarbe ab (heller Hintergrund → dunkle Tinte und umgekehrt).
