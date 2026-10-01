"""Keep the complete Huthmacher-Haus survey and add source-clipped recognition."""

from __future__ import annotations

import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import numpy as np
from build_breitscheid_towers_v161 import normal_of, triangles_for
from shapely.geometry import LineString, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_386_5818.zip"
DEST = ROOT / "src/app/src/data/huthmacherSource.json"
NS = {
  "b": "http://www.opengis.net/citygml/building/1.0",
  "g": "http://www.opengis.net/gml",
}
PARENT = "DEBE00YY1EZ0000e"
PRISM = "64359480"
GROUND = 5.2
DATUM = 34.143
WALL = 0xD1CEC0
WINDOWS = [0x546B6D, 0x637C7C, 0x718B8B]


def facade(rings: list[list[list[float]]], height: float) -> list[list[float]]:
  """Window ribbons and aluminium panel joints; not a surveyed facade plan."""
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
  if length < 4:
    return []
  d /= length
  coordinates = [
    [(float(np.dot(np.subtract(p, base), d)), p[1]) for p in r] for r in rings
  ]
  poly = Polygon(coordinates[0], coordinates[1:])
  yaw = math.atan2(-d[2], d[0])
  output: list[list[float]] = []

  def emit(
    u: float,
    y: float,
    w: float,
    h: float,
    color: int,
    role: int,
    out: float = 0.08,
    depth: float = 0.12,
  ) -> None:
    p = base + d * u + normal * out
    output.append(
      [
        round(p[0], 3),
        round(y, 3),
        round(p[2], 3),
        round(w, 3),
        round(h, 3),
        depth,
        round(yaw, 6),
        color,
        role,
      ]
    )

  tall = height > 54
  # Broad blank end panels are a characteristic of the clad tower. Short
  # surveyed return walls retain only panel joints rather than invented windows.
  ribbon = tall and length > 22
  pitch = 3.5
  for floor in range(16 if tall else 3):
    y = GROUND + 2.6 + floor * pitch
    pane_h = 2.25 if floor < 2 else 1.86
    band_y = y - pane_h / 2 - 0.48
    line = poly.intersection(LineString([(-1, band_y), (length + 1, band_y)]))
    for segment in (
      [line] if line.geom_type == "LineString" else getattr(line, "geoms", [])
    ):
      if segment.length > 0.5:
        lo, _, hi, _ = segment.bounds
        emit((lo + hi) / 2, band_y, hi - lo, 0.08, 0xB1B2AA, 2, 0.09, 0.10)
    if tall and not ribbon:
      continue
    bays = max(1, round(length / 3.0))
    spacing = length / bays
    for bay in range(bays):
      u = (bay + 0.5) * spacing
      width = spacing - 0.22
      pane = box(u - width / 2, y - pane_h / 2, u + width / 2, y + pane_h / 2)
      if not poly.buffer(-0.06).covers(pane):
        continue
      # The 16-storey window rhythm has continuous horizontal sills and slender
      # paired vertical divisions, not a curtain wall covering the spandrels.
      emit(u, y, width, pane_h, WINDOWS[(floor + bay) % len(WINDOWS)], 1)
      emit(u, y - pane_h / 2 - 0.08, width + 0.18, 0.12, 0xE4E0D0, 2, 0.16, 0.22)
      emit(u - width / 2, y, 0.08, pane_h + 0.10, 0xDEDCCF, 2, 0.16, 0.16)
      emit(u + 0.12, y, 0.07, pane_h, 0xDEDCCF, 2, 0.16, 0.14)
      if floor > 1 and (floor + bay) % 7 == 0:
        # A few recessed sun blinds are observed, with no image texture.
        emit(u, y + 0.54, width - 0.08, 0.66, 0x959A91, 2, 0.16, 0.10)
  # Blank end faces keep their thin rectangular panel-grid reading.
  if tall and not ribbon:
    for u in np.arange(1.65, length, 1.65):
      line = poly.intersection(LineString([(u, -10), (u, 100)]))
      for segment in (
        [line] if line.geom_type == "LineString" else getattr(line, "geoms", [])
      ):
        if segment.length > 0.5:
          _, lo, _, hi = segment.bounds
          emit(float(u), (lo + hi) / 2, 0.035, hi - lo, 0xB1B2AA, 2, 0.07, 0.06)
  return output


