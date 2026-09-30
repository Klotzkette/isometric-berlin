"""Step 10: lossless official envelopes for the bounded Potsdamer ministry detail."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from statistics import median
from typing import Any

import geopandas as gpd
from shapely import STRtree, make_valid
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts
from scripts.build_bebelplatz_building_source import extract_parent, part_profile
from scripts.build_gendarmenmarkt_perimeter_source import facade_axes, world_geometry

ROOT = Path(__file__).resolve().parents[1]
TARGETS = [
  (
    "ministryHistoric",
    "Bundesumweltministerium historic building",
    ["02NC"],
    "Stresemannstraße 128",
  ),
  (
    "ministryNorth",
    "Bundesumweltministerium northern extension",
    ["06XH"],
    "Stresemannstraße 130 / Erna-Berger-Straße",
  ),
  (
    "ministrySouth",
    "Bundesumweltministerium southern extension",
    ["08P4"],
    "Stresemannstraße 128",
  ),
  (
    "ministryAtrium",
    "Bundesumweltministerium covered inner atrium",
    ["1yEo"],
    "Stresemannstraße 128",
  ),
  ("forumTower", "Forum Tower / Renzo Piano", ["2KPB"], "Potsdamer Platz 11"),
  ("hausHuth", "Haus Huth", ["2LW7"], "Alte Potsdamer Straße 5"),
  ("grandHyatt", "Grand Hyatt Berlin", ["2OYs"], "Marlene-Dietrich-Platz 2"),
]


def build_source(root: Path = ROOT) -> dict[str, Any]:
  """Retain complete official surfaces and measured exterior wall planes."""
  archive = root / "geo_data/regierungsviertel/raw/lod2/LoD2_389_5818.zip"
  digest = hashlib.sha256(archive.read_bytes()).hexdigest()
  previous = json.loads(
    (root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  context = gpd.read_file(
    root / "geo_data/regierungsviertel/osm_context_buildings.gpkg"
  )
  roads = gpd.read_file(root / "geo_data/regierungsviertel/osm.gpkg", layer="roads")
  streets = [
    {
      "name": r["name"] if isinstance(r["name"], str) else "mapped public approach",
      "osmKey": f"{r.element}/{r.id}",
      "geometry": world_geometry(r.geometry),
    }
    for _, r in roads.iterrows()
    if r.geometry.geom_type == "LineString"
  ]
  allowed = {s["name"] for s in streets}
  buildings = []
  for key, name, ids, address in TARGETS:
    parts = []
    for suffix in ids:
      element = extract_parent(archive, "DEBE01YYK000" + suffix)
      parts.extend(part_profile(p) for p in leaf_building_parts(element) or [element])
    plan = unary_union([Polygon(p["ring"], p["holes"]) for p in parts])
    owned = {p["id"][-8:] for p in parts}
    for _, r in context.iterrows():
      shape = world_geometry(r.geometry)
      if plan.intersection(shape).area / max(shape.area, 0.001) > 0.97:
        owned.add(str(r.building_id)[-8:])
    old = [p for p in previous if p["id"] in owned]
    buildings.append(
      {
        "key": key,
        "name": name,
        "address": address,
        "parentIds": ["DEBE01YYK000" + v for v in ids],
        "officialParts": parts,
        "prismIds": [p["id"] for p in old],
        "previousDisplayPrisms": old,
        "center": list(plan.centroid.coords)[0],
        "bbox": list(plan.bounds),
        "displayYTranslationM": round(
          median(p["y0_dm"] / 10 for p in old) - min(p["ground_y_m"] for p in parts), 3
        ),
      }
    )
  obstacles = [
    {
      "sourceId": p["id"],
      "topY": p["top_y_m"] + b["displayYTranslationM"],
      "geometry": make_valid(Polygon(p["ring"], p["holes"])),
    }
    for b in buildings
    for p in b["officialParts"]
  ]
  index = STRtree([p["geometry"] for p in obstacles])
  for building in buildings:
    building["streetFronts"] = facade_axes(
      building["officialParts"],
      building["displayYTranslationM"],
      streets,
      allowed,
      obstacles,
      index,
      minimum_width=1.5,
    )
  return {
    "schemaVersion": 1,
    "source": {
      "url": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5818.zip",
      "sha256": digest,
      "license": "dl-de/zero-2-0",
      "coordinateFrame": "x=easting-389500,y=NHN-30,z=5820000-northing",
    },
    "semanticsLicense": "ODbL-1.0",
    "buildings": buildings,
  }


def native_ownership(ownership: dict[str, Any], root: Path = ROOT) -> dict[str, Any]:
  """Only replace whole raster columns whose original source is entirely ours.

  A native column can straddle two source owners, including overlapping LoD2
  parts of neighbouring parents. Retaining that original column is preferable
  to deleting the neighbour's facade/roof, even when the replacement footprint
  happens to cover the complete cell. Boundary columns keep their original
  material and height; the finer source-driven native skin overlays them.
  """
  owned_ids = {i for b in ownership["buildings"] for i in b["prismIds"]}
  shape = unary_union(
    [
      make_valid(Polygon(p["ring"], p["holes"]))
      for b in ownership["buildings"]
      for p in b["rings"]
    ]
  )
  previous = json.loads(
    (root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  raster = json.loads(
    (root / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json").read_text()
  )
  size = raster["cell_m"]
  crop = box(*shape.bounds).buffer(size)
  neighbours = []
  for p in previous:
    if p["id"] in owned_ids:
      continue
    ring = [[x / 10, z / 10] for x, z in p["ring"]]
    holes = [[[x / 10, z / 10] for x, z in h] for h in p.get("holes", [])]
    poly = make_valid(Polygon(ring, holes))
    if poly.intersects(crop):
      neighbours.append(poly)
  unowned = unary_union(neighbours)
  safe, retained = [], []
  grid = raster["grid"]
  for row, runs in enumerate(raster["building_rows"]):
    z = (grid["min_z_idx"] + row) * size
    if z + size < shape.bounds[1] or z > shape.bounds[3]:
      continue
    for start, count, *_ in runs:
      for column in range(start, start + count):
        x = (grid["min_x_idx"] + column) * size
        if x + size < shape.bounds[0] or x > shape.bounds[2]:
          continue
        cell = box(x, z, x + size, z + size)
        if not cell.intersects(shape):
          continue
        outside_area = cell.difference(shape).area
        neighbour_area = cell.intersection(unowned).area
        if shape.covers(cell) and neighbour_area < 1e-7:
          safe.append([x, z])
        else:
          retained.append([x, z, round(outside_area, 6), round(neighbour_area, 6)])
  return {
    "cellSizeM": size,
    "policy": "Only whole owned source cells; keep every mixed boundary column unchanged",
    "safeWholeCells": safe,
    "retainedBoundaryCells": retained,
  }


if __name__ == "__main__":
  result = build_source()
  target = ROOT / "src/app/src/potsdamerMinistrySource.json"
  target.write_text(
    json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n"
  )
  ownership = {
    "buildings": [
      {
        "key": b["key"],
        "prismIds": b["prismIds"],
        "rings": [{"ring": p["ring"], "holes": p["holes"]} for p in b["officialParts"]]
        + [
          {
            "ring": [[x / 10, z / 10] for x, z in p["ring"]],
            "holes": [[[x / 10, z / 10] for x, z in h] for h in p.get("holes", [])],
          }
          for p in b["previousDisplayPrisms"]
        ],
      }
      for b in result["buildings"]
    ]
  }
  ownership["native"] = native_ownership(ownership)
  (ROOT / "src/app/src/potsdamerMinistryOwnership.json").write_text(
    json.dumps(ownership, separators=(",", ":")) + "\n"
  )
  for building in result["buildings"]:
    print(
      building["key"],
      len(building["officialParts"]),
      len(building["streetFronts"]),
      building["prismIds"],
    )
  print(target.stat().st_size, "bytes")
