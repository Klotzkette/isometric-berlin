"""Step 10: bounded offline street and building outlines around the retained city.

Every source is clipped to the owner-approved extension minus the immutable
v1.0.58 core.  Small, independently loadable 512 m chunks contain indexed
centimetre geometry, never textures or live map requests.  This deliberately
rudimentary outer layer is independent of the complete detailed inner city.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
import subprocess
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

import geopandas as gpd
import numpy as np
import shapely
from pyproj import Transformer
from shapely.affinity import affine_transform
from shapely.errors import GEOSException
from shapely.geometry import LineString, Polygon, box, shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import transform, unary_union

from isometric_berlin.data.fetch_lod2 import (
  GML_ID,
  NS,
  building_footprint,
  polygons_from_geometry,
)
from isometric_berlin.data.fetch_osm import parse_hstore
from isometric_berlin.data.fetch_osm_context_buildings import (
  parse_length_m,
  resolve_height,
  text_value,
)
from isometric_berlin.generation.road_geometry import (
  ROAD_WIDTHS_M,
  VEHICULAR_HIGHWAYS,
  road_width_m,
  road_width_source,
)

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "geo_data/regierungsviertel/raw/outer-v159"
DEFAULT_OUTPUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
ORIGIN = (389500.0, 5820000.0)
CHUNK_SIZE = 512
GROUND_Y = 3.0
WATER_Y = -1.15
POSITION_ORIGIN_Y = -10.0
SOURCE_URL = "https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf"
COLORS = {
  "ground": (186, 190, 170),
  "park": (124, 160, 105),
  "water": (105, 148, 157),
  "road": (109, 112, 109),
  "path": (201, 190, 162),
  "rail": (112, 100, 87),
  "building": (211, 208, 195),
  "roof": (157, 151, 140),
  "ink": (80, 80, 74),
  "kerb": (211, 210, 195),
}


def load_projected_polygon(path: Path) -> BaseGeometry:
  """Read CRS84 bounds or an explicit EPSG:25833 polygon fixture."""
  payload = json.loads(path.read_text())
  if payload.get("type") == "FeatureCollection":
    payload = payload["features"][0]
  geometry = shape(payload.get("geometry", payload))
  if geometry.bounds[0] < 1000:
    geometry = transform(
      Transformer.from_crs(4326, 25833, always_xy=True).transform, geometry
    )
  return shapely.make_valid(geometry)


def world(geometry: BaseGeometry) -> BaseGeometry:
  """Keep the established metre coordinate frame without another map origin."""
  return affine_transform(geometry, [1, 0, 0, -1, -ORIGIN[0], ORIGIN[1]])


def line_parts(geometry: BaseGeometry) -> list[LineString]:
  """Extract lines from mixed results of source-boundary intersections."""
  if geometry.is_empty:
    return []
  if geometry.geom_type in {"LineString", "LinearRing"}:
    return [LineString(geometry.coords)]
  return [p for child in getattr(geometry, "geoms", []) for p in line_parts(child)]


def polygonal(geometry: BaseGeometry) -> BaseGeometry:
  """Discard zero-area seam lines, never any source surface polygon."""
  return unary_union(list(polygons_from_geometry(geometry)))


def native_polygon(geometry: BaseGeometry) -> BaseGeometry:
  """A separate block-native reading on a two-metre grid, with open courts."""
  cells: list[Polygon] = []
  if geometry.is_empty:
    return geometry
  # Runs of occupied cells are merged before triangulation; there is no hidden
  # stack of solid cubes and no runtime voxelization on a telephone.
  minx, minz, maxx, maxz = geometry.bounds
  xs = np.arange(math.floor(minx / 2) * 2 + 1, maxx, 2)
  for z in np.arange(math.floor(minz / 2) * 2 + 1, maxz, 2):
    occupied = shapely.contains_xy(geometry, xs, np.full(len(xs), z))
    padded = np.concatenate(([False], occupied, [False]))
    edges = np.flatnonzero(padded[1:] != padded[:-1])
    for start, end in zip(edges[::2], edges[1::2]):
      cells.append(box(xs[start] - 1, z - 1, xs[end - 1] + 1, z + 1))
  return unary_union(cells)


class PackedMesh:
  """Deduplicate integer positions and colour exactly, preserving every face."""

  def __init__(self, origin_x: float, origin_z: float) -> None:
    self.origin_x = origin_x
    self.origin_z = origin_z
    self.vertices: dict[tuple[int, ...], int] = {}
    self.indices: list[int] = []

  def vertex(self, point: tuple[float, float, float], color: tuple[int, ...]) -> int:
    """Quantize once to the declared centimetre display precision."""
    x, y, z = point
    position = (
      round((x - self.origin_x) * 100),
      round((y - POSITION_ORIGIN_Y) * 100),
      round((z - self.origin_z) * 100),
    )
    if min(position) < 0 or max(position) > 65535:
      raise ValueError(f"Chunk position outside UInt16 range: {position}")
    key = (*position, *color)
    if key not in self.vertices:
      self.vertices[key] = len(self.vertices)
    return self.vertices[key]

  def triangle(
    self, points: list[tuple[float, float, float]], color: tuple[int, ...]
  ) -> None:
    """Keep a triangle unless centimetre rounding makes it degenerate."""
    ids = [self.vertex(p, color) for p in points]
    if len(set(ids)) == 3:
      self.indices.extend(ids)

  def surface(self, geometry: BaseGeometry, y: float, color: tuple[int, ...]) -> None:
    """Triangulate polygons with every mapped courtyard and island hole intact."""
    for polygon in polygons_from_geometry(geometry):
      try:
        triangles = shapely.constrained_delaunay_triangles(polygon)
      except GEOSException:
        # Three's independent Earcut handles rare GEOS convex-corner failures
        # without deleting source edges or filling a courtyard.
        triangles = earcut_fallback(polygon)
      for triangle in getattr(triangles, "geoms", triangles):
        points = [(x, y, z) for x, z in list(triangle.exterior.coords)[:3]]
        # X/Z winding must face upward in the established Three.js frame.
        a, b, c = points
        if (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]) > 0:
          points.reverse()
        self.triangle(points, color)

  def building(
    self,
    geometry: BaseGeometry,
    low: float,
    high: float,
    wall_outline: BaseGeometry | None = None,
  ) -> None:
    """Extrude the mapped perimeter; unknown facade and roof detail stays absent."""
    self.surface(geometry, high, COLORS["roof"])
    if wall_outline is None:
      wall_outline = shapely.orient_polygons(geometry, exterior_cw=True).boundary
    for line in line_parts(wall_outline):
      for (ax, az), (bx, bz) in zip(line.coords, list(line.coords)[1:]):
        a, b, c, d = (ax, low, az), (bx, low, bz), (bx, high, bz), (ax, high, az)
        self.triangle([a, b, c], COLORS["building"])
        self.triangle([a, c, d], COLORS["building"])

  def payload(self, kind: str) -> dict[str, Any] | None:
    """Serialize little-endian typed arrays without verbose numerical JSON."""
    if not self.indices:
      return None
    values = np.array(list(self.vertices), dtype=np.uint16)
    return {
      "kind": kind,
      "positionType": "u16cm",
      "positions": encode(values[:, :3].astype("<u2")),
      "colors": encode(linear_rgb_bytes(values[:, 3:])),
      "indices": encode(np.array(self.indices, dtype="<u4")),
    }


def encode(array: np.ndarray) -> str:
  """Encode a contiguous typed-array view in the portable JSON envelope."""
  return base64.b64encode(array.tobytes()).decode("ascii")


def earcut_fallback(polygon: Polygon) -> list[Polygon]:
  """Use installed Three's independent triangulator, verifying coverage area."""
  rings = [
    list(polygon.exterior.coords)[:-1],
    *[list(r.coords)[:-1] for r in polygon.interiors],
  ]
  code = """
import { ShapeUtils, Vector2 } from 'three';
const rings = JSON.parse(await Bun.stdin.text());
const points = rings.map(r => r.map(([x,y]) => new Vector2(x,y)));
const triangles = ShapeUtils.triangulateShape(points[0], points.slice(1));
process.stdout.write(JSON.stringify(triangles));
"""
  result = subprocess.run(
    ["bun", "-e", code],
    input=json.dumps(rings),
    text=True,
    cwd=ROOT / "src/app",
    check=True,
    capture_output=True,
  )
  points = [p for ring in rings for p in ring]
  triangles = [
    Polygon([points[i] for i in triangle]) for triangle in json.loads(result.stdout)
  ]
  coverage = unary_union(triangles)
  if coverage.symmetric_difference(polygon).area > max(0.0001, polygon.area * 1e-8):
    raise ValueError("Independent triangulation did not preserve the source polygon")
  return triangles


