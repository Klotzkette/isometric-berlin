"""Retain complete Kranzler source bodies and prepare bounded facade detail."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import numpy as np
from build_bebelplatz_building_source import extract_parent, part_profile
from build_breitscheid_towers_v161 import normal_of, triangles_for
from shapely.geometry import Polygon, box

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_386_5818.zip"
DEST = ROOT / "src/app/src/data/kranzlerV165Source.json"
GROUND = 5.2
PARENTS = [
  "DEBE04YY50000CVU",
  "DEBE04YY50000BeN",
  "DEBE04AL3Sz00000",
  "DEBE04AL3Sz00003",
]
LEGACY = {"07959702", "19869019", "22986477", "19869017", "19869018"}


def facade(rings: list, glass: bool, rotunda: bool) -> list:
  normal = normal_of(rings[0])
  if abs(normal[1]) > 0.01:
    return []
  a, b = max(
    ((a, b) for a in rings[0] for b in rings[0]),
    key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
  )
  base = np.array(a)
  d = np.array([b[0] - a[0], 0, b[2] - a[2]], dtype=float)
  length = float(np.linalg.norm(d))
  if length < 0.3:
    return []
  d /= length
  wall = Polygon(
    [[(float(np.dot(np.subtract(p, base), d)), p[1]) for p in r] for r in rings][0]
  ).buffer(-0.02)
  out = []
  yaw = math.atan2(-d[2], d[0])

  def emit(u, y, w, h, color, offset=0.08, depth=0.09):
    if not wall.covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)):
      return
    p = base + d * u + normal * offset
    out.append(
      [
        round(p[0], 3),
        round(y, 3),
        round(p[2], 3),
        round(w, 3),
        round(h, 3),
        depth,
        round(yaw, 6),
        color,
      ]
    )

  bays = max(1, round(length / (1.45 if glass else 2.5)))
  pitch = length / bays
  levels = (
    [(16.8, 2.45)]
    if rotunda
    else [(GROUND + 2.4 + i * 3.62, 3.30) for i in range(17)]
    if glass
    else [(7.3, 3.1), (11.8, 3.3)]
  )
  for y, h in levels:
    for i in range(bays):
      u = (i + 0.5) * pitch
      emit(u, y, pitch - 0.13, h, 0x719199 if glass else 0x3D5354)
      emit(
        u - pitch / 2 + 0.065,
        y,
        0.085,
        h + 0.08,
        0xB9C8C6 if glass else 0xBFA777,
        0.15,
        0.11,
      )
      emit(
        u, y - h / 2, pitch - 0.06, 0.10, 0xB9C8C6 if glass else 0xC9B783, 0.15, 0.13
      )
      if glass:
        emit(u, y + 0.45, pitch - 0.10, 0.07, 0x9CB0B1, 0.14, 0.12)
  return out


def build() -> dict:
  parents, parts, surfaces, details, blocks = [], [], [], [], {}
  for pid in PARENTS:
    parent = extract_parent(ARCHIVE, pid)
    raw = [part_profile(p) for p in leaf_building_parts(parent) or [parent]]
    offset = GROUND - min(p["ground_y_m"] for p in raw)
    parents.append({"id": pid, "sourceParts": raw, "displayOffsetY": round(offset, 3)})
    for original in raw:
      p = json.loads(json.dumps(original))
      p["ground_y_m"] = round(p["ground_y_m"] + offset, 3)
      p["top_y_m"] = round(p["top_y_m"] + offset, 3)
      tower = pid == PARENTS[0]
      rotunda = p["id"] == "DEBE3DLFTNFlBMwO"
      for s in p["surfaces"]:
        for ring in s["rings"]:
          for q in ring:
            q[1] = round(q[1] + offset, 3)
        roof = s["kind"] == "RoofSurface"
        color = (
          0x747B77 if roof else 0x74909A if tower else 0x5E5A4F if rotunda else 0xD9D2BF
        )
        ts = triangles_for(s["rings"])
        surfaces.append(
          {"partId": p["id"], "kind": s["kind"], "color": color, "triangles": ts}
        )
        if not roof:
          details.extend(facade(s["rings"], tower, rotunda))
        for tri in ts:
          a, b, c = map(np.array, tri)
          n = max(
            1,
            math.ceil(
              max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b))
              / 0.8
            ),
          )
          for i in range(n + 1):
            for j in range(n + 1 - i):
              q = a + (b - a) * i / n + (c - a) * j / n
              k = (math.floor(q[0]), math.floor(q[1] - GROUND), math.floor(q[2]))
              if roof or k not in blocks:
                blocks[k] = [
                  k[0] + 0.5,
                  round(GROUND + k[1] + 0.5, 3),
                  k[2] + 0.5,
                  color,
                ]
      parts.append(p)
  # Paint the independent skin; do not add rotated smooth facade boxes in native.
  for x, y, z, w, h, _, yaw, color in details:
    if color not in (0x719199, 0x3D5354):
      continue
    for u in np.arange(-w / 2, w / 2, 0.6):
      for v in np.arange(-h / 2, h / 2, 0.6):
        k = (
          math.floor(x + math.cos(yaw) * u),
          math.floor(y + v - GROUND),
          math.floor(z - math.sin(yaw) * u),
        )
        if k in blocks:
          blocks[k][3] = color
  current = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  return {
    "schemaVersion": 1,
    "sourceUrl": "https://gdi.berlin.de/data/a_lod2/atom/" + ARCHIVE.name,
    "sourceSha256": hashlib.sha256(ARCHIVE.read_bytes()).hexdigest(),
    "license": "dl-de/zero-2-0",
    "groundY": GROUND,
    "parents": parents,
    "parts": parts,
    "surfaces": surfaces,
    "facadeBoxes": details,
    "nativeBlocks": list(blocks.values()),
    "legacyPrisms": [p for p in current if p["id"] in LEGACY],
    "detailStatus": "Complete official walls and roofs with rigid datum translation. Glazing divisions, metalwork and awning proportions are visual estimates using the listed free-license reference. Existing OSM source records retained; only five identified Kranzler envelopes replaced. No current tenant logos or removed courtyard aviaries invented.",
    "references": [
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09040517",
      "https://commons.wikimedia.org/wiki/File:Cafe_Kranzler_Berlin_Kurfuerstendamm.jpg",
      "https://www.openstreetmap.org/way/474593825",
    ],
  }


def main() -> None:
  data = build()
  cells = {}
  for x, y, z, _ in data["nativeBlocks"]:
    cells[(x, z)] = max(cells.get((x, z), -999), y + 0.5)
  nav = {
    "parts": [{k: v for k, v in p.items() if k != "surfaces"} for p in data["parts"]],
    "legacyPrisms": data["legacyPrisms"],
    "roofTriangles": [
      t for s in data["surfaces"] if s["kind"] == "RoofSurface" for t in s["triangles"]
    ],
    "nativeRoofCells": [[x, z, y] for (x, z), y in cells.items()],
  }
  DEST.with_name("kranzlerV165Navigation.json").write_text(
    json.dumps(nav, separators=(",", ":")) + "\n"
  )
  evidence = {
    k: data[k]
    for k in [
      "parents",
      "parts",
      "legacyPrisms",
      "sourceUrl",
      "sourceSha256",
      "license",
      "references",
      "detailStatus",
    ]
  }
  DEST.with_name("kranzlerV165Evidence.json").write_text(
    json.dumps(evidence, separators=(",", ":")) + "\n"
  )
  # Exact adjacent occupied cells can share an orthogonal prism; this removes
  # matrix/JSON duplication, never a visible cell or a palette boundary.
  runs = [
    [math.floor(x), round(y - GROUND - 0.5), math.floor(z), 1, 1, 1, c]
    for x, y, z, c in data["nativeBlocks"]
  ]
  for axis in [0, 2, 1]:
    groups = {}
    for r in runs:
      key = tuple(r[i] for i in range(7) if i not in [axis, axis + 3])
      groups.setdefault(key, []).append(r)
    runs = []
    for group in groups.values():
      group.sort(key=lambda r: r[axis])
      for r in group:
        if (
          runs
          and all(r[i] == runs[-1][i] for i in range(7) if i not in [axis, axis + 3])
          and runs[-1][axis] + runs[-1][axis + 3] == r[axis]
        ):
          runs[-1][axis + 3] += r[axis + 3]
        else:
          runs.append(r.copy())
  data["nativeCellCount"] = len(data["nativeBlocks"])
  data["nativeRuns"] = [
    [x + w / 2, round(GROUND + y + h / 2, 3), z + d / 2, w, h, d, c]
    for x, y, z, w, h, d, c in runs
  ]
  del data["nativeBlocks"], data["parents"], data["legacyPrisms"]
  data["parts"] = [{"id": p["id"]} for p in data["parts"]]
  DEST.write_text(json.dumps(data, separators=(",", ":")) + "\n")
  print({k: len(data[k]) for k in ["parts", "surfaces", "facadeBoxes", "nativeRuns"]})


if __name__ == "__main__":
  main()
