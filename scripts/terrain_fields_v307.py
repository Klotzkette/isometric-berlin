"""Finite offline composition of disjoint measured terrain fields.

The input is a complete, already rendered predecessor (including its UInt16
paint). Every source triangle is clipped against the UNION once. New terrain
belongs to its complete required field root; unchanged outside fragments belong
to the original streamed packet. This module never writes a source or packet.
"""

from __future__ import annotations

import base64
import hashlib
import math
from dataclasses import dataclass
from typing import Any, Callable

import numpy as np
from shapely import constrained_delaunay_triangles
from shapely.geometry import LineString, Point, Polygon, box
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union


@dataclass(frozen=True)
class TerrainFieldV307:
  """A finite measured DELTA, never an inferred absolute baseline.

  Drawn offsets are piecewise planar on the NW/SE grid diagonal. Native offsets
  sample the same world-aligned cell centres as the represented native surface.
  The baseline callback identifies existing native skirt endpoints; it is not
  used to replace any original source height or source point.
  """

  key: str
  domain: BaseGeometry
  bounds: tuple[float, float, float, float]
  step: float
  sample_offset: Callable[[float, float, bool], float]
  baseline_height: Callable[[float, float, bool], float]


def polygons_v307(value: BaseGeometry) -> list[Polygon]:
  """Return complete polygon members without deleting holes."""
  if value.is_empty:
    return []
  if isinstance(value, Polygon):
    return [value]
  return [p for g in getattr(value, "geoms", []) for p in polygons_v307(g)]


def triangulate_v307(value: BaseGeometry) -> list[np.ndarray]:
  """Constrained complete triangulation of every polygon and interior ring."""
  return [
    np.asarray(t.exterior.coords[:3], dtype=float)
    for p in polygons_v307(value)
    for t in constrained_delaunay_triangles(p).geoms
  ]


class TerrainMeshV307:
  """Centimetre positions and full predecessor UInt16 linear RGB."""

  def __init__(self, origin: list[float]) -> None:
    self.origin = np.rint(np.asarray(origin) * 100).astype(np.int64)
    self.vertices: list[tuple[int, ...]] = []
    self.lookup: dict[tuple[int, ...], int] = {}
    self.indices: list[int] = []

  def add(self, points: np.ndarray, colors: np.ndarray) -> None:
    """Append without integer wrap or a second colour-space conversion."""
    xyz = np.rint(points * 100).astype(np.int64) - self.origin
    rgb = np.rint(colors).astype(np.int64)
    if np.min(xyz) < 0 or np.max(xyz) > 65535:
      raise ValueError("Terrain field escaped the complete source packet origin")
    if np.min(rgb) < 0 or np.max(rgb) > 65535:
      raise ValueError("Terrain source colour escaped UInt16")
    if len({tuple(v) for v in xyz}) < 3:
      return
    for p, c in zip(xyz, rgb, strict=True):
      key = tuple(map(int, np.concatenate((p, c))))
      at = self.lookup.get(key)
      if at is None:
        at = len(self.vertices)
        self.lookup[key] = at
        self.vertices.append(key)
      self.indices.append(at)

  def packed(self) -> dict[str, Any] | None:
    """Return a standalone required-root mesh, not a runtime packet mutation."""
    if not self.indices:
      return None
    data = np.asarray(self.vertices, dtype="<u2")
    return {
      "positionType": "u16cm",
      "colorType": "u16linear",
      "origin": (self.origin / 100).tolist(),
      "positions": base64.b64encode(data[:, :3].tobytes()).decode(),
      "colors": base64.b64encode(data[:, 3:].tobytes()).decode(),
      "indices": base64.b64encode(
        np.asarray(self.indices, dtype="<u4").tobytes()
      ).decode(),
      "vertices": len(data),
      "triangles": len(self.indices) // 3,
    }


def native_domain_v307(field: TerrainFieldV307) -> BaseGeometry:
  """Exactly the native field's source-centre-selected cardinal footprint."""
  s = field.step
  w, n, e, b = field.domain.bounds
  rows = []
  for z in range(math.floor(n / s), math.ceil(b / s)):
    start: int | None = None
    for x in range(math.floor(w / s), math.ceil(e / s) + 1):
      inside = field.domain.covers(Point((x + 0.5) * s, (z + 0.5) * s))
      if inside and start is None:
        start = x
      elif not inside and start is not None:
        rows.append(box(start * s, z * s, x * s, (z + 1) * s))
        start = None
  return unary_union(rows)


