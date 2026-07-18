"""Build the hard-edged LoD2 prism payload for the drawn-isometric mode.

Unlike the Minecraft voxelisation, this payload keeps the TRUE LoD2
footprint polygons and measured heights so the viewer can extrude every
building as a crisp prism ("gezeichnete Isometrie") — the LoD2 shapes ARE
the geometry, replacing the lumpy photogrammetry mesh. Sources are the
committed additive-fusion artefacts only:

- LoD2 footprints + measured heights from ``buildings.gpkg`` (dl-de/zero-2-0)
- Ground elevation interpolated from the committed tree and street-light
  samples in ``park-details.json`` (Geoportal Berlin, dl-de/zero-2-0)

Scene mapping (verified against ``scene.json`` ``origin_epsg25833``):
``world_x = easting − 389500``, ``world_z = 5820000 − northing``,
``world_y`` = height in metres. All payload values are decimetre integers.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
from shapely.geometry import LinearRing, Polygon
from shapely.geometry.polygon import orient

from isometric_berlin.generation.build_minecraft_voxels import (
  ATTRIBUTION,
  CELL_M,
  DEFAULT_BOUNDS,
  DEFAULT_BUILDINGS,
  DEFAULT_PARK_DETAILS,
  DEFAULT_SCENE,
  GLASS_FUNCTIONS,
  MAX_PAYLOAD_BYTES,
  MESH_PUBLIC_DIR,
  GroundSampler,
  compute_grid,
  load_bounds_world,
  to_world,
  verify_scene_origin,
)

DEFAULT_OUT = MESH_PUBLIC_DIR / "lod2-prisms.json"

# Simplification kills collinear vertex noise from the CityGML footprints but
# preserves real corners (Douglas-Peucker with topology preservation).
SIMPLIFY_TOLERANCE_M = 0.15
# Degeneracy floor. Deliberately BELOW the originally proposed 4 m²: 2,323 of
# the 3,315 committed LoD2 rows are genuine small structures (ALKIS
# 51009_1750 wall/bollard objects, median 2.4 m², default 3 m height) that the
# Minecraft voxel mode also renders — a 4 m² cut would silently drop 70 % of
# the additive LoD2 source. 1 m² removes only true sliver artefacts.
MIN_PART_AREA_M2 = 1.0
MIN_RING_POINTS = 3
DM_PER_M = 10

# Facade palette mirrors the voxel payload: ALKIS offices and the
# Hauptbahnhof station hall read as glass, everything else as concrete.
CLASSES = ["concrete", "glass"]
CLASS_CONCRETE = 0
CLASS_GLASS = 1


def quantise_ring(ring: LinearRing) -> list[list[int]] | None:
  """Encode a ring as decimetre-integer [x_dm, z_dm] pairs, open (unclosed).

  The closing vertex is dropped and consecutive duplicates created by the
  decimetre rounding are merged. Returns ``None`` when fewer than
  ``MIN_RING_POINTS`` distinct vertices survive.
  """
  coords = np.asarray(ring.coords)[:-1]  # shapely rings repeat the first point
  quantised = np.rint(coords * DM_PER_M).astype(int)
  points: list[list[int]] = []
  for x_dm, z_dm in quantised:
    if points and points[-1] == [int(x_dm), int(z_dm)]:
      continue
    points.append([int(x_dm), int(z_dm)])
  if len(points) > 1 and points[0] == points[-1]:
    points.pop()
  if len(points) < MIN_RING_POINTS:
    return None
  return points


def simplify_part(part: Polygon) -> Polygon | None:
  """Simplify one footprint part; ``None`` when it degenerates."""
  simplified = part.simplify(SIMPLIFY_TOLERANCE_M, preserve_topology=True)
  if simplified.is_empty or simplified.geom_type != "Polygon":
    return None
  if simplified.area < MIN_PART_AREA_M2:
    return None
  # Deterministic winding: exterior counter-clockwise, holes clockwise
  # (in the scene x/z frame).
  return orient(simplified)


def build_prisms(
  buildings_path: Path, sampler: GroundSampler
) -> tuple[list[dict[str, Any]], dict[str, int]]:
  """One prism entry per LoD2 footprint polygon part, plus drop statistics."""
  buildings = gpd.read_file(buildings_path, layer="buildings")
  entries: list[dict[str, Any]] = []
  stats = {
    "source_rows": len(buildings),
    "parts": 0,
    "dropped_parts": 0,
    "dropped_flat_rows": 0,
  }
  for row in buildings.itertuples(index=False):
    height_m = float(row.measured_height_m or 0.0)
    h_dm = round(height_m * DM_PER_M)
    if h_dm <= 0:  # sub-5 cm LoD2 noise cannot extrude to a visible prism
      stats["dropped_flat_rows"] += 1
      continue
    class_id = CLASS_GLASS if str(row.function) in GLASS_FUNCTIONS else CLASS_CONCRETE
    roof_raw = str(row.roof_type)
    roof = int(roof_raw) if roof_raw.isdigit() else 0
    short_id = str(row.building_id)[-8:]
    for part in to_world(row.geometry).geoms:
      stats["parts"] += 1
      simplified = simplify_part(part)
      ring = quantise_ring(simplified.exterior) if simplified is not None else None
      if simplified is None or ring is None:
        stats["dropped_parts"] += 1
        continue
      holes = [quantise_ring(interior) for interior in simplified.interiors]
      centroid = simplified.centroid
      entries.append(
        {
          "id": short_id,
          "ring": ring,
          "holes": [hole for hole in holes if hole is not None],
          "y0_dm": 0,  # filled from the batch IDW sample below
          "h_dm": h_dm,
          "class": class_id,
          "roof": roof,
          "_centroid": (centroid.x, centroid.y),
        }
      )
  if entries:
    xs = np.asarray([entry["_centroid"][0] for entry in entries])
    zs = np.asarray([entry["_centroid"][1] for entry in entries])
    for entry, ground_y in zip(entries, sampler.sample(xs, zs)):
      entry["y0_dm"] = round(float(ground_y) * DM_PER_M)
      del entry["_centroid"]
  return entries, stats


def verify_within_grid(entries: list[dict[str, Any]], grid: dict[str, int]) -> None:
  """Fail fast if any quantised vertex escapes the scene grid bounds."""
  cell_dm = int(CELL_M * DM_PER_M)
  x_lo, x_hi = grid["min_x_idx"] * cell_dm, (grid["min_x_idx"] + grid["cols"]) * cell_dm
  z_lo, z_hi = grid["min_z_idx"] * cell_dm, (grid["min_z_idx"] + grid["rows"]) * cell_dm
  for entry in entries:
    for ring in [entry["ring"], *entry["holes"]]:
      for x_dm, z_dm in ring:
        if not (x_lo <= x_dm <= x_hi and z_lo <= z_dm <= z_hi):
          raise ValueError(
            f"Prism {entry['id']} vertex ({x_dm}, {z_dm}) dm outside the "
            f"scene grid x [{x_lo}, {x_hi}], z [{z_lo}, {z_hi}]"
          )


def build_payload(
  bounds_path: Path,
  buildings_path: Path,
  park_details_path: Path,
  scene_path: Path,
) -> tuple[dict[str, Any], dict[str, int]]:
  """Assemble the payload plus build statistics (stats are not shipped)."""
  verify_scene_origin(scene_path)
  sampler = GroundSampler.from_park_details(park_details_path)
  entries, stats = build_prisms(buildings_path, sampler)
  grid = compute_grid(load_bounds_world(bounds_path))
  verify_within_grid(entries, grid)
  payload = {
    "schema_version": 1,
    "origin": {
      "epsg": 25833,
      "easting_offset": 389500.0,
      "northing_offset": 5820000.0,
      "mapping": "world_x = easting - 389500; world_z = 5820000 - northing; world_y = metres",
      "ring": "ring vertices are scene (x, z) pairs in decimetres; closing vertex omitted",
      "height_unit": "decimetres",
    },
    "source": {
      "name": "Berlin LoD2 building prisms (drawn-isometric mode)",
      "attribution": ATTRIBUTION,
      "licenses": {
        "lod2_buildings": "dl-de/zero-2-0 (Geoportal Berlin)",
        "ground_samples": "dl-de/zero-2-0 (Geoportal Berlin tree/lighting points)",
      },
      "geometry_status": (
        "True LoD2 footprint polygons simplified at 0.15 m to remove collinear "
        "noise; measured heights unsnapped; ground from IDW over committed "
        "detail samples"
      ),
    },
    "classes": CLASSES,
    "buildings": entries,
  }
  return payload, stats


def write_payload(payload: dict[str, Any], out_path: Path) -> int:
  out_path.parent.mkdir(parents=True, exist_ok=True)
  text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
  out_path.write_text(text, encoding="utf-8")
  size = out_path.stat().st_size
  if size > MAX_PAYLOAD_BYTES:
    raise ValueError(f"Prism payload is {size} bytes, above the 5 MB budget")
  return size


def main(argv: list[str] | None = None) -> None:
  parser = argparse.ArgumentParser(
    description="Build the true-footprint LoD2 prism payload for the viewer."
  )
  parser.add_argument("--bounds", type=Path, default=DEFAULT_BOUNDS)
  parser.add_argument("--buildings", type=Path, default=DEFAULT_BUILDINGS)
  parser.add_argument("--park-details", type=Path, default=DEFAULT_PARK_DETAILS)
  parser.add_argument("--scene", type=Path, default=DEFAULT_SCENE)
  parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
  args = parser.parse_args(argv)

  payload, stats = build_payload(
    args.bounds, args.buildings, args.park_details, args.scene
  )
  size = write_payload(payload, args.out)

  entries = payload["buildings"]
  with_holes = [entry for entry in entries if entry["holes"]]
  hole_count = sum(len(entry["holes"]) for entry in entries)
  print(f"Wrote {args.out} ({size / 1024:.0f} KiB)")
  print(
    f"{stats['source_rows']} LoD2 rows, {stats['parts']} footprint parts, "
    f"{len(entries)} prisms kept, {stats['dropped_parts']} degenerate parts and "
    f"{stats['dropped_flat_rows']} flat (<0.05 m) rows dropped"
  )
  print(f"{len(with_holes)} prisms carry {hole_count} courtyard holes")


if __name__ == "__main__":
  main()
