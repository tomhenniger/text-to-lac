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

## Studio-Chrome (app/studio.html)
Das Layer-Studio tritt bewusst als vollwertige Kreativ-Anwendung auf
(Photoshop-Kaliber). Gilt nur hier; die Anti-Referenzen bleiben in Kraft.
- Werkzeugleiste 64px mit beschrifteten Buttons (9px-Label unter 22px-Icon);
  Ebenen-Katalog über den akzentgrünen „+ Hinzufügen"-Button → Palette mit
  Kategorien (Inhalt · Codes · Vorlagen · Generativ · Audio), Icon + Klartext-
  Label pro Werkzeug, Suchfeld. Jedes Werkzeug ist über Text auffindbar,
  Tooltips sind nur Zusatz.
- Artboard-Präsenz: Arbeits-Desk #c2c8c4 (Light) / #101312 (Dark) mit
  Inset-Schatten (recessed well); die Platte bleibt themenunabhängig
  papierweiß und bekommt einen Canvas-Schlagschatten (blur 22·dpr,
  offsetY 5·dpr, rgba(0,0,0,.28) bzw. .60, im Geräteraum → zoomstabil) plus
  eine ~1-CSS-px-Kante bei jedem Zoom.
- Elevation-Tokens: --elev rgba(15,26,19,.10) / Dark rgba(0,0,0,.45),
  --elev-strong .22 / .60. Menü-/Options-/Status-Leiste, Toolbar und
  Rechts-Panel werfen Schatten auf den Canvas-Schacht; 1px-Borders bleiben als
  scharfe Kante. Keine Gradients, kein Blur/Glassmorphism.
- Ebenenliste mit 30px-Thumbnails (echte gerenderte Striche, memoisiert auf
  L._th, ≤600 Punkte; Papier-Chip als Hintergrund, Typ-Icon nur als Fallback
  für leere Ebenen). Zoom-Anzeige unten links (100 % = physische Größe,
  96px/25.4mm, Klick = Einpassen).

## Interaction
- Transitions 150ms ease-out auf background/border-color/color; transform nur
  für Hover-Lift der Landing-Karten. Keine Layout-Property-Animationen.
- :focus-visible: 2px Akzent-Outline mit 2px Offset, überall.
- cursor: pointer auf allen Klickzielen; Canvas: grab/move/crosshair je Modus.
- prefers-reduced-motion: alle Transitions/Animationen aus.

## Verboten
Seitenstreifen-Border, Gradient-Text, Glassmorphism, Emoji-Icons,
Hero-Metrik-Schablonen, identische Karten-Raster über 3 hinaus.
