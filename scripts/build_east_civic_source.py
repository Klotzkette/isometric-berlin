"""Step 10: exact Friedrichswerder/Foreign Office source sheets, bounded only."""

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

TARGETS = {
  "church": ("way/24044937", ["24044937"], ["DEBE01YYK00001lM"]),
  "foreignOfficeNew": (
    "relation/15933949",
    ["15933949", "15933948"],
    [
      "DEBE01YYK0000AMm",
      "DEBE01YYK0001yYO",
      "DEBE00YY1Mk000Kv",
      "DEBE01YYK0001xuZ",
      "DEBE01YYK0001xIr",
    ],
  ),
  "foreignOfficeOld": (
    "relation/57390",
    ["on-57390"],
    [
      "DEBE01YYK0000437",
      "DEBE01YYK0000CRr",
      "DEBE01YYK00005YT",
      "DEBE01YYK00002hN",
      "DEBE01YYK0000BTl",
      "DEBE01YYK0001xSG",
      "DEBE01YYK0000EAK",
    ],
  ),
}


def build_source(root: Path) -> dict[str, Any]:
  """Keep every official part and prior display record; reject outside geometry."""
  bounds = project_to_berlin(
    load_bounds_polygon(root / "geo_data/regierungsviertel/bounds.geojson")
  )
  old = json.loads(
    (root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  archive = root / "geo_data/regierungsviertel/raw/lod2/LoD2_391_5819.zip"
  digest = hashlib.sha256(archive.read_bytes()).hexdigest()
  profiles = {}
  for key, (osm, ids, parents) in TARGETS.items():
    parts = []
    for parent_id in parents:
      parent = extract_parent(archive, parent_id)
      footprint = building_footprint(parent)
      if footprint is None or not bounds.covers(footprint):
        raise ValueError(f"{parent_id} leaves the approved polygon")
      parts.extend(part_profile(p) for p in leaf_building_parts(parent) or [parent])
    profiles[key] = {
      "key": key,
      "parent_ids": parents,
      "osm_identity": "https://www.openstreetmap.org/" + osm,
      "source_url": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_391_5819.zip",
      "source_created": "2026-03-02",
      "source_sha256": digest,
      "replaced_prism_ids": ids,
      "previous_display_prisms": [p for p in old if p["id"] in ids],
      "parts": parts,
    }
  return {
    "schema_version": 1,
    "license": "dl-de/zero-2-0",
    "origin_epsg25833_m": [389500, 5820000, 30],
    "source_attribution": "3D building models: Geoportal Berlin (dl-de/zero-2-0)",
    "profiles": profiles,
    "conflict_policy": "Every official wall, roof and previous OSM prism remains retained. Exact source elevation is unchanged; source basements are not street levels. The new east loggia and south reception canopy have closed LoD2 lower walls: only documented canopy sheets are opened above explicit supports. Glass atria retain their complete source sheets with glass material. Window, brick, tracery, pinnacle and column dimensions are procedural display fits, not survey data. No proposed building is included.",
  }


def main() -> int:
  """Write the bounded source supplement without modifying canonical records."""
  root = Path(__file__).resolve().parents[1]
  target = root / "src/app/src/eastCivicSource.json"
  target.write_text(json.dumps(build_source(root), separators=(",", ":")) + "\n")
  print(f"Wrote {target.name}: {target.stat().st_size:,} bytes")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
