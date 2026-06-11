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
- Sidebar 340px, <details>-Sektionen: 1px Border, Radius 8px, Panel-Fläche.
- Buttons: Panel-Fläche, 1px Border, Radius 6px; .primary = Akzent gefüllt,
  weißer Text. Hover: --hover bzw. --accent-dark, Transition 150ms ease-out.
- Icons: Inline-SVG Stroke-Set aus ui.js (UI.icon), 24er ViewBox, stroke-width 2,
  erben currentColor. Keine Emojis.
- Canvas-Vorschau: Matte als Held; Palette aus UI.palette() (mat/grid/ink/
  marker je Theme).
- Tour-Karte: Panel, Radius 12, Schatten; Highlight via Akzent-Ring + Dim.

## Interaction
- Transitions 150ms ease-out auf background/border-color/color; transform nur
  für Hover-Lift der Landing-Karten. Keine Layout-Property-Animationen.
- :focus-visible: 2px Akzent-Outline mit 2px Offset, überall.
- cursor: pointer auf allen Klickzielen; Canvas: grab/move/crosshair je Modus.
- prefers-reduced-motion: alle Transitions/Animationen aus.

## Verboten
Seitenstreifen-Border, Gradient-Text, Glassmorphism, Emoji-Icons,
Hero-Metrik-Schablonen, identische Karten-Raster über 3 hinaus.
