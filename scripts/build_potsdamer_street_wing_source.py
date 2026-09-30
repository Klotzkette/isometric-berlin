"""Step 10: facade-only source planes; existing Potsdamer roof owners stay intact."""

from __future__ import annotations

import json
from pathlib import Path
from statistics import median

import geopandas as gpd
from shapely import STRtree, make_valid
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts
from scripts.build_bebelplatz_building_source import extract_parent, part_profile
from scripts.build_gendarmenmarkt_perimeter_source import facade_axes, world_geometry

ROOT = Path(__file__).resolve().parents[1]
TARGETS = [
  ("mandala", "The Mandala Hotel / Potsdamer Straße 3", "2KZt", "mandala"),
  ("pianoNorth", "Alte Potsdamer Straße northern residential wing", "2M3M", "piano"),
  ("pianoSouth", "Alte Potsdamer Straße southern residential wing", "2Kwp", "piano"),
  ("moneoOffice", "Potsdamer Straße 7 / Rafael Moneo office", "2Mqi", "moneo"),
]


def build_source(root: Path = ROOT):
  previous = json.loads(
    (root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  by_id = {p["id"]: p for p in previous}
  buildings, all_parts = [], []
  for key, name, suffix, style in TARGETS:
    parent = "DEBE01YYK000" + suffix
    node = extract_parent(
      root / "geo_data/regierungsviertel/raw/lod2/LoD2_389_5818.zip", parent
    )
    parts = [part_profile(p) for p in leaf_building_parts(node) or [node]]
    ids = [p["id"][-8:] for p in parts]
    original = [by_id[i] for i in ids]
    translation = round(
      median(p["y0_dm"] / 10 for p in original) - min(p["ground_y_m"] for p in parts),
      3,
    )
    shape = unary_union([make_valid(Polygon(p["ring"], p["holes"])) for p in parts])
    building = {
      "key": key,
      "name": name,
      "parentId": parent,
      "style": style,
      "prismIds": ids,
      "baseY": min(p["ground_y_m"] for p in parts) + translation,
      "displayYTranslationM": translation,
      "bbox": list(shape.bounds),
    }
    buildings.append(building)
    all_parts.append(parts)
  crop = box(0, 1070, 185, 1400)
  obstacles = []
  for p in previous:
    shape = make_valid(
      Polygon(
        [[x / 10, z / 10] for x, z in p["ring"]],
        [[[x / 10, z / 10] for x, z in h] for h in p.get("holes", [])],
      )
    )
    if shape.intersects(crop):
      obstacles.append(
        {
          "sourceId": p["id"],
          "topY": (p["y0_dm"] + p["h_dm"]) / 10,
          "geometry": shape,
        }
      )
  index = STRtree([o["geometry"] for o in obstacles])
  roads = gpd.read_file(root / "geo_data/regierungsviertel/osm.gpkg", layer="roads")
  streets = [
    {
      "name": r["name"] if isinstance(r["name"], str) else "mapped public approach",
      "osmKey": f"{r.element}/{r.id}",
      "geometry": world_geometry(r.geometry),
    }
    for _, r in roads.iterrows()
    if r.geometry.geom_type == "LineString"
    and world_geometry(r.geometry).intersects(crop)
  ]
  allowed = {s["name"] for s in streets}
  for building, parts in zip(buildings, all_parts, strict=True):
    fronts = facade_axes(
      parts,
      building["displayYTranslationM"],
      streets,
      allowed,
      obstacles,
      index,
      minimum_width=3,
    )
    for edge in fronts:
      part = next(p for p in parts if p["id"] == edge["partId"])
      edge["sourceWallRings"] = part["surfaces"][edge["surfaceIndex"]]["rings"]
      # Overlay cannot extend above the retained original generic owner.
      prism = by_id[edge["prismId"]]
      edge["wallTopY"] = min(edge["wallTopY"], (prism["y0_dm"] + prism["h_dm"]) / 10)
    building["streetFronts"] = fronts
  return {
    "schemaVersion": 1,
    "geometrySource": "Geoportal Berlin LoD2_389_5818.zip; dl-de/zero-2-0",
    "streetSource": "retained OSM roads; ODbL-1.0",
    "ownerPhotoPalette": "potsdamerPanoramaPalette.ts, owner reference 2026-09-05",
    "facadeOnly": True,
    "sourceSuppression": False,
    "roofModification": False,
    "buildings": buildings,
  }


if __name__ == "__main__":
  result = build_source()
  target = ROOT / "src/app/src/potsdamerStreetWingSource.json"
  target.write_text(
    json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n"
  )
  for b in result["buildings"]:
    print(b["key"], len(b["prismIds"]), len(b["streetFronts"]))
  print(target.stat().st_size, "bytes")
