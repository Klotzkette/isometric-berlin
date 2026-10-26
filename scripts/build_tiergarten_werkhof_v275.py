"""Finite Werkhof correction: intact source evidence, three receipted height repairs.

All horizontal survey coordinates and every original surface remain available.
The two measured low roofs use bDOM NHN samples; the occluded NW shed is an
explicit 3 m display estimate. No network, city source rewrite, or runtime raster.
"""

from __future__ import annotations

import base64
import copy
import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon, box, shape
from shapely.ops import unary_union

from scripts.build_breitscheid_towers_v161 import triangles_for

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/tiergarten-werkhof-v275-source.json.gz"
OUTPUT = ROOT / "src/app/src/data/tiergartenWerkhofV275.json"
# The lower roof ordinate and ridge ordinate are scene Y = metres NHN minus 30.
CORRECTIONS = {
  "DEBE01YYK0002L8a": dict(
    eave=5.85,
    ridge=5.95,
    status="bDOM-supported-low-roof",
    reason="Roof-interior samples 35.85–35.92 m NHN; high edge samples are branches.",
  ),
  "DEBE01YYK0003Txs": dict(
    eave=5.20,
    ridge=5.34,
    status="bDOM-supported-low-roof",
    reason="Ten interior samples 35.20–35.33 m NHN, rather than the old 57.02 m apex.",
  ),
  "DEBE01YYK0003VMG": dict(
    eave=5.262,
    ridge=5.712,
    status="occluded-height-estimate",
    reason="Small roof under woodland. bDOM reads canopy; 3.0 m envelope is a bounded display estimate, not a surveyed roof height.",
  ),
}
CANOPIES = {
  "K0003V9x",
  "K0003U3m",
  "K0003VKP",
  "K0003VMG",
  "K0003Txs",
  "K0003V3I",
  "K0003U1j",
  "K0003V4T",
  "K0003U3h",
  "K0003UrX",
  "K0003Uow",
}
HOUSES = {"K0002Q8X", "K0002KS2", "K0002RLM", "K0002QXE"}


def packed(rows, dtype):
  return base64.b64encode(np.asarray(rows, dtype=dtype).tobytes()).decode()


def roof_at(triangles, x, z):
  result = None
  for a, b, c in triangles:
    det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2])
    if abs(det) < 1e-9:
      continue
    u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det
    v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det
    if min(u, v, 1 - u - v) >= -1e-6:
      y = u * a[1] + v * b[1] + (1 - u - v) * c[1]
      result = y if result is None else max(result, y)
  return result


def corrected_part(parent):
  part = copy.deepcopy(parent["parts"][0])
  correction = CORRECTIONS.get(parent["id"])
  if correction:
    roof_y = [
      v[1]
      for s in part["surfaces"]
      if s["kind"] == "RoofSurface"
      for r in s["rings"]
      for v in r
    ]
    lo, hi, ground = min(roof_y), max(roof_y), part["ground_y_m"]

    def height(y):
      if y <= lo:
        return ground + (y - ground) / (lo - ground) * (correction["eave"] - ground)
      return correction["eave"] + (y - lo) / (hi - lo) * (
        correction["ridge"] - correction["eave"]
      )

    for surface in part["surfaces"]:
      for ring in surface["rings"]:
        for vertex in ring:
          vertex[1] = round(height(vertex[1]), 3)
    part["top_y_m"] = correction["ridge"]
    part["height_m"] = round(correction["ridge"] - ground, 3)
  return part


