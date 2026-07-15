"""Build the compact OSM park-detail payload used by the Three.js viewer.

The output contains only clipped, simplified display geometry. Raw OSM responses
and Berlin mesh sources remain outside the public bundle.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
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

  @classmethod
  def from_directory(cls, mesh_dir: Path) -> MeshGroundSampler:
    vertices: list[np.ndarray] = []
    for path in sorted(mesh_dir.glob("tile-*.glb")):
      loaded = trimesh.load(path, force="scene")
      vertices.extend(
        np.asarray(geometry.vertices)
        for geometry in loaded.geometry.values()
        if hasattr(geometry, "vertices") and len(geometry.vertices) > 0
      )
    if not vertices:
      raise FileNotFoundError(f"No packaged base-tile geometry found in {mesh_dir}")
    return cls(np.vstack(vertices))

  def height(self, x: float, z: float) -> float:
    count = min(2_048, len(self._vertices))
    _, indices = self._tree.query([x, z], k=count)
    nearby = self._vertices[np.atleast_1d(indices), 1]
    # The official surface contains tree crowns but often no vertex directly
    # underneath them. A wider local sample and low nonzero percentile reaches
    # adjacent park ground without snapping to a remote tile minimum.
    return round(float(np.percentile(nearby, 2)) + 0.12, 3)


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
        "position": world_position(point, origin, sampler),
        "height_m": round(height, 2),
        "crown_radius_m": round(crown_radius, 2),
        "leaf_type": optional_text(leaf_type),
        "variant": seed % 3,
      }
    )
  return trees


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


def build_payload(osm_path: Path, scene_path: Path, mesh_dir: Path) -> dict[str, Any]:
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
  return {
    "schema_version": 1,
    "source": {
      "name": "OpenStreetMap",
      "attribution": "© OpenStreetMap contributors",
      "geometry_status": "OSM-derived display detail clipped to the project bounds",
    },
    "paths": build_paths(roads, tiergarten, origin, sampler),
    "trees": build_trees(vegetation, origin, sampler),
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
    "--out",
    type=Path,
    default=Path("src/app/public/mesh/regierungsviertel/park-details.json"),
  )
  args = parser.parse_args()
  payload = build_payload(args.osm, args.scene, args.mesh_dir)
  args.out.parent.mkdir(parents=True, exist_ok=True)
  args.out.write_text(
    json.dumps(payload, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    + "\n",
    encoding="utf-8",
  )
  print(
    f"Wrote {args.out}: paths={len(payload['paths'])}, "
    f"trees={len(payload['trees'])}, playgrounds={len(payload['playgrounds'])}"
  )


if __name__ == "__main__":
  main()
