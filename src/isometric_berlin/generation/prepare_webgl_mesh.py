"""Prepare compact WebGL assets from the official Berlin 3D mesh.

The source OBJ archives remain under ``geo_data/**/raw``.  This module keeps
one lower-detail, textured mesh per source tile for the full scene and adds
small high-detail crops around the four architectural hero landmarks.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
import trimesh
from PIL import Image, ImageEnhance
from pyproj import Transformer
from scipy.spatial import cKDTree
from shapely import contains_xy
from shapely.geometry.base import BaseGeometry
from trimesh.visual.color import ColorVisuals, uv_to_color
from trimesh.visual.material import SimpleMaterial
from trimesh.visual.texture import TextureVisuals

REPO_ROOT = Path(__file__).resolve().parents[3]
RAW_DIR = REPO_ROOT / "geo_data/regierungsviertel/raw/berlin_3d_mesh_2025"
BOUNDS_PATH = REPO_ROOT / "geo_data/regierungsviertel/bounds.geojson"
LANDMARKS_PATH = REPO_ROOT / "geo_data/regierungsviertel/landmarks.geojson"
TUNNEL_PATH = REPO_ROOT / "geo_data/regierungsviertel/tiergartentunnel.geojson"
OUTPUT_DIR = REPO_ROOT / "src/app/public/mesh/regierungsviertel"
SOURCE_CRS = "EPSG:25833"
ORIGIN = np.array([389_500.0, 5_820_000.0, 30.0])
MAX_ASSET_BYTES = 5 * 1024 * 1024
BASE_TARGET_FACES = 70_000
REICHSTAG_DOME_HEIGHT_M = 23.5
REICHSTAG_DOME_DIAMETER_M = 40.0
REICHSTAG_DOME_VERTICAL_RIBS = 24
REICHSTAG_DOME_HORIZONTAL_RINGS = 17
REICHSTAG_DOME_SOURCE_URL = (
  "https://www.bundestag.de/besuche/architektur/reichstag/kuppel"
)


@dataclass(frozen=True)
class HeroSpec:
  identifier: str
  landmark_name: str


HERO_SPECS = (
  HeroSpec("reichstag", "Reichstagsgebäude"),
  HeroSpec("bundeskanzleramt", "Bundeskanzleramt"),
  HeroSpec("hauptbahnhof", "Berlin Hauptbahnhof"),
  HeroSpec("brandenburger-tor", "Brandenburger Tor"),
)


def sha256_file(path: Path) -> str:
  """Return the SHA-256 digest for one generated asset."""
  digest = hashlib.sha256()
  with path.open("rb") as stream:
    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
      digest.update(chunk)
  return digest.hexdigest()


def metric_to_world(vertices: np.ndarray) -> np.ndarray:
  """Convert EPSG:25833 XYZ coordinates to Three.js Y-up coordinates."""
  translated = vertices - ORIGIN
  return np.column_stack((translated[:, 0], translated[:, 2], -translated[:, 1]))


def point_to_world(x: float, y: float, elevation: float = 38.0) -> list[float]:
  """Convert one metric map point to a Three.js world coordinate."""
  return [x - ORIGIN[0], elevation - ORIGIN[2], ORIGIN[1] - y]


def colored_base_mesh(
  scene: trimesh.Scene, target_faces: int = BASE_TARGET_FACES
) -> tuple[Any, dict[str, int]]:
  """Merge every material segment and simplify it with sampled vertex colours."""
  parts = []
  source_faces = 0
  for geometry in scene.geometry.values():
    mesh = geometry.copy()
    source_faces += int(len(mesh.faces))
    visual = mesh.visual
    colours = uv_to_color(visual.uv, visual.material.image)
    rgb = colours[:, :3].astype(np.float32) / 255
    luminance = rgb[:, 0:1] * 0.2126 + rgb[:, 1:2] * 0.7152 + rgb[:, 2:3] * 0.0722
    rgb = luminance + (rgb - luminance) * 1.12
    rgb = np.power(np.clip(rgb, 0, 1), 0.9)
    colours[:, :3] = np.clip(rgb * 255, 0, 255).astype(np.uint8)
    mesh.visual = ColorVisuals(mesh=mesh, vertex_colors=colours)
    parts.append(mesh)
  merged = trimesh.util.concatenate(parts)
  merged.merge_vertices()
  merged.remove_unreferenced_vertices()
  if len(merged.faces) > target_faces:
    source_vertices = np.asarray(merged.vertices).copy()
    source_colours = np.asarray(merged.visual.vertex_colors).copy()
    simplified = merged.simplify_quadric_decimation(face_count=target_faces)
    tree = cKDTree(source_vertices)
    _, nearest = tree.query(np.asarray(simplified.vertices), k=1, workers=-1)
    simplified.visual = ColorVisuals(
      mesh=simplified, vertex_colors=source_colours[nearest]
    )
    merged = simplified
  return merged, {
    "source_faces": source_faces,
    "source_material_segments": len(parts),
    "target_faces": target_faces,
  }


def load_archive_scene(archive: Path) -> trimesh.Scene:
  """Extract one OBJ archive temporarily and load all included mesh LODs."""
  with tempfile.TemporaryDirectory(prefix="isometric-berlin-mesh-") as temp_dir:
    temp_path = Path(temp_dir)
    with zipfile.ZipFile(archive) as source:
      source.extractall(temp_path)
    obj_files = sorted(temp_path.glob("*.obj"))
    if len(obj_files) != 1:
      raise ValueError(f"Expected one OBJ in {archive}, found {len(obj_files)}")
    loaded = trimesh.load(obj_files[0], force="scene", process=False)
    if not isinstance(loaded, trimesh.Scene):
      loaded = trimesh.Scene(loaded)
    return loaded


def export_mesh(mesh: Any, output_path: Path) -> dict[str, Any]:
  """Transform and export one textured mesh, returning public metadata."""
  source_bounds = np.asarray(mesh.bounds, dtype=float)
  mesh.vertices = metric_to_world(np.asarray(mesh.vertices, dtype=float))
  output_path.write_bytes(trimesh.Scene(mesh).export(file_type="glb"))
  if output_path.stat().st_size > MAX_ASSET_BYTES:
    raise ValueError(
      f"Generated asset exceeds 5 MiB: {output_path} "
      f"({output_path.stat().st_size} bytes)"
    )
  return {
    "file": output_path.name,
    "bytes": output_path.stat().st_size,
    "sha256": sha256_file(output_path),
    "vertices": int(len(mesh.vertices)),
    "faces": int(len(mesh.faces)),
    "source_bounds_epsg25833": source_bounds.round(3).tolist(),
  }


def resized_texture_visual(mesh: Any, max_edge: int) -> TextureVisuals:
  """Return the mesh UVs with an RGB texture bounded by ``max_edge``."""
  visual = mesh.visual
  image = visual.material.image.convert("RGB")
  image = ImageEnhance.Color(image).enhance(1.08)
  image = ImageEnhance.Contrast(image).enhance(1.04)
  image = ImageEnhance.Brightness(image).enhance(1.06)
  if max(image.size) > max_edge:
    ratio = max_edge / max(image.size)
    size = (max(1, round(image.width * ratio)), max(1, round(image.height * ratio)))
    image = image.resize(size, Image.Resampling.LANCZOS)
  return TextureVisuals(
    uv=np.asarray(visual.uv).copy(),
    material=SimpleMaterial(image=image),
  )


def export_base_mesh(mesh: Any, output_path: Path) -> dict[str, Any]:
  """Export a full base tile with adaptive texture resolution."""
  candidate = mesh.copy()
  try:
    return export_mesh(candidate, output_path)
  except ValueError:
    output_path.unlink(missing_ok=True)
  for max_edge in (2048, 1024, 768, 512):
    candidate = mesh.copy()
    candidate.visual = resized_texture_visual(mesh, max_edge)
    try:
      metadata = export_mesh(candidate, output_path)
    except ValueError:
      output_path.unlink(missing_ok=True)
      continue
    metadata["texture_max_edge"] = max_edge
    return metadata
  raise ValueError(f"Could not fit base mesh under 5 MiB: {output_path}")


def export_base_parts(
  mesh: Any,
  output_dir: Path,
  stem: str,
  *,
  bounds: tuple[float, ...] | None = None,
  depth: int = 0,
) -> list[dict[str, Any]]:
  """Export a full tile, spatially splitting unusually dense source LODs."""
  candidate = mesh if bounds is None else crop_mesh(mesh, bounds)
  if candidate is None or len(candidate.faces) < 20:
    return []
  suffix = "" if depth == 0 else f"-part-{depth}"
  output_path = output_dir / f"{stem}{suffix}.glb"
  try:
    metadata = export_base_mesh(candidate, output_path)
  except ValueError:
    output_path.unlink(missing_ok=True)
    if depth >= 4:
      raise
    if bounds is None:
      mesh_bounds = np.asarray(mesh.bounds)
      bounds = (
        float(mesh_bounds[0, 0]),
        float(mesh_bounds[0, 1]),
        float(mesh_bounds[1, 0]),
        float(mesh_bounds[1, 1]),
      )
    parts: list[dict[str, Any]] = []
    for index, part_bounds in enumerate(split_bounds(bounds)):
      parts.extend(
        export_base_parts(
          mesh,
          output_dir,
          f"{stem}-{index + 1}",
          bounds=part_bounds,
          depth=depth + 1,
        )
      )
    return parts
  return [metadata]


def export_hero_mesh(mesh: Any, output_path: Path) -> dict[str, Any]:
  """Export a high-detail hero crop while respecting the repository cap."""
  source_vertices = np.asarray(mesh.vertices, dtype=float).copy()
  source_visual = mesh.visual
  for max_edge in (1536, 1280, 1024, 768, 512, 384):
    candidate = mesh.copy()
    candidate.vertices = source_vertices.copy()
    candidate.visual = resized_texture_visual(mesh, max_edge)
    try:
      metadata = export_mesh(candidate, output_path)
    except ValueError:
      output_path.unlink(missing_ok=True)
      continue
    metadata["texture_max_edge"] = max_edge
    return metadata
  mesh.visual = source_visual
  raise ValueError(f"Could not fit hero mesh under 5 MiB: {output_path}")


def split_bounds(
  bounds: tuple[float, ...],
) -> tuple[tuple[float, ...], tuple[float, ...]]:
  """Split a crop along its longer metric axis."""
  min_x, min_y, max_x, max_y = bounds
  if max_x - min_x >= max_y - min_y:
    middle = (min_x + max_x) / 2
    return (min_x, min_y, middle, max_y), (middle, min_y, max_x, max_y)
  middle = (min_y + max_y) / 2
  return (min_x, min_y, max_x, middle), (min_x, middle, max_x, max_y)


def export_hero_parts(
  mesh: Any,
  bounds: tuple[float, ...] | None,
  output_dir: Path,
  stem: str,
  *,
  depth: int = 0,
) -> list[dict[str, Any]]:
  """Export a hero crop, recursively splitting oversized geometry."""
  crop = mesh if bounds is None else crop_mesh(mesh, bounds)
  if crop is None or len(crop.faces) < 20:
    return []
  suffix = "" if depth == 0 else f"-part-{depth}"
  output_path = output_dir / f"{stem}{suffix}.glb"
  try:
    metadata = export_hero_mesh(crop, output_path)
  except ValueError:
    output_path.unlink(missing_ok=True)
    if depth >= 4:
      raise
    if bounds is None:
      mesh_bounds = np.asarray(mesh.bounds)
      bounds = (
        float(mesh_bounds[0, 0]),
        float(mesh_bounds[0, 1]),
        float(mesh_bounds[1, 0]),
        float(mesh_bounds[1, 1]),
      )
    parts: list[dict[str, Any]] = []
    for index, part_bounds in enumerate(split_bounds(bounds)):
      parts.extend(
        export_hero_parts(
          mesh,
          part_bounds,
          output_dir,
          f"{stem}-{index + 1}",
          depth=depth + 1,
        )
      )
    return parts
  source_bounds = bounds or (
    float(mesh.bounds[0][0]),
    float(mesh.bounds[0][1]),
    float(mesh.bounds[1][0]),
    float(mesh.bounds[1][1]),
  )
  metadata["crop_bounds_epsg25833"] = [round(value, 3) for value in source_bounds]
  return [metadata]


def projected_landmarks() -> gpd.GeoDataFrame:
  """Load landmark points in the official mesh coordinate system."""
  return gpd.read_file(LANDMARKS_PATH).to_crs(SOURCE_CRS)


def crop_mesh(mesh: Any, bounds: tuple[float, ...]) -> Any | None:
  """Clip a triangle mesh by face-centroid rectangle without changing UVs."""
  min_x, min_y, max_x, max_y = bounds
  centers = np.asarray(mesh.triangles_center)
  keep = (
    (centers[:, 0] >= min_x)
    & (centers[:, 0] <= max_x)
    & (centers[:, 1] >= min_y)
    & (centers[:, 1] <= max_y)
  )
  if not bool(keep.any()):
    return None
  return mesh.submesh([keep], append=True, repair=False)


def crop_mesh_to_footprint(mesh: Any, footprint: BaseGeometry) -> Any | None:
  """Keep only photogrammetric triangles above a buffered building footprint."""
  centers = np.asarray(mesh.triangles_center)
  keep = contains_xy(footprint, centers[:, 0], centers[:, 1])
  if not bool(keep.any()):
    return None
  return mesh.submesh([keep], append=True, repair=False)


def hero_footprints(landmarks: gpd.GeoDataFrame) -> dict[str, BaseGeometry]:
  """Return LoD2-anchored masks that exclude surrounding vegetation noise."""
  buildings = gpd.read_file(
    REPO_ROOT / "geo_data/regierungsviertel/buildings.gpkg"
  ).to_crs(SOURCE_CRS)
  named = buildings["building_name"].fillna("")
  result: dict[str, BaseGeometry] = {}
  selections = {
    "reichstag": named.str.contains("Reichstagsgebäude", regex=False),
    "bundeskanzleramt": named.str.contains("Bundeskanzleramt", regex=False),
    "hauptbahnhof": named.str.contains("Bahnhofshalle", regex=False),
  }
  buffers = {"reichstag": 8.0, "bundeskanzleramt": 7.0, "hauptbahnhof": 15.0}
  for identifier, selection in selections.items():
    matches = buildings[selection]
    if matches.empty:
      raise ValueError(f"Missing LoD2 footprint for hero: {identifier}")
    result[identifier] = matches.geometry.union_all().buffer(buffers[identifier])

  gate = landmarks[landmarks["name"] == "Brandenburger Tor"].geometry.iloc[0]
  nearest_index = buildings.geometry.distance(gate).idxmin()
  result["brandenburger-tor"] = buildings.loc[nearest_index].geometry.buffer(12.0)
  return result


def landmark_payload(landmarks: gpd.GeoDataFrame) -> list[dict[str, Any]]:
  """Serialize metric landmark anchors for browser-side camera focus."""
  records: list[dict[str, Any]] = []
  for _, row in landmarks.sort_values("tour_order").iterrows():
    point = row.geometry
    records.append(
      {
        "name": str(row["name"]),
        "role": str(row["role"]),
        "world": point_to_world(point.x, point.y),
      }
    )
  return records


def architectural_signature_payload(
  landmarks: gpd.GeoDataFrame,
  hero_details: dict[str, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
  """Build dimensioned architectural overlays from primary-source evidence."""
  matches = landmarks[landmarks["name"] == "Reichstagsgebäude"]
  if len(matches) != 1:
    raise ValueError("Missing unique Reichstagsgebäude landmark")
  details = hero_details.get("reichstag", [])
  if not details:
    raise ValueError("Missing Reichstag hero geometry for dome alignment")
  source_top_m = max(
    float(detail["source_bounds_epsg25833"][1][2]) for detail in details
  )
  point = matches.geometry.iloc[0]
  base_world_y = source_top_m - ORIGIN[2] - REICHSTAG_DOME_HEIGHT_M
  return [
    {
      "id": "reichstag-dome",
      "landmark_name": "Reichstagsgebäude",
      "geometry_status": (
        "Procedural architectural signature aligned to the official Berlin 3D "
        "mesh apex and official Bundestag dimensions"
      ),
      "anchor_world": [
        round(float(point.x - ORIGIN[0]), 3),
        round(base_world_y, 3),
        round(float(ORIGIN[1] - point.y), 3),
      ],
      "height_m": REICHSTAG_DOME_HEIGHT_M,
      "diameter_m": REICHSTAG_DOME_DIAMETER_M,
      "vertical_ribs": REICHSTAG_DOME_VERTICAL_RIBS,
      "horizontal_rings": REICHSTAG_DOME_HORIZONTAL_RINGS,
      "source_url": REICHSTAG_DOME_SOURCE_URL,
    }
  ]


def tunnel_payload() -> dict[str, Any]:
  """Serialize the documented OSM-derived tunnel centreline for WebGL."""
  payload = json.loads(TUNNEL_PATH.read_text(encoding="utf-8"))
  feature = payload["features"][0]
  transformer = Transformer.from_crs("EPSG:4326", SOURCE_CRS, always_xy=True)
  points = []
  for lon, lat in feature["geometry"]["coordinates"]:
    x, y = transformer.transform(lon, lat)
    points.append(point_to_world(x, y, elevation=21.5))
  properties = feature["properties"]
  return {
    "name": properties["name"],
    "geometry_status": properties["geometry_status"],
    "depth_status": properties["depth_status"],
    "tube_count": properties["tube_count"],
    "clear_width_each_direction_m": properties["clear_width_each_direction_m"],
    "clear_height_m": properties["clear_height_m"],
    "points": points,
  }


def build_webgl_scene(
  raw_dir: Path = RAW_DIR,
  output_dir: Path = OUTPUT_DIR,
) -> dict[str, Any]:
  """Build all compact public GLBs and return the generated scene manifest."""
  archives = sorted(raw_dir.glob("*.zip"))
  if not archives:
    raise FileNotFoundError(f"No Berlin 3D Mesh archives found in {raw_dir}")
  output_dir.mkdir(parents=True, exist_ok=True)
  for old_asset in output_dir.glob("*.glb"):
    old_asset.unlink()

  landmarks = projected_landmarks()
  footprints = hero_footprints(landmarks)
  base_tiles: list[dict[str, Any]] = []
  hero_details: dict[str, list[dict[str, Any]]] = {
    spec.identifier: [] for spec in HERO_SPECS
  }

  for archive in archives:
    tile_id = archive.stem.removesuffix("_-002")
    scene = load_archive_scene(archive)
    base_mesh, base_source = colored_base_mesh(scene)
    base_parts = export_base_parts(base_mesh, output_dir, f"tile-{tile_id}")
    for base_metadata in base_parts:
      base_metadata.update({"tile_id": tile_id, **base_source})
    base_tiles.extend(base_parts)

    for spec in HERO_SPECS:
      footprint = footprints[spec.identifier]
      crop_bounds = footprint.bounds
      for material_index, (material_name, detailed_mesh) in enumerate(
        scene.geometry.items()
      ):
        detailed_bounds = np.asarray(detailed_mesh.bounds)
        if (
          detailed_bounds[1, 0] < crop_bounds[0]
          or detailed_bounds[0, 0] > crop_bounds[2]
          or detailed_bounds[1, 1] < crop_bounds[1]
          or detailed_bounds[0, 1] > crop_bounds[3]
        ):
          continue
        footprint_crop = crop_mesh_to_footprint(detailed_mesh, footprint)
        if footprint_crop is None:
          continue
        material_id = str(material_index)
        detail_parts = export_hero_parts(
          footprint_crop,
          None,
          output_dir,
          f"hero-{spec.identifier}-{tile_id}-material-{material_id}",
        )
        for detail_metadata in detail_parts:
          detail_metadata.update(
            {
              "tile_id": tile_id,
              "source_material_segment": material_name,
            }
          )
        hero_details[spec.identifier].extend(detail_parts)

  bounds = gpd.read_file(BOUNDS_PATH).to_crs(SOURCE_CRS).total_bounds
  manifest = {
    "schema_version": 1,
    "source": {
      "name": "Berlin 3D Mesh Model 2025",
      "provider": "Berlin Partner für Wirtschaft und Technologie GmbH",
      "portal_url": "https://www.businesslocationcenter.de/berlin3d-downloadportal/",
      "terms_url": "https://www.businesslocationcenter.de/berlin3d-downloadportal/resources/terms/terms.de.html",
      "survey": "June 2025 aerial survey",
      "attribution": "3D mesh: Berlin Partner für Wirtschaft und Technologie GmbH",
    },
    "coordinate_system": SOURCE_CRS,
    "world_axes": {"x": "east", "y": "up", "z": "south"},
    "origin_epsg25833": ORIGIN.tolist(),
    "bounds_epsg25833": [round(float(value), 3) for value in bounds],
    "base_tiles": base_tiles,
    "hero_details": [
      {
        "id": spec.identifier,
        "landmark_name": spec.landmark_name,
        "files": hero_details[spec.identifier],
      }
      for spec in HERO_SPECS
    ],
    "architectural_signatures": architectural_signature_payload(
      landmarks, hero_details
    ),
    "landmarks": landmark_payload(landmarks),
    "tiergartentunnel": tunnel_payload(),
  }
  scene_path = output_dir / "scene.json"
  scene_path.parent.mkdir(parents=True, exist_ok=True)
  scene_path.write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
  )
  return manifest


def main() -> None:
  """CLI entry point for preparing the public Three.js asset set."""
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--raw-dir", type=Path, default=RAW_DIR)
  parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
  args = parser.parse_args()
  manifest = build_webgl_scene(args.raw_dir, args.output_dir)
  total_bytes = sum(tile["bytes"] for tile in manifest["base_tiles"])
  total_bytes += sum(
    detail["bytes"] for hero in manifest["hero_details"] for detail in hero["files"]
  )
  print(
    f"Wrote {len(manifest['base_tiles'])} base tiles and "
    f"{sum(len(hero['files']) for hero in manifest['hero_details'])} hero crops "
    f"({total_bytes / 1024 / 1024:.1f} MiB)"
  )


if __name__ == "__main__":
  main()
