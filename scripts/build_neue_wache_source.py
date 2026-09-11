"""Step 10: retain the Neue Wache's two official source envelopes."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from isometric_berlin.data.fetch_lod2 import (
  building_footprint,
  load_bounds_polygon,
  project_to_berlin,
)
from scripts.build_bebelplatz_building_source import extract_parent, part_profile


def main() -> int:
  """Keep original closed source surfaces alongside the open display model."""
  root = Path(__file__).resolve().parents[1]
  archive = root / "geo_data/regierungsviertel/raw/lod2/LoD2_391_5819.zip"
  bounds = project_to_berlin(
    load_bounds_polygon(root / "geo_data/regierungsviertel/bounds.geojson")
  )
  parts = []
  for identity in ["DEBE01YYK00006wY", "DEBE01YYK0001yAt"]:
    parent = extract_parent(archive, identity)
    footprint = building_footprint(parent)
    if footprint is None or not bounds.covers(footprint):
      raise ValueError("Neue Wache source leaves approved bounds")
    parts.append(part_profile(parent))
  previous = json.loads(
    (root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )
  result = {
    "schema_version": 1,
    "source_url": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_391_5819.zip",
    "source_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
    "source_created": "2026-03-02",
    "license": "dl-de/zero-2-0",
    "origin_epsg25833_m": [389500, 5820000, 30],
    "osm_identity": "https://www.openstreetmap.org/way/24240381",
    "sculpture_osm_identity": "https://www.openstreetmap.org/node/5253735916",
    "sculpture_world_m": [1631.7399707028, 142.029212002],
    "replaced_prism_ids": ["24240381"],
    "previous_display_prisms": [
      p for p in previous["buildings"] if p["id"] == "24240381"
    ],
    "parts": parts,
    "conflict_policy": "The former 6 m OSM fallback and complete official closed envelopes remain retained. The display follows the source plan, orientation and 15.013/15.479 m roof levels. Source ground includes lower stonework; the public floor follows the delivered 5.2 m street datum. The authored doorway, hollow hall, oculus and sculptural recognition are photo-proportioned display subdivisions, not a measured interior survey.",
  }
  path = root / "src/app/src/neueWacheSource.json"
  path.write_text(json.dumps(result, separators=(",", ":")) + "\n")
  print(f"Wrote {path.name}: {path.stat().st_size:,} bytes")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
