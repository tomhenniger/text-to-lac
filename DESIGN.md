# DESIGN.md — Handschrift

## Tokens (CSS Custom Properties, in jedem Seitenkopf)
Light: --bg #f4f6f5 · --panel #fcfdfc · --border #d8ddda · --text #1b201d
       --muted #68716c · --hover #eef1ef
Dark:  --bg #141715 · --panel #1d2220 · --border #343b37 · --text #e6eae7
       --muted #98a29c · --hover #272d2a
Akzent: --accent #00ae42 · --accent-dark #008f36 (beide Themes)
Neutraltöne sind leicht Richtung Grün getönt (kein reines Weiß/Schwarz).

## Typography
System-Stack (-apple-system, "Segoe UI"). Hierarchie: h1 17px/700 mit
11.5px/400 muted Unterzeile · summary 13px/600 · label 12px muted ·
Eingaben/Buttons 13px · hint 11px/1.5 · statusbar 11px tabular-nums.
Marke: Ein-Linien-SVG-Wortmarke (Hershey-Schreibschrift), stroke currentColor.

## Components
- Sidebar 340px. Aufbau von oben: Kopfzeile (kleine Wortmarke → ../index.html,
  Sprache/Theme/Tour) → Ebenen-Panel → kontextuelle Eigenschaften der aktiven
  Ebene → Projekt-Sektionen (Arbeitsbereich, Export). <details>-Sektionen: 1px
  Border, Radius 8px, Panel-Fläche.
- Ebenen-Panel (kein <details>, immer sichtbar): Label „Ebenen“ + [+ Text]/[+ Bild];
  Liste; darunter Aktionszeile [Duplizieren] [Sperren] [Löschen]. Anzeige-Reihenfolge
  umgekehrt zum Array (oberste Ebene zuoberst).
- .layer-row: Panel-Fläche, 1px Border, Radius 6px, Padding 6px 8px, 12.5px.
  Ausgewählt = border-color var(--accent) + background var(--hover) (kein gefüllter
  Akzent — ruhig). Hover = --hover. Eye-Toggle + Sortier-Pfeile als Icon-Buttons
  ohne Border (--muted, Hover --text). Unsichtbare Ebene: Name in --muted.
  Umbenennen per Doppelklick (Inline-<input>). Tastatur: role=button, tabindex=0,
  Enter/Space wählt aus; :focus-visible Akzent-Ring (globaler Token).
- Buttons: Panel-Fläche, 1px Border, Radius 6px; .primary = Akzent gefüllt,
  weißer Text. Hover: --hover bzw. --accent-dark, Transition 150ms ease-out.
- Icons: Inline-SVG Stroke-Set aus ui.js (UI.icon), 24er ViewBox, stroke-width 2,
  erben currentColor. Keine Emojis. Set: home, text, pen, pencil, image, sun, moon,
  help, dice, trash, eraser, camera, file, undo, layers, eye, eyeOff, lock, unlock,
  plus, chevron-up, chevron-down, copy, close, sliders.
- Canvas-Vorschau: Matte als Held; Palette aus UI.palette() (mat/grid/ink/
  marker je Theme). Auswahl der aktiven Ebene: gestrichelter Rahmen (0.3 mm,
  P.marker) um die BBox — nur bei >1 Ebene oder aktiver Bild-Ebene (Werkzeug-Ruhe).
- Kurvenauflösungs-Slider: 5 Stufen, .val zeigt ein Wort statt Zahl (Grob/Reduziert/
  Standard/Fein/Sehr fein · Coarse/Reduced/Standard/Fine/Very fine), im Export-Bereich.
- Modal (Handschrift-Erfassung): vollflächig, position:fixed inset:0, background
  var(--bg), kein Backdrop-Blur. Kopfzeile mit Titel + Untertitel links, Tour/
  Schließen-X rechts. Zeichenfläche bleibt bewusst in beiden Themes weiß (Papier-
  Metapher) — einzige gewollte Ausnahme von der Theme-Parität.
- Tour-Karte: Panel, Radius 12, Schatten; Highlight via Akzent-Ring + Dim.
  Studio-Tour = 8 Schritte (tour_studio), Handschrift-Tour im Modal (tour_handschrift).
- Landing (index.html): Wortmarke (animierter Ein-Linien-Stroke) + ein primärer
  CTA (.cta, Akzent gefüllt) → Layer Studio, darunter schlichte Feature-Liste
  (ul.features: Icon + Text, keine Karten, kein Hover).

## Interaction
- Transitions 150ms ease-out auf background/border-color/color; transform nur
  für Hover-Lift der Landing-Karten. Keine Layout-Property-Animationen.
- :focus-visible: 2px Akzent-Outline mit 2px Offset, überall.
- cursor: pointer auf allen Klickzielen; Canvas: grab/move/crosshair je Modus.
- prefers-reduced-motion: alle Transitions/Animationen aus.

## Verboten
Seitenstreifen-Border, Gradient-Text, Glassmorphism, Emoji-Icons,
Hero-Metrik-Schablonen, identische Karten-Raster über 3 hinaus.
