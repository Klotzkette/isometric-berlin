"""Step 10: retain all original Gymnasium Tiergarten Neubau source sheets."""

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

PARENT_ID = "DEBE01YYK0002KxL"


def build_source(root: Path) -> dict[str, Any]:
  """Keep the source, prior prisms and explicit viewer-datum translation."""
  archive = root / "geo_data/regierungsviertel/raw/lod2/LoD2_387_5820.zip"
  parent = extract_parent(archive, PARENT_ID)
  bounds = project_to_berlin(
    load_bounds_polygon(root / "geo_data/regierungsviertel/bounds.geojson")
  )
  footprint = building_footprint(parent)
  if footprint is None or not bounds.covers(footprint):
    raise ValueError("The school must remain inside the approved polygon")
  parts = [part_profile(p) for p in leaf_building_parts(parent)]
  ids = sorted(p["id"][-8:] for p in parts)
  original = json.loads(
    (root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  previous = [p for p in original if p["id"] in ids]
  if len(previous) != len(ids):
    raise ValueError("All prior school prisms must remain retained")
  return {
    "schema_version": 1,
    "parent_id": PARENT_ID,
    "origin_epsg25833_m": [389500, 5820000, 30],
    "license": "dl-de/zero-2-0",
    "source_url": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_387_5820.zip",
    "source_created": "2026-03-01",
    "source_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
    "display_y_translation_m": round(5.2 - min(p["ground_y_m"] for p in parts), 3),
    "parts": parts,
    "replaced_prism_ids": ids,
    "previous_display_prisms": previous,
    "conflict_policy": (
      "Original wall and roof sheets replace only the thirteen coarse display "
      "prisms of this parent. The 0.868 m viewer-ground translation is rigid; "
      "footprints, source heights and roof steps are unchanged. The three "
      "low Aula parts are blue, as identified by the school. White render, "
      "terracotta window strips and glazing derive from licensed photographs; "
      "facade subdivisions and entrance members are procedural display fits."
    ),
  }


def main() -> int:
  """Write the bounded source supplement without bundling the original archive."""
  root = Path(__file__).resolve().parents[1]
  target = root / "src/app/src/gymnasiumTiergartenSource.json"
  target.write_text(json.dumps(build_source(root), separators=(",", ":")) + "\n")
  print(f"Wrote {target.name}: {target.stat().st_size:,} bytes")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
