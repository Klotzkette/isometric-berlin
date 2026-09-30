"""Step 10: retain complete Zeughaus, courtyard roof and Pei-Bau source sheets."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from build_bebelplatz_building_source import extract_parent, part_profile

from isometric_berlin.data.fetch_lod2 import (
  NS,
  building_footprint,
  leaf_building_parts,
  load_bounds_polygon,
  project_to_berlin,
)


def build_source(root: Path) -> dict[str, Any]:
  """Extract all eleven parts, keeping source planes and old display records."""
  archive = root / "geo_data/regierungsviertel/raw/lod2/LoD2_391_5819.zip"
  bounds = project_to_berlin(
    load_bounds_polygon(root / "geo_data/regierungsviertel/bounds.geojson")
  )
  old = json.loads(
    (root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  profiles = {}
  for key, parent_id, osm, ids in [
    ("zeughaus", "DEBE01YYK00000ln", "way/15971186", ["15971186"]),
    ("courtyardRoof", "DEBE01AL53j00006", "way/15971186", []),
    ("pei", "DEBE01YYK00000wY", "way/330840124", ["30840124"]),
  ]:
    parent = extract_parent(archive, parent_id)
    footprint = building_footprint(parent)
    if footprint is None or not bounds.covers(footprint):
      raise ValueError(f"{parent_id} leaves approved bounds")
    profiles[key] = {
      "parent_id": parent_id,
      "osm_identity": "https://www.openstreetmap.org/" + osm,
      "source_url": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_391_5819.zip",
      "source_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
      "source_created": parent.findtext("core:creationDate", namespaces=NS),
      "replaced_prism_ids": ids,
      "previous_display_prisms": [p for p in old if p["id"] in ids],
      "parts": [part_profile(p) for p in leaf_building_parts(parent) or [parent]],
    }
  return {
    "schema_version": 1,
    "license": "dl-de/zero-2-0",
    "origin_epsg25833_m": [389500, 5820000, 30],
    "source_attribution": "3D building models: Geoportal Berlin (dl-de/zero-2-0)",
    "profiles": profiles,
    "conflict_policy": (
      "Every original sheet and old display prism remains retained. Pei foyer "
      "and spiral-tower envelopes are transparent; the upper cylinder is shown "
      "above the foyer roof to avoid duplicated lower glazing. The courtyard roof keeps "
      "its source roof planes, but its generalized closed walls are opened "
      "below the roof. No future renovation or additional volume is invented. "
      "Facade bays, helical stair subdivision and steel members are procedural "
      "display estimates, not new measurements."
    ),
  }


def main() -> int:
  """Write the bounded supplement from retained official local archives."""
  root = Path(__file__).resolve().parents[1]
  target = root / "src/app/src/dhmSource.json"
  target.write_text(json.dumps(build_source(root), separators=(",", ":")) + "\n")
  print(f"Wrote {target.name}: {target.stat().st_size:,} bytes")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
