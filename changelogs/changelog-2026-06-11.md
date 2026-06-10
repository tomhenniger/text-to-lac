# Changelog — 2026-06-11

## Neue Features

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

- Papier-Vorlage (PDF) ist jetzt direkt in der Handschrift-Erfassung verlinkt
  (öffnet in neuem Tab) statt auf der Landing-Page
- Titel modellfrei: „Pen-Plotter-Tools für Bambu Lab" (ohne A2L)
- Gemeinsames UI-Modul `app/ui.js` (Theme + Tour-Engine + Sprach-Umschaltung)
- Tour-Neustart-Button deutlicher beschriftet („❓ Tour")

## Bugfixes


## Sonstiges

- Projekt auf GitHub veröffentlicht: https://github.com/tomhenniger/text-to-lac
  (persönlicher Account, öffentlich) mit Landing-Page (`index.html` im Root)
- GitHub Pages aktiviert und verifiziert: https://tomhenniger.github.io/text-to-lac/
  — alle drei Tools laufen vollständig im Browser, Live-Funktionstest bestanden
- Export-Dateiname im Bild-Plotter übernimmt automatisch den Bilddateinamen
