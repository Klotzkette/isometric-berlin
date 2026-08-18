"""Build the compact open-data detail payload used by the Three.js viewer.

The output fuses OSM paths/playgrounds/tree evidence with official Berlin tree,
public-lighting and Vorderlandmauer layers. Raw responses and Berlin mesh sources
remain outside the public bundle.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import geopandas as gpd
import numpy as np
import shapely
import trimesh
from pandas import isna
from scipy.spatial import cKDTree
from shapely.geometry import LineString, MultiLineString, MultiPolygon, Point, Polygon
from shapely.geometry.base import BaseGeometry

from isometric_berlin.generation.build_surface_polygons import (
  optional_osm_text,
  road_surface_kind,
)
from isometric_berlin.generation.road_geometry import road_width_m

PATH_HIGHWAYS = {
  "bridleway",
  "cycleway",
  "footway",
  "path",
  "pedestrian",
  "steps",
  "track",
}
PLAYGROUND_NAMES = {"24911694": "Spielplatz an der Luiseninsel"}
REPO_ROOT = Path(__file__).resolve().parents[3]
MESHOPT_DECOMPRESSOR = REPO_ROOT / "src/app/scripts/decompress-meshopt.mjs"
TREE_MATCH_DISTANCE_M = 3.0
OFFICIAL_HEIGHT_SAFETY_MAX_M = 40.0
OFFICIAL_CROWN_RADIUS_SAFETY_MAX_M = 15.0
OFFICIAL_TRUNK_RADIUS_SAFETY_MAX_M = 1.5
PATH_MATERIAL_CODES = {
  "asphalt": "a",
  "paving": "p",
  "sand": "g",
  "earth": "e",
  "wood": "w",
  "metal": "m",
}
# The broad surface-polygons layer intentionally merges related materials into
# six draw families.  Close park ribbons retain the distinctions a pedestrian
# actually reads: loose fine gravel, mechanically compacted aggregate, sand and
# dressed setts must not all become the same yellow strip.  These one-byte codes
# keep the complete source-backed layer within its browser payload budget.
SETT_PATH_SURFACES = {
  "cobblestone",
  "pebblestone",
  "sett",
  "unhewn_cobblestone",
}
FINE_GRAVEL_PATH_SURFACES = {"fine_gravel", "gravel", "shells"}
TIERGARTEN_VEGETATION_DEFAULT = (
  REPO_ROOT / "geo_data/regierungsviertel/tiergarten-vegetation.geojson"
)
SHRUB_CLUSTER_SPACING_M = 5.4
SHRUB_PATH_CLEARANCE_M = 0.75
SHRUB_MONUMENT_CLEARANCE_M = 5.0
SHRUB_PLAYGROUND_CLEARANCE_M = 1.0
DEFAULT_HEDGE_HEIGHT_M = 1.45
DEFAULT_HEDGE_WIDTH_M = 1.0


@dataclass(frozen=True)
class SceneOrigin:
  easting: float
  elevation: float
  northing: float


class MeshGroundSampler:
  """Estimate display-ground height from the already packaged official mesh."""

  def __init__(self, vertices: np.ndarray) -> None:
    if vertices.ndim != 2 or vertices.shape[1] != 3 or len(vertices) == 0:
      raise ValueError("Mesh ground sampling requires XYZ vertices")
    self._vertices = vertices
    self._tree = cKDTree(vertices[:, [0, 2]])
    plausible_ground = vertices[(vertices[:, 1] >= -2.5) & (vertices[:, 1] <= 9.5), 1]
    if len(plausible_ground) < 32:
      raise ValueError("Mesh ground sampling requires plausible terrain vertices")
    bins = np.arange(-2.5, 9.75, 0.25)
    counts, edges = np.histogram(plausible_ground, bins=bins)
    mode_index = int(np.argmax(counts))
    self._fallback_ground = float((edges[mode_index] + edges[mode_index + 1]) / 2)

  @classmethod
  def from_directory(cls, mesh_dir: Path) -> MeshGroundSampler:
    vertices: list[np.ndarray] = []
    paths = sorted(mesh_dir.glob("tile-*.glb"))
    if paths and not MESHOPT_DECOMPRESSOR.is_file():
      raise FileNotFoundError(f"Missing Meshopt decompressor: {MESHOPT_DECOMPRESSOR}")
    with tempfile.TemporaryDirectory(prefix="isometric-berlin-ground-") as temp_dir:
      for index, path in enumerate(paths):
        decoded = Path(temp_dir) / f"tile-{index}.glb"
        result = subprocess.run(
          ["bun", str(MESHOPT_DECOMPRESSOR), str(path.resolve()), str(decoded)],
          cwd=REPO_ROOT / "src/app",
          check=False,
          capture_output=True,
          text=True,
          timeout=60,
        )
        if result.returncode != 0 or not decoded.is_file():
          message = result.stderr.strip() or result.stdout.strip() or "unknown error"
          raise RuntimeError(f"Could not decode {path.name}: {message}")
        loaded = trimesh.load(decoded, force="scene")
        for node_name in loaded.graph.nodes_geometry:
          transform, geometry_name = loaded.graph[node_name]
          geometry = loaded.geometry[geometry_name]
          if hasattr(geometry, "vertices") and len(geometry.vertices) > 0:
            vertices.append(
              trimesh.transform_points(np.asarray(geometry.vertices), transform)
            )
    if not vertices:
      raise FileNotFoundError(f"No packaged base-tile geometry found in {mesh_dir}")
    return cls(np.vstack(vertices))

  def height(self, x: float, z: float) -> float:
    local_indices = self._tree.query_ball_point([x, z], r=25.0)
    local = self._vertices[np.asarray(local_indices, dtype=int), 1]
    local_ground = local[(local >= -2.5) & (local <= 9.5)]
    # Dense photogrammetric crowns can contain thousands of vertices and no
    # ground directly below. Prefer a low local terrain quantile; expand to an
    # 80 m window only when the local sample is absent or canopy-dominated.
    # The bounds are relative to the scene's 30 m NHN origin; geometry above
    # this band is architecture/canopy rather than plausible local ground.
    if len(local_ground) >= 32 and np.percentile(local_ground, 10) <= 7.0:
      estimate = float(np.percentile(local_ground, 10))
    else:
      broad_indices = self._tree.query_ball_point([x, z], r=80.0)
      if not broad_indices:
        estimate = self._fallback_ground
      else:
        broad = self._vertices[np.asarray(broad_indices, dtype=int), 1]
        broad_ground = broad[(broad >= -2.5) & (broad <= 9.5)]
        estimate = (
          float(np.percentile(broad_ground, 2))
          if len(broad_ground) >= 32
          else self._fallback_ground
        )
    return round(estimate + 0.12, 3)


def scene_origin(scene_path: Path) -> SceneOrigin:
  payload = json.loads(scene_path.read_text(encoding="utf-8"))
  easting, northing, elevation = payload["origin_epsg25833"]
  return SceneOrigin(float(easting), float(elevation), float(northing))


def world_position(
  point: Point, origin: SceneOrigin, sampler: MeshGroundSampler
) -> list[float]:
  x = float(point.x) - origin.easting
  z = origin.northing - float(point.y)
  # A centimetre is already finer than the rendering and source-position
  # contracts. Avoid carrying meaningless millimetre digits across ~36k
  # records so the complete additive detail layer remains distributable.
  return [round(x, 2), sampler.height(x, z), round(z, 2)]


def line_parts(geometry: BaseGeometry) -> Iterable[LineString]:
  if isinstance(geometry, LineString):
    yield geometry
  elif isinstance(geometry, MultiLineString):
    yield from geometry.geoms


def polygon_parts(geometry: BaseGeometry) -> Iterable[Polygon]:
  if isinstance(geometry, Polygon):
    yield geometry
  elif isinstance(geometry, MultiPolygon):
    yield from geometry.geoms


def stable_seed(value: str) -> int:
  return int(hashlib.sha256(value.encode("utf-8")).hexdigest()[:8], 16)


def parse_positive_number(value: object) -> float | None:
  try:
    number = float(str(value).replace(",", "."))
  except (TypeError, ValueError):
    return None
  return number if math.isfinite(number) and number > 0 else None


def parse_finite_number(value: object) -> float | None:
  try:
    number = float(str(value).replace(",", "."))
  except (TypeError, ValueError):
    return None
  return number if math.isfinite(number) else None


def optional_text(value: object) -> str | None:
  if value is None or bool(isna(value)):
    return None
  text = str(value).strip()
  return text if text and text.lower() not in {"nan", "none"} else None


def path_material_code(row: Any, highway: str, in_park: bool) -> str:
  """Compact, source-faithful close-view material for one mapped path."""
  surface = optional_osm_text(row.get("surface"))
  if surface in SETT_PATH_SURFACES:
    return "c"
  if surface in FINE_GRAVEL_PATH_SURFACES:
    return "f"
  if surface == "sand":
    return "s"
  # An explicitly informal path without a surface survey is open ground, not
  # the compacted-aggregate fallback used by an ordinary untagged park walk.
  if surface is None and optional_osm_text(row.get("informal")) == "yes":
    return "e"
  resolved = road_surface_kind(row, highway, in_park)
  return PATH_MATERIAL_CODES[resolved]


def build_paths(
  roads: gpd.GeoDataFrame,
  detail_areas: gpd.GeoDataFrame,
  origin: SceneOrigin,
  sampler: MeshGroundSampler,
) -> list[dict[str, Any]]:
  paths: list[dict[str, Any]] = []
  candidates = roads[roads["highway"].isin(PATH_HIGHWAYS)]
  spatial_index = detail_areas.sindex
  for _, row in candidates.sort_values(["id", "highway"]).iterrows():
    area_indexes = spatial_index.query(row.geometry, predicate="intersects")
    if len(area_indexes) == 0:
      continue
    # Union only the handful of parks touching this path. Intersecting every
    # road with one citywide MultiPolygon made GEOS re-node thousands of
    # unrelated boundaries for each feature and turned a deterministic export
    # into a many-minute CPU loop.
    local_areas = detail_areas.iloc[area_indexes].geometry.union_all()
    clipped = row.geometry.intersection(local_areas)
    for part_index, line in enumerate(line_parts(clipped)):
      # The committed GeoPackage already applies its documented 0.35 m file
      # tolerance.  Keep every resulting source vertex here: a second 1 m
      # simplification visibly cut Tiergarten bends and shortened desire-path
      # spurs.  The compact schema still remains below the 6 MiB release cap.
      if line.length < 2.5:
        continue
      points = [world_position(Point(x, y), origin, sampler) for x, y in line.coords]
      kind = str(row["highway"])
      width_m = road_width_m(row) or 1.35
      path = {
        "id": f"{row['id']}:{part_index}",
        "kind": kind,
        "m": path_material_code(row, kind, True),
        "points": points,
        # Schema 7 stores centimetres instead of decimetres.  This preserves
        # source widths such as 3.75 m without growing the key or adding a
        # parallel field; schemas 4--6 remain decoded as decimetres.
        "w": round(width_m * 100),
      }
      name = optional_text(row.get("name"))
      if name is not None:
        path["name"] = name
      paths.append(path)
  return paths


def build_trees(
  vegetation: gpd.GeoDataFrame,
  origin: SceneOrigin,
  sampler: MeshGroundSampler,
) -> list[dict[str, Any]]:
  candidates: list[tuple[str, Point, object, object]] = []
  for _, row in vegetation.sort_values("id").iterrows():
    identifier = str(row["id"])
    if row.get("natural") == "tree" and isinstance(row.geometry, Point):
      candidates.append(
        (identifier, row.geometry, row.get("height"), row.get("leaf_type"))
      )
    elif row.get("natural") == "tree_row":
      for part in line_parts(row.geometry):
        sample_count = max(1, int(part.length // 9))
        for index in range(sample_count + 1):
          point = part.interpolate(index / max(1, sample_count), normalized=True)
          candidates.append(
            (f"{identifier}:{index}", point, row.get("height"), row.get("leaf_type"))
          )

  trees: list[dict[str, Any]] = []
  for identifier, point, source_height, leaf_type in candidates:
    seed = stable_seed(identifier)
    height = parse_positive_number(source_height) or 8.4 + (seed % 67) / 10
    height = min(18.0, max(5.5, height))
    crown_radius = min(5.8, max(2.3, height * (0.29 + ((seed >> 8) % 7) / 100)))
    trees.append(
      {
        "id": identifier,
        "source": "osm",
        "position": world_position(point, origin, sampler),
        "height_m": round(height, 2),
        "crown_radius_m": round(crown_radius, 2),
        "trunk_radius_m": round(max(0.18, crown_radius * 0.095), 3),
        "leaf_type": optional_text(leaf_type),
        "species": None,
        "tree_group": None,
        "variant": seed % 3,
      }
    )
  return trees


def build_official_trees(
  trees: gpd.GeoDataFrame,
  origin: SceneOrigin,
  sampler: MeshGroundSampler,
) -> list[dict[str, Any]]:
  """Build trees from measured Berlin catalogue positions and dimensions."""
  result: list[dict[str, Any]] = []
  for _, row in trees.sort_values("tree_id").iterrows():
    if not isinstance(row.geometry, Point):
      continue
    identifier = str(row["tree_id"])
    seed = stable_seed(identifier)
    measured_height = parse_positive_number(row.get("height_m"))
    # Never apply the compact fallback cap to a source-measured veteran tree.
    # Großer Tiergarten contains 69 catalogue trees above the former 28 m cap,
    # with a measured maximum of 35 m.  A separate 40 m safety ceiling catches
    # malformed future records while preserving the current official range.
    height = (
      min(OFFICIAL_HEIGHT_SAFETY_MAX_M, max(1.5, measured_height))
      if measured_height is not None
      else min(18.0, max(3.0, 8.4 + (seed % 67) / 10))
    )
    measured_crown = parse_positive_number(row.get("crown_diameter_m"))
    crown_radius = (
      min(OFFICIAL_CROWN_RADIUS_SAFETY_MAX_M, max(0.35, measured_crown / 2))
      if measured_crown is not None
      else min(
        9.5,
        max(1.25, height * (0.29 + ((seed >> 8) % 7) / 100)),
      )
    )
    circumference_cm = parse_positive_number(row.get("trunk_circumference_cm"))
    trunk_radius = (
      min(
        OFFICIAL_TRUNK_RADIUS_SAFETY_MAX_M,
        max(0.05, circumference_cm / (200 * math.pi)),
      )
      if circumference_cm is not None
      else min(0.9, max(0.12, crown_radius * 0.095))
    )
    result.append(
      {
        "id": identifier,
        "source": "berlin_official",
        "catalogue": optional_text(row.get("catalogue")),
        "position": world_position(row.geometry, origin, sampler),
        "height_m": round(height, 2),
        "height_measured": measured_height is not None,
        "crown_radius_m": round(crown_radius, 2),
        "crown_measured": measured_crown is not None,
        "trunk_radius_m": round(trunk_radius, 3),
        "leaf_type": None,
        "species": optional_text(row.get("species_de")),
        "tree_group": optional_text(row.get("tree_group")),
        "variant": seed % 3,
        "osm_evidence_ids": [],
      }
    )
  return result


def fuse_trees(
  official: list[dict[str, Any]], osm: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], dict[str, int | float]]:
  """Keep official trees and retain unmatched OSM evidence additively."""
  if not official:
    return osm, {
      "official": 0,
      "osm_matched": 0,
      "osm_only": len(osm),
      "match_distance_m": TREE_MATCH_DISTANCE_M,
    }
  positions = np.asarray(
    [[tree["position"][0], tree["position"][2]] for tree in official],
    dtype=float,
  )
  tree = cKDTree(positions)
  unmatched: list[dict[str, Any]] = []
  matched = 0
  for osm_tree in osm:
    distance, index = tree.query(
      [osm_tree["position"][0], osm_tree["position"][2]], k=1
    )
    if float(distance) <= TREE_MATCH_DISTANCE_M:
      official[int(index)]["osm_evidence_ids"].append(osm_tree["id"])
      matched += 1
    else:
      unmatched.append(osm_tree)
  return [*official, *unmatched], {
    "official": len(official),
    "osm_matched": matched,
    "osm_only": len(unmatched),
    "match_distance_m": TREE_MATCH_DISTANCE_M,
  }


# Compact wire form for the tree array. The task-09 bounds carry 20,911
# official catalogue points instead of 6,893, which pushed the verbose records
# to 7.4 MiB — well past the 4 MiB payload budget. Shortening the keys and
# interning the five repeated string vocabularies is lossless and brings the
# payload back to 3.4 MiB. "position" deliberately keeps its long name: the
# Python ground samplers in build_isometric_prisms and build_minecraft_voxels
# read it straight off this file.
TREE_VOCABULARY_KEYS = ("source", "catalogue", "leaf_type", "species", "tree_group")
TREE_COMPACT_KEYS = {
  "id": "i",
  "source": "s",
  "catalogue": "c",
  "height_m": "h",
  "height_measured": "hm",
  "crown_radius_m": "cr",
  "crown_measured": "cm",
  "trunk_radius_m": "tr",
  "leaf_type": "lt",
  "species": "sp",
  "tree_group": "g",
  "variant": "v",
  "osm_evidence_ids": "e",
}
TREE_VIEWER_OMIT_KEYS = frozenset(
  {"id", "height_measured", "crown_measured", "osm_evidence_ids"}
)


def compact_trees(
  trees: list[dict[str, Any]],
  *,
  viewer_payload: bool = False,
) -> tuple[list[dict[str, Any]], dict[str, list[str]]]:
  """Shorten keys, intern strings and drop empty fields.

  The default remains fully reversible for audit/export callers. The public
  viewer variant also omits identity and measurement-provenance fields that no
  renderer reads; fusion counts and the actual measured dimensions remain.
  """
  vocabulary: dict[str, list[str]] = {key: [] for key in TREE_VOCABULARY_KEYS}
  indexes: dict[str, dict[str, int]] = {key: {} for key in TREE_VOCABULARY_KEYS}
  compact: list[dict[str, Any]] = []
  for tree in trees:
    record: dict[str, Any] = {}
    for key, value in tree.items():
      if viewer_payload and key in TREE_VIEWER_OMIT_KEYS:
        continue
      if value is None or value is False or value == []:
        continue
      if key in vocabulary:
        table = indexes[key]
        if value not in table:
          table[value] = len(vocabulary[key])
          vocabulary[key].append(value)
        value = table[value]
      elif value is True:
        value = 1
      record[TREE_COMPACT_KEYS.get(key, key)] = value
    compact.append(record)
  return compact, vocabulary


def expand_trees(
  compact: list[dict[str, Any]], vocabulary: dict[str, list[str]]
) -> list[dict[str, Any]]:
  """Inverse of :func:`compact_trees`, used by the payload tests."""
  long_keys = {short: long for long, short in TREE_COMPACT_KEYS.items()}
  expanded: list[dict[str, Any]] = []
  for record in compact:
    tree: dict[str, Any] = {}
    for key, value in record.items():
      long = long_keys.get(key, key)
      if long in TREE_VOCABULARY_KEYS:
        value = vocabulary[long][value]
      elif long in ("height_measured", "crown_measured"):
        value = bool(value)
      tree[long] = value
    expanded.append(tree)
  return expanded


def display_light_height(light_type: str | None) -> float:
  """Return a conservative visual mast height where the WFS has no height."""
  text = light_type or ""
  if "Anstrahlung" in text:
    return 4.2
  if "Dreifach" in text or "Doppelausleger" in text or "Zwillings" in text:
    return 9.0
  if "Ausleger" in text:
    return 8.2
  if "Leuchtband" in text:
    return 5.5
  return 6.8


LIGHT_BAND_MAX_SPACING_M = 4.0
LIGHT_BAND_MIN_POINTS = 5
LIGHT_BAND_HEIGHT_M = 1.1


def light_band_runs(positions: list[list[float]]) -> list[list[int]]:
  """Group lamp points into continuous installations rather than masts.

  The Geoportal records integrated balustrade lighting as a dense run of
  points: on the Gustav-Heinemann-Brücke the two handrails are 50 and 49
  points at a 1.6 m median spacing. A 6.8 m mast every 1.6 m does not
  exist, so any connected run this tight is a light band, not a row of
  masts. Isolated masts and genuine mast pairs stay untouched.
  """
  if len(positions) < LIGHT_BAND_MIN_POINTS:
    return []
  flat = np.array([[point[0], point[2]] for point in positions])
  pairs = cKDTree(flat).query_pairs(LIGHT_BAND_MAX_SPACING_M)
  parent = list(range(len(positions)))

  def find(node: int) -> int:
    while parent[node] != node:
      parent[node] = parent[parent[node]]
      node = parent[node]
    return node

  for left, right in pairs:
    a, b = find(left), find(right)
    if a != b:
      parent[a] = b
  groups: dict[int, list[int]] = {}
  for index in range(len(positions)):
    groups.setdefault(find(index), []).append(index)
  return [
    sorted(members)
    for members in groups.values()
    if len(members) >= LIGHT_BAND_MIN_POINTS
  ]


def build_street_lights(
  lights: gpd.GeoDataFrame,
  origin: SceneOrigin,
  sampler: MeshGroundSampler,
) -> list[dict[str, Any]]:
  """Build official lamp positions with explicitly approximate mast heights."""
  result: list[dict[str, Any]] = []
  for _, row in lights.sort_values("light_id").iterrows():
    light_type = optional_text(row.get("light_type"))
    if (
      not isinstance(row.geometry, Point) or light_type == "Oberirdischer Schaltkasten"
    ):
      continue
    if optional_text(row.get("status")) not in {None, "In Betrieb"}:
      continue
    result.append(
      {
        "id": str(row["light_id"]),
        "position": world_position(row.geometry, origin, sampler),
        "height_m": display_light_height(light_type),
        "light_type": light_type,
        "rotation_degrees": parse_finite_number(row.get("rotation_degrees")) or 0,
        "street": optional_text(row.get("street")),
      }
    )
  for run in light_band_runs([entry["position"] for entry in result]):
    # A balustrade is level; the ground under it is not. The run's own
    # highest sampled point is its bank end, which is where the deck
    # meets the shore, so the whole band is carried at that height
    # instead of dipping into the riverbed with the terrain.
    level = max(result[index]["position"][1] for index in run)
    for index in run:
      entry = result[index]
      entry["position"] = [entry["position"][0], level, entry["position"][2]]
      entry["height_m"] = LIGHT_BAND_HEIGHT_M
      entry["installation"] = "light_band"
  return result


def sampled_line_points(
  line: LineString,
  origin: SceneOrigin,
  sampler: MeshGroundSampler,
  spacing_m: float = 2.0,
) -> list[list[float]]:
  sample_count = max(1, math.ceil(line.length / spacing_m))
  return [
    world_position(
      line.interpolate(index / sample_count, normalized=True), origin, sampler
    )
    for index in range(sample_count + 1)
  ]


def build_wall_traces(
  wall: gpd.GeoDataFrame,
  origin: SceneOrigin,
  sampler: MeshGroundSampler,
) -> list[dict[str, Any]]:
  """Build the official Vorderlandmauer centreline for a double-stone cue."""
  result: list[dict[str, Any]] = []
  for _, row in wall.sort_values("wall_id").iterrows():
    for part_index, line in enumerate(line_parts(row.geometry)):
      if line.length < 1:
        continue
      result.append(
        {
          "id": f"{row['wall_id']}:{part_index}",
          "wall_type": optional_text(row.get("wall_type")),
          "points": sampled_line_points(line, origin, sampler),
        }
      )
  return result


def read_tiergarten_vegetation(
  path: Path | None,
) -> tuple[gpd.GeoDataFrame, dict[str, Any]]:
  """Read the bounded OSM vegetation sidecar and its audit metadata."""
  if path is None or not path.exists():
    return gpd.GeoDataFrame(geometry=[], crs="EPSG:25833"), {
      "available": False,
      "reason": "bounded_sidecar_missing",
    }
  raw = json.loads(path.read_text(encoding="utf-8"))
  frame = gpd.read_file(path)
  if frame.crs is None:
    raise ValueError(f"Tiergarten vegetation sidecar has no CRS: {path}")
  if frame.crs.to_epsg() != 25833:
    frame = frame.to_crs(25833)
  return frame, {
    "available": True,
    "license": raw.get("source", {}).get("license", "ODbL-1.0"),
    "attribution": raw.get("source", {}).get(
      "attribution", "© OpenStreetMap contributors"
    ),
    "geometry_status": raw.get("source", {}).get("geometry_status"),
    "park_relation_url": raw.get("source", {}).get("park_relation_url"),
    "metrics": raw.get("metrics", {}),
  }


def polygon_world_rings(
  polygon: Polygon,
  origin: SceneOrigin,
  sampler: MeshGroundSampler,
) -> list[list[list[float]]]:
  """Convert an exact metric polygon and any holes into viewer rings."""
  rings = [polygon.exterior, *polygon.interiors]
  return [
    [world_position(Point(x, y), origin, sampler) for x, y in ring.coords]
    for ring in rings
  ]


def shrub_clearance_geometry(
  roads: gpd.GeoDataFrame,
  pois: gpd.GeoDataFrame,
  playgrounds: gpd.GeoDataFrame,
  vegetation: gpd.GeoDataFrame,
) -> BaseGeometry:
  """Keep derived shrub clumps off paths, monuments and play surfaces.

  The source scrub polygon remains unchanged in the payload.  Only the
  explicitly approximate interior clumps yield to mapped public-space uses.
  """
  if vegetation.empty:
    return Polygon()
  park_extent = vegetation.geometry.union_all()
  clearances: list[BaseGeometry] = []
  paths = roads[
    roads["highway"].isin(PATH_HIGHWAYS) & roads.geometry.intersects(park_extent)
  ]
  clearances.extend(
    row.geometry.buffer((road_width_m(row) or 1.35) / 2 + SHRUB_PATH_CLEARANCE_M)
    for _, row in paths.iterrows()
  )
  protected_pois = pois[
    pois.geometry.intersects(park_extent)
    & (
      pois["historic"].notna()
      | pois["memorial"].notna()
      | pois["tourism"].isin(["artwork", "attraction"])
    )
  ]
  clearances.extend(
    geometry.buffer(SHRUB_MONUMENT_CLEARANCE_M) for geometry in protected_pois.geometry
  )
  clearances.extend(
    geometry.buffer(SHRUB_PLAYGROUND_CLEARANCE_M)
    for geometry in playgrounds[playgrounds.geometry.intersects(park_extent)].geometry
  )
  hedge_areas = vegetation[vegetation["kind"] == "hedge_area"]
  clearances.extend(hedge_areas.geometry)
  return shapely.union_all(clearances) if clearances else Polygon()


def deterministic_polygon_clusters(
  polygon: Polygon,
  identifier: str,
  origin: SceneOrigin,
  sampler: MeshGroundSampler,
  *,
  excluded: BaseGeometry | None = None,
  spacing_m: float = SHRUB_CLUSTER_SPACING_M,
  hedge: bool = False,
) -> list[list[float | int]]:
  """Fill a source polygon deterministically without claiming measured shrubs."""
  usable = polygon.difference(excluded) if excluded is not None else polygon
  if usable.is_empty:
    return []
  min_x, min_y, max_x, max_y = polygon.bounds
  seed = stable_seed(identifier)
  phase_x = ((seed >> 4) % 997) / 997 * spacing_m
  phase_y = ((seed >> 14) % 991) / 991 * spacing_m
  first_x = math.floor(min_x / spacing_m) * spacing_m + phase_x
  first_y = math.floor(min_y / spacing_m) * spacing_m + phase_y
  clusters: list[list[float | int]] = []
  row = 0
  y = first_y
  while y <= max_y:
    column = 0
    x = first_x
    while x <= max_x:
      point_seed = stable_seed(f"{identifier}:{column}:{row}")
      jitter = spacing_m * 0.18
      point = Point(
        x + (((point_seed >> 5) % 101) / 100 - 0.5) * jitter,
        y + (((point_seed >> 13) % 101) / 100 - 0.5) * jitter,
      )
      if usable.contains(point):
        world = world_position(point, origin, sampler)
        variant = point_seed % 3
        if hedge:
          height = 1.15 + variant * 0.16
          radius = 0.72 + ((point_seed >> 9) % 5) * 0.07
        else:
          height = 0.9 + ((point_seed >> 8) % 7) * 0.16
          radius = 0.82 + ((point_seed >> 16) % 7) * 0.09
        clusters.append(
          [
            round(world[0], 2),
            round(world[1], 3),
            round(world[2], 2),
            round(height, 2),
            round(radius, 2),
            variant,
          ]
        )
      column += 1
      x += spacing_m
    row += 1
    y += spacing_m
  return clusters


def build_tiergarten_vegetation_details(
  vegetation: gpd.GeoDataFrame,
  roads: gpd.GeoDataFrame,
  pois: gpd.GeoDataFrame,
  playgrounds: gpd.GeoDataFrame,
  origin: SceneOrigin,
  sampler: MeshGroundSampler,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
  """Build exact OSM outlines plus bounded, explicitly approximate foliage."""
  if vegetation.empty:
    return [], []
  clearance = shrub_clearance_geometry(roads, pois, playgrounds, vegetation)
  shrub_patches: list[dict[str, Any]] = []
  hedges: list[dict[str, Any]] = []
  for _, row in vegetation.sort_values("id").iterrows():
    kind = str(row["kind"])
    source_url = str(row["source_url"])
    identifier = str(row["id"])
    height = parse_positive_number(row.get("height_m")) or DEFAULT_HEDGE_HEIGHT_M
    width = parse_positive_number(row.get("width_m")) or DEFAULT_HEDGE_WIDTH_M
    dimensions_status = (
      "OSM-tagged dimensions"
      if parse_positive_number(row.get("height_m")) is not None
      or parse_positive_number(row.get("width_m")) is not None
      else "Display dimensions; OSM course/footprint is source-mapped"
    )
    if kind == "scrub_area":
      for part_index, polygon in enumerate(polygon_parts(row.geometry)):
        patch_id = f"{identifier}:{part_index}"
        shrub_patches.append(
          {
            "id": patch_id,
            "leaf_type": optional_text(row.get("leaf_type")),
            "rings": polygon_world_rings(polygon, origin, sampler),
            "clusters": deterministic_polygon_clusters(
              polygon,
              patch_id,
              origin,
              sampler,
              excluded=clearance,
            ),
            "source_url": source_url,
          }
        )
    elif kind == "hedge_line":
      for part_index, line in enumerate(line_parts(row.geometry)):
        hedges.append(
          {
            "id": f"{identifier}:{part_index}",
            "kind": "line",
            "points": [
              world_position(Point(x, y), origin, sampler) for x, y in line.coords
            ],
            "height_m": round(height, 2),
            "width_m": round(width, 2),
            "length_m": round(line.length, 2),
            "dimensions_status": dimensions_status,
            "source_url": source_url,
          }
        )
    elif kind == "hedge_area":
      for part_index, polygon in enumerate(polygon_parts(row.geometry)):
        hedge_id = f"{identifier}:{part_index}"
        hedges.append(
          {
            "id": hedge_id,
            "kind": "area",
            "rings": polygon_world_rings(polygon, origin, sampler),
            "clusters": deterministic_polygon_clusters(
              polygon,
              hedge_id,
              origin,
              sampler,
              spacing_m=1.6,
              hedge=True,
            ),
            "height_m": round(height, 2),
            "area_m2": round(polygon.area, 2),
            "dimensions_status": dimensions_status,
            "source_url": source_url,
          }
        )
  return shrub_patches, hedges


def equipment_payload(
  row: Any, origin: SceneOrigin, sampler: MeshGroundSampler
) -> dict[str, Any]:
  geometry = row.geometry
  point = geometry if isinstance(geometry, Point) else geometry.centroid
  points: list[list[float]] = []
  if isinstance(geometry, LineString):
    points = [world_position(Point(x, y), origin, sampler) for x, y in geometry.coords]
  return {
    "id": str(row["id"]),
    "kind": str(row["playground"]),
    "material": optional_text(row.get("material")),
    "position": world_position(point, origin, sampler),
    "points": points,
  }


def build_playgrounds(
  features: gpd.GeoDataFrame,
  origin: SceneOrigin,
  sampler: MeshGroundSampler,
) -> list[dict[str, Any]]:
  areas = features[features["leisure"] == "playground"]
  equipment = features[features["playground"].notna()]
  playgrounds: list[dict[str, Any]] = []
  for _, row in areas.sort_values("id").iterrows():
    for part_index, polygon in enumerate(polygon_parts(row.geometry)):
      identifier = str(row["id"])
      outline = [
        world_position(Point(x, y), origin, sampler)
        for x, y in polygon.simplify(0.35, preserve_topology=True).exterior.coords
      ]
      assigned = equipment[equipment.geometry.intersects(polygon.buffer(3.0))]
      playgrounds.append(
        {
          "id": f"{identifier}:{part_index}",
          "name": PLAYGROUND_NAMES.get(identifier, "Spielplatz"),
          "surface": optional_text(row.get("surface")),
          "wheelchair": optional_text(row.get("wheelchair")),
          "outline": outline,
          "equipment": [
            equipment_payload(item, origin, sampler)
            for _, item in assigned.sort_values("id").iterrows()
          ],
          "source_url": f"https://www.openstreetmap.org/{row['element']}/{identifier}",
        }
      )
  return playgrounds


def read_optional_layer(path: Path, layer: str) -> gpd.GeoDataFrame:
  if not path.exists():
    return gpd.GeoDataFrame(geometry=[], crs="EPSG:25833")
  try:
    return gpd.read_file(path, layer=layer)
  except Exception:
    return gpd.GeoDataFrame(geometry=[], crs="EPSG:25833")


def build_payload(
  osm_path: Path,
  scene_path: Path,
  mesh_dir: Path,
  official_details_path: Path | None = None,
  tiergarten_vegetation_path: Path | None = TIERGARTEN_VEGETATION_DEFAULT,
) -> dict[str, Any]:
  origin = scene_origin(scene_path)
  sampler = MeshGroundSampler.from_directory(mesh_dir)
  roads = gpd.read_file(osm_path, layer="roads")
  parks = gpd.read_file(osm_path, layer="parks")
  vegetation = gpd.read_file(osm_path, layer="vegetation")
  playgrounds = gpd.read_file(osm_path, layer="playgrounds")
  pois = gpd.read_file(osm_path, layer="pois")
  park_rows = parks[parks.geometry.notna() & ~parks.geometry.is_empty]
  if park_rows.empty:
    raise ValueError("OSM park layer does not contain usable park geometry")
  # The renderer used to clip detailed path ribbons to Großer Tiergarten
  # alone. That silently discarded mapped walks through Spreebogenpark,
  # Futurium's public realm and Nordhafenpark even though all three areas and
  # their paths are already present in the bounded OSM GeoPackage.
  official_path = official_details_path or Path("__missing_official_details__")
  official_tree_frame = read_optional_layer(official_path, "trees")
  official_light_frame = read_optional_layer(official_path, "street_lights")
  official_wall_frame = read_optional_layer(official_path, "berlin_wall")
  osm_trees = build_trees(vegetation, origin, sampler)
  official_trees = build_official_trees(official_tree_frame, origin, sampler)
  trees, tree_fusion = fuse_trees(official_trees, osm_trees)
  compact, tree_vocabulary = compact_trees(trees, viewer_payload=True)
  tiergarten_vegetation, tiergarten_vegetation_source = read_tiergarten_vegetation(
    tiergarten_vegetation_path
  )
  shrub_patches, hedges = build_tiergarten_vegetation_details(
    tiergarten_vegetation,
    roads,
    pois,
    playgrounds,
    origin,
    sampler,
  )
  return {
    "schema_version": 7,
    "source": {
      "name": "Additive OSM and Geoportal Berlin detail fusion",
      "attribution": "© OpenStreetMap contributors · Geoportal Berlin (dl-de/zero-2-0)",
      "geometry_status": (
        "Source-positioned detail clipped to all bounded OSM park areas; exact Großer "
        "Tiergarten scrub/hedge outlines are retained while their foliage clumps, "
        "missing tree dimensions and lamp mast forms remain explicit display "
        "approximations"
      ),
    },
    "sources": {
      "osm": {"available": True, "license": "ODbL-1.0"},
      "berlin_official_details": {
        "available": official_details_path is not None
        and official_details_path.exists(),
        "license": "dl-de/zero-2-0",
        "layers": ["trees", "street_lights", "berlin_wall"],
      },
      "tiergarten_vegetation": tiergarten_vegetation_source,
    },
    "tree_fusion": tree_fusion,
    "paths": build_paths(roads, park_rows, origin, sampler),
    "tree_vocabulary": tree_vocabulary,
    "trees": compact,
    "shrub_patches": shrub_patches,
    "hedges": hedges,
    "street_lights": build_street_lights(official_light_frame, origin, sampler),
    "wall_traces": build_wall_traces(official_wall_frame, origin, sampler),
    "playgrounds": build_playgrounds(playgrounds, origin, sampler),
  }


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--osm", type=Path, default=Path("geo_data/regierungsviertel/osm.gpkg")
  )
  parser.add_argument(
    "--scene",
    type=Path,
    default=Path("src/app/public/mesh/regierungsviertel/scene.json"),
  )
  parser.add_argument(
    "--mesh-dir",
    type=Path,
    default=Path("src/app/public/mesh/regierungsviertel"),
  )
  parser.add_argument(
    "--official-details",
    type=Path,
    default=Path("geo_data/regierungsviertel/official_details.gpkg"),
  )
  parser.add_argument(
    "--tiergarten-vegetation",
    type=Path,
    default=Path("geo_data/regierungsviertel/tiergarten-vegetation.geojson"),
  )
  parser.add_argument(
    "--out",
    type=Path,
    default=Path("src/app/public/mesh/regierungsviertel/park-details.json"),
  )
  args = parser.parse_args()
  payload = build_payload(
    args.osm,
    args.scene,
    args.mesh_dir,
    args.official_details,
    args.tiergarten_vegetation,
  )
  args.out.parent.mkdir(parents=True, exist_ok=True)
  args.out.write_text(
    json.dumps(payload, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    + "\n",
    encoding="utf-8",
  )
  print(
    f"Wrote {args.out}: paths={len(payload['paths'])}, "
    f"trees={len(payload['trees'])}, lights={len(payload['street_lights'])}, "
    f"wall_traces={len(payload['wall_traces'])}, "
    f"playgrounds={len(payload['playgrounds'])}, "
    f"shrub_patches={len(payload['shrub_patches'])}, "
    f"hedges={len(payload['hedges'])}"
  )


if __name__ == "__main__":
  main()
