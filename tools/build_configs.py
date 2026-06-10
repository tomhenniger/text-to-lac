#!/usr/bin/env python3
"""Erzeugt app/configs.js mit Maschinen-/Material-/Prozess-Configs für den .lac-Export.

Liest die Bambu-Suite-Presets des Nutzers, löst 'inherits'-Ketten auf
(die Suite speichert in .lac-Dateien geflachte Configs mit from='project')
und bettet alles als window.LAC_CONFIGS ein.
"""
import json
import zipfile
from pathlib import Path

PRESET = Path.home() / "Library/Application Support/Bambu Suite/preset2d"
MACHINE = "Bambu Lab A2L"
MATERIAL = "Generic 80g Printer Paper"
PROCESS = f"{MATERIAL} Process @BBL A2L"
# Von der Suite angereicherte Maschinen-Configs (Presets auf Platte sind
# unvollständig — die Suite ergänzt Laufzeit-Defaults erst beim Speichern).
# Autosave-Projekte der Suite enthalten die vollständige Config.
PROJECTS = Path.home() / "Library/Application Support/Bambu Suite/projects"


def deep_merge(parent, child):
    out = dict(parent)
    for k, v in child.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def resolve_inherits(name, search_dirs):
    for d in search_dirs:
        p = d / f"{name}.json"
        if p.exists():
            data = json.loads(p.read_text())
            parent_name = data.pop("inherits", None)
            if parent_name:
                parent = resolve_inherits(parent_name, search_dirs)
                data = deep_merge(parent, data)
            return data
    raise FileNotFoundError(f"Preset nicht gefunden: {name}")


def main():
    mat_dir = PRESET / "Material" / MATERIAL

    machine = None
    candidates = sorted(PROJECTS.rglob("*.lac"), key=lambda p: p.stat().st_mtime, reverse=True)
    candidates += sorted(PROJECTS.rglob(".lac"), key=lambda p: p.stat().st_mtime, reverse=True)
    for lac in candidates:
        try:
            with zipfile.ZipFile(lac) as z:
                name = f"Metadata2D/{MACHINE}.config"
                if name in z.namelist():
                    machine = json.loads(z.read(name))
                    print(f"Maschinen-Config aus {lac} ({len(machine)} Keys)")
                    break
        except (zipfile.BadZipFile, OSError):
            continue
    if machine is None:
        machine = resolve_inherits(MACHINE, [PRESET / "BBL" / "machine"])
        print(f"WARNUNG: kein Suite-Projekt mit {MACHINE}-Config gefunden — "
              f"nutze Preset ({len(machine)} Keys, evtl. unvollständig)")
    material = resolve_inherits(MATERIAL, [mat_dir / "filament"])
    process = resolve_inherits(PROCESS, [mat_dir / "process", PRESET / "BBL" / "process"])

    for cfg in (machine, material, process):
        cfg["from"] = "project"

    out = {
        "machine_name": MACHINE,
        "material_name": MATERIAL,
        "material_id": material.get("material_id", ""),
        "material_thickness": material.get("material_thickness", 0.1),
        "process_name": PROCESS,
        "files": {
            f"{MACHINE}.config": machine,
            f"{MATERIAL}.config": material,
            f"{PROCESS}.config": process,
        },
    }
    dst = Path(__file__).parent.parent / "app" / "configs.js"
    dst.write_text(
        "// generiert von tools/build_configs.py — nicht von Hand editieren\n"
        "window.LAC_CONFIGS = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\n",
        encoding="utf-8")
    print(f"→ {dst} ({dst.stat().st_size // 1024} KB)")
    print("Maschine:", MACHINE, "| Material:", out["material_id"], "| Dicke:", out["material_thickness"])
    print("Prozess hat KCPenDraw:", "KCPenDraw" in process, "| KCPenDrawFill:", "KCPenDrawFill" in process)


if __name__ == "__main__":
    main()
