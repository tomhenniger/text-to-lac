# Handschrift — pen plotter tools for Bambu Lab

🇩🇪 **[Deutsche Version](README.de.md)** · Live: **https://handschrift.art**

**Handschrift** (German for "handwriting") is a browser app that turns text and
images into `.lac` project files for Bambu Suite — for drawing with the pen
holder of the A2L/H2D. It is a single **Layer Studio**: text and images live as
independent layers on one mat, with a live preview, a library of single-line
fonts, per-letter handwriting variation (no two characters look alike) and your
own captured handwriting. No server, no build step: everything runs in your
browser.

## Usage

Open `app/index.html` in a browser (double-click works, no server needed) —
or use the hosted version linked above. The studio boots with one text layer;
add more text or image layers as you go.

1. Enter your **text** into the active text layer (multi-line; umlauts and ß
   work)
2. Pick a **font** — 18 built-in single-line fonts (Hershey/EMS, ideal for
   pens), your **own handwriting** (see below), or a TTF/OTF (drawn as outline,
   needs internet)
3. Tune the **handwriting variation**: rotation, size, baseline, spacing,
   slant and line jitter scatter per letter (deterministic via a per-layer
   seed, "Reroll" creates a new variation)
4. **Arrange**: drag letters individually, click a letter to cycle its
   captured variants, drag a line or the whole layer, click another layer to
   select and move it, wheel to zoom
5. Set the **curve resolution** (see below) and **export as .lac**, then open
   the file in Bambu Suite. The pen-draw process (KCPenDraw) and the material
   "Generic 80g Printer Paper" are pre-assigned; the material is easy to change
   inside the Suite.

## Layers

The studio treats everything as layers on one mat. Use the **layers panel** at
the top of the sidebar to add layers (**+ Text**, **+ Image**), select, rename
(double-click), toggle visibility, reorder (↑/↓), duplicate, lock and delete.
The properties below the panel are contextual to the selected layer — Text /
Font / Handwriting variation for text layers, Image / Style for image layers.
On export, the default grouping is **one object per layer** (also "everything
as one object", or per-line / per-letter for text layers). `.lac`, SVG and the
thumbnail include every visible layer.

## Capture your own handwriting

Click **"Capture your handwriting …"** in a text layer's font section (or open
`app/index.html?panel=capture`). It opens the capture modal: write each letter
with mouse/trackpad/stylus onto the guide lines and save **multiple variants
per character** — when writing, the app picks a random variant per occurrence
(on top of the regular variation). The dashed green line sets the advance
width. **"Apply & close"** stores the font and selects it in the calling text
layer. Everything autosaves in the browser (localStorage, key `hw_fonts`);
"Save as file" exports a `.handschrift.json` backup.

## Capture handwriting via paper template (PDF → pen → scan)

More comfortable than a trackpad: print the template and fill it in with a
real pen.

Print the template (`vorlage.pdf`, linked inside the capture modal) at 100 %
scale, fill it in with a dark pen, photograph or scan it — and import the
images right in the capture modal via **"Import filled-in scans"**. The entire
image pipeline runs in the browser (`app/scan.js`); recognized letters land as
variants in the current font, where every glyph can be reviewed and touched up.
(The curve resolution affects newly-scanned glyphs; already-saved variants are
baked assets.)

The same importer also exists as a CLI:

```bash
python3 tools/handschrift_vorlage.py --varianten 3   # regenerates vorlage.pdf
python3 tools/handschrift_scan.py scan1.jpg scan2.jpg --name "My Handwriting"
```

The corner markers on the template automatically correct skew, perspective
and print scaling; the page-ID boxes detect which page was photographed
(order does not matter). Empty cells are skipped. The ink is skeletonized to
its centerline — the pen draws real writing strokes, not outlines.

## Image layers

