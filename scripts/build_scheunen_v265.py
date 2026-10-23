"""Step 10: mapped missing entrances and measured eave details in Scheunenviertel.

No city asset is rewritten. Small source-bound recipes join existing packets.
"""

from __future__ import annotations

import base64
import json
import math
import re
from collections import Counter, defaultdict

import numpy as np
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import nearest_points, unary_union
from shapely.strtree import STRtree

from scripts import build_district_facades_v188 as base
from scripts.build_house_doors_v233 import nav_fingerprint
from scripts.build_roof_house_v233 import fingerprint
from scripts.build_scheunen_facades_v183 import footprint

ROOT, GEO, OUT = base.ROOT, base.GEO, base.OUT
SOURCE = GEO / "scheunenviertel-v168.json"
CONTEXT = GEO / "house-doors-v233-context.json.gz"
EVIDENCE = GEO / "scheunen-v265-evidence.json.gz"
RUNTIME = ROOT / "src/app/src/data/scheunenV265.json"
MAX_DOORS, MAX_EAVES, MAX_BOXES = 28, 12, 900
POLICY = (
  "Only previously missing mapped OSM entrance nodes on complete retained LoD2 "
  "street walls. Eaves follow actual horizontal wall/roof joins. Door opening "
  "sizes, frames, drain positions and metal sections are explicit display "
  "estimates. No window grid, paint, roof, courtyard or navigation is replaced. "
  "Independent native fittings use actual delivered orthogonal wall planes."
)


def protected() -> set[str]:
  """Named authored owners and prior measured roof treatments remain untouched."""
  result = set()
  for pattern in (
    "src/app/src/data/*.json",
    "src/app/src/*.ts",
    "src/app/src/*Source.json",
    "src/app/src/*Prisms.json",
  ):
    for path in ROOT.glob(pattern):
      if path.name not in {
        RUNTIME.name,
        "buildingAttributeSource.json",
        "weinbergBuildingOffsetsV176.json",
      }:
        result.update(re.findall(r"\bDEBE[A-Za-z0-9]+", path.read_text()))
  for filename in ("roof-house-v233-source.json.gz", "outer-roofs-v262-source.json.gz"):
    path = GEO / filename
    if path.exists():
      result.update(row["owner"] for row in base.read_json(path)["owners"])
  return result


def source_faces(source: dict) -> tuple[list[dict], list]:
  """Use full original wall rings, not approximate navigation envelopes."""
  buildings = source["buildings"] + source["retainedDetailedBuildings"]
  occupied = [footprint(b) for b in buildings]
  occupied_tree = STRtree(occupied)
  blocked = protected()
  roads = [shape(r["geometry"]) for r in source["roads"]]
  roads_tree, scope = STRtree(roads), shape(source["scope"])
  offsets = base.read_json(ROOT / "src/app/src/data/weinbergBuildingOffsetsV176.json")[
    "offsets"
  ]
  faces = []
  for bi, building in enumerate(buildings):
    if building["id"] in blocked:
      continue
    for part in building["parts"]:
      dy = offsets.get(part["id"], offsets.get(building["id"], 0))
      roofs = [s for s in part["surfaces"] if s["kind"] == "RoofSurface"]
      for si, surface in enumerate(part["surfaces"]):
        if surface["kind"] != "WallSurface":
          continue
        pts = np.array(surface["rings"][0], dtype=float)
        pts[:, 1] += dy
        a, b = max(
          ((a, b) for a in pts for b in pts),
          key=lambda ab: np.linalg.norm((ab[0] - ab[1])[[0, 2]]),
        )
        d = (b - a)[[0, 2]]
        length = float(np.linalg.norm(d))
        if length < 4:
          continue
        d /= length
        n = np.array([-d[1], d[0]])
        anchor = a[[0, 2]]
        mid = (a + b)[[0, 2]] / 2
        if occupied[bi].covers(Point(*(mid + n * 0.15))):
          n = -n
        if not scope.covers(Point(*mid)):
          continue
        planar = Polygon(
          [
            (float(np.dot(np.array(p)[[0, 2]] - anchor, d)), p[1] + dy)
            for p in surface["rings"][0]
          ],
          [
            [(float(np.dot(np.array(p)[[0, 2]] - anchor, d)), p[1] + dy) for p in ring]
            for ring in surface["rings"][1:]
          ],
        )
        if not planar.is_valid or planar.area < 10:
          continue
        lo, bottom, hi, top = planar.bounds
        if top < 7 or top > 42:
          continue
        ri = int(roads_tree.nearest(Point(*mid)))
        nearest = nearest_points(Point(*mid), roads[ri])[1]
        v = np.array([nearest.x, nearest.y]) - mid
        if np.linalg.norm(v) > 32 or np.dot(v, n) < np.linalg.norm(v) * 0.55:
          continue
        # The entire exterior approach stays open, including party walls.
        approach = LineString([mid + n * 0.4, mid + n * 3]).buffer(0.13)
        if len(occupied_tree.query(approach, predicate="intersects")):
          continue
        # A gutter is justified geometrically only at a real roof join.
        eaves = []
        for p, q in zip(pts, np.roll(pts, -1, axis=0)):
          if abs(p[1] - q[1]) > 0.015 or p[1] < top - 0.04:
            continue
          edge = LineString([p[[0, 2]], q[[0, 2]]])
          if edge.length < 5:
            continue
          if any(
            LineString([np.array(x)[[0, 2]], np.array(y)[[0, 2]]]).hausdorff_distance(
              edge
            )
            < 0.025
            and abs(x[1] + dy - p[1]) < 0.025
            and abs(y[1] + dy - p[1]) < 0.025
            for roof in roofs
            for ring in roof["rings"]
            for x, y in zip(ring, ring[1:] + ring[:1])
          ):
            eaves.append([p.tolist(), q.tolist()])
        faces.append(
          dict(
            owner=building["id"],
            part=part["id"],
            sheet=si,
            rings=surface["rings"],
            a=anchor.tolist(),
            d=d.tolist(),
            n=n.tolist(),
            low=bottom,
            high=top,
            lo=lo,
            hi=hi,
            dy=dy,
            street=source["roads"][ri].get("name", ""),
            road=source["roads"][ri].get("id"),
            eaves=eaves,
            polygon=planar,
          )
        )
  return faces, occupied


