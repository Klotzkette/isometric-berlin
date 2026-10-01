"""Step 10: complete official Spanish Embassy shell and bounded facade recognition."""

from __future__ import annotations

import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import numpy as np
from build_breitscheid_towers_v161 import normal_of, triangles_for
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_387_5819.zip"
DEST = ROOT / "src/app/src/data/spanishEmbassyV164Source.json"
PARENT = "DEBE01YYK0002NgP"
GROUND = 5.2
NS = {
  "b": "http://www.opengis.net/citygml/building/1.0",
  "g": "http://www.opengis.net/gml",
}
LEGACY_IDS = {"yIGjF11M", "DC13dOb2", "xytVlQkz", "IMvGGC26", "aRtl1pZV", "K0003Ul3"}
PORTICO_PARENT = "DEBE01YYK0003Ul3"
FRONT = (-1782.2995, 892.328)


def facade(rings: list[list[list[float]]]) -> list[list[float]]:
  """Clipped estimates, distinct from the complete measured wall underneath."""
  n = normal_of(rings[0])
  if abs(n[1]) > 0.01:
    return []
  a, b = max(
    ((a, b) for a in rings[0] for b in rings[0]),
    key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
  )
  base = np.array(a)
  d = np.array([b[0] - a[0], 0, b[2] - a[2]])
  length = float(np.linalg.norm(d))
  if length < 2:
    return []
  d /= length
  rs = [[(float(np.dot(np.subtract(p, base), d)), p[1]) for p in r] for r in rings]
  poly = Polygon(rs[0], rs[1:]).buffer(-0.04)
  yaw = math.atan2(-d[2], d[0])
  rows = []

  def emit(u, y, w, h, dep, color, role, offset=0.08):
    p = base + d * u + n * offset
    rows.append(
      [round(float(v), 4) for v in [p[0], y, p[2], w, h, dep, yaw]] + [color, role]
    )

  central_front = (
    n[2] < -0.95
    and -1788 < (a[0] + b[0]) / 2 < -1776
    and max(p[2] for p in rings[0]) < 894
  )
  count = max(1, round(length / 3.7))
  dx = length / count
  for floor, (y, h) in enumerate(
    [(8.25, 2.0), (12.3, 3.4), (17.25, 3.1), (22.45, 2.25)]
  ):
    for col in range(count):
      if central_front:
        continue  # Three central doors and balcony openings are authored below.
      u, w = (col + 0.5) * dx, min(1.85, dx * 0.53)
      if not poly.covers(
        box(u - w / 2 - 0.12, y - h / 2 - 0.15, u + w / 2 + 0.12, y + h / 2 + 0.15)
      ):
        continue
      emit(u, y, w, h, 0.10, 0x34413E, 1)
      for du in [-w / 2 - 0.055, w / 2 + 0.055]:
        emit(u + du, y, 0.12, h + 0.27, 0.19, 0xBDB7A5, 2, 0.13)
      emit(u, y - h / 2 - 0.10, w + 0.38, 0.16, 0.36, 0xB4AB96, 2, 0.20)
      emit(u, y + h / 2 + 0.10, w + 0.27, 0.15, 0.25, 0xCAC4B4, 2, 0.15)
      emit(u, y, 0.055, h, 0.15, 0x92988C, 2, 0.17)
      emit(
        u, y + (h * 0.12 if floor in [1, 2] else 0), w, 0.055, 0.15, 0x93998D, 2, 0.17
      )
  # Fine joints on the ground-storey stone base, and surveyed-wall-bound cornices.
  for y, h, dep, color in [
    (6.25, 0.025, 0.045, 0x9A978D),
    (7.2, 0.025, 0.045, 0x9A978D),
    (8.15, 0.025, 0.045, 0x9A978D),
    (9.12, 0.025, 0.045, 0x9A978D),
    (9.65, 0.18, 0.26, 0xBDB6A4),
    (24.9, 0.18, 0.25, 0xCEC7B6),
    (25.65, 0.26, 0.40, 0xC9C2B1),
  ]:
    segment = poly.intersection(box(-0.1, y - h / 2, length + 0.1, y + h / 2))
    if segment.is_empty:
      continue
    for p in getattr(segment, "geoms", [segment]):
      if p.area <= 0 or p.bounds[2] - p.bounds[0] < 0.4:
        continue
      lo, _, hi, _ = p.bounds
      emit((lo + hi) / 2, y, hi - lo, h, dep, color, 3, 0.06 + dep / 2)
  return rows


