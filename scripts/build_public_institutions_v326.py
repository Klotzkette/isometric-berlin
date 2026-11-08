"""Finite institution source-family and coverage preparation; never a city build.

This reads retained inputs/ZIP streams and writes new V326 derivatives only.
Point proximity stays a candidate; it never authorizes a complete body.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
import shapely
from shapely import STRtree, make_valid
from shapely.geometry import Polygon, box, mapping, shape
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import (
  GML_ID,
  NS,
  building_footprint,
  leaf_building_parts,
)
from scripts.build_public_inventory_v326 import (
  RAW,
  ROOT,
  STATE_SOURCE,
  digest,
  published_manifest,
  published_manifest_raw,
  read,
  render_buildings,
  sites,
  world_geometry,
)

CURRENT = ROOT / "geo_data/regierungsviertel/public-institutions-v326-current.json.gz"
CACHE = RAW / "institution-complete-families-v326.jsonl.gz"
SUMMARY = RAW / "institution-complete-families-v326-summary.json"
CLASSIFIED = RAW / "institution-classification-v326.jsonl.gz"
PACKETS = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
INDEX = ROOT / "src/app/src/data/publicInstitutionsV326Index.json"
EVIDENCE = ROOT / "geo_data/regierungsviertel/public-institutions-v326-evidence.json.gz"
SHEETS = ROOT / "geo_data/regierungsviertel/public-institutions-v326-source.json.gz"


def canonical(value: Any) -> bytes:
  """One finite reproducible derivative; never changes a retained input."""
  return (
    json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n"
  ).encode()


def polygon_parts(value: Any) -> list[Polygon]:
  """Preserve every component, without a largest-polygon shortcut."""
  if value.is_empty:
    return []
  if value.geom_type == "Polygon":
    return [value]
  return [p for child in getattr(value, "geoms", ()) for p in polygon_parts(child)]


def part_footprint(part: dict[str, Any]) -> Any:
  """The complete source ground; elevated sheets never become solid floors."""
  kind = "GroundSurface" if part["groundY"] is not None else "RoofSurface"
  values = []
  for surface in part["surfaces"]:
    if surface["kind"] != kind:
      continue
    rings = [[(p[0], p[2]) for p in ring] for ring in surface["rings"]]
    if rings and len(rings[0]) >= 3:
      p = Polygon(rings[0], rings[1:])
      if not p.is_valid:
        raise ValueError("Invalid original part footprint")
      if p.area > 0.000001:
        values.append(p)
  if not values:
    raise ValueError("No positive complete part support")
  return unary_union(values)


def source_triangles(surface: dict[str, Any], offset: float) -> list[list[list[float]]]:
  """Use retained constrained triangulation, including every source hole."""
  from scripts.build_breitscheid_towers_v161 import triangles_for

  rings = surface["rings"]
  if not rings or len(rings[0]) < 3:
    raise ValueError("Incomplete measured sheet")
  a = np.asarray(rings[0], dtype=float)
  normal = sum(
    (np.cross(p, q) for p, q in zip(a, np.roll(a, -1, axis=0), strict=True)),
    np.zeros(3),
  )
  if float(np.linalg.norm(normal)) < 1e-9:
    # Exactly zero-area source sheets have no visible surface to reconstruct.
    return []
  result = triangles_for(rings)
  if not result:
    raise ValueError("Nonzero measured sheet was not triangulated")
  return [[[p[0], p[1] + offset, p[2]] for p in tri] for tri in result]


def packet_ground(family: dict[str, Any], context: dict[str, Any]) -> tuple[float, str]:
  """Fit one rigid family datum to the actual retained ground sampler domain.

  Outside that domain the established surrounding packet datum is 3m. Source
  NHN elevations are not globally added to it; relative source heights remain.
  """
  point = shape(family["footprint"]).representative_point()
  cell, grid, heights = context["cell_m"], context["grid"], context["ground_height"]
  x, z = point.x / cell - grid["min_x_idx"], point.y / cell - grid["min_z_idx"]
  if 0 <= x < grid["cols"] and 0 <= z < grid["rows"]:
    col = min(heights["cols"] - 1, math.floor(x / heights["stride_cells"]))
    row = min(heights["rows"] - 1, math.floor(z / heights["stride_cells"]))
    return heights["y_dm"][
      row * heights["cols"] + col
    ] / 10, "actual-worldGroundSampler"
  return 3.0, "existing-surrounding-packet-groundY"


def native_columns(
  part: dict[str, Any], footprint: Any, surfaces: list[tuple[str, Any]], offset: float
) -> tuple[float, dict[tuple[int, int, int], tuple[int, ...]]]:
  """Closed source-contained cardinal columns, with measured roof samples.

  All four square corners belong to the complete original support; no outer
  buffer, courtyard filling or neighbour-dependent expansion is permitted.
  Tiny original leaves which cannot fit even a centimetre square fail closed.
  """
  roof = [
    tri for kind, triangles in surfaces if kind == "RoofSurface" for tri in triangles
  ]
  projected = [Polygon([(p[0], p[2]) for p in tri]) for tri in roof]
  projected = [p for p in projected if p.area > 1e-10]
  if not projected:
    raise ValueError("No positive original roof support for closed Native columns")
  support = footprint.intersection(unary_union(projected))
  if support.is_empty:
    raise ValueError("No common measured ground/roof support")
  selected = []
  for size in [2, 1, 0.5, 0.25, 0.1, 0.05, 0.02, 0.01]:
    x0, z0, x1, z1 = support.bounds
    coordinates = [
      (x, z)
      for x in range(math.floor(x0 / size), math.ceil(x1 / size))
      for z in range(math.floor(z0 / size), math.ceil(z1 / size))
    ]
    if len(coordinates) > 2_000_000:
      raise ValueError(
        "Source support needs more than bounded Native column preparation"
      )
    if not coordinates:
      continue
    a = np.asarray(coordinates, dtype=float)
    squares = shapely.box(
      a[:, 0] * size, a[:, 1] * size, (a[:, 0] + 1) * size, (a[:, 1] + 1) * size
    )
    inside = shapely.covers(support, squares)
    selected = [p for p, yes in zip(coordinates, inside, strict=True) if yes]
    if selected and all(
      any(
        p.covers(box(x * size, z * size, (x + 1) * size, (z + 1) * size))
        for x, z in selected
      )
      for p in polygon_parts(support)
    ):
      break
    selected = []
  if not selected:
    raise ValueError(
      "Sub-centimetre/disconnected source support cannot be safely cardinalized"
    )
  coordinates = np.asarray(selected, dtype=float)
  centres = (coordinates + 0.5) * size
  tops = np.full(len(selected), -math.inf)
  for tri in roof:
    a, b, c = np.asarray(tri, dtype=float)
    den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2])
    if abs(den) < 1e-12:
      continue
    u = (
      (b[2] - c[2]) * (centres[:, 0] - c[0]) + (c[0] - b[0]) * (centres[:, 1] - c[2])
    ) / den
    v = (
      (c[2] - a[2]) * (centres[:, 0] - c[0]) + (a[0] - c[0]) * (centres[:, 1] - c[2])
    ) / den
    w = 1 - u - v
    mask = (u >= -1e-9) & (v >= -1e-9) & (w >= -1e-9)
    tops[mask] = np.maximum(tops[mask], (u * a[1] + v * b[1] + w * c[1])[mask])
  if not np.isfinite(tops).all():
    raise ValueError("Native column has no measured roof sample")
  low = (
    part["groundY"]
    if part["groundY"] is not None
    else min(p[1] for s in part["surfaces"] for ring in s["rings"] for p in ring)
  ) + offset
  y0 = math.floor(low / size)
  result = {}
  for (x, z), top in zip(selected, tops, strict=True):
    y1 = max(y0, math.ceil(float(top) / size) - 1)
    for y in range(y0, y1 + 1):
      result[x, y, z] = (157, 151, 140) if y == y1 else (211, 208, 195)
  return size, result


class NativeOwnership:
  """Actual immutable old Native nav and complete Core RLE are vetoes only."""

  def __init__(self) -> None:
    from shapely.affinity import translate

    self.polygons, self.rows = [], []
    manifest = published_manifest()
    self.input_hashes = {
      "manifest": hashlib.sha256(published_manifest_raw()).hexdigest()
    }
    for ordinal, descriptor in enumerate(manifest["chunks"]):
      asset = descriptor["minecraft"]
      path = PACKETS / asset["url"]
      snapshot = path.read_bytes()
      if (
        len(snapshot) != asset["bytes"]
        or hashlib.sha256(snapshot).hexdigest() != asset["sha256"]
      ):
        raise ValueError("Changed actual original Native packet " + str(path))
      packet = json.loads(
        gzip.decompress(snapshot) if path.suffix == ".gz" else snapshot
      )
      ox, _, oz = packet["origin"]
      for row in packet["nav"]["buildings"]:
        p = Polygon(row["ring"], row["holes"])
        # An invalid historical polygon is an uncertainty veto, not permission
        # to insert a new overlapping family or repair its original geometry.
        if not p.is_valid:
          p = box(*p.bounds)
        if not p.is_empty and p.area:
          self.polygons.append(translate(p, ox, oz))
          self.rows.append({"packet": descriptor["id"], "sourceId": row["sourceId"]})
      if ordinal % 400 == 0:
        print("Actual Native nav ownership", ordinal, flush=True)
    self.tree = STRtree(self.polygons)
    self.voxels = read(
      ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
    )
    self.input_hashes["completeCoreVoxelSource"] = digest(
      ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
    )

  def conflict(self, footprint: Any) -> dict[str, Any] | None:
    for n in self.tree.query(footprint):
      if footprint.intersection(self.polygons[int(n)]).area > 1e-6:
        return {"kind": "actual-old-native-packet-nav", **self.rows[int(n)]}
    v, bounds = self.voxels, footprint.bounds
    cell, grid = v["cell_m"], v["grid"]
    x0, x1 = math.floor(bounds[0] / cell), math.floor(bounds[2] / cell)
    z0, z1 = math.floor(bounds[1] / cell), math.floor(bounds[3] / cell)
    for z in range(
      max(z0, grid["min_z_idx"]), min(z1 + 1, grid["min_z_idx"] + grid["rows"])
    ):
      for start, length, low, high, class_id in v["building_rows"][
        z - grid["min_z_idx"]
      ]:
        start += grid["min_x_idx"]
        for x in range(max(x0, start), min(x1 + 1, start + length)):
          if (
            footprint.intersection(
              box(x * cell, z * cell, (x + 1) * cell, (z + 1) * cell)
            ).area
            > 1e-6
          ):
            return {
              "kind": "complete-original-core-rle-conservative-veto",
              "column": [x, z, low, high, class_id],
            }
    return None


def cell_faces(
  cells: dict[tuple[int, int, int], tuple[int, ...]], cell_m: float = 2
) -> Any:
  """Emit exposed cardinal faces only; no hidden internal cube duplicates."""
  sides = [
    ((-1, 0, 0), (0, 4, 7, 3)),
    ((1, 0, 0), (1, 2, 6, 5)),
    ((0, -1, 0), (0, 1, 5, 4)),
    ((0, 1, 0), (3, 7, 6, 2)),
    ((0, 0, -1), (0, 3, 2, 1)),
    ((0, 0, 1), (4, 5, 6, 7)),
  ]
  for (x, y, z), color in sorted(cells.items()):
    vertices = [
      [(x + a) * cell_m, (y + b) * cell_m, (z + c) * cell_m]
      for a, b, c in [
        (0, 0, 0),
        (1, 0, 0),
        (1, 1, 0),
        (0, 1, 0),
        (0, 0, 1),
        (1, 0, 1),
        (1, 1, 1),
        (0, 1, 1),
      ]
    ]
    for delta, ix in sides:
      if (x + delta[0], y + delta[1], z + delta[2]) in cells:
        continue
      p = [vertices[i] for i in ix]
      yield [p[0], p[1], p[2]], color
      yield [p[0], p[2], p[3]], color


def merged_cell_faces(
  cells: dict[tuple[int, int, int], tuple[int, ...]], cell_m: float = 2
) -> Any:
  """Exact coplanar rectangle union, retaining every colored exposed square.

  This changes only triangulation of the NEW native shell. Integer unit-square
  membership is removed exactly once; no simplification, bounds fill or color
  averaging is involved. Courts and differently colored roof seams survive.
  """
  groups: dict[tuple[Any, ...], dict[int, set[int]]] = {}
  for xyz, color in cells.items():
    for axis in range(3):
      axes = [a for a in range(3) if a != axis]
      for sign in [-1, 1]:
        neighbor = list(xyz)
        neighbor[axis] += sign
        if tuple(neighbor) in cells:
          continue
        key = (axis, xyz[axis] + (sign > 0), sign, color)
        groups.setdefault(key, {}).setdefault(xyz[axes[1]], set()).add(xyz[axes[0]])
  for (axis, plane, sign, color), rows in sorted(groups.items()):
    axes = [a for a in range(3) if a != axis]
    while rows:
      v0 = min(rows)
      u0 = min(rows[v0])
      u1 = u0 + 1
      while u1 in rows[v0]:
        u1 += 1
      columns = set(range(u0, u1))
      v1 = v0 + 1
      while v1 in rows and columns <= rows[v1]:
        v1 += 1
      for v in range(v0, v1):
        rows[v].difference_update(columns)
        if not rows[v]:
          del rows[v]
      points = []
      for u, v in [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]:
        p = [0.0, 0.0, 0.0]
        p[axis], p[axes[0]], p[axes[1]] = plane * cell_m, u * cell_m, v * cell_m
        points.append(p)
      if sign != (-1 if axis == 1 else 1):
        points.reverse()
      yield [points[0], points[1], points[2]], color
      yield [points[0], points[2], points[3]], color


def clip_polygon(
  points: list[list[float]], axis: int, edge: float, lower: bool
) -> list[list[float]]:
  """Existing packet half-plane clipping: exact interpolation, no buffering."""
  result = []
  if not points:
    return result
  for a, b in zip(points, points[1:] + points[:1], strict=True):
    inside_a = a[axis] >= edge if lower else a[axis] <= edge
    inside_b = b[axis] >= edge if lower else b[axis] <= edge
    if inside_a:
      result.append(a)
    if inside_a != inside_b:
      fraction = (edge - a[axis]) / (b[axis] - a[axis])
      result.append([a[i] + fraction * (b[i] - a[i]) for i in range(3)])
  return result


class InstitutionPackets:
  """One bounded mesh per cell/piece, split without dropping any triangle."""

  def __init__(self) -> None:
    self.buffers: dict[tuple[int, int], Any] = {}
    self.nav: dict[tuple[int, int], list[dict[str, Any]]] = {}
    self.owners: dict[tuple[int, int], set[str]] = {}
    self.saved: dict[tuple[int, int, int], dict[str, Any]] = {}
    self.serials: Counter[tuple[int, int]] = Counter()
    self.mode = "drawn"
    self.total: Counter[str] = Counter()

  def mesh(self, key: tuple[int, int]) -> Any:
    from scripts.build_surrounding_outlines import PackedMesh

    if key not in self.buffers:
      self.buffers[key] = PackedMesh(key[0] * 512, key[1] * 512)
      self.nav[key], self.owners[key] = [], set()
    return self.buffers[key]

  def triangle(
    self, triangle: list[list[float]], color: tuple[int, ...], owner: str
  ) -> None:
    for x in range(
      math.floor(min(p[0] for p in triangle) / 512),
      math.floor(max(p[0] for p in triangle) / 512) + 1,
    ):
      for z in range(
        math.floor(min(p[2] for p in triangle) / 512),
        math.floor(max(p[2] for p in triangle) / 512) + 1,
      ):
        points = triangle
        for axis, edge, lower in [
          (0, x * 512, True),
          (0, (x + 1) * 512, False),
          (2, z * 512, True),
          (2, (z + 1) * 512, False),
        ]:
          points = clip_polygon(points, axis, edge, lower)
        if len(points) < 3:
          continue
        key, mesh = (x, z), self.mesh((x, z))
        for i in range(1, len(points) - 1):
          mesh.triangle([points[0], points[i], points[i + 1]], color)
        self.owners[key].add(owner)

  def building(
    self,
    polygon: Any,
    low: float,
    high: float,
    owner: str,
    parent: str,
    roof: list[Any],
    caps: list[list[float]] | None = None,
  ) -> None:
    from shapely.affinity import translate

    x0, z0, x1, z1 = polygon.bounds
    for x in range(math.floor(x0 / 512), math.floor(x1 / 512) + 1):
      for z in range(math.floor(z0 / 512), math.floor(z1 / 512) + 1):
        key = (x, z)
        parts = polygon_parts(
          polygon.intersection(box(x * 512, z * 512, (x + 1) * 512, (z + 1) * 512))
        )
        if not parts:
          continue
        self.mesh(key)
        for p in parts:
          p = translate(p, -x * 512, -z * 512)
          row = {
            "ring": [[round(a, 4), round(b, 4)] for a, b in p.exterior.coords],
            "holes": [
              [[round(a, 4), round(b, 4)] for a, b in h.coords] for h in p.interiors
            ],
            "sourceId": owner,
            "parentId": parent,
            "minHeight": 0,
            "height": round(high - low, 6),
            "groundOffset": round(low - 3, 6),
            "heightSource": "complete-official-family-v326",
          }
          # Roof support uses actual measured source triangles. Clip in
          # the consumer's existing roof sampler; never fabricate a slab.
          if roof:
            row["roofTriangles"] = [
              [
                [
                  round(v[0] - x * 512, 6),
                  round(v[1] - low, 6),
                  round(v[2] - z * 512, 6),
                ]
                for v in tri
              ]
              for tri in roof
              if max(v[0] for v in tri) >= x * 512
              and min(v[0] for v in tri) <= (x + 1) * 512
              and max(v[2] for v in tri) >= z * 512
              and min(v[2] for v in tri) <= (z + 1) * 512
            ]
          if caps:
            row["nativeRoofCaps"] = [
              [
                round(a - x * 512, 6),
                round(b - z * 512, 6),
                round(c - x * 512, 6),
                round(d - z * 512, 6),
                round(y - low, 6),
              ]
              for a, b, c, d, y in caps
              if c > x * 512 and a < (x + 1) * 512 and d > z * 512 and b < (z + 1) * 512
            ]
          self.nav[key].append(row)
          self.owners[key].add(parent)

  def flush(self, key: tuple[int, int]) -> None:
    mesh = self.buffers.pop(key)
    payload = mesh.payload("public-institutions-v326")
    nav, owners = self.nav.pop(key), sorted(self.owners.pop(key))
    if payload is None:
      if not nav:
        # Clipping a triangle exactly on a cell edge can legitimately
        # leave only zero-area points in the neighbouring cell.
        return
      raise ValueError(
        f"Empty rendered institution packet {key} {self.mode} {[(r['sourceId'], r['parentId']) for r in nav]}"
      )
    serial = self.serials[key]
    self.serials[key] += 1
    identity = f"publicInstitutions326-{key[0]}_{key[1]}-p{serial}"
    value = {
      "schemaVersion": 1,
      "id": identity,
      "origin": [key[0] * 512, -10, key[1] * 512],
      "meshes": [payload],
      "nav": {
        "ground": [],
        "water": [],
        "roads": [],
        "bridges": [],
        "buildings": nav,
        "groundY": 3,
      },
    }
    vertices, indices = len(mesh.vertices), len(mesh.indices)
    raw = canonical(value)
    if vertices > 400_000 or indices > 2_400_000 or len(raw) > 12 * 1024 * 1024:
      raise ValueError(f"Packet exceeds unchanged live limits: {identity} {self.mode}")
    encoded = gzip.compress(raw, compresslevel=6, mtime=0)
    path = PACKETS / f"{identity}.{self.mode}.json.gz"
    path.write_bytes(encoded)
    row = self.saved.setdefault(
      (*key, serial),
      {
        "id": identity,
        "bounds": [key[0] * 512, key[1] * 512, (key[0] + 1) * 512, (key[1] + 1) * 512],
        "buildingCount": 0,
      },
    )
    row[self.mode] = {
      "url": path.name,
      "bytes": len(encoded),
      "decodedBytes": len(raw),
      "encoding": "gzip",
      "sha256": hashlib.sha256(encoded).hexdigest(),
    }
    row[self.mode + "Owners"] = owners
    self.total[self.mode + "Bytes"] += len(encoded)
    self.total[self.mode + "Vertices"] += len(mesh.vertices)
    self.total[self.mode + "Triangles"] += len(mesh.indices) // 3

  def checkpoint(self) -> None:
    # Flush only at complete family boundaries; a source family is never
    # partially admitted. Every same-cell piece remains separately bounded.
    for key, mesh in list(self.buffers.items()):
      if len(mesh.vertices) > 110_000 or len(mesh.indices) > 600_000:
        self.flush(key)
    if sum(len(mesh.vertices) for mesh in self.buffers.values()) > 350_000:
      self.flush(max(self.buffers, key=lambda key: len(self.buffers[key].vertices)))

  def finish(self) -> None:
    for key in list(self.buffers):
      self.flush(key)


def compile_packets() -> dict[str, Any]:
  """Publish only new named-site packets, never mutate old bytes or owners."""
  selected = set(
    read(RAW / "institution-classification-v326-summary.json")[
      "missingCandidateParents"
    ]
  )
  context_path = ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json"
  context = read(context_path)
  old_native = NativeOwnership()
  stream = InstitutionPackets()
  audits, errors, counts = [], [], Counter()
  admitted: set[str] = set()
  # A selected family is validated wholly before either mode is emitted.
  with gzip.open(SHEETS, "wt", encoding="utf8", compresslevel=6) as source_out:
    source_out.write('{"schemaVersion":1,"families":[')
    first = True
    for mode in ["drawn", "minecraft"]:
      stream.mode = mode
      stream.serials.clear()
      with gzip.open(CACHE, "rt", encoding="utf8") as source:
        for line in source:
          family = json.loads(line)
          if family["id"] not in selected:
            continue
          if mode == "minecraft" and family["id"] not in admitted:
            continue
          if mode == "drawn":
            conflict = old_native.conflict(shape(family["footprint"]))
            if conflict:
              errors.append(
                {
                  "id": family["id"],
                  "status": "unresolved-existing-native-owner-overlap",
                  "reason": conflict,
                }
              )
              continue
          try:
            ground = min(
              p["groundY"] for p in family["parts"] if p["groundY"] is not None
            )
            target, ground_source = packet_ground(family, context)
            offset = target - ground
            prepared = []
            for part in family["parts"]:
              footprint = part_footprint(part)
              surfaces = [
                (s["kind"], source_triangles(s, offset)) for s in part["surfaces"]
              ]
              size, cells = native_columns(part, footprint, surfaces, offset)
              if not cells:
                raise ValueError(f"No complete native cell in {part['id']}")
              prepared.append((part, footprint, surfaces, size, cells))
            if mode == "drawn":
              conflict = old_native.conflict(unary_union([p[1] for p in prepared]))
              if conflict:
                errors.append(
                  {
                    "id": family["id"],
                    "status": "unresolved-existing-native-owner-overlap",
                    "reason": conflict,
                  }
                )
                continue
          except (ValueError, shapely.errors.GEOSException) as exc:
            if mode == "minecraft":
              raise ValueError(
                f"Native complete family failed: {family['id']}: {exc}"
              ) from exc
            errors.append(
              {
                "id": family["id"],
                "status": "unresolved-complete-family-source-or-native-support",
                "reason": str(exc),
              }
            )
            continue
          cell_count = 0
          family_parts = []
          for part, footprint, surfaces, size, cells in prepared:
            walls = (211, 208, 195)
            roofs = (157, 151, 140)
            # These are existing neutral source-envelope defaults,
            # not a photographic material/color attribution.
            colored = [
              (triangles, roofs if kind == "RoofSurface" else walls)
              for kind, triangles in surfaces
            ]
            if mode == "drawn":
              for triangles, color in colored:
                for tri in triangles:
                  stream.triangle(tri, color, family["id"])
              low = (
                part["groundY"]
                if part["groundY"] is not None
                else min(
                  v[1] for s in part["surfaces"] for ring in s["rings"] for v in ring
                )
              ) + offset
              high = part["topY"] + offset
              roof_triangles = [
                t for kind, ts in surfaces if kind == "RoofSurface" for t in ts
              ]
              stream.building(
                footprint, low, high, part["id"], family["id"], roof_triangles
              )
              family_parts.append(
                {
                  "id": part["id"],
                  "sourceSurfaces": len(part["surfaces"]),
                  "sourceTriangles": sum(len(ts) for _, ts in surfaces),
                  "groundY": part["groundY"],
                  "minY": min(
                    v[1] for s in part["surfaces"] for ring in s["rings"] for v in ring
                  ),
                  "topY": part["topY"],
                  "footprint": mapping(footprint),
                  "nativeCellM": size,
                  "nativeColumnCount": len({(x, z) for x, _, z in cells}),
                }
              )
            else:
              cell_count += len(cells)
              for tri, color in merged_cell_faces(cells, size):
                stream.triangle(tri, color, family["id"])
              xz = unary_union(
                [
                  box(x * size, z * size, (x + 1) * size, (z + 1) * size)
                  for x, z in {(x, z) for x, _, z in cells}
                ]
              )
              low, high = (
                min(y for _, y, _ in cells) * size,
                (max(y for _, y, _ in cells) + 1) * size,
              )
              top: dict[tuple[int, int], float] = {}
              for x, y, z in cells:
                top[x, z] = max(top.get((x, z), -math.inf), (y + 1) * size)
              caps = [
                [x * size, z * size, (x + 1) * size, (z + 1) * size, y]
                for (x, z), y in sorted(top.items())
              ]
              stream.building(xz, low, high, part["id"], family["id"], [], caps)
          if mode == "drawn":
            source_out.write(
              ("" if first else ",") + canonical(family).decode().strip()
            )
            first = False
            audits.append(
              {
                "id": family["id"],
                "sourceArchive": family["sourceArchive"],
                "archiveSha256": family["archiveSha256"],
                "matches": family["matches"],
                "sourceGroundY": ground,
                "packetGroundY": target,
                "datumSource": ground_source,
                "rigidOffsetM": offset,
                "parts": family_parts,
              }
            )
            counts["families"] += 1
            counts["parts"] += len(family["parts"])
            admitted.add(family["id"])
          else:
            counts["nativeBodyCells"] += cell_count
          stream.checkpoint()
          if counts["families"] % 100 == 0 and mode == "drawn":
            print(
              "Complete institution families",
              counts["families"],
              "parts",
              counts["parts"],
              flush=True,
            )
      stream.finish()
    source_out.write("]}\n")
  # Modes can split at different sizes. Exact independent descriptors use an
  # empty companion only where the other mode has no piece at that ordinal.
  for row in stream.saved.values():
    for mode in ["drawn", "minecraft"]:
      if mode in row:
        continue
      payload = {
        "schemaVersion": 1,
        "id": row["id"],
        "origin": [row["bounds"][0], -10, row["bounds"][1]],
        "meshes": [],
        "nav": {
          "ground": [],
          "water": [],
          "buildings": [],
          "roads": [],
          "bridges": [],
          "groundY": 3,
        },
      }
      raw = canonical(payload)
      encoded = gzip.compress(raw, compresslevel=6, mtime=0)
      path = PACKETS / f"{row['id']}.{mode}.json.gz"
      path.write_bytes(encoded)
      row[mode] = {
        "url": path.name,
        "bytes": len(encoded),
        "decodedBytes": len(raw),
        "encoding": "gzip",
        "sha256": hashlib.sha256(encoded).hexdigest(),
      }
    row["buildingCount"] = len(
      set(row.pop("drawnOwners", [])) | set(row.pop("minecraftOwners", []))
    )
  chunks = sorted(stream.saved.values(), key=lambda q: q["id"])
  footprint = unary_union(
    [shape(row["footprint"]) for family in audits for row in family["parts"]]
  )
  index = {
    "schemaVersion": 1,
    "chunks": chunks,
    "footprint": [
      {
        "ring": [list(p) for p in f.exterior.coords],
        "holes": [[list(p) for p in h.coords] for h in f.interiors],
      }
      for f in polygon_parts(footprint)
    ],
    "counts": dict(counts),
    "sourceSha256": digest(SHEETS),
  }
  INDEX.write_bytes(canonical(index))
  evidence = {
    "schemaVersion": 1,
    "families": audits,
    "unresolved": errors,
    "counts": dict(counts),
    "packetTotals": dict(stream.total),
    "inputs": {
      "classification": digest(CLASSIFIED),
      "fullSourceFamilies": digest(CACHE),
      "actualGroundContext": digest(context_path),
      "currentInventory": digest(CURRENT),
      "oldNativeOwnership": old_native.input_hashes,
    },
    "indexSha256": digest(INDEX),
    "sourceSha256": digest(SHEETS),
    "interpretation": "Measured complete Drawn sheets; source holes retained. Independent closed cardinal Native columns have every complete square inside actual original ground/projected-roof support; measured roof sample sets each top.2m grid, finer only for narrow source leaves, all coordinates on exact centimetre grids. Whole families with any positive overlap against actual old Minecraft packet nav or complete original Core RLE are unresolved rather than clipping or overwriting old owners. Neutral existing source-envelope palette; unmeasured windows/photographic facade details are not invented. Rigid per-family datum is actual retained worldGroundSampler inside its domain, existing packet groundY3 elsewhere. No old sources or packets are retired or modified.",
  }
  EVIDENCE.write_bytes(gzip.compress(canonical(evidence), compresslevel=6, mtime=0))
  finalize_actual_footprint()
  return {
    "counts": counts,
    "packets": len(chunks),
    "totals": stream.total,
    "errors": errors,
    "indexBytes": INDEX.stat().st_size,
    "sourceBytes": SHEETS.stat().st_size,
    "evidenceBytes": EVIDENCE.stat().st_size,
  }


def finalize_actual_footprint() -> dict[str, Any]:
  """Exact unbuffered union includes represented Native outer stair-steps.

  Native shell cells can extend beyond measured Drawn outlines. Using only the
  latter as the controller broadphase would wrongly reject their outer solids.
  Every contributing packet is fully SHA-bound before reading its actual nav.
  """
  from shapely.affinity import translate

  index = read(INDEX)
  evidence = read(EVIDENCE)
  polygons = [
    shape(p["footprint"]) for family in evidence["families"] for p in family["parts"]
  ]
  for descriptor in index["chunks"]:
    asset = descriptor["minecraft"]
    path = PACKETS / asset["url"]
    if path.stat().st_size != asset["bytes"] or digest(path) != asset["sha256"]:
      raise ValueError("Changed Native packet before exact footprint union")
    packet = read(path)
    ox, _, oz = packet["origin"]
    for row in packet["nav"]["buildings"]:
      polygons.append(translate(Polygon(row["ring"], row["holes"]), ox, oz))
  union = unary_union(polygons)
  minimal = union.simplify(0, preserve_topology=True)
  if not minimal.equals(union):
    raise ValueError("Collinear-only footprint compaction changed the exact union")
  union = minimal
  index["footprint"] = [
    {
      "ring": [list(p) for p in f.exterior.coords],
      "holes": [[list(p) for p in h.coords] for h in f.interiors],
    }
    for f in polygon_parts(union)
  ]
  INDEX.write_bytes(canonical(index))
  evidence["indexSha256"] = digest(INDEX)
  evidence["actualFootprintPolygons"] = len(index["footprint"])
  evidence["footprintPolicy"] = (
    "Exact unbuffered union of all measured Drawn supports and actual represented Native navigation supports; no bounding-box or district fill."
  )
  EVIDENCE.write_bytes(gzip.compress(canonical(evidence), compresslevel=6, mtime=0))
  return {
    "footprintPolygons": len(index["footprint"]),
    "indexBytes": INDEX.stat().st_size,
    "indexSha256": digest(INDEX),
  }


def verify_native_separation() -> dict[str, Any]:
  """Independent final support admission, including groundless roof leaves."""
  old = NativeOwnership()
  source, evidence = read(SHEETS), read(EVIDENCE)
  count = 0
  for family in source["families"]:
    supports = [part_footprint(p) for p in family["parts"]]
    conflict = old.conflict(unary_union(supports))
    if conflict:
      raise ValueError(f"Native source ownership conflict {family['id']}: {conflict}")
    count += len(supports)
  result = {
    "validatedCompleteFamilies": len(source["families"]),
    "validatedCompletePartSupports": count,
    "oldNativeNavBodies": len(old.rows),
    "sourceInputs": old.input_hashes,
    "policy": "Zero positive-area overlap with every actual old Native nav family and complete original Core RLE, conservative across all Y. Exact original ground/projected-roof supports include every leaf; all new Native squares are wholly source-contained. Source packet bytes verified from the exact decoded immutable snapshots.",
  }
  evidence["nativeSeparationProof"] = result
  EVIDENCE.write_bytes(gzip.compress(canonical(evidence), compresslevel=6, mtime=0))
  return result


def account_inventory() -> dict[str, Any]:
  """Every current institution record has an explicit, non-inflated status."""
  current = read(CURRENT)
  evidence = read(EVIDENCE)
  added = {q["id"] for q in evidence["families"]}
  unresolved = {q["id"]: q["status"] for q in evidence["unresolved"]}
  by_site: dict[str, list[dict[str, Any]]] = {}
  with gzip.open(CLASSIFIED, "rt", encoding="utf8") as source:
    for line in source:
      row = json.loads(line)
      status = (
        "new-complete-official-family"
        if row["id"] in added
        else unresolved[row["id"]]
        if row["id"] in unresolved
        else row["status"]
      )
      for match in row["matches"]:
        by_site.setdefault(match["id"], []).append(
          {
            "family": row["id"],
            "status": status,
            "association": match["kind"],
            "familyCoverage": match["familyCoverage"],
          }
        )
  rows, counts = [], Counter()
  for item in inventory():
    relations = by_site.get(item["id"], [])
    strong = [r for r in relations if r["association"] != "near-point-candidate-only"]
    status = (
      "source-associated-not-photographic-certification"
      if strong
      else "unresolved-no-unambiguous-family-association"
    )
    counts[f"{item['category']}:{status}"] += 1
    rows.append({**item, "accountingStatus": status, "families": relations})
  path = ROOT / "geo_data/regierungsviertel/public-institutions-v326-inventory.json.gz"
  value = {
    "schemaVersion": 1,
    "retrieved": "2026-11-08",
    "records": rows,
    "currentMuseumDirectory": current["museumAtoZ"],
    "currentCourts": current["courts"],
    "museumMap": {
      "source": "https://www.museumsportal-berlin.de/de/museen/map/",
      "listedMapRecords": len(current["museumsMap"]["records"]),
      "limit": "The map publishes200 records; the separate paginated directory reports205. Only actual strict-Berlin map points enter the spatial audit. Neither is a building count or proof of opening.",
    },
    "counts": dict(counts),
    "newFamilies": len(added),
    "unresolvedCandidateFamilies": len(unresolved),
    "unresolvedCandidateStatuses": dict(Counter(unresolved.values())),
    "inputHashes": {
      str(p.relative_to(ROOT)): digest(p)
      for p in [
        CURRENT,
        EVIDENCE,
        CLASSIFIED,
        RAW / "schulen-current.geojson",
        RAW / "institutions.geojson.gz",
        RAW / "institution_points.geojson.gz",
        STATE_SOURCE,
      ]
    },
    "limits": [
      "Co-located school codes, campuses, buildings and museum/court institutions remain separate records.",
      "Old source membership is not proof of actual runtime rendering; existing source envelopes and authored families are preserved without automatic replacement.",
      "Official main-site or directory points never authorize a new body by proximity. A new complete family needs at least90% positive overlap with a mapped institution site/building.",
      "Two official court-directory institutions are outside Berlin; they remain listed contact evidence and receive no Berlin geometry.",
      "Current museum names and addresses are factual directory evidence; operational status, old-OSM tenant conflicts and photographic facade accuracy are not inferred.",
    ],
  }
  path.write_bytes(gzip.compress(canonical(value), compresslevel=6, mtime=0))
  return {
    "records": len(rows),
    "counts": counts,
    "bytes": path.stat().st_size,
    "sha256": digest(path),
  }


def inventory() -> list[dict[str, Any]]:
  """Keep physical-source and current institution records distinct."""
  result = [s for s in sites() if s["category"] != "monument"]
  if CURRENT.exists():
    state = unary_union(
      [world_geometry(f["geometry"], True) for f in read(STATE_SOURCE)["features"]]
    )
    for row in read(CURRENT)["museumsMap"]["records"]:
      if "latitude" not in row or "longitude" not in row:
        continue
      g = world_geometry(
        {"type": "Point", "coordinates": [row["longitude"], row["latitude"]]}
      )
      if not state.covers(g):
        continue
      result.append(
        {
          "id": row["id"],
          "category": "museum",
          "name": row["name"],
          "source": row["url"],
          "geometry": mapping(g),
          "role": "primary museum-directory point; not proof of a whole building or current opening",
        }
      )
  if len({s["id"] for s in result}) != len(result):
    raise ValueError("Duplicate institution identity")
  return result


def analyse_master(output: Path) -> dict[str, Any]:
  """Source membership is explicitly not an actual rendered-family proof."""
  items = inventory()
  master = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  rows = read(master)["buildings"]
  geometries = [
    make_valid(
      Polygon(
        [(x / 10, z / 10) for x, z in p["ring"]],
        [[(x / 10, z / 10) for x, z in h] for h in p["holes"]],
      )
    )
    for p in rows
  ]
  tree = STRtree(geometries)
  counts: dict[str, Counter[str]] = {}
  for item in items:
    g = make_valid(shape(item["geometry"]))
    matches = []
    for n in tree.query(g.buffer(25 if not g.area else 0.01)):
      b = geometries[int(n)]
      area, distance = g.intersection(b).area, g.distance(b)
      if (g.area and area < min(0.5, g.area * 0.01)) or (not g.area and distance > 25):
        continue
      matches.append(
        {
          "id": rows[int(n)]["id"],
          "distanceM": round(distance, 3),
          "overlapM2": round(area, 3),
        }
      )
    item["candidateMasterSources"] = matches
    item["masterStatus"] = (
      "source-present-rendering-unverified" if matches else "no-master-candidate"
    )
    counts.setdefault(item["category"], Counter())[item["masterStatus"]] += 1
  value = {
    "schemaVersion": 1,
    "sourceMasterSha256": digest(master),
    "sites": items,
    "counts": counts,
    "policy": "Analysis-only make_valid repairs never alter original geometry. Master presence is not admission; actual constructor selectors and named authored models remain authoritative.",
  }
  output.write_bytes(
    gzip.compress(
      (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode(),
      mtime=0,
    )
  )
  return {"sites": len(items), "counts": counts, "bytes": output.stat().st_size}


def ring_values(element: ET.Element) -> list[list[float]]:
  """Retain each original vertex in the viewer datum, with no simplification."""
  values = [float(v) for v in (element.text or "").split()]
  dimension = int(element.get("srsDimension", "3"))
  if dimension != 3 or len(values) % 3:
    raise ValueError("Unknown source ring coordinate layout")
  points = [
    [round(x - 389500, 6), round(z - 30, 6), round(5820000 - y, 6)]
    for x, y, z in zip(values[::3], values[1::3], values[2::3], strict=True)
  ]
  return points[:-1] if len(points) > 1 and points[0] == points[-1] else points


def complete_part(part: ET.Element) -> dict[str, Any]:
  """All ground/wall/roof sheets, holes and original position-text hashes."""
  surfaces = []
  for kind in ["GroundSurface", "WallSurface", "RoofSurface"]:
    for polygon in part.findall(f".//bldg:{kind}//gml:Polygon", NS):
      pos = polygon.findall(".//gml:posList", NS)
      surfaces.append(
        {
          "kind": kind,
          "sourcePolygonId": polygon.get(GML_ID),
          "rings": [ring_values(p) for p in pos],
          "originalPositionTextSha256": hashlib.sha256(
            "\0".join(p.text or "" for p in pos).encode()
          ).hexdigest(),
        }
      )
  values = [p for s in surfaces for ring in s["rings"] for p in ring]
  if not values:
    raise ValueError("Missing complete source part")
  ground_values = [
    p[1]
    for s in surfaces
    if s["kind"] == "GroundSurface"
    for ring in s["rings"]
    for p in ring
  ]
  return {
    "id": part.get(GML_ID),
    "function": part.findtext("bldg:function", namespaces=NS),
    "roofType": part.findtext("bldg:roofType", namespaces=NS),
    "groundY": min(ground_values) if ground_values else None,
    "minY": min(p[1] for p in values),
    "topY": max(p[1] for p in values),
    "surfaces": surfaces,
  }


def extract_families() -> dict[str, Any]:
  """Serial ZIP/XML scan of exact already-downloaded institution tile inputs."""
  items = inventory()
  shapes = [make_valid(shape(i["geometry"])) for i in items]
  search = [g if g.area else g.buffer(25) for g in shapes]
  tree = STRtree(search)
  paths = read(RAW / "institution-tiles-berlin.json")
  tiles = paths["tiles"]
  seen: set[str] = set()
  counts: Counter[str] = Counter()
  records, errors = [], []
  with gzip.open(CACHE, "wt", encoding="utf8", compresslevel=3) as out:
    for ordinal, name in enumerate(tiles):
      path = (
        ROOT / paths["available"][name] if name in paths["available"] else RAW / name
      )
      receipt = {
        "path": str(path.relative_to(ROOT)),
        "sha256": digest(path),
        "families": 0,
      }
      with zipfile.ZipFile(path) as archive:
        for member in archive.namelist():
          if not member.lower().endswith((".gml", ".xml")):
            continue
          with archive.open(member) as stream:
            for _, element in ET.iterparse(stream, events=("end",)):
              if element.tag != f"{{{NS['bldg']}}}Building":
                continue
              identity = element.get(GML_ID)
              if identity in seen:
                element.clear()
                continue
              # Cheap complete ground-envelope rejection before GEOS/leaf serialization.
              ground_values = [
                float(v)
                for p in element.findall(".//bldg:GroundSurface//gml:posList", NS)
                for v in (p.text or "").split()
              ]
              if not ground_values:
                element.clear()
                continue
              xs, zs = ground_values[::3], ground_values[1::3]
              candidates = tree.query(
                box(
                  min(xs) - 389500,
                  5820000 - max(zs),
                  max(xs) - 389500,
                  5820000 - min(zs),
                )
              )
              if not len(candidates):
                element.clear()
                continue
              footprint = building_footprint(element)
              if footprint is None:
                errors.append(
                  {"id": identity, "reason": "missing-full-footprint", "archive": name}
                )
                element.clear()
                continue
              from shapely.affinity import affine_transform

              f = make_valid(
                affine_transform(footprint, [1, 0, 0, -1, -389500, 5820000])
              )
              matches = []
              for n in candidates:
                i, g = int(n), shapes[int(n)]
                area, distance = g.intersection(f).area, g.distance(f)
                if (g.area and area <= 0.1) or (not g.area and distance > 25):
                  continue
                matches.append(
                  {
                    "id": items[i]["id"],
                    "category": items[i]["category"],
                    "kind": "area-overlap"
                    if g.area
                    else "contains-primary-point"
                    if f.covers(g)
                    else "near-point-candidate-only",
                    "overlapM2": area,
                    "familyCoverage": area / max(f.area, 0.001),
                    "distanceM": distance,
                  }
                )
              if not matches:
                element.clear()
                continue
              try:
                parts = [
                  complete_part(p) for p in leaf_building_parts(element) or [element]
                ]
                row = {
                  "id": identity,
                  "sourceArchive": receipt["path"],
                  "archiveSha256": receipt["sha256"],
                  "function": element.findtext("bldg:function", namespaces=NS),
                  "sourceCreationDate": element.findtext(
                    "core:creationDate", namespaces=NS
                  ),
                  "footprint": mapping(f),
                  "matches": matches,
                  "parts": parts,
                }
                out.write(
                  json.dumps(
                    row, ensure_ascii=False, separators=(",", ":"), allow_nan=False
                  )
                  + "\n"
                )
                seen.add(identity)
                receipt["families"] += 1
                counts["families"] += 1
                counts["leaves"] += len(parts)
              except ValueError as exc:
                errors.append({"id": identity, "archive": name, "reason": str(exc)})
              element.clear()
      records.append(receipt)
      if ordinal % 10 == 0:
        print(
          "Source tiles",
          ordinal + 1,
          "/",
          len(tiles),
          "families",
          counts["families"],
          "leaves",
          counts["leaves"],
          flush=True,
        )
  result = {
    "schemaVersion": 1,
    "inputTiles": records,
    "counts": counts,
    "errors": errors,
    "output": str(CACHE.relative_to(ROOT)),
    "outputSha256": digest(CACHE),
    "policy": "Full source families only; candidate associations do not authorize generation or source retirement.",
  }
  SUMMARY.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
  return {
    "counts": counts,
    "errors": len(errors),
    "bytes": CACHE.stat().st_size,
    "sha256": result["outputSha256"],
  }


def classify() -> dict[str, Any]:
  """Conservatively distinguish a genuinely absent mass from source candidacy.

  Any actual retained packet/master overlap is a veto on automatic new body
  generation, even if that original source is currently retired by a better
  named model. Resident Alt-Mitte and explicit named parents also veto it.
  """
  state = unary_union(
    [world_geometry(f["geometry"], True) for f in read(STATE_SOURCE)["features"]]
  )
  items = {i["id"]: i for i in inventory()}
  geometries, records = render_buildings()
  for p in read(ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json")[
    "buildings"
  ]:
    g = make_valid(
      Polygon(
        [(x / 10, z / 10) for x, z in p["ring"]],
        [[(x / 10, z / 10) for x, z in ring] for ring in p["holes"]],
      )
    )
    geometries.append(g)
    records.append(
      {"sourceId": p["id"], "packet": "retained-master-source-not-render-proof"}
    )
  tree = STRtree(geometries)
  resident = set(
    read(ROOT / "src/app/src/data/altMitteDrawnV169Source.json")["sourceParents"]
  )
  protected = set(resident)
  explicit = [
    "src/app/src/musicMuseumSource.json",
    "src/app/src/museumTriadSource.json",
    "src/app/src/domAltesMuseumSource.json",
    "src/app/src/kulturforumMuseumsSource.json",
    "src/app/src/museumLennePrisms.json",
    "src/app/src/data/schoolsV185.json",
    "src/app/src/data/schoolsPlacesV205.json",
    "src/app/src/data/schoolCultureV228.json",
    "src/app/src/data/schoolsCourtsV274.json",
    "src/app/src/data/districtCourtsV229.json",
    "src/app/src/data/districtCourtsV229Envelopes.json",
    "geo_data/regierungsviertel/southwest-sites-v326-source.json.gz",
    "geo_data/regierungsviertel/north-east-public-sites-v326-source.json.gz",
    "geo_data/regierungsviertel/prisons-memorials-v209-source.json",
    "geo_data/regierungsviertel/youth-theatres-v322-source.json.gz",
    "geo_data/regierungsviertel/universities-v322-source.json.gz",
    "geo_data/regierungsviertel/museum-bridges-v243-source.json",
  ]

  def named_ids(q: Any, key: str = "") -> None:
    if isinstance(q, str) and (
      q.startswith("DEBE") or key in ["owner", "parent_id", "sourceId"]
    ):
      protected.add(q)
    elif isinstance(q, dict):
      for k, value in q.items():
        if (
          not isinstance(value, (list, dict))
          or not value
          or not isinstance(value[0] if isinstance(value, list) else None, (int, float))
        ):
          named_ids(value, k)
    elif isinstance(q, list):
      for value in q:
        named_ids(value, key)

  for path in explicit:
    p = ROOT / path
    if p.exists():
      named_ids(read(p))
  counts: Counter[str] = Counter()
  site_status: dict[str, Counter[str]] = {i: Counter() for i in items}
  selected = []
  with (
    gzip.open(CACHE, "rt", encoding="utf8") as source,
    gzip.open(CLASSIFIED, "wt", encoding="utf8", compresslevel=3) as output,
  ):
    for line in source:
      family = json.loads(line)
      f = make_valid(shape(family["footprint"]))
      high_confidence = [
        m
        for m in family["matches"]
        if m["kind"] == "area-overlap" and m["familyCoverage"] >= 0.9
      ]
      owners = []
      for n in tree.query(f):
        n = int(n)
        area = f.intersection(geometries[n]).area
        if area > 0.000001:
          owners.append(
            {
              "id": records[n]["sourceId"],
              "packet": records[n]["packet"],
              "overlapM2": area,
            }
          )
      protected_match = family["id"] in protected or any(
        p["id"] in protected for p in family["parts"]
      )
      if protected_match:
        status = "retained-resident-or-authored-family"
      elif owners:
        status = "existing-source-envelope-no-automatic-replacement"
      elif not high_confidence:
        status = "unresolved-point-or-partial-campus-association"
      elif not state.buffer(0.005).covers(f):
        status = "unresolved-cross-state-family"
      else:
        status = "verified-missing-complete-family-candidate"
        selected.append(family["id"])
      row = {
        "id": family["id"],
        "parts": [p["id"] for p in family["parts"]],
        "status": status,
        "matches": family["matches"],
        "indexedOwners": owners,
        "sourceArchive": family["sourceArchive"],
        "archiveSha256": family["archiveSha256"],
      }
      output.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
      counts[status] += 1
      for match in family["matches"]:
        site_status[match["id"]][status] += 1
  result = {
    "schemaVersion": 1,
    "counts": counts,
    "missingCandidateParents": selected,
    "siteAccounting": {k: dict(v) for k, v in site_status.items()},
    "protectedSources": explicit,
    "classificationSha256": digest(CLASSIFIED),
    "policy": "Every positive old source or authored owner vetoes automatic new bodies; no false inference from packet-only coverage. Point-only records never authorize a mass.",
  }
  (RAW / "institution-classification-v326-summary.json").write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + "\n"
  )
  return {
    "counts": counts,
    "selected": len(selected),
    "sites": len(site_status),
    "sha256": result["classificationSha256"],
  }


def main() -> None:
  """Prepare only new source evidence; no existing source/packet is modified."""
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--extract", action="store_true")
  parser.add_argument("--master-audit", type=Path)
  parser.add_argument("--classify", action="store_true")
  parser.add_argument("--compile", action="store_true")
  parser.add_argument("--account", action="store_true")
  parser.add_argument("--actual-footprint", action="store_true")
  parser.add_argument("--verify-native-separation", action="store_true")
  args = parser.parse_args()
  if args.master_audit:
    print(json.dumps(analyse_master(args.master_audit), ensure_ascii=False))
  if args.extract:
    print(json.dumps(extract_families(), ensure_ascii=False))
  if args.classify:
    print(json.dumps(classify(), ensure_ascii=False))
  if args.compile:
    print(json.dumps(compile_packets(), ensure_ascii=False))
  if args.actual_footprint:
    print(json.dumps(finalize_actual_footprint(), ensure_ascii=False))
  if args.verify_native_separation:
    print(json.dumps(verify_native_separation(), ensure_ascii=False))
  if args.account:
    print(json.dumps(account_inventory(), ensure_ascii=False))


if __name__ == "__main__":
  main()