def native_skirt_delta_v307(
  field: TerrainFieldV307, x: float, y: float, z: float
) -> float | None:
  """Recognize a real old ground endpoint on either side of its grid edge.

  Native old terrain already contains vertical cell skirts. Matching its actual
  baseline (including the tiny retained path lifts) avoids moving a wall or
  building that merely happens to cross the field. The tie is deterministic.
  """
  candidates = []
  for dx in (-0.002, 0.002):
    for dz in (-0.002, 0.002):
      baseline = field.baseline_height(x + dx, z + dz, True)
      error = min(
        abs(y - baseline - lift)
        for lift in (0, 0.01, 0.015, 0.035, 0.05, 0.07, 0.09, 0.12, 0.15)
      )
      if error < 0.021:
        candidates.append((error, field.sample_offset(x + dx, z + dz, True)))
  return min(candidates)[1] if candidates else None


def _compile_skirt_v307(
  p: np.ndarray,
  c: np.ndarray,
  fields: list[TerrainFieldV307],
  domains: list[BaseGeometry],
  outside: TerrainMeshV307,
  changed: dict[str, TerrainMeshV307],
) -> dict[str, Any] | None:
  """Clip one existing vertical source triangle once in its true local plane."""
  spans = np.ptp(p[:, [0, 2]], axis=0)
  axis = 0 if spans[0] >= spans[1] else 2
  if max(spans) < 1e-7 or min(spans) > 0.002:
    return None
  a, b = p[np.argmin(p[:, axis]), [0, 2]], p[np.argmax(p[:, axis]), [0, 2]]
  line = LineString((a, b))
  plane = Polygon(p[:, [axis, 1]])
  if plane.area < 1e-8:
    return None
  intervals: list[tuple[TerrainFieldV307, float, float]] = []
  for field, domain in zip(fields, domains, strict=True):
    if any(native_skirt_delta_v307(field, *map(float, q)) is None for q in p):
      continue
    cut = line.intersection(domain)
    for member in [cut] if cut.geom_type == "LineString" else getattr(cut, "geoms", []):
      if member.geom_type == "LineString" and member.length > 1e-7:
        coordinate = 0 if axis == 0 else 1
        ends = sorted((member.coords[0][coordinate], member.coords[-1][coordinate]))
        intervals.append((field, *ends))
  if not intervals:
    return None
  slabs = [
    box(start, p[:, 1].min() - 1, end, p[:, 1].max() + 1) for _, start, end in intervals
  ]
  matrix = np.vstack((p[:, [axis, 1]].T, np.ones(3)))
  inverse = np.linalg.inv(matrix)
  normal = np.cross(p[1] - p[0], p[2] - p[0])

  def emit(
    target: TerrainMeshV307, uv: np.ndarray, field: TerrainFieldV307 | None = None
  ) -> None:
    weights = np.c_[uv, np.ones(len(uv))] @ inverse.T
    xyz, rgb = weights @ p, weights @ c.astype(float)
    if field:
      deltas = [native_skirt_delta_v307(field, *map(float, q)) for q in xyz]
      if any(d is None for d in deltas):
        # The old skirt's intermediate vertical points need the affine
        # continuation of the same matched source triangle endpoints.
        endpoints = np.array(
          [native_skirt_delta_v307(field, *map(float, q)) for q in p], dtype=float
        )
        deltas = (weights @ endpoints).tolist()
      xyz[:, 1] += deltas
    if np.dot(np.cross(xyz[1] - xyz[0], xyz[2] - xyz[0]), normal) < 0:
      xyz, rgb = xyz[[0, 2, 1]], rgb[[0, 2, 1]]
    target.add(xyz, rgb)

  complement = plane.difference(unary_union(slabs))
  for triangle in triangulate_v307(complement):
    emit(outside, triangle)
  receipts = []
  for (field, start, end), slab in zip(intervals, slabs, strict=True):
    target = changed[field.key]
    begin = len(target.indices) // 3
    # Subdivide at the actual independent native world-grid edges.
    stops = [
      start,
      *[
        float(q)
        for q in range(math.ceil(start / 4) * 4, math.ceil(end / 4) * 4, 4)
        if start < q < end
      ],
      end,
    ]
    for left, right in zip(stops, stops[1:]):
      for triangle in triangulate_v307(
        plane.intersection(box(left, p[:, 1].min() - 1, right, p[:, 1].max() + 1))
      ):
        emit(target, triangle, field)
    receipts.append(
      [
        field.key,
        begin,
        len(target.indices) // 3 - begin,
        plane.intersection(slab).area,
      ]
    )
  return {
    "verticalSourcePlane": True,
    "sourceAreaM2": plane.area,
    "outsideAreaM2": complement.area,
    "fields": receipts,
  }


