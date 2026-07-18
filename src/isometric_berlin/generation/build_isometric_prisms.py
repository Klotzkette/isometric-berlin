"""Build the hard-edged LoD2 prism payload for the drawn-isometric mode.

Unlike the Minecraft voxelisation, this payload keeps the TRUE LoD2
footprint polygons and measured heights so the viewer can extrude every
building as a crisp prism ("gezeichnete Isometrie") — the LoD2 shapes ARE
the geometry, replacing the lumpy photogrammetry mesh. Sources are the
committed additive-fusion artefacts only:

- LoD2 footprints + measured heights from ``buildings.gpkg`` (dl-de/zero-2-0)
- Ground elevation interpolated from the committed tree and street-light
  samples in ``park-details.json`` (Geoportal Berlin, dl-de/zero-2-0)
- Per-prism real colour ``tone`` sampled from the committed drawn overview
  raster ``overview_source.png`` (Step 8 render of the same open-data stack)

Scene mapping (verified against ``scene.json`` ``origin_epsg25833``):
``world_x = easting − 389500``, ``world_z = 5820000 − northing``,
``world_y`` = height in metres. All payload values are decimetre integers.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
import shapely
from PIL import Image
from shapely.geometry import LinearRing, Polygon
from shapely.geometry.polygon import orient

from isometric_berlin.data.common import load_bounds_polygon, project_geometry
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
  ORIGIN_EASTING,
  ORIGIN_NORTHING,
  REPO_ROOT,
  GroundSampler,
  compute_grid,
  load_bounds_world,
  to_world,
  verify_scene_origin,
)
from isometric_berlin.generation.render_quadrants import project_point

DEFAULT_OUT = MESH_PUBLIC_DIR / "lod2-prisms.json"
DEFAULT_OVERVIEW = (
  REPO_ROOT / "src/app/public/dzi/regierungsviertel/overview_source.png"
)

# Projection of the render that produced the COMMITTED overview_source.png and
# landmarks.json: render_overview geometry (project_point on a rectangular
# 16384×11616 canvas with a 32768 px detail budget) with a 440 m bounds margin.
# The 440 m margin is not today's CLI default (220 m) but is what the committed
# artefacts were rendered with — pinned by re-projecting committed
# landmarks.json records to 0 px agreement (see tests).
OVERVIEW_RENDER_PX = 32_768
OVERVIEW_CANVAS_WIDTH = 16_384
OVERVIEW_CANVAS_HEIGHT = 11_616
OVERVIEW_MARGIN_M = 440.0
# landmarks.json markers were projected at 18 m elevation (landmark_records).
OVERVIEW_LANDMARK_HEIGHT_M = 18.0

# Tone sampling: interior grid roughly every 3 m, refined for small parts so at
# least 5 points land inside, capped for the Tiergarten-scale footprints.
TONE_SAMPLE_STEP_M = 3.0
TONE_MIN_STEP_M = 0.375
TONE_MIN_SAMPLES = 5
TONE_MAX_SAMPLES = 200

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


def overview_projection(bounds_path: Path) -> dict[str, float]:
  """Centre and px/m scale of the committed overview render.

  Reproduces ``render_overview``/``render_quadrant`` exactly: the quad is
  centred on the projected EPSG:25833 bounds and
  ``scale = render_px / ((span_x + span_y) * 0.7)`` with the margin added to
  every side.
  """
  bounds = project_geometry(load_bounds_polygon(bounds_path))
  minx, miny, maxx, maxy = bounds.bounds
  span_x = maxx - minx + OVERVIEW_MARGIN_M * 2
  span_y = maxy - miny + OVERVIEW_MARGIN_M * 2
  return {
    "center_x": (minx + maxx) / 2,
    "center_y": (miny + maxy) / 2,
    "scale": OVERVIEW_RENDER_PX / ((span_x + span_y) * 0.7),
  }


def overview_canvas_px(
  world_x: float,
  world_z: float,
  projection: dict[str, float],
  *,
  height_m: float = 0.0,
) -> tuple[int, int]:
  """Scene world (x, z) → pixel on the 16384×11616 overview canvas.

  Delegates to the EXACT ``project_point`` the overview render used. The
  overview draws every building's ground ring at elevation 0
  (``draw_building`` projects the base at ``z=0``), so footprint tones are
  sampled with the default ``height_m=0``.
  """
  return project_point(
    world_x + ORIGIN_EASTING,
    ORIGIN_NORTHING - world_z,
    z=height_m,
    center_x=projection["center_x"],
    center_y=projection["center_y"],
    scale=projection["scale"],
    width=OVERVIEW_CANVAS_WIDTH,
    height=OVERVIEW_CANVAS_HEIGHT,
  )


def footprint_sample_points(polygon: Polygon) -> np.ndarray:
  """Deterministic interior sample grid for one footprint part.

  The grid is anchored at world multiples of the step (not at the float
  polygon bounds), so reruns are byte-identical. The step halves from 3 m
  down to 0.375 m until at least ``TONE_MIN_SAMPLES`` points fall inside the
  part (courtyard holes excluded); tiny slivers fall back to the
  representative point. Large footprints are thinned to
  ``TONE_MAX_SAMPLES`` by even index selection.
  """
  minx, minz, maxx, maxz = polygon.bounds
  points = np.empty((0, 2))
  step = TONE_SAMPLE_STEP_M
  while step >= TONE_MIN_STEP_M:
    xs = np.arange(math.ceil(minx / step), math.floor(maxx / step) + 1) * step
    zs = np.arange(math.ceil(minz / step), math.floor(maxz / step) + 1) * step
    if xs.size and zs.size:
      grid_x, grid_z = np.meshgrid(xs, zs)
      candidates = np.column_stack([grid_x.ravel(), grid_z.ravel()])
      inside = shapely.contains_xy(polygon, candidates[:, 0], candidates[:, 1])
      points = candidates[inside]
      if len(points) >= TONE_MIN_SAMPLES:
        break
    step /= 2
  if len(points) == 0:
    anchor = polygon.representative_point()
    points = np.asarray([[anchor.x, anchor.y]])
  if len(points) > TONE_MAX_SAMPLES:
    keep = np.linspace(0, len(points) - 1, TONE_MAX_SAMPLES).round().astype(int)
    points = points[np.unique(keep)]
  return points


class OverviewToneSampler:
  """Median RGB tone under each prism footprint in the committed overview.

  Footprint-interior points projected at ground level land inside the
  building's own drawn silhouette: prisms taller than the isometric wall
  band show their facade there, flat structures their drawn roof. The
  per-channel MEDIAN is robust against outline, window and shadow pixels —
  the same rationale as the viewer's ``drawnBuildings.medianColorFromPixels``.
  """

  def __init__(self, overview_path: Path, bounds_path: Path) -> None:
    image = Image.open(overview_path).convert("RGB")
    self.pixels = np.asarray(image)
    self.projection = overview_projection(bounds_path)
    # The committed overview_source.png is the LANCZOS fit_preview of the
    # full canvas (6144 px wide), so canvas pixels scale down uniformly.
    self.ratio_x = image.width / OVERVIEW_CANVAS_WIDTH
    self.ratio_y = image.height / OVERVIEW_CANVAS_HEIGHT

  def tone(self, polygon: Polygon) -> list[int] | None:
    """Per-channel median [r, g, b] or ``None`` when off-canvas."""
    samples = []
    for world_x, world_z in footprint_sample_points(polygon):
      px, py = overview_canvas_px(world_x, world_z, self.projection)
      if not (0 <= px < OVERVIEW_CANVAS_WIDTH and 0 <= py < OVERVIEW_CANVAS_HEIGHT):
        continue
      row = min(int(py * self.ratio_y), self.pixels.shape[0] - 1)
      col = min(int(px * self.ratio_x), self.pixels.shape[1] - 1)
      samples.append(self.pixels[row, col])
    if not samples:
      return None
    median = np.median(np.asarray(samples, dtype=np.int64), axis=0)
    return [int(round(float(channel))) for channel in median]


def build_prisms(
  buildings_path: Path,
  sampler: GroundSampler,
  tone_sampler: OverviewToneSampler | None = None,
) -> tuple[list[dict[str, Any]], dict[str, int]]:
  """One prism entry per LoD2 footprint polygon part, plus drop statistics."""
  buildings = gpd.read_file(buildings_path, layer="buildings")
  entries: list[dict[str, Any]] = []
  stats = {
    "source_rows": len(buildings),
    "parts": 0,
    "dropped_parts": 0,
    "dropped_flat_rows": 0,
    "toned_parts": 0,
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
      entry: dict[str, Any] = {
        "id": short_id,
        "ring": ring,
        "holes": [hole for hole in holes if hole is not None],
        "y0_dm": 0,  # filled from the batch IDW sample below
        "h_dm": h_dm,
        "class": class_id,
        "roof": roof,
        "_centroid": (centroid.x, centroid.y),
      }
      if tone_sampler is not None:
        tone = tone_sampler.tone(simplified)
        if tone is not None:
          entry["tone"] = tone
          stats["toned_parts"] += 1
      entries.append(entry)
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
  overview_path: Path = DEFAULT_OVERVIEW,
) -> tuple[dict[str, Any], dict[str, int]]:
  """Assemble the payload plus build statistics (stats are not shipped)."""
  verify_scene_origin(scene_path)
  sampler = GroundSampler.from_park_details(park_details_path)
  tone_sampler = OverviewToneSampler(overview_path, bounds_path)
  entries, stats = build_prisms(buildings_path, sampler, tone_sampler)
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
      "tone": (
        "optional per-prism [r, g, b] 0-255: per-channel median of the drawn "
        "overview raster under the ground footprint; absent when no valid "
        "raster sample exists (viewer falls back to class shades)"
      ),
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
      "tone_source": (
        "Per-prism 'tone' sampled from the committed drawn overview "
        "(overview_source.png, Step 8 render of the LoD2/OSM/Wikimedia-cue "
        "stack) at the z=0 ground footprint via the exact overview projection"
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
  parser.add_argument("--overview", type=Path, default=DEFAULT_OVERVIEW)
  parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
  args = parser.parse_args(argv)

  payload, stats = build_payload(
    args.bounds, args.buildings, args.park_details, args.scene, args.overview
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
  print(
    f"{stats['toned_parts']}/{len(entries)} prisms carry a sampled real-colour "
    f"tone ({stats['toned_parts'] / max(1, len(entries)):.1%})"
  )


if __name__ == "__main__":
  main()
