"""Step 10: complete mapped Hermann-Ehlers-Platz paving in existing batches."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from pathlib import Path
from typing import Any

from build_steglitz_details_v246 import merge_boxes
from pyproj import Transformer
from shapely import constrained_delaunay_triangles
from shapely.geometry import Polygon, box, mapping, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
RAW = GEO / "raw/v182-steglitz/multipolygons.json"
OUT = DATA / "hermannEhlersV247Details.json"
EVIDENCE = GEO / "hermann-ehlers-v247-evidence.json"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
PLAZA_ID = "10741017"
TOP = 3.025
STONE = 0xB8B4AA
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True).transform


def read(path: Path) -> Any:
  return json.loads(path.read_bytes())


def sha(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def world(x: float, y: float) -> tuple[float, float]:
  """Use the unchanged city metre frame, retaining every original coordinate."""
  e, n = PROJECT(x, y)
  return e - 389500, 5820000 - n


def build() -> tuple[dict, dict]:
  """Append a flat finish; do not replace prior geometry or block any opening."""
  feature = next(
    f for f in read(RAW)["features"] if f["properties"].get("osm_id") == PLAZA_ID
  )
  plaza = transform(world, shape(feature["geometry"]))
  assert len(plaza.geoms) == 1
  polygon = plaza.geoms[0]
  assert len(polygon.exterior.coords) == 49 and len(polygon.interiors) == 2
  assert [len(r.coords) for r in polygon.interiors] == [24, 9]
  ground, obstacles, roads, receipts = [], [], [], {}
  for ix in range(
    math.floor(polygon.bounds[0] / 512), math.floor(polygon.bounds[2] / 512) + 1
  ):
    for iz in range(
      math.floor(polygon.bounds[1] / 512), math.floor(polygon.bounds[3] / 512) + 1
    ):
      for family in ["drawn", "minecraft"]:
        path = PUBLIC / f"ring182-{ix}_{iz}.{family}.json.gz"
        packet = json.loads(gzip.decompress(path.read_bytes()))
        receipts[str(path.relative_to(ROOT))] = sha(path)
        ox, _, oz = packet["origin"]

        def area(item: dict) -> Polygon:
          return Polygon(
            [(x + ox, z + oz) for x, z in item["ring"]],
            [[(x + ox, z + oz) for x, z in ring] for ring in item.get("holes", [])],
          )

        assert packet["nav"]["groundY"] == 3
        ground.extend(area(item) for item in packet["nav"]["ground"])
        obstacles.extend(area(item) for item in packet["nav"]["buildings"])
        roads.extend(area(item) for item in packet["nav"]["roads"])
  assert unary_union(ground).buffer(1e-8).covers(polygon)
  assert sum(p.buffer(0).intersection(polygon).area for p in obstacles) < 1e-8
  assert sum(p.buffer(0).intersection(polygon).area for p in roads) < 1e-8

  # Constrained triangulation retains the entire surveyed contour, both holes
  # and every source vertex. No rectangle, convex hull or simplified outline.
  triangles = []
  for triangle in constrained_delaunay_triangles(polygon).geoms:
    coords = list(triangle.exterior.coords)[:3]
    triangles.append([[x, TOP, z] for x, z in coords])

  # Independent native paving uses ALL complete one-metre interior cells.
  # Adjacent equal-colour cells merge losslessly, including beside both holes;
  # original ground remains visible in the conservative boundary fringe.
  rows = []
  for x in range(math.floor(polygon.bounds[0]), math.ceil(polygon.bounds[2])):
    for z in range(math.floor(polygon.bounds[1]), math.ceil(polygon.bounds[3])):
      if polygon.covers(box(x, z, x + 1, z + 1)):
        rows.append([x + 0.5, 3.0125, z + 0.5, 1, 0.025, 1, STONE])
  cells = len(rows)
  rows = merge_boxes(rows)
  assert len(rows) <= 150
  retained = [
    DATA / name
    for name in [
      "steglitzV182Source.json",
      "steglitzV182Native.json",
      "steglitzV182Navigation.json",
      "steglitzV246Details.json",
    ]
  ]
  evidence = {
    "version": 247,
    "source": "Retained Geofabrik Berlin OpenStreetMap extract, 2026-09-29",
    "license": "ODbL-1.0",
    "owner": f"relation/{PLAZA_ID}",
    "sourceFeature": feature,
    "worldGeometry": mapping(plaza),
    "sourceSha256": {str(RAW.relative_to(ROOT)): sha(RAW)},
    "preservedSha256": {str(p.relative_to(ROOT)): sha(p) for p in retained},
    "packetSha256": receipts,
    "areaM2": polygon.area,
    "nativeCompleteCells": cells,
    "nativeAreaM2": cells,
    "nativeRows": len(rows),
    "triangles": len(triangles),
    "groundY": 3,
    "finishTopY": TOP,
    "references": [
      {
        "url": "https://www.berlin.de/sen/uvk/mobilitaet-und-verkehr/verkehrsplanung/fussverkehr/fussverkehrsprojekte/modellprojekte/hermann-ehlers-platz/",
        "credit": "Senatsverwaltung für Mobilität, Verkehr, Klimaschutz und Umwelt",
        "use": "Text only: existing mixed paving and future redesign. No design plan traced or photograph used.",
      },
      {
        "url": "https://mein.berlin.de/vorhaben/2024-00949/",
        "credit": "Bezirksamt Steglitz-Zehlendorf / meinBerlin",
        "use": "Project status only; proposed redesign is not represented as built.",
      },
    ],
    "policy": "Full original ground, buildings, trees, memorial and source packets remain. The 25 mm paving finish and stone tone are presentation estimates on the existing flat ground; no changed walking level, new fixture, raised kerb or invented inscription. Drawn retains complete source contour and holes. Native independently includes every fully contained one-metre cell, preserving the existing ground fringe. No texture, descriptor, new renderable or runtime budget.",
  }
  return {
    "version": 247,
    "surfaces": [
      {"owner": f"relation/{PLAZA_ID}", "color": STONE, "triangles": triangles}
    ],
    "boxes": [],
    "nativeRows": rows,
  }, evidence


def main() -> None:
  """Write only the bounded new companion and its immutable source receipts."""
  data, evidence = build()
  for path, value in [(OUT, data), (EVIDENCE, evidence)]:
    path.write_text(json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n")
  print(
    json.dumps(
      {
        "bytes": OUT.stat().st_size,
        "triangles": evidence["triangles"],
        "nativeRows": evidence["nativeRows"],
      }
    )
  )


if __name__ == "__main__":
  main()
