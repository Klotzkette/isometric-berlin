"""Step 10: retain the bounded Maxim Gorki Theater official LoD2 source sheets."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from build_bebelplatz_building_source import extract_parent, part_profile

from isometric_berlin.data.fetch_lod2 import (
  NS,
  building_footprint,
  leaf_building_parts,
  load_bounds_polygon,
  project_to_berlin,
)


def main() -> int:
  """Extract three original parts; retain the old generic prism as evidence."""
  root = Path(__file__).resolve().parents[1]
  archive = root / "geo_data/regierungsviertel/raw/lod2/LoD2_391_5819.zip"
  parent_id = "DEBE01YYK000039k"
  parent = extract_parent(archive, parent_id)
  bounds = project_to_berlin(
    load_bounds_polygon(root / "geo_data/regierungsviertel/bounds.geojson")
  )
  footprint = building_footprint(parent)
  if footprint is None or not bounds.covers(footprint):
    raise ValueError("Gorki source leaves the approved release polygon")
  prisms = json.loads(
    (root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  result = {
    "schema_version": 1,
    "parent_id": parent_id,
    "name": "Maxim Gorki Theater / Singakademie",
    "source_url": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_391_5819.zip",
    "source_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
    "source_created": parent.findtext("core:creationDate", namespaces=NS),
    "license": "dl-de/zero-2-0",
    "osm_identity": "https://www.openstreetmap.org/way/131835798",
    "replaced_osm_prism_ids": ["31835798"],
    "previous_display_prisms": [p for p in prisms if p["id"] == "31835798"],
    "origin_epsg25833_m": [389500, 5820000, 30],
    "parts": [part_profile(p) for p in leaf_building_parts(parent) or [parent]],
    "conflict_policy": (
      "The retained 9 m generic runtime prism 31835798 is an earlier OSM outline; "
      "current OSM way 131835798 identifies the Singakademie. Official complete "
      "LoD2 sheets set the metric envelope, including the northern stage height. "
      "Its generalized sloping roof merges the hall and northern stage tower; "
      "a photo-proportioned gabled hall, temple pediment and separate stage tower "
      "resolve that display generalisation inside the retained maximum height. "
      "The original source sheets remain stored unchanged as evidence. "
      "The building owner's account identifies the large former hall windows as "
      "bricked up in 1947, so these are blind panels, not invented glazing."
    ),
  }
  target = root / "src/app/src/gorkiBuildingSource.json"
  target.write_text(json.dumps(result, separators=(",", ":")) + "\n")
  print(f"Wrote {target.name}: {target.stat().st_size:,} bytes")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
