"""Render isometric source views of each quadrant from the fused stack."""

from __future__ import annotations

import argparse
import io
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import geopandas as gpd
from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import (
  GeometryCollection,
  LineString,
  MultiLineString,
  MultiPolygon,
  Point,
  Polygon,
)

from isometric_berlin.data.common import BERLIN_PROJECTED
from isometric_berlin.generation.create_grid import quadrant_db_path

BACKGROUND = (236, 230, 208)
PARK = (120, 159, 95)
WATER = (87, 142, 171)
ROAD = (218, 204, 177)
RAIL = (74, 77, 82)
BUILDING_WALL = (190, 174, 149)
BUILDING_WALL_DARK = (150, 137, 119)
BUILDING_ROOF = (166, 148, 124)
BUILDING_HERO = (198, 181, 151)
PARCEL = (189, 176, 151)
OUTLINE = (80, 73, 64)
LANDMARK = (105, 47, 47)


def load_layer(path: Path, layer: str) -> gpd.GeoDataFrame:
  if not path.exists():
    return gpd.GeoDataFrame(geometry=[], crs=BERLIN_PROJECTED)
  try:
    gdf = gpd.read_file(path, layer=layer)
  except Exception:
    return gpd.GeoDataFrame(geometry=[], crs=BERLIN_PROJECTED)
  if gdf.crs is None:
    gdf = gdf.set_crs(BERLIN_PROJECTED)
  return gdf.to_crs(BERLIN_PROJECTED)


def load_landmarks(path: Path) -> gpd.GeoDataFrame:
  if not path.exists():
    return gpd.GeoDataFrame(geometry=[], crs=BERLIN_PROJECTED)
  gdf = gpd.read_file(path)
  if gdf.crs is None:
    gdf = gdf.set_crs("EPSG:4326")
  return gdf.to_crs(BERLIN_PROJECTED)


def query(
  gdf: gpd.GeoDataFrame, bounds: tuple[float, float, float, float]
) -> gpd.GeoDataFrame:
  if gdf.empty:
    return gdf
  minx, miny, maxx, maxy = bounds
  return gdf.cx[minx:maxx, miny:maxy].copy()


def project_point(
  x: float,
  y: float,
  *,
  z: float,
  center_x: float,
  center_y: float,
  scale: float,
  width: int,
  height: int,
) -> tuple[int, int]:
  dx = x - center_x
  dy = y - center_y
  px = (dx - dy) * 0.88 * scale + width / 2
  py = (dx + dy) * 0.44 * scale - z * 2.7 + height * 0.62
  return int(round(px)), int(round(py))


def draw_geom_fill(
  draw: ImageDraw.ImageDraw,
  geom,
  *,
  color: tuple[int, int, int],
  center_x: float,
  center_y: float,
  scale: float,
  width: int,
  height: int,
) -> None:
  for polygon in polygons(geom):
    pts = [
      project_point(
        x,
        y,
        z=0,
        center_x=center_x,
        center_y=center_y,
        scale=scale,
        width=width,
        height=height,
      )
      for x, y in polygon.exterior.coords
    ]
    if len(pts) >= 3:
      draw.polygon(pts, fill=color)


def draw_geom_line(
  draw: ImageDraw.ImageDraw,
  geom,
  *,
  color: tuple[int, int, int],
  line_width: int,
  center_x: float,
  center_y: float,
  scale: float,
  width: int,
  height: int,
) -> None:
  for line in lines(geom):
    pts = [
      project_point(
        x,
        y,
        z=0,
        center_x=center_x,
        center_y=center_y,
        scale=scale,
        width=width,
        height=height,
      )
      for x, y in line.coords
    ]
    if len(pts) >= 2:
      draw.line(pts, fill=color, width=line_width, joint="curve")


def draw_building(
  draw: ImageDraw.ImageDraw,
  polygon: Polygon,
  *,
  height_m: float,
  is_hero: bool,
  center_x: float,
  center_y: float,
  scale: float,
  width: int,
  height: int,
  outline_width: int = 1,
) -> None:
  coords = list(polygon.exterior.coords)
  if len(coords) < 4:
    return
  height_m = max(4.0, min(float(height_m or 12.0), 85.0))
  base = [
    project_point(
      x,
      y,
      z=0,
      center_x=center_x,
      center_y=center_y,
      scale=scale,
      width=width,
      height=height,
    )
    for x, y in coords
  ]
  roof = [
    project_point(
      x,
      y,
      z=height_m,
      center_x=center_x,
      center_y=center_y,
      scale=scale,
      width=width,
      height=height,
    )
    for x, y in coords
  ]
  for idx in range(len(coords) - 1):
    wall = [base[idx], base[idx + 1], roof[idx + 1], roof[idx]]
    color = BUILDING_WALL if idx % 2 == 0 else BUILDING_WALL_DARK
    draw.polygon(wall, fill=color)
    draw.line(wall + [wall[0]], fill=OUTLINE, width=outline_width)
  draw.polygon(roof, fill=BUILDING_HERO if is_hero else BUILDING_ROOF)
  draw.line(roof, fill=OUTLINE, width=outline_width)