def build():
  raw = SOURCE.read_bytes()
  evidence = json.loads(gzip.decompress(raw))
  assert {
    r["id"][-8:] for r in evidence["alkis"]["rows"] if r["function"] == "51009_1610"
  } == CANOPIES
  positions, colors, parts, drawn, native, roles = [], [], [], [], [], []
  omitted_fittings = []
  native_fitting_plans = []
  footprints = unary_union(
    [
      Polygon(p["parts"][0]["ring"], p["parts"][0]["holes"])
      for p in evidence["parents"]
    ]
  )
  for parent in evidence["parents"]:
    p = corrected_part(parent)
    polygon = Polygon(p["ring"], p["holes"])
    house = parent["id"][-8:] in HOUSES
    canopy = parent["id"][-8:] in CANOPIES
    wall_color = 0xC8BCA5 if house else 0xA4A18D
    roof_color = 0x9E5544 if house else 0x6D7061
    roofs = []
    for surface in p["surfaces"]:
      if canopy and surface["kind"] != "RoofSurface":
        continue
      triangles = triangles_for(surface["rings"])
      positions.extend(triangles)
      colors.extend(
        [roof_color if surface["kind"] == "RoofSurface" else wall_color]
        * len(triangles)
      )
      if surface["kind"] == "RoofSurface":
        roofs.extend(triangles)
    cells = []
    xmin, zmin, xmax, zmax = polygon.bounds
    native_shapes = []
    for ix in range(math.floor(xmin), math.ceil(xmax)):
      for iz in range(math.floor(zmin), math.ceil(zmax)):
        area = polygon.intersection(box(ix, iz, ix + 1, iz + 1))
        if area.area < 0.035:
          continue
        pt = area.representative_point()
        y = roof_at(roofs, pt.x, pt.y)
        if y is None:
          raise ValueError(f"Missing retained roof at {parent['id']} {pt}")
        top = math.ceil((y - 1e-7) * 4) / 4
        cells.append([ix, iz, top])
        native_shapes.append(box(ix, iz, ix + 1, iz + 1))
    nshape = unary_union(native_shapes)
    assert nshape.geom_type == "Polygon", parent["id"]
    record = dict(
      sourceId=parent["id"][-8:],
      parentId=parent["id"],
      ring=p["ring"],
      holes=p["holes"],
      minY=p["ground_y_m"],
      maxY=p["top_y_m"],
      roofTriangles=roofs,
      nativeCells=cells,
      nativeRing=[list(v) for v in list(nshape.exterior.coords)[:-1]],
      nativeHoles=[[list(v) for v in list(h.coords)[:-1]] for h in nshape.interiors],
      wallColor=wall_color,
      roofColor=roof_color,
      correction=CORRECTIONS.get(parent["id"]),
      surfaceCount=len(p["surfaces"]),
    )
    record["openCanopy"] = canopy
    record["roofBottom"] = min(v[1] for t in roofs for v in t) - 0.22
    record["posts"] = []
    record["nativePosts"] = []
    parts.append(record)
    cell_map = {(x, z): top for x, z, top in cells}

    def emit(a, d, n, u, y, width, height, depth, color, role, out=0.09):
      c = np.asarray(a) + np.asarray(d) * u + np.asarray(n) * out
      native_rows = []
      fitting_plans = []
      count = max(1, math.ceil(width / 0.55))
      for j in range(count):
        uu = u + (j + 0.5) * width / count - width / 2
        w = abs(d[0]) * width / count + abs(n[0]) * depth
        dep = abs(d[1]) * width / count + abs(n[1]) * depth
        # Real orthogonal source columns determine placement, not drawn planes.
        for displacement in np.arange(out, 1.91, 0.08):
          q = np.asarray(a) + np.asarray(d) * uu + np.asarray(n) * displacement
          intersects = any(
            cell_map.get((ix, iz), -100) > y - height / 2
            for ix in range(math.floor(q[0] - w / 2), math.floor(q[0] + w / 2) + 1)
            for iz in range(math.floor(q[1] - dep / 2), math.floor(q[1] + dep / 2) + 1)
          )
          if not intersects:
            break
        else:
          omitted_fittings.append(
            dict(
              parentId=parent["id"],
              role=role,
              reason="Concave/corner fitting cannot clear actual native columns within 1.9 m.",
            )
          )
          return
        fitting_plans.append(uu)
        native_rows.append(
          [
            round(float(q[0]), 4),
            y,
            round(float(q[1]), 4),
            max(0.045, w),
            height,
            max(0.045, dep),
            0,
            color,
          ]
        )
      fitting_base = len(native)
      native_fitting_plans.extend(
        (fitting_base + j, parent["id"], role, a.copy(), d.copy(), n.copy(), uu, out)
        for j, uu in enumerate(fitting_plans)
      )
      drawn.append(
        [
          *map(float, (c[0], y, c[1], width, height, depth, math.atan2(-d[1], d[0]))),
          color,
        ]
      )
      roles.append(role)
      native.extend(native_rows)

    if canopy:
      # ALKIS 51009_1610: original vertical closure is a LoD2 envelope, not a wall.
      # Roof skins and post dimensions below are explicit construction estimates.
      for triangle in roofs:
        bottom = [[v[0], v[1] - 0.22, v[2]] for v in triangle]
        positions.append(bottom)
        colors.append(roof_color)
      for a, b in zip(p["ring"], p["ring"][1:] + p["ring"][:1], strict=True):
        ya, yb = roof_at(roofs, *a), roof_at(roofs, *b)
        if ya is None or yb is None:
          continue
        aa, bb = [a[0], ya, a[1]], [b[0], yb, b[1]]
        low_a, low_b = [a[0], ya - 0.22, a[1]], [b[0], yb - 0.22, b[1]]
        positions.extend([[aa, bb, low_b], [aa, low_b, low_a]])
        colors.extend([roof_color, roof_color])
      post_points = []
      for a, b in zip(p["ring"], p["ring"][1:] + p["ring"][:1], strict=True):
        a, b = np.asarray(a), np.asarray(b)
        length = float(np.linalg.norm(b - a))
        for j in range(max(1, math.ceil(length / 6))):
          q = a + (b - a) * j / max(1, math.ceil(length / 6))
          if any(np.linalg.norm(q - v) < 1.2 for v in post_points):
            continue
          top = roof_at(roofs, *q)
          if top is None or top - 0.22 < p["ground_y_m"] + 0.2:
            continue
          post_points.append(q)
          h = top - 0.22 - p["ground_y_m"]
          post = [
            round(float(q[0]), 3),
            p["ground_y_m"] + h / 2,
            round(float(q[1]), 3),
            0.22,
            h,
            0.22,
          ]
          record["posts"].append(post)
          native_top = (
            cell_map.get((math.floor(q[0]), math.floor(q[1])), math.ceil(top * 4) / 4)
            - 0.25
          )
          native_h = max(0.05, native_top - p["ground_y_m"])
          native_post = [
            post[0],
            p["ground_y_m"] + native_h / 2,
            post[2],
            0.22,
            native_h,
            0.22,
          ]
          record["nativePosts"].append(native_post)
          drawn.append(post + [0, 0x5D6255])
          native.append(native_post + [0, 0x5D6255])
          roles.append("open-canopy-post")
      continue

    for a, b in zip(p["ring"], p["ring"][1:] + p["ring"][:1], strict=True):
      a, b = np.asarray(a), np.asarray(b)
      delta = b - a
      length = float(np.linalg.norm(delta))
      if length < 3:
        continue
      d = delta / length
      n = np.array([-d[1], d[0]])
      if polygon.covers(Point(a + delta * 0.5 + n * 0.15)):
        n = -n
      # Skip shared wall boundaries and tiny projections; keep external faces only.
      if footprints.covers(Point(a + delta * 0.5 + n * 0.3)):
        continue
      eaves = min(
        v[1]
        for s in p["surfaces"]
        if s["kind"] == "RoofSurface"
        for r in s["rings"]
        for v in r
      )
      clearance = eaves - p["ground_y_m"]
      if clearance < 1.8:
        continue
      emit(
        a,
        d,
        n,
        length / 2,
        eaves - 0.08,
        length,
        0.12,
        0.16,
        0x484F48,
        "eaves-gutter",
        0.14,
      )
      yard = np.array([-479, 486]) - a - d * length / 2
      if not house and (np.dot(yard, n) < 0 or length < 5.5):
        continue
      bays = max(1, math.floor(length / (3.5 if house else 3.8)))
      for bay in range(bays):
        u = (bay + 0.5) * length / bays
        if house:
          for floor in range(max(1, min(2, int(clearance / 2.8)))):
            y = p["ground_y_m"] + 1.8 + floor * 2.75
            if y + 0.75 > eaves - 0.3:
              continue
            emit(
              a, d, n, u, y, 1.25, 1.50, 0.13, 0xECE5D5, "house-window-surround", 0.11
            )
            emit(a, d, n, u, y, 1.05, 1.3, 0.12, 0x536367, "house-small-pane", 0.2)
            emit(a, d, n, u, y, 0.07, 1.3, 0.12, 0xD5D1BC, "house-window-mullion", 0.28)
            emit(
              a,
              d,
              n,
              u,
              y + 0.08,
              1.05,
              0.07,
              0.12,
              0xD5D1BC,
              "house-window-crossbar",
              0.28,
            )
          if bay == 0:
            emit(
              a,
              d,
              n,
              min(length - 0.9, u + 1),
              p["ground_y_m"] + 1.02,
              0.8,
              2.04,
              0.15,
              0x635C43,
              "house-door",
              0.13,
            )
        else:
          height = min(2.05, clearance - 0.25)
          y = p["ground_y_m"] + height / 2 + 0.04
          emit(
            a,
            d,
            n,
            u,
            y,
            min(2.65, length / bays - 0.5),
            height,
            0.13,
            0x59665B,
            "workshop-garage-door",
            0.13,
          )
          for dy in [-0.5, 0, 0.5]:
            emit(
              a,
              d,
              n,
              u,
              y + dy,
              min(2.65, length / bays - 0.5),
              0.055,
              0.14,
              0x879081,
              "garage-door-horizontal-division",
              0.23,
            )
    # Roof ribs retain measured ridge planes: no invented flat slab over houses.

  site = Polygon(evidence["osmSite"]["ringWorld"])
  exclusions = unary_union(
    [
      shape(f["geometry"]).buffer(f["widthEstimate"] / 2 + 1)
      for f in evidence["exclusionFeatures"]
    ]
  )
  architectural_triangles = len(positions)
  # Twenty-face procedural crowns, bounded by the already clipped shrub box.
  # These are display estimates, deliberately separate from survey surfaces.
  phi = (1 + math.sqrt(5)) / 2
  crown = (
    np.asarray(
      [
        (-1, phi, 0),
        (1, phi, 0),
        (-1, -phi, 0),
        (1, -phi, 0),
        (0, -1, phi),
        (0, 1, phi),
        (0, -1, -phi),
        (0, 1, -phi),
        (phi, 0, -1),
        (phi, 0, 1),
        (-phi, 0, -1),
        (-phi, 0, 1),
      ]
    )
    / phi
  )
  crown_faces = [
    (0, 11, 5),
    (0, 5, 1),
    (0, 1, 7),
    (0, 7, 10),
    (0, 10, 11),
    (1, 5, 9),
    (5, 11, 4),
    (11, 10, 2),
    (10, 7, 6),
    (7, 1, 8),
    (3, 9, 4),
    (3, 4, 2),
    (3, 2, 6),
    (3, 6, 8),
    (3, 8, 9),
    (4, 9, 5),
    (2, 4, 11),
    (6, 2, 10),
    (8, 6, 7),
    (9, 8, 1),
  ]
  shrubs = []
  inset = site.buffer(-2.0).boundary
  for i in range(math.floor(inset.length / 3.3)):
    pt = inset.interpolate(i * 3.3)
    footprint = box(pt.x - 0.85, pt.y - 0.85, pt.x + 0.85, pt.y + 0.85)
    if (
      not site.covers(footprint)
      or footprints.buffer(2).intersects(footprint)
      or exclusions.intersects(footprint)
    ):
      continue
    # Only perimeter shrubs, never the working yard or a guessed building screen.
    if site.boundary.distance(pt) > 2.1:
      continue
    height = 1.15 + 0.15 * (i % 4)
    y = 3.05 + height / 2
    shrubs.append(
      dict(x=round(pt.x, 4), z=round(pt.y, 4), width=1.7, height=height, groundY=3.05)
    )
    tone = [0x4B633C, 0x536D40, 0x61754A][i % 3]
    verts = crown * np.array([0.85, height / 2, 0.85]) + np.array([pt.x, y, pt.y])
    positions.extend([[verts[j].tolist() for j in face] for face in crown_faces])
    colors.extend([tone] * len(crown_faces))
    for w, h, d, cy in [
      (1.7, 0.55, 1.36, 0.275),
      (1.36, 0.8, 1.7, 0.4),
      (1.02, 0.45, 1.02, 0.775),
    ]:
      native.append([pt.x, 3.05 + height * cy, pt.y, w, height * h, d, 0, tone])
  # Final compound-wide clearance is independent of construction order. The
  # earlier per-face guard cannot see an adjacent owner's stepped columns.
  # Use complete actual volumes, including open roof UNDERSIDES and posts.
  volumes = {}

  def add_volume(bounds):
    xmin, ymin, zmin, xmax, ymax, zmax = bounds
    for ix in range(math.floor(xmin), math.floor(xmax) + 1):
      for iz in range(math.floor(zmin), math.floor(zmax) + 1):
        volumes.setdefault((ix, iz), []).append(bounds)

  for part in parts:
    for ix, iz, top in part["nativeCells"]:
      bottom = top - 0.25 if part["openCanopy"] else part["minY"]
      add_volume((ix, bottom, iz, ix + 1, top, iz + 1))
    for x, y, z, w, h, d in part["nativePosts"]:
      add_volume((x - w / 2, y - h / 2, z - d / 2, x + w / 2, y + h / 2, z + d / 2))

  def touches_volume(row):
    # Round exactly as the runtime packet, then allow a small clearance for
    # instance-matrix Float32 arithmetic. All native elements are orthogonal.
    x, y, z, w, h, d, *_ = np.asarray(row, dtype="<f4").astype(float)
    lo = np.array([x - w / 2, y - h / 2, z - d / 2]) - 0.00015
    hi = np.array([x + w / 2, y + h / 2, z + d / 2]) + 0.00015
    return any(
      min(hi[0], v[3]) > max(lo[0], v[0])
      and min(hi[1], v[4]) > max(lo[1], v[1])
      and min(hi[2], v[5]) > max(lo[2], v[2])
      for ix in range(math.floor(lo[0]), math.floor(hi[0]) + 1)
      for iz in range(math.floor(lo[2]), math.floor(hi[2]) + 1)
      for v in volumes.get((ix, iz), [])
    )

  repairs = []
  discard = set()
  for index, parent_id, role, a, d, n, uu, out in native_fitting_plans:
    row = native[index]
    if not touches_volume(row):
      continue
    previous = list(row)
    for displacement in np.arange(out, 1.91, 0.08):
      q = a + d * uu + n * displacement
      candidate = [round(float(q[0]), 4), row[1], round(float(q[1]), 4), *row[3:]]
      if not touches_volume(candidate):
        native[index] = candidate
        repairs.append(
          dict(
            parentId=parent_id,
            role=role,
            oldIndex=index,
            action="reposition",
            before=previous,
            after=candidate,
          )
        )
        break
    else:
      # Only this occluded new native subsegment is removed. The measured shell,
      # drawn fitting and every other visible subsegment are byte-preserved.
      discard.add(index)
      repairs.append(
        dict(
          parentId=parent_id,
          role=role,
          oldIndex=index,
          action="omit-occluded-estimate-segment",
          before=previous,
        )
      )
  native = [row for i, row in enumerate(native) if i not in discard]
  return dict(
    schemaVersion=1,
    nativeFittingRepairs=repairs,
    omittedFittingEstimates=omitted_fittings,
    sourceSha256=hashlib.sha256(raw).hexdigest(),
    compoundRing=evidence["osmSite"]["ringWorld"],
    parts=parts,
    drawnPositions=packed(positions, "<f4"),
    drawnColors=packed(colors, "<u4"),
    drawnDetails=packed(drawn, "<f4"),
    nativeDetails=packed(native, "<f4"),
    detailRoles=roles,
    shrubs=shrubs,
    counts=dict(
      parents=len(parts),
      sourceParts=len(parts),
      surfaces=sum(p["surfaceCount"] for p in parts),
      triangles=len(positions),
      architecturalTriangles=architectural_triangles,
      estimatedShrubTriangles=len(positions) - architectural_triangles,
      shrubs=len(shrubs),
      drawnDetailBoxes=len(drawn),
      nativeDetailBoxes=len(native),
      nativeBodyCells=sum(len(p["nativeCells"]) for p in parts),
      correctedParents=len(CORRECTIONS),
      openCanopies=len(CANOPIES),
      canopyPosts=sum(len(p["posts"]) for p in parts),
    ),
  )


def main():
  data = build()
  OUTPUT.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n")
  print(json.dumps(data["counts"], indent=2))
  print(f"{OUTPUT}: {OUTPUT.stat().st_size} bytes")


if __name__ == "__main__":
  main()
