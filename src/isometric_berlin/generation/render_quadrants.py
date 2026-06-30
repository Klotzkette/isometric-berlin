"""Render isometric source views of each quadrant from the fused stack."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sqlite3
import unicodedata
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
PARK_DARK = (95, 137, 82)
PARK_LIGHT = (139, 171, 103)
WATER = (87, 142, 171)
ROAD = (218, 204, 177)
ROAD_MAJOR = (236, 226, 207)
ROAD_PATH = (192, 206, 174)
ROAD_EDGE = (194, 180, 156)
RAIL = (94, 94, 88)
RAIL_PLATFORM = (139, 136, 122)
BUILDING_WALL = (190, 174, 149)
BUILDING_WALL_DARK = (150, 137, 119)
BUILDING_ROOF = (166, 148, 124)
BUILDING_HERO = (198, 181, 151)
BUILDING_SHADOW = (176, 168, 149)
BUILDING_SHADOW_SOFT = (210, 203, 184)
PARCEL = (189, 176, 151)
OUTLINE = (80, 73, 64)
LANDMARK = (105, 47, 47)
MONUMENT = (219, 199, 164)
MONUMENT_DARK = (124, 96, 77)
GLASS = (111, 164, 181)
GLASS_DARK = (62, 104, 121)
TUNNEL = (41, 40, 39)
BRIDGE = (226, 224, 209)
SURFACE_LINE = (112, 100, 86)
SURFACE_LIGHT = (219, 205, 178)
POI_MARK = (143, 78, 65)
POI_SERVICE = (118, 112, 92)

MAJOR_HIGHWAYS = {"primary", "secondary", "tertiary", "trunk"}
LOCAL_HIGHWAYS = {"residential", "service", "unclassified", "living_street"}
PATH_HIGHWAYS = {
  "footway",
  "path",
  "pedestrian",
  "cycleway",
  "steps",
  "crossing",
  "track",
}
RAIL_LINES = {"rail", "light_rail", "tram"}
RAIL_PLATFORMS = {"platform", "platform_edge"}
MaterialCue = dict[str, tuple[int, int, int]]


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
  dy = center_y - y
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
  casing_color: tuple[int, int, int] | None = None,
  casing_extra: int = 0,
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
      if casing_color is not None and casing_extra > 0:
        draw.line(
          pts,
          fill=casing_color,
          width=max(line_width + casing_extra, line_width),
          joint="curve",
        )
      draw.line(pts, fill=color, width=line_width, joint="curve")


def row_text(row: Any, key: str) -> str:
  value = row.get(key)
  if value is None or value != value:
    return ""
  return str(value)


def normalized_text(value: str) -> str:
  """Return an ASCII-ish lower-case key for landmark routing."""
  return (
    unicodedata.normalize("NFKD", value)
    .encode("ascii", "ignore")
    .decode("ascii")
    .lower()
  )


def clamp_channel(value: float) -> int:
  return max(0, min(255, int(round(value))))


def mix_color(
  a: tuple[int, int, int], b: tuple[int, int, int], amount: float
) -> tuple[int, int, int]:
  return tuple(
    clamp_channel(left * (1.0 - amount) + right * amount)
    for left, right in zip(a, b, strict=True)
  )


def shift_color(color: tuple[int, int, int], amount: int) -> tuple[int, int, int]:
  return tuple(clamp_channel(channel + amount) for channel in color)


def stable_variation(key: str, spread: int = 9) -> int:
  digest = hashlib.blake2s(key.encode("utf-8"), digest_size=2).digest()
  return int.from_bytes(digest, "big") % (spread * 2 + 1) - spread


def parse_hex_color(value: Any) -> tuple[int, int, int] | None:
  text = str(value).strip().lstrip("#")
  if len(text) != 6:
    return None
  try:
    return tuple(int(text[index : index + 2], 16) for index in range(0, 6, 2))
  except ValueError:
    return None


def colour_luma(color: tuple[int, int, int]) -> float:
  return color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722


def landmark_reference_id(name: str) -> str | None:
  kind = landmark_kind(name)
  return {
    "gate": "brandenburger_tor",
    "dome": "reichstag",
    "glass_station": "hauptbahnhof",
    "curved_roof": "hkw",
    "chancellery": "bundeskanzleramt",
  }.get(kind or "")


def reference_colours(records: list[dict[str, Any]]) -> list[tuple[int, int, int]]:
  colours: list[tuple[int, int, int]] = []
  for record in records:
    for value in record.get("dominant_colours", []):
      color = parse_hex_color(value)
      if color is not None and 35 <= colour_luma(color) <= 235:
        colours.append(color)
  return colours


def averaged_reference_colour(records: list[dict[str, Any]]) -> tuple[int, int, int]:
  colours = reference_colours(records)
  if not colours:
    return BUILDING_HERO
  return tuple(
    round(sum(color[channel] for color in colours) / len(colours))
    for channel in range(3)
  )


def reference_colour_extremes(
  records: list[dict[str, Any]],
) -> tuple[tuple[int, int, int], tuple[int, int, int]]:
  colours = reference_colours(records)
  if not colours:
    return BUILDING_WALL_DARK, SURFACE_LIGHT
  ordered = sorted(colours, key=colour_luma)
  return ordered[0], ordered[-1]


def load_wikimedia_material_cues(path: Path) -> dict[str, MaterialCue]:
  """Load additive landmark material cues from the Wikimedia manifest."""
  if not path.exists():
    return {}
  try:
    payload = json.loads(path.read_text(encoding="utf-8"))
  except (OSError, json.JSONDecodeError):
    return {}
  grouped: dict[str, list[dict[str, Any]]] = {}
  for record in payload.get("records", []):
    if isinstance(record, dict):
      landmark_id = str(record.get("landmark_id", ""))
      if landmark_id:
        grouped.setdefault(landmark_id, []).append(record)
  cues: dict[str, MaterialCue] = {}
  for landmark_id, records in grouped.items():
    base = averaged_reference_colour(records)
    dark, light = reference_colour_extremes(records)
    cues[landmark_id] = {
      "wall": mix_color(BUILDING_HERO, base, 0.52),
      "wall_dark": mix_color(dark, OUTLINE, 0.24),
      "wall_light": mix_color(light, (255, 250, 228), 0.18),
      "roof": mix_color(BUILDING_ROOF, mix_color(base, dark, 0.22), 0.36),
      "roof_line": mix_color(dark, SURFACE_LINE, 0.42),
      "glass": mix_color(GLASS, light, 0.24),
      "glass_dark": mix_color(GLASS_DARK, dark, 0.22),
    }
  return cues


def building_surface_palette(
  row: Any,
  *,
  is_hero: bool,
  height_m: float,
  material_cue: MaterialCue | None = None,
) -> dict[str, tuple[int, int, int]]:
  """Return deterministic material colours from LoD2 attributes."""
  ident = row_text(row, "building_id") or row_text(row, "function") or "building"
  roof_type = row_text(row, "roof_type")
  function = row_text(row, "function")
  variant = stable_variation(f"{ident}:{roof_type}:{function}")

  if is_hero:
    wall = BUILDING_HERO
    roof = mix_color(BUILDING_HERO, MONUMENT, 0.28)
  elif height_m >= 28:
    wall = mix_color(BUILDING_WALL, GLASS, 0.24)
    roof = mix_color(BUILDING_ROOF, GLASS_DARK, 0.18)
  elif function.endswith("_2010") or function.endswith("_3010"):
    wall = mix_color(BUILDING_WALL, SURFACE_LIGHT, 0.32)
    roof = mix_color(BUILDING_ROOF, MONUMENT, 0.16)
  else:
    wall = BUILDING_WALL
    roof = BUILDING_ROOF

  if roof_type.startswith("3"):
    roof = mix_color(roof, MONUMENT, 0.18)
  elif roof_type.startswith("5"):
    roof = mix_color(roof, OUTLINE, 0.08)

  if is_hero and material_cue:
    wall = mix_color(wall, material_cue["wall"], 0.52)
    roof = mix_color(roof, material_cue["roof"], 0.42)

  wall = shift_color(wall, variant)
  roof = shift_color(roof, round(variant * 0.7))
  wall_dark = mix_color(wall, OUTLINE, 0.25)
  wall_light = mix_color(wall, (255, 250, 228), 0.25)
  roof_line = mix_color(roof, SURFACE_LINE, 0.45)
  window = mix_color(wall_light, GLASS, 0.38 if height_m >= 24 else 0.18)
  window_dark = mix_color(wall_dark, GLASS_DARK, 0.28 if height_m >= 24 else 0.12)
  if is_hero and material_cue:
    wall_dark = mix_color(wall_dark, material_cue["wall_dark"], 0.55)
    wall_light = mix_color(wall_light, material_cue["wall_light"], 0.55)
    roof_line = mix_color(roof_line, material_cue["roof_line"], 0.5)
    window = mix_color(window, material_cue["glass"], 0.55)
    window_dark = mix_color(window_dark, material_cue["glass_dark"], 0.5)
  return {
    "wall": wall,
    "wall_dark": wall_dark,
    "wall_light": wall_light,
    "roof": roof,
    "roof_line": roof_line,
    "window": window,
    "window_dark": window_dark,
  }


def poi_style(
  row: Any, line_scale: int
) -> tuple[tuple[int, int, int], int, int] | None:
  """Return tiny OSM context marker style for visible surface detail."""
  amenity = row_text(row, "amenity")
  tourism = row_text(row, "tourism")
  historic = row_text(row, "historic")
  name = row_text(row, "name")
  if amenity in {"bench", "waste_basket", "vending_machine", "bicycle_parking"}:
    return None
  if historic or tourism:
    return MONUMENT_DARK, max(2, line_scale + 1), 3
  if amenity in {"restaurant", "cafe", "bar", "embassy", "theatre", "arts_centre"}:
    return POI_MARK, max(2, line_scale + 1), 2
  if name:
    return POI_SERVICE, max(1, line_scale), 1
  return None


def park_color(row: Any) -> tuple[int, int, int]:
  """Return a subdued landcover colour from OSM semantics."""
  natural = row_text(row, "natural")
  leisure = row_text(row, "leisure")
  landuse = row_text(row, "landuse")
  if natural == "wood" or landuse == "forest":
    return PARK_DARK
  if leisure in {"garden", "playground"} or landuse == "meadow":
    return PARK_LIGHT
  return PARK


def road_style(row: Any, line_scale: int) -> tuple[tuple[int, int, int], int, int]:
  """Return colour, width, and draw order for an OSM road feature."""
  highway = row_text(row, "highway")
  if highway in MAJOR_HIGHWAYS:
    return ROAD_MAJOR, max(3, 4 * line_scale), 3
  if highway in LOCAL_HIGHWAYS:
    return ROAD, max(2, 2 * line_scale), 2
  if highway in PATH_HIGHWAYS:
    return ROAD_PATH, max(1, round(line_scale * 0.7)), 1
  return ROAD_PATH, max(1, line_scale), 0


def rail_style(
  row: Any, line_scale: int
) -> tuple[tuple[int, int, int], int, int] | None:
  """Return colour, width, and draw order for rail geometry worth drawing."""
  railway = row_text(row, "railway")
  if row_text(row, "tunnel") or row_text(row, "covered") == "yes":
    return None
  try:
    if int(row_text(row, "layer") or "0") < 0:
      return None
  except ValueError:
    pass
  if railway in RAIL_LINES:
    return RAIL, max(1, line_scale), 2
  if railway in RAIL_PLATFORMS:
    return RAIL_PLATFORM, max(1, line_scale), 1
  return None


def landmark_kind(name: str) -> str | None:
  """Map required landmark names to explicit visual accent types."""
  key = normalized_text(name)
  if "brandenburger tor" in key:
    return "gate"
  if "reichstag" in key:
    return "dome"
  if "hauptbahnhof" in key:
    return "glass_station"
  if "kulturen der welt" in key or "schwangere auster" in key:
    return "curved_roof"
  if "bundeskanzleramt" in key:
    return "chancellery"
  if "paul-lobe" in key or "marie-elisabeth-luders" in key:
    return "parliament_band"
  if "gustav-heinemann-brucke" in key:
    return "bridge"
  if "tiergartentunnel" in key:
    return "tunnel"
  return None


def landmark_icon_unit(render_px: int) -> int:
  """Return a screen-space icon unit that survives pixel-art downsampling."""
  return max(3, min(8, round(render_px / 768)))


def draw_landmark_accent(
  draw: ImageDraw.ImageDraw,
  row: Any,
  *,
  material_cue: MaterialCue | None = None,
  center_x: float,
  center_y: float,
  scale: float,
  width: int,
  height: int,
) -> None:
  if not isinstance(row.geometry, Point):
    return
  kind = landmark_kind(row_text(row, "name"))
  if kind is None:
    return
  unit = landmark_icon_unit(width)
  monument = material_cue["wall"] if material_cue else MONUMENT
  monument_dark = material_cue["wall_dark"] if material_cue else MONUMENT_DARK
  building_hero = material_cue["wall"] if material_cue else BUILDING_HERO
  glass = material_cue["glass"] if material_cue else GLASS
  glass_dark = material_cue["glass_dark"] if material_cue else GLASS_DARK
  roof_line = material_cue["roof_line"] if material_cue else SURFACE_LINE

  def point(z: float) -> tuple[int, int]:
    return project_point(
      row.geometry.x,
      row.geometry.y,
      z=z,
      center_x=center_x,
      center_y=center_y,
      scale=scale,
      width=width,
      height=height,
    )

  if kind == "gate":
    x, y = point(18)
    draw.rectangle(
      (x - 6 * unit, y - 4 * unit, x + 6 * unit, y - 2 * unit),
      fill=monument,
      outline=OUTLINE,
      width=max(1, unit // 4),
    )
    draw.rectangle(
      (x - 7 * unit, y + 3 * unit, x + 7 * unit, y + 4 * unit),
      fill=monument_dark,
    )
    for idx in range(6):
      cx = x - 5 * unit + idx * 2 * unit
      draw.rectangle(
        (cx - unit // 2, y - 2 * unit, cx + unit // 2, y + 4 * unit),
        fill=monument,
        outline=OUTLINE,
        width=max(1, unit // 5),
      )
    return

  if kind == "dome":
    x, y = point(43)
    draw.ellipse(
      (x - 4 * unit, y - 3 * unit, x + 4 * unit, y + 3 * unit),
      fill=glass,
      outline=OUTLINE,
      width=max(1, unit // 4),
    )
    draw.arc(
      (x - 5 * unit, y - 4 * unit, x + 5 * unit, y + 4 * unit),
      start=205,
      end=335,
      fill=glass_dark,
      width=max(1, unit // 3),
    )
    draw.line((x, y - 3 * unit, x, y + 3 * unit), fill=glass_dark, width=1)
    return

  if kind == "glass_station":
    x, y = point(36)
    roof = [
      (x - 9 * unit, y),
      (x - 3 * unit, y - 3 * unit),
      (x + 9 * unit, y),
      (x + 3 * unit, y + 3 * unit),
    ]
    draw.polygon(roof, fill=glass, outline=OUTLINE)
    for offset in (-5, 0, 5):
      draw.line(
        (x + offset * unit, y - 2 * unit, x + (offset + 4) * unit, y),
        fill=glass_dark,
        width=max(1, unit // 4),
      )
    return

  if kind == "curved_roof":
    x, y = point(24)
    draw.arc(
      (x - 7 * unit, y - 6 * unit, x + 7 * unit, y + 6 * unit),
      start=200,
      end=340,
      fill=monument,
      width=max(2, unit),
    )
    draw.rectangle(
      (x - 5 * unit, y, x + 5 * unit, y + 3 * unit),
      fill=building_hero,
      outline=OUTLINE,
      width=max(1, unit // 4),
    )
    return

  if kind == "chancellery":
    x, y = point(34)
    draw.rectangle(
      (x - 7 * unit, y - 2 * unit, x - 3 * unit, y + 5 * unit),
      fill=monument,
      outline=OUTLINE,
      width=max(1, unit // 4),
    )
    draw.rectangle(
      (x + 3 * unit, y - 2 * unit, x + 7 * unit, y + 5 * unit),
      fill=monument,
      outline=OUTLINE,
      width=max(1, unit // 4),
    )
    draw.rectangle(
      (x - 3 * unit, y, x + 3 * unit, y + 3 * unit),
      fill=glass,
      outline=OUTLINE,
      width=max(1, unit // 4),
    )
    return

  if kind == "parliament_band":
    x, y = point(24)
    draw.polygon(
      [
        (x - 7 * unit, y - unit),
        (x - 2 * unit, y - 3 * unit),
        (x + 7 * unit, y + unit),
        (x + 2 * unit, y + 3 * unit),
      ],
      fill=building_hero,
      outline=OUTLINE,
    )
    for offset in (-4, -1, 2, 5):
      draw.line(
        (x + offset * unit, y - 2 * unit, x + (offset + 3) * unit, y + unit),
        fill=roof_line,
        width=max(1, unit // 5),
      )
    return

  if kind == "bridge":
    x, y = point(8)
    draw.line(
      (x - 7 * unit, y - 2 * unit, x + 7 * unit, y + 2 * unit),
      fill=BRIDGE,
      width=max(2, unit // 2),
    )
    draw.line(
      (x - 7 * unit, y + unit, x + 7 * unit, y + 5 * unit),
      fill=OUTLINE,
      width=max(1, unit // 4),
    )
    return

  if kind == "tunnel":
    x, y = point(6)
    portal = max(2, unit // 2)
    draw.ellipse(
      (x - 5 * portal, y - 4 * portal, x + 5 * portal, y + 4 * portal),
      fill=TUNNEL,
      outline=ROAD_MAJOR,
      width=max(1, portal // 2),
    )
    draw.rectangle((x - 5 * portal, y, x + 5 * portal, y + 4 * portal), fill=TUNNEL)


def lerp_point(
  a: tuple[int, int], b: tuple[int, int], amount: float
) -> tuple[int, int]:
  return (
    int(round(a[0] * (1.0 - amount) + b[0] * amount)),
    int(round(a[1] * (1.0 - amount) + b[1] * amount)),
  )


def line_length(a: tuple[int, int], b: tuple[int, int]) -> float:
  return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5


def architectural_shadow_offsets(
  *, height_m: float, is_hero: bool, outline_width: int
) -> tuple[int, int, int]:
  """Return contact/mid/soft shadow offsets for an extruded building."""
  unit = max(1, outline_width)
  contact_steps = max(2, min(8, round(height_m / 13)))
  mid_steps = max(contact_steps + 1, min(16, round(height_m / 6)))
  soft_steps = max(mid_steps + 1, min(24, round(height_m / 4)))
  contact = contact_steps * unit
  mid = mid_steps * unit
  soft = soft_steps * unit
  if is_hero:
    soft += unit * 2
  return contact, mid, soft


def roof_grid_count(*, roof_span: float, is_hero: bool) -> int:
  """Return a bounded roof-rib count from projected roof span."""
  if roof_span < 34:
    return 0
  limit = 7 if is_hero else 4
  return max(1, min(limit, int(roof_span // 34)))


def facade_detail_counts(
  *, wall_width: float, height_m: float, is_hero: bool
) -> tuple[int, int, int, int]:
  """Return floor/mullion/window detail counts for one projected facade."""
  floors = max(1, min(14 if is_hero else 10, int(height_m // 3.0)))
  if is_hero:
    mullion_spacing = 12
  elif height_m >= 24:
    mullion_spacing = 16
  else:
    mullion_spacing = 22
  mullions = max(0, min(12 if is_hero else 8, int(wall_width // mullion_spacing)))
  window_rows = max(0, min(floors, 10 if is_hero else 6))
  window_cols = max(0, min(max(1, mullions), 9 if is_hero else 6))
  if wall_width < 20:
    window_cols = 0
  return floors, mullions, window_rows, window_cols


def wall_point(
  wall: list[tuple[int, int]], *, across: float, up: float
) -> tuple[int, int]:
  base_a, base_b, roof_b, roof_a = wall
  lower = lerp_point(base_a, base_b, across)
  upper = lerp_point(roof_a, roof_b, across)
  return lerp_point(lower, upper, up)


def draw_wall_panel(
  draw: ImageDraw.ImageDraw,
  wall: list[tuple[int, int]],
  *,
  left: float,
  right: float,
  bottom: float,
  top: float,
  fill: tuple[int, int, int],
  outline: tuple[int, int, int] | None,
  width: int,
) -> None:
  panel = [
    wall_point(wall, across=left, up=bottom),
    wall_point(wall, across=right, up=bottom),
    wall_point(wall, across=right, up=top),
    wall_point(wall, across=left, up=top),
  ]
  draw.polygon(panel, fill=fill)
  if outline is not None:
    draw.line(panel + [panel[0]], fill=outline, width=max(1, width))


def draw_wall_detail(
  draw: ImageDraw.ImageDraw,
  wall: list[tuple[int, int]],
  *,
  palette: dict[str, tuple[int, int, int]],
  height_m: float,
  is_hero: bool,
  outline_width: int,
) -> None:
  base_a, base_b, roof_b, roof_a = wall
  wall_width = line_length(base_a, base_b)
  if wall_width < 12:
    return
  floors, mullions, window_rows, window_cols = facade_detail_counts(
    wall_width=wall_width,
    height_m=height_m,
    is_hero=is_hero,
  )
  detail_width = max(1, outline_width)
  cornice = mix_color(palette["wall_light"], palette["roof_line"], 0.35)
  sill = mix_color(palette["wall_dark"], OUTLINE, 0.18)
  draw.line((base_a, base_b), fill=sill, width=max(1, outline_width + 1))
  draw.line((roof_a, roof_b), fill=cornice, width=detail_width)
  for floor in range(1, floors + 1):
    amount = floor / (floors + 1)
    draw.line(
      (
        lerp_point(base_a, roof_a, amount),
        lerp_point(base_b, roof_b, amount),
      ),
      fill=palette["wall_dark"],
      width=detail_width,
    )
    if is_hero and floor % 3 == 0:
      draw.line(
        (
          lerp_point(base_a, roof_a, amount + 0.01),
          lerp_point(base_b, roof_b, amount + 0.01),
        ),
        fill=palette["wall_light"],
        width=detail_width,
      )
  for mullion in range(1, mullions + 1):
    amount = mullion / (mullions + 1)
    lower = lerp_point(base_a, base_b, amount)
    upper = lerp_point(roof_a, roof_b, amount)
    draw.line(
      (lerp_point(lower, upper, 0.15), lerp_point(lower, upper, 0.82)),
      fill=palette["wall_light"],
      width=detail_width,
    )
  for row_idx in range(window_rows):
    middle = (row_idx + 1) / (window_rows + 1)
    panel_height = 0.18 / max(1, window_rows)
    bottom = max(0.1, middle - panel_height)
    top = min(0.86, middle + panel_height)
    for col_idx in range(window_cols):
      left = (col_idx + 0.18) / max(1, window_cols)
      right = min(left + 0.44 / max(1, window_cols), 0.94)
      if right <= left:
        continue
      color = palette["window" if (row_idx + col_idx) % 3 else "window_dark"]
      draw_wall_panel(
        draw,
        wall,
        left=left,
        right=right,
        bottom=bottom,
        top=top,
        fill=color,
        outline=mix_color(color, OUTLINE, 0.18),
        width=detail_width,
      )


def draw_roof_detail(
  draw: ImageDraw.ImageDraw,
  roof: list[tuple[int, int]],
  *,
  palette: dict[str, tuple[int, int, int]],
  roof_type: str,
  is_hero: bool,
  outline_width: int,
) -> None:
  unique = roof[:-1] if len(roof) > 1 and roof[0] == roof[-1] else roof
  if len(unique) < 3:
    return
  center = (
    int(round(sum(x for x, _ in unique) / len(unique))),
    int(round(sum(y for _, y in unique) / len(unique))),
  )
  inset = [lerp_point(point, center, 0.18) for point in unique]
  detail_width = max(1, outline_width)
  draw.line(inset + [inset[0]], fill=palette["roof_line"], width=detail_width)
  draw.line(
    (unique[0], unique[1]),
    fill=mix_color(palette["roof"], palette["wall_light"], 0.45),
    width=max(1, outline_width + 1),
  )
  if is_hero:
    inner = [lerp_point(point, center, 0.36) for point in unique]
    draw.line(inner + [inner[0]], fill=palette["roof_line"], width=detail_width)
  if len(unique) >= 4 and (is_hero or roof_type.startswith("3")):
    draw.line(
      (lerp_point(unique[0], unique[1], 0.5), lerp_point(unique[2], unique[3], 0.5)),
      fill=palette["roof_line"],
      width=max(1, outline_width + 1),
    )
  if len(unique) >= 4:
    span_a = line_length(unique[0], unique[1])
    span_b = line_length(unique[1], unique[2])
    ribs = roof_grid_count(roof_span=max(span_a, span_b), is_hero=is_hero)
    rib_color = mix_color(palette["roof_line"], palette["roof"], 0.25)
    for rib in range(1, ribs + 1):
      amount = rib / (ribs + 1)
      if span_a >= 34:
        draw.line(
          (
            lerp_point(unique[0], unique[1], amount),
            lerp_point(unique[3], unique[2], amount),
          ),
          fill=rib_color,
          width=detail_width,
        )
      if is_hero and span_b >= 34:
        draw.line(
          (
            lerp_point(unique[0], unique[3], amount),
            lerp_point(unique[1], unique[2], amount),
          ),
          fill=rib_color,
          width=detail_width,
        )
  if is_hero or roof_type.startswith("5"):
    for idx in range(0, len(unique), 2):
      draw.line(
        (lerp_point(unique[idx], center, 0.28), center),
        fill=palette["roof_line"],
        width=detail_width,
      )


def draw_architectural_shadow(
  draw: ImageDraw.ImageDraw,
  base: list[tuple[int, int]],
  *,
  height_m: float,
  is_hero: bool,
  outline_width: int,
) -> None:
  contact, mid, soft = architectural_shadow_offsets(
    height_m=height_m,
    is_hero=is_hero,
    outline_width=outline_width,
  )
  shadow_layers = (
    (soft, max(1, soft // 2), BUILDING_SHADOW_SOFT),
    (mid, max(1, mid // 2), mix_color(BUILDING_SHADOW_SOFT, BUILDING_SHADOW, 0.52)),
    (contact, contact, BUILDING_SHADOW),
  )
  for offset_x, offset_y, color in shadow_layers:
    draw.polygon([(x + offset_x, y + offset_y) for x, y in base], fill=color)


def draw_poi_marker(
  draw: ImageDraw.ImageDraw,
  row: Any,
  *,
  color: tuple[int, int, int],
  size: int,
  center_x: float,
  center_y: float,
  scale: float,
  width: int,
  height: int,
) -> None:
  geometry = row.geometry
  if geometry is None or geometry.is_empty:
    return
  point = geometry if isinstance(geometry, Point) else geometry.representative_point()
  px, py = project_point(
    point.x,
    point.y,
    z=1,
    center_x=center_x,
    center_y=center_y,
    scale=scale,
    width=width,
    height=height,
  )
  radius = max(1, size)
  draw.rectangle(
    (px - radius, py - radius, px + radius, py + radius),
    fill=color,
    outline=OUTLINE,
  )


def draw_building(
  draw: ImageDraw.ImageDraw,
  polygon: Polygon,
  *,
  height_m: float,
  is_hero: bool,
  surface_row: Any | None = None,
  material_cue: MaterialCue | None = None,
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
  surface = surface_row if surface_row is not None else {}
  palette = building_surface_palette(
    surface,
    is_hero=is_hero,
    height_m=height_m,
    material_cue=material_cue,
  )
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
  draw_architectural_shadow(
    draw,
    base,
    height_m=height_m,
    is_hero=is_hero,
    outline_width=outline_width,
  )
  for idx in range(len(coords) - 1):
    wall = [base[idx], base[idx + 1], roof[idx + 1], roof[idx]]
    if idx % 3 == 0:
      color = palette["wall_light"]
    elif idx % 2 == 0:
      color = palette["wall"]
    else:
      color = palette["wall_dark"]
    draw.polygon(wall, fill=color)
    draw_wall_detail(
      draw,
      wall,
      palette=palette,
      height_m=height_m,
      is_hero=is_hero,
      outline_width=outline_width,
    )
    draw.line(wall + [wall[0]], fill=OUTLINE, width=outline_width)
  draw.polygon(roof, fill=palette["roof"])
  draw_roof_detail(
    draw,
    roof,
    palette=palette,
    roof_type=row_text(surface, "roof_type"),
    is_hero=is_hero,
    outline_width=outline_width,
  )
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


def nearest_landmark_reference_id(
  geometry: Any, landmarks: gpd.GeoDataFrame, *, max_distance_m: float = 90.0
) -> str | None:
  """Return the nearest visual-reference id for a hero building."""
  if geometry is None or getattr(geometry, "is_empty", True) or landmarks.empty:
    return None
  point = geometry.representative_point()
  distances = landmarks.geometry.distance(point)
  if distances.empty:
    return None
  nearest_index = distances.idxmin()
  if float(distances.loc[nearest_index]) > max_distance_m:
    return None
  return landmark_reference_id(row_text(landmarks.loc[nearest_index], "name"))


def render_quadrant(
  *,
  quad: dict[str, Any],
  buildings: gpd.GeoDataFrame,
  osm_layers: dict[str, gpd.GeoDataFrame],
  landmarks: gpd.GeoDataFrame,
  material_cues: dict[str, MaterialCue],
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
      color=park_color(row),
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
  road_features = []
  for _, row in query(osm_layers["roads"], q_bounds).iterrows():
    if not lines(row.geometry):
      continue
    color, line_width, order = road_style(row, line_scale)
    road_features.append((order, line_width, color, row.geometry))
  for order, line_width, color, geometry in sorted(
    road_features, key=lambda item: item[0]
  ):
    draw_geom_line(
      draw,
      geometry,
      color=color,
      line_width=line_width,
      casing_color=ROAD_EDGE if order >= 2 else None,
      casing_extra=max(1, line_scale) if order >= 2 else 0,
      center_x=center_x,
      center_y=center_y,
      scale=scale,
      width=render_px,
      height=render_px,
    )
  rail_features = []
  for _, row in query(osm_layers["rail"], q_bounds).iterrows():
    if not lines(row.geometry):
      continue
    style = rail_style(row, line_scale)
    if style is None:
      continue
    color, line_width, order = style
    rail_features.append((order, line_width, color, row.geometry))
  for _, line_width, color, geometry in sorted(rail_features, key=lambda item: item[0]):
    draw_geom_line(
      draw,
      geometry,
      color=color,
      line_width=line_width,
      center_x=center_x,
      center_y=center_y,
      scale=scale,
      width=render_px,
      height=render_px,
    )

  poi_features = []
  for _, row in query(osm_layers["pois"], q_bounds).iterrows():
    style = poi_style(row, line_scale)
    if style is None:
      continue
    color, size, order = style
    poi_features.append((order, color, size, row))
  for _, color, size, row in sorted(poi_features, key=lambda item: item[0]):
    draw_poi_marker(
      draw,
      row,
      color=color,
      size=size,
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
      - selected_buildings.geometry.centroid.y
    ).sort_values("_sort")
  for _, row in selected_buildings.iterrows():
    is_hero = bool(hero_zone is not None and row.geometry.intersects(hero_zone))
    reference_id = (
      nearest_landmark_reference_id(row.geometry, near_landmarks) if is_hero else None
    )
    material_cue = material_cues.get(reference_id or "")
    for poly in polygons(row.geometry):
      draw_building(
        draw,
        poly,
        height_m=building_height(row, is_hero=is_hero),
        is_hero=is_hero,
        surface_row=row,
        material_cue=material_cue,
        center_x=center_x,
        center_y=center_y,
        scale=scale,
        width=render_px,
        height=render_px,
        outline_width=line_scale,
      )

  for _, row in near_landmarks.iterrows():
    reference_id = landmark_reference_id(row_text(row, "name"))
    draw_landmark_accent(
      draw,
      row,
      material_cue=material_cues.get(reference_id or ""),
      center_x=center_x,
      center_y=center_y,
      scale=scale,
      width=render_px,
      height=render_px,
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
  material_cues: dict[str, MaterialCue],
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
        material_cues=material_cues,
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
  parser.add_argument(
    "--wikimedia-references",
    type=Path,
    default=Path("geo_data/regierungsviertel/wikimedia_references.json"),
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
  material_cues = load_wikimedia_material_cues(args.wikimedia_references)
  count = update_render(
    db_path,
    buildings=buildings,
    osm_layers=osm_layers,
    landmarks=landmarks,
    material_cues=material_cues,
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