def compile_ground_v307(
  parts: list[dict[str, Any]],
  origin: list[float],
  fields: list[TerrainFieldV307],
  *,
  native: bool = False,
  ground_predicate: Callable[[str, np.ndarray, np.ndarray], bool] | None = None,
) -> dict[str, Any]:
  """Clip one complete predecessor only once across all disjoint fields.

  Each part uses local centimetre U16 positions, FULL linear U16 RGB and local
  U32 indices after earlier exact retirements. Original part ordinals remain the
  destination ordinals. Zero-area already-retired triangles never gain a new
  copy. New field geometry and the untouched outside complement are separate.
  """
  if len(origin) != 3 or not all(math.isfinite(q) for q in origin):
    raise ValueError("A complete finite source origin is required")
  if not fields or len({f.key for f in fields}) != len(fields):
    raise ValueError("Unique nonempty terrain fields required")
  for i, f in enumerate(fields):
    if f.step != 4 or f.domain.is_empty or not f.domain.is_valid:
      raise ValueError("A valid bounded four-metre field is required")
    for previous in fields[:i]:
      if f.domain.intersection(previous.domain).area > 1e-7:
        raise ValueError("Terrain field domains overlap")
  domains = [native_domain_v307(f) if native else f.domain for f in fields]
  for i, domain in enumerate(domains):
    if any(domain.intersection(d).area > 1e-7 for d in domains[:i]):
      raise ValueError("Native field centre selection overlaps")
  domain_union = unary_union(domains)
  result: dict[str, Any] = {"schemaVersion": 1, "native": native, "parts": []}
  for part in parts:
    points = np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(-1, 3)
    points = points.astype(float) / 100 + np.asarray(origin)
    colors = np.frombuffer(base64.b64decode(part["colors"]), "<u2").reshape(-1, 3)
    indices = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
    if len(colors) != len(points) or (indices.size and indices.max() >= len(points)):
      raise ValueError("Complete finite predecessor attributes required")
    outside = TerrainMeshV307(origin)
    changed = {f.key: TerrainMeshV307(origin) for f in fields}
    retired, proof = [], []
    triangle_bounds = points[indices][:, :, [0, 2]]
    minimum = triangle_bounds.min(axis=1)
    maximum = triangle_bounds.max(axis=1)
    candidates = np.zeros(len(indices), dtype=bool)
    for domain in domains:
      w, n, e, b = domain.bounds
      candidates |= (
        (minimum[:, 0] <= e)
        & (maximum[:, 0] >= w)
        & (minimum[:, 1] <= b)
        & (maximum[:, 1] >= n)
      )
    for ordinal in np.flatnonzero(candidates):
      ordinal = int(ordinal)
      triangle = indices[ordinal]
      p, c = points[triangle], colors[triangle]
      if len(set(map(tuple, p))) < 3:
        continue
      footprint = Polygon(p[:, [0, 2]])
      if footprint.area < 1e-9:
        if native and part["kind"] == "city":
          skirt = _compile_skirt_v307(p, c, fields, domains, outside, changed)
          if skirt is not None:
            retired.append(ordinal)
            proof.append({"sourceTriangle": ordinal, **skirt})
        continue
      if ground_predicate is not None:
        if not ground_predicate(part["kind"], p, c):
          continue
      elif (
        part["kind"] != "city"
        or np.ptp(p[:, 1]) > 0.002
        or not any(
          abs(p[0, 1] - grade) < 0.003 for grade in (3, 3.01, 3.09, 3.12, 3.15)
        )
      ):
        continue
      if not footprint.intersects(domain_union):
        continue
      intersections = [footprint.intersection(d) for d in domains]
      if sum(q.area for q in intersections) < 1e-9:
        continue
      # Preserve the full original plane and its linear RGB interpolation.
      matrix = np.vstack((p[:, [0, 2]].T, np.ones(3)))
      inverse = np.linalg.inv(matrix)

      def lift(xz: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        weights = np.c_[xz, np.ones(len(xz))] @ inverse.T
        xyz = np.c_[xz[:, 0], weights @ p[:, 1], xz[:, 1]]
        return xyz, weights @ c.astype(float)

      sign = np.cross(p[1] - p[0], p[2] - p[0])[1]

      def emit(
        target: TerrainMeshV307,
        xz: np.ndarray,
        delta: float | None = None,
        field: TerrainFieldV307 | None = None,
      ) -> None:
        xyz, rgb = lift(xz)
        if delta is not None:
          # A native top is one horizontal source plane. Barycentric floating
          # noise at a half-centimetre endpoint must not round its vertices to
          # alternating centimetres and introduce diagonal one-centimetre faces.
          if native and np.ptp(p[:, 1]) < 0.0001:
            xyz[:, 1] = (round(float(p[0, 1]) * 100) + delta * 100) / 100
          else:
            xyz[:, 1] += delta
        elif field is not None:
          xyz[:, 1] += [field.sample_offset(float(x), float(z), False) for x, z in xz]
        if np.cross(xyz[1] - xyz[0], xyz[2] - xyz[0])[1] * sign < 0:
          xyz, rgb = xyz[[0, 2, 1]], rgb[[0, 2, 1]]
        target.add(xyz, rgb)

      start_out = len(outside.indices) // 3
      complement = footprint.difference(domain_union)
      for t in triangulate_v307(complement):
        emit(outside, t)
      receipts = []
      for field, inside in zip(fields, intersections, strict=True):
        if inside.area < 1e-9:
          continue
        target = changed[field.key]
        start = len(target.indices) // 3
        s = field.step
        w, n, e, b = inside.bounds
        for iz in range(math.floor(n / s), math.ceil(b / s)):
          for ix in range(math.floor(w / s), math.ceil(e / s)):
            x, z = ix * s, iz * s
            cell = inside.intersection(box(x, z, x + s, z + s))
            if cell.area < 1e-9:
              continue
            if native:
              delta = field.sample_offset(x + s / 2, z + s / 2, True)
              for t in triangulate_v307(cell):
                emit(target, t, delta)
              # Each world-grid edge is emitted once. The old source plane and
              # paint are retained at all edge endpoints. Native terrain adds
              # real vertical risers rather than cracks between cell tops.
              for a, q, neighbour in [
                ((x + s, z), (x + s, z + s), (x + 1.5 * s, z + s / 2)),
                ((x, z + s), (x + s, z + s), (x + s / 2, z + 1.5 * s)),
              ]:
                other = field.sample_offset(*neighbour, True)
                if abs(delta - other) < 0.005:
                  continue
                line = LineString((a, q)).intersection(cell)
                for member in (
                  [line]
                  if line.geom_type == "LineString"
                  else getattr(line, "geoms", [])
                ):
                  if member.geom_type != "LineString" or member.length < 1e-7:
                    continue
                  endpoints = np.asarray([member.coords[0], member.coords[-1]])
                  xyz, rgb = lift(endpoints)
                  lo, hi = xyz.copy(), xyz.copy()
                  lo[:, 1] += min(delta, other)
                  hi[:, 1] += max(delta, other)
                  for order in ([0, 1, 2], [2, 1, 3]):
                    wall = np.vstack((lo, hi))
                    paint = np.vstack((rgb, rgb))
                    target.add(wall[order], paint[order])
            else:
              # The two exact grid planes; no bilinear shortcut introduces an
              # invisible height disagreement with the walking sampler.
              for half in [
                Polygon(((x, z), (x + s, z), (x + s, z + s))),
                Polygon(((x, z), (x + s, z + s), (x, z + s))),
              ]:
                for t in triangulate_v307(cell.intersection(half)):
                  emit(target, t, field=field)
        receipts.append(
          [field.key, start, len(target.indices) // 3 - start, inside.area]
        )
      retired.append(ordinal)
      proof.append(
        {
          "sourceTriangle": ordinal,
          "sourcePositionSha256": hashlib.sha256(
            np.asarray(p, dtype="<f8").tobytes()
          ).hexdigest(),
          "sourceAreaM2": footprint.area,
          "outsideAreaM2": complement.area,
          "outsideTriangles": len(outside.indices) // 3 - start_out,
          "fields": receipts,
        }
      )
      if abs(
        complement.area + sum(q.area for q in intersections) - footprint.area
      ) > max(1e-7, footprint.area * 1e-10):
        raise ValueError("Terrain union lost an original source footprint")
    if retired:
      result["parts"].append(
        {
          "mesh": part["mesh"],
          "kind": part["kind"],
          "retireTriangles": retired,
          "outside": outside.packed(),
          "fields": {k: v.packed() for k, v in changed.items() if v.indices},
          "provenance": proof,
        }
      )
  return result
