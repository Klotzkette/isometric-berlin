"""Step 10: three requested eastern outline models, with an additive scope lobe."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from build_bebelplatz_building_source import extract_parent, part_profile
from pyproj import Transformer
from shapely.geometry import box, mapping
from shapely.ops import transform

from isometric_berlin.data.fetch_lod2 import (
  NS,
  building_footprint,
  leaf_building_parts,
  load_bounds_polygon,
  project_to_berlin,
)

ROOT = Path(__file__).resolve().parents[1]
# Presentation scope only: narrow connection to the old map, not a survey.
EAST_LOBE = (391600, 5819770, 392305, 5820360)
TARGETS = (
  ("rathaus", "DEBE01YYK00000wg", "391_5819", "relation/4211905"),
  ("stationBase", "DEBE01YYK00009vV", "392_5820", "way/20144781"),
  ("stationHall", "DEBE01YYK0001z5U", "392_5820", "way/20144781"),
  ("fernsehturm", "DEBE01YYK0000B8a", "392_5820", "way/556435241"),
)


def expanded_bounds(root: Path) -> dict:
  """Preserve all of task 13 and add only the owner's named east anchors."""
  path = root / "geo_data/regierungsviertel/bounds-task13.geojson"
  original = json.loads(path.read_text())
  old = project_to_berlin(load_bounds_polygon(path))
  new = old.union(box(*EAST_LOBE))
  if new.geom_type != "Polygon" or not new.is_valid or new.interiors:
    raise ValueError("Expected one simple additive polygon")
  inverse = Transformer.from_crs(25833, 4326, always_xy=True)
  geometry = mapping(transform(inverse.transform, new))
  geometry["coordinates"] = [
    [[round(x, 9), round(y, 9)] for x, y in ring] for ring in geometry["coordinates"]
  ]
  original["features"][0].update(
    geometry=geometry,
    properties={
      "name": "Regierungsviertel bounds — v1.0.48 eastern outline extension",
      "description": "Complete retained task-13 polygon plus a narrow eastern lobe for the explicitly requested Alexanderplatz station, Fernsehturm and Rotes Rathaus outlines. The existing 93-place tour and full-detail map remain unchanged; this lobe is only an initial outline preview.",
      "source": "Owner-requested eastern extension, 2026-09-30. Union of the archived task-13 polygon and EPSG:25833 rectangle [391600,5819770,392305,5820360]. No previous area is removed. Nine-decimal CRS84 storage only.",
      "previous_area_m2": round(old.area, 3),
      "added_area_m2": round(new.area - old.area, 3),
    },
  )
  return original


def build_source(root: Path) -> dict:
  """Retain every original wall/roof sheet; no invented facade decoration."""
  bounds = project_to_berlin(
    load_bounds_polygon(root / "geo_data/regierungsviertel/bounds.geojson")
  )
  profiles = {}
  for key, parent_id, tile, osm in TARGETS:
    archive = root / f"geo_data/regierungsviertel/raw/lod2/LoD2_{tile}.zip"
    parent = extract_parent(archive, parent_id)
    footprint = building_footprint(parent)
    if footprint is None or not bounds.covers(footprint):
      raise ValueError(f"{key} leaves the approved outline extension")
    profiles[key] = {
      "parent_id": parent_id,
      "osm_identity": "https://www.openstreetmap.org/" + osm,
      "source_url": f"https://gdi.berlin.de/data/a_lod2/atom/LoD2_{tile}.zip",
      "source_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
      "source_created": parent.findtext("core:creationDate", namespaces=NS),
      "parts": [part_profile(p) for p in leaf_building_parts(parent) or [parent]],
    }
  return {
    "schema_version": 1,
    "license": "dl-de/zero-2-0",
    "origin_epsg25833_m": [389500, 5820000, 30],
    "source_attribution": "3D building models: Geoportal Berlin (dl-de/zero-2-0)",
    "profiles": profiles,
    "outline_only": True,
    "fernsehturm_total_height_m": 368,
    "conflict_policy": "Complete measured sheets remain retained. Only the television antenna above the source top is a procedural outline, reaching the published total 368 m. Rathaus keeps its measured roof without arbitrarily rescaling it to the separately published 94 m total including terminal elements. No facade details or textures are added.",
    "reference_urls": [
      "https://www.berlin.de/ost-west-ost-kulturbahnhoefe/history-walk/artikel.1558558.php",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011324%2CT",
      "https://www.berlin.de/rbmskzl/service/rotes-rathaus/architekturgeschichte/",
    ],
  }


def main() -> None:
  """Write deterministic committed supplements from retained local archives."""
  bounds = ROOT / "geo_data/regierungsviertel/bounds.geojson"
  history = bounds.with_name("bounds-task13.geojson")
  if not history.exists():
    history.write_bytes(bounds.read_bytes())
  bounds.write_text(
    json.dumps(expanded_bounds(ROOT), ensure_ascii=False, indent=2) + "\n"
  )
  output = ROOT / "src/app/src/schlossEastSource.json"
  output.write_text(json.dumps(build_source(ROOT), separators=(",", ":")) + "\n")
  print(f"Wrote {output.name}: {output.stat().st_size:,} bytes")


if __name__ == "__main__":
  main()
