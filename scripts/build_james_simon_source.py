"""Step 10: retain complete James-Simon LoD2 evidence for open architecture detail."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from build_spree_recognition_source import extract_parent, part_profile

from isometric_berlin.data.fetch_lod2 import (
  NS,
  building_footprint,
  leaf_building_parts,
  load_bounds_polygon,
  project_to_berlin,
)


def main() -> int:
  """Extract every original part; display subdivisions never modify this evidence."""
  root = Path(__file__).resolve().parents[1]
  archive = root / "geo_data/regierungsviertel/raw/lod2/LoD2_391_5820.zip"
  parent = extract_parent(archive, "DEBE01AL3jA00008")
  bounds = project_to_berlin(
    load_bounds_polygon(root / "geo_data/regierungsviertel/bounds.geojson")
  )
  footprint = building_footprint(parent)
  if footprint is None or not bounds.covers(footprint):
    raise ValueError("James-Simon-Galerie leaves the approved polygon")
  prisms = json.loads(
    (root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )
  result = {
    "schema_version": 1,
    "parent_id": "DEBE01AL3jA00008",
    "source_url": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_391_5820.zip",
    "source_created": parent.findtext("core:creationDate", namespaces=NS),
    "source_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
    "license": "dl-de/zero-2-0",
    "osm_key": "way/194422265",
    "parts": [part_profile(part, True) for part in leaf_building_parts(parent)],
    "previous_display_prism": next(
      part for part in prisms["buildings"] if part["id"] == "94422265"
    ),
  }
  target = root / "src/app/src/jamesSimonSource.json"
  target.write_text(json.dumps(result, separators=(",", ":")) + "\n")
  print(f"Retained {len(result['parts'])} official James-Simon parts")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
