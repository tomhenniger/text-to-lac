// Gemeinsamer .lac-Export (genutzt von index.html und bild.html)
// Benötigt window.LAC_CONFIGS (configs.js).
"use strict";
(function () {
  function fmtN(n) { return (Math.round(n * 10000) / 10000).toString(); }

  function buildPathData(strokes) {
    const d = [];
    for (const st of strokes) {
      d.push("M " + fmtN(st[0][0]) + " " + fmtN(st[0][1]));
      for (let i = 1; i < st.length; i++) d.push("L " + fmtN(st[i][0]) + " " + fmtN(st[i][1]));
    }
    return d.join(" ");
  }

  /* --------- Mini-ZIP-Writer (ohne Kompression, mit CRC32) --------- */
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(data) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function makeZip(files) {  // files: [{name, data:Uint8Array}]
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name);
      const crc = crc32(f.data), sz = f.data.length;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true);
      lh.setUint16(6, 0x0800, true);                       // UTF-8-Flag
      lh.setUint16(8, 0, true);                            // store
      lh.setUint32(14, crc, true); lh.setUint32(18, sz, true); lh.setUint32(22, sz, true);
      lh.setUint16(26, name.length, true);
      parts.push(new Uint8Array(lh.buffer), name, f.data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, sz, true); ch.setUint32(24, sz, true);
      ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + sz;
    }
    const cdSize = central.reduce((a, p) => a + p.length, 0);
    const eocd = new DataView(new ArrayBuffer(22));
    eocd.setUint32(0, 0x06054b50, true);
    eocd.setUint16(8, files.length, true); eocd.setUint16(10, files.length, true);
    eocd.setUint32(12, cdSize, true); eocd.setUint32(16, offset, true);
    const out = new Uint8Array(offset + cdSize + 22);
    let pos = 0;
    for (const p of [...parts, ...central, new Uint8Array(eocd.buffer)]) { out.set(p, pos); pos += p.length; }
    return out;
  }

  /**
   * Baut die komplette .lac-Datei.
   * groups: [{name, strokes: [[[x,y],...], ...]}]  — Koordinaten in mm,
   *         Ursprung Arbeitsbereich oben links, y nach unten.
   * opts: {matW, matH, processType, flipY, thumbnail: Uint8Array|null}
   */
  function makeLac(groups, opts) {
    const CFG = window.LAC_CONFIGS;
    const { matW: W, matH: H, processType = "KCPenDraw", flipY = false, thumbnail = null } = opts;
    const objList = [], components = [], objectSettings = [], plateComponents = [];
    let oid = 16;
    for (const grp of groups) {
      const strokes = flipY ? grp.strokes.map(st => st.map(([x, y]) => [x, H - y])) : grp.strokes;
      let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
      for (const st of strokes) for (const [x, y] of st) {
        minx = Math.min(minx, x); miny = Math.min(miny, y);
        maxx = Math.max(maxx, x); maxy = Math.max(maxy, y);
      }
      const mcx = (minx + maxx) / 2, mcy = (miny + maxy) / 2;
      const local = strokes.map(st => st.map(([x, y]) => [x - mcx, y - mcy]));
      objList.push({
        color: "0 0 0 255",
        flags: ["FreeAspectRatio"],
        is_closed: false,
        name: grp.name,
        obj_id: oid,
        path_data: buildPathData(local),
        type: "PathObject",
      });
      components.push({ obj_id: oid, transform: `1 0 0 1 ${fmtN(mcx)} ${fmtN(mcy)}` });
      objectSettings.push({ obj_id: oid, process_type: processType });
      plateComponents.push({ obj_id: oid, transform: `1 0 0 1 ${fmtN(mcx)} ${fmtN(mcy)}` });
      oid += 1;
    }

    const model = {
      Application: "Bambu Suite",
      FileVersion: "01.03.00.00",
      canvas_list: [{ components, index: 1, name: "", obj_list: objList, type_count: {} }],
    };
    const projectSettings = {
      canvas_settings: [{
        index: 1,
        making_batch_list: [{
          auto_arranged: false,
          batch_settings: { classVersion: 3, material_thickness: CFG.material_thickness, processing_mode: "PLANE" },
          making_plate_list: [{
            components: plateComponents,
            name: "", obj_id: 14, plate_mirror: false,
            plate_settings: { classVersion: 3 },
          }],
          material_id: CFG.material_id,
          material_name: CFG.material_name,
          material_settings_name: CFG.material_name,
          name: "", obj_id: 10, process_category: 4,
        }],
        object_settings: objectSettings,
      }],
      project_settings: { classVersion: 3, machine_settings_name: CFG.machine_name, version: null },
    };
    const entry = { Application: "Bambu Suite", FileVersion: "01.03.00.00" };
    const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
 <Default Extension="png" ContentType="image/png"/>
 <Default Extension="gcode" ContentType="text/x.gcode"/>
</Types>`;
    const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/2D/design_thumbnail.png" Id="rel-1" Type=""></Relationship>
</Relationships>`;

    const enc = new TextEncoder();
    const files = [
      { name: "[Content_Types].xml", data: enc.encode(contentTypes) },
      { name: "_rels/.rels", data: enc.encode(rels) },
      { name: "2D/entry.json", data: enc.encode(JSON.stringify(entry, null, 4)) },
      { name: "2D/2dmodel.json", data: enc.encode(JSON.stringify(model, null, 4)) },
      { name: "Metadata2D/project_settings.json", data: enc.encode(JSON.stringify(projectSettings, null, 4)) },
    ];
    if (thumbnail) files.push({ name: "2D/design_thumbnail.png", data: thumbnail });
    for (const [fname, cfg] of Object.entries(CFG.files))
      files.push({ name: "Metadata2D/" + fname, data: enc.encode(JSON.stringify(cfg, null, 4)) });
    return makeZip(files);
  }

  function download(bytes, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  window.LacExport = { fmtN, buildPathData, makeZip, makeLac, download };
})();