def native_planes(packet: dict, extra: list[dict]) -> list[dict]:
  """Retain actual axis-aligned source walls; no rotation of drawn fittings."""
  groups = defaultdict(list)
  for container in [packet, *extra]:
    origin = np.array(container["origin"])
    for mi, mesh in enumerate(container["meshes"]):
      if mesh["kind"] not in {
        "city",
        "scheunenviertel-v168",
        "mitte-street-fronts-v166",
        "alt-mitte-v169",
      }:
        continue
      points = (
        np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3) / 100
        + origin
      )
      indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      triangles = points[indices]
      ranges = np.ptp(triangles, axis=1)
      selected = np.where(
        (ranges[:, 1] > 0.8) & ((ranges[:, 0] < 0.001) | (ranges[:, 2] < 0.001))
      )[0]
      for ti in selected:
        tri = triangles[ti]
        axis = 0 if ranges[ti, 0] < 0.001 else 2
        across = 2 if axis == 0 else 0
        poly = Polygon(tri[:, [across, 1]])
        if poly.area < 0.1:
          continue
        key = (axis, round(float(tri[0, axis]), 2))
        groups[key].append(poly)
  return [
    dict(axis=a, plane=p, polygon=unary_union(polys))
    for (a, p), polys in groups.items()
  ]


def drawn_triangles(packet: dict, extra: list[dict]) -> np.ndarray:
  """Read all delivered source triangles, keeping their final terrain placement."""
  values = []
  for container in [packet, *extra]:
    for mesh in container["meshes"]:
      p = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
      i = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      values.append((p / 100 + container["origin"])[i])
  return np.concatenate(values)


def drawn_door_exists(face: dict, point: list, triangles: np.ndarray) -> bool:
  """The delivered wall must cover the complete opening, not only its corners."""
  n, d = np.array(face["n"]), np.array(face["d"])
  offsets = triangles[:, :, [0, 2]] - np.array(point)
  distances, u = offsets @ n, offsets @ d
  low = face["low"]
  selected = np.where(
    (np.max(np.abs(distances), axis=1) <= 0.012)
    & (np.min(u, axis=1) < 0.76)
    & (np.max(u, axis=1) > -0.76)
    & (np.min(triangles[:, :, 1], axis=1) < low + 2.65)
    & (np.max(triangles[:, :, 1], axis=1) > low + 0.01)
  )[0]
  polygons = [Polygon(np.column_stack([u[i], triangles[i, :, 1]])) for i in selected]
  return bool(polygons) and unary_union(polygons).buffer(0.012).covers(
    box(-0.74, low + 0.03, 0.74, low + 2.63)
  )


