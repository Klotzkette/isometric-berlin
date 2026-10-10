"""Step 10: clip only demonstrated coarse grass occlusions below exact roads."""

from __future__ import annotations

import base64
import hashlib
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
import shapely
from shapely.affinity import affine_transform
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
OUT = APP / "altMitteGroundSeamsV206.json"
AUDIT = GEO / "alt-mitte-ground-seams-v206-evidence.json"
GROUND = ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json"
ROAD = APP / "restoredRoadSurfaces.ndjson.txt"


def parts(geometry: Any) -> list[Polygon]:
  """Retain all non-empty polygon components."""
  if isinstance(geometry, Polygon):
    return [] if geometry.is_empty else [geometry]
  return [p for g in getattr(geometry, "geoms", []) for p in parts(g)]


def build() -> None:
  """Derive auditable grass-only partial replacements; source roads stay exact."""
  ground = json.loads(GROUND.read_text())
  h = ground["ground_height"]
  cell = ground["cell_m"]
  min_x, min_z = ground["grid"]["min_x_idx"], ground["grid"]["min_z_idx"]
  scope = affine_transform(
    shape(
      json.loads((GEO / "alt-mitte-v169-boundary.geojson").read_text())["features"][0][
        "geometry"
      ]
    ),
    [1, 0, 0, -1, -389500, 5820000],
  )
  scope_data = json.loads((APP / "surroundingCityScope.json").read_text())["core"]
  scope = scope.intersection(Polygon(scope_data["ring"], scope_data["holes"]))
  shapely.prepare(scope)

  def sample(x: float, z: float) -> float:
    fx, fz = (
      (x / cell - min_x) / h["stride_cells"] - 0.5,
      (z / cell - min_z) / h["stride_cells"] - 0.5,
    )
    ix, iz = math.floor(fx), math.floor(fz)
    a, b = fx - ix, fz - iz

    def value(cx: int, cz: int) -> float:
      return (
        h["y_dm"][
          max(0, min(h["rows"] - 1, cz)) * h["cols"] + max(0, min(h["cols"] - 1, cx))
        ]
        / 10
      )

    return (value(ix, iz) * (1 - a) + value(ix + 1, iz) * a) * (1 - b) + (
      value(ix, iz + 1) * (1 - a) + value(ix + 1, iz + 1) * a
    ) * b

  road_triangles = []
  road_planes = []
  road_owners = []

  def add(positions: Any, indices: Any, lift: float, owner: str) -> None:
    triangles = positions[indices]
    polygons = shapely.polygons(triangles)
    selected = np.where(shapely.intersects(polygons, scope))[0]
    for i in selected:
      tri = triangles[i]
      if polygons[i].area < 1e-7:
        continue
      ys = [sample(float(p[0]), float(p[1])) + lift for p in tri]
      plane = np.linalg.solve(np.column_stack((tri, np.ones(3))), ys)
      road_triangles.append(polygons[i])
      road_planes.append(plane)
      road_owners.append(owner)

  for line in ROAD.read_text().splitlines()[1:]:
    entry = json.loads(line)
    if entry["kind"] not in ("asphalt", "paving"):
      continue
    pos = np.frombuffer(base64.b64decode(entry["xz"]), dtype="<f4").reshape(-1, 2)
    ids = np.frombuffer(base64.b64decode(entry["indices"]), dtype="<u4").reshape(-1, 3)
    add(pos, ids, 0.14 if entry["kind"] == "asphalt" else 0.1, entry["id"])
  inputs = [
    GROUND,
    ROAD,
    APP / "districtStreets.json",
    APP / "schlossEastStreets.json",
    GEO / "alt-mitte-v169-boundary.geojson",
    APP / "surroundingCityScope.json",
  ]
  for path in inputs[2:4]:
    for entry in json.loads(path.read_text())["surfaces"]:
      if entry["kind"] not in ("asphalt", "paving", "sidewalk", "gravel"):
        continue
      pos = (
        np.frombuffer(base64.b64decode(entry["positions_cm_b64"]), dtype="<i4").reshape(
          -1, 2
        )
        / 100
      )
      ids = np.frombuffer(base64.b64decode(entry["indices_b64"]), dtype="<u4").reshape(
        -1, 3
      )
      add(
        pos,
        ids,
        {"asphalt": 0.18, "paving": 0.1, "sidewalk": 0.32, "gravel": 0.3}[
          entry["kind"]
        ],
        path.stem + ":" + entry["kind"],
      )
  tree = STRtree(road_triangles)
  records = []
  record_spans = []
  record_tops = []
  evidence = []
  triangle_points: list[Any] = []
  edge_points: list[Any] = []
  total_area = 0.0
  print(
    f"Indexed {len(road_triangles)} exact retained road/pavement triangles", flush=True
  )

  for iz, row in enumerate(ground["ground_rows"]):
    z0 = (min_z + iz) * cell
    if z0 + cell < scope.bounds[1] or z0 > scope.bounds[3]:
      continue
    for x_start, run, cls in row:
      if ground["classes"][cls] != "grass":
        continue
      x0, x1 = (min_x + x_start) * cell, (min_x + x_start + run) * cell
      rect = box(x0, z0, x1, z0 + cell)
      if not scope.intersects(rect):
        continue
      top = (
        h["y_dm"][
          math.floor(iz / h["stride_cells"]) * h["cols"]
          + math.floor((x_start + run / 2) / h["stride_cells"])
        ]
        / 10
      )
      clipped = rect.intersection(scope)
      corrections = []
      seen: Any = Polygon()
      for index in tree.query(rect):
        triangle = road_triangles[int(index)]
        a, b, c = road_planes[int(index)]
        ring = list(triangle.exterior.coords)[:3]
        # Only where the existing actual road plane is below the grass top.
        cut = []
        for p, q in zip(ring, ring[1:] + ring[:1]):
          dp, dq = (
            top - 0.005 - (a * p[0] + b * p[1] + c),
            top - 0.005 - (a * q[0] + b * q[1] + c),
          )
          if dp >= 0:
            cut.append(p)
          if (dp > 0) != (dq > 0):
            t = dp / (dp - dq)
            cut.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
        if len(cut) < 3:
          continue
        overlap = Polygon(cut).intersection(clipped).difference(seen)
        if overlap.area < 0.000001:
          continue
        corrections.extend(
          (p, (float(a), float(b), float(c) - 0.03), road_owners[int(index)])
          for p in parts(overlap)
        )
        seen = unary_union([seen, overlap])
      if not corrections:
        continue
      first_cell = len(records)
      affected = []
      for offset in range(run):
        tile_x = (min_x + x_start + offset) * cell
        if box(tile_x, z0, tile_x + cell, z0 + cell).intersection(seen).area > 0.000001:
          affected.append(offset)
      spans = []
      if affected:
        first = last = affected[0]
        for offset in [*affected[1:], affected[-1] + 2]:
          if offset != last + 1:
            spans.append((first, last + 1))
            first = offset
          last = offset
      for first, end in spans:
        col = x_start + first
        tile_x = (min_x + col) * cell
        retained = box(tile_x, z0, tile_x + (end - first) * cell, z0 + cell).difference(
          seen
        )
        triangle_start, edge_start = len(triangle_points), len(edge_points)
        for polygon in parts(retained):
          # Outward skirt faces require CCW outer rings and CW holes.
          polygon = shapely.orient_polygons(polygon)
          for tri in shapely.constrained_delaunay_triangles(polygon).geoms:
            # The shared writer expects CCW X/Z input and reverses it for the
            # upward top. Shapely returns mixed winding; check the actual
            # shipped float32 coordinates, retaining all triangle vertices.
            points = np.asarray(list(tri.exterior.coords)[:3], dtype="<f4").astype(
              float
            )
            ab, ac = points[1] - points[0], points[2] - points[0]
            if ab[0] * ac[1] - ab[1] * ac[0] < 0:
              points = points[[0, 2, 1]]
            triangle_points.extend(points)
          for ring in [polygon.exterior, *polygon.interiors]:
            coords = list(ring.coords)
            for a, b in zip(coords, coords[1:]):
              edge_points.extend((a, b))
        records.append(
          [
            col,
            iz,
            triangle_start,
            len(triangle_points) - triangle_start,
            edge_start,
            len(edge_points) - edge_start,
          ]
        )
        record_spans.append(end - first)
        record_tops.append(top)
      evidence.append(
        {
          "sourceRun": [iz, x_start, run, cls],
          "originalTop": top,
          "originalRectangle": [x0, z0, x1, z0 + cell],
          "correctedAreaM2": seen.area,
          "roadOwners": sorted({_owner for _, _, _owner in corrections}),
          "firstCell": first_cell,
          "cellCount": len(records) - first_cell,
        }
      )
      total_area += seen.area
  total_vertices = len(triangle_points) * 2 + len(edge_points) * 3
  summary = {
    "runs": len(evidence),
    "cells": sum(record_spans),
    "spans": len(records),
    "correctedAreaM2": round(total_area, 6),
    "unindexedVertices": total_vertices,
    "unindexedGeometryBytes": total_vertices * 36,
  }

  def encode(values: Any, dtype: str) -> str:
    return base64.b64encode(np.asarray(values, dtype=dtype).tobytes()).decode()

  # The wire format is shared with the existing exact land-complement writer,
  # also used for James-Simon and northern Hauptbahnhof source ownership.
  data = {
    "format": "exact-drawn-water-boundary",
    "version": 1,
    "cell_m": cell,
    "grid": ground["grid"],
    "source_sha256": hashlib.sha256(ROAD.read_bytes()).hexdigest(),
    "ground_sha256": hashlib.sha256(GROUND.read_bytes()).hexdigest(),
    "cells_u32": encode(records, "<u4"),
    "spans_u32": encode(record_spans, "<u4"),
    "tops_f32": encode(record_tops, "<f4"),
    "triangles_f32": encode(triangle_points, "<f4"),
    "edges_f32": encode(edge_points, "<f4"),
    "counts": summary,
  }
  OUT.write_text(json.dumps(data, separators=(",", ":")) + "\n")
  AUDIT.write_text(
    json.dumps(
      {
        "step": 10,
        "counts": summary,
        "inputSha256": {
          str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
          for p in inputs
        },
        "policy": "Exact land-complement correction only beneath demonstrated coarse grass overlaps with retained road/pavement planes. Complete source arrays and road geometry remain; retained grass uses unchanged original run height and color. Native untouched.",
        "records": evidence,
      },
      separators=(",", ":"),
    )
    + "\n"
  )
  print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
  build()
