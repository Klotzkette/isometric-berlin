"""Step 10: retain the complete official Humboldt Carré / Behrenstraße 42."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from isometric_berlin.data.fetch_lod2 import (
  NS,
  building_footprint,
  leaf_building_parts,
  load_bounds_polygon,
  project_to_berlin,
)
from scripts.build_bebelplatz_building_source import extract_parent, part_profile


def build_source(root: Path) -> dict[str, Any]:
  """Extract eight original parts without changing any retained source record."""
  path = root / "geo_data/regierungsviertel/raw/lod2/LoD2_390_5819.zip"
  parent_id = "DEBE01YYK00002wR"
  parent = extract_parent(path, parent_id)
  bounds = project_to_berlin(
    load_bounds_polygon(root / "geo_data/regierungsviertel/bounds.geojson")
  )
  footprint = building_footprint(parent)
  if footprint is None or not bounds.covers(footprint):
    raise ValueError("Humboldt Carré leaves the approved bounds")
  parts = [part_profile(p) for p in leaf_building_parts(parent) or [parent]]
  previous = json.loads(
    (root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  ids = ["24247494", "tFwVfxeq", "sYh7HYMU"]
  return {
    "schema_version": 1,
    "origin_epsg25833_m": [389500, 5820000, 30],
    "license": "dl-de/zero-2-0",
    "source_attribution": "3D building models: Geoportal Berlin (dl-de/zero-2-0)",
    "parent_id": parent_id,
    "source_name_retained": parent.findtext("gml:name", namespaces=NS),
    "osm_identity": "https://www.openstreetmap.org/way/24247494",
    "source_url": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_390_5819.zip",
    "source_created": parent.findtext("core:creationDate", namespaces=NS),
    "source_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    "display_y_translation_m": 1.887,
    "replaced_prism_ids": ids,
    "previous_display_prisms": [p for p in previous if p["id"] in ids],
    "parts": parts,
    "conflict_policy": (
      "The original LoD2 parent name Botschaft Turkmenistan is retained, but its "
      "eight-part envelope includes the Humboldt Carre at exact OSM way24247494. "
      "Hengeler Mueller confirms Behrenstrasse42; LDA09080273 and the operator "
      "establish the historic Disconto complex. All original source sheets and "
      "the old15m OSM placeholder remain retained. Display uses complete official "
      "parts, translated+1.887m to the existing5.2m street plane. Partially "
      "overlapping rear OSM way56467771 remains, because only78.3% overlaps. "
      "Local facade bays, arches, reveals, material swatches and upper glazing "
      "are procedural recognition subdivisions, not survey measurements."
    ),
  }


def main() -> int:
  """Write the small source supplement."""
  root = Path(__file__).resolve().parents[1]
  target = root / "src/app/src/behren42Source.json"
  target.write_text(json.dumps(build_source(root), separators=(",", ":")) + "\n")
  print(f"Wrote {target.name}: {target.stat().st_size:,} bytes")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