def native_face(point: list, face: dict, planes: list[dict]) -> dict | None:
  """Find an independently delivered wall covering the entire door surround."""
  candidates = []
  for plane in planes:
    axis, coordinate, poly = plane["axis"], plane["plane"], plane["polygon"]
    dim, across = (0, 1) if axis == 0 else (1, 0)
    distance = abs(point[dim] - coordinate)
    if distance > 1.65 or abs(face["n"][dim]) < 0.65:
      continue
    u = point[across]
    low = face["low"]
    if not poly.buffer(0.02).covers(box(u - 0.72, low + 0.05, u + 0.72, low + 2.60)):
      continue
    p = list(point)
    p[dim] = coordinate
    n = [0.0, 0.0]
    n[dim] = 1.0 if face["n"][dim] > 0 else -1.0
    d = [0.0, 0.0]
    d[across] = 1.0
    candidates.append(
      (
        distance,
        dict(
          point=p, d=d, n=n, low=low, distance=distance, axis=axis, plane=coordinate
        ),
      )
    )
  return min(candidates, key=lambda item: item[0])[1] if candidates else None


def append_box(
  rows: list,
  origin: list,
  face: dict,
  point: list,
  u: float,
  y: float,
  w: float,
  h: float,
  depth: float,
  outset: float,
  colour: int,
) -> None:
  """A bounded oriented shallow member; rows remain source-relative."""
  d, n = np.array(face["d"]), np.array(face["n"])
  p = np.array(point) + d * u + n * outset
  row = [p[0] - origin[0], y - origin[1], p[1] - origin[2], *d, *n, w, h, depth, colour]
  rows.append([round(float(v), 7) for v in row[:-1]] + [colour])


def door_boxes(rows: list, origin: list, face: dict, point: list, native: bool) -> None:
  """Frame real mapped locations without asserting surveyed opening sizes."""
  low = face["low"]

  def add(
    u: float, y: float, w: float, h: float, depth: float, outset: float, colour: int
  ) -> None:
    append_box(rows, origin, face, point, u, low + y, w, h, depth, outset, colour)

  # Door projection stays within 0.30m; all source wall/window geometry remains.
  add(0, 1.25, 1.26, 2.40, 0.035, 0.215, 0x586762)
  for u in [-0.68, 0.68]:
    add(u, 1.3, 0.12, 2.6, 0.10, 0.24, 0xCDC7B6)
  add(0, 2.57, 1.48, 0.14, 0.11, 0.24, 0xD5CDBC)
  add(0, 0.08, 1.48, 0.12, 0.19, 0.24, 0xB7B6AC)
  add(0, 2.19, 1.10, 0.52, 0.025, 0.245, 0x8EABB0)
  add(0, 1.90, 1.26, 0.07, 0.03, 0.265, 0xBEBBAD)
  for u in [-0.29, 0.29]:
    add(u, 1.25, 0.48, 0.75, 0.025, 0.245, 0x849C98)
    add(u, 0.48, 0.48, 0.53, 0.025, 0.245, 0x73817A)
  add(0, 1.11, 0.055, 1.98, 0.03, 0.275, 0xBCB9AA)
  if not native:
    for u in [-0.09, 0.09]:
      add(u, 1.1, 0.04, 0.20, 0.045, 0.30, 0xC6BFA4)


