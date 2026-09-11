"""Step 10: retain bounded Schloss and Naturkunde building source sheets."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from isometric_berlin.data.fetch_lod2 import (
  building_footprint,
  leaf_building_parts,
  load_bounds_polygon,
  project_to_berlin,
)
from scripts.build_bebelplatz_building_source import extract_parent, part_profile


def build_source(root: Path) -> dict[str, Any]:
  """Preserve the original source and previous display records for both sites."""
  bounds = project_to_berlin(
    load_bounds_polygon(root / "geo_data/regierungsviertel/bounds.geojson")
  )
  previous = json.loads(
    (root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  profiles = {}
  for key, tile, parent_id, osm, ids, shift in [
    (
      "schloss",
      "391_5819",
      "DEBE01AL5N30002e",
      "relation/3007958",
      ["-3007958"],
      0.0,
    ),
    (
      "naturkunde",
      "389_5821",
      "DEBE01YYK00002C5",
      "node/538692583",
      ["nk4RgSKd", "Hg27LuyGc", "7obr3Cdd", "A8mGJ9k2"],
      2.166,
    ),
  ]:
    path = root / f"geo_data/regierungsviertel/raw/lod2/LoD2_{tile}.zip"
    parent = extract_parent(path, parent_id)
    footprint = building_footprint(parent)
    if footprint is None or not bounds.covers(footprint):
      raise ValueError(f"{parent_id} leaves approved bounds")
    parts = [part_profile(p) for p in leaf_building_parts(parent) or [parent]]
    if key == "naturkunde":
      ids = [p["id"] for p in previous if any(x["id"].endswith(p["id"]) for x in parts)]
    profiles[key] = {
      "parent_id": parent_id,
      "osm_identity": "https://www.openstreetmap.org/" + osm,
      "source_url": f"https://gdi.berlin.de/data/a_lod2/atom/LoD2_{tile}.zip",
      "source_created": "2026-03-02",
      "source_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
      "display_y_translation_m": shift,
      "replaced_prism_ids": ids,
      "previous_display_prisms": [p for p in previous if p["id"] in ids],
      "parts": parts,
    }
  return {
    "schema_version": 1,
    "license": "dl-de/zero-2-0",
    "origin_epsg25833_m": [389500, 5820000, 30],
    "source_attribution": "3D building models: Geoportal Berlin (dl-de/zero-2-0)",
    "conflict_policy": (
      "Original surfaces and previous prisms remain unchanged. Schloss's flat "
      "OSM envelope is displayed using the complete official parts. Naturkunde "
      "display is translated +2.166 m to preserve the delivered street base5.2 m. "
      "Schloss's coarse dome perimeter/fan roof is replaced in display only by "
      "a curved subdivision inside the retained plan and 64.870 m source top. "
      "Facade subdivisions and the Schloss lantern/cross are non-surveyed "
      "recognition detail. No catalogue expansion."
    ),
    "profiles": profiles,
  }


def main() -> int:
  """Write the small, attributed source subset."""
  root = Path(__file__).resolve().parents[1]
  target = root / "src/app/src/schlossNaturkundeSource.json"
  target.write_text(json.dumps(build_source(root), separators=(",", ":")) + "\n")
  print(f"Wrote {target.name}: {target.stat().st_size:,} bytes")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
