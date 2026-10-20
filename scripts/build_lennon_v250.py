"""Photo-supported street facade correction on retained John-Lennon LoD2 faces."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from build_schools_places_v205 import Face, group

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
OWNER = "DEBE01YYK000064P"
OFFSET = 6.91
ORIGIN = [2260, 0, -1280]
PARTS = [
  ("DEBE3DFucwNVb5yo", 3, 3, "west-wing"),
  ("DEBE3DiYZXTnrOKW", 3, 4, "west-risalit"),
  ("DEBE3DtudQ0mhyFj", 14, 8, "central-upper"),
  ("DEBE3DgJLSy5nmlN", 9, 4, "east-risalit"),
  ("DEBE3DBPHreZIugj", 2, 3, "east-wing"),
]
COLORS = [0xDDD3AB, 0xC8BE99, 0xEEE6C9, 0xA6A58D, 0x71898B, 0x365855, 0xC5D2C4]


def read(path: Path) -> dict:
  """Read frozen source or authored JSON."""
  return json.loads(path.read_text())


def fingerprint(rows: list) -> list[int]:
  """Two independently seeded 32-bit hashes of fixed-precision numeric rows."""
  a, b = 2166136261, 5381
  text = ";".join(",".join(f"{float(v):.6f}" for v in row) for row in rows)
  for char in text:
    a = ((a ^ ord(char)) * 16777619) & 0xFFFFFFFF
    b = ((b * 33) ^ ord(char)) & 0xFFFFFFFF
  return [len(rows), a, b]


def previous() -> dict:
  """Exact immutable authored receipt; no source packet ownership changes."""
  a = read(DATA / "schoolsV185.json")
  s = next(s for s in a["schools"] if s["owner"] == OWNER)
  b = next(
    s for s in read(DATA / "schoolsPlacesV205.json")["schools"] if s["owner"] == OWNER
  )
  c = next(
    s for s in read(DATA / "centralNamedV230.json")["sites"] if s["owner"] == OWNER
  )
  return {
    "v185": {
      "boxes": fingerprint(a["boxes"][s["firstBox"] : s["firstBox"] + s["boxCount"]]),
      "nativeRows": fingerprint(
        a["nativeRows"][s["firstNative"] : s["firstNative"] + s["nativeCount"]]
      ),
    },
    "v205": {key: fingerprint(b[key]) for key in ["boxes", "rods", "nativeRows"]},
    "v230": {key: fingerprint(c[key]) for key in ["boxes", "rods", "nativeRows"]},
  }


def source_subset() -> dict:
  """Keep exact selected sheet vertices and the full owner's immutable digest."""
  path = GEO / "alt-mitte-v169/source-391_5821-00.json.gz"
  parent = next(
    b
    for b in json.loads(gzip.decompress(path.read_bytes()))["buildings"]
    if b["id"] == OWNER
  )
  faces = []
  specs = PARTS + [
    ("DEBE3DwpxjBAZhN6", n, 0, f"portal-base-{n}") for n in [2, 3, 4, 6, 9]
  ]
  for pid, index, bays, key in specs:
    part = next(p for p in parent["parts"] if p["id"] == pid)
    sheet = part["surfaces"][index]
    points = np.array(sheet["rings"][0])
    normal = sum(
      (
        np.cross(points[i] - points[0], points[i + 1] - points[0])
        for i in range(1, len(points) - 1)
      ),
      np.zeros(3),
    )
    normal /= np.linalg.norm(normal)
    faces.append(
      {
        "partId": pid,
        "sheetIndex": index,
        "key": key,
        "bays": bays,
        "normal": normal.tolist(),
        "rings": [[[x, y + OFFSET, z] for x, y, z in ring] for ring in sheet["rings"]],
      }
    )
  paths = [
    path,
    GEO / "schools-v185-evidence.json",
    DATA / "schoolsV185.json",
    DATA / "schoolsPlacesV205.json",
    DATA / "centralNamedV230.json",
  ]
  return {
    "owner": OWNER,
    "terrainOffsetY": OFFSET,
    "partCountRetained": len(parent["parts"]),
    "sourceHashes": {
      str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
      for p in paths
    },
    "faces": faces,
    "sources": [
      {
        "url": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09080444",
        "role": "Heritage identity: Blankenstein school, 1885",
      },
      {
        "url": "https://jlgym-berlin.de/jlg/index.php/node/25",
        "role": "School identity and current public address: Zehdenicker Strasse 17",
      },
      {
        "url": "https://commons.wikimedia.org/wiki/File:Berlin_Mitte_Zehdenicker_Stra%C3%9Fe_17_(09080444).JPG",
        "author": "Kvikk",
        "license": "CC BY-SA 3.0",
        "date": "2013-03-03",
        "role": "Reference-only public exterior: pale plaster, four occupied levels, round upper heads, segmental lower heads, three dark central portals; no pixels bundled",
      },
    ],
    "limits": "Source wall vertices/offset are measured; four occupied levels and material/head/portal cues are photograph-supported. Window spacing, exact colours, elevations and small fittings are proportional display estimates, not an opening survey. No rear-wing invention.",
  }