def build() -> dict:
  """Compile finite packets from immutable retained sources; never mutate assets."""
  source, context = base.read_json(SOURCE), base.read_json(CONTEXT)
  faces, _ = source_faces(source)
  scope = shape(source["scope"])
  old = base.read_json(GEO / "house-doors-v233-evidence.json.gz")
  seen_nodes = {row["node"] for row in old["doors"]}
  entries = [
    e
    for e in context["entrances"]
    if scope.covers(Point(*e["point"])) and e["id"] not in seen_nodes
  ]
  selected = []
  for entrance in entries:
    point = np.array(entrance["point"])
    candidates = []
    for face in faces:
      if face["low"] - face["dy"] > 3.1:
        continue
      d, n = np.array(face["d"]), np.array(face["n"])
      offset = point - face["a"]
      distance, u = abs(float(np.dot(offset, n))), float(np.dot(offset, d))
      if distance > 0.35 or not face["polygon"].covers(
        box(u - 0.76, face["low"] + 0.01, u + 0.76, face["low"] + 2.65)
      ):
        continue
      projected = np.array(face["a"]) + d * u
      candidates.append((distance, face, projected.tolist()))
    candidates.sort(key=lambda row: row[0])
    if (
      not candidates
      or len(candidates) > 1
      and candidates[1][0] - candidates[0][0] < 0.03
    ):
      continue
    distance, face, projected = candidates[0]
    selected.append(
      dict(
        node=entrance["id"],
        tags=entrance["tags"],
        mappedPoint=entrance["point"],
        point=projected,
        distance=distance,
        face=face,
      )
    )
  manifest = base.read_json(OUT / "manifest.json")
  descs = {d["id"]: d for d in manifest["chunks"]}
  recipes, receipts, doors, eaves, counts = {}, {}, [], [], Counter()
  by_tile = defaultdict(list)
  for row in selected:
    x, z = row["point"]
    by_tile[f"{math.floor(x / 512)}_{math.floor(z / 512)}"].append(row)
  for tile, choices in sorted(by_tile.items()):
    desc = descs[tile]
    packets = {
      family: base.read_json(OUT / desc[family]["url"])
      for family in ["drawn", "minecraft"]
    }
    if any(len(p["meshes"]) >= 16 for p in packets.values()):
      counts["fullMeshPacketSkipped"] += len(choices)
      continue
    extras = {family: [] for family in packets}
    for cd in manifest["chunks"]:
      if cd.get("detailCompanionOf") == tile:
        for family in packets:
          extra_path = OUT / cd[family]["url"]
          extras[family].append(base.read_json(extra_path))
          receipts[cd[family]["url"]] = base.digest(extra_path)
    planes = native_planes(packets["minecraft"], extras["minecraft"])
    delivered = drawn_triangles(packets["drawn"], extras["drawn"])
    plans = {
      family: dict(
        origin=p["origin"],
        guard=nav_fingerprint(p["nav"]),
        records=[
          dict(
            mesh=i,
            kind=m["kind"],
            fingerprint=fingerprint([m["positions"], m["colors"], m["indices"]]),
          )
          for i, m in enumerate(p["meshes"])
        ],
        boxes=[],
      )
      for family, p in packets.items()
    }
    local_doors = []
    for row in choices[:MAX_DOORS]:
      face = row["face"]
      if not drawn_door_exists(face, row["point"], delivered):
        counts["noCompleteDrawnDoorPlane"] += 1
        continue
      nf = native_face(row["mappedPoint"], face, planes)
      if nf is None:
        counts["noCompleteNativeDoorPlane"] += 1
        continue
      for family, f, point in [
        ("drawn", face, row["point"]),
        ("minecraft", nf, nf["point"]),
      ]:
        door_boxes(
          plans[family]["boxes"],
          packets[family]["origin"],
          f,
          point,
          family == "minecraft",
        )
      evidence = {k: v for k, v in row.items() if k != "face"}
      evidence.update({k: v for k, v in face.items() if k not in {"polygon", "eaves"}})
      evidence.update(chunk=tile, native=nf)
      local_doors.append(evidence)
    # Drain details only on these verified entrance fronts. At most one per
    # source wall, keeping previously detailed roofs and other faces intact.
    used = set()
    local_eaves = []
    for row in local_doors:
      key = (row["owner"], row["part"], row["sheet"])
      if key in used or len(local_eaves) >= MAX_EAVES:
        continue
      used.add(key)
      face = next(f for f in faces if (f["owner"], f["part"], f["sheet"]) == key)
      if not face["eaves"]:
        upper = [
          f
          for f in faces
          if f["owner"] == face["owner"]
          and f["part"] == face["part"]
          and f["eaves"]
          and np.dot(f["n"], face["n"]) > 0.999
          and abs(np.dot(np.array(f["a"]) - face["a"], face["n"])) < 0.02
        ]
        if not upper:
          continue
        face = max(upper, key=lambda f: f["high"])
      p, q = max(face["eaves"], key=lambda e: math.dist(e[0], e[1]))
      centre = [(p[0] + q[0]) / 2, (p[2] + q[2]) / 2]
      width = math.hypot(q[0] - p[0], q[2] - p[2]) - 0.12
      y = p[1] - 0.09
      # Project a narrow weather edge, never another broad cornice cap.
      append_box(
        plans["drawn"]["boxes"],
        packets["drawn"]["origin"],
        face,
        centre,
        0,
        y,
        width,
        0.11,
        0.15,
        0.46,
        0x777F7B,
      )
      append_box(
        plans["drawn"]["boxes"],
        packets["drawn"]["origin"],
        face,
        centre,
        0,
        y + 0.07,
        width,
        0.055,
        0.055,
        0.52,
        0xACB3AA,
      )
      # One pipe at the wall end; exact position is an explicitly stated
      # interpretation, away from both mapped doorway and window centres.
      u = -width / 2 + 0.20
      append_box(
        plans["drawn"]["boxes"],
        packets["drawn"]["origin"],
        face,
        centre,
        u,
        (row["low"] + 0.2 + y) / 2,
        0.10,
        y - row["low"] - 0.2,
        0.10,
        0.27,
        0x7B8987,
      )
      # Native gutter follows actual source planes near the measured eave.
      native_rows = []
      for plane in planes:
        ax, coord, poly = plane["axis"], plane["plane"], plane["polygon"]
        dim, across = (0, 1) if ax == 0 else (1, 0)
        if abs(face["n"][dim]) < 0.65:
          continue
        n = [0.0, 0.0]
        n[dim] = 1.0 if face["n"][dim] > 0 else -1.0
        d = [0.0, 0.0]
        d[across] = 1.0
        # Native roofs retain their own quantised top. Find top intervals
        # only within 1.65m of this measured street wall/roof edge.
        edge = LineString([[p[0], p[2]], [q[0], q[2]]])
        source_axis = 2 if across == 1 else 0
        start, end = sorted([p[source_axis], q[source_axis]])
        for u0 in np.arange(start + 0.6, end - 0.3, 1.2):
          point = [0.0, 0.0]
          point[dim] = coord
          point[across] = float(u0)
          if edge.distance(Point(*point)) > 1.65:
            continue
          section = poly.intersection(LineString([[u0, y - 3], [u0, y + 3]]))
          if section.is_empty:
            continue
          t = section.bounds[3]
          if not y - 1.6 < t < y + 2.1 or not poly.buffer(0.015).covers(
            box(u0 - 0.5, t - 0.25, u0 + 0.5, t - 0.05)
          ):
            continue
          native_rows.append((point, t, dict(d=d, n=n)))
      for point, t, f in native_rows:
        append_box(
          plans["minecraft"]["boxes"],
          packets["minecraft"]["origin"],
          f,
          point,
          0,
          t - 0.1,
          1.1,
          0.18,
          0.25,
          0.25,
          0x87908A,
        )
      local_eaves.append(
        dict(
          owner=row["owner"],
          part=face["part"],
          sheet=face["sheet"],
          dy=face["dy"],
          chunk=tile,
          edge=[p, q],
          nativeSegments=len(native_rows),
        )
      )
    if not local_doors:
      continue
    if any(len(plan["boxes"]) > MAX_BOXES for plan in plans.values()):
      raise ValueError(f"Bound exceeded: {tile}")
    for family, packet in packets.items():
      rows = plans[family]["boxes"]
      vertices = (
        sum(len(base64.b64decode(m["positions"])) // 6 for m in packet["meshes"])
        + len(rows) * 24
      )
      indices = (
        sum(len(base64.b64decode(m["indices"])) // 4 for m in packet["meshes"])
        + len(rows) * 36
      )
      if vertices > 400_000 or indices > 2_400_000:
        raise ValueError(f"Existing packet budget exceeded: {tile}/{family}")
      if any(not all(0 < x < 655.35 for x in r[:3]) for r in rows):
        raise ValueError(f"Out of range: {tile}/{family}")
      receipts[desc[family]["url"]] = base.digest(OUT / desc[family]["url"])
    recipes[tile] = plans
    doors.extend(local_doors)
    eaves.extend(local_eaves)
  runtime = dict(schemaVersion=1, keys=sorted(recipes), chunks=recipes)
  evidence = dict(
    schemaVersion=1,
    policy=POLICY,
    sourceSha256=base.digest(SOURCE),
    contextSha256=base.digest(CONTEXT),
    terrainSha256=base.digest(
      ROOT / "src/app/src/data/weinbergBuildingOffsetsV176.json"
    ),
    sourceUrls=[a.get("url", "") for a in source["sourceArchives"]],
    osmSource=context["source"],
    oldDoorSha256=base.digest(GEO / "house-doors-v233-evidence.json.gz"),
    assets=receipts,
    doors=doors,
    eaves=eaves,
    counts=dict(counts),
    mappedInsideScope=sum(
      scope.covers(Point(*e["point"])) for e in context["entrances"]
    ),
    sameMappedDoorAlreadyPresent=sum(
      scope.covers(Point(*e["point"])) and e["id"] in seen_nodes
      for e in context["entrances"]
    ),
  )
  base.write_json(RUNTIME, runtime)
  base.write_json(EVIDENCE, evidence)
  return dict(
    doorCount=len(doors),
    eaves=len(eaves),
    tiles=len(recipes),
    counts=dict(counts),
    drawnBoxes=sum(len(p["drawn"]["boxes"]) for p in recipes.values()),
    nativeBoxes=sum(len(p["minecraft"]["boxes"]) for p in recipes.values()),
    runtimeBytes=RUNTIME.stat().st_size,
  )


if __name__ == "__main__":
  print(json.dumps(build(), indent=2))
