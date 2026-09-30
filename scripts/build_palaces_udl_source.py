"""Step 10: retain the bounded eastern Unter den Linden palais source ensemble."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import geopandas as gpd

from isometric_berlin.data.fetch_lod2 import (
  building_footprint,
  leaf_building_parts,
  load_bounds_polygon,
  project_to_berlin,
)
from scripts.build_bebelplatz_building_source import extract_parent, part_profile


def build_source(root: Path) -> dict[str, Any]:
  """Keep every original wall/roof sheet and prior OSM display record."""
  bounds = project_to_berlin(
    load_bounds_polygon(root / "geo_data/regierungsviertel/bounds.geojson")
  )
  old = json.loads(
    (root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  path = root / "geo_data/regierungsviertel/raw/lod2/LoD2_391_5819.zip"
  profiles = {}
  for key, parent_id, osm, ids, shift in [
    ("kronprinzen", "DEBE01YYK00007bf", "relation/4284350", ["-4284350"], 1.935),
    (
      "prinzessinnen",
      "DEBE01YYK00002xT",
      "way/24247322",
      ["24247322", "17728387"],
      2.434,
    ),
    ("kronprinzenPortico", "DEBE01YYK0001yuk", "relation/4284350", [], 1.935),
  ]:
    parent = extract_parent(path, parent_id)
    footprint = building_footprint(parent)
    if footprint is None or not bounds.covers(footprint):
      raise ValueError(f"{parent_id} leaves approved bounds")
    profiles[key] = {
      "parent_id": parent_id,
      "osm_identity": "https://www.openstreetmap.org/" + osm,
      "source_url": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_391_5819.zip",
      "source_created": "2026-03-02",
      "source_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
      "display_y_translation_m": shift,
      "replaced_prism_ids": ids,
      "previous_display_prisms": [p for p in old if p["id"] in ids],
      "parts": [part_profile(p) for p in leaf_building_parts(parent) or [parent]],
    }
  osm_path = root / "geo_data/regierungsviertel/osm.gpkg"
  pois = gpd.read_file(osm_path, layer="pois")
  monument = pois[(pois.element == "node") & (pois.id == "262455591")].iloc[0]
  return {
    "schema_version": 1,
    "license": "dl-de/zero-2-0",
    "origin_epsg25833_m": [389500, 5820000, 30],
    "source_attribution": "3D building models: Geoportal Berlin (dl-de/zero-2-0)",
    "profiles": profiles,
    "monument": {
      "osm_key": "node/262455591",
      "source_url": "https://www.openstreetmap.org/node/262455591",
      "name": monument["name"],
      "license": "ODbL-1.0",
      "source_sha256": hashlib.sha256(osm_path.read_bytes()).hexdigest(),
      "world_anchor_m": [monument.geometry.x - 389500, 5820000 - monument.geometry.y],
    },
    "conflict_policy": "Original walls, roofs and previous OSM prisms are retained. The mapped covered bridge, street colonnade and portico have closed LoD2 lower envelopes; display opens only their source-bound passages. Roof planes remain unchanged. Local underside, columns, windows and sculpture are procedural display estimates. Vertical translations retain the delivered 5.2 m street datum; no garden or court is filled.",
  }


def main() -> int:
  """Write the compact local supplement without downloading any data."""
  root = Path(__file__).resolve().parents[1]
  target = root / "src/app/src/palacesUdlSource.json"
  target.write_text(json.dumps(build_source(root), separators=(",", ":")) + "\n")
  print(f"Wrote {target.name}: {target.stat().st_size:,} bytes")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