def build() -> None:
  """Generate compact finite members and exact correction receipts."""
  source = source_subset()
  g = group("John-Lennon-Gymnasium", OWNER)
  levels = [12.7, 17.05, 21.4, 26.15]
  portals = []
  for raw in source["faces"]:
    f = Face(g, raw["rings"], raw["normal"])
    mid, length = (f.left + f.right) / 2, f.right - f.left
    low, high = f.base + 0.025, f.top - 0.04
    # A shallow facing on precisely the source wall; it never bridges the
    # measured ground-storey recesses or courtyard and leaves the roof intact.
    f.member(mid, (low + high) / 2, length - 0.08, high - low, COLORS[0], 0.055, 0.53)
    if not raw["bays"]:
      f.member(mid, f.base + 0.27, length - 0.15, 0.48, COLORS[3], 0.06, 0.59)
      # Three actual dark central door readings; the side doors use the
      # retained recessed wall segments, the middle door the central plane.
      if raw["sheetIndex"] in [3, 4, 9]:
        w = min(3.15, length - 0.45)
        y, h = f.base + 1.52, 2.85
        f.member(mid, y, w, h, COLORS[5], 0.07, 0.65)
        for dx in [-w / 2, w / 2, 0]:
          f.member(mid + dx, y, 0.09, h, COLORS[3], 0.07, 0.72)
        f.member(mid, y + 0.64, w, 0.09, COLORS[3], 0.07, 0.72)
        first_rod, first_native = len(g["rods"]), len(g["nativeRows"])
        f.arch(mid, y + h / 2 + 0.03, w + 0.12, 0.30, COLORS[1])
        for row in g["nativeRows"][first_native:]:
          row[0] += f.n[0] * 0.36
          row[2] += f.n[2] * 0.36
        for rod in g["rods"][first_rod:]:
          # Face.arch's standard depth is too shallow for this corrected skin.
          for k in [0, 3]:
            rod[k] += f.n[0] * 0.36
            rod[k + 2] += f.n[2] * 0.36
        portals.append(
          {
            "partId": raw["partId"],
            "sheetIndex": raw["sheetIndex"],
            "center": f.point(mid, y, 0.65),
            "width": w,
          }
        )
      continue
    # Continuous rendered base/eave/cornice follows each measured wall;
    # no roof cap or fabricated gable is added.
    for y, w, h, c in [
      (f.top - 0.20, length - 0.1, 0.18, COLORS[1]),
      (f.top - 0.48, length - 0.1, 0.10, COLORS[2]),
      (15.02, length - 0.1, 0.18, COLORS[1]),
      (15.24, length - 0.1, 0.055, COLORS[2]),
    ]:
      f.member(mid, y, w, h, c, 0.10, 0.65)
    for u in [f.left + 0.16, f.right - 0.16]:
      f.member(u, (low + high) / 2, 0.16, high - low, COLORS[1], 0.08, 0.63)
    pitch = length / raw["bays"]
    for level, y in enumerate(levels):
      if y - 1.55 < f.base:
        continue
      h = 2.80 if level < 3 else 3.35
      w = min(1.7, pitch * 0.61)
      for bay in range(raw["bays"]):
        u = f.left + (bay + 0.5) * pitch
        f.member(u, y, w, h, COLORS[4], 0.055, 0.66)
        for dx in [-w / 2, w / 2, 0]:
          f.member(u + dx, y, 0.075, h, COLORS[2], 0.065, 0.73)
        for dy in [-h / 2, h / 2, 0.45]:
          f.member(u, y + dy, w + 0.10, 0.07, COLORS[2], 0.065, 0.73)
        f.member(u, y - h / 2 - 0.12, w + 0.28, 0.13, COLORS[1], 0.14, 0.72)
        # Segmented round upper heads; shallow segmental heads below.
        rise = w / 2 if level == 3 else 0.22
        for j in range(8):
          a, b = math.pi * j / 8, math.pi * (j + 1) / 8
          aa = (u + (w / 2 + 0.06) * math.cos(a), y + h / 2 + 0.04 + rise * math.sin(a))
          bb = (u + (w / 2 + 0.06) * math.cos(b), y + h / 2 + 0.04 + rise * math.sin(b))
          before, first_native = len(g["rods"]), len(g["nativeRows"])
          f.stroke(aa, bb, COLORS[1], 0.11)
          for row in g["nativeRows"][first_native:]:
            row[0] += f.n[0] * 0.36
            row[2] += f.n[2] * 0.36
          if len(g["rods"]) > before:
            r = g["rods"][-1]
            for k in [0, 3]:
              r[k] += f.n[0] * 0.36
              r[k + 2] += f.n[2] * 0.36
        if level == 3:
          # Actual curved glass above the spring line, represented as clipped
          # strips rather than a rectangular black window hole.
          for j in range(5):
            yy = rise * (j + 0.5) / 5
            ww = w * math.sqrt(max(0, 1 - (yy / rise) ** 2))
            f.member(u, y + h / 2 + yy, ww, rise / 5 + 0.015, COLORS[4], 0.05, 0.66)
          f.member(u, y + h / 2 + rise / 2, 0.075, rise, COLORS[2], 0.065, 0.73)
        f.member(u - w * 0.31, y - 0.06, 0.05, h - 0.2, COLORS[6], 0.04, 0.76)
    # Small square vents below the roof edge, distinct from occupied floors.
    for bay in range(raw["bays"]):
      f.member(
        f.left + (bay + 0.5) * pitch, f.top - 1.20, 0.40, 0.27, COLORS[3], 0.06, 0.68
      )

  # Compact integer storage retains millimetre coordinates, 0.001 m dimensions
  # and 1e-6-rad yaw. All original LoD2 data stays unchanged.
  def pack(row: list, kind: str) -> list:
    if kind == "rods":
      return [round((row[i] - ORIGIN[i % 3]) * 1000) for i in range(6)] + [
        round(row[6] * 1000),
        COLORS.index(row[7]),
      ]
    xyz = [round((row[i] - ORIGIN[i]) * 1000) for i in range(3)]
    dims = [round(v * 1000) for v in row[3:6]]
    return (
      xyz
      + dims
      + ([round(row[6] * 1e6)] if kind == "boxes" else [])
      + [COLORS.index(row[-1])]
    )

  payload = {
    "schemaVersion": 1,
    "owner": OWNER,
    "name": g["name"],
    "origin": ORIGIN,
    "colors": COLORS,
    "boxes": [pack(r, "boxes") for r in g["boxes"]],
    "rods": [pack(r, "rods") for r in g["rods"]],
    "nativeRows": [pack(r, "native") for r in g["nativeRows"]],
    "previous": previous(),
    "counts": {
      "drawn": len(g["boxes"]) + len(g["rods"]),
      "native": len(g["nativeRows"]),
      "occupiedLevels": 4,
      "portals": len(portals),
    },
  }
  evidence = {
    **source,
    "portals": portals,
    "levels": levels,
    "oldAuthored": payload["previous"],
    "faceAudit": g["faces"],
    "policy": "Only three exact older authored detail groups yield; measured source body/roof/court packets and every unrelated detail remain unchanged.",
  }
  (DATA / "lennonV250.json").write_text(
    json.dumps(payload, separators=(",", ":")) + "\n"
  )
  (GEO / "lennon-v250-evidence.json").write_text(json.dumps(evidence, indent=2) + "\n")
  print(
    json.dumps(
      {
        **payload["counts"],
        "jsonBytes": (DATA / "lennonV250.json").stat().st_size,
        "gpuBytes": [payload["counts"][k] * 76 for k in ["drawn", "native"]],
      }
    )
  )


if __name__ == "__main__":
  build()
