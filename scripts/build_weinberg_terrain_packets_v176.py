"""Step 10: bounded, lossless terrain placement of existing Weinberg packets.

The immutable v1.0.75 packets remain the source. Buildings translate rigidly;
only their existing ground triangles are clipped onto the local DGM grid.
No source face, colour, courtyard or earlier refinement is removed.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
import subprocess
from collections import Counter
from collections.abc import Callable
from functools import lru_cache
from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
import shapely
from alt_mitte_v169_packets import empty_packet, fits
from build_karl_marx_allee_v161 import clip_polygon
from build_surrounding_outlines import linear_rgb_bytes
from shapely import STRtree
from shapely.geometry import LineString, Point, Polygon, box, mapping
from shapely.geometry import shape as geometry_shape
from shapely.ops import unary_union
from split_alt_mitte_v169_core import split_mesh
from weinberg_terrain_v176 import STEP, SUPPORT, building_offset, sample_offset

ROOT = Path(__file__).resolve().parents[1]
BASE = "v1.0.75"
OUTER = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
DATA = ROOT / "src/app/src/data"
SOURCES = ROOT / "geo_data/regierungsviertel/alt-mitte-v169"
REPORT = ROOT / "geo_data/regierungsviertel/weinberg-v176/packet-audit.json"
OFFSETS = DATA / "weinbergBuildingOffsetsV176.json"
COARSE_ANCHORS = REPORT.parent / "retained-coarse-anchors.json"
GROUND_LEVELS = (3.0, 3.01, 3.09, 3.12, 3.15)
STREET_KINDS = {"mitte-street-fronts-v166", "scheunenviertel-v168"}
PAVING_RGB = linear_rgb_bytes(np.asarray([181, 176, 163]))
KERB_RGB = linear_rgb_bytes(np.asarray([212, 207, 191]))
NATIVE_STEP = 4
OWNER_PADDING = 50


def is_ground_triangle(kind: str, points: np.ndarray, colors: np.ndarray) -> bool:
  """Identify published ground roles by their layer, exact level and material."""
  flat = np.ptp(points[:, 1]) < 0.001
  if kind == "city":
    return flat and any(abs(points[0, 1] - level) < 0.002 for level in GROUND_LEVELS)
  if kind not in STREET_KINDS:
    return False
  if flat and abs(points[0, 1] - 3.22) < 0.002 and np.all(colors == PAVING_RGB):
    return True
  return (
    np.all(colors == KERB_RGB)
    and np.min(points[:, 1]) >= 3.089
    and np.max(points[:, 1]) <= 3.281
    and np.max(points[:, 1]) >= 3.279
  )


@lru_cache(maxsize=1)
def basins() -> list[dict]:
  """Retained mapped Plansche footprint, with a shared level/floor contract."""
  source = json.loads((DATA / "mitteHeritageV166Source.json").read_bytes())
  sheet = source["groundSurfaces"][177]
  if sheet["kind"] != "mapped water":
    raise ValueError("The retained Plansche source identity changed")
  shape = unary_union(
    [Polygon([(x, z) for x, _, z in triangle]) for triangle in sheet["triangles"]]
  )
  polygons = list(shape.geoms) if shape.geom_type == "MultiPolygon" else [shape]
  return [
    {
      "id": "weinberg-plansche",
      "ring": [list(p) for p in polygon.exterior.coords[:-1]],
      "holes": [[list(p) for p in ring.coords[:-1]] for ring in polygon.interiors],
      "waterY": 12.415,
      "floorY": 12.40,
    }
    for polygon in polygons
  ]


@lru_cache(maxsize=1)
def basin_shapes() -> list[tuple]:
  return [(Polygon(b["ring"], b["holes"]), b["floorY"]) for b in basins()]


def basin_floor_pieces(pieces: list[np.ndarray]) -> list[np.ndarray]:
  """Keep exact old ground XZ coverage while flattening only the mapped basin."""
  result = []
  for triangle in pieces:
    xz = triangle[:, [0, 2]]
    if (
      np.max(xz[:, 0]) < 2124
      or np.min(xz[:, 0]) > 2142
      or np.max(xz[:, 1]) < -1424
      or np.min(xz[:, 1]) > -1393
    ):
      result.append(triangle)
      continue
    footprint = Polygon(xz)
    if footprint.area < 1e-9:
      result.append(triangle)
      continue
    touched = [
      (shape, floor) for shape, floor in basin_shapes() if shape.intersects(footprint)
    ]
    if not touched:
      result.append(triangle)
      continue
    plane = np.linalg.solve(np.column_stack([xz, np.ones(3)]), triangle[:, 1])
    source_winding = np.cross(triangle[1] - triangle[0], triangle[2] - triangle[0])[1]
    remaining = footprint
    for shape, floor in touched:
      inner = remaining.intersection(shape)
      remaining = remaining.difference(shape)
      for flat, clipped in ((True, inner),):
        if clipped.is_empty:
          continue
        for face in shapely.constrained_delaunay_triangles(clipped).geoms:
          tri = np.asarray(
            [
              [x, floor if flat else plane[0] * x + plane[1] * z + plane[2], z]
              for x, z in list(face.exterior.coords)[:3]
            ]
          )
          if np.cross(tri[1] - tri[0], tri[2] - tri[0])[1] * source_winding < 0:
            tri = tri[::-1]
          result.append(tri)
    if not remaining.is_empty:
      for face in shapely.constrained_delaunay_triangles(remaining).geoms:
        tri = np.asarray(
          [
            [x, plane[0] * x + plane[1] * z + plane[2], z]
            for x, z in list(face.exterior.coords)[:3]
          ]
        )
        if np.cross(tri[1] - tri[0], tri[2] - tri[0])[1] * source_winding < 0:
          tri = tri[::-1]
        result.append(tri)
  return result


def encode(value: Any) -> bytes:
  """Stable source-compatible JSON, with no non-finite numbers."""
  return (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


def baseline(path: Path) -> bytes:
  """Always read the immutable previous release, making reruns idempotent."""
  return subprocess.check_output(
    ["git", "show", f"{BASE}:{path.relative_to(ROOT)}"], cwd=ROOT
  )


def array64(values: np.ndarray) -> str:
  """Encode the existing compact little-endian packet representation."""
  return base64.b64encode(values.tobytes()).decode()


def triangle_key(points_cm: Any) -> bytes:
  """Orientation-independent exact world-centimetre owner identity."""
  return np.asarray(sorted(map(tuple, points_cm)), dtype="<i4").tobytes()


def sample_native_offset(x: float, z: float) -> float:
  """World-aligned four metre terraces, matching the runtime navigation."""
  if not (SUPPORT[0] < x < SUPPORT[2] and SUPPORT[1] < z < SUPPORT[3]):
    return 0.0
  return sample_offset(math.floor(x / 4) * 4 + 2, math.floor(z / 4) * 4 + 2)


def _clip_axis(points: list, axis: int, edge: float, lower: bool) -> list:
  return clip_polygon(points, axis, edge, lower)


def _clip_diagonal(points: list, x0: float, z0: float, side: int) -> list:
  # A vertical curb may lie wholly on this plane: keep it on exactly one
  # closed half-plane, rather than duplicating the original source face.
  if side == 1 and all(abs((p[0] - x0) - (p[2] - z0)) < 1e-10 for p in points):
    return []
  result = []
  for i, a in enumerate(points):
    b = points[(i + 1) % len(points)]
    da, db = side * ((a[0] - x0) - (a[2] - z0)), side * ((b[0] - x0) - (b[2] - z0))
    ia, ib = da >= -1e-10, db >= -1e-10
    if ia:
      result.append(a)
    if ia != ib:
      t = da / (da - db)
      result.append([a[j] + (b[j] - a[j]) * t for j in range(3)])
  return result


def _fan(points: list) -> list:
  return [
    np.asarray([points[0], points[i], points[i + 1]], dtype=float)
    for i in range(1, len(points) - 1)
  ]


def cap_basin_risers(risers: list[np.ndarray]) -> list[np.ndarray]:
  """Cap only newly generated terrace risers inside the exact flat basin."""
  result = []
  for triangle in risers:
    if (
      triangle[:, 0].max() < 2124
      or triangle[:, 0].min() > 2142
      or triangle[:, 2].max() < -1424
      or triangle[:, 2].min() > -1393
    ):
      result.append(triangle)
      continue
    pieces = [triangle]
    for basin, floor in basin_shapes():
      next_pieces = []
      for piece in pieces:
        axis = 0 if np.ptp(piece[:, 0]) >= np.ptp(piece[:, 2]) else 2
        start, end = piece[np.argmin(piece[:, axis])], piece[np.argmax(piece[:, axis])]
        line = LineString([start[[0, 2]], end[[0, 2]]])
        inside = line.intersection(basin)
        if inside.is_empty:
          next_pieces.append(piece)
          continue
        for cap, region in ((False, line.difference(basin)), (True, inside)):
          lines = (
            [region]
            if region.geom_type == "LineString"
            else list(getattr(region, "geoms", []))
          )
          for segment in lines:
            if segment.geom_type != "LineString" or segment.length < 1e-9:
              continue
            coordinates = np.asarray(segment.coords)
            low, high = (
              coordinates[:, 0 if axis == 0 else 1].min(),
              coordinates[:, 0 if axis == 0 else 1].max(),
            )
            ring = _clip_axis(piece.tolist(), axis, low, True)
            ring = _clip_axis(ring, axis, high, False)
            for clipped in _fan(ring):
              if cap:
                clipped[:, 1] = np.minimum(clipped[:, 1], floor)
              if (
                np.linalg.norm(
                  np.cross(clipped[1] - clipped[0], clipped[2] - clipped[0])
                )
                > 1e-8
              ):
                next_pieces.append(clipped)
      pieces = next_pieces
    result.extend(pieces)
  return result


def drape_triangle(points: np.ndarray, *, minecraft: bool = False) -> list[np.ndarray]:
  """Clip an existing ground triangle to exact DGM cells; never fill a hole.

  Drawn pieces use the same NW/SE diagonal as the eager height sampler. Native
  pieces retain the original XZ boundary and have horizontal four metre tops.
  Outside support, the original triangle is returned without re-quantisation.
  """
  minx, minz = np.min(points[:, [0, 2]], axis=0)
  maxx, maxz = np.max(points[:, [0, 2]], axis=0)
  if (
    maxx <= SUPPORT[0] or minx >= SUPPORT[2] or maxz <= SUPPORT[1] or minz >= SUPPORT[3]
  ):
    return [points]
  # Retain the outside complement as exact clipped polygons, without generating
  # a grid across the rest of the unchanged 512 m packet.
  remaining = points.tolist()
  result = []
  risers = []
  for axis, edge, lower in (
    (0, SUPPORT[0], True),
    (0, SUPPORT[2], False),
    (2, SUPPORT[1], True),
    (2, SUPPORT[3], False),
  ):
    outside = _clip_axis(remaining, axis, edge, not lower) if remaining else []
    result.extend(_fan(outside))
    remaining = _clip_axis(remaining, axis, edge, lower) if remaining else []
  if len(remaining) < 3:
    return result
  inside = np.asarray(remaining)
  minx, minz = np.min(inside[:, [0, 2]], axis=0)
  maxx, maxz = np.max(inside[:, [0, 2]], axis=0)
  step = NATIVE_STEP if minecraft else STEP
  vertical = abs(np.cross(points[1] - points[0], points[2] - points[0])[1]) < 1e-8
  origin_x, origin_z = (0, 0) if minecraft else SUPPORT[:2]
  for iz in range(
    math.floor((minz - origin_z) / step),
    max(math.floor((minz - origin_z) / step) + 1, math.ceil((maxz - origin_z) / step)),
  ):
    z0 = origin_z + iz * step
    for ix in range(
      math.floor((minx - origin_x) / step),
      max(
        math.floor((minx - origin_x) / step) + 1, math.ceil((maxx - origin_x) / step)
      ),
    ):
      x0 = origin_x + ix * step
      ring = remaining
      for axis, edge, lower in (
        (0, x0, True),
        (0, x0 + step, False),
        (2, z0, True),
        (2, z0 + step, False),
      ):
        ring = _clip_axis(ring, axis, edge, lower)
        if len(ring) < 3:
          break
      if len(ring) < 3:
        continue
      polygons = (
        [ring]
        if minecraft
        else [_clip_diagonal(ring, x0, z0, side) for side in (-1, 1)]
      )
      for polygon in polygons:
        for tri in _fan(polygon):
          if np.linalg.norm(np.cross(tri[1] - tri[0], tri[2] - tri[0])) < 1e-8:
            continue
          if minecraft:
            tri[:, 1] += sample_native_offset(x0 + step / 2, z0 + step / 2)
          else:
            tri[:, 1] += [sample_offset(x, z) for x, _, z in tri]
          result.append(tri)
      if minecraft and not vertical:
        high = sample_native_offset(x0 + step / 2, z0 + step / 2)
        for i, a in enumerate(ring):
          b = ring[(i + 1) % len(ring)]
          adjacent = None
          for axis, edge, sx, sz in (
            (0, x0, x0 - 2, z0 + 2),
            (0, x0 + step, x0 + step + 2, z0 + 2),
            (2, z0, x0 + 2, z0 - 2),
            (2, z0 + step, x0 + 2, z0 + step + 2),
          ):
            if abs(a[axis] - edge) < 1e-8 and abs(b[axis] - edge) < 1e-8:
              adjacent = sample_native_offset(sx, sz)
              break
          if adjacent is None or high - adjacent < 0.005:
            continue
          upper_a, upper_b, lower_a, lower_b = (
            np.asarray(a).copy(),
            np.asarray(b).copy(),
            np.asarray(a).copy(),
            np.asarray(b).copy(),
          )
          upper_a[1] += high
          upper_b[1] += high
          lower_a[1] += adjacent
          lower_b[1] += adjacent
          risers.extend(
            [
              np.asarray([upper_a, lower_a, upper_b]),
              np.asarray([upper_b, lower_a, lower_b]),
            ]
          )
  return basin_floor_pieces(result) + cap_basin_risers(risers)


def elevate_mesh(
  mesh: dict,
  origin: list,
  exact_owners: dict[bytes, float],
  fallback: Callable[[np.ndarray], float | None],
  *,
  minecraft: bool = False,
  water_at: Callable[[np.ndarray], float | None] | None = None,
) -> tuple[dict, dict]:
  """Retain source triangles/colours; translate owners and drape only ground.

  Exact owners take precedence. Shared vertices are split only if two source
  triangles require different placements. No UInt16 overflow can wrap silently.
  """
  positions = np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(
    -1, 3
  )
  colors = np.frombuffer(base64.b64decode(mesh["colors"]), dtype="u1").reshape(-1, 3)
  indices = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(-1, 3)
  origin_cm = np.rint(np.asarray(origin) * 100).astype(np.int64)
  world_cm = positions.astype(np.int64) + origin_cm
  vertices: list[tuple] = []
  vertex_ids: dict[tuple, int] = {}
  output_indices: list[int] = []
  counts: Counter = Counter(sourceTriangles=len(indices))
  receipts: list[list] = []

  def receipt(source_index: int, kind: str, dy: float, start: int) -> None:
    count = len(output_indices) // 3 - start
    tail = [kind, round(dy * 100), count]
    if receipts and receipts[-1][2:] == tail:
      receipts[-1][1] += 1
    else:
      receipts.append([source_index, 1, *tail])

  def add(points: np.ndarray, col: np.ndarray, *, preserve: bool = False) -> None:
    local = np.rint(points * 100).astype(np.int64) - origin_cm
    if np.min(local) < 0 or np.max(local) > 65535:
      raise ValueError("Elevated packet exceeds UInt16 coordinate range")
    rows = [
      tuple(map(int, np.concatenate([p, c]))) for p, c in zip(local, col, strict=True)
    ]
    # Degenerate clipping pieces have no area and add no original source face.
    if not preserve and len(set(row[:3] for row in rows)) < 3:
      counts["quantizedZeroAreaPieces"] += 1
      return
    for row in rows:
      at = vertex_ids.get(row)
      if at is None:
        at = len(vertices)
        vertex_ids[row] = at
        vertices.append(row)
      output_indices.append(at)

  changed = False
  for source_index, triangle in enumerate(indices):
    output_start = len(output_indices) // 3
    raw = world_cm[triangle]
    points = raw.astype(float) / 100
    col = colors[triangle]
    key = triangle_key(raw)
    placement = exact_owners.get(key)
    offset = (
      placement.pop(0) if isinstance(placement, list) and placement else placement
    )
    if isinstance(offset, list):
      offset = None
    water = (
      water_at(points)
      if water_at
      and mesh["kind"] == "city"
      and np.min(points[:, 1]) < 0
      and np.max(points[:, 1]) <= 3.001
      else None
    )
    if offset is not None:
      counts["exactOwnerTriangles"] += 1
    elif water is not None:
      if np.ptp(points[:, 1]) < 0.001:
        offset = water - points[0, 1]
        counts["waterTriangles"] += 1
      else:
        # Existing vertical shoreline sheets keep their complete XZ trace.
        points[:, 1] = [
          water if y < 0 else max(water, y + sample_offset(x, z)) for x, y, z in points
        ]
        changed = True
        add(points, col, preserve=True)
        counts["bankTriangles"] += 1
        receipt(source_index, "bank", 0, output_start)
        continue
    elif is_ground_triangle(mesh["kind"], points, col):
      pieces = drape_triangle(points, minecraft=minecraft)
      if len(pieces) != 1 or not np.array_equal(pieces[0], points):
        if not np.all(col == col[0]):
          raise ValueError("Draped ground has nonuniform source colours")
        counts["drapedSourceTriangles"] += 1
        counts["drapedResultTriangles"] += len(pieces)
        changed = True
        normal = np.cross(points[1] - points[0], points[2] - points[0])
        preserve_vertical = abs(normal[1]) < 1e-8 and np.linalg.norm(normal) > 1e-8
        for piece in pieces:
          add(piece, col, preserve=preserve_vertical)
        receipt(source_index, "terrain", 0, output_start)
        continue
      offset = 0.0
      counts["untouchedGroundTriangles"] += 1
    else:
      offset = fallback(points)
      counts[
        "footprintOwnerTriangles" if offset is not None else "unownedTriangles"
      ] += 1
      if offset is None:
        offset = 0.0
    if offset:
      points[:, 1] += offset
      counts["translatedSourceTriangles"] += 1
      changed = True
    add(points, col, preserve=True)
    receipt(source_index, "rigid", offset, output_start)
  counts["resultTriangles"] = len(output_indices) // 3
  counts["resultVertices"] = len(vertices)
  result_counts = {**counts, "placementRuns": receipts}
  if not changed:
    return mesh, result_counts
  values = np.asarray(vertices, dtype=np.uint16)
  return {
    **mesh,
    "positions": array64(values[:, :3].astype("<u2")),
    "colors": array64(values[:, 3:].astype("u1")),
    "indices": array64(np.asarray(output_indices, dtype="<u4")),
  }, result_counts


class Owners:
  """Fixed source-parent identities, footprints and one rigid datum per parent."""

  def __init__(self) -> None:
    manifest = json.loads((SOURCES / "source-manifest.json").read_bytes())
    self.records, self.shapes, self.metadata = [], [], []
    self.offsets: dict[str, float] = {}
    support = box(*SUPPORT)
    owner_bounds = [
      SUPPORT[0] - OWNER_PADDING,
      SUPPORT[1] - OWNER_PADDING,
      SUPPORT[2] + OWNER_PADDING,
      SUPPORT[3] + OWNER_PADDING,
    ]
    owner_support = box(*owner_bounds)
    for chunk in manifest["chunks"]:
      for record in json.loads(gzip.decompress((SOURCES / chunk["file"]).read_bytes()))[
        "buildings"
      ]:
        shape = unary_union(
          [
            Polygon(p["ring"], p.get("holes", [])).buffer(0)
            for p in record.get("footprintPolygons", [])
          ]
        )
        if shape.is_empty or not shape.intersects(owner_support):
          continue
        anchor = shape.representative_point()
        nhn, base = record.get("groundNHN"), record["groundY"]
        offset = (
          building_offset(nhn, base, anchor.x, anchor.y)
          if nhn is not None
          else round(sample_offset(anchor.x, anchor.y), 2)
        )
        metadata = {
          "id": record["id"],
          "partIds": [p["id"] for p in record["parts"]],
          "anchor": [round(anchor.x, 4), round(anchor.y, 4)],
          "groundNHN": nhn,
          "groundY": base,
          "offsetY": offset,
          "category": record["category"],
          "source": "official LoD2 parent ground"
          if nhn is not None
          else "DGM sample at retained OSM owner anchor",
        }
        self.records.append(record)
        self.shapes.append(shape)
        self.metadata.append(metadata)
        for identity in [
          record["id"],
          *metadata["partIds"],
          *record["legacyPrismIds"],
          *record["outerOwnerIds"],
        ]:
          self.offsets[identity] = offset
    coarse_path = (
      ROOT / "geo_data/regierungsviertel/raw/outer-v159/resolved-outlines.gpkg"
    )
    if COARSE_ANCHORS.exists():
      coarse_source = json.loads(COARSE_ANCHORS.read_bytes())
    elif coarse_path.exists():
      frame = gpd.read_file(coarse_path, layer="buildings", bbox=tuple(owner_bounds))
      coarse_source = {
        "schemaVersion": 1,
        "ownerBounds": owner_bounds,
        "source": "Original v159 resolved LoD2 parent ground and clipped footprints; Geoportal Berlin dl-de/zero-2-0",
        "sourceSha256": hashlib.sha256(coarse_path.read_bytes()).hexdigest(),
        "records": [
          {
            "id": row.sourceId,
            "groundNHN": round(row.sourceGroundY + 30, 3)
            if math.isfinite(row.sourceGroundY)
            else None,
            "geometry": mapping(row.geometry),
          }
          for row in frame.itertuples()
          if row.sourceId not in self.offsets
        ],
      }
      COARSE_ANCHORS.write_bytes(encode(coarse_source))
    else:
      raise ValueError("Missing bounded retained coarse-owner anchors")
    if coarse_source.get("ownerBounds") != owner_bounds:
      raise ValueError("Retained coarse provenance must include the zero-offset border")
    for row in coarse_source["records"]:
      coarse_shape = geometry_shape(row["geometry"])
      if row["id"] in self.offsets or coarse_shape.is_empty:
        continue
      anchor = coarse_shape.representative_point()
      nhn = row["groundNHN"]
      offset = (
        building_offset(nhn, 3, anchor.x, anchor.y)
        if nhn is not None
        else round(sample_offset(anchor.x, anchor.y), 2)
      )
      self.records.append(
        {
          "id": row["id"],
          "category": "retained",
          "groundY": 3,
          "groundNHN": nhn,
          "parts": [],
        }
      )
      self.shapes.append(coarse_shape)
      self.metadata.append(
        {
          "id": row["id"],
          "partIds": [],
          "anchor": [round(anchor.x, 4), round(anchor.y, 4)],
          "groundNHN": nhn,
          "groundY": 3,
          "offsetY": offset,
          "category": "retained-coarse",
          "source": "Existing resolved outer LoD2 source ground or DGM fallback",
        }
      )
      self.offsets[row["id"]] = offset
    self.tree = STRtree(self.shapes)
    # Whole parents cross tile/support edges. The small voxel margin preserves
    # native facade cells, while nearby zero-offset parents disambiguate them.
    self.placement_area = unary_union(
      [support]
      + [
        shape
        for shape, metadata in zip(self.shapes, self.metadata, strict=True)
        if metadata["offsetY"]
      ]
    ).buffer(3)
    self.ambiguous = Counter()
    self.unowned = Counter()
    self.ponds = []
    manifest = json.loads(baseline(OUTER / "manifest.json"))
    for chunk in manifest["chunks"]:
      if chunk.get("detailCompanionOf") or not _bounds_intersect(chunk["bounds"]):
        continue
      packet = json.loads(gzip.decompress(baseline(OUTER / chunk["drawn"]["url"])))
      ox, _, oz = packet["origin"]
      for pond in packet["nav"]["water"]:
        shape = Polygon(
          [(x + ox, z + oz) for x, z in pond["ring"]],
          [[(x + ox, z + oz) for x, z in h] for h in pond["holes"]],
        )
        point = shape.centroid
        if sample_offset(point.x, point.y) > 0.01:
          self.ponds.append((shape, round(3 + sample_offset(point.x, point.y), 2)))

  def water_at(self, points: np.ndarray) -> float | None:
    x, z = np.mean(points[:, [0, 2]], axis=0)
    candidates = [(shape.distance(Point(x, z)), level) for shape, level in self.ponds]
    if candidates and min(candidates)[0] < 3:
      return min(candidates)[1]
    return None

  def lookup(self, points: np.ndarray) -> float | None:
    """Resolve earlier named packet layers against retained official footprints.

    Complete points, not merely a centroid, determine the nearest source owner.
    Exact v169 signatures are always resolved before this compatibility path.
    """
    x, z = np.mean(points[:, [0, 2]], axis=0)
    centre = Point(x, z)
    if not self.placement_area.intersects(centre):
      return None
    candidates = self.tree.query(centre.buffer(2.9))
    scored = []
    for i in candidates:
      shape, record = self.shapes[i], self.records[i]
      distance = shape.distance(centre)
      if distance > 2.9:
        continue
      # Prefer an entire triangle lying on/in one footprint. Thin facade rows
      # retain the original two-metre native voxel boundary as well as drawn
      # facade projections. Exact source packets bypass this compatibility path.
      worst = max(shape.distance(Point(p[0], p[2])) for p in points)
      top = max(
        (p.get("topY", record["groundY"]) for p in record["parts"]),
        default=record["groundY"] + 400,
      )
      penalty = max(0.0, float(np.max(points[:, 1])) - top - 3) * 10
      scored.append((round(worst + distance + penalty, 6), str(record["id"]), int(i)))
    if not scored:
      if sample_offset(x, z) > 0.01:
        self.unowned[(round(x / 10) * 10, round(z / 10) * 10)] += 1
      return None
    scored.sort()
    best = scored[0]
    if (
      len(scored) > 1
      and abs(scored[1][0] - best[0]) < 1e-6
      and self.metadata[scored[1][2]]["offsetY"] != self.metadata[best[2]]["offsetY"]
    ):
      self.ambiguous[(best[1], scored[1][1])] += 1
    return self.metadata[best[2]]["offsetY"]

  def write(self) -> None:
    (DATA / "weinbergBasinsV176.json").write_bytes(encode({"basins": basins()}))
    OFFSETS.write_bytes(encode({"schemaVersion": 1, "offsets": self.offsets}))
    (REPORT.parent / "building-placement.json").write_bytes(
      encode(
        {
          "schemaVersion": 1,
          "baseRelease": BASE,
          "method": "One rigid parent translation; measured NHN ground minus 30 m scene datum and original groundY; bounded DGM weight at fixed representative point",
          "support": SUPPORT,
          "parents": self.metadata,
        }
      )
    )

  def model_cache(self, record: dict) -> list:
    """Use the original cache, or reproducibly rebuild only this source parent."""
    digest = hashlib.sha256(
      json.dumps(
        record, ensure_ascii=False, separators=(",", ":"), allow_nan=False
      ).encode()
    ).hexdigest()
    caches = list(Path("/tmp/v169-alt-mitte-model-cache").glob("*")) + [
      Path("/tmp/v176-alt-mitte-model-cache")
    ]
    source = next(
      (p / f"{digest}.json.gz" for p in caches if (p / f"{digest}.json.gz").exists()),
      None,
    )
    if source is not None:
      return json.loads(gzip.decompress(source.read_bytes()))
    # Cache files are only acceleration. A clean checkout reconstructs the same
    # bounded parents from committed sources and the original appearance map.
    import build_alt_mitte_v169 as generator

    if not hasattr(self, "_occupied"):
      manifest = json.loads((SOURCES / "source-manifest.json").read_bytes())
      shapes = []
      for chunk in manifest["chunks"]:
        data = json.loads(gzip.decompress((SOURCES / chunk["file"]).read_bytes()))
        shapes.extend(generator.footprint(b) for b in data["buildings"])
      self._occupied = unary_union(shapes)
      appearance_path = SOURCES / "appearance-baseline.json.gz"
      appearance = json.loads(gzip.decompress(appearance_path.read_bytes()))
      ranks = {}
      generator.APPEARANCE.clear()
      for previous in appearance["records"]:
        for binding in previous["bindings"]:
          for part in binding["parts"]:
            rank = (part["match"] == "leaf-id", part["overlapAreaM2"])
            if rank > ranks.get(part["partId"], (False, -1)):
              generator.APPEARANCE[part["partId"]] = previous
              ranks[part["partId"]] = rank
    shells, fronts, nav, roofs = generator.model(record, self._occupied)
    full = generator.Detail()
    full.triangles = shells.triangles + fronts.triangles
    native = generator.merge_native_faces(generator.native_detail(full))
    cells = (
      [[x, z, y] for (x, z), y in generator.native_roofs(native).items()]
      if record["category"] == "core"
      else []
    )
    data = [shells.triangles, fronts.triangles, native.triangles, nav, roofs, cells]
    folder = Path("/tmp/v176-alt-mitte-model-cache")
    folder.mkdir(exist_ok=True)
    (folder / f"{digest}.json.gz").write_bytes(gzip.compress(encode(data), mtime=0))
    return data


def exact_owner_lookup(
  owners: Owners, bounds: list, mode: str, resident: bool
) -> dict[bytes, float]:
  """Recover exact prepacking owner provenance from retained v169 model cache."""
  lookup: dict[bytes, float] = {}
  target = box(*bounds).buffer(2)
  for record, shape, metadata in zip(
    owners.records, owners.shapes, owners.metadata, strict=True
  ):
    if record["category"] == "retained" or not shape.intersects(target):
      continue
    is_core = record["category"] == "core" and bool(record["parts"])
    if resident and not is_core:
      continue
    data = owners.model_cache(record)
    if mode == "minecraft":
      if not resident and is_core:
        continue
      triangles = data[2]
    elif resident:
      triangles = data[0]
    elif is_core:
      triangles = data[1]
    else:
      triangles = data[0] + data[1]
    for triangle, _, _ in triangles:
      if (
        max(p[0] for p in triangle) < bounds[0]
        or min(p[0] for p in triangle) > bounds[2]
        or max(p[2] for p in triangle) < bounds[1]
        or min(p[2] for p in triangle) > bounds[3]
      ):
        continue
      points = triangle
      for axis, edge, lower in (
        (0, bounds[0], True),
        (0, bounds[2], False),
        (2, bounds[1], True),
        (2, bounds[3], False),
      ):
        points = _clip_axis(points, axis, edge, lower)
        if len(points) < 3:
          break
      for piece in _fan(points):
        # Reproduce PackedMesh's LOCAL Python rounding exactly, including its
        # binary-float half-centimetre ties. World rounding changes some keys.
        cm = [
          [
            round((x - bounds[0]) * 100) + round(bounds[0] * 100),
            round((y + 10) * 100) - 1000,
            round((z - bounds[1]) * 100) + round(bounds[1] * 100),
          ]
          for x, y, z in piece
        ]
        key = triangle_key(cm)
        lookup.setdefault(key, []).append(metadata["offsetY"])
    if mode == "drawn" and is_core == resident:
      for part in record["parts"]:
        for surface in part["surfaces"]:
          if surface["kind"] not in ("WallSurface", "RoofSurface", "ClosureSurface"):
            continue
          for ring in surface["rings"]:
            for a, b in zip(ring, ring[1:] + ring[:1], strict=True):
              a, b = np.asarray(a), np.asarray(b)
              delta = b - a
              t0, t1 = 0.0, 1.0
              for axis, low, high in (
                (0, bounds[0], bounds[2]),
                (2, bounds[1], bounds[3]),
              ):
                if abs(delta[axis]) < 1e-10:
                  if a[axis] < low or a[axis] > high:
                    t1 = -1
                    break
                else:
                  u, v = (low - a[axis]) / delta[axis], (high - a[axis]) / delta[axis]
                  t0, t1 = max(t0, min(u, v)), min(t1, max(u, v))
              if t1 <= t0:
                continue
              origin = np.asarray([bounds[0], -10, bounds[1]])
              ends = np.rint(
                (np.asarray([a + t0 * delta, a + t1 * delta]) - origin) * 100
              ).astype(np.int64) + np.rint(origin * 100).astype(np.int64)
              key = triangle_key(ends)
              if key not in lookup:
                lookup[key] = metadata["offsetY"]
  return lookup


def elevate_lines(
  lines: dict, origin: list, owners: Owners, exact: dict
) -> tuple[dict, dict]:
  """Retain every source segment and colour, lifting kerbs and rigid ink."""
  positions = np.frombuffer(base64.b64decode(lines["positions"]), dtype="<u2").reshape(
    -1, 2, 3
  )
  world = positions.astype(float) / 100 + np.asarray(origin)
  source_colors = (
    np.frombuffer(base64.b64decode(lines["colors"]), dtype="u1").reshape(-1, 2, 3)
    if lines.get("colors")
    else None
  )
  output, output_colors, receipts = [], [], []
  changed = 0
  for i, points in enumerate(world):
    key = triangle_key(
      positions[i].astype(np.int64) + np.rint(np.asarray(origin) * 100).astype(np.int64)
    )
    exact_offset = exact.get(key)
    start = len(output)
    if exact_offset is not None:
      altered = points.copy()
      altered[:, 1] += exact_offset
      segments = [altered]
      kind, offset = "rigid", exact_offset
    elif np.ptp(points[:, 1]) < 0.001 and abs(points[0, 1] - 3.13) < 0.002:
      # Split the original line only at terrain-grid/diagonal boundaries, so
      # kerb ink remains on the same piecewise-linear surface as its road.
      delta = points[1] - points[0]
      fractions = {0.0, 1.0}
      for axis, base in ((0, SUPPORT[0]), (2, SUPPORT[1])):
        if abs(delta[axis]) < 1e-12:
          continue
        low, high = sorted(points[:, axis])
        for k in range(
          math.floor((low - base) / STEP) + 1, math.ceil((high - base) / STEP)
        ):
          t = (base + k * STEP - points[0, axis]) / delta[axis]
          if 0 < t < 1:
            fractions.add(t)
      # Each cell has diagonal x-z=(support.x-support.z)+k*STEP.
      diagonal_delta = delta[0] - delta[2]
      if abs(diagonal_delta) > 1e-12:
        base = SUPPORT[0] - SUPPORT[1]
        lo, hi = sorted([points[0, 0] - points[0, 2], points[1, 0] - points[1, 2]])
        for k in range(
          math.floor((lo - base) / STEP) + 1, math.ceil((hi - base) / STEP)
        ):
          t = (base + k * STEP - points[0, 0] + points[0, 2]) / diagonal_delta
          if 0 < t < 1:
            fractions.add(t)
      path = [points[0] + t * delta for t in sorted(fractions)]
      for p in path:
        p[1] += sample_offset(p[0], p[2])
      segments = [np.asarray([a, b]) for a, b in zip(path[:-1], path[1:], strict=True)]
      kind, offset = "terrain", 0.0
    else:
      offset = owners.lookup(
        np.asarray([points[0], points[1], (points[0] + points[1]) / 2])
      )
      offset = offset or 0.0
      altered = points.copy()
      altered[:, 1] += offset
      segments = [altered]
      kind = "rigid"
    for segment in segments:
      local = np.rint((segment - np.asarray(origin)) * 100).astype(np.int64)
      if np.any(local < 0) or np.any(local > 65535):
        raise ValueError("Elevated source ink exceeds UInt16 coordinates")
      if kind == "terrain" and np.array_equal(local[0], local[1]):
        continue
      output.append(local)
      if source_colors is not None:
        output_colors.append(source_colors[i])
    count = len(output) - start
    changed += int(kind == "terrain" or offset != 0)
    tail = [kind, round(offset * 100), count]
    if receipts and receipts[-1][2:] == tail:
      receipts[-1][1] += 1
    else:
      receipts.append([i, 1, *tail])
  result = {**lines, "positions": array64(np.asarray(output, dtype="<u2"))}
  if source_colors is not None:
    result["colors"] = array64(np.asarray(output_colors, dtype="u1"))
  return result, {
    "sourceSegments": len(positions),
    "translatedSegments": changed,
    "resultSegments": len(output),
    "placementRuns": receipts,
  }


def _bounds_intersect(bounds: list) -> bool:
  return (
    bounds[0] < SUPPORT[2]
    and bounds[2] > SUPPORT[0]
    and bounds[1] < SUPPORT[3]
    and bounds[3] > SUPPORT[1]
  )


def transform_packet(
  packet: dict, owners: Owners, exact: dict, minecraft: bool, *, resident: bool = False
) -> tuple[dict, dict]:
  """Transform one bounded packet without changing its navigation footprints."""
  result = {**packet, "meshes": []}
  report = {"meshes": []}
  for mesh in packet["meshes"]:
    elevated, counts = elevate_mesh(
      mesh,
      packet["origin"],
      exact if mesh["kind"] == "alt-mitte-v169" else {},
      (lambda _points: None) if resident else owners.lookup,
      minecraft=minecraft,
      water_at=owners.water_at,
    )
    result["meshes"].append(elevated)
    report["meshes"].append({"kind": mesh["kind"], **counts})
  if packet.get("lines", {}).get("positions"):
    if resident:
      # Every resident source parent in this narrowly bounded outer repair has
      # zero placement weight. Keep its original source ink byte-exact.
      result["lines"] = packet["lines"]
      count = len(base64.b64decode(packet["lines"]["positions"])) // 12
      report["lines"] = {
        "sourceSegments": count,
        "resultSegments": count,
        "translatedSegments": 0,
        "placementRuns": [[0, count, "rigid", 0, 1]],
      }
    else:
      result["lines"], report["lines"] = elevate_lines(
        packet["lines"], packet["origin"], owners, exact
      )
  result["nav"] = {**packet["nav"], "buildings": []}
  for building in packet["nav"]["buildings"]:
    offset = owners.offsets.get(
      building.get("partId"), owners.offsets.get(building["sourceId"])
    )
    if offset is None:
      ring = [
        [x + packet["origin"][0], packet["nav"]["groundY"], z + packet["origin"][2]]
        for x, z in building["ring"]
      ]
      offset = owners.lookup(np.asarray(ring))
    result["nav"]["buildings"].append(
      {**building, "groundOffset": offset} if offset else building
    )
  return result, report


def split_packet(
  packet: dict, identity: str, bounds: list
) -> tuple[list[dict], list[int]]:
  """Keep runtime limits by moving complete ordered faces to bounded companions."""
  if fits(packet):
    return [packet], [1] * len(packet["meshes"])
  pieces, mesh_counts = [], []
  for mesh in packet["meshes"]:
    sliced = split_mesh(mesh)
    pieces.extend(sliced)
    mesh_counts.append(len(sliced))
  first = {**packet, "meshes": []}
  if not fits(first):
    raise ValueError(f"Navigation/ink-only packet exceeds budget: {identity}")
  results = [first]
  for mesh in pieces:
    next_packet = {**results[-1], "meshes": [*results[-1]["meshes"], mesh]}
    if fits(next_packet):
      results[-1] = next_packet
    else:
      companion = empty_packet(
        f"{identity}-weinberg-v176-{len(results)}", bounds, packet["origin"][1]
      )
      companion["meshes"] = [mesh]
      if not fits(companion):
        raise ValueError(f"Single lossless mesh piece exceeds budget: {identity}")
      results.append(companion)
  return results, mesh_counts


def transform_navigation(owners: Owners) -> list[dict]:
  """Bake only resident roof/solid heights; legacy suppression stays original."""
  manifest = json.loads(baseline(DATA / "altMitteV169Navigation.json"))
  changes = []
  roof_owners, cell_owners = {}, {}
  for source, metadata in zip(owners.records, owners.metadata, strict=True):
    if source["category"] != "core" or not source["parts"]:
      continue
    model = owners.model_cache(source)
    for triangle in model[4]:
      roof_owners[
        triangle_key(np.rint(np.asarray(triangle) * 1000).astype(np.int64))
      ] = metadata["offsetY"]
    for x, z, y in model[5]:
      key = (x, z)
      if key not in cell_owners or y > cell_owners[key][0]:
        cell_owners[key] = (y, metadata["offsetY"])
  for item in manifest["chunkFiles"]:
    field = item["field"]
    if field == "legacyPrisms":
      continue
    path = DATA / item["file"]
    raw = baseline(path)
    records = json.loads(raw)
    changed = 0
    output_records = []
    for record in records:
      if field == "parts":
        offset = owners.offsets.get(
          record.get("sourceId"), owners.offsets.get(record["id"], 0)
        )
        if offset:
          record["groundY"] = round(record["groundY"] + offset, 3)
          record["topY"] = round(record["topY"] + offset, 3)
          changed += 1
      elif field == "roofTriangles":
        offset = roof_owners.get(
          triangle_key(np.rint(np.asarray(record) * 1000).astype(np.int64)), 0
        )
        if offset:
          for p in record:
            p[1] = round(p[1] + offset, 3)
          changed += 1
      elif field == "nativeRoofSpans":
        x0, z0, x1, z1, y = record
        if _bounds_intersect([x0, z0, x1, z1]):
          # A lossless roof union may cross owner boundaries. Resolve original
          # metre cells before recompressing, never lift a whole merged run by
          # whichever parent happens to occupy its centre.
          for z in range(z0, z1):
            run_start, run_offset = x0, None
            for x in range(x0, x1):
              source_top, offset = cell_owners.get((x, z), (y, 0.0))
              if abs(source_top - y) > 0.001:
                offset = 0.0
              if run_offset is not None and offset != run_offset:
                output_records.append(
                  [run_start, z, x, z + 1, round(y + run_offset, 3)]
                )
                run_start = x
              run_offset = offset
              changed += int(offset != 0)
            output_records.append(
              [run_start, z, x1, z + 1, round(y + (run_offset or 0), 3)]
            )
          continue
      output_records.append(record)
    if changed:
      path.write_bytes(encode(output_records))
      changes.append(
        {
          "file": str(path.relative_to(ROOT)),
          "field": field,
          "records": len(records),
          "translatedRecords": changed,
          "sourceSha256": hashlib.sha256(raw).hexdigest(),
          "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        }
      )
  return changes


def generate() -> dict:
  """Publish only intersecting existing assets; leave all other bytes alone."""
  owners = Owners()
  owners.write()
  manifest_path = OUTER / "manifest.json"
  manifest = json.loads(baseline(manifest_path))
  report: dict = {
    "schemaVersion": 1,
    "baseRelease": BASE,
    "support": SUPPORT,
    "parents": len(owners.records),
    "packets": [],
    "navigation": [],
  }
  exact_cache = {}
  new_descriptors = []
  for descriptor in manifest["chunks"]:
    bounds = descriptor["bounds"]
    if not owners.placement_area.intersects(box(*bounds)):
      continue
    mode_splits = {}
    for mode in ("drawn", "minecraft"):
      asset = descriptor[mode]
      path = OUTER / asset["url"]
      original = baseline(path)
      packet = json.loads(gzip.decompress(original))
      key = (*bounds, mode, False)
      if key not in exact_cache:
        exact_cache[key] = exact_owner_lookup(owners, bounds, mode, False)
      result, audit = transform_packet(
        packet, owners, exact_cache[key], mode == "minecraft"
      )
      splits, mesh_counts = split_packet(result, descriptor["id"], bounds)
      mode_splits[mode] = splits
      audit["resultMeshPieces"] = mesh_counts
      audit["outputFiles"] = [
        str(
          (
            OUTER
            / (
              asset["url"]
              if i == 0
              else f"{descriptor['id']}-weinberg-v176-{i}.{mode}.json.gz"
            )
          ).relative_to(ROOT)
        )
        for i in range(len(splits))
      ]
      raw = encode(splits[0])
      compressed = gzip.compress(raw, compresslevel=9, mtime=0)
      path.write_bytes(compressed)
      asset.update(
        bytes=len(compressed),
        decodedBytes=len(raw),
        sha256=hashlib.sha256(compressed).hexdigest(),
      )
      report["packets"].append(
        {
          "id": descriptor["id"],
          "mode": mode,
          "file": str(path.relative_to(ROOT)),
          "sourceSha256": hashlib.sha256(original).hexdigest(),
          "sha256": asset["sha256"],
          "sourceBytes": len(original),
          "bytes": len(compressed),
          **audit,
        }
      )
      print(
        f"{descriptor['id']} {mode}: {len(original):,} → {len(compressed):,} bytes",
        flush=True,
      )
    for i in range(1, max(map(len, mode_splits.values()))):
      identity = f"{descriptor['id']}-weinberg-v176-{i}"
      companion = {
        "id": identity,
        "bounds": bounds,
        "buildingCount": 0,
        "detailCompanionOf": descriptor.get("detailCompanionOf", descriptor["id"]),
      }
      for mode, splits in mode_splits.items():
        packet = splits[i] if i < len(splits) else empty_packet(identity, bounds)
        raw = encode(packet)
        compressed = gzip.compress(raw, compresslevel=9, mtime=0)
        filename = f"{identity}.{mode}.json.gz"
        (OUTER / filename).write_bytes(compressed)
        companion[mode] = {
          "url": filename,
          "encoding": "gzip",
          "bytes": len(compressed),
          "decodedBytes": len(raw),
          "sha256": hashlib.sha256(compressed).hexdigest(),
        }
      new_descriptors.append(companion)
  manifest["chunks"].extend(new_descriptors)
  manifest_path.write_bytes(encode(manifest))
  exact_cache.clear()
  for name, mode in (
    ("altMitteDrawnV169Source.json", "drawn"),
    ("altMitteNativeV169Source.json", "minecraft"),
  ):
    core = json.loads(baseline(DATA / name))
    for entry in core["chunkFiles"]:
      path = DATA / entry["file"]
      original = baseline(path)
      packet = json.loads(original)
      x, _, z = packet["origin"]
      bounds = [x, z, x + 512, z + 512]
      if not _bounds_intersect(bounds):
        continue
      key = (*bounds, mode, True)
      if key not in exact_cache:
        exact_cache[key] = exact_owner_lookup(owners, bounds, mode, True)
      result, audit = transform_packet(
        packet, owners, exact_cache[key], mode == "minecraft", resident=True
      )
      if not fits(result):
        raise ValueError(
          f"Resident packet exceeded unchanged topology budget: {entry['id']}"
        )
      content = encode(result)
      path.write_bytes(content)
      report["packets"].append(
        {
          "id": entry["id"],
          "mode": mode,
          "resident": True,
          "file": str(path.relative_to(ROOT)),
          "sourceSha256": hashlib.sha256(original).hexdigest(),
          "sha256": hashlib.sha256(content).hexdigest(),
          "sourceBytes": len(original),
          "bytes": len(content),
          **audit,
        }
      )
      print(f"resident {entry['id']} {mode}", flush=True)
  report["navigation"] = transform_navigation(owners)
  report["coincidentOwnerDecisions"] = [
    {"owners": list(k), "count": v} for k, v in owners.ambiguous.items()
  ]
  report["unownedSamples"] = [
    {"cell": list(k), "count": v} for k, v in owners.unowned.items()
  ]
  REPORT.write_bytes(encode(report))
  return report


def refresh_ground_packets() -> None:
  """Rebuild the four primary ground packets from BASE, retaining owner receipts.

  This bounded refresh is for ground-only adapter corrections after a complete
  generation. Existing companions keep their source detail unchanged; generated
  geometry-only companions receive the corresponding complete mesh pieces.
  """
  owners = Owners()
  manifest_path = OUTER / "manifest.json"
  manifest = json.loads(manifest_path.read_bytes())
  descriptors = {entry["id"]: entry for entry in manifest["chunks"]}
  report = json.loads(REPORT.read_bytes())
  pending: dict[Path, bytes] = {}
  original_manifest = json.loads(baseline(manifest_path))
  for descriptor in original_manifest["chunks"]:
    if descriptor.get("detailCompanionOf") or not _bounds_intersect(
      descriptor["bounds"]
    ):
      continue
    for mode in ("drawn", "minecraft"):
      path = OUTER / descriptor[mode]["url"]
      original = baseline(path)
      packet = json.loads(gzip.decompress(original))
      exact = exact_owner_lookup(owners, descriptor["bounds"], mode, False)
      result, audit = transform_packet(packet, owners, exact, mode == "minecraft")
      splits, mesh_counts = split_packet(result, descriptor["id"], descriptor["bounds"])
      previous = next(
        p for p in report["packets"] if p["file"] == str(path.relative_to(ROOT))
      )
      if len(splits) != len(previous["outputFiles"]):
        raise ValueError("Ground refresh changed companion count; run full generation")
      audit["resultMeshPieces"] = mesh_counts
      audit["outputFiles"] = previous["outputFiles"]
      first_compressed = b""
      for i, split in enumerate(splits):
        output_path = ROOT / previous["outputFiles"][i]
        content = encode(split)
        compressed = gzip.compress(content, compresslevel=9, mtime=0)
        pending[output_path] = compressed
        identity = (
          descriptor["id"] if i == 0 else f"{descriptor['id']}-weinberg-v176-{i}"
        )
        descriptors[identity][mode].update(
          bytes=len(compressed),
          decodedBytes=len(content),
          sha256=hashlib.sha256(compressed).hexdigest(),
        )
        if i == 0:
          first_compressed = compressed
      previous.update(
        **audit,
        sha256=hashlib.sha256(first_compressed).hexdigest(),
        bytes=len(first_compressed),
      )
      print(f"Refreshed {descriptor['id']} {mode}", flush=True)
  pending[manifest_path] = encode(manifest)
  pending[REPORT] = encode(report)
  for path, content in pending.items():
    path.write_bytes(content)


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--offsets-only", action="store_true")
  parser.add_argument("--refresh-ground", action="store_true")
  arguments = parser.parse_args()
  if arguments.offsets_only:
    Owners().write()
  elif arguments.refresh_ground:
    refresh_ground_packets()
  else:
    generate()