def building_height(row: Any, *, is_hero: bool = False) -> float:
  """Return measured LoD2 height or a conservative visual fallback."""
  for key in ("measured_height_m", "height_m"):
    value = row.get(key)
    if value is None:
      continue
    try:
      height = float(value)
    except (TypeError, ValueError):
      continue
    if height == height and height >= 2.5:
      return height

  geometry = row.get("geometry")
  area = float(getattr(geometry, "area", 0.0) or 0.0)
  if area >= 10_000:
    fallback = 28.0
  elif area >= 6_000:
    fallback = 23.0
  elif area >= 3_000:
    fallback = 18.0
  elif area >= 1_200:
    fallback = 14.0
  elif area >= 400:
    fallback = 10.0
  else:
    fallback = 7.0
  if is_hero:
    fallback = max(fallback, 18.0)
  return fallback


def polygons(geom: Any) -> list[Polygon]:
  if geom is None or geom.is_empty:
    return []
  if isinstance(geom, Polygon):
    return [geom]
  if isinstance(geom, MultiPolygon):
    return list(geom.geoms)
  if isinstance(geom, GeometryCollection):
    return [part for sub in geom.geoms for part in polygons(sub)]
  return []


def lines(geom: Any) -> list[LineString]:
  if geom is None or geom.is_empty:
    return []
  if isinstance(geom, LineString):
    return [geom]
  if isinstance(geom, MultiLineString):
    return list(geom.geoms)
  if isinstance(geom, Polygon):
    return [LineString(geom.exterior.coords)]
  if isinstance(geom, MultiPolygon):
    return [LineString(poly.exterior.coords) for poly in geom.geoms]
  if isinstance(geom, GeometryCollection):
    return [part for sub in geom.geoms for part in lines(sub)]
  return []


def png_bytes(image: Image.Image) -> bytes:
  output = io.BytesIO()
  image.save(output, format="PNG", optimize=True)
  return output.getvalue()


def render_quadrant(
  *,
  quad: dict[str, Any],
  buildings: gpd.GeoDataFrame,
  osm_layers: dict[str, gpd.GeoDataFrame],
  landmarks: gpd.GeoDataFrame,
  render_px: int,
  context_m: float,
  show_labels: bool,
) -> Image.Image:
  image = Image.new("RGB", (render_px, render_px), BACKGROUND)
  draw = ImageDraw.Draw(image)
  q_bounds = (
    quad["minx"] - context_m,
    quad["miny"] - context_m,
    quad["maxx"] + context_m,
    quad["maxy"] + context_m,
  )
  center_x = quad["center_x"]
  center_y = quad["center_y"]
  span_x = quad["maxx"] - quad["minx"] + context_m * 2
  span_y = quad["maxy"] - quad["miny"] + context_m * 2
  scale = render_px / ((span_x + span_y) * 0.7)
  line_scale = max(1, min(3, round(render_px / 3072)))

  for _, row in query(osm_layers["parks"], q_bounds).iterrows():
    draw_geom_fill(
      draw,
      row.geometry,
      color=PARK,
      center_x=center_x,
      center_y=center_y,
      scale=scale,
      width=render_px,
      height=render_px,
    )
  for _, row in query(osm_layers["water"], q_bounds).iterrows():
    draw_geom_fill(
      draw,
      row.geometry,
      color=WATER,
      center_x=center_x,
      center_y=center_y,
      scale=scale,
      width=render_px,
      height=render_px,
    )
    draw_geom_line(
      draw,
      row.geometry,
      color=WATER,
      line_width=4 * line_scale,
      center_x=center_x,
      center_y=center_y,
      scale=scale,
      width=render_px,
      height=render_px,
    )
  parcels = osm_layers.get("alkis")
  if parcels is not None:
    for _, row in query(parcels, q_bounds).iterrows():
      draw_geom_line(
        draw,
        row.geometry,
        color=PARCEL,
        line_width=max(1, line_scale - 1),
        center_x=center_x,
        center_y=center_y,
        scale=scale,
        width=render_px,
        height=render_px,
      )
  for _, row in query(osm_layers["roads"], q_bounds).iterrows():
    draw_geom_line(
      draw,
      row.geometry,
      color=ROAD,
      line_width=3 * line_scale,
      center_x=center_x,
      center_y=center_y,
      scale=scale,
      width=render_px,
      height=render_px,
    )
  for _, row in query(osm_layers["rail"], q_bounds).iterrows():
    draw_geom_line(
      draw,
      row.geometry,
      color=RAIL,
      line_width=max(1, line_scale + 1),
      center_x=center_x,
      center_y=center_y,
      scale=scale,
      width=render_px,
      height=render_px,
    )

  near_landmarks = query(landmarks, q_bounds)
  hero_zone = (
    near_landmarks.geometry.union_all().buffer(65) if len(near_landmarks) else None
  )
  selected_buildings = query(buildings, q_bounds)
  if not selected_buildings.empty:
    selected_buildings = selected_buildings.assign(
      _sort=selected_buildings.geometry.centroid.x
      + selected_buildings.geometry.centroid.y
    ).sort_values("_sort")
  for _, row in selected_buildings.iterrows():
    is_hero = bool(hero_zone is not None and row.geometry.intersects(hero_zone))
    for poly in polygons(row.geometry):
      draw_building(
        draw,
        poly,
        height_m=building_height(row, is_hero=is_hero),
        is_hero=is_hero,
        center_x=center_x,
        center_y=center_y,
        scale=scale,
        width=render_px,
        height=render_px,
        outline_width=line_scale,
      )

  if show_labels:
    font = ImageFont.load_default()
    for _, row in near_landmarks.iterrows():
      if not isinstance(row.geometry, Point):
        continue
      px, py = project_point(
        row.geometry.x,
        row.geometry.y,
        z=38,
        center_x=center_x,
        center_y=center_y,
        scale=scale,
        width=render_px,
        height=render_px,
      )
      draw.ellipse((px - 4, py - 4, px + 4, py + 4), fill=LANDMARK)
      name = str(row.get("name", ""))
      if name:
        draw.text((px + 6, py - 5), name[:24], fill=LANDMARK, font=font)
  return image


