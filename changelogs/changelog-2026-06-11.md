# Changelog — 2026-06-11

## Neue Features

- Scan-Import läuft jetzt komplett im Browser: ausgefüllte Papier-Vorlagen
  direkt in der Handschrift-Erfassung über „📷 Ausgefüllte Scans einlesen"
  importieren — kein Python mehr nötig (`app/scan.js`, JS-Port der gesamten
  Pipeline: Marker-Entzerrung, Seiten-ID, Hilfslinien-Filter, Skelettierung,
  Pfadverfolgung; liefert identische Ergebnisse wie die CLI und braucht für
  drei 600-dpi-Scans ~5 Sekunden)

- Onboarding-Touren für alle drei Tools: Schritt-für-Schritt-Präsentation mit
  Hervorhebung der Bedienelemente, startet automatisch beim ersten Besuch und
  ist jederzeit über den ❓-Button neu startbar (Pfeiltasten/Esc-Steuerung)
- Zweisprachige Oberfläche (Deutsch/Englisch): automatische Erkennung über
  die Browser-Sprache, manueller DE/EN-Umschalter auf allen Seiten
  (gespeichert), inklusive übersetzter Onboarding-Touren und Statusmeldungen
- Dark Mode auf allen Seiten (🌙/☀️-Umschalter, folgt initial der
  System-Einstellung, wird gespeichert; Canvas-Vorschauen mit eigener
  Dunkel-Palette)

## UI-Änderungen

- Variante speichern deutlich klarer: schwebender „✓ Speichern"-Button direkt
  an der Zeichenfläche, ⏎ Enter als Shortcut (Cmd/Ctrl+Z = Strich rückgängig),
  und im leeren Canvas steht jetzt eine Kurzanleitung


- Papier-Vorlage (PDF) ist jetzt direkt in der Handschrift-Erfassung verlinkt
  (öffnet in neuem Tab) statt auf der Landing-Page
- Titel modellfrei: „Pen-Plotter-Tools für Bambu Lab" (ohne A2L)
- Gemeinsames UI-Modul `app/ui.js` (Theme + Tour-Engine + Sprach-Umschaltung)
- Tour-Neustart-Button deutlicher beschriftet („❓ Tour")

## Bugfixes

- Hilfslinien-Beschriftungen im Zeichen-Canvas (Großbuchstaben, x-Höhe,
  Grundlinie, Unterlänge, Vorlauf) werden jetzt mitübersetzt



## Sonstiges

- Projekt auf GitHub veröffentlicht: https://github.com/tomhenniger/text-to-lac
  (persönlicher Account, öffentlich) mit Landing-Page (`index.html` im Root)
- GitHub Pages aktiviert und verifiziert: https://tomhenniger.github.io/text-to-lac/
  — alle drei Tools laufen vollständig im Browser, Live-Funktionstest bestanden
- Export-Dateiname im Bild-Plotter übernimmt automatisch den Bilddateinamen
