"""Step 10: preserve complete Mall/Voßpalais and Leipziger Platz source sheets."""

from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path
from typing import Any

from isometric_berlin.data.fetch_lod2 import (
  building_footprint,
  leaf_building_parts,
  load_bounds_polygon,
  project_to_berlin,
)
from scripts.build_bebelplatz_building_source import extract_parent, part_profile

TARGETS = {
  "mallWest": ("DEBE00YY1mc0002W", "Mall of Berlin west", "way/194066303"),
  "mallCentral": ("DEBE00YY1mc0003Y", "Mall of Berlin central", "way/194066303"),
  "mallEast": ("DEBE01YYK00000lH", "Mall of Berlin east", "way/380104430"),
  "mallPassage": (
    "DEBE00YY1mc0004E",
    "Mall of Berlin glass Piazza roof",
    "way/380104431",
  ),
  "vosspalais": ("DEBE01YYK0000Ao8", "Voßpalais, Voßstraße 33", "way/503373675"),
  "northWest": ("DEBE01AL3ya0000B", "Leipziger Platz north-west frontage", None),
  "mosse": ("DEBE01YYK00003D7", "Mosse-Palais, Leipziger Platz 15", None),
  "northEast": ("DEBE01YYK00004OX", "Leipziger Platz north-east frontage", None),
  "west": ("DEBE01AL57c0001B", "Leipziger Platz west frontage", None),
  "southWest": ("DEBE01YYK00007OU", "Quartier Leipziger Platz 1–3", None),
  "southMiddleWest": (
    "DEBE01YYK00009rL",
    "Leipziger Platz 7, Deutschlandmuseum",
    "node/437371350",
  ),
  "southMiddleWestLowerFront": (
    "DEBE01YYK0001yp5",
    "Leipziger Platz 7 lower street facade",
    "node/437371350",
  ),
  "southMiddleWestUpperFront": (
    "DEBE00YY1Yq0005f",
    "Leipziger Platz 7 upper street facade",
    "node/437371350",
  ),
  "southMiddleEast": ("DEBE01YYK00005Cd", "Leipziger Platz 8", "node/437371519"),
  "southEast": ("DEBE01YYK00001xM", "Leipziger Platz south-east frontage", None),
  "eastChamfer": ("DEBE01YYK00002YT", "Leipziger Platz east chamfer", None),
  "east": ("DEBE01YYK00002wL", "Leipziger Platz eastern entrance", None),
}


def build_source(root: Path) -> dict[str, Any]:
  """Extract every original part, retaining old prisms as a lossless audit trail."""
  bounds = project_to_berlin(
    load_bounds_polygon(root / "geo_data/regierungsviertel/bounds.geojson")
  )
  prisms = json.loads(
    (root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  connection = sqlite3.connect(root / "geo_data/regierungsviertel/buildings.gpkg")
  profiles = {}
  for key, (parent_id, name, osm) in TARGETS.items():
    rows = connection.execute(
      "SELECT source_zip, building_id FROM buildings "
      "WHERE parent_building_id=? OR building_id=?",
      (parent_id, parent_id),
    ).fetchall()
    path = root / rows[0][0]
    parent = extract_parent(path, parent_id)
    footprint = building_footprint(parent)
    if footprint is None or not bounds.covers(footprint):
      raise ValueError(f"{parent_id} leaves approved bounds")
    parts = [part_profile(part) for part in leaf_building_parts(parent) or [parent]]
    ids = {part["id"][-8:] for part in parts}
    old = [p for p in prisms if p["id"] in ids]
    if len(old) != len(parts):
      raise ValueError(f"Missing delivered source parts: {parent_id}")
    # One rigid translation per parent preserves relative roof/court heights.
    ground = sorted(p["y0_dm"] / 10 for p in old)[len(old) // 2]
    shift = round(ground - min(p["ground_y_m"] for p in parts), 3)
    profiles[key] = {
      "name": name,
      "parent_id": parent_id,
      "osm_identity": f"https://www.openstreetmap.org/{osm}" if osm else None,
      "source_url": f"https://gdi.berlin.de/data/a_lod2/atom/{path.name}",
      "source_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
      "display_y_translation_m": shift,
      "replaced_prism_ids": sorted(ids),
      "previous_display_prisms": old,
      "parts": parts,
    }
  connection.close()
  return {
    "schema_version": 1,
    "license": "dl-de/zero-2-0",
    "origin_epsg25833_m": [389500, 5820000, 30],
    "source_attribution": "3D building models: Geoportal Berlin (dl-de/zero-2-0)",
    "profiles": profiles,
    "conflict_policy": (
      "Complete wall/roof sheets replace only their own previous flat prisms. "
      "The independent Mall glass roof retains its three sloping roof planes; "
      "its generalized ground-to-eave closure walls are archival only, replaced "
      "by open supports on the documented pedestrian Piazza axis. "
      "Every old prism and source surface is retained here. One rigid vertical "
      "translation per parent retains the existing street datum. Facade bay "
      "subdivisions are procedural recognition, never surveyed facade detail. "
      "The 2009 Voßpalais photo supplies historic facade form only; adjacent "
      "demolished buildings, graffiti and temporary damage are not reproduced."
    ),
  }


def main() -> int:
  """Write the bounded source supplement."""
  root = Path(__file__).resolve().parents[1]
  target = root / "src/app/src/leipzigerPlatzSource.json"
  target.write_text(json.dumps(build_source(root), separators=(",", ":")) + "\n")
  print(f"Wrote {target.name}: {target.stat().st_size:,} bytes")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
