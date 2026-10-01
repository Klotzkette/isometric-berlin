"""Steps 1/10: reproduce the owner-approved v159 surrounding-city scope."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from pyproj import Transformer
from shapely.affinity import affine_transform
from shapely.geometry import Polygon, box, mapping, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = Path("geo_data/regierungsviertel")
DISTRICT_NAMES = frozenset({"Moabit", "Prenzlauer Berg"})
WORLD_ORIGIN = (389500.0, 5820000.0)
# Finite presentation scopes, not claims about administrative boundaries.
# The complete named Joachim-Friedrich-Straße and Karl-Marx-Allee fit inside.
LOBES_CRS84 = {
  "city_west": (13.282, 52.485, 13.360, 52.530),
  "northern_schoeneberg": (13.337, 52.480, 13.407, 52.503),
  "alexanderplatz_karl_marx_allee_schlesisches_tor": (13.395, 52.493, 13.457, 52.541),
  "northern_connection": (13.365, 52.520, 13.425, 52.553),
}


def build(root: Path = ROOT) -> tuple[dict[str, Any], dict[str, Any]]:
  """Union exact archived core, official districts and explicit bounded lobes."""
  archive_path = root / DATA / "bounds-v158.geojson"
  districts_path = root / DATA / "surrounding-district-boundaries.geojson"
  old_data = json.loads(archive_path.read_text())
  districts = json.loads(districts_path.read_text())
  to_metric = Transformer.from_crs(4326, 25833, always_xy=True).transform
  to_crs84 = Transformer.from_crs(25833, 4326, always_xy=True).transform
  old = transform(to_metric, shape(old_data["features"][0]["geometry"]))
  official = {
    feature["properties"]["nam"]: shape(feature["geometry"])
    for feature in districts["features"]
  }
  if set(official) != DISTRICT_NAMES:
    raise ValueError("Only the exact complete Moabit and Prenzlauer Berg are allowed")
  lobes = [transform(to_metric, box(*bounds)) for bounds in LOBES_CRS84.values()]
  union = unary_union([old, *official.values(), *lobes])
  if not isinstance(union, Polygon) or not union.is_valid or union.interiors:
    raise ValueError("Approved scopes must form one valid polygon without holes")
  if old.difference(union).area > 1e-7:
    raise ValueError("The complete v158 core must remain covered")
  # Normalize ring order before nine-decimal CRS84 storage, matching old bounds.
  geometry = mapping(transform(to_crs84, union.normalize()))
  geometry["coordinates"] = [
    [[round(x, 9), round(y, 9)] for x, y in geometry["coordinates"][0]]
  ]
  result = {
    "type": "FeatureCollection",
    "name": "regierungsviertel_bounds",
    "crs": old_data["crs"],
    "features": [
      {
        "type": "Feature",
        "properties": {
          "name": "Central Berlin bounds — v1.0.59 surrounding outline extension",
          "description": (
            "Complete retained v158 city and task-13 polygon, complete official "
            "Moabit and Prenzlauer Berg, and finite City West, northern Schöneberg, "
            "Alexanderplatz, Karl-Marx-Allee to Frankfurter Tor and Schlesisches Tor "
            "outline scopes. The existing full-detail core and 93-place tour remain "
            "unchanged; new context is explicitly rudimentary."
          ),
          "source": (
            "Owner-requested surrounding expansion, 2026-10-01. Deterministic union "
            "of bounds-v158.geojson, exact ALKIS Moabit/Prenzlauer Berg polygons "
            "and documented CRS84 lobes. No previous area is removed. Nine-decimal "
            "CRS84 storage only; see surrounding-bounds-manifest.json."
          ),
          "previous_area_m2": round(old.area, 3),
          "added_area_m2": round(union.area - old.area, 3),
        },
        "geometry": geometry,
      }
    ],
  }
  manifest = {
    "schema_version": 1,
    "bounds_revision": "v1.0.59",
    "coordinate_system": "EPSG:25833; output bounds CRS84",
    "builder": "scripts/build_surrounding_bounds.py",
    "previous_bounds": "bounds-v158.geojson",
    "previous_bounds_sha256": hashlib.sha256(archive_path.read_bytes()).hexdigest(),
    "official_boundaries": "surrounding-district-boundaries.geojson",
    "official_boundaries_sha256": hashlib.sha256(
      districts_path.read_bytes()
    ).hexdigest(),
    "official_source": districts["source"],
    "official_districts": [
      {"name": name, "area_m2": round(official[name].area, 3)}
      for name in sorted(official)
    ],
    "presentation_lobes_crs84": LOBES_CRS84,
    "bounds_epsg25833": [round(value, 3) for value in union.bounds],
    "previous_area_m2": round(old.area, 3),
    "new_area_m2": round(union.area, 3),
    "added_area_m2": round(union.area - old.area, 3),
    "tour_place_count": 93,
    "interpretation": (
      "Stalinallee is interpreted as the present Karl-Marx-Allee through "
      "Frankfurter Tor. Charlottenburg/Wilmersdorf and Schöneberg are partial "
      "finite lobes; only Moabit and Prenzlauer Berg are complete districts."
    ),
    "historical_name_source": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09085137",
    "preservation": (
      "Existing source geometry, overview projection and original terrain grid "
      "are unchanged. Added outline geometry is a separate source-bound layer."
    ),
  }
  return result, manifest


def build_navigation_scope(bounds: dict[str, Any], root: Path = ROOT) -> dict[str, Any]:
  """Keep a tiny exact scope available before any outer chunk is loaded."""
  to_metric = Transformer.from_crs(4326, 25833, always_xy=True).transform

  def world_polygon(payload: dict[str, Any]) -> Polygon:
    projected = transform(to_metric, shape(payload["features"][0]["geometry"]))
    return affine_transform(projected, [1, 0, 0, -1, -WORLD_ORIGIN[0], WORLD_ORIGIN[1]])

  def rings(polygon: Polygon) -> dict[str, Any]:
    # Full floating-point coordinates keep exactly the same boundary as the
    # source exporter. No simplification or centimetre snapping is needed.
    return {
      "ring": [list(point) for point in polygon.exterior.coords],
      "holes": [[list(point) for point in ring.coords] for ring in polygon.interiors],
    }

  archive = json.loads((root / DATA / "bounds-v158.geojson").read_text())
  core = world_polygon(archive)
  extension = world_polygon(bounds).difference(core).normalize()
  polygons = [extension] if isinstance(extension, Polygon) else list(extension.geoms)
  return {
    "groundY": 3,
    "core": rings(core),
    "footprint": [rings(polygon) for polygon in polygons],
  }


def main() -> None:
  """Write bounds, provenance and the small pre-load navigation scope."""
  bounds, manifest = build()
  for name, payload in [
    ("bounds.geojson", bounds),
    ("surrounding-bounds-manifest.json", manifest),
  ]:
    path = ROOT / DATA / name
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(path)
  scope_path = ROOT / "src/app/src/data/surroundingCityScope.json"
  scope_path.write_text(
    json.dumps(build_navigation_scope(bounds), separators=(",", ":")) + "\n"
  )
  print(scope_path)


if __name__ == "__main__":
  main()