Add an **image layer** (+ Image, or `app/index.html?layer=image`) and load a
photo/image to convert it into pen-drawing paths. Six styles: parallel lines,
cross hatching, squiggle lines, spiral, ASCII art (drawn with single-line fonts
or your own handwriting) and contours (edge detection). With
brightness/contrast/invert controls and all style-specific settings. Image
layers sit on the same mat as text layers, drag to reposition and export to
.lac/SVG alongside them.

## Curve resolution

A single project-wide **curve resolution** control in the export section (five
steps: Coarse · Reduced · Standard · Fine · Very fine) governs how finely
curves are resolved into points. It updates the preview, the point count in the
status bar, the `.lac` and the SVG live (true WYSIWYG). It centrally drives what
used to be hardcoded per tool: TTF bezier flattening, the line-jitter
subdivision, the sampling step of every image style, and the smoothing of
newly-scanned handwriting. Fine = smoother curves but larger files and longer
plots; "Standard" (3) matches the previous behavior. It is not the same as the
per-style density sliders (line/turn spacing) — those set how tightly the paths
are packed, resolution sets the point density along each path.

## Project structure

- `app/index.html` — the Layer Studio (shell markup, canvas, capture modal)
- `app/handschrift.html` / `app/bild.html` — thin redirect stubs into the
  studio (`?panel=capture` / `?layer=image`), kept so old external links work
- `app/layers.js` — layer model, type registry, cross-layer export grouping
- `app/text-layer.js` — text layer type (layout, variation, fonts, TTF import,
  hit-testing)
- `app/image-layer.js` — image layer type (the six drawing styles, edge
  detection, tracing)
- `app/capture.js` — handwriting-capture modal (variants per character, scan
  import)
- `app/studio.js` — shell wiring (state, canvas, layers panel, properties,
  export, i18n, tour, URL params)
- `app/lac.js` — shared .lac export (ZIP writer, PathObjects, processes) plus
  the curve-resolution funnel (`quality`, `resampleStrokes`, `rdp`)
- `app/scan.js` — in-browser scan import (port of handschrift_scan.py)
- `app/ui.js` — dark mode, onboarding tours, language switching (DE/EN), icons
- `app/fonts.js` — generated font data (do not edit by hand)
- `app/configs.js` — generated machine/material/process configs (A2L)
- `tools/convert_fonts.py` — SVG fonts → `fonts.js`
- `tools/build_configs.py` — Bambu Suite presets → `configs.js`
- `tools/handschrift_vorlage.py` — printable PDF template + layout file
- `tools/handschrift_scan.py` — scan → centerline strokes → `.handschrift.json`
- `tools/test_*.mjs` — end-to-end tests (Playwright) driving the studio
- `tools/svg_fonts/` — source fonts (Hershey/EMS, SIL OFL, from
  techninja/hersheytextjs)

## The .lac format (short version, reverse-engineered)

A `.lac` file is a ZIP (OPC) containing:

- `2D/2dmodel.json` — `canvas_list` with `obj_list` (objects) and
  `components` (placement as affine `"a b c d tx ty"`). Vector paths are
  `PathObject`s with `path_data` (`M x y L x y …`, absolute coordinates in
  mm, y pointing down, origin at the top-left of the work area; multiple `M`
  commands = multiple subpaths).
- `Metadata2D/project_settings.json` — `object_settings` (`process_type`,
  e.g. `KCPenDraw`) and `making_batch_list` (material + plate placement,
  `process_category: 4` = DRAW). **Must not be empty**, otherwise the Suite
  refuses to load the file.
- `Metadata2D/*.config` — flattened machine/material/process presets. The
  machine config must be the runtime-enriched version the Suite writes
  itself (the presets on disk are incomplete); `build_configs.py` pulls it
  from the most recent Suite autosave project.

## Regenerating

```bash
python3 tools/convert_fonts.py    # re-convert the fonts
python3 tools/build_configs.py   # re-pull configs from Bambu Suite presets
node tools/test_export.mjs       # E2E test (screenshot + .lac to /tmp/lac_test)
```

Tested with Bambu Suite 1.3 (FileVersion 01.03.00.00) on macOS, June 2026.
