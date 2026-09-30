"""Step 10: retain exact LoD2 sheets for the bounded Linden facade correction."""

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
from scripts.build_spree_recognition_source import extract_parent, part_profile

PARENTS = {
  "russianEmbassy": "DEBE01YYK00003En",
  "aeroflot": "DEBE01YYK00001vY",
  "einstein": "DEBE01YYK0000A6r",
  "komischeOper": "DEBE01YYK00001Ih",
}


def build_source(root: Path) -> dict[str, Any]:
  """Preserve every original millimetre, surface, source identity and height."""
  path = root / "geo_data/regierungsviertel/raw/lod2/LoD2_390_5819.zip"
  bounds = project_to_berlin(
    load_bounds_polygon(root / "geo_data/regierungsviertel/bounds.geojson")
  )
  result: dict[str, Any] = {
    "schema_version": 1,
    "source_url": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_390_5819.zip",
    "source_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    "license": "dl-de/zero-2-0",
    "origin_epsg25833_m": [389500, 5820000, 30],
    "display_ground_y_m": 5.2,
    "profiles": [],
  }
  for key, parent_id in PARENTS.items():
    parent = extract_parent(path, parent_id)
    footprint = building_footprint(parent)
    if footprint is None or not bounds.covers(footprint):
      raise ValueError(f"Source building {parent_id} leaves the approved polygon")
    parts = leaf_building_parts(parent) or [parent]
    result["profiles"].append(
      {
        "key": key,
        "parent_id": parent_id,
        "source_created": parent.findtext("core:creationDate", namespaces=NS),
        "parts": [part_profile(part, True) for part in parts],
      }
    )
  return result


if __name__ == "__main__":
  root = Path(__file__).resolve().parents[1]
  target = root / "src/app/src/unterDenLindenSource.json"
  target.write_text(json.dumps(build_source(root), separators=(",", ":")) + "\n")