def linear_rgb_bytes(srgb: np.ndarray) -> np.ndarray:
  """Three vertex colours are linear, while the documented swatches are sRGB."""
  normalized = srgb.astype(np.float64) / 255
  linear = np.where(
    normalized <= 0.04045,
    normalized / 12.92,
    ((normalized + 0.055) / 1.055) ** 2.4,
  )
  return np.round(linear * 255).astype("u1")


def navigation_polygons(
  geometry: BaseGeometry, origin_x: float, origin_z: float
) -> list[dict[str, Any]]:
  """Retain per-chunk source holes for walking, rather than bounding-box blocks."""

  def ring(points: Any) -> list[list[float]]:
    return [[round(x - origin_x, 2), round(z - origin_z, 2)] for x, z in points]

  return [
    {
      "ring": ring(p.exterior.coords),
      "holes": [ring(r.coords) for r in p.interiors],
    }
    for p in polygons_from_geometry(geometry)
  ]


def tags_for(row: Any) -> dict[str, Any]:
  """Promoted GDAL fields retain priority over its hstore remainder."""
  return {
    **parse_hstore(row.get("other_tags")),
    **{k: v for k, v in row.items() if isinstance(v, str) and k != "other_tags"},
  }


def source_identity(row: Any) -> str:
  """Preserve native OSM element identity for every published outline."""
  way_id = text_value(row.get("osm_way_id"))
  return f"OSM-way-{way_id}" if way_id else f"OSM-relation-{row['osm_id']}"


