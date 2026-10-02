"""Step 10: two surveyed Monbijou pools, with DOP-checked paving and coping."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import geopandas as gpd
import pandas as pd
from build_breitscheid_towers_v161 import triangles_for
from build_surrounding_outlines import tags_for, world
from shapely.geometry import Point, Polygon, box, mapping
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "src/app/src/data/monbijouBathV167Source.json"
IDS = {"30876915", "30876932", "51167567"}


def build() -> dict:
  frame = gpd.read_file(
    ROOT / "geo_data/regierungsviertel/raw/outer-v159/candidate.gpkg",
    layer="multipolygons",
    bbox=(13.392, 52.522, 13.400, 52.526),
  ).to_crs(25833)
  features = []
  for _, row in frame.iterrows():
    oid = str(row.osm_id) if pd.notna(row.osm_id) else str(row.osm_way_id)
    if oid in IDS:
      p = world(row.geometry)
      if p.geom_type == "MultiPolygon":
        assert len(p.geoms) == 1
        p = p.geoms[0]
      features.append({"id": oid, "tags": tags_for(row), "geometry": mapping(p)})
  assert {f["id"] for f in features} == IDS
  pools = [f for f in features if f["id"] != "30876915"]
  shapes = [Polygon(f["geometry"]["coordinates"][0]) for f in pools]
  # Pixel picks from the inspected 2025 official orthophoto, ten cm per pixel.
  # These are visible paving edges, not a cadastral/engineering survey.
  pixels = [
    [439, 329],
    [622, 330],
    [622, 318],
    [826, 316],
    [737, 535],
    [695, 536],
    [681, 645],
    [590, 637],
    [585, 508],
    [453, 482],
    [425, 469],
  ]
  terrace = Polygon([[1660 + x * 0.1, -440 + y * 0.1] for x, y in pixels])
  basin = unary_union(shapes)
  terrace = terrace.union(basin.buffer(1.4, join_style=2))
  sheets = []
  native = []

  def surface(role: str, poly, y: float, color: int) -> None:
    if poly.is_empty:
      return
    if poly.geom_type != "Polygon":
      for child in poly.geoms:
        surface(role, child, y, color)
      return
    rings = [[list(p) for p in poly.exterior.coords][:-1]] + [
      [list(p) for p in r.coords][:-1] for r in poly.interiors
    ]
    sheets.append(
      {
        "role": role,
        "color": color,
        "triangles": triangles_for([[[x, y, z] for x, z in r] for r in rings]),
      }
    )
    # Independent orthogonal quarter-metre native surface, merged only along
    # rows. No smooth source surface is retained under Minecraft geometry.
    x0, z0, x1, z1 = poly.bounds
    for iz in range(math.floor(z0 * 4), math.ceil(z1 * 4)):
      xs = [
        ix
        for ix in range(math.floor(x0 * 4), math.ceil(x1 * 4))
        if poly.covers(Point((ix + 0.5) / 4, (iz + 0.5) / 4))
      ]
      if not xs:
        continue
      start = prev = xs[0]
      for ix in xs[1:] + [xs[-1] + 2]:
        if ix != prev + 1:
          native.append(
            [
              (start + prev + 1) / 8,
              y - 0.025,
              (iz + 0.5) / 4,
              (prev - start + 1) / 4,
              0.05,
              0.25,
              color,
            ]
          )
          start = ix
        prev = ix

  surface("paving", terrace.difference(basin), 5.43, 0xCCC8B9)
  # Fine paving joins are schematic surface articulation, not asserted exact
  # slabs. They are cut out of every pool and confined to actual paved ground.
  paving = terrace.difference(basin.buffer(0.32, join_style=2))
  for x in range(math.floor(terrace.bounds[0]), math.ceil(terrace.bounds[2]), 2):
    surface(
      "paving-joint",
      paving.intersection(box(x - 0.015, -440, x + 0.015, -330)),
      5.434,
      0xA4A79C,
    )
  for z in range(math.floor(terrace.bounds[1]), math.ceil(terrace.bounds[3]), 2):
    surface(
      "paving-joint",
      paving.intersection(box(1660, z - 0.015, 1790, z + 0.015)),
      5.434,
      0xA4A79C,
    )
  for p in shapes:
    surface("coping", p.buffer(0.30, join_style=2).difference(p), 5.45, 0xE4E1D3)
    surface("water", p, 5.35, 0x338F9B)
    surface(
      "inner-tile-rim", p.difference(p.buffer(-0.18, join_style=2)), 5.355, 0x83C0BE
    )
  return {
    "features": features,
    "terrace": mapping(terrace),
    "surfaces": sheets,
    "nativeRows": native,
    "groundY": 5.2,
    "textureFree": True,
    "poolDepthsM": {"30876932": [0, 1.3], "51167567": [0.2, 0.35]},
    "preservedBuildingParents": ["DEBE01YYK0001xNU", "DEBE01YYK00005aJ"],
  }


if __name__ == "__main__":
  data = build()
  DEST.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n")
  dop = ROOT / "geo_data/regierungsviertel/raw/monbijou-bath-v167/dop-2025.jpg"
  evidence = {
    "source": "OSM Berlin 2026-09-29; Berliner Bäder-Betriebe; official DOP2025",
    "operator": "https://www.berlinerbaeder.de/baeder/detail/kinderbad-monbijou/",
    "dopUrl": "https://gdi.berlin.de/services/wms/dop_2025_fruehjahr",
    "dopRequest": {
      "SERVICE": "WMS",
      "VERSION": "1.3.0",
      "REQUEST": "GetMap",
      "LAYERS": "dop_2025",
      "CRS": "EPSG:25833",
      "BBOX": "391160,5820330,391290,5820440",
      "WIDTH": 1300,
      "HEIGHT": 1100,
    },
    "dopSha256": hashlib.sha256(dop.read_bytes()).hexdigest(),
    "dopLicense": "dl-de/zero-2-0",
    "accuracy": "Original OSM rings retained exactly. DOP2025 confirms asymmetric main pool, smaller wading basin and west changing buildings. Paving boundary picked from orthophoto (approximate); coping width, colours and slab divisions are display estimates.",
    "rendering": "Summer presentation, opaque water. Surface offsets above the shared scene ground preserve existing city plates; depths are operator facts, not a new terrain excavation. No invented historic equipment, lane markings, furniture or texture.",
    "preservation": "Both existing surveyed building parents (six parts), all old paths, trees and fences remain in MitteHeritageV166 unchanged.",
    "pools": data["features"],
  }
  (DEST.parent / "monbijouBathV167Evidence.json").write_text(
    json.dumps(evidence, indent=2, ensure_ascii=False) + "\n"
  )
  nav = {
    "pools": [
      {"id": f["id"], "ring": f["geometry"]["coordinates"][0]}
      for f in data["features"]
      if f["id"] != "30876915"
    ]
  }
  (DEST.parent / "monbijouBathV167Navigation.json").write_text(
    json.dumps(nav, separators=(",", ":")) + "\n"
  )
  print(
    json.dumps(
      {"surfaces": len(data["surfaces"]), "nativeRows": len(data["nativeRows"])}
    )
  )
