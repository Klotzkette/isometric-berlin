"""Step 10: retain four bounded official Bebelplatz/Humboldt LoD2 envelopes."""

from __future__ import annotations

import hashlib
import json
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Any

import geopandas as gpd
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
TARGETS = {
  "humboldt": (390, "DEBE01YYK0000Cm9", ["ion-6647"], "relation/6647"),
  "alteBibliothek": (390, "DEBE01YYK00000v2", ["24247456"], "way/24247456"),
  "hotelDeRome": (
    390,
    "DEBE01YYK00002GD",
    ["29982781", "28248337", "29982783"],
    "node/1598987141",
  ),
  "hedwig": (391, "DEBE01YYK00000AQ", ["58608090"], "way/58608090"),
}


def world_ring(poslist: ET.Element) -> list[list[float]]:
  """Retain source millimetres as scene x, elevation above 30 m NHN, south."""
  values = [float(value) for value in (poslist.text or "").split()]
  points = [
    [round(x - ORIGIN[0], 3), round(z - ORIGIN[2], 3), round(ORIGIN[1] - y, 3)]
    for x, y, z in zip(values[::3], values[1::3], values[2::3], strict=True)
  ]
  return points[:-1] if len(points) > 1 and points[0] == points[-1] else points


def part_profile(part: ET.Element) -> dict[str, Any]:
  """Keep exact ground rings and every original source wall and roof polygon."""
  ground = part.find(".//bldg:GroundSurface//gml:Polygon", NS)
  if ground is None:
    raise ValueError("A requested building has no official ground polygon")
  exterior = ground.find("gml:exterior//gml:posList", NS)
  if exterior is None:
    raise ValueError("A requested building has no official ground exterior")
  ring = world_ring(exterior)
  holes = [world_ring(p) for p in ground.findall("gml:interior//gml:posList", NS)]
  points = [
    point for p in part.findall(".//gml:posList", NS) for point in world_ring(p)
  ]
  surfaces = []
  for kind in ("WallSurface", "RoofSurface"):
    for polygon in part.findall(f".//bldg:{kind}//gml:Polygon", NS):
      rings = [world_ring(p) for p in polygon.findall(".//gml:posList", NS)]
      surfaces.append({"kind": kind, "rings": rings})
  return {
    "id": part.get(GML_ID),
    "height_m": float(part.findtext("bldg:measuredHeight", namespaces=NS) or "0"),
    "ground_y_m": min(point[1] for point in ring),
    "top_y_m": max(point[1] for point in points),
    "ring": [[p[0], p[2]] for p in ring],
    "holes": [[[p[0], p[2]] for p in hole] for hole in holes],
    "surfaces": surfaces,
  }


def extract_parent(path: Path, parent_id: str) -> ET.Element:
  """Read only the requested parent from a retained, ignored official ZIP."""
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
  raise ValueError(f"Official building {parent_id} was not found in {path}")


def build_source(root: Path) -> dict[str, Any]:
  """Extract the four requested buildings and reject out-of-bounds geometry."""
  bounds = project_to_berlin(
    load_bounds_polygon(root / "geo_data/regierungsviertel/bounds.geojson")
  )
  old_prisms = {
    p["id"]: p
    for p in json.loads(
      (root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
    )["buildings"]
  }
  profiles = {}
  for key, (tile_x, parent_id, prism_ids, osm_identity) in TARGETS.items():
    tile = Lod2Tile(tile_x, 5819)
    path = root / "geo_data/regierungsviertel/raw/lod2" / tile.filename
    parent = extract_parent(path, parent_id)
    footprint = building_footprint(parent)
    if footprint is None or not bounds.covers(footprint):
      raise ValueError(f"{parent_id} leaves the approved release polygon")
    parts = [part_profile(part) for part in leaf_building_parts(parent) or [parent]]
    for part in parts:
      for surface in part["surfaces"]:
        for ring in surface["rings"]:
          for x, _, z in ring:
            if not bounds.covers(Point(x + ORIGIN[0], ORIGIN[1] - z)):
              raise ValueError("A quantised surface leaves the approved polygon")
    profiles[key] = {
      "parent_id": parent_id,
      "source_url": tile.url,
      "source_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
      "source_created": parent.findtext("core:creationDate", namespaces=NS),
      "osm_identity": "https://www.openstreetmap.org/" + osm_identity,
      "replaced_osm_prism_ids": prism_ids,
      "previous_display_prisms": [old_prisms[prism_id] for prism_id in prism_ids],
      "parts": parts,
    }
  roads_path = root / "geo_data/regierungsviertel/osm.gpkg"
  roads = gpd.read_file(roads_path, layer="roads")
  plaza = roads[(roads["element"] == "way") & (roads["id"] == "205728152")].iloc[0]
  if plaza.geometry.geom_type != "Polygon" or not bounds.covers(plaza.geometry):
    raise ValueError("The exact Bebelplatz sett polygon is not bounded")
  plaza_ring = [
    [round(x - ORIGIN[0], 3), round(ORIGIN[1] - y, 3)]
    for x, y in list(plaza.geometry.exterior.coords)[:-1]
  ]
  return {
    "schema_version": 1,
    "origin_epsg25833_m": ORIGIN,
    "license": "dl-de/zero-2-0",
    "source_attribution": "3D building models: Geoportal Berlin (dl-de/zero-2-0)",
    "plaza_source": {
      "osm_key": "way/205728152",
      "source_url": "https://www.openstreetmap.org/way/205728152",
      "source_sha256": hashlib.sha256(roads_path.read_bytes()).hexdigest(),
      "license": "ODbL-1.0",
      "surface": str(plaza["surface"]),
      "area_m2": round(plaza.geometry.area, 3),
      "ring": plaza_ring,
      "holes": [
        [
          [round(x - ORIGIN[0], 3), round(ORIGIN[1] - y, 3)]
          for x, y in list(ring.coords)[:-1]
        ]
        for ring in plaza.geometry.interiors
      ],
    },
    "conflict_policy": (
      "Original OSM fallback prisms and their semantic identities remain retained; "
      "only listed runtime envelopes use these complete official LoD2 surfaces. "
      "Source ground elevations may include basements and are not street levels. "
      "Facade ornaments and the curved Hedwig dome are separate procedural "
      "recognition details, not additional survey measurements."
    ),
    "profiles": profiles,
  }


def main() -> int:
  """Write one compact static source supplement without changing source payloads."""
  root = Path(__file__).resolve().parents[1]
  result = build_source(root)
  target = root / "src/app/src/bebelplatzBuildingSource.json"
  target.write_text(json.dumps(result, separators=(",", ":")) + "\n", encoding="utf-8")
  print(f"Wrote {target.name}: {target.stat().st_size:,} bytes; four LoD2 parents")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
