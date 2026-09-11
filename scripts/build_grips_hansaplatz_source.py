"""Step 10: retain GRIPS and the compact Hansaplatz shopping court sources."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import geopandas as gpd
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import (
  NS,
  building_footprint,
  leaf_building_parts,
  load_bounds_polygon,
  project_to_berlin,
)
from scripts.build_bebelplatz_building_source import extract_parent, part_profile

PARENTS = {
  "2KmE": (5820, "GRIPS theatre", "theatre"),
  "2PAz": (5819, "South cafe wing", "shop"),
  "2QJH": (5820, "Elevated glazed theatre link", "bridge"),
  "2SRQ": (5820, "Eastern retail body", "shop"),
  "2T6N": (5820, "Bartningallee corner pavilion", "shop"),
  "2KfX": (5820, "North court shop", "shop"),
  "3VBg": (5820, "South court arcade", "canopy"),
  "3Vdk": (5820, "GRIPS entrance gallery", "canopy"),
  "3VSE": (5820, "North court gallery", "canopy"),
  "2NL4": (5819, "Southeast shop", "shop"),
  "2Ldn": (5819, "Hansaplatz U9 reception", "station"),
  "2Q39": (5819, "South shop", "shop"),
  "3VTW": (5819, "Connecting shop arcades and service structures", "arcades"),
  "2UF7": (5820, "Eastern service pavilion", "service"),
}


def build_source(root: Path) -> dict[str, Any]:
  """Retain complete original envelopes and document open-display corrections."""
  bounds = project_to_berlin(
    load_bounds_polygon(root / "geo_data/regierungsviertel/bounds.geojson")
  )
  buildings = []
  for suffix, (northing, name, role) in PARENTS.items():
    archive = root / f"geo_data/regierungsviertel/raw/lod2/LoD2_387_{northing}.zip"
    parent_id = f"DEBE01YYK000{suffix}"
    parent = extract_parent(archive, parent_id)
    footprint = building_footprint(parent)
    if footprint is None or not bounds.covers(footprint):
      raise ValueError(f"{parent_id} leaves the approved bounds")
    parts = [part_profile(p) for p in leaf_building_parts(parent) or [parent]]
    buildings.append(
      {
        "parent_id": parent_id,
        "name": name,
        "role": role,
        "source_name": parent.findtext("gml:name", namespaces=NS),
        "source_created": parent.findtext("core:creationDate", namespaces=NS),
        "source_url": f"https://gdi.berlin.de/data/a_lod2/atom/LoD2_387_{northing}.zip",
        "source_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
        "display_y_translation_m": round(5.2 - min(p["ground_y_m"] for p in parts), 3),
        "parts": parts,
      }
    )
  envelopes = unary_union(
    [Polygon(p["ring"], p["holes"]) for b in buildings for p in b["parts"]]
  )
  courts = []
  for component in getattr(envelopes, "geoms", [envelopes]):
    for hole in component.interiors:
      court = Polygon(hole).buffer(0).simplify(0.002)
      if court.area > 100:
        courts.append({"ring": list(court.exterior.coords)[:-1], "area_m2": court.area})
  original = json.loads(
    (root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  part_ids = {p["id"][-8:] for b in buildings for p in b["parts"]}
  previous = [p for p in original if p["id"] in part_ids]
  if len(previous) != len(part_ids):
    raise ValueError(
      "Every replaced original part must remain in the source supplement"
    )
  roads = gpd.read_file(
    root / "geo_data/regierungsviertel/osm.gpkg",
    layer="roads",
    bbox=(387438, 5819984, 387574, 5820065),
  )
  clip = box(387438, 5819984, 387574, 5820065)
  paths = []
  for _, row in roads.iterrows():
    if row["highway"] not in {"footway", "steps", "path", "service"}:
      continue
    line = row.geometry.intersection(clip)
    if line.geom_type != "LineString":
      continue
    paths.append(
      {
        "osm_key": f"way/{row['id']}",
        "kind": row["highway"],
        "covered": row["covered"] if isinstance(row["covered"], str) else None,
        "surface": row["surface"] if isinstance(row["surface"], str) else None,
        "width_tag": row["width"] if isinstance(row["width"], str) else None,
        "points": [
          [round(x - 389500, 3), round(5820000 - y, 3)] for x, y in line.coords
        ],
      }
    )
  return {
    "schema_version": 1,
    "origin_epsg25833_m": [389500, 5820000, 30],
    "license": "dl-de/zero-2-0; OSM paths ODbL-1.0",
    "buildings": buildings,
    "replaced_prism_ids": sorted(part_ids),
    "previous_display_prisms": previous,
    "courts": courts,
    "osm_paths": paths,
    "osm_theatre": "way/25779477",
    "monument_part": "09050387,T,005",
    "conflict_policy": (
      "Original LoD2 walls/roofs and runtime prisms remain unchanged here. "
      "The theatre keeps its full 8.470 m source height. Display translations "
      "retain each parent's height above the existing 5.2 m street datum. "
      "LoD2 closes the covered arcades and elevated theatre link to the ground; "
      "photographs and mapped covered paths establish their open undersides. "
      "Only their displayed lower walls are omitted, with shared navigation "
      "clearance. U9 reception glazing and openings are photo-proportioned. "
      "Both small courts derive from the retained surrounding footprints, "
      "with only 2 mm simplification. Facade bays, paving joints, posts and "
      "door dimensions are recognition estimates, not a facade survey."
    ),
  }


def main() -> int:
  """Write the compact reproducible supplement; raw archives remain ignored."""
  root = Path(__file__).resolve().parents[1]
  target = root / "src/app/src/gripsHansaplatzSource.json"
  target.write_text(json.dumps(build_source(root), separators=(",", ":")) + "\n")
  print(f"Wrote {target.name}: {target.stat().st_size:,} bytes")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