def make_payload() -> dict:
  with zipfile.ZipFile(SOURCE) as archive:
    tree = ET.fromstring(archive.read(archive.namelist()[0]))
  parent = tree.find(f'.//b:Building[@g:id="{PARENT}"]', NS)
  assert parent is not None
  current = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )
  legacy = [p for p in current["buildings"] if p["id"] == PRISM]
  assert len(legacy) == 1
  parts, surfaces, details, blocks = [], [], [], {}
  for part in parent.findall(".//b:BuildingPart", NS):
    sid = part.get(f"{{{NS['g']}}}id")
    all_surfaces, grounds = [], []
    height = float(part.findtext("b:measuredHeight", namespaces=NS))
    for boundary in part.findall("b:boundedBy", NS):
      for surface in boundary:
        kind = surface.tag.split("}")[-1]
        for polygon in surface.findall(".//g:Polygon", NS):
          rings = []
          for pos in polygon.findall(".//g:posList", NS):
            vals = [float(v) for v in pos.text.split()]
            ring = [
              [
                round(vals[i] - 389500, 3),
                round(vals[i + 2] - DATUM + GROUND, 3),
                round(5820000 - vals[i + 1], 3),
              ]
              for i in range(0, len(vals), 3)
            ]
            if ring[0] == ring[-1]:
              ring.pop()
            rings.append(ring)
          all_surfaces.append({"kind": kind, "rings": rings})
          if kind == "GroundSurface":
            grounds.append(
              Polygon(
                [(p[0], p[2]) for p in rings[0]],
                [[(p[0], p[2]) for p in r] for r in rings[1:]],
              )
            )
    foot = unary_union(grounds)
    shapes = list(foot.geoms) if hasattr(foot, "geoms") else [foot]
    assert not any(p.interiors for p in shapes), (
      "Preserve new footprint holes explicitly"
    )
    points = [p for s in all_surfaces for r in s["rings"] for p in r]
    parts.append(
      {
        "id": sid,
        "parentId": PARENT,
        "building": "Huthmacher-Haus / DOB-Hochhaus",
        "legacyPrismId": PRISM,
        "groundY": min(p[1] for p in points),
        "topY": max(p[1] for p in points),
        "heightM": height,
        "rings": [
          [[round(x, 3), round(z, 3)] for x, z in p.exterior.coords[:-1]]
          for p in shapes
        ],
        "footprintAreaM2": round(foot.area, 6),
      }
    )
    for surface in all_surfaces:
      if surface["kind"] not in ["WallSurface", "RoofSurface"]:
        continue
      roof = surface["kind"] == "RoofSurface"
      color = 0x939A94 if roof else WALL
      triangles = triangles_for(surface["rings"])
      surfaces.append(
        {"partId": sid, "kind": surface["kind"], "color": color, "triangles": triangles}
      )
      if not roof:
        details.extend(facade(surface["rings"], height))
      for triangle in triangles:
        a, b, c = [np.array(p) for p in triangle]
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
            if roof or cell not in blocks:
              blocks[cell] = [
                cell[0] * 2 + 1,
                round(GROUND + cell[1] * 2 + 1, 3),
                cell[2] * 2 + 1,
                color,
              ]
  for x, y, z, w, h, _depth, yaw, color, role in details:
    if role != 1:
      continue
    for u in np.arange(-w / 2 + 0.1, w / 2, 0.6):
      for v in np.arange(-h / 2 + 0.1, h / 2, 0.6):
        cell = (
          math.floor((x + math.cos(yaw) * u) / 2),
          math.floor((y + v - GROUND) / 2),
          math.floor((z - math.sin(yaw) * u) / 2),
        )
        if cell in blocks:
          cx, cy, cz, _ = blocks[cell]
          along = (cx - x) * math.cos(yaw) - (cz - z) * math.sin(yaw)
          if abs(along) < w / 2 and abs(cy - y) < h / 2:
            blocks[cell][3] = color
  official_foot = unary_union([Polygon(r) for p in parts for r in p["rings"]])
  old_foot = Polygon([[x / 10, z / 10] for x, z in legacy[0]["ring"]])
  return {
    "schemaVersion": 1,
    "sourceUrl": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_386_5818.zip",
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "licence": "dl-de/zero-2-0",
    "groundY": GROUND,
    "datumM": DATUM,
    "parts": parts,
    "legacyPrisms": legacy,
    "sourceConflict": {
      "decision": "Official LoD2 walls and roof heights are the metric authority; the earlier floor-count OSM height and outline remain complete provenance, not duplicate drawn geometry.",
      "officialFootprintAreaM2": round(official_foot.area, 6),
      "legacyFootprintAreaM2": round(old_foot.area, 6),
      "legacyOnlyAreaM2": round(old_foot.difference(official_foot).area, 6),
      "officialOnlyAreaM2": round(official_foot.difference(old_foot).area, 6),
    },
    "surfaces": surfaces,
    "facadeBoxes": details,
    "nativeBlocks": list(blocks.values()),
    "detailStatus": "All ten official LoD2 parts and roofs retained. Aluminium ribbons, panel joints and windows are procedural visual-reference subdivisions clipped to surveyed walls. The former 48 m OSM floor-count estimate is retained as provenance; measured maximum is 61.703 m. No photographic texture or unverified current advertising.",
  }


def main() -> None:
  payload = make_payload()
  DEST.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
  native_roofs: dict[tuple[float, float], float] = {}
  for x, y, z, _ in payload["nativeBlocks"]:
    native_roofs[(x, z)] = max(native_roofs.get((x, z), -100), y + 1)
  nav = {
    "parts": payload["parts"],
    "legacyPrisms": payload["legacyPrisms"],
    "roofTriangles": [
      t
      for s in payload["surfaces"]
      if s["kind"] == "RoofSurface"
      for t in s["triangles"]
    ],
    "nativeRoofCells": [[x, z, y] for (x, z), y in native_roofs.items()],
  }
  DEST.with_name("huthmacherNavigation.json").write_text(
    json.dumps(nav, separators=(",", ":")) + "\n"
  )
  print(
    json.dumps(
      {
        key: len(payload[key])
        for key in ["parts", "surfaces", "facadeBoxes", "nativeBlocks"]
      }
    )
  )


if __name__ == "__main__":
  main()
