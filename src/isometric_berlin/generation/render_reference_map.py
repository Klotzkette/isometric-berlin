"""Render a top-down OSM/LoD2 reference map for placement QA."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

import geopandas as gpd
from PIL import Image, ImageDraw, ImageFont
from shapely.geometry.base import BaseGeometry

from isometric_berlin.data.common import load_bounds_polygon, project_geometry
from isometric_berlin.generation.render_quadrants import (
  BUILDING_WALL,
  BUILDING_WALL_DARK,
  MAJOR_HIGHWAYS,
  OUTLINE,
  PARK_LIGHT,
  RAIL,
  ROAD,
  ROAD_EDGE,
  ROAD_MAJOR,
  WATER,
  lines,
  load_landmarks,
  load_layer,
  polygons,
  row_text,
)

BACKGROUND = (244, 240, 230)
LEGEND_BACKGROUND = (34, 41, 38)
LEGEND_TEXT = (245, 239, 228)
LEGEND_MUTED = (216, 200, 168)
PARCEL_LINE = (205, 194, 173)
REFERENCE_RED = (169, 66, 53)
REFERENCE_WHITE = (255, 252, 242)


@dataclass(frozen=True)
class MapTransform:
  minx: float
  miny: float
  maxx: float
  maxy: float
  width: int
  height: int
  legend_width: int
  pad: int

  @property
  def map_width(self) -> int:
    return self.width - self.legend_width

  @property
  def scale(self) -> float:
    span_x = self.maxx - self.minx
    span_y = self.maxy - self.miny
    return min(
      (self.map_width - self.pad * 2) / span_x,
      (self.height - self.pad * 2) / span_y,
    )

  def point(self, x: float, y: float) -> tuple[int, int]:
    px = self.pad + (x - self.minx) * self.scale
    py = self.pad + (self.maxy - y) * self.scale
    return int(round(px)), int(round(py))


def font(size: int, *, bold: bool = False) -> ImageFont.ImageFont:
  candidates = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "/Library/Fonts/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  ]
  for candidate in candidates:
    if ("Bold" in candidate) != bold:
      continue
    try:
      return ImageFont.truetype(candidate, size=size)
    except OSError:
      continue
  return ImageFont.load_default()


def draw_polygon_layer(
  draw: ImageDraw.ImageDraw,
  gdf: gpd.GeoDataFrame,
  transform: MapTransform,
  *,
  fill: tuple[int, int, int],
  outline: tuple[int, int, int] | None = None,
  width: int = 1,
) -> None:
  for geom in gdf.geometry:
    for polygon in polygons(geom):
      coords = [transform.point(x, y) for x, y in polygon.exterior.coords]
      if len(coords) < 3:
        continue
      draw.polygon(coords, fill=fill)
      if outline:
        draw.line(coords + [coords[0]], fill=outline, width=width, joint="curve")


def draw_line_layer(
  draw: ImageDraw.ImageDraw,
  gdf: gpd.GeoDataFrame,
  transform: MapTransform,
  *,
  fill: tuple[int, int, int],
  width: int,
  casing: tuple[int, int, int] | None = None,
) -> None:
  for geom in gdf.geometry:
    for line in lines(geom):
      coords = [transform.point(x, y) for x, y in line.coords]
      if len(coords) < 2:
        continue
      if casing:
        draw.line(coords, fill=casing, width=width + 3, joint="curve")
      draw.line(coords, fill=fill, width=width, joint="curve")


def draw_roads(
  draw: ImageDraw.ImageDraw, roads: gpd.GeoDataFrame, transform: MapTransform
) -> None:
  if roads.empty:
    return
  for _, row in roads.iterrows():
    highway = row_text(row, "highway")
    if not highway:
      continue
    if highway in MAJOR_HIGHWAYS:
      fill, width = ROAD_MAJOR, 6
    elif highway in {"footway", "path", "pedestrian", "cycleway", "steps"}:
      fill, width = (210, 218, 190), 2
    else:
      fill, width = ROAD, 4
    draw_line_layer(
      draw,
      gpd.GeoDataFrame([row], crs=roads.crs),
      transform,
      fill=fill,
      width=width,
      casing=ROAD_EDGE,
    )


def draw_landmarks(
  draw: ImageDraw.ImageDraw, landmarks: gpd.GeoDataFrame, transform: MapTransform
) -> None:
  label_font = font(15, bold=True)
  for index, (_, row) in enumerate(landmarks.iterrows(), start=1):
    if row.geometry.geom_type != "Point":
      continue
    x, y = transform.point(row.geometry.x, row.geometry.y)
    radius = 12
    draw.ellipse(
      (x - radius, y - radius, x + radius, y + radius),
      fill=REFERENCE_RED,
      outline=REFERENCE_WHITE,
      width=3,
    )
    text = str(index)
    bbox = draw.textbbox((0, 0), text, font=label_font)
    draw.text(
      (x - (bbox[2] - bbox[0]) / 2, y - (bbox[3] - bbox[1]) / 2 - 1),
      text,
      fill=REFERENCE_WHITE,
      font=label_font,
    )


def draw_legend(
  draw: ImageDraw.ImageDraw,
  landmarks: gpd.GeoDataFrame,
  *,
  width: int,
  height: int,
  legend_width: int,
) -> None:
  left = width - legend_width
  draw.rectangle((left, 0, width, height), fill=LEGEND_BACKGROUND)
  title_font = font(24, bold=True)
  body_font = font(17)
  small_font = font(14)
  marker_font = font(11, bold=True)
  draw.text((left + 28, 28), "Top-down reference", fill=LEGEND_TEXT, font=title_font)
  draw.text(
    (left + 28, 62),
    "OSM city map + Berlin LoD2",
    fill=LEGEND_MUTED,
    font=small_font,
  )
  y = 104
  for index, (_, row) in enumerate(landmarks.iterrows(), start=1):
    marker_x = left + 40
    marker_y = y + 10
    marker_radius = 11
    draw.ellipse(
      (
        marker_x - marker_radius,
        marker_y - marker_radius,
        marker_x + marker_radius,
        marker_y + marker_radius,
      ),
      fill=REFERENCE_RED,
      outline=REFERENCE_WHITE,
      width=2,
    )
    number = str(index)
    bbox = draw.textbbox((0, 0), number, font=marker_font)
    draw.text(
      (
        marker_x - (bbox[2] - bbox[0]) / 2,
        marker_y - (bbox[3] - bbox[1]) / 2 - 1,
      ),
      number,
      fill=REFERENCE_WHITE,
      font=marker_font,
    )
    name = str(row.get("name", ""))
    draw.text((left + 64, y), name, fill=LEGEND_TEXT, font=body_font)
    y += 34
  draw.text(
    (left + 28, height - 70),
    "© OpenStreetMap contributors · Geoportal Berlin LoD2",
    fill=LEGEND_MUTED,
    font=small_font,
  )


def clipped(gdf: gpd.GeoDataFrame, bounds: BaseGeometry) -> gpd.GeoDataFrame:
  if gdf.empty:
    return gdf
  return gpd.clip(gdf, bounds)


def landmarks_inside(gdf: gpd.GeoDataFrame, bounds: BaseGeometry) -> gpd.GeoDataFrame:
  if gdf.empty:
    return gdf
  return gdf[gdf.geometry.intersects(bounds)].copy()


def draw_bounds_outline(
  draw: ImageDraw.ImageDraw, bounds: BaseGeometry, transform: MapTransform
) -> None:
  for polygon in polygons(bounds):
    coords = [transform.point(x, y) for x, y in polygon.exterior.coords]
    if len(coords) >= 3:
      draw.line(coords + [coords[0]], fill=OUTLINE, width=3, joint="curve")


def render_reference_map(
  *,
  bounds_path: Path,
  buildings_path: Path,
  osm_path: Path,
  landmarks_path: Path,
  out_path: Path,
  width: int,
  height: int,
  legend_width: int,
  pad: int,
) -> None:
  bounds = project_geometry(load_bounds_polygon(bounds_path))
  minx, miny, maxx, maxy = bounds.bounds
  transform = MapTransform(
    minx=minx,
    miny=miny,
    maxx=maxx,
    maxy=maxy,
    width=width,
    height=height,
    legend_width=legend_width,
    pad=pad,
  )
  image = Image.new("RGB", (width, height), BACKGROUND)
  draw = ImageDraw.Draw(image)

  buildings = clipped(load_layer(buildings_path, "buildings"), bounds)
  landmarks = landmarks_inside(load_landmarks(landmarks_path), bounds)
  osm_layers = {
    layer: clipped(load_layer(osm_path, layer), bounds)
    for layer in ["parks", "water", "roads", "rail"]
  }

  draw_polygon_layer(draw, osm_layers["parks"], transform, fill=PARK_LIGHT)
  draw_polygon_layer(draw, osm_layers["water"], transform, fill=WATER)
  draw_line_layer(draw, osm_layers["water"], transform, fill=WATER, width=7)
  draw_polygon_layer(
    draw,
    buildings,
    transform,
    fill=BUILDING_WALL,
    outline=BUILDING_WALL_DARK,
  )
  draw_roads(draw, osm_layers["roads"], transform)
  draw_line_layer(draw, osm_layers["rail"], transform, fill=RAIL, width=2)
  draw_bounds_outline(draw, bounds, transform)
  draw_landmarks(draw, landmarks, transform)
  draw_legend(draw, landmarks, width=width, height=height, legend_width=legend_width)

  out_path.parent.mkdir(parents=True, exist_ok=True)
  image.save(out_path, optimize=True)


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--bounds",
    type=Path,
    default=Path("geo_data/regierungsviertel/bounds.geojson"),
  )
  parser.add_argument(
    "--buildings",
    type=Path,
    default=Path("geo_data/regierungsviertel/buildings.gpkg"),
  )
  parser.add_argument(
    "--osm", type=Path, default=Path("geo_data/regierungsviertel/osm.gpkg")
  )
  parser.add_argument(
    "--landmarks",
    type=Path,
    default=Path("geo_data/regierungsviertel/landmarks.geojson"),
  )
  parser.add_argument(
    "--out",
    type=Path,
    default=Path("src/app/public/dzi/regierungsviertel/reference_map.png"),
  )
  parser.add_argument("--width", type=int, default=1900)
  parser.add_argument("--height", type=int, default=1300)
  parser.add_argument("--legend-width", type=int, default=560)
  parser.add_argument("--pad", type=int, default=52)
  args = parser.parse_args()
  render_reference_map(
    bounds_path=args.bounds,
    buildings_path=args.buildings,
    osm_path=args.osm,
    landmarks_path=args.landmarks,
    out_path=args.out,
    width=args.width,
    height=args.height,
    legend_width=args.legend_width,
    pad=args.pad,
  )
  print(f"Wrote top-down reference map to {args.out}")


if __name__ == "__main__":
  main()