def update_render(
  db_path: Path,
  *,
  buildings: gpd.GeoDataFrame,
  osm_layers: dict[str, gpd.GeoDataFrame],
  landmarks: gpd.GeoDataFrame,
  render_px: int,
  output_px: int,
  context_m: float,
  write_files: bool,
  show_labels: bool,
  limit: int | None,
) -> int:
  render_dir = db_path.parent / "renders"
  if write_files:
    render_dir.mkdir(parents=True, exist_ok=True)
  count = 0
  with sqlite3.connect(db_path) as db:
    db.row_factory = sqlite3.Row
    rows = db.execute(
      "SELECT * FROM quadrants ORDER BY row, col"
      + (f" LIMIT {int(limit)}" if limit else "")
    ).fetchall()
    for row in rows:
      quad = dict(row)
      image = render_quadrant(
        quad=quad,
        buildings=buildings,
        osm_layers=osm_layers,
        landmarks=landmarks,
        render_px=render_px,
        context_m=context_m,
        show_labels=show_labels,
      )
      image = image.resize((output_px, output_px), Image.Resampling.LANCZOS)
      data = png_bytes(image)
      db.execute(
        "UPDATE quadrants SET render = ?, status = ?, updated_at = ? WHERE id = ?",
        (data, "rendered", datetime.now(tz=UTC).isoformat(), quad["id"]),
      )
      if write_files:
        image.save(render_dir / f"q_{quad['row']:03d}_{quad['col']:03d}.png")
      count += 1
    db.commit()
  return count


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--map-id", default="regierungsviertel")
  parser.add_argument(
    "--buildings",
    type=Path,
    default=Path("geo_data/regierungsviertel/buildings.gpkg"),
  )
  parser.add_argument(
    "--osm", type=Path, default=Path("geo_data/regierungsviertel/osm.gpkg")
  )
  parser.add_argument(
    "--alkis", type=Path, default=Path("geo_data/regierungsviertel/alkis.gpkg")
  )
  parser.add_argument(
    "--landmarks",
    type=Path,
    default=Path("geo_data/regierungsviertel/landmarks.geojson"),
  )
  parser.add_argument("--render-px", type=int, default=1024)
  parser.add_argument("--output-px", type=int, default=512)
  parser.add_argument("--context-m", type=float, default=180.0)
  parser.add_argument("--no-files", action="store_true")
  parser.add_argument("--no-labels", action="store_true")
  parser.add_argument("--limit", type=int)
  args = parser.parse_args()

  db_path = quadrant_db_path(args.map_id)
  buildings = load_layer(args.buildings, "buildings")
  osm_layers = {
    layer: load_layer(args.osm, layer)
    for layer in ["roads", "water", "parks", "rail", "pois"]
  }
  osm_layers["alkis"] = load_layer(args.alkis, "flurstuecke")
  landmarks = load_landmarks(args.landmarks)
  count = update_render(
    db_path,
    buildings=buildings,
    osm_layers=osm_layers,
    landmarks=landmarks,
    render_px=args.render_px,
    output_px=args.output_px,
    context_m=args.context_m,
    write_files=not args.no_files,
    show_labels=not args.no_labels,
    limit=args.limit,
  )
  print(f"Rendered {count} quadrants into {db_path}")


if __name__ == "__main__":
  main()
