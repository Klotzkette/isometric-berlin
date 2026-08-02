"""Build the Minecraft-style voxel payload for the viewer's Minecraft mode.

The city is quantised onto a 4 m axis-aligned block grid ("eckig, klotzig,
blockig") from the committed additive-fusion sources only:

- LoD2 footprints + measured heights from ``buildings.gpkg`` (dl-de/zero-2-0)
- OSM water/road/plaza/bridge context from ``osm.gpkg`` (ODbL 1.0)
- Ground elevation interpolated from the committed tree and street-light
  samples in ``park-details.json`` (Geoportal Berlin, dl-de/zero-2-0)

Scene mapping (verified against ``scene.json`` ``origin_epsg25833``):
``world_x = easting − 389500``, ``world_z = 5820000 − northing``,
``world_y`` = height in metres. Output heights are decimetre integers.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
import pandas as pd
import shapely
from scipy.spatial import cKDTree
from shapely.geometry.base import BaseGeometry

from isometric_berlin.generation.basin_features import (
  derive_sunken_walls,
  load_water_features,
)
from isometric_berlin.generation.building_corrections import load_current_buildings

REPO_ROOT = Path(__file__).resolve().parents[3]
MESH_PUBLIC_DIR = REPO_ROOT / "src/app/public/mesh/regierungsviertel"
DEFAULT_BOUNDS = REPO_ROOT / "geo_data/regierungsviertel/bounds.geojson"
DEFAULT_BUILDINGS = REPO_ROOT / "geo_data/regierungsviertel/buildings.gpkg"
DEFAULT_OSM = REPO_ROOT / "geo_data/regierungsviertel/osm.gpkg"
DEFAULT_PARK_DETAILS = MESH_PUBLIC_DIR / "park-details.json"
DEFAULT_SCENE = MESH_PUBLIC_DIR / "scene.json"
DEFAULT_OUT = MESH_PUBLIC_DIR / "minecraft-voxels.json"

CELL_M = 4.0
ORIGIN_EASTING = 389500.0
ORIGIN_NORTHING = 5820000.0
# Spree/Kanal water table. The banks in this extract sit at ~4.2 m and
# the surveyed drop to the Spree (31.4 m NHN against ~35.9 m NHN at the
# Kapelle- and Reichstagufer) is ~4.5 m, so the river runs in a real cut
# behind high quay walls instead of level with the streets.
WATER_TOP_Y_M = -1.15
ROAD_BUFFER_M = 6.0
IDW_NEIGHBOURS = 8
IDW_POWER = 2.0
TREE_MIN_HEIGHT_M = 8.0
MAX_PAYLOAD_BYTES = 5 * 1024 * 1024

CLASSES = [
  "grass",
  "asphalt",
  "water",
  "concrete",
  "glass",
  "plazaBrick",
  "bridge",
  "basin",
  "wall",
]
CLASS_GRASS = 0
CLASS_ASPHALT = 1
CLASS_WATER = 2
CLASS_CONCRETE = 3
CLASS_GLASS = 4
CLASS_PLAZA_BRICK = 5
CLASS_BRIDGE = 6
# A constructed basin is water that sits on the ground it was built into,
# so its cells keep the local terrain height instead of the Spree table.
CLASS_BASIN = 7
# A freestanding wall is a building column with no interior, so the voxel
# viewer must not punch its storey-banded window rows into it.
CLASS_WALL = 8
# Height of Girot's wedge at its high point, read off the owner's photographs
# of the Sinkende Mauer; the drawn city uses the same figure.
SUNKEN_WALL_RISE_M = 5.6
SUNKEN_WALL_ENTRANCE_M = 1.0

# ALKIS function codes rendered as glass blocks: offices (Bürogebäude) and the
# Hauptbahnhof station hall (Bahnhofshalle / Empfangsgebäude). Everything else
# stays concrete — LoD2 carries no facade material, this is a display palette.
GLASS_FUNCTIONS = {"31001_2020", "31001_3091"}
# ALKIS roof-form codes treated as gabled/hipped for the stepped roof tier:
# Satteldach, Walmdach, Krüppelwalmdach, Mansardendach.
GABLED_HIPPED_ROOF_TYPES = {"3100", "3200", "3300", "3400"}
# OSM highway classes that read as vehicular asphalt. Footways/paths are left
# to the plaza polygons or grass so the Tiergarten does not turn into tarmac.
ASPHALT_HIGHWAYS = {
  "living_street",
  "motorway",
  "motorway_link",
  "primary",
  "primary_link",
  "residential",
  "secondary",
  "secondary_link",
  "service",
  "tertiary",
  "tertiary_link",
  "trunk",
  "trunk_link",
  "unclassified",
}

ATTRIBUTION = (
  "© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0)"
)


def to_world(geometry: BaseGeometry) -> BaseGeometry:
  """Map EPSG:25833 geometry into viewer scene coordinates (x=east, z=south)."""

  def _convert(coords: np.ndarray) -> np.ndarray:
    return np.column_stack(
      [coords[:, 0] - ORIGIN_EASTING, ORIGIN_NORTHING - coords[:, 1]]
    )

  return shapely.transform(geometry, _convert)


def verify_scene_origin(scene_path: Path) -> None:
  """Fail fast if the packaged scene origin no longer matches this mapping."""
  scene = json.loads(scene_path.read_text(encoding="utf-8"))
  origin = scene.get("origin_epsg25833")
  if not origin or origin[0] != ORIGIN_EASTING or origin[1] != ORIGIN_NORTHING:
    raise ValueError(
      f"scene.json origin_epsg25833 {origin} does not match the expected "
      f"({ORIGIN_EASTING}, {ORIGIN_NORTHING}) voxel mapping"
    )
  axes = scene.get("world_axes", {})
  if axes and (axes.get("x") != "east" or axes.get("z") != "south"):
    raise ValueError(f"scene.json world_axes {axes} do not match x=east/z=south")


def snap_up(height_m: float, minimum_m: float = CELL_M) -> int:
  """Round a metre height up to the next 4 m block multiple (integer metres)."""
  blocks = max(1, math.ceil(height_m / CELL_M - 1e-9))
  return max(int(minimum_m), int(blocks * CELL_M))


class GroundSampler:
  """IDW ground-height interpolation from committed park-detail y samples."""

  def __init__(self, positions_xz: np.ndarray, heights: np.ndarray) -> None:
    if len(positions_xz) == 0:
      raise ValueError("Ground sampling requires at least one sample point")
    self._tree = cKDTree(positions_xz)
    self._heights = heights
    self.sample_count = len(heights)

  @classmethod
  def from_park_details(cls, park_details_path: Path) -> "GroundSampler":
    payload = json.loads(park_details_path.read_text(encoding="utf-8"))
    points = [item["position"] for item in payload.get("trees", [])]
    points += [item["position"] for item in payload.get("street_lights", [])]
    if not points:
      raise ValueError(f"No ground samples found in {park_details_path}")
    array = np.asarray(points, dtype=float)
    return cls(array[:, [0, 2]], array[:, 1])

  def sample(self, xs: np.ndarray, zs: np.ndarray) -> np.ndarray:
    """Inverse-distance-weighted ground height at world (x, z) positions."""
    query = np.column_stack([xs, zs])
    k = min(IDW_NEIGHBOURS, self.sample_count)
    distances, indices = self._tree.query(query, k=k)
    distances = np.atleast_2d(distances)
    indices = np.atleast_2d(indices)
    weights = 1.0 / np.maximum(distances, 0.5) ** IDW_POWER
    values = self._heights[indices]
    return np.sum(values * weights, axis=1) / np.sum(weights, axis=1)


def load_bounds_world(bounds_path: Path) -> BaseGeometry:
  bounds = gpd.read_file(bounds_path).to_crs(epsg=25833)
  return to_world(bounds.geometry.union_all())


def compute_grid(bounds_world: BaseGeometry) -> dict[str, int]:
  min_x, min_z, max_x, max_z = bounds_world.bounds
  min_x_idx = math.floor(min_x / CELL_M)
  min_z_idx = math.floor(min_z / CELL_M)
  cols = math.ceil(max_x / CELL_M) - min_x_idx
  rows = math.ceil(max_z / CELL_M) - min_z_idx
  return {"min_x_idx": min_x_idx, "min_z_idx": min_z_idx, "cols": cols, "rows": rows}


def cell_centres(grid: dict[str, int]) -> tuple[np.ndarray, np.ndarray]:
  """Row-major (rows × cols) world-coordinate cell-centre arrays."""
  xs = (grid["min_x_idx"] + np.arange(grid["cols"]) + 0.5) * CELL_M
  zs = (grid["min_z_idx"] + np.arange(grid["rows"]) + 0.5) * CELL_M
  return np.meshgrid(xs, zs)


def bridge_line_geometries(frame: gpd.GeoDataFrame) -> list[BaseGeometry]:
  """Line geometries whose OSM ``bridge`` tag is truthy (any value except "no")."""
  if "bridge" not in frame.columns:
    return []
  tagged = frame[
    frame["bridge"].notna()
    & (frame["bridge"].astype(str).str.lower() != "no")
    & frame.geometry.geom_type.isin(["LineString", "MultiLineString"])
  ]
  return list(tagged.geometry)


def aboveground(frame: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
  """Drop ways that are tunnelled, roofed over or on a negative layer.

  The block world paves from centrelines, so without this the
  Tiergartentunnel gets an asphalt stripe across the park it runs under.
  """
  keep = np.ones(len(frame), dtype=bool)
  for column in ("tunnel", "covered"):
    if column in frame.columns:
      values = frame[column].astype("string").str.lower()
      keep &= ~(values.notna() & ~values.isin(["", "no"]))
  if "layer" in frame.columns:
    depth = pd.to_numeric(frame["layer"], errors="coerce")
    keep &= ~(depth.notna() & (depth < 0))
  return frame[keep]


def classify_ground(
  grid: dict[str, int], bounds_world: BaseGeometry, osm_path: Path
) -> np.ndarray:
  """Per-cell ground class grid; -1 marks cells outside the bounds polygon."""
  centre_x, centre_z = cell_centres(grid)
  flat_x = centre_x.ravel()
  flat_z = centre_z.ravel()
  inside = shapely.contains_xy(bounds_world, flat_x, flat_z)

  classes = np.full(flat_x.shape, -1, dtype=np.int8)
  classes[inside] = CLASS_GRASS

  inside_points = shapely.points(flat_x[inside], flat_z[inside])
  inside_positions = np.flatnonzero(inside)

  roads = aboveground(gpd.read_file(osm_path, layer="roads"))
  road_lines = roads[
    roads.geometry.geom_type.isin(["LineString", "MultiLineString"])
    & roads["highway"].isin(ASPHALT_HIGHWAYS)
  ]
  if len(road_lines):
    line_tree = shapely.STRtree([to_world(g) for g in road_lines.geometry])
    hits = line_tree.query(inside_points, predicate="dwithin", distance=ROAD_BUFFER_M)
    classes[inside_positions[np.unique(hits[0])]] = CLASS_ASPHALT

  plaza_polygons = roads[roads.geometry.geom_type.isin(["Polygon", "MultiPolygon"])]
  if len(plaza_polygons):
    plaza_union = to_world(plaza_polygons.geometry.union_all())
    plaza_mask = shapely.contains_xy(plaza_union, flat_x[inside], flat_z[inside])
    classes[inside_positions[plaza_mask]] = CLASS_PLAZA_BRICK

  water = gpd.read_file(osm_path, layer="water")
  water_polygons = water[water.geometry.geom_type.isin(["Polygon", "MultiPolygon"])]
  if len(water_polygons):
    water_union = to_world(water_polygons.geometry.union_all())
    water_mask = shapely.contains_xy(water_union, flat_x[inside], flat_z[inside])
    classes[inside_positions[water_mask]] = CLASS_WATER

  # Constructed basins ride the terrain, so they are their own class; the
  # sunken wall standing in one is concrete, and has to be painted after
  # the basin or the basin would swallow it.
  features = load_water_features(osm_path)
  basins = [f.geometry for f in features if f.kind == "basin"]
  if basins:
    basin_union = to_world(shapely.union_all(basins))
    basin_mask = shapely.contains_xy(basin_union, flat_x[inside], flat_z[inside])
    classes[inside_positions[basin_mask]] = CLASS_BASIN
  walls = derive_sunken_walls(osm_path, features)
  if walls:
    wall_union = to_world(shapely.union_all([wall.geometry for wall in walls]))
    wall_mask = shapely.contains_xy(wall_union, flat_x[inside], flat_z[inside])
    classes[inside_positions[wall_mask]] = CLASS_CONCRETE

  # Bridge decks: OSM road/rail lines tagged bridge (Moltkebrücke, Gustav-
  # Heinemann-Brücke, S-Bahn viaduct, ...) reclaim the water cells they span
  # so the Spree crossings do not vanish into unbroken water.
  rail = aboveground(gpd.read_file(osm_path, layer="rail"))
  bridge_lines = bridge_line_geometries(roads) + bridge_line_geometries(rail)
  if bridge_lines:
    bridge_tree = shapely.STRtree([to_world(g) for g in bridge_lines])
    hits = bridge_tree.query(inside_points, predicate="dwithin", distance=ROAD_BUFFER_M)
    near_bridge = inside_positions[np.unique(hits[0])]
    over_water = near_bridge[classes[near_bridge] == CLASS_WATER]
    classes[over_water] = CLASS_BRIDGE

  return classes.reshape(grid["rows"], grid["cols"])


def encode_ground_rows(class_grid: np.ndarray) -> list[list[list[int]]]:
  """Per-row run-length encoding: rows[z] = [[x_start_col, run_length, class]]."""
  rows: list[list[list[int]]] = []
  for row in class_grid:
    runs: list[list[int]] = []
    start = 0
    while start < len(row):
      value = int(row[start])
      end = start
      while end < len(row) and row[end] == value:
        end += 1
      if value >= 0:
        runs.append([start, end - start, value])
      start = end
    rows.append(runs)
  return rows


def building_cells(
  geometry: BaseGeometry, grid: dict[str, int]
) -> set[tuple[int, int]]:
  """Grid cells whose centre falls inside a world-space footprint polygon."""
  min_x, min_z, max_x, max_z = geometry.bounds
  x_lo = max(math.floor(min_x / CELL_M), grid["min_x_idx"])
  x_hi = min(math.ceil(max_x / CELL_M), grid["min_x_idx"] + grid["cols"])
  z_lo = max(math.floor(min_z / CELL_M), grid["min_z_idx"])
  z_hi = min(math.ceil(max_z / CELL_M), grid["min_z_idx"] + grid["rows"])
  if x_hi <= x_lo or z_hi <= z_lo:
    return set()
  xs = (np.arange(x_lo, x_hi) + 0.5) * CELL_M
  zs = (np.arange(z_lo, z_hi) + 0.5) * CELL_M
  grid_x, grid_z = np.meshgrid(xs, zs)
  mask = shapely.contains_xy(geometry, grid_x.ravel(), grid_z.ravel()).reshape(
    grid_x.shape
  )
  cells: set[tuple[int, int]] = set()
  for row_index, col_index in zip(*np.nonzero(mask)):
    cells.add((x_lo + int(col_index), z_lo + int(row_index)))
  return cells


def inset_cells(cells: set[tuple[int, int]]) -> set[tuple[int, int]]:
  """Cells whose four grid neighbours all belong to the same footprint."""
  return {
    (x, z)
    for x, z in cells
    if {(x - 1, z), (x + 1, z), (x, z - 1), (x, z + 1)} <= cells
  }


def rasterise_buildings(
  buildings_path: Path, grid: dict[str, int]
) -> dict[tuple[int, int], tuple[int, int, bool]]:
  """Merge LoD2 footprints into one column per cell.

  Returns cell → (height_m_snapped, class_id, has_roof_tier); the tallest
  covering building wins a contested cell (stable source order breaks ties).
  """
  buildings = load_current_buildings(buildings_path)
  merged: dict[tuple[int, int], tuple[int, int, bool]] = {}
  for row in buildings.itertuples(index=False):
    height = float(row.measured_height_m or 0.0)
    if height <= 0.0:
      continue
    snapped = snap_up(height)
    class_id = CLASS_GLASS if str(row.function) in GLASS_FUNCTIONS else CLASS_CONCRETE
    cells = building_cells(to_world(row.geometry), grid)
    if not cells:
      continue
    tier = (
      inset_cells(cells) if str(row.roof_type) in GABLED_HIPPED_ROOF_TYPES else set()
    )
    for cell in cells:
      existing = merged.get(cell)
      if existing is None or snapped > existing[0]:
        merged[cell] = (snapped, class_id, cell in tier)
  return merged


def sunken_wall_columns(
  osm_path: Path, grid: dict[str, int], sampler: GroundSampler
) -> list[list[int]]:
  """Blocky wedges for the sunken walls: one column per cell along the axis.

  Painting the wall's footprint concrete leaves it flat, so in the block
  world Girot's wedge read as a grey stripe on the water. Stepping a column
  up along the foot→crest axis gives back the ramp — coarsely, because the
  4 m grid can only step it in 4 m tiers, which is what the block world is.
  """
  walls = derive_sunken_walls(osm_path, load_water_features(osm_path))
  if not walls:
    return []
  x_hi = grid["min_x_idx"] + grid["cols"]
  z_hi = grid["min_z_idx"] + grid["rows"]
  per_cell: dict[tuple[int, int], float] = {}
  for wall in walls:
    foot_x = wall.foot_end[0] - ORIGIN_EASTING
    foot_z = ORIGIN_NORTHING - wall.foot_end[1]
    crest_x = wall.crest_end[0] - ORIGIN_EASTING
    crest_z = ORIGIN_NORTHING - wall.crest_end[1]
    length = math.hypot(crest_x - foot_x, crest_z - foot_z)
    if length <= 0:
      continue
    steps = max(1, math.ceil(length / (CELL_M / 2)))
    for step in range(steps + 1):
      t = step / steps
      x = foot_x + (crest_x - foot_x) * t
      z = foot_z + (crest_z - foot_z) * t
      x_idx = math.floor(x / CELL_M)
      z_idx = math.floor(z / CELL_M)
      if not (grid["min_x_idx"] <= x_idx < x_hi and grid["min_z_idx"] <= z_idx < z_hi):
        continue
      height = SUNKEN_WALL_RISE_M * t
      per_cell[(x_idx, z_idx)] = max(per_cell.get((x_idx, z_idx), 0.0), height)
  if not per_cell:
    return []
  cells = sorted(per_cell)
  ground = sampler.sample(
    np.asarray([(x + 0.5) * CELL_M for x, _ in cells]),
    np.asarray([(z + 0.5) * CELL_M for _, z in cells]),
  )
  # One datum for the whole wedge. Seating every column on its own ground
  # would notch the crown wherever the basin floor dips, and a wedge whose
  # crown wanders up and down is no longer a wedge.
  base_y = float(np.min(ground))
  columns: list[list[int]] = []
  for cell, ground_y in zip(cells, ground):
    # The entrance end is still essentially at grade, and the block world
    # cannot draw a column shorter than one cell, so leave it as paving
    # rather than putting a 4 m step where you are meant to walk on.
    if per_cell[cell] < SUNKEN_WALL_ENTRANCE_M:
      continue
    crown = float(ground_y) + per_cell[cell]
    blocks = math.ceil((crown - base_y) / CELL_M - 1e-9)
    y0_dm = round(base_y * 10)
    columns.append(
      [cell[0], cell[1], y0_dm, y0_dm + blocks * int(CELL_M) * 10, CLASS_WALL]
    )
  return columns


def build_tree_blocks(park_details_path: Path, grid: dict[str, int]) -> list[list[int]]:
  """One voxel tree per occupied cell: [x_idx, z_idx, ground_y_dm, height_dm]."""
  payload = json.loads(park_details_path.read_text(encoding="utf-8"))
  per_cell: dict[tuple[int, int], tuple[int, int]] = {}
  x_hi = grid["min_x_idx"] + grid["cols"]
  z_hi = grid["min_z_idx"] + grid["rows"]
  for tree in payload.get("trees", []):
    x, y, z = tree["position"]
    x_idx = math.floor(x / CELL_M)
    z_idx = math.floor(z / CELL_M)
    if not (grid["min_x_idx"] <= x_idx < x_hi and grid["min_z_idx"] <= z_idx < z_hi):
      continue
    height_dm = snap_up(float(tree.get("height_m") or 7.0), TREE_MIN_HEIGHT_M) * 10
    y0_dm = round(y * 10)
    existing = per_cell.get((x_idx, z_idx))
    if existing is None or height_dm > existing[1]:
      per_cell[(x_idx, z_idx)] = (y0_dm, height_dm)
  return [
    [x_idx, z_idx, y0_dm, height_dm]
    for (x_idx, z_idx), (y0_dm, height_dm) in sorted(per_cell.items())
  ]


def build_payload(
  bounds_path: Path,
  buildings_path: Path,
  osm_path: Path,
  park_details_path: Path,
  scene_path: Path,
) -> dict[str, Any]:
  verify_scene_origin(scene_path)
  bounds_world = load_bounds_world(bounds_path)
  grid = compute_grid(bounds_world)
  sampler = GroundSampler.from_park_details(park_details_path)

  class_grid = classify_ground(grid, bounds_world, osm_path)
  ground_rows = encode_ground_rows(class_grid)

  merged = rasterise_buildings(buildings_path, grid)
  columns: list[list[int]] = []
  if merged:
    cells = sorted(merged)
    centre_x = np.asarray([(x + 0.5) * CELL_M for x, _ in cells])
    centre_z = np.asarray([(z + 0.5) * CELL_M for _, z in cells])
    ground = sampler.sample(centre_x, centre_z)
    for (x_idx, z_idx), ground_y in zip(cells, ground):
      snapped, class_id, has_tier = merged[(x_idx, z_idx)]
      y0_dm = round(float(ground_y) * 10)
      y1_dm = y0_dm + snapped * 10
      columns.append([x_idx, z_idx, y0_dm, y1_dm, class_id])
      if has_tier:
        columns.append([x_idx, z_idx, y1_dm, y1_dm + int(CELL_M * 10), class_id])

  columns.extend(sunken_wall_columns(osm_path, grid, sampler))

  trees = build_tree_blocks(park_details_path, grid)

  coarse_stride = 4
  coarse_cols = math.ceil(grid["cols"] / coarse_stride)
  coarse_rows = math.ceil(grid["rows"] / coarse_stride)
  coarse_x = (
    grid["min_x_idx"] + (np.arange(coarse_cols) + 0.5) * coarse_stride
  ) * CELL_M
  coarse_z = (
    grid["min_z_idx"] + (np.arange(coarse_rows) + 0.5) * coarse_stride
  ) * CELL_M
  mesh_x, mesh_z = np.meshgrid(coarse_x, coarse_z)
  coarse_ground = sampler.sample(mesh_x.ravel(), mesh_z.ravel())
  ground_height = {
    "stride_cells": coarse_stride,
    "cols": coarse_cols,
    "rows": coarse_rows,
    "y_dm": [int(round(v * 10)) for v in coarse_ground],
  }

  return {
    "schema_version": 1,
    "cell_m": CELL_M,
    "origin": {
      "epsg": 25833,
      "easting_offset": ORIGIN_EASTING,
      "northing_offset": ORIGIN_NORTHING,
      "mapping": "world_x = easting - 389500; world_z = 5820000 - northing; world_y = metres",
      "cell": "cell (x_idx, z_idx) spans world x in [x_idx*4, x_idx*4+4), z in [z_idx*4, z_idx*4+4)",
      "height_unit": "decimetres",
    },
    "source": {
      "name": "Additive LoD2 + OSM + Geoportal Berlin voxelisation",
      "attribution": ATTRIBUTION,
      "licenses": {
        "lod2_buildings": "dl-de/zero-2-0 (Geoportal Berlin)",
        "osm_context": "ODbL-1.0 (© OpenStreetMap contributors)",
        "ground_samples": "dl-de/zero-2-0 (Geoportal Berlin tree/lighting points)",
      },
      "geometry_status": (
        "Display quantisation to a 4 m block grid; heights snapped up to 4 m "
        "multiples, ground interpolated from committed detail samples"
      ),
    },
    "water_top_y_m": WATER_TOP_Y_M,
    "grid": grid,
    "classes": CLASSES,
    "ground_rows": ground_rows,
    "ground_height": ground_height,
    "buildings": columns,
    "trees": trees,
  }


def write_payload(payload: dict[str, Any], out_path: Path) -> int:
  out_path.parent.mkdir(parents=True, exist_ok=True)
  text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
  out_path.write_text(text, encoding="utf-8")
  size = out_path.stat().st_size
  if size > MAX_PAYLOAD_BYTES:
    raise ValueError(f"Voxel payload is {size} bytes, above the 5 MB budget")
  return size


def main(argv: list[str] | None = None) -> None:
  parser = argparse.ArgumentParser(
    description="Build the 4 m voxel-world payload for the Minecraft view mode."
  )
  parser.add_argument("--bounds", type=Path, default=DEFAULT_BOUNDS)
  parser.add_argument("--buildings", type=Path, default=DEFAULT_BUILDINGS)
  parser.add_argument("--osm", type=Path, default=DEFAULT_OSM)
  parser.add_argument("--park-details", type=Path, default=DEFAULT_PARK_DETAILS)
  parser.add_argument("--scene", type=Path, default=DEFAULT_SCENE)
  parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
  args = parser.parse_args(argv)

  payload = build_payload(
    args.bounds, args.buildings, args.osm, args.park_details, args.scene
  )
  size = write_payload(payload, args.out)

  ground_cells = sum(run[1] for row in payload["ground_rows"] for run in row)
  print(f"Wrote {args.out} ({size / 1024:.0f} KiB)")
  print(
    f"grid {payload['grid']['cols']}x{payload['grid']['rows']} cells, "
    f"{ground_cells} ground cells, {len(payload['buildings'])} building columns, "
    f"{len(payload['trees'])} tree blocks"
  )


if __name__ == "__main__":
  main()