def read_source_frames(pbf: Path, bounds: BaseGeometry) -> tuple[Any, Any]:
  """Cache two bounded GDAL layers; no online services run in the viewer."""
  cache = pbf.with_name("candidate.gpkg")
  geographic = transform(
    Transformer.from_crs(25833, 4326, always_xy=True).transform, bounds
  )
  result = []
  for layer in ("lines", "multipolygons"):
    if cache.exists():
      frame = gpd.read_file(cache, layer=layer, bbox=geographic.bounds)
    else:
      frame = gpd.read_file(pbf, layer=layer, bbox=geographic.bounds, engine="pyogrio")
    projected = frame.to_crs(25833)
    result.append(projected[projected.geometry.intersects(bounds)].copy())
  return tuple(result)


def official_buildings(
  archives: list[Path], scope: BaseGeometry
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
  """Use available authoritative parent footprints and total source envelopes."""
  fingerprint = hashlib.sha256(scope.wkb)
  for archive in sorted(archives):
    fingerprint.update(archive.name.encode())
    fingerprint.update(hashlib.sha256(archive.read_bytes()).digest())
  cache_key = fingerprint.hexdigest()
  cache = RAW / "official-outlines.gpkg"
  cache_metadata = RAW / "official-outlines-sources.json"
  if cache.is_file() and cache_metadata.is_file():
    metadata = json.loads(cache_metadata.read_text())
    if metadata.get("cacheKey") == cache_key:
      return gpd.read_file(cache, layer="buildings").to_dict("records"), metadata[
        "sources"
      ]
  records, sources = [], []
  seen: set[str] = set()
  for archive in sorted(archives):
    tile = archive.stem.removeprefix("LoD2_")
    tx, tz = map(int, tile.split("_"))
    if not scope.intersects(
      box(tx * 1000, tz * 1000, (tx + 1) * 1000, (tz + 1) * 1000)
    ):
      continue
    kept = 0
    with zipfile.ZipFile(archive) as zipped:
      for member in zipped.namelist():
        if not member.endswith((".gml", ".xml")):
          continue
        with zipped.open(member) as stream:
          for _, element in ET.iterparse(stream, events=("end",)):
            if element.tag != f"{{{NS['bldg']}}}Building":
              continue
            identity = element.attrib.get(GML_ID, "")
            footprint = building_footprint(element)
            if identity in seen or footprint is None or not footprint.intersects(scope):
              element.clear()
              continue
            footprint = footprint.intersection(scope)
            heights = []
            for poslist in element.findall(".//gml:posList", NS):
              stride = int(poslist.attrib.get("srsDimension", "3"))
              values = [float(v) for v in (poslist.text or "").split()]
              if stride == 3:
                heights.extend(values[2::3])
            if not heights or footprint.area < 0.1:
              element.clear()
              continue
            height = max(1.0, min(400.0, max(heights) - min(heights)))
            records.append(
              {
                "sourceId": identity,
                "geometry": footprint,
                "height": round(height, 2),
                "minHeight": 0.0,
                "heightSource": "Berlin LoD2 parent vertical envelope",
                "sourceGroundY": round(min(heights) - 30, 2),
              }
            )
            kept += 1
            seen.add(identity)
            element.clear()
    sources.append(
      {
        "tile": tile,
        "url": f"https://gdi.berlin.de/data/a_lod2/atom/{archive.name}",
        "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
        "buildings": kept,
      }
    )
    print(f"Official {tile}: {kept} outer buildings", flush=True)
  if records:
    gpd.GeoDataFrame(records, crs=25833).to_file(
      cache, layer="buildings", driver="GPKG"
    )
    write_json(cache_metadata, {"cacheKey": cache_key, "sources": sources})
  return records, sources


def collect_sources(
  lines: gpd.GeoDataFrame,
  areas: gpd.GeoDataFrame,
  scope: BaseGeometry,
  official: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, list[BaseGeometry]], dict[str, Any]]:
  """Keep exact source course; widths, untagged heights and outer terrain are labelled."""
  buildings = list(official)
  surfaces: dict[str, list[BaseGeometry]] = defaultdict(list)
  heights: Counter[str] = Counter()
  widths: Counter[str] = Counter()
  names: dict[str, list[str]] = defaultdict(list)
  road_records = []
  official_geometries = [b["geometry"] for b in official]
  official_tree = shapely.STRtree(official_geometries)
  for _, row in areas.iterrows():
    tags = tags_for(row)
    geometry = shapely.make_valid(row.geometry).intersection(scope)
    if geometry.is_empty:
      continue
    kind = tags.get("building") or tags.get("building:part")
    if kind and kind not in {"no", "0", "false"}:
      # Official footprints retain exact priority; OSM adds only uncovered area.
      nearby = official_tree.query(geometry, predicate="intersects")
      if len(nearby):
        owned = unary_union([official_geometries[int(i)] for i in nearby])
        # Apply the same source-precedence rule as the retained OSM fallback:
        # tiny cadastral/OSM registration slivers are not additional houses.
        if owned.covers(geometry.representative_point()):
          continue
        geometry = geometry.difference(owned)
      if geometry.area < 1:
        continue
      height, evidence = resolve_height(
        height=tags.get("height"),
        building_levels=tags.get("building:levels"),
        roof_levels=tags.get("roof:levels"),
        building_class=kind,
      )
      base = parse_length_m(tags.get("min_height")) or 0
      buildings.append(
        {
          "sourceId": source_identity(row),
          "geometry": geometry,
          "height": round(height, 2),
          "minHeight": round(base, 2),
          "heightSource": evidence,
        }
      )
      heights[evidence] += 1
    elif tags.get("natural") == "water" or tags.get("water") in {
      "river",
      "canal",
      "lake",
      "pond",
      "basin",
      "reservoir",
    }:
      surfaces["water"].append(geometry)
    elif tags.get("leisure") in {"park", "garden", "recreation_ground"} or tags.get(
      "landuse"
    ) in {"grass", "forest", "meadow", "recreation_ground", "allotments", "cemetery"}:
      surfaces["park"].append(geometry)
  for _, row in lines.iterrows():
    tags = tags_for(row)
    highway = tags.get("highway")
    if tags.get("tunnel", "no") not in {"no", "false", "0"}:
      continue
    try:
      layer = float(tags.get("layer", 0))
    except ValueError:
      layer = 0
    if layer < 0:
      continue
    railway = tags.get("railway")
    if highway not in ROAD_WIDTHS_M and railway not in {"rail", "tram", "light_rail"}:
      continue
    width = road_width_m(tags) if highway else 1.6
    if width is None:
      continue
    kind = "road" if highway in VEHICULAR_HIGHWAYS else "path" if highway else "rail"
    # Keep all original OSM line vertices. Round joins avoid raster stair steps.
    geometry = row.geometry.buffer(
      width / 2, cap_style="round", join_style="round", quad_segs=3
    )
    clipped = geometry.intersection(scope)
    if clipped.is_empty:
      continue
    surfaces[kind].append(clipped)
    if tags.get("bridge", "no") not in {"no", "false", "0"}:
      surfaces["bridge"].append(clipped)
    if highway:
      evidence = road_width_source(tags)
      widths[evidence] += 1
      name = tags.get("name", "")
      if name:
        names[name].append(text_value(row.get("osm_id")))
      road_records.append(
        {
          "sourceId": f"OSM-way-{row['osm_id']}",
          "name": name,
          "highway": highway,
          "width": width,
          "widthSource": evidence,
          "bridge": tags.get("bridge", "no"),
          "layer": layer,
        }
      )
  return (
    buildings,
    surfaces,
    {
      "heightEvidence": dict(heights),
      "roadWidthEvidence": dict(widths),
      "namedStreets": dict(sorted(names.items())),
      "roadSources": road_records,
    },
  )


