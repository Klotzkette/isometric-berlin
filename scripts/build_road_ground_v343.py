"""Clip demonstrated final raster-ground occlusions under retained core streets.

No source roads, measured heights, Native cells or earlier authored complements
are changed. The capture is made after the actual production slab exclusions.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
GROUND = ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json"
SOURCE = GEO / "road-ground-v343-source.json.gz"
CURRENT_SURVEY = [-225, -92, 46, 117]
STREET_FILES = [APP / "districtStreets.json", APP / "schlossEastStreets.json"]
MITTE = APP / "mitteRoadsV343.json"
RESTORED = APP / "restoredRoadSurfaces.ndjson.txt"
PLAZA = APP / "kulturforumPlazaV343.json"
LIFTS = {"asphalt": 0.18, "paving": 0.10, "sidewalk": 0.32, "gravel": 0.30}


def parts(geometry):
  if isinstance(geometry, Polygon):
    return [] if geometry.is_empty else [geometry]
  return [p for g in getattr(geometry, "geoms", []) for p in parts(g)]


def encode(values, dtype):
  return base64.b64encode(np.asarray(values, dtype=dtype).tobytes()).decode()


def source_guard(source):
  value = 2166136261
  for surface in source["surfaces"]:
    if surface["kind"] not in LIFTS:
      continue
    for text in (surface["kind"], surface["positions_cm_b64"], surface["indices_b64"]):
      for c in text:
        value = ((value ^ ord(c)) * 16777619) & 0xFFFFFFFF
  return value


def visible_overlap(triangle, plane, top, region):
  """Clip the actual 3D road plane, not a nearest sample or bounding box."""
  ring = list(triangle.exterior.coords)[:3]
  cut = []
  a, b, c = plane
  for p, q in zip(ring, ring[1:] + ring[:1]):
    # Even a millimetre of protrusion can form a broad visible wedge on a
    # nearly level road. Clip at the actual plane, without a height deadband.
    dp = top - (a * p[0] + b * p[1] + c)
    dq = top - (a * q[0] + b * q[1] + c)
    if dp >= 0:
      cut.append(p)
    if (dp > 0) != (dq > 0):
      t = dp / (dp - dq)
      cut.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
  return Polygon(cut).intersection(region) if len(cut) >= 3 else Polygon()


def build(capture: Path | None = None):
  ground_bytes = GROUND.read_bytes()
  ground = json.loads(ground_bytes)
  cell, grid, h = ground["cell_m"], ground["grid"], ground["ground_height"]
  streets = [json.loads(path.read_text()) for path in STREET_FILES]
  inputs = {
    str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
    for p in [GROUND, *STREET_FILES, MITTE, RESTORED, PLAZA]
  }
  if capture:
    captured = json.loads(capture.read_text())
    source = {
      "inputSha256": inputs,
      "captureSha256": hashlib.sha256(capture.read_bytes()).hexdigest(),
      "production": "capture-road-ground-v343.ts after every preceding ground exclusion",
      "records": captured["records"],
    }
  else:
    source = json.loads(gzip.decompress(SOURCE.read_bytes()))
    if source["inputSha256"] != inputs:
      raise ValueError("Retained street/ground inputs differ from the audited capture")
  heights = np.asarray(h["y_dm"]).reshape(h["rows"], h["cols"]) / 10

  def sample(points):
    fx = (points[:, 0] / cell - grid["min_x_idx"]) / h["stride_cells"] - 0.5
    fz = (points[:, 1] / cell - grid["min_z_idx"]) / h["stride_cells"] - 0.5
    ix, iz = np.floor(fx).astype(int), np.floor(fz).astype(int)
    tx, tz = fx - ix, fz - iz
    x0, x1 = np.clip(ix, 0, h["cols"] - 1), np.clip(ix + 1, 0, h["cols"] - 1)
    z0, z1 = np.clip(iz, 0, h["rows"] - 1), np.clip(iz + 1, 0, h["rows"] - 1)
    return (heights[z0, x0] * (1 - tx) + heights[z0, x1] * tx) * (1 - tz) + (
      heights[z1, x0] * (1 - tx) + heights[z1, x1] * tx
    ) * tz

  mitte = json.loads(MITTE.read_text())
  plaza = json.loads(PLAZA.read_text())
  plaza_footprint = shape(plaza["footprint"])
  if plaza_footprint.is_empty or not plaza_footprint.is_valid:
    raise ValueError("The complete replacement plaza needs a valid exact footprint")
  patches = {p["kind"]: {f[0] for f in p["faces"]} for p in mitte["surfacePatches"]}
  polygons, planes, owners, ordinals = [], [], [], []
  groups = [
    (path.stem, data["surfaces"], path == STREET_FILES[0])
    for path, data in zip(STREET_FILES, streets)
  ]
  groups += [
    ("mitteRetainedV343", mitte["supplement"]["surfaces"], False),
    (
      "mitteSurveyV343",
      [
        {**s, "kind": "sidewalk" if s["layer"] == "walk" else "asphalt"}
        for s in mitte["surfaces"]
      ],
      False,
    ),
  ]
  # These two existing southern-core tiles contain the Philharmonie/Serra
  # pedestrian paving. They are outside every Spreebogen height override.
  # Do not retain or load the full 29 MB deferred-road graph at runtime.
  wanted = {f"restored-{kind}--1-{z}" for kind in ("paving", "asphalt") for z in (1, 2)}
  with RESTORED.open() as stream:
    for line in stream:
      record = json.loads(line)
      if record.get("id") in wanted:
        groups.append(
          (
            record["id"],
            [{**record, "lift": 0.14 if record["kind"] == "asphalt" else 0.1}],
            False,
          )
        )
  for owner, surfaces, patched in groups:
    for surface in surfaces:
      if surface["kind"] not in LIFTS:
        continue
      pos = (
        np.frombuffer(base64.b64decode(surface["xz"]), dtype="<f4")
        .reshape(-1, 2)
        .astype(float)
        if "xz" in surface
        else np.frombuffer(
          base64.b64decode(surface["positions_cm_b64"]), dtype="<i4"
        ).reshape(-1, 2)
        / 100
      )
      ids = np.frombuffer(
        base64.b64decode(surface.get("indices", surface.get("indices_b64"))),
        dtype="<u4",
      ).reshape(-1, 3)
      # Rendering samples double XZ first, then stores all XYZ as float32.
      ys = (
        (sample(pos) + surface.get("lift", LIFTS[surface["kind"]]))
        .astype("<f4")
        .astype(float)
      )
      triangles = pos.astype("<f4").astype(float)[ids]
      faces = shapely.polygons(triangles)
      valid = np.where(shapely.area(faces) > 1e-8)[0]
      for i in valid:
        if patched and int(i) in patches.get(surface["kind"], set()):
          continue
        plane = np.linalg.solve(np.column_stack((triangles[i], np.ones(3))), ys[ids[i]])
        polygons.append(faces[i])
        planes.append(plane)
        owners.append(owner + ":" + surface["kind"])
        ordinals.append(int(i))
  tree = STRtree(polygons)
  records, spans, tops, triangles, edges, evidence, retained_source = (
    [],
    [],
    [],
    [],
    [],
    [],
    [],
  )
  by_class = {}
  plaza_records = []
  plaza_area = 0.0
  additional_plaza_area = 0.0
  for rect in source["records"]:
    x0, z0, x1, z1, top, depth = rect
    col, row = (
      round(x0 / cell) - grid["min_x_idx"],
      round(z0 / cell) - grid["min_z_idx"],
    )
    run = round((x1 - x0) / cell)
    # Keep older partial/slanted room fragments and every bridge/water cell.
    if (
      depth != 3
      or abs(run * cell - (x1 - x0)) > 1e-5
      or abs((col + grid["min_x_idx"]) * cell - x0) > 1e-5
    ):
      continue
    raw = next(
      (v for start, n, v in ground["ground_rows"][row] if start <= col < start + n),
      None,
    )
    kind = ground["classes"][raw] if raw is not None else "unknown"
    if kind not in {"grass", "concrete", "plazaBrick"}:
      continue
    region = box(x0, z0, x1, z1)
    candidates = []
    receipts = []
    for i in tree.query(region):
      i = int(i)
      overlap = visible_overlap(polygons[i], planes[i], top, region)
      if overlap.area <= 1e-7:
        continue
      candidates.append(overlap)
      receipts.append([owners[i], ordinals[i]])
    # A separately built complete plaza replaces its actual footprint, even
    # where the former raster top sits lower. This is an explicit ground-owner
    # transfer, not a claim that those lower old cells visibly occluded a road.
    old_road_cut = unary_union(candidates) if candidates else Polygon()
    plaza_cut = plaza_footprint.intersection(region)
    if plaza_cut.area > 1e-7:
      candidates.append(plaza_cut)
      receipts.append(["kulturforumPlazaV343:complete-footprint", 0])
      plaza_area += plaza_cut.area
      additional_plaza_area += plaza_cut.difference(old_road_cut).area
    if not candidates:
      continue
    removed = unary_union(candidates)
    affected = [
      i
      for i in range(run)
      if removed.intersection(box(x0 + i * cell, z0, x0 + (i + 1) * cell, z1)).area
      > 1e-7
    ]
    ranges = []
    first = last = affected[0]
    for i in [*affected[1:], affected[-1] + 2]:
      if i != last + 1:
        ranges.append((first, last + 1))
        first = i
      last = i
    first_record = len(records)
    for first, end in ranges:
      host = box(x0 + first * cell, z0, x0 + end * cell, z1)
      if host.intersection(plaza_cut).area > 1e-7:
        plaza_records.append(len(records))
      complement = host.difference(removed)
      ts, es = len(triangles), len(edges)
      for polygon in parts(shapely.orient_polygons(complement)):
        for triangle in shapely.constrained_delaunay_triangles(polygon).geoms:
          points = np.asarray(list(triangle.exterior.coords)[:3], dtype="<f4").astype(
            float
          )
          ab, ac = points[1] - points[0], points[2] - points[0]
          if ab[0] * ac[1] - ab[1] * ac[0] < 0:
            points = points[[0, 2, 1]]
          triangles.extend(points.tolist())
        for ring in [polygon.exterior, *polygon.interiors]:
          points = list(ring.coords)
          for a, b in zip(points, points[1:]):
            edges.extend((a, b))
      records.append([col + first, row, ts, len(triangles) - ts, es, len(edges) - es])
      spans.append(end - first)
      tops.append(top)
    retained_source.append(rect)
    by_class[kind] = by_class.get(kind, 0) + removed.area
    evidence.append(
      {
        "finalRun": rect,
        "class": kind,
        "firstRecord": first_record,
        "recordCount": len(records) - first_record,
        "removedAreaM2": removed.area,
        "plazaOwnershipAreaM2": plaza_cut.area,
        "roadTriangles": receipts,
        "removed": shapely.to_geojson(removed),
      }
    )
  vertices = len(triangles) * 2 + len(edges) * 3
  counts = {
    "runs": len(evidence),
    "spans": len(records),
    "cells": sum(spans),
    "removedAreaM2": round(sum(r["removedAreaM2"] for r in evidence), 6),
    "unindexedVertices": vertices,
    "unindexedGeometryBytes": vertices * 36,
    "byClassM2": by_class,
    "plazaFootprintAreaM2": plaza_footprint.area,
    "plazaOwnedOriginalGroundM2": plaza_area,
    "plazaAdditionalOwnershipM2": additional_plaza_area,
  }
  data = {
    "format": "exact-drawn-water-boundary",
    "version": 1,
    "cell_m": cell,
    "grid": grid,
    "source_sha256": inputs[str(STREET_FILES[0].relative_to(ROOT))],
    "ground_sha256": hashlib.sha256(ground_bytes).hexdigest(),
    "roadGuards": [source_guard(s) for s in streets],
    "mitteSourceSha256": mitte["sourceSha256"],
    "plazaSourceSha256": plaza["sourceSha256"],
    "plazaRecords": plaza_records,
    "counts": counts,
    "cells_u32": encode(records, "<u4"),
    "spans_u32": encode(spans, "<u4"),
    "tops_f32": encode(tops, "<f4"),
    "triangles_f32": encode(triangles, "<f4"),
    "edges_f32": encode(edges, "<f4"),
  }
  (APP / "roadGroundV343.json").write_text(
    json.dumps(data, separators=(",", ":")) + "\n"
  )
  audit = {
    "inputSha256": inputs,
    "captureSha256": source["captureSha256"],
    "counts": counts,
    "includedCurrentSurveyXZ": CURRENT_SURVEY,
    "restoredKulturforumBatchIds": sorted(wanted),
    "policy": "Proven final slab occlusions below unchanged street triangles, plus exact complete prepared Kulturforum plaza ownership; full outside land complement, original paint/top/bottom, Native untouched",
    "records": evidence,
  }
  (GEO / "road-ground-v343-evidence.json.gz").write_bytes(
    gzip.compress(json.dumps(audit, separators=(",", ":")).encode(), mtime=0)
  )
  if capture:
    source["records"] = retained_source
    SOURCE.write_bytes(
      gzip.compress(json.dumps(source, separators=(",", ":")).encode(), mtime=0)
    )
  print(json.dumps(counts, indent=2))


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--capture", type=Path)
  build(parser.parse_args().capture)
