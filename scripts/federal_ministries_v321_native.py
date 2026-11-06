"""Exact native host selection for the finite federal V321 public facades.

This consumes real completed constructors, never substitutes a reduced city.
Column contributions use positive polygon area and the original four-metre grid.
"""

from __future__ import annotations

import base64
import json
from collections import defaultdict
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, box
from shapely.ops import unary_union
from shapely.strtree import STRtree


def decode(text, dtype):
  return np.frombuffer(base64.b64decode(text), dtype=dtype)


def encoded(values, dtype="<f4"):
  return base64.b64encode(np.asarray(values, dtype=dtype).tobytes()).decode()


def capture_parts(path):
  return {p["name"]: p for p in json.loads(Path(path).read_text())["parts"]}


def row_matrix(row):
  return decode(row["matrix"], "<f4").reshape(4, 4).T


def native_columns(prisms, voxels, wanted_ids, obsolete):
  """All relevant exact raw columns, with every positive original contributor."""
  shapes, rows = [], []
  for p in prisms:
    if p["h_dm"] <= 0:
      continue
    q = Polygon(
      np.asarray(p["ring"]) / 10, [np.asarray(h) / 10 for h in p.get("holes", [])]
    )
    if not q.is_valid:
      q = q.buffer(0)
    if q.is_empty:
      continue
    shapes.append(q)
    rows.append(p)
  tree = STRtree(shapes)
  targets = unary_union(
    [shapes[i] for i, p in enumerate(rows) if p["id"] in wanted_ids]
  )
  records, mixed = [], []
  cell = voxels["cell_m"]
  for z, runs in enumerate(voxels["building_rows"]):
    iz = voxels["grid"]["min_z_idx"] + z
    for start, count, y0, y1, cls in runs:
      for dx in range(count):
        ix = voxels["grid"]["min_x_idx"] + start + dx
        square = box(ix * cell, iz * cell, (ix + 1) * cell, (iz + 1) * cell)
        if not targets.intersects(square):
          continue
        ids = sorted(
          rows[int(i)]["id"]
          for i in tree.query(square, predicate="intersects")
          if shapes[int(i)].intersection(square).area > 1e-7
        )
        eligible = [i for i in ids if i in wanted_ids]
        if not eligible:
          continue
        record = {
          "source": [ix, iz, y0, y1, cls],
          "contributors": ids,
          "retireBody": bool(ids) and all(i in obsolete for i in ids),
        }
        # Several obsolete outlines may legitimately contribute to one
        # cell. A foreign/tower contributor always keeps the old cell.
        if record["retireBody"] or len(ids) == 1:
          records.append(record)
        else:
          mixed.append(record)
  return records, mixed


def row_column(row, cell=4, window=False):
  m = row_matrix(row)
  x, z = float(m[0, 3]), float(m[2, 3])
  if window:
    x -= float(m[0, 2]) * (cell / 2 + 0.08)
    z -= float(m[2, 2]) * (cell / 2 + 0.08)
  return (round(x / cell - 0.5), round(z / cell - 0.5))


def native_plans(full_path, touch_path, records, lookup, faces, obsolete):
  """Exact semantic tuples from actual full/touch constructor output."""
  by_cell = {tuple(r["source"][:2]): r for r in records}
  output = {}
  for key, path in [("nativeFull", full_path), ("nativeTouch", touch_path)]:
    parts = capture_parts(path)
    owners = defaultdict(list)
    for name, part in parts.items():
      is_window = name == "Voxel facade windows"
      selected = defaultdict(list)
      retire = defaultdict(list)
      for row in part["rows"]:
        record = by_cell.get(row_column(row, window=is_window))
        if not record:
          continue
        # Shared obsolete cells are assigned once, with the full
        # contributor list separately proven by nativeSource.
        owner = min(record["contributors"])
        if owner not in lookup:
          raise ValueError("Missing original contributor")
        at = len(selected[owner])
        selected[owner].append(row)
        m = row_matrix(row)
        center = [float(m[0, 3]), float(m[1, 3]), float(m[2, 3])]
        if (
          record["retireBody"]
          or is_window
          and on_faces(center, faces.get(owner, []), tolerance=3)
        ):
          retire[owner].append(at)
      for owner, rows in selected.items():
        if not rows:
          continue
        owners[owner].append(
          {
            "name": name,
            "kind": "instances",
            "attributes": part["attributes"],
            "index": part["index"],
            "instances": {
              "count": len(rows),
              "matrix": base64.b64encode(
                b"".join(base64.b64decode(r["matrix"]) for r in rows)
              ).decode(),
              "color": base64.b64encode(
                b"".join(base64.b64decode(r["color"]) for r in rows)
              ).decode(),
            },
            "retire": retire[owner],
          }
        )
    # Body proof is mandatory even for facade-only additions.
    items = [
      {
        "id": owner,
        "sourcePrism": lookup[owner],
        "retireBody": owner in obsolete,
        "components": components,
      }
      for owner, components in sorted(owners.items())
      if any(c["name"] == "Voxel building columns" for c in components)
    ]
    valid_ids = {p["id"] for p in items}
    selected_columns = [r for r in records if min(r["contributors"]) in valid_ids]
    output[key] = {
      "schemaVersion": 1,
      "native": True,
      "owners": items,
      "nativeSource": {"cell": 4, "grid": None, "columns": selected_columns},
    }
  return output


