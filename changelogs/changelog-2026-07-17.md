# Changelog — 2026-07-17

## Neue Features
- Layer-Studio: Werkzeug-Palette hinter akzentgrünem „+ Hinzufügen"-Button — alle Ebenen-Werkzeuge (inkl. QR-Code und Spotify-Code) sind jetzt kategorisiert (Inhalt · Codes · Vorlagen · Generativ · Audio), mit Klartext-Label und Suchfeld auffindbar, statt nur als namenlose Icons.
- Layer-Studio: Einzeltasten-Kürzel für die Modus-Werkzeuge (V Auswahl, B Freihand, P Pfad, A Knoten).
- Layer-Studio: Zoom-Anzeige unten links (100 % = physische Größe, 96px/25,4mm); Klick passt die Ansicht ein. Neuer Menüpunkt Ansicht → Originalgröße (100 %).
- Layer-Studio: Ebenenliste zeigt echte Thumbnails der gerenderten Striche pro Ebene (memoisiert, ≤600 Punkte) statt eines generischen Typ-Icons.

## UI-Änderungen
- Layer-Studio: Werkzeugleiste auf 64px verbreitert, alle Buttons mit sichtbarem Text-Label unter dem Icon; die Leiste umfasst nur noch 8 Buttons und scrollt nie mehr.
- Layer-Studio: Artboard-Präsenz — abgedunkelter Arbeits-Desk (#c2c8c4 Light / #101312 Dark) mit Inset-Schacht; die papierweiße Platte bekommt einen zoomstabilen Schlagschatten und eine ~1px-Kante, sodass sie klar als Fläche hervortritt (Kontrast Fläche↔Desk von ~7 % auf ~21 % Light / ~91 % Dark erhöht).
- Layer-Studio: geschichtetes Chrome — Menü-, Options- und Statusleiste, Toolbar und Rechts-Panel werfen dezente Schatten (neue --elev/--elev-strong-Tokens); Panel-Header leicht abgesetzt. 1px-Borders bleiben, keine Gradients/Glassmorphism.
- Menüpunkt Bearbeiten → „Ebene hinzufügen …" öffnet die Palette (zweiter Fundweg).

## Bugfixes


## Sonstiges
- DESIGN.md und PRODUCT.md um die Studio-spezifische Chrome-Richtung ergänzt (Photoshop-Kaliber, Anti-Referenzen bleiben gültig).
- Neuer Playwright-Test tools/test_studio_toolbar.mjs (Palette, Suche, Zoom-Anzeige, Thumbnails, Modus-Buttons).
