# Handschrift — pen plotter tools for Bambu Lab

🇩🇪 **[Deutsche Version](README.de.md)** · Live: **https://handschrift.art**

**Handschrift** (German for "handwriting") is a web app suite that turns text
and images into `.lac` project files for Bambu Suite — for writing with the
pen holder of the A2L. Its main surface is the **Layer Studio**
(`app/studio.html`): a Photoshop-style layer compositor where every tool — text
(with your own captured handwriting), the image plotter, 3D, QR codes and more —
combines as a freely placeable layer, aligned and exported together into one
`.lac`. The landing page routes straight into it. The individual tool pages still
work standalone and double as the Studio's embedded layer engines. No server,
no build step: everything runs in your browser.

## Usage

Open `index.html` in a browser (double-click works, no server needed) — it
opens straight into the **Layer Studio** (`app/studio.html`; you can also open
that file directly). Or use the hosted version linked above. The individual tool
pages (`app/index.html`, `app/bild.html`, …) also still work standalone.

The text writer, whether inside the Studio (as a Text layer) or standalone:

1. Enter your **text** (multi-line; umlauts and ß work)
2. Pick a **font** — 18 built-in single-line fonts (Hershey/EMS, ideal for
   pens), your **own handwriting** (see below), or a TTF/OTF
   (drawn as outline, needs internet)
3. Tune the **handwriting variation**: rotation, size, baseline, spacing,
   slant and line jitter scatter per letter (deterministic via seed,
   "Reroll" creates a new variation)
4. **Arrange**: drag letters individually, click a letter to cycle its
   captured variants, drag a line or the whole block, wheel to zoom
5. **Export as .lac** and open the file in Bambu Suite. The pen-draw process
   (KCPenDraw) and the material "Generic 80g Printer Paper" are pre-assigned;
   the material is easy to change inside the Suite.

## Layer Studio

`app/studio.html` is the central surface. Add layers for text, your own
handwriting (via the Text layer), images, 3D models, QR codes and the other
tools; each layer is the corresponding tool page embedded via `?embed=1`,
streaming its computed strokes into the Studio. Move, scale, rotate and align
layers (with snapping and distribute helpers), set a per-layer plotter mode
(pen draw / cut) and color, then export everything together as one `.lac` or an
SVG. Layouts save to a `.handschrift` file and autosave to the browser.

**Curve resolution (Kurvenauflösung).** The **Datei** menu carries a single
export-wide setting (levels *Niedrig → Maximal*, default *Standard*) that
simplifies every layer's paths with a shared Ramer–Douglas–Peucker pass at the
export funnel — smaller `.lac` files and smoother/coarser curves, applied
identically across all layer types. It affects the live preview, the thumbnail,
the SVG and the `.lac` the same way; *Maximal (unverändert)* bypasses it for
byte-for-byte the original strokes. The chosen level is stored in the
`.handschrift` file and the autosave.

## Capture your own handwriting

`app/handschrift.html` (or the "Capture your handwriting" button in the text
tool): write each letter with mouse/trackpad/stylus onto the guide lines and
save **multiple variants per character** — when writing, the app picks a random
variant per occurrence (on top of the regular variation). The dashed green
line sets the advance width. Everything autosaves in the browser
(localStorage); "Save as file" exports a `.handschrift.json` backup.

Opened from **within the Layer Studio**, the button opens the capture page in a
**new tab** (so the Text layer keeps its identity); captured letters then appear
in the Studio's font picker automatically, no reload needed.

## Capture handwriting via paper template (PDF → pen → scan)

More comfortable than a trackpad: print the template and fill it in with a
real pen.

Print the template (`vorlage.pdf`, linked inside the capture page) at 100 %
scale, fill it in with a dark pen, photograph or scan it — and import the
images right in `app/handschrift.html` via **"Import filled-in scans"**. The
entire image pipeline runs in the browser (`app/scan.js`); recognized letters
land as variants in the current font, where every glyph can be reviewed and
touched up.

The same importer also exists as a CLI:

```bash
python3 tools/handschrift_vorlage.py --varianten 3   # regenerates vorlage.pdf
python3 tools/handschrift_scan.py scan1.jpg scan2.jpg --name "My Handwriting"
```

The corner markers on the template automatically correct skew, perspective
and print scaling; the page-ID boxes detect which page was photographed
(order does not matter). Empty cells are skipped. The ink is skeletonized to
its centerline — the pen draws real writing strokes, not outlines.

## Image plotter

`app/bild.html`: converts a photo/image into pen-drawing paths. Six styles:
parallel lines, cross hatching, squiggle lines, spiral, ASCII art (drawn with
single-line fonts or your own handwriting) and contours (edge detection).
With brightness/contrast/invert controls, live preview and .lac/SVG export
like the text writer.

## Project structure

- `app/studio.html` — the Layer Studio (central surface: layers, transform,
  align, `.handschrift` save/autosave, combined .lac/SVG export, Kurvenauflösung)
- `app/index.html` — the text writer (preview, variation, .lac/SVG export;
  also the Studio's Text-layer engine via `?embed=1`)
- `app/handschrift.html` — handwriting capture (variants per character)
- `app/bild.html` — image plotter (drawing styles; Studio's Image-layer engine)
- `app/misc.html` — misc tools (QR, SVG import, 3D/STL, spirograph, maze,
  function plotter, TSP stipple, audio waveform, …; Studio's Misc-layer engine)
- `app/embed.js` — embed contract (`?embed=1`): hides tool chrome and streams
  strokes to the Studio via postMessage
- `app/lac.js` — shared .lac export (ZIP writer, PathObjects, processes) plus the
  shared curve-resolution funnel (`rdp`/`resampleEps`/`resampleStrokes`)
- `app/scan.js` — in-browser scan import (port of handschrift_scan.py)
- `app/qrcode.js` — QR code generation (used by misc.html)
- `app/vendor/three.min.js` — Three.js (vendored, for the 3D/STL misc tool)
- `app/ui.js` — dark mode, onboarding tours, language switching (DE/EN)
- `app/fonts.js` — generated font data (do not edit by hand)
- `app/configs.js` — generated machine/material/process configs (A2L)
- `tools/convert_fonts.py` — SVG fonts → `fonts.js`
- `tools/build_configs.py` — Bambu Suite presets → `configs.js`
- `tools/handschrift_vorlage.py` — printable PDF template + layout file
- `tools/handschrift_scan.py` — scan → centerline strokes → `.handschrift.json`
- `tools/test_export.mjs` — end-to-end test (Playwright): preview + export
- `tools/test_handwriting.mjs` / `test_scan.py` / `test_scan_import.mjs` —
  tests for handwriting capture and the scan pipeline
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