def on_faces(p, faces, tolerance=0.18):
  for f in faces:
    a, d, n = map(np.asarray, [f["a"], f["d"], f["n"]])
    delta = np.asarray([p[0], p[2]]) - a
    u, distance = float(delta @ d), float(delta @ n)
    scope = f.get("scope", f["range"])
    if (
      abs(distance) <= tolerance
      and scope[0] - 0.3 <= u <= scope[1] + 0.3
      and scope[2] - 0.3 <= p[1] <= scope[3] + 0.3
    ):
      return True
  return False


def primitive_world_faces(part, records):
  """Actual body side rectangles; no reconstructed column-height formula."""
  result = []
  allowed = {tuple(r["source"][:2]): r for r in records}
  rows = [(r, row_matrix(r)) for r in part["rows"] if row_column(r) in allowed]
  intervals = defaultdict(list)
  for row, m in rows:
    ix, iz = row_column(row)
    half = np.abs(m[:3, :3]).sum(axis=1) / 2
    lo, hi = m[:3, 3] - half, m[:3, 3] + half
    intervals[ix, iz].append((float(lo[1]), float(hi[1])))
    for axis, sign, dx, dz in [
      (0, -1, -1, 0),
      (0, 1, 1, 0),
      (2, -1, 0, -1),
      (2, 1, 0, 1),
    ]:
      plane = float(lo[axis] if sign < 0 else hi[axis])
      other = 2 if axis == 0 else 0
      poly = box(float(lo[other]), float(lo[1]), float(hi[other]), float(hi[1]))
      for bottom, top in intervals.get((ix + dx, iz + dz), []):
        poly = poly.difference(box(float(lo[other]), bottom, float(hi[other]), top))
      result.append((allowed[ix, iz], axis, sign, plane, poly))
  # Remove all neighbouring occupied volumes independent of source row order.
  final = []
  for record, axis, sign, plane, poly in result:
    ix, iz = record["source"][:2]
    near = (ix + sign, iz) if axis == 0 else (ix, iz + sign)
    for bottom, top in intervals.get(near, []):
      if poly.is_empty:
        break
      x0, _, x1, _ = poly.bounds
      poly = poly.difference(box(x0 - 1, bottom, x1 + 1, top))
    if not poly.is_empty:
      final.append((record, axis, sign, plane, poly))
  return final


def selected_cardinal_faces(triangles, faces, max_faces=120):
  """Clip actual cardinal source planes against the selected public source fronts."""
  grouped = defaultdict(list)
  endpoints = [
    np.asarray(f["a"]) + np.asarray(f["d"]) * u
    for f in faces
    for u in f.get("scope", f["range"])[:2]
  ]
  extent = np.asarray(endpoints)
  lo, hi = extent.min(axis=0) - 4.2, extent.max(axis=0) + 4.2
  candidates = np.asarray(triangles)
  centers = candidates.mean(axis=1)
  candidates = candidates[
    (centers[:, 0] >= lo[0])
    & (centers[:, 0] <= hi[0])
    & (centers[:, 2] >= lo[1])
    & (centers[:, 2] <= hi[1])
  ]
  for tri in candidates:
    p = np.asarray(tri)
    normal = np.cross(p[1] - p[0], p[2] - p[0])
    size = np.linalg.norm(normal)
    if size < 1e-8 or abs(normal[1]) > 0.001:
      continue
    normal /= size
    axis = int(np.argmax(np.abs(normal)))
    if axis not in (0, 2) or abs(normal[axis]) < 0.999999:
      continue
    sign = 1 if normal[axis] > 0 else -1
    plane = float(p[0, axis])
    center = p.mean(axis=0)
    eligible = []
    for f in faces:
      n = np.asarray(f["n"])
      if n[axis // 2] * sign < 0.5:
        continue
      delta = center[[0, 2]] - np.asarray(f["a"])
      u, distance = delta @ f["d"], delta @ n
      scope = f.get("scope", f["range"])
      if (
        abs(distance) <= 4.1
        and scope[0] - 2.1 <= u <= scope[1] + 2.1
        and scope[2] <= center[1] <= scope[3]
      ):
        eligible.append((abs(distance), f))
    if not eligible:
      continue
    _, f = min(eligible, key=lambda q: q[0])
    other = 2 if axis == 0 else 0
    poly = Polygon(p[:, [other, 1]])
    scope = f.get("scope", f["range"])
    poly = poly.intersection(box(-10000, scope[2] + 0.25, 10000, scope[3] - 0.3))
    if not poly.is_empty and poly.area > 0.05:
      grouped[f["owner"], axis, sign, plane].append(poly)
  result = []
  for (owner, axis, sign, plane), pieces in grouped.items():
    shape = unary_union(pieces)
    polygons = [shape] if shape.geom_type == "Polygon" else list(shape.geoms)
    for poly in polygons:
      if poly.area < 3:
        continue
      lo, bottom, hi, top = poly.bounds
      if hi - lo < 1.6 or top - bottom < 2.1:
        continue
      a = [plane, 0] if axis == 0 else [0, plane]
      d = [0, 1] if axis == 0 else [1, 0]
      n = [sign, 0] if axis == 0 else [0, sign]
      result.append(
        {
          "owner": owner,
          "a": a,
          "d": d,
          "n": n,
          "range": [lo + 0.08, hi - 0.08, bottom, top],
          "scope": [lo, hi, bottom, top],
          "polygon": list(map(list, poly.exterior.coords[:-1])),
          "holes": [list(map(list, r.coords[:-1])) for r in poly.interiors],
          "voids": [],
        }
      )
  return sorted(
    result,
    key=lambda f: -(f["range"][1] - f["range"][0]) * (f["range"][3] - f["range"][2]),
  )[:max_faces]
