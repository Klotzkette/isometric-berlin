"""Exact source-ground clipping for the existing Humboldthain core aperture.

Float32 source positions, normals, instance paint and all original material
parameters survive. Old triangles/instance ordinals are immutable recipes for
an external atomic reversible hook; this script never edits their sources.
"""

from __future__ import annotations

import argparse
import base64
import math
from pathlib import Path
from typing import Any

import numpy as np
from build_north_park_terrain_v306 import baseline_height_v306, sample_offset_v306
from build_rail_sse_v307 import DATA, GEO, ROOT, read_v307, sha_v307, write_v307
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import unary_union
from terrain_fields_v307 import (
  TerrainFieldV307,
  native_domain_v307,
  triangulate_v307,
)

_PROFILE_DOMAINS_V307: dict[int, Any] = {}

TARGETS = {
  "Drawn ground slabs",
  "Voxel ground runs",
  "smooth parkland lawns",
  "smooth garden beds",
  "smooth paved paths",
  "smooth park paths",
  "smooth earth desire paths",
  "smooth timber paths",
  "smooth carriageways",
  "smooth kerb upstands",
}
DTYPES = {
  "Float32Array": "<f4",
  "Uint16Array": "<u2",
  "Uint32Array": "<u4",
  "Uint8Array": "u1",
}


def encoded_v307(a: np.ndarray) -> str:
  return base64.b64encode(a.tobytes()).decode()


class FloatMeshV307:
  def __init__(self, materials: dict[str, Any], key: str, native: bool) -> None:
    self.materials = materials
    self.key = key
    self.native = native
    self.vertices: list[tuple] = []
    self.lookup: dict[tuple, int] = {}
    self.indices: list[int] = []

  def add(self, p: np.ndarray, c: np.ndarray, n: np.ndarray) -> None:
    p, c, n = [np.asarray(v, dtype="<f4") for v in (p, c, n)]
    if np.linalg.norm(np.cross(p[1] - p[0], p[2] - p[0])) < 1e-10:
      return
    for a, b, d in zip(p, c, n, strict=True):
      key = (*map(float, a), *map(float, b), *map(float, d))
      at = self.lookup.get(key)
      if at is None:
        at = len(self.vertices)
        self.lookup[key] = at
        self.vertices.append(key)
      self.indices.append(at)

  def packed(self) -> dict[str, Any] | None:
    if not self.indices:
      return None
    v = np.asarray(self.vertices, dtype="<f4")
    return dict(
      key=self.key,
      field="humboldthain",
      native=self.native,
      positionType="f32",
      colorType="f32linear",
      origin=[0, 0, 0],
      positions=encoded_v307(v[:, :3]),
      colors=encoded_v307(v[:, 3:6]),
      normals=encoded_v307(v[:, 6:9]),
      indices=encoded_v307(np.asarray(self.indices, dtype="<u4")),
      vertices=len(v),
      triangles=len(self.indices) // 3,
      materials=self.materials,
    )


def core_sampler_v307() -> Any:
  payload = read_v307(
    ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json"
  )
  cell = payload["cell_m"]
  grid = payload["grid"]
  h = payload["ground_height"]

  def sample(x: float, z: float) -> float:
    u = (x / cell - grid["min_x_idx"]) / h["stride_cells"] - 0.5
    v = (z / cell - grid["min_z_idx"]) / h["stride_cells"] - 0.5
    i, j = math.floor(u), math.floor(v)
    a, b = u - i, v - j
    cols, rows = h["cols"], h["rows"]

    def at(i: int, j: int) -> float:
      return h["y_dm"][min(rows - 1, max(0, j)) * cols + min(cols - 1, max(0, i))] / 10

    return (at(i, j) * (1 - a) + at(i + 1, j) * a) * (1 - b) + (
      at(i, j + 1) * (1 - a) + at(i + 1, j + 1) * a
    ) * b

  return sample


