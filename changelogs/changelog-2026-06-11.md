# Changelog — 2026-06-11

## Neue Features

- Branding: Die Tool-Suite heißt jetzt „Handschrift" (bleibt auch in der
  englischen Oberfläche deutsch) — mit Wortmarke als echtem
  Ein-Linien-Schriftzug (Hershey-Schreibschrift, Inline-SVG) auf der
  Startseite; Seitentitel und Repo-Beschreibung angepasst


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

- Emojis durch einheitliche SVG-Strich-Icons ersetzt (Navigation, Theme,
  Tour, Werkzeuge, Papierkorb, Kamera, Würfel ...) — Icon-Set in app/ui.js,
  erbt die Textfarbe und passt zum Stift-Thema


- Aufgeräumter Kopfbereich auf allen Tool-Seiten: einheitliche
  Navigations-Zeile mit 🏠 Home-Button (zur Startseite), Icon-Links zu den
  anderen Tools und rechtsbündigen Bedienelementen (DE/EN, Theme, Tour) —
  der Titel steht wieder frei


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

- Sweep über alle deutschen Defaults in der englischen Oberfläche:
  Beispieltext, Standard-Dateinamen, Tab-Titel, Font-Namen im Dropdown
  (fonts.js trägt jetzt deutsche und englische Namen), Export-Objektnamen
  („Zeile N" → „Line N", „Bild" → „Image") und der Standard-Schriftname
  „Meine Handschrift" → „My Handwriting" (wird nur getauscht, solange
  darunter nichts erfasst ist — eigene Inhalte bleiben unangetastet)


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
