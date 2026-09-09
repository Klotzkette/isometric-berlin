"""Step 10: preserve the exact, bounded three-part BahnTower source envelope."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from build_spree_recognition_source import ORIGIN, extract_parent, part_profile

from isometric_berlin.data.fetch_lod2 import (
  NS,
  Lod2Tile,
  building_footprint,
  leaf_building_parts,
  load_bounds_polygon,
  project_to_berlin,
)


def main() -> None:
  """Extract only the already committed tower, retaining its previous prisms."""
  root = Path(__file__).resolve().parents[1]
  tile = Lod2Tile(389, 5818)
  path = root / "geo_data/regierungsviertel/raw/lod2" / tile.filename
  parent_id = "DEBE01YYK0002KhX"
  parent = extract_parent(path, parent_id)
  bounds = project_to_berlin(
    load_bounds_polygon(root / "geo_data/regierungsviertel/bounds.geojson")
  )
  footprint = building_footprint(parent)
  if footprint is None or not bounds.covers(footprint):
    raise ValueError("BahnTower leaves the approved release polygon")
  parts = [part_profile(p, True) for p in leaf_building_parts(parent)]
  ids = {p["id"][-8:] for p in parts}
  old = json.loads(
    (root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )
  result = {
    "schema_version": 1,
    "origin_epsg25833_m": ORIGIN,
    "license": "dl-de/zero-2-0",
    "parent_id": parent_id,
    "source_url": tile.url,
    "source_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    "source_created": parent.findtext("core:creationDate", namespaces=NS),
    "parts": parts,
    "prisms": [p for p in old["buildings"] if p["id"] in ids],
  }
  target = root / "src/app/src/dbTowerSource.json"
  target.write_text(json.dumps(result, separators=(",", ":")) + "\n")
  print(f"Wrote {target.name}: {len(parts)} source parts; {target.stat().st_size} B")


if __name__ == "__main__":
  main()
