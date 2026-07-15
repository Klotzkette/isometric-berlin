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
import trimesh
from pandas import isna
from scipy.spatial import cKDTree
from shapely.geometry import LineString, MultiLineString, MultiPolygon, Point, Polygon
from shapely.geometry.base import BaseGeometry

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
  return [round(x, 3), sampler.height(x, z), round(z, 3)]


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


def build_paths(
  roads: gpd.GeoDataFrame,
  tiergarten: BaseGeometry,
  origin: SceneOrigin,
  sampler: MeshGroundSampler,
) -> list[dict[str, Any]]:
  paths: list[dict[str, Any]] = []
  candidates = roads[roads["highway"].isin(PATH_HIGHWAYS)]
  for _, row in candidates.sort_values(["id", "highway"]).iterrows():
    clipped = row.geometry.intersection(tiergarten)
    for part_index, line in enumerate(line_parts(clipped)):
      simplified = line.simplify(0.8, preserve_topology=True)
      if simplified.length < 2.5:
        continue
      points = [
        world_position(Point(x, y), origin, sampler) for x, y in simplified.coords
      ]
      paths.append(
        {
          "id": f"{row['id']}:{part_index}",
          "kind": str(row["highway"]),
          "name": optional_text(row.get("name")),
          "points": points,
        }
      )
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
    height = min(28.0, max(3.0, measured_height or 8.4 + (seed % 67) / 10))
    measured_crown = parse_positive_number(row.get("crown_diameter_m"))
    crown_radius = min(
      9.5,
      max(
        1.25,
        measured_crown / 2
        if measured_crown is not None
        else height * (0.29 + ((seed >> 8) % 7) / 100),
      ),
    )
    circumference_cm = parse_positive_number(row.get("trunk_circumference_cm"))
    trunk_radius = (
      circumference_cm / (200 * math.pi)
      if circumference_cm is not None
      else crown_radius * 0.095
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
        "trunk_radius_m": round(min(0.9, max(0.12, trunk_radius)), 3),
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
) -> dict[str, Any]:
  origin = scene_origin(scene_path)
  sampler = MeshGroundSampler.from_directory(mesh_dir)
  roads = gpd.read_file(osm_path, layer="roads")
  parks = gpd.read_file(osm_path, layer="parks")
  vegetation = gpd.read_file(osm_path, layer="vegetation")
  playgrounds = gpd.read_file(osm_path, layer="playgrounds")
  tiergarten_rows = parks[parks["name"] == "Großer Tiergarten"]
  if tiergarten_rows.empty:
    raise ValueError("OSM park layer does not contain Großer Tiergarten")
  tiergarten = tiergarten_rows.geometry.union_all()
  official_path = official_details_path or Path("__missing_official_details__")
  official_tree_frame = read_optional_layer(official_path, "trees")
  official_light_frame = read_optional_layer(official_path, "street_lights")
  official_wall_frame = read_optional_layer(official_path, "berlin_wall")
  osm_trees = build_trees(vegetation, origin, sampler)
  official_trees = build_official_trees(official_tree_frame, origin, sampler)
  trees, tree_fusion = fuse_trees(official_trees, osm_trees)
  return {
    "schema_version": 2,
    "source": {
      "name": "Additive OSM and Geoportal Berlin detail fusion",
      "attribution": "© OpenStreetMap contributors · Geoportal Berlin (dl-de/zero-2-0)",
      "geometry_status": (
        "Source-positioned detail clipped to the project bounds; missing tree "
        "dimensions and lamp mast forms remain explicit display approximations"
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
    },
    "tree_fusion": tree_fusion,
    "paths": build_paths(roads, tiergarten, origin, sampler),
    "trees": trees,
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
    "--out",
    type=Path,
    default=Path("src/app/public/mesh/regierungsviertel/park-details.json"),
  )
  args = parser.parse_args()
  payload = build_payload(args.osm, args.scene, args.mesh_dir, args.official_details)
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
    f"playgrounds={len(payload['playgrounds'])}"
  )


if __name__ == "__main__":
  main()
