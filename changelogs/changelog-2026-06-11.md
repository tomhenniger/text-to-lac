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

- Handschrift-Erfassung: Radiergummi-Werkzeug (🧹 oben links an der
  Zeichenfläche, Taste E wechselt zwischen Stift und Radierer) — radiert
  mit Kreis-Cursor punktgenau und teilt Striche dabei sauber auf


- Bild-Plotter: „🗑 Bild entfernen"-Button setzt den Editor zurück


- Handschrift-Erfassung: ⏎ Enter speichert die Variante und bleibt beim
  Zeichen (für weitere Varianten), ⇧⏎ Shift+Enter speichert und springt zum
  nächsten leeren Zeichen — die Auto-Sprung-Checkbox entfällt; zwei
  schwebende Buttons an der Zeichenfläche machen beides klickbar
- Varianten-Leiste: Klick auf ein Thumbnail zeigt die Variante nur noch im
  Editor an (nicht mehr destruktiv herausnehmen), gelöscht wird über einen
  🗑-Button


- Variante speichern deutlich klarer: schwebender „✓ Speichern"-Button direkt
  an der Zeichenfläche, ⏎ Enter als Shortcut (Cmd/Ctrl+Z = Strich rückgängig),
  und im leeren Canvas steht jetzt eine Kurzanleitung


- Papier-Vorlage (PDF) ist jetzt direkt in der Handschrift-Erfassung verlinkt
  (öffnet in neuem Tab) statt auf der Landing-Page
- Titel modellfrei: „Pen-Plotter-Tools für Bambu Lab" (ohne A2L)
- Gemeinsames UI-Modul `app/ui.js` (Theme + Tour-Engine + Sprach-Umschaltung)
- Tour-Neustart-Button deutlicher beschriftet („❓ Tour")

## Bugfixes

- Bild-Plotter: Bild lässt sich nicht mehr aus dem Arbeitsfeld hinausziehen
  (Position wird beim Ziehen sowie bei Größen-/Mattenänderung begrenzt)


- Gescannte Handschrift war deutlich kantiger als mit dem Trackpad
  gezeichnete Buchstaben → Chaikin-Kurvenglättung nach der Pfadvereinfachung
  (Browser- und CLI-Importer) macht aus den Pixel-Treppen des Skeletts
  weiche Kurven


- Hilfslinien-Beschriftungen im Zeichen-Canvas (Großbuchstaben, x-Höhe,
  Grundlinie, Unterlänge, Vorlauf) werden jetzt mitübersetzt



## Sonstiges

- Projekt auf GitHub veröffentlicht: https://github.com/tomhenniger/text-to-lac
  (persönlicher Account, öffentlich) mit Landing-Page (`index.html` im Root)
- GitHub Pages aktiviert und verifiziert: https://tomhenniger.github.io/text-to-lac/
  — alle drei Tools laufen vollständig im Browser, Live-Funktionstest bestanden
- Export-Dateiname im Bild-Plotter übernimmt automatisch den Bilddateinamen
