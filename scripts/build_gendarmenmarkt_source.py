"""Step 10: preserve bounded Gendarmenmarkt LoD2/OSM source evidence."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import geopandas as gpd

from isometric_berlin.data.fetch_lod2 import (
  NS,
  building_footprint,
  leaf_building_parts,
  load_bounds_polygon,
  project_to_berlin,
)
from scripts.build_bebelplatz_building_source import extract_parent, part_profile


def build_source(root: Path) -> dict[str, Any]:
  """Extract complete source parents while keeping old display records."""
  path = root / "geo_data/regierungsviertel/raw/lod2/LoD2_390_5819.zip"
  old = json.loads(
    (root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  source_sha256 = hashlib.sha256(path.read_bytes()).hexdigest()
  bounds = project_to_berlin(
    load_bounds_polygon(root / "geo_data/regierungsviertel/bounds.geojson")
  )
  profiles = {}
  for key, parent, osm, ids in [
    ("frenchChurch", "DEBE01YYK000000j", "43346292", ["43346292"]),
    ("germanTower", "DEBE01YYK000085g", "43347270", ["43347270"]),
    ("germanChurch", "DEBE01YYK00004Lg", "43347597", ["43347597"]),
    ("frenchTower", "DEBE01YYK00000sJ", "28248283", ["28248283"]),
    ("konzerthaus", "DEBE01YYK0000ESD", "217512230", []),
  ]:
    e = extract_parent(path, parent)
    parts = [part_profile(p) for p in leaf_building_parts(e)]
    footprint = building_footprint(e)
    if footprint is None or not bounds.covers(footprint):
      raise ValueError(f"{parent} leaves the approved bounds")
    ids += [p["id"] for p in old if any(x["id"].endswith(p["id"]) for x in parts)]
    profiles[key] = {
      "parent_id": parent,
      "osm_identity": "https://www.openstreetmap.org/way/" + osm,
      "source_url": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_390_5819.zip",
      "source_created": e.findtext("core:creationDate", namespaces=NS),
      "source_sha256": source_sha256,
      "display_y_translation_m": round(5.2 - min(p["ground_y_m"] for p in parts), 3),
      "replaced_prism_ids": ids,
      "previous_display_prisms": [p for p in old if p["id"] in ids],
      "parts": parts,
    }
  pos = gpd.read_file(root / "geo_data/regierungsviertel/osm.gpkg", layer="pois")
  plaza = pos[pos.id == "844740667"].iloc[0]
  statue = pos[pos.id == "262457570"].iloc[0]

  def ring(coords: Any) -> list[list[float]]:
    return [[round(x - 389500, 3), round(5820000 - y, 3)] for x, y in list(coords)[:-1]]

  square = {
    "osm_key": "way/844740667",
    "license": "ODbL-1.0",
    "area_m2": round(plaza.geometry.area, 3),
    "ring": ring(plaza.geometry.exterior.coords),
    "holes": [ring(i.coords) for i in plaza.geometry.interiors],
  }
  r = {
    "schema_version": 1,
    "origin_epsg25833_m": [389500, 5820000, 30],
    "license": "dl-de/zero-2-0",
    "source_attribution": "3D building models: Geoportal Berlin (dl-de/zero-2-0)",
    "profiles": profiles,
    "square": square,
    "schiller": {
      "osm_key": "node/262457570",
      "position": [
        round(statue.geometry.x - 389500, 3),
        round(5820000 - statue.geometry.y, 3),
      ],
    },
    "conflict_policy": "Original LoD2 sheets and prior prisms remain retained. The incomplete canonical subset lacks both churches and dome towers; the full official source tile supplies their envelopes. Display ground is translated to the retained 5.2 m scene datum. Tower fan roofs and extruded cylinders are replaced in display only by curved drums/domes within their measured plans and tops. All columns, windows and sculpture shapes are non-surveyed procedural recognition subdivisions.",
  }
  return r


def main() -> int:
  """Regenerate the small source subset from retained ignored official data."""
  root = Path(__file__).resolve().parents[1]
  target = root / "src/app/src/gendarmenmarktSource.json"
  target.write_text(json.dumps(build_source(root), separators=(",", ":")) + "\n")
  print(f"Wrote {target.name}: {target.stat().st_size:,} bytes")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