def make_payload() -> dict:
  with zipfile.ZipFile(SOURCE) as z:
    tree = ET.fromstring(z.read(z.namelist()[0]))
  parent = next(
    b
    for b in tree.findall(".//b:Building", NS)
    if b.get("{" + NS["g"] + "}id") == PARENT
  )
  datum = min(
    float(v)
    for e in parent.findall(".//b:GroundSurface//g:posList", NS)
    for v in e.text.split()[2::3]
  )
  # LoD2 models the photographed open four-column porch as a separate solid
  # building envelope. Retain every measured ring as evidence, but let the
  # authored columns/balcony own its display instead of closing the porch.
  portico = next(
    b
    for b in tree.findall(".//b:Building", NS)
    if b.get("{" + NS["g"] + "}id") == PORTICO_PARENT
  )
  portico_surfaces = []
  for boundary in portico.findall("b:boundedBy", NS):
    for surface in boundary:
      for polygon in surface.findall(".//g:Polygon", NS):
        rings = []
        for positions in polygon.findall(".//g:posList", NS):
          values = [float(v) for v in positions.text.split()]
          ring = [
            [
              round(values[i] - 389500, 3),
              round(values[i + 2] - datum + GROUND, 3),
              round(5820000 - values[i + 1], 3),
            ]
            for i in range(0, len(values), 3)
          ]
          if ring[0] == ring[-1]:
            ring.pop()
          rings.append(ring)
        portico_surfaces.append({"kind": surface.tag.split("}")[-1], "rings": rings})
  out = {
    "schemaVersion": 1,
    "groundY": GROUND,
    "parentId": PARENT,
    "groundNHN": datum,
    "archive": {
      "url": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_387_5819.zip",
      "sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
      "licence": "dl-de/zero-2-0",
    },
    "sourceStatus": "All five official building parts and source rings retained; the separate solid LoD2 portico envelope is retained as evidence but represented by its photographed open columns and balcony. Windows, joints and portico ornament are bounded photographic/heritage-informed display estimates.",
    "replacedPorticoEnvelope": {
      "id": PORTICO_PARENT,
      "legacyId": "K0003Ul3",
      "sourceSurfaces": portico_surfaces,
      "displayOwner": "Four-column embassy portico current coat of arms and balcony",
      "reason": "Photographs and heritage description show open columns, not the enclosing walls implied by the separate LoD2 solid envelope.",
    },
    "parts": [],
    "surfaces": [],
    "facadeBoxes": [],
    "nativeBlocks": [],
  }
  blocks = {}
  for part in parent.findall(".//b:BuildingPart", NS):
    sid = part.get("{" + NS["g"] + "}id")
    surfaces, foot = [], []
    for boundary in part.findall("b:boundedBy", NS):
      for s in boundary:
        kind = s.tag.split("}")[-1]
        for p in s.findall(".//g:Polygon", NS):
          rings = []
          for e in p.findall(".//g:posList", NS):
            v = [float(x) for x in e.text.split()]
            ring = [
              [
                round(v[i] - 389500, 3),
                round(v[i + 2] - datum + GROUND, 3),
                round(5820000 - v[i + 1], 3),
              ]
              for i in range(0, len(v), 3)
            ]
            if ring[0] == ring[-1]:
              ring.pop()
            rings.append(ring)
          surfaces.append({"kind": kind, "rings": rings})
          if kind == "GroundSurface":
            foot.append(
              Polygon(
                [(p[0], p[2]) for p in rings[0]],
                [[(p[0], p[2]) for p in r] for r in rings[1:]],
              )
            )
    points = [p for s in surfaces for r in s["rings"] for p in r]
    fp = unary_union(foot)
    polygons = list(fp.geoms) if hasattr(fp, "geoms") else [fp]
    out["parts"].append(
      {
        "id": sid,
        "parentId": PARENT,
        "name": "Spanische Botschaft",
        "rings": [[list(p) for p in po.exterior.coords[:-1]] for po in polygons],
        "holes": [
          [[list(p) for p in ring.coords[:-1]] for ring in po.interiors]
          for po in polygons
        ],
        "groundY": min(p[1] for p in points),
        "topY": max(p[1] for p in points),
        "sourceSurfaces": surfaces,
      }
    )
    for s in surfaces:
      if s["kind"] not in ["WallSurface", "RoofSurface"]:
        continue
      triangles = triangles_for(s["rings"])
      color = 0x737C79 if s["kind"] == "RoofSurface" else 0xC3BFAF
      out["surfaces"].append(
        {"partId": sid, "kind": s["kind"], "color": color, "triangles": triangles}
      )
      if s["kind"] == "WallSurface":
        out["facadeBoxes"].extend(facade(s["rings"]))
      for tri in triangles:
        a, b, c = [np.array(p) for p in tri]
        steps = max(
          1,
          math.ceil(
            max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b))
            / 1.1
          ),
        )
        for i in range(steps + 1):
          for j in range(steps + 1 - i):
            p = a + (b - a) * i / steps + (c - a) * j / steps
            cell = (
              math.floor(p[0] / 2),
              math.floor((p[1] - GROUND) / 2),
              math.floor(p[2] / 2),
            )
            blocks[cell] = [
              cell[0] * 2 + 1,
              round(GROUND + cell[1] * 2 + 1, 3),
              cell[2] * 2 + 1,
              color,
            ]
  for x, y, z, w, h, _, yaw, color, role in out["facadeBoxes"]:
    if role != 1:
      continue
    for u in np.arange(-w / 2 + 0.2, w / 2, 0.7):
      for v in np.arange(-h / 2 + 0.2, h / 2, 0.7):
        cell = (
          math.floor((x + math.cos(yaw) * u) / 2),
          math.floor((y + v - GROUND) / 2),
          math.floor((z - math.sin(yaw) * u) / 2),
        )
        if cell in blocks:
          blocks[cell][3] = color
  out["nativeBlocks"] = list(blocks.values())
  core = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  out["legacyPrisms"] = [p for p in core if p["id"] in LEGACY_IDS]
  return out


def main() -> None:
  data = make_payload()
  DEST.write_text(json.dumps(data, separators=(",", ":")) + "\n")
  nav = {k: data[k] for k in ["groundY", "parentId", "legacyPrisms"]}
  nav["parts"] = [
    {k: v for k, v in p.items() if k != "sourceSurfaces"} for p in data["parts"]
  ]
  nav["roofTriangles"] = [
    t for s in data["surfaces"] if s["kind"] == "RoofSurface" for t in s["triangles"]
  ]
  roofs = {}
  for x, y, z, _ in data["nativeBlocks"]:
    roofs[x, z] = max(roofs.get((x, z), -100), y + 1)
  nav["nativeRoofCells"] = [[x, z, y] for (x, z), y in roofs.items()]
  DEST.with_name("spanishEmbassyV164Navigation.json").write_text(
    json.dumps(nav, separators=(",", ":")) + "\n"
  )
  print(
    {
      k: len(data[k])
      for k in ["parts", "surfaces", "facadeBoxes", "nativeBlocks", "legacyPrisms"]
    },
    DEST.stat().st_size,
  )


if __name__ == "__main__":
  main()
