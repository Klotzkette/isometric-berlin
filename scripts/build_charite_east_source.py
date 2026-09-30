"""Step 10: retain exact Tieranatomisches Theater source sheets and identity."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from build_bebelplatz_building_source import extract_parent, part_profile

from isometric_berlin.data.fetch_lod2 import (
  building_footprint,
  leaf_building_parts,
  load_bounds_polygon,
  project_to_berlin,
)


def main() -> int:
  """Retain source evidence independently of the documented display correction."""
  root = Path(__file__).resolve().parents[1]
  archive = root / "geo_data/regierungsviertel/raw/lod2/LoD2_390_5820.zip"
  parent_id = "DEBE01YYK00009Ws"
  parent = extract_parent(archive, parent_id)
  bounds = project_to_berlin(
    load_bounds_polygon(root / "geo_data/regierungsviertel/bounds.geojson")
  )
  footprint = building_footprint(parent)
  if footprint is None or not bounds.covers(footprint):
    raise ValueError("Theatre leaves approved bounds")
  parts = [part_profile(p) for p in leaf_building_parts(parent) or [parent]]
  result = {
    "schema_version": 1,
    "parent_id": parent_id,
    "osm_identity": "way/95871837",
    "source_url": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_390_5820.zip",
    "source_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
    "license": "dl-de/zero-2-0",
    "parts": parts,
    "display_conflict": "Official low square body and attached Gerlach wing have a 3m default extrusion while the circular drum retains 17.179m. Licensed photographs and LDA09055030 show the square two-storey body and light drum beneath a green dome. Display raises the square source footprint, retains every wing vertex, and refines the dome inside the existing17.2m total height. Intermediate storeys/roof subdivisions are unsurveyed display estimates; all source sheets remain unchanged here.",
  }
  target = root / "src/app/src/chariteTheatreSource.json"
  target.write_text(
    json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n"
  )
  print(f"Wrote {target.name}: {target.stat().st_size} bytes")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