def chunk_payload(
  chunk_id: str,
  tile: Polygon,
  ground: BaseGeometry,
  buildings: list[dict[str, Any]],
  surfaces: dict[str, BaseGeometry],
  *,
  minecraft: bool,
  replaced_source_ids: frozenset[str] = frozenset(),
) -> dict[str, Any]:
  """Produce a chunk; exact named refinements may provide their own shell/nav.

  Replacements never alter the source records, terrain, roads or other buildings.
  The refining offline exporter must append the complete replacement and its
  navigation before publishing. Default exports remain byte-identical.
  """
  minx, minz, _, _ = tile.bounds
  mesh = PackedMesh(minx, minz)
  nav_buildings = []
  ink: list[tuple[float, float, float]] = []
  ink_colors: list[tuple[int, ...]] = []
  display_surfaces = {}
  for kind in ("park", "water", "road", "path", "rail", "bridge"):
    geometry = polygonal(surfaces.get(kind, Polygon()).intersection(tile))
    if minecraft and not geometry.is_empty:
      geometry = native_polygon(geometry).intersection(ground)
    display_surfaces[kind] = geometry
  display_water = display_surfaces["water"]
  # Partition the visible surfaces instead of retaining nearly coplanar plates
  # under each other. Their centimetre offsets otherwise lose depth precision
  # in a far isometric view. Source/navigation footprints remain unchanged.
  visible_surfaces = {}
  occupied = display_water
  for kind in ("rail", "path", "road", "park"):
    higher = unary_union(list(visible_surfaces.values()))
    visible_surfaces[kind] = display_surfaces[kind].difference(higher)
    occupied = occupied.union(display_surfaces[kind])
  # Water is four metres below the land/bridge plates and remains visible from
  # a low bank view beneath mapped bridges; it is not a near-coplanar layer.
  visible_surfaces["water"] = display_water
  mesh.surface(ground.difference(occupied), GROUND_Y, COLORS["ground"])
  # Water shares the retained city's water datum. Only real shores receive a
  # simple display bank; chunk/core cuts never become invented river walls.
  bank = (
    display_water.boundary.difference(tile.boundary.buffer(0.02)).difference(
      ground.boundary.buffer(0.02)
    )
    if not display_water.is_empty
    else LineString()
  )
  for line in line_parts(bank):
    for (ax, az), (bx, bz) in zip(line.coords, list(line.coords)[1:]):
      a, b, c, d = (
        (ax, WATER_Y, az),
        (bx, WATER_Y, bz),
        (bx, GROUND_Y, bz),
        (ax, GROUND_Y, az),
      )
      mesh.triangle([a, b, c], COLORS["ground"])
      mesh.triangle([a, c, d], COLORS["ground"])
  for kind in ("park", "water", "road", "path", "rail"):
    geometry = visible_surfaces[kind]
    level = {"park": 0.01, "water": 0.03, "road": 0.09, "path": 0.12, "rail": 0.15}[
      kind
    ]
    mesh.surface(
      geometry, WATER_Y if kind == "water" else GROUND_Y + level, COLORS[kind]
    )
  for record in buildings:
    if record["sourceId"] in replaced_source_ids:
      continue
    geometry = polygonal(record["geometry"].intersection(tile))
    if minecraft:
      geometry = native_polygon(geometry).intersection(ground)
    if geometry.is_empty:
      continue
    height = record["height"]
    low = GROUND_Y + record["minHeight"]
    high = GROUND_Y + max(height, record["minHeight"] + 1)
    if minecraft:
      high = GROUND_Y + max(2, round((high - GROUND_Y) / 2) * 2)
    source_outline = (
      shapely.orient_polygons(geometry, exterior_cw=True).boundary
      if minecraft
      else shapely.orient_polygons(
        record["geometry"], exterior_cw=True
      ).boundary.intersection(tile)
    )
    mesh.building(geometry, low, high, source_outline)
    nav_buildings.extend(
      {
        **polygon,
        "height": round(high - GROUND_Y, 2),
        "minHeight": round(low - GROUND_Y, 2),
        "sourceId": record["sourceId"],
        "heightSource": record["heightSource"],
        **({"partId": record["partId"]} if record.get("partId") else {}),
      }
      for polygon in navigation_polygons(geometry, minx, minz)
    )
    # A tile cut must not invent a dark seam across a source roof.
    edges = geometry.boundary.difference(tile.boundary.buffer(0.02))
    for line in () if minecraft else line_parts(edges):
      for a, b in zip(line.coords, list(line.coords)[1:]):
        ink.extend(((a[0], high + 0.02, a[1]), (b[0], high + 0.02, b[1])))
        ink_colors.extend((COLORS["ink"], COLORS["ink"]))
  road_geometry = display_surfaces["road"]
  kerbs = (
    road_geometry.boundary.difference(tile.boundary.buffer(0.02))
    if not road_geometry.is_empty
    else LineString()
  )
  for line in () if minecraft else line_parts(kerbs):
    for a, b in zip(line.coords, list(line.coords)[1:]):
      ink.extend(((a[0], GROUND_Y + 0.13, a[1]), (b[0], GROUND_Y + 0.13, b[1])))
      ink_colors.extend((COLORS["kerb"], COLORS["kerb"]))
  line_positions = np.array(
    [
      [
        round((x - minx) * 100),
        round((y - POSITION_ORIGIN_Y) * 100),
        round((z - minz) * 100),
      ]
      for x, y, z in ink
    ],
    dtype="<u2",
  )
  payload = {
    "schemaVersion": 1,
    "id": chunk_id,
    "origin": [minx, POSITION_ORIGIN_Y, minz],
    "meshes": [payload for kind in ["city"] if (payload := mesh.payload(kind))],
    "lines": {
      "positionType": "u16cm",
      "positions": encode(line_positions),
      "colors": encode(linear_rgb_bytes(np.array(ink_colors))),
    },
    "nav": {
      "ground": navigation_polygons(ground, minx, minz),
      "buildings": nav_buildings,
      "water": navigation_polygons(display_water, minx, minz),
      "bridges": navigation_polygons(display_surfaces["bridge"], minx, minz),
      "roads": navigation_polygons(
        unary_union([display_surfaces[kind] for kind in ("road", "path")]),
        minx,
        minz,
      ),
      "groundY": GROUND_Y,
    },
  }
  # Minecraft renders only its block-face batch; it never consumes the drawn
  # ink layer. Do not download or parse an unused duplicate perimeter there.
  if minecraft:
    payload.pop("lines")
  return payload