def split_triangle_v307(
  p: np.ndarray,
  c: np.ndarray,
  normals: np.ndarray,
  profile: dict[str, Any],
  domain: Any,
  inside: FloatMeshV307,
  outside: FloatMeshV307,
  native: bool,
  old_base: Any,
  instance_centre: np.ndarray | None = None,
) -> bool:
  """Exact source-plane outside; measured inside, once per original triangle."""
  footprint = Polygon(p[:, [0, 2]])
  sign = np.cross(p[1] - p[0], p[2] - p[0])
  native_source_top = float(instance_centre[1]) if instance_centre is not None else None

  smooth_domain = _PROFILE_DOMAINS_V307.get(id(profile))
  if smooth_domain is None:
    smooth_domain = shape(profile["domain"])
    _PROFILE_DOMAINS_V307[id(profile)] = smooth_domain

  def delta(x: float, z: float) -> float:
    sx, sz = x, z
    if native:
      # Choose the cell on the actual source member's occupied side of a wall.
      if instance_centre is not None:
        sx += 0.002 * float(np.sign(instance_centre[0] - sx))
        sz += 0.002 * float(np.sign(instance_centre[2] - sz))
      sx, sz = math.floor(sx / 4) * 4 + 2, math.floor(sz / 4) * 4 + 2
    point = Point(sx, sz)
    if not smooth_domain.covers(point):
      return 0
    t = min(1, smooth_domain.boundary.distance(point) / 16)
    weight = t * t * (3 - 2 * t)
    baseline = (
      old_base(sx, sz) if not native or native_source_top is None else native_source_top
    )
    return sample_offset_v306(profile, sx, sz, native) + weight * (
      baseline_height_v306(sx, sz, native) - baseline
    )

  if footprint.area > 1e-10:
    cut = footprint.intersection(domain)
    if cut.area < 1e-10:
      return False
    inverse = np.linalg.inv(np.vstack((p[:, [0, 2]].T, np.ones(3))))

    def emit(target: FloatMeshV307, uv: np.ndarray, change: bool) -> None:
      weights = np.c_[uv, np.ones(3)] @ inverse.T
      xyz = weights @ p
      rgb = weights @ c
      nn = weights @ normals
      if change:
        centre = uv.mean(axis=0)
        if native:
          offset = delta(float(centre[0]), float(centre[1]))
          # One native source top has one scalar plane. Retain the actual old
          # source height while preventing barycentric noise at an F32 half-ULP
          # from making two vertices of the new horizontal face disagree.
          if np.ptp(p[:, 1]) < 1e-10:
            xyz[:, 1] = p[0, 1] + offset
          else:
            xyz[:, 1] += offset
        else:
          xyz[:, 1] += [delta(float(x), float(z)) for x, z in uv]
      if np.dot(np.cross(xyz[1] - xyz[0], xyz[2] - xyz[0]), sign) < 0:
        xyz, rgb, nn = xyz[[0, 2, 1]], rgb[[0, 2, 1]], nn[[0, 2, 1]]
      target.add(xyz, rgb, nn)

    for triangle in triangulate_v307(footprint.difference(domain)):
      emit(outside, triangle, False)
    w, n, e, b = cut.bounds
    for z in range(math.floor(n / 4) * 4, math.ceil(b / 4) * 4, 4):
      for x in range(math.floor(w / 4) * 4, math.ceil(e / 4) * 4, 4):
        cell = cut.intersection(box(x, z, x + 4, z + 4))
        halves = (
          [cell]
          if native
          else [
            cell.intersection(Polygon([(x, z), (x + 4, z), (x + 4, z + 4)])),
            cell.intersection(Polygon([(x, z), (x + 4, z + 4), (x, z + 4)])),
          ]
        )
        for half in halves:
          for triangle in triangulate_v307(half):
            emit(inside, triangle, True)
    return True
  # Vertical source faces are clipped in their true (distance,elevation) plane.
  pairs = [(a, b) for a in p[:, [0, 2]] for b in p[:, [0, 2]]]
  a, b = max(pairs, key=lambda q: float(np.linalg.norm(q[1] - q[0])))
  length = float(np.linalg.norm(b - a))
  if length < 1e-8:
    return False
  direction = (b - a) / length
  u = (p[:, [0, 2]] - a) @ direction
  plane = Polygon(np.c_[u, p[:, 1]])
  if plane.area < 1e-10:
    return False
  line = LineString([a, b]).intersection(domain)
  intervals = []
  for q in [line] if line.geom_type == "LineString" else getattr(line, "geoms", []):
    if q.geom_type == "LineString" and q.length > 1e-8:
      intervals.append(
        sorted(
          (
            float((np.asarray(q.coords[0]) - a) @ direction),
            float((np.asarray(q.coords[-1]) - a) @ direction),
          )
        )
      )
  if not intervals:
    return False
  slabs = [box(lo, p[:, 1].min() - 1, hi, p[:, 1].max() + 1) for lo, hi in intervals]
  inverse = np.linalg.inv(np.vstack((np.c_[u, p[:, 1]].T, np.ones(3))))

  def emit_vertical(target: FloatMeshV307, uv: np.ndarray, change: bool) -> None:
    weights = np.c_[uv, np.ones(3)] @ inverse.T
    xyz = weights @ p
    rgb = weights @ c
    nn = weights @ normals
    if change:
      centre = xyz.mean(axis=0)
      xyz[:, 1] += (
        [delta(float(centre[0]), float(centre[2]))] * 3
        if native
        else [delta(float(x), float(z)) for x, y, z in xyz]
      )
    if np.dot(np.cross(xyz[1] - xyz[0], xyz[2] - xyz[0]), sign) < 0:
      xyz, rgb, nn = xyz[[0, 2, 1]], rgb[[0, 2, 1]], nn[[0, 2, 1]]
    target.add(xyz, rgb, nn)

  for t in triangulate_v307(plane.difference(unary_union(slabs))):
    emit_vertical(outside, t, False)
  for lo, hi in intervals:
    stops = {lo, hi}
    for axis in (0, 1):
      if abs(direction[axis]) < 1e-8:
        continue
      for value in range(
        math.floor(min(a[axis], b[axis]) / 4) * 4,
        math.ceil(max(a[axis], b[axis]) / 4) * 4 + 4,
        4,
      ):
        at = (value - a[axis]) / direction[axis]
        if lo < at < hi:
          stops.add(float(at))
    stops = sorted(stops)
    for left, right in zip(stops, stops[1:]):
      for triangle in triangulate_v307(
        plane.intersection(box(left, p[:, 1].min() - 1, right, p[:, 1].max() + 1))
      ):
        emit_vertical(inside, triangle, True)
  return True


