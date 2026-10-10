"""Finite v210 Wedding additions; every existing source body remains untouched.

Build from the retained source receipt and tiny official bDOM sample grid. No
network, global mesh rebuild, footprint simplification or residency change.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from statistics import median

import numpy as np
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import unary_union

from scripts.build_breitscheid_towers_v161 import triangles_for
from scripts.build_prisons_memorials_v209 import compact, parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DEST = ROOT / "src/app/src/data"
HALL = "DEBE01YYK0003xSI"
TOWER = "DEBE01YYK00042Xi"
BLANK_TOWER_CORES = {"DEBE3DCnWJbGuzoD", "DEBE3DuXNzx7SIbu", "DEBE3DnGHghdmSFX"}
CENTER = (-54.2, -2070.4)
U = np.array([0.5916, 0.8062])
U /= np.linalg.norm(U)
V = np.array([U[1], -U[0]])


def coord(u, v):
  return np.array(CENTER) + U * u + V * v


def build():
  source = json.loads((GEO / "wedding-sites-v210-source.json").read_bytes())
  samples = json.loads((GEO / "wedding-v210-bdom-samples.json").read_bytes())
  drawn, blocks, surfaces, cells, faces, apertures = [], [], [], {}, [], []

  def emit(p, size, color, site, role, yaw=0, direction=None, native_reach=(0, 0)):
    p = np.array(p)
    size = np.array(size)
    if direction is None:
      q = [0, math.sin(yaw / 2), 0, math.cos(yaw / 2)]
      d = np.array([math.cos(yaw), 0, -math.sin(yaw)])
      n = 1 if size[0] <= 2.5 else max(1, math.ceil(size[0] / 1.1))
      for i in range(n):
        c = p + d * ((i + 0.5) / n - 0.5) * size[0]
        c += np.array([native_reach[0], 0, native_reach[1]])
        dim = [
          abs(d[0]) * size[0] / n + abs(d[2]) * size[2],
          size[1],
          abs(d[2]) * size[0] / n + abs(d[0]) * size[2],
        ]
        blocks.append([*[round(float(v), 4) for v in [*c, *dim]], color, site, role])
    else:
      d = np.array(direction)
      d /= np.linalg.norm(d)
      q = np.array([d[2], 0, -d[0], 1 + d[1]])
      q /= np.linalg.norm(q)
      n = max(1, math.ceil(size[1] / 0.6))
      for i in range(n):
        c = p + d * ((i + 0.5) / n - 0.5) * size[1]
        dim = np.abs(d) * size[1] / n + np.array([size[0], size[0], size[2]])
        blocks.append([*[round(float(v), 4) for v in [*c, *dim]], color, site, role])
    drawn.append([*[round(float(v), 5) for v in [*p, *size, *q]], color, site, role])

  def beam(a, b, width, color, role):
    a, b = np.array(a), np.array(b)
    emit(
      (a + b) / 2,
      [width, np.linalg.norm(b - a), width],
      color,
      "erika",
      role,
      direction=b - a,
    )

  def sheet(rings, color, role):
    tris = triangles_for(rings)
    surfaces.append(dict(triangles=tris, color=color, role=role))
    for tri in tris:
      a, b, c = map(np.array, tri)
      n = max(
        1,
        math.ceil(
          max(np.linalg.norm(a - b), np.linalg.norm(a - c), np.linalg.norm(b - c))
          / 0.68
        ),
      )
      for i in range(n + 1):
        js = np.arange(n + 1 - i)[:, None]
        qs = a + (b - a) * i / n + (c - a) * js / n
        for p in np.unique(np.floor(qs).astype(int), axis=0):
          cells[tuple(p)] = color

  def volume(poly, low, high, wall, roof, role):
    rings = [list(poly.exterior.coords)[:-1]] + [
      list(r.coords)[:-1] for r in poly.interiors
    ]
    for r in rings:
      for a, b in zip(r, r[1:] + r[:1]):
        sheet(
          [
            [
              [a[0], low, a[1]],
              [b[0], low, b[1]],
              [b[0], high, b[1]],
              [a[0], high, a[1]],
            ]
          ],
          wall,
          role + " wall",
        )
    sheet([[[x, high, z] for x, z in r] for r in rings], roof, role + " roof")

  hall = next(o for o in source["owners"] if o["id"] == HALL)["parts"][0]
  fp = Polygon(hall["ring"], hall["holes"])
  shift = hall["displayOffsetY"]
  main_samples = [
    r for r in samples["samples"] if -28 <= r[0] <= 36 and r[1] in [-20, -16, 16, 20]
  ]
  annex_samples = [r for r in samples["samples"] if r[1] == 24]
  roof = round(median(r[4] for r in main_samples) - 30 + shift, 3)
  annex = round(median(r[4] for r in annex_samples) - 30 + shift, 3)
  # Visible DOP/bDOM break, intersected with every original hall corner.
  main = fp.intersection(
    Polygon([coord(u, v) for u, v in [(-29, -27), (40, -27), (40, 21), (-29, 21)]])
  )
  volume(fp, 8.2, annex, 0xBAB9AC, 0x7C817D, "retained source-ring low annex addition")
  volume(main, annex, roof, 0xC1C2B5, 0x777D7A, "bDOM main hall upper addition")
  # Roof perimeter and mullions follow the mapped hall, never a campus rectangle.
  for poly, y in [(fp, annex), (main, roof)]:
    r = list(poly.exterior.coords)
    for a, b in zip(r, r[1:]):
      d = np.subtract(b, a)
      length = float(np.linalg.norm(d))
      mid = (np.array(a) + b) / 2
      emit(
        [mid[0], y + 0.16, mid[1]],
        [length, 0.28, 0.18],
        0xD5D4C5,
        "erika",
        "roof edge",
        yaw=-math.atan2(d[1], d[0]),
      )
  for poly, low, high in [(fp, 5.5, annex - 0.35), (main, annex + 0.2, roof - 0.45)]:
    r = list(poly.exterior.coords)
    for a, b in zip(r, r[1:]):
      d = np.subtract(b, a)
      length = float(np.linalg.norm(d))
      if length < 5:
        continue
      d /= length
      n = np.array([d[1], -d[0]])
      mid = (np.array(a) + b) / 2
      if fp.covers(Point(*(mid + n * 0.2))):
        n = -n
      count = max(1, round(length / 2.7))
      for k in range(count):
        p = np.array(a) + d * ((k + 0.5) * length / count) + n * 0.17
        emit(
          [p[0], (low + high) / 2, p[1]],
          [length / count * 0.83, high - low, 0.13],
          0x52777A,
          "erika",
          "hall glazed panel",
          yaw=-math.atan2(d[1], d[0]),
          native_reach=n * 0.5,
        )
        emit(
          [p[0], low - 0.1, p[1]],
          [length / count * 0.88, 0.15, 0.20],
          0xD3D6CC,
          "erika",
          "hall sill",
          yaw=-math.atan2(d[1], d[0]),
          native_reach=n * 0.5,
        )
  # Five visible V-pylons: positions/lean interpreted from the DOP, heights
  # bounded by sampled bDOM maxima. No invented internal truss or ceiling.
  peak = round(max(r[4] for r in samples["samples"]) - 30 + shift, 3)
  pylons = []
  for u in [-23, -10, 3, 16, 29]:
    apex = coord(u, -3.5)
    top = [apex[0], peak, apex[1]]
    feet = []
    for v in [-20, 19]:
      p = coord(u - 4, v)
      foot = [p[0], roof + 0.1, p[1]]
      feet.append(foot)
      beam(foot, top, 0.58, 0xD9DBCF, "five concrete V-pylons")
    for v in [-19, 18]:
      p = coord(u + 5.5, v)
      beam(
        top, [p[0], roof + 0.15, p[1]], 0.105, 0x687274, "roof steel suspension rods"
      )
    pylons.append(dict(localU=u, apex=top, feet=feet))
  # Outdoor rink: original OSM outline, low boards only. No invented roof.
  rink = shape(source["sites"]["32979869"]["geometry"])
  for poly in getattr(rink, "geoms", [rink]):
    r = list(poly.exterior.coords)
    for a, b in zip(r, r[1:]):
      d = np.subtract(b, a)
      length = float(np.linalg.norm(d))
      p = (np.array(a) + b) / 2
      emit(
        [p[0], 5.65, p[1]],
        [length, 0.9, 0.14],
        0xD7D9CE,
        "erika",
        "mapped outdoor rink boards",
        yaw=-math.atan2(d[1], d[0]),
      )
  campus = shape(source["sites"]["6255291"]["geometry"])
  shapes = [shape(o["footprint"]) for o in source["owners"]]
  # Source walls visible at the public campus edge plus the defining tower.
  for oi, owner in enumerate(source["owners"]):
    if owner["site"] != "bayer":
      continue
    ofp = shapes[oi]
    tower = owner["id"] == TOWER
    sibling_parts = [
      (
        p["id"],
        Polygon(p["ring"], p["holes"]),
        p["ground_y_m"] + p["displayOffsetY"],
        p["top_y_m"] + p["displayOffsetY"],
      )
      for p in owner["parts"]
    ]
    for part in owner["parts"]:
      for si, s in enumerate(part["surfaces"]):
        if s["kind"] != "WallSurface":
          continue
        rings = [
          [[x, y + part["displayOffsetY"], z] for x, y, z in r] for r in s["rings"]
        ]
        a, b = max(
          ((a, b) for a in rings[0] for b in rings[0]),
          key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
        )
        a, b = np.array(a), np.array(b)
        d = b - a
        d[1] = 0
        length = float(np.linalg.norm(d))
        low = min(p[1] for p in rings[0])
        high = max(p[1] for p in rings[0])
        if length < 5 or high - low < 5:
          continue
        d /= length
        n = np.array([d[2], 0, -d[0]])
        mid = (a + b) / 2
        if ofp.covers(Point(mid[0] + n[0] * 0.15, mid[2] + n[2] * 0.15)):
          n = -n
        if any(
          j != oi and f.covers(Point(mid[0] + n[0] * 0.8, mid[2] + n[2] * 0.8))
          for j, f in enumerate(shapes)
        ):
          continue
        if not tower and campus.boundary.distance(Point(mid[0], mid[2])) > 30:
          continue
        projected = [
          [(float(np.dot(np.subtract(p, a), d)), p[1]) for p in r] for r in rings
        ]
        wall = Polygon(projected[0], projected[1:]).buffer(-0.1)
        fi = len(faces)
        faces.append(
          dict(
            owner=owner["id"],
            part=part["id"],
            sheet=si,
            rings=rings,
            origin=a.tolist(),
            direction=d.tolist(),
            outward=n.tolist(),
          )
        )
        yaw = math.atan2(-d[2], d[0])
        count = max(1, round(length / (2.0 if tower else 3.2)))
        for floor in range(math.ceil((high - 5.2) / 3.5)):
          y = 7.35 + floor * 3.5
          for k in range(count):
            u = (k + 0.5) * length / count
            w = length / count * 0.82
            h = 1.9
            if not wall.covers(
              box(u - w / 2 - 0.10, y - h / 2 - 0.1, u + w / 2 + 0.1, y + h / 2 + 0.1)
            ):
              continue
            if tower and part["id"] in BLANK_TOWER_CORES:
              continue
            p = a + d * u + n * 0.22
            if any(
              pid != part["id"]
              and lo <= y - h / 2
              and hi >= y + h / 2
              and g.covers(Point(p[0] + n[0] * 0.3, p[2] + n[2] * 0.3))
              for pid, g, lo, hi in sibling_parts
            ):
              continue
            emit(
              [p[0], y, p[2]],
              [w, h, 0.13],
              0x4A6A76 if tower else 0x5F7778,
              "bayer",
              "source-clipped window",
              yaw=yaw,
              native_reach=(n[0] * 0.5, n[2] * 0.5),
            )
            emit(
              [p[0], y - h / 2 - 0.12, p[2]],
              [w + 0.17, 0.18, 0.22],
              0xC4C7BC,
              "bayer",
              "facade sill",
              yaw=yaw,
              native_reach=(n[0] * 0.5, n[2] * 0.5),
            )
            if tower:
              pp = p + d * (w / 2 + 0.07)
              emit(
                [pp[0], y, pp[2]],
                [0.14, h + 0.35, 0.2],
                0xCDD1C7,
                "bayer",
                "tower vertical frame",
                yaw=yaw,
                native_reach=(n[0] * 0.5, n[2] * 0.5),
              )
            apertures.append(dict(face=fi, u=round(u, 5), y=y, w=w, h=h))
        # Clipped coping course retains all source upper corners.
        for k in range(max(1, math.ceil(length / 2))):
          u = (k + 0.5) * length / max(1, math.ceil(length / 2))
          w = length / max(1, math.ceil(length / 2)) * 0.96
          y = high - 0.22
          if wall.covers(box(u - w / 2, y - 0.11, u + w / 2, y + 0.11)):
            p = a + d * u + n * 0.2
            emit(
              [p[0], y, p[2]],
              [w, 0.2, 0.25],
              0xBCC0B4,
              "bayer",
              "source roof coping",
              yaw=yaw,
              native_reach=(n[0] * 0.5, n[2] * 0.5),
            )
  perimeter = []
  barriers = []
  gates = [
    shape(i["geometry"]).buffer(float(i["tags"].get("width", 3)) / 2)
    for i in source.get("perimeter", [])
    if i["tags"]["barrier"] == "gate"
  ]
  cuts = unary_union(gates)
  for item in source.get("perimeter", []):
    if item["geometry"]["type"] != "LineString":
      continue
    if item["tags"]["barrier"] not in ["fence", "wall"]:
      continue
    # Only the publicly visible mapped property edge, with every mapped
    # gate gap cut out. Original uncut line and tags stay in the receipt.
    line = (
      shape(item["geometry"]).intersection(campus.boundary.buffer(2)).difference(cuts)
    )
    iswall = item["tags"]["barrier"] == "wall"
    height = float(item["tags"].get("height", 2 if iswall else 1.5))
    thickness = 0.22 if iswall else 0.10
    perimeter.append(item["id"])
    for route in parts(line, LineString):
      points = list(route.coords)
      barriers.append(
        dict(
          id=item["id"], points=points, low=5.2, high=5.2 + height, thickness=thickness
        )
      )
      for a, b in zip(points, points[1:]):
        d = np.subtract(b, a)
        length = float(np.linalg.norm(d))
        if length < 0.05:
          continue
        d /= length
        yaw = -math.atan2(d[1], d[0])
        mid = (np.array(a) + b) / 2
        if iswall:
          emit(
            [mid[0], 5.2 + height / 2, mid[1]],
            [length, height, thickness],
            0xA09E91,
            item["site"],
            "mapped public wall",
            yaw=yaw,
          )
        else:
          for y in [5.4, 5.2 + height - 0.12]:
            emit(
              [mid[0], y, mid[1]],
              [length, 0.08, 0.08],
              0x63726A,
              item["site"],
              "mapped public fence rail",
              yaw=yaw,
            )
          for k in range(max(1, math.ceil(length / 2.5))):
            p = np.array(a) + d * k * length / max(1, math.ceil(length / 2.5))
            emit(
              [p[0], 5.2 + height / 2, p[1]],
              [0.12, height, 0.12],
              0x63726A,
              item["site"],
              "mapped public fence post",
            )
  skin = compact(cells)
  for r in skin:
    r[1] -= 3  # compact helper has an explicit old surrounding-ground datum.
  envelopes = dict(
    surfaces=surfaces,
    blocks=skin,
    barriers=barriers,
    volumes=[
      dict(geometry=mapping(fp), low=8.2, high=annex),
      dict(geometry=mapping(main), low=annex, high=roof),
    ],
  )
  detail = dict(boxes=drawn, blocks=blocks, sites=["erika", "bayer"])
  evidence = dict(
    sourceSha256=hashlib.sha256(
      (GEO / "wedding-sites-v210-source.json").read_bytes()
    ).hexdigest(),
    bdomSha256=hashlib.sha256(
      (GEO / "wedding-v210-bdom-samples.json").read_bytes()
    ).hexdigest(),
    sourceOwnerCount=len(source["owners"]),
    sourcePartCount=sum(len(o["parts"]) for o in source["owners"]),
    retainedSourceSheets=sum(
      len(p["surfaces"]) for o in source["owners"] for p in o["parts"]
    ),
    oldPrismsChanged=0,
    newScopeArea=0,
    roofY=roof,
    annexY=annex,
    pylonTopY=peak,
    pylons=pylons,
    mainRoofSamples=main_samples,
    annexRoofSamples=annex_samples,
    sourceToCoreOffsetY=shift,
    faces=faces,
    apertures=apertures,
    perimeter=perimeter,
    drawnInstances=len(drawn),
    nativeInstances=len(blocks),
    envelopeBlocks=len(skin),
    envelopeTriangles=sum(len(s["triangles"]) for s in surfaces),
    drawnCalls=3,
    nativeCalls=3,
    drawnBytes=len(drawn) * 76
    + sum(len(s["triangles"]) for s in surfaces) * 108
    + 2 * 936,
    nativeBytes=(len(blocks) + len(skin)) * 76 + 3 * 936,
  )
  return detail, envelopes, evidence


if __name__ == "__main__":
  detail, envelopes, evidence = build()
  for p, obj in [
    (DEST / "weddingSitesV210.json", detail),
    (DEST / "weddingSitesV210Envelopes.json", envelopes),
    (GEO / "wedding-sites-v210-evidence.json", evidence),
  ]:
    p.write_text(json.dumps(obj, separators=(",", ":"), allow_nan=False) + "\n")
  print({k: v for k, v in evidence.items() if not isinstance(v, list)})