def write_json(path: Path, payload: Any) -> int:
  """Write a deterministic compact source-derived artifact."""
  data = (
    json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
  ).encode()
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_bytes(data)
  return len(data)


def write_source_inventory(output: Path, inventory: dict[str, Any]) -> dict[str, Any]:
  """Keep the complete non-runtime source catalogue in one lossless download."""
  data = (
    json.dumps(inventory, ensure_ascii=False, separators=(",", ":")) + "\n"
  ).encode()
  packed = gzip.compress(data, compresslevel=9, mtime=0)
  path = output / "source-inventory.json.gz"
  path.write_bytes(packed)
  (output / "source-inventory.json").unlink(missing_ok=True)
  return {
    "url": path.name,
    "encoding": "gzip",
    "bytes": len(packed),
    "decodedBytes": len(data),
    "sha256": hashlib.sha256(packed).hexdigest(),
  }


def build(
  *, bounds_path: Path, core_path: Path, pbf: Path, lod2_dir: Path, output: Path
) -> dict[str, Any]:
  """Export only the explicitly approved extension, retaining source ownership."""
  output.mkdir(parents=True, exist_ok=True)
  bounds = load_projected_polygon(bounds_path)
  core = load_projected_polygon(core_path)
  scope = bounds.difference(core)
  if scope.is_empty or scope.intersection(core).area > 0.001:
    raise ValueError("Expected a nonempty additive extension with no core overlap")
  official, official_sources = official_buildings(
    list(lod2_dir.glob("LoD2_*.zip")), scope
  )
  print(f"Source collection: {len(official)} official buildings", flush=True)
  scope_world = world(scope)
  prepared_path = pbf.with_name("resolved-outlines.gpkg")
  prepared_metadata = pbf.with_name("resolved-outlines.json")
  prepared_key = hashlib.sha256(
    b"source-policy-v3"
    + bounds.wkb
    + core.wkb
    + hashlib.sha256(pbf.read_bytes()).digest()
    + json.dumps(official_sources, sort_keys=True).encode()
  ).hexdigest()
  prepared = (
    json.loads(prepared_metadata.read_text()) if prepared_metadata.exists() else {}
  )
  if prepared_path.exists() and prepared.get("cacheKey") == prepared_key:
    buildings = gpd.read_file(prepared_path, layer="buildings").to_dict("records")
    surfaces = {
      row["kind"]: row.geometry
      for _, row in gpd.read_file(prepared_path, layer="surfaces").iterrows()
    }
    inventory = prepared["inventory"]
    print(f"Reused {len(buildings)} resolved source outlines", flush=True)
  else:
    lines, areas = read_source_frames(pbf, bounds)
    print(f"Clipped input: {len(lines)} lines, {len(areas)} area records", flush=True)
    buildings, sources, inventory = collect_sources(lines, areas, scope, official)
    print(f"Resolved {len(buildings)} total buildings and mapped surfaces", flush=True)
    for building in buildings:
      building["geometry"] = world(building["geometry"])
    # Whole-scope unions keep junctions and shores continuous across tiles.
    surfaces = {kind: world(unary_union(parts)) for kind, parts in sources.items()}
    print("Mapped surface unions complete", flush=True)
    water = surfaces.get("water", Polygon())
    building_union = unary_union(
      [b["geometry"] for b in buildings if b["minHeight"] <= 0.25]
    )
    for kind in ("road", "path", "rail"):
      surfaces[kind] = (
        surfaces.get(kind, Polygon())
        .difference(building_union)
        .difference(water.difference(surfaces.get("bridge", Polygon())))
      )
    surfaces["park"] = surfaces.get("park", Polygon()).difference(water)
    if buildings:
      # This ignored intermediate deliberately has no geographic CRS: it uses
      # the documented viewer metre frame, including its reversed north axis.
      gpd.GeoDataFrame(buildings, geometry="geometry").to_file(
        prepared_path, layer="buildings", driver="GPKG"
      )
      gpd.GeoDataFrame(
        [{"kind": kind, "geometry": geometry} for kind, geometry in surfaces.items()],
        geometry="geometry",
      ).to_file(prepared_path, layer="surfaces", driver="GPKG")
      write_json(prepared_metadata, {"cacheKey": prepared_key, "inventory": inventory})
  tree = shapely.STRtree([b["geometry"] for b in buildings])
  manifest: dict[str, Any] = {
    "schemaVersion": 1,
    "version": "1.0.59",
    "chunkSize": CHUNK_SIZE,
    "bounds": list(world(bounds).bounds),
    "boundary": navigation_polygons(world(bounds), 0, 0),
    "footprint": navigation_polygons(scope_world, 0, 0),
    "groundY": GROUND_Y,
    "waterY": WATER_Y,
    "chunks": [],
    "source": {
      "osm": {
        "url": SOURCE_URL,
        "sha256": hashlib.sha256(pbf.read_bytes()).hexdigest(),
        "license": "ODbL-1.0",
      },
      "lod2": {"license": "dl-de/zero-2-0", "tiles": official_sources},
      "boundsSha256": hashlib.sha256(bounds_path.read_bytes()).hexdigest(),
      "preservedCoreSha256": hashlib.sha256(core_path.read_bytes()).hexdigest(),
      "addedAreaM2": round(scope.area, 3),
      "buildingCount": len(buildings),
      "officialBuildingCount": len(official),
      "osmBuildingCount": len(buildings) - len(official),
      "heightEvidence": inventory["heightEvidence"],
      "roadWidthEvidence": inventory["roadWidthEvidence"],
      "policy": "Existing v1.0.58 city is excluded exactly. Authoritative LoD2 footprints and vertical envelopes anchor available outer buildings; remaining OSM footprints use tagged heights, levels or explicit class estimates. Flat outer terrain at viewer y=3 m, wall/roof colours, road fallback widths and the separate two-metre Minecraft reading are display estimates. No facade or roof detail is inferred.",
    },
  }
  minx, minz, maxx, maxz = scope_world.bounds
  for tx in range(math.floor(minx / CHUNK_SIZE), math.floor(maxx / CHUNK_SIZE) + 1):
    for tz in range(math.floor(minz / CHUNK_SIZE), math.floor(maxz / CHUNK_SIZE) + 1):
      tile = box(
        tx * CHUNK_SIZE, tz * CHUNK_SIZE, (tx + 1) * CHUNK_SIZE, (tz + 1) * CHUNK_SIZE
      )
      ground = tile.intersection(scope_world)
      if ground.area < 0.01:
        continue
      chunk_id = f"{tx}_{tz}"
      selected = [buildings[int(i)] for i in tree.query(tile, predicate="intersects")]
      # After global junction/water ownership has been resolved, clip once with
      # GEOS's rectangle clipper. Repeating a full polygon-overlay intersection
      # against the entire city's connected road network for every layer and
      # mode is needlessly expensive. make_valid repairs only clipping topology;
      # no source vertex simplification or display geometry is removed.
      local_surfaces = {
        kind: polygonal(
          shapely.make_valid(shapely.clip_by_rect(geometry, *tile.bounds))
        )
        for kind, geometry in surfaces.items()
      }
      entry: dict[str, Any] = {
        "id": chunk_id,
        "bounds": list(tile.bounds),
        "buildingCount": len(selected),
      }
      for mode in ("drawn", "minecraft"):
        payload = chunk_payload(
          chunk_id,
          tile,
          ground,
          selected,
          local_surfaces,
          minecraft=mode == "minecraft",
        )
        filename = f"{chunk_id}.{mode}.json.gz"
        data = (
          json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
        ).encode()
        packed = gzip.compress(data, compresslevel=9, mtime=0)
        (output / filename).write_bytes(packed)
        byte_count = len(packed)
        entry[mode] = {
          "url": filename,
          "bytes": byte_count,
          "decodedBytes": len(data),
          "encoding": "gzip",
          "sha256": hashlib.sha256((output / filename).read_bytes()).hexdigest(),
        }
        (output / f"{chunk_id}.{mode}.json").unlink(missing_ok=True)
      manifest["chunks"].append(entry)
      print(
        f"Chunk {chunk_id}: {len(selected)} buildings; {entry['drawn']['bytes']} / {entry['minecraft']['bytes']} bytes",
        flush=True,
      )
  manifest["source"]["inventory"] = write_source_inventory(output, inventory)
  write_json(output / "manifest.json", manifest)
  return manifest


def main() -> None:
  """Run against explicit approved bounds; no implicit all-city expansion."""
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--bounds", type=Path, required=True)
  parser.add_argument("--core", type=Path, required=True)
  parser.add_argument("--pbf", type=Path, default=RAW / "berlin-260929.osm.pbf")
  parser.add_argument(
    "--lod2-dir", type=Path, default=ROOT / "geo_data/regierungsviertel/raw/lod2"
  )
  parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT)
  args = parser.parse_args()
  manifest = build(
    bounds_path=args.bounds,
    core_path=args.core,
    pbf=args.pbf,
    lod2_dir=args.lod2_dir,
    output=args.out,
  )
  print(f"Exported {len(manifest['chunks'])} independent outer-city chunks")


if __name__ == "__main__":
  main()
