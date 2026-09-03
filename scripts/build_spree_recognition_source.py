"""Step 10: extract two bounded, image-free LoD2 recognition source profiles."""

from __future__ import annotations

import hashlib
import json
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Any

from shapely.geometry import Point

from isometric_berlin.data.fetch_lod2 import (
  GML_ID,
  NS,
  Lod2Tile,
  building_footprint,
  leaf_building_parts,
  load_bounds_polygon,
  project_to_berlin,
)

ORIGIN = (389500, 5820000, 30)
PARENTS = {
  "bode": (Lod2Tile(391, 5820), "DEBE01YYK00002jp"),
  "grill": (Lod2Tile(390, 5820), "DEBE01YYK0000Ahf"),
}


def world_ring(poslist: ET.Element) -> list[list[float]]:
  """Retain source millimetres in the viewer's x/up/south coordinate frame."""
  values = [float(value) for value in (poslist.text or "").split()]
  points = [
    [round(x - ORIGIN[0], 3), round(z - ORIGIN[2], 3), round(ORIGIN[1] - y, 3)]
    for x, y, z in zip(values[::3], values[1::3], values[2::3], strict=True)
  ]
  return points[:-1] if len(points) > 1 and points[0] == points[-1] else points


def part_profile(part: ET.Element, include_surfaces: bool) -> dict[str, Any]:
  """Keep metric ground rings and optionally the original wall/roof polygons."""
  ground = part.find(".//bldg:GroundSurface//gml:Polygon", NS)
  if ground is None:
    raise ValueError("A recognition part has no official ground polygon")
  exterior = ground.find("gml:exterior//gml:posList", NS)
  if exterior is None:
    raise ValueError("A recognition part has no official exterior ring")
  ring = world_ring(exterior)
  holes = [world_ring(p) for p in ground.findall("gml:interior//gml:posList", NS)]
  all_points = [world_ring(p) for p in part.findall(".//gml:posList", NS)]
  points = [point for points in all_points for point in points]
  record: dict[str, Any] = {
    "id": part.get(GML_ID),
    "height_m": float(part.findtext("bldg:measuredHeight", namespaces=NS) or "0"),
    "ground_y_m": min(point[1] for point in ring),
    "top_y_m": max(point[1] for point in points),
    "ring": [[p[0], p[2]] for p in ring],
    "holes": [[[p[0], p[2]] for p in hole] for hole in holes],
  }
  if include_surfaces:
    surfaces = []
    for kind in ("WallSurface", "RoofSurface"):
      for polygon in part.findall(f".//bldg:{kind}//gml:Polygon", NS):
        rings = [world_ring(p) for p in polygon.findall(".//gml:posList", NS)]
        surfaces.append({"kind": kind, "rings": rings})
    record["surfaces"] = surfaces
  return record


def extract_parent(path: Path, parent_id: str) -> ET.Element:
  """Read only the requested source building, never a whole-city export."""
  with zipfile.ZipFile(path) as archive:
    for member in archive.namelist():
      if not member.lower().endswith((".xml", ".gml", ".citygml")):
        continue
      with archive.open(member) as source:
        for _, element in ET.iterparse(source, events=("end",)):
          if element.tag != f"{{{NS['bldg']}}}Building":
            continue
          if element.get(GML_ID) == parent_id:
            return element
          element.clear()
  raise ValueError(f"Official LoD2 building {parent_id} was not found in {path}")


def build_source(root: Path) -> dict[str, Any]:
  """Extract source-separated profiles and reject any out-of-bounds building."""
  bounds = project_to_berlin(
    load_bounds_polygon(root / "geo_data/regierungsviertel/bounds.geojson")
  )
  result: dict[str, Any] = {
    "schema_version": 1,
    "origin_epsg25833_m": ORIGIN,
    "license": "dl-de/zero-2-0",
  }
  for key, (tile, parent_id) in PARENTS.items():
    path = root / "geo_data/regierungsviertel/raw/lod2" / tile.filename
    parent = extract_parent(path, parent_id)
    footprint = building_footprint(parent)
    if footprint is None or not bounds.covers(footprint):
      raise ValueError(f"{parent_id} leaves the approved release polygon")
    parts = leaf_building_parts(parent)
    profile = {
      "parent_id": parent_id,
      "source_url": tile.url,
      "source_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
      "source_created": parent.findtext("core:creationDate", namespaces=NS),
      "parts": [
        part_profile(
          part,
          include_surfaces=key != "bode"
          or part.get(GML_ID) in {"DEBE3DBjgh4JboMO", "DEBE3DdofEG1PIln"},
        )
        for part in parts
      ],
    }
    for part in profile["parts"]:
      for x, z in part["ring"]:
        if not bounds.covers(Point(x + ORIGIN[0], ORIGIN[1] - z)):
          raise ValueError("A quantised source point leaves the release polygon")
    result[key] = profile
  return result


def main() -> int:
  """Write the small deterministic profile consumed by the static viewer."""
  root = Path(__file__).resolve().parents[1]
  result = build_source(root)
  target = root / "src/app/src/spreeRecognitionSource.json"
  target.write_text(json.dumps(result, separators=(",", ":")) + "\n", encoding="utf-8")
  print(f"Wrote {target.name}: {target.stat().st_size:,} bytes; two LoD2 parents")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