def compile_core_v307(captures: Path) -> None:
  profile = next(
    p
    for p in read_v307(DATA / "northParkTerrainV306.json")["profiles"]
    if p["key"] == "humboldthain"
  )
  drawn_domain = shape(profile["domain"])
  field = TerrainFieldV307(
    "humboldthain",
    drawn_domain,
    tuple(profile["bounds"]),
    4,
    lambda x, z, n=False: sample_offset_v306(profile, x, z, n),
    baseline_height_v306,
  )
  native_domain = native_domain_v307(field)
  old_base = core_sampler_v307()
  variants = {}
  meshes = []
  proof = []
  for key in ("drawn-initial", "drawn-worker", "minecraft"):
    capture = read_v307(captures / f"{key}.json")
    native = key == "minecraft"
    domain = native_domain if native else drawn_domain
    records = []
    for part in capture["parts"]:
      if part["name"] not in TARGETS:
        continue
      attrs = part["attributes"]
      ps = (
        np.frombuffer(
          base64.b64decode(attrs["position"]["array"]),
          DTYPES[attrs["position"]["type"]],
        )
        .reshape(-1, 3)
        .astype(float)
      )
      if "normal" in attrs:
        normals = (
          np.frombuffer(
            base64.b64decode(attrs["normal"]["array"]), DTYPES[attrs["normal"]["type"]]
          )
          .reshape(-1, 3)
          .astype(float)
        )
      else:
        normals = np.tile([0.0, 1.0, 0.0], (len(ps), 1))
      ix = part["index"]
      indices = (
        np.frombuffer(base64.b64decode(ix["array"]), DTYPES[ix["type"]]).reshape(-1, 3)
        if ix
        else np.arange(len(ps)).reshape(-1, 3)
      )
      rgb = np.ones_like(ps)
      if "color" in attrs:
        col = attrs["color"]
        rgb = (
          np.frombuffer(base64.b64decode(col["array"]), DTYPES[col["type"]])
          .reshape(-1, 3)
          .astype(float)
        )
        if col["normalized"]:
          rgb /= 255 if col["type"] == "Uint8Array" else 65535
      inside = FloatMeshV307(
        part["materials"],
        f"core:humboldthain:{key}:{part.get('batchId', key)}:{part['name']}",
        native,
      )
      outside = FloatMeshV307(
        part["materials"],
        f"core:outside:{key}:{part.get('batchId', key)}:{part['name']}",
        native,
      )
      retired = []
      instances = part["instances"]
      if instances:
        matrices = (
          np.frombuffer(base64.b64decode(instances["matrix"]), "<f4")
          .reshape(-1, 4, 4)
          .transpose(0, 2, 1)
        )
        colors = np.frombuffer(base64.b64decode(instances["colors"]), "<f4").reshape(
          -1, 3
        )
        for ordinal, matrix in enumerate(matrices):
          centre = matrix[:3, 3]
          half = np.abs(matrix[:3, :3]).sum(axis=1) / 2
          if (
            domain.intersection(
              box(
                centre[0] - half[0],
                centre[2] - half[2],
                centre[0] + half[0],
                centre[2] + half[2],
              )
            ).area
            < 1e-10
          ):
            continue
          points = np.c_[ps, np.ones(len(ps))] @ matrix.T
          points = points[:, :3]
          paint = rgb * colors[ordinal]
          owned = False
          for triangle in indices:
            old_centre = centre.copy()
            old_centre[1] += half[1]
            changed = split_triangle_v307(
              points[triangle],
              paint[triangle],
              normals[triangle],
              profile,
              domain,
              inside,
              outside,
              native,
              old_base,
              old_centre,
            )
            if not changed:
              outside.add(points[triangle], paint[triangle], normals[triangle])
            owned |= changed
          if owned:
            retired.append(ordinal)
        kind = "instances"
      else:
        # Only actual source triangles meeting the field are even considered.
        tri = ps[indices]
        lo = tri[:, :, [0, 2]].min(axis=1)
        hi = tri[:, :, [0, 2]].max(axis=1)
        w, n, e, b = domain.bounds
        candidate = np.flatnonzero(
          (hi[:, 0] >= w) & (lo[:, 0] <= e) & (hi[:, 1] >= n) & (lo[:, 1] <= b)
        )
        for ordinal in candidate:
          triangle = indices[ordinal]
          if split_triangle_v307(
            ps[triangle],
            rgb[triangle],
            normals[triangle],
            profile,
            domain,
            inside,
            outside,
            native,
            old_base,
          ):
            retired.append(int(ordinal))
        kind = "triangles"
      if not retired:
        continue
      guards = {
        k: {a: b for a, b in v.items() if a != "array"} for k, v in attrs.items()
      }
      record = dict(
        name=part["name"],
        **({"batchId": part["batchId"]} if "batchId" in part else {}),
        parentName=part["parentName"],
        matrix=part["matrix"],
        attributes=guards,
        index={k: v for k, v in ix.items() if k != "array"} if ix else None,
        instances={k: v for k, v in instances.items() if k not in ("matrix", "colors")}
        if instances
        else None,
        materials=part["materials"],
        retireKind=kind,
        retire=retired,
        outside=outside.packed(),
      )
      records.append(record)
      packed = inside.packed()
      if packed:
        meshes.append(packed)
      proof.append(
        dict(
          variant=key,
          part=part["name"],
          retireKind=kind,
          retired=len(retired),
          insideTriangles=len(inside.indices) // 3,
          outsideTriangles=len(outside.indices) // 3,
        )
      )
    if not records:
      raise ValueError("Missing actual core field predecessor")
    variants[key] = dict(
      captureSha256=sha_v307(captures / f"{key}.json"), parts=records
    )
    print(key, [(r["name"], len(r["retire"])) for r in records], flush=True)
  write_v307(
    DATA / "coreTerrainContactV307.json",
    dict(
      schemaVersion=1,
      field="humboldthain",
      meshes=meshes,
      variants=variants,
      profileSha256=sha_v307(DATA / "northParkTerrainV306.json"),
    ),
  )
  from compact_core_navigation_v307 import compact_navigation_v307

  compact_navigation_v307()
  write_v307(
    GEO / "core-terrain-contact-v307-evidence.json.gz",
    dict(
      schemaVersion=1,
      sourceHead="9727870f79db9c6a6e9d6437668e5ac13229522f",
      captures={key: variants[key]["captureSha256"] for key in variants},
      parts=proof,
      policy="Actual core constructor geometry; source Float32 positions, normals, paint and day/night material values retained outside. Only proved exact original ordinals may transfer, reversibly. Inner16m reconciliation blends the measured field to the actual old coarse core floor; interior reaches the same source-bound DGM4m planes. No substitute outside patch or rounded source paint.",
    ),
  )


def main() -> None:
  p = argparse.ArgumentParser(description=__doc__)
  p.add_argument("captures", type=Path)
  compile_core_v307(p.parse_args().captures)


if __name__ == "__main__":
  main()
