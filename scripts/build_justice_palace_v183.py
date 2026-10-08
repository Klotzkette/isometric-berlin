"""Step 10: bounded source-bound courthouse/palace recognition, no new city fill."""

from __future__ import annotations

import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Any

import numpy as np
from pyproj import Transformer
from shapely.geometry import LineString, MultiPoint, Point, Polygon, box, shape
from shapely.ops import transform, triangulate, unary_union

from isometric_berlin.data.fetch_lod2 import GML_ID, NS

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data/regierungsviertel"
DEST = ROOT / "src/app/src/data/justicePalaceV183.json"
EVIDENCE = DATA / "justice-palace-v183-evidence.json"
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True).transform
TARGETS = json.loads((DATA / "justice-palace-v183-osm.json").read_text())["features"]


def extract() -> list[dict[str, Any]]:
  """Extract complete selected parents; exact surfaces stay outside runtime JSON."""
  targets = {f["name"]: transform(PROJECT, shape(f["geometry"])) for f in TARGETS}
  scope = unary_union(list(targets.values()))
  existing = {
    p["id"]: p
    for p in json.loads(
      (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
    )["buildings"]
  }
  records, tiles = [], []
  from isometric_berlin.data.fetch_lod2 import building_footprint

  for archive in sorted((DATA / "raw/lod2").glob("LoD2_*.zip")):
    tx, ty = map(int, archive.stem.removeprefix("LoD2_").split("_"))
    if not box(tx * 1000, ty * 1000, (tx + 1) * 1000, (ty + 1) * 1000).intersects(
      scope
    ):
      continue
    tiles.append(
      {
        "file": archive.name,
        "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
        "url": f"https://gdi.berlin.de/data/a_lod2/atom/{archive.name}",
      }
    )
    with zipfile.ZipFile(archive) as zipped:
      for member in zipped.namelist():
        if not member.endswith((".gml", ".xml")):
          continue
        with zipped.open(member) as stream:
          for _, parent in ET.iterparse(stream, events=("end",)):
            if parent.tag != f"{{{NS['bldg']}}}Building":
              continue
            footprint = building_footprint(parent)
            candidates = (
              []
              if footprint is None
              else [
                (footprint.intersection(g).area / max(footprint.area, 1), name)
                for name, g in targets.items()
                if footprint.intersects(g)
              ]
            )
            if not candidates or max(candidates)[0] < 0.45:
              parent.clear()
              continue
            overlap, name = max(candidates)
            coords = [
              float(v)
              for pos in parent.findall(".//gml:posList", NS)
              for v in (pos.text or "").split()[2::3]
            ]
            datum = min(coords)
            ids = [
              p.get(GML_ID)
              for p in parent.iter()
              if p.tag.endswith(("BuildingPart", "Building"))
            ]
            matches = [existing[s[-8:]] for s in ids if s and s[-8:] in existing]
            ground = min(p["y0_dm"] / 10 for p in matches) if matches else 3.0
            surfaces = []
            for surface in parent.iter():
              kind = surface.tag.split("}")[-1]
              if kind not in {"WallSurface", "RoofSurface"}:
                continue
              for poly in surface.findall(".//gml:Polygon", NS):
                rings = []
                for pos in poly.findall(".//gml:posList", NS):
                  v = list(map(float, (pos.text or "").split()))
                  ring = [
                    [
                      round(v[i] - 389500, 3),
                      round(v[i + 2] - datum + ground, 3),
                      round(5820000 - v[i + 1], 3),
                    ]
                    for i in range(0, len(v), 3)
                  ]
                  if ring and ring[0] == ring[-1]:
                    ring.pop()
                  if len(ring) >= 3:
                    rings.append(ring)
                if rings:
                  surfaces.append({"kind": kind, "rings": rings})
            records.append(
              {
                "name": name,
                "parentId": parent.get(GML_ID),
                "partIds": [part_id for part_id in ids if part_id],
                "osmIds": [f["osmId"] for f in TARGETS if f["name"] == name],
                "groundY": ground,
                "groundNHN": datum,
                "heightM": max(coords) - datum,
                "tile": archive.name,
                "sourceOverlap": round(overlap, 6),
                "surfaces": surfaces,
              }
            )
            parent.clear()
  old = json.loads(
    (ROOT / "src/app/src/data/moabitJusticeV166Evidence.json").read_text()
  )
  court = next(p for p in old["parents"] if p["kind"] == "court")
  tiles.append(
    {
      "file": "LoD2_388_5820.zip",
      "url": old["sourceUrl"],
      "sha256": old["sourceSha256"],
    }
  )
  surfaces = []
  for p in court["sourceParts"]:
    for s in p["surfaces"]:
      surfaces.append(
        {
          "kind": s["kind"],
          "partId": p["id"],
          "rings": [
            [[v[0], round(v[1] + court["displayOffsetY"], 3), v[2]] for v in ring]
            for ring in s["rings"]
          ],
        }
      )
  records.append(
    {
      "name": "Kriminalgericht Moabit",
      "parentId": court["id"],
      "partIds": [p["id"] for p in court["sourceParts"]],
      "osmIds": ["relation/7721745"],
      "groundY": 5.2,
      "heightM": max(
        p["top_y_m"] + court["displayOffsetY"] for p in court["sourceParts"]
      )
      - 5.2,
      "tile": "LoD2_388_5820.zip",
      "surfaces": surfaces,
    }
  )
  assert {f["name"] for f in TARGETS} | {"Kriminalgericht Moabit"} == {
    r["name"] for r in records
  }
  EVIDENCE.write_text(
    json.dumps(
      {"license": "dl-de/zero-2-0", "tiles": tiles, "records": records},
      separators=(",", ":"),
    )
    + "\n"
  )
  return records


def build(records: list[dict[str, Any]]) -> dict[str, Any]:
  """Bake exact source contours and shallow estimates, with separate native rows."""
  segments: list[list[float]] = []
  boxes: list[list[float]] = []
  wall_skins: list[dict[str, Any]] = []
  seen: set[tuple[Any, ...]] = set()
  features = []
  glass, trim, copper = 0x4C616B, 0xCBBEA4, 0x6C9686

  def line(a: Any, b: Any, color: int = 0x74796F) -> None:
    a, b = tuple(round(float(v), 3) for v in a), tuple(round(float(v), 3) for v in b)
    key = (*sorted([a, b]), color)
    if a != b and key not in seen:
      seen.add(key)
      segments.append([*a, *b, color])

  def row(
    x: float,
    y: float,
    z: float,
    w: float,
    h: float,
    d: float,
    yaw: float = 0,
    color: int = trim,
  ) -> None:
    boxes.append([round(v, 3) for v in [x, y, z, w, h, d]] + [round(yaw, 6), color])

  def ring(
    cx: float, cz: float, y: float, radius: float, color: int, count: int = 24
  ) -> list[tuple[float, float, float]]:
    pts = [
      (
        cx + math.cos(i * math.tau / count) * radius,
        y,
        cz + math.sin(i * math.tau / count) * radius,
      )
      for i in range(count)
    ]
    for a, b in zip(pts, pts[1:] + pts[:1]):
      line(a, b, color)
    return pts

  def turned(
    cx: float,
    cz: float,
    profile: list[tuple[float, float]],
    color: int,
    count: int = 24,
  ) -> None:
    previous = None
    for y, radius in profile:
      points = ring(cx, cz, y, radius, color, count)
      if previous:
        for a, b in zip(previous, points):
          line(a, b, color)
      previous = points

  for record in records:
    fs, fb = len(segments), len(boxes)
    name, ground = record["name"], record["groundY"]
    for surface_index, surface in enumerate(record["surfaces"]):
      for points in surface["rings"]:
        for a, b in zip(points, points[1:] + points[:1]):
          line(a, b)
      if surface["kind"] != "WallSurface":
        continue
      # The complete v166 model already owns Moabit's measured walls/windows.
      if (
        name == "Kriminalgericht Moabit" and surface.get("partId") != "DEBE3DZuPJnvKibt"
      ):
        continue
      points = np.array(surface["rings"][0])
      a, b = max(
        ((a, b) for a in points for b in points),
        key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
      )
      direction = np.array([b[0] - a[0], 0, b[2] - a[2]], dtype=float)
      length = float(np.linalg.norm(direction))
      if length < 3:
        continue
      direction /= length
      normal = np.zeros(3)
      for i in range(1, len(points) - 1):
        normal += np.cross(points[i] - points[0], points[i + 1] - points[0])
      norm = float(np.linalg.norm(normal))
      if norm < 0.01 or abs(normal[1] / norm) > 0.03:
        continue
      normal /= norm
      planar = [
        [(float(np.dot(np.array(p) - a, direction)), p[1]) for p in r]
        for r in surface["rings"]
      ]
      poly = Polygon(planar[0], planar[1:]).buffer(0)
      if poly.is_empty:
        continue
      lo, bottom, hi, top = poly.bounds
      source_top = top
      if name in {"Littenstraße courts", "Kriminalgericht Moabit"}:
        # The source's 3.081m parent is a documented generalized outlier.
        # Retain its coordinates; upper skin is an explicit five-level estimate.
        bottom, top = (
          ground,
          ground + (21.0 if name == "Kriminalgericht Moabit" else 24.0),
        )
        poly = box(lo, bottom, hi, top)
        for y in [ground + 5, ground + 10, ground + 15, ground + 20, top]:
          line(
            a + direction * lo + normal * 0.10 + [0, y - a[1], 0],
            a + direction * hi + normal * 0.10 + [0, y - a[1], 0],
            trim,
          )
        for u in [lo, hi]:
          line(
            a + direction * u + [0, ground - a[1], 0],
            a + direction * u + [0, top - a[1], 0],
            trim,
          )
      if top - bottom < 3:
        continue
      yaw = -math.atan2(direction[2], direction[0])
      if name in {"Littenstraße courts", "Kriminalgericht Moabit"}:
        # Only the documented low-source conflict receives this thin upper
        # sheet. It follows each existing facade plane, including court walls;
        # the interior, courtyard voids and measured lower source remain empty.
        skin_bottom = max(bottom, source_top)
        if top > skin_bottom:
          pos = a + direction * ((lo + hi) / 2) + normal * 0.01
          wall_skins.append(
            {
              "name": name,
              "partId": surface.get("partId", record["parentId"]),
              "sourceSurfaceIndex": surface_index,
              "boxIndex": len(boxes),
              "sourceTopY": source_top,
              "estimatedEaveY": top,
            }
          )
          row(
            pos[0],
            (skin_bottom + top) / 2,
            pos[2],
            hi - lo,
            top - skin_bottom,
            0.08,
            yaw,
            0xB8AD93 if name == "Kriminalgericht Moabit" else 0xC7BFA9,
          )
      is_palace = name == "Schloss Charlottenburg"
      levels = (
        [ground + 3.5, ground + 9.0, ground + 14.1]
        if is_palace
        else [ground + 3.6, ground + 8.4, ground + 13.2, ground + 18.0, ground + 22.1]
      )
      for y in levels:
        w, h = (1.5, 2.5) if is_palace else (1.25, 2.3)
        if is_palace and y > ground + 13:
          h = 1.0
        for u in np.arange(lo + 1.6, hi - 1, 3.8 if is_palace else 4.0):
          if not poly.buffer(-0.03).covers(
            box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)
          ):
            continue
          pos = a + direction * u + normal * 0.14
          row(pos[0], y, pos[2], w, h, 0.12, yaw, glass)
          # Rectangular frames, pale mullions; no replica sculpture or writing.
          for du in [-w / 2, w / 2, 0]:
            q = pos + direction * du + normal * 0.08
            row(q[0], y, q[2], 0.1, h + 0.18, 0.12, yaw, trim)
          for dy in [-h / 2, h / 2]:
            line(
              pos + direction * (-w / 2) + [0, y + dy - pos[1], 0],
              pos + direction * (w / 2) + [0, y + dy - pos[1], 0],
              trim,
            )
          if name == "Tegeler Weg court":
            # Paired Romanesque arches in an explicit local display rhythm.
            for shift in [-0.33, 0.33]:
              prev = None
              for k in range(7):
                angle = k * math.pi / 6
                q = (
                  pos
                  + direction * (shift + 0.32 * math.cos(angle))
                  + [0, y + h / 2 - 0.22 + 0.32 * math.sin(angle) - pos[1], 0]
                )
                if prev is not None:
                  line(prev, q, trim)
                prev = q
          elif is_palace and h > 2:
            q = pos + [0, y + h / 2 + 0.2 - pos[1], 0]
            line(q - direction * 0.85, q + [0, 0.45, 0], trim)
            line(q + [0, 0.45, 0], q + direction * 0.85, trim)
      for y in (
        [ground + 6.0, ground + 12.2] if is_palace else [ground + 5.6, ground + 15.6]
      ):
        cut = poly.intersection(LineString([(lo, y), (hi, y)]))
        for part in (
          [cut] if cut.geom_type == "LineString" else getattr(cut, "geoms", [])
        ):
          if part.geom_type != "LineString":
            continue
          q = [
            a + direction * u + normal * 0.18 + [0, yy - a[1], 0]
            for u, yy in part.coords
          ]
          for aa, bb in zip(q, q[1:]):
            line(aa, bb, trim)
    features.append(
      {k: v for k, v in record.items() if k != "surfaces"}
      | {
        "firstSegment": fs,
        "segmentCount": len(segments) - fs,
        "firstBox": fb,
        "boxCount": len(boxes) - fb,
      }
    )

  native_detail_start = len(segments)
  native_box_start = len(boxes)

  # Moabit: exact existing source owners and source apex levels. Additional
  # copper contour ribs identify two slender upper caps, versus broad east dome.
  towers = []
  moabit = next(r for r in records if r["name"] == "Kriminalgericht Moabit")
  for part_id in ["DEBE3DKcoXNN1Az9", "DEBE3DmjpESi9DgG", "DEBE3DSvRrQlvxN0"]:
    points = [
      p
      for s in moabit["surfaces"]
      if s.get("partId") == part_id
      for r in s["rings"]
      for p in r
    ]
    cx = (min(p[0] for p in points) + max(p[0] for p in points)) / 2
    cz = (min(p[2] for p in points) + max(p[2] for p in points)) / 2
    top = max(p[1] for p in points)
    wide = part_id == "DEBE3DSvRrQlvxN0"
    radius = 7.2 if wide else 4.85
    base = top - (8.5 if wide else 11.7)
    # Profile radii/heights are source-envelope-bounded recognition estimates.
    profile = [
      (base, radius),
      (base + 1.2, radius),
      (base + 3.8, radius * 0.91),
      (top - 2.5, radius * 0.56),
      (top - 0.5, 0.45),
      (top, 0.12),
    ]
    turned(cx, cz, profile, 0x52746F if wide else copper)
    for y in [base - 10.5, base - 8.8, base - 0.4]:
      ring(cx, cz, y, radius + 0.1, trim, 16)
    for i in range(12):
      angle = i * math.tau / 12
      x, z = (
        cx + math.cos(angle) * (radius + 0.1),
        cz + math.sin(angle) * (radius + 0.1),
      )
      row(x, base - 4.4, z, 0.32, 8.0, 0.32, 0, trim)
    towers.append(
      {
        "partId": part_id,
        "center": [round(cx, 3), round(cz, 3)],
        "topY": top,
        "role": "lower eastern corner dome" if wide else "tall flanking tower",
        "profileStatus": "Estimated contour ribs within retained measured plan/top envelope; old surfaces retained exactly",
      }
    )

  # Palace: axis located against official DOP spring 2025 and current source
  # frontage. 45m published total tower height; subdivisions are not surveyed.
  cx, cz, ground = -5133.0, -338.0, 3.0
  turned(
    cx,
    cz,
    [
      (20.7, 7.0),
      (22, 7.0),
      (31, 7.0),
      (32, 7.6),
      (34, 7.0),
      (37.5, 6.1),
      (40.1, 4.4),
      (41, 2.3),
      (44.3, 2.2),
      (45.3, 0.6),
    ],
    copper,
  )
  for i in range(16):
    angle = i * math.tau / 16
    x, z = cx + math.cos(angle) * 7.0, cz + math.sin(angle) * 7.0
    row(x, 26.4, z, 0.48, 9.0, 0.48, 0, trim)
    x, z = cx + math.cos(angle) * 2.25, cz + math.sin(angle) * 2.25
    row(x, 42.5, z, 0.19, 3.4, 0.19, 0, copper)
  # Small clock faces are rings, with two abstract hands. A gilded finial
  # suggests Fortuna without reproducing Scheibe's sculpture.
  for sign in [-1, 1]:
    y, z = 30.4, cz + sign * 7.12
    prev = None
    for i in range(25):
      a = i * math.tau / 24
      p = (cx + math.cos(a) * 0.8, y + math.sin(a) * 0.8, z)
      if prev:
        line(prev, p, 0xCAB566)
      prev = p
    line((cx, y, z), (cx, y + 0.55, z), 0xCAB566)
    line((cx, y, z), (cx + 0.4, y - 0.2, z), 0xCAB566)
  row(cx, 46.4, cz, 0.32, 2.5, 0.32, 0, 0xD6B759)
  line((cx - 1, 47, cz), (cx + 1.0, 47.3, cz), 0xD6B759)
  line((cx, 47.65, cz), (cx, 48.0, cz), 0xD6B759)

  # DOP-aligned roof ridges for the two generalized court parents: hairlines
  # only, without any replacement footprint, solid mass or invented towers.
  estimated_ridges = {
    "Kriminalgericht Moabit": [
      [(-1271, 34.2, -850), (-1086, 34.2, -869)],
      [(-1258, 34.2, -790), (-1066, 34.2, -808)],
      [(-1271, 34.2, -850), (-1258, 34.2, -790)],
      [(-1086, 34.2, -869), (-1066, 34.2, -808)],
      [(-1181, 39.2, -859), (-1176, 39.2, -810)],
      [(-1255, 32.2, -820), (-1085, 32.2, -837)],
    ],
    "Littenstraße courts": [
      [(2872, 31, -0.5), (2941, 31, 144)],
      [(2826, 31, 39), (2897, 31, 164)],
      [(2850, 31, 19), (2890, 31, 60)],
      [(2838, 31, 69), (2911, 31, 82)],
      [(2876, 31, 107), (2928, 31, 103)],
      [(2892, 31, 147), (2941, 31, 144)],
    ],
    "Tegeler Weg court": [
      [(-4992, 33, -1070), (-4979, 33, -981)],
      [(-4909, 33, -1036), (-4929, 33, -981)],
      [(-4979, 33, -981), (-4929, 33, -981)],
      [(-4998, 24.4, -1033), (-4996, 40, -1024), (-4994, 24.4, -1014)],
      [(-4996, 40, -1024), (-4975, 40, -1027)],
    ],
  }
  # Clip DOP ridge readings to current OSM building mass, preserving courts.
  ridge_owner = {f["name"]: transform(PROJECT, shape(f["geometry"])) for f in TARGETS}
  moabit_nav = json.loads(
    (ROOT / "src/app/src/data/moabitJusticeV166Navigation.json").read_text()
  )
  main_body = next(p for p in moabit_nav["parts"] if p["id"] == "DEBE3DZuPJnvKibt")
  ridge_owner["Kriminalgericht Moabit"] = transform(
    lambda x, z: (x + 389500, 5820000 - z),
    Polygon(main_body["ring"], main_body["holes"]),
  )
  for name, paths in estimated_ridges.items():
    for points in paths:
      for a, b in zip(points, points[1:]):
        path = LineString(
          [(a[0] + 389500, 5820000 - a[2]), (b[0] + 389500, 5820000 - b[2])]
        )
        cut = path.intersection(ridge_owner[name])
        for part in (
          [cut] if cut.geom_type == "LineString" else getattr(cut, "geoms", [])
        ):
          if part.geom_type != "LineString":
            continue
          ends = []
          for x, z in part.coords:
            t = path.project(Point(x, z)) / max(path.length, 0.001)
            ends.append((x - 389500, a[1] + t * (b[1] - a[1]), 5820000 - z))
          for aa, bb in zip(ends, ends[1:]):
            line(aa, bb, 0x9B7663)

  # Separate offline-authored orthogonal contour blocks and facade strips.
  # Native rows never invoke the smooth geometry or contain a hidden voxel fill.
  native: dict[tuple[float, ...], list[float]] = {}

  def block(x: float, y: float, z: float, w: float, h: float, d: float, c: int) -> None:
    key = tuple(round(v, 2) for v in [x, y, z, w, h, d])
    native[key] = list(key) + [c]

  roof_triangles: list[list[float]] = []
  roof_profiles = []
  for record in records:
    name = record["name"]
    if name not in {"Kriminalgericht Moabit", "Littenstraße courts"}:
      continue
    roof = unary_union(
      [
        Polygon(
          [(p[0], p[2]) for p in surface["rings"][0]],
          [[(p[0], p[2]) for p in ring] for ring in surface["rings"][1:]],
        ).buffer(0)
        for surface in record["surfaces"]
        if surface["kind"] == "RoofSurface"
        and (
          name != "Kriminalgericht Moabit"
          or surface.get("partId") == "DEBE3DZuPJnvKibt"
        )
      ]
    )
    eave = record["groundY"] + (21 if name == "Kriminalgericht Moabit" else 24)
    ridge_lines = [
      (LineString([(a[0], a[2]), (b[0], b[2])]), a[1], b[1])
      for path in estimated_ridges[name]
      for a, b in zip(path, path[1:])
    ]

    def roof_y(x: float, z: float) -> float:
      point = Point(x, z)
      boundary_distance = roof.boundary.distance(point)
      if boundary_distance < 1e-7:
        return eave
      samples = []
      for line, y0, y1 in ridge_lines:
        distance = line.distance(point)
        y = y0 + (y1 - y0) * line.project(point) / line.length
        samples.append((distance, max(eave, y)))
      nearest = min(d for d, _ in samples)
      weight = sum(1 / (d + 0.05) ** 4 for d, _ in samples)
      ridge_y = sum(y / (d + 0.05) ** 4 for d, y in samples) / weight
      return eave + (ridge_y - eave) * boundary_distance / (boundary_distance + nearest)

    pieces = [roof] if roof.geom_type == "Polygon" else list(roof.geoms)
    points = [
      tuple(p)
      for polygon in pieces
      for ring in [polygon.exterior, *polygon.interiors]
      for p in ring.coords
    ]
    for line, _, _ in ridge_lines:
      for distance in np.linspace(0, line.length, max(2, math.ceil(line.length / 3))):
        point = line.interpolate(distance)
        if roof.covers(point):
          points.append((point.x, point.y))
    x0, z0, x1, z1 = roof.bounds
    for x in np.arange(x0 + 2, x1, 4):
      for z in np.arange(z0 + 2, z1, 4):
        if roof.contains(Point(x, z)):
          points.append((float(x), float(z)))
    start = len(roof_triangles)
    roof_color = 0x625F59 if name == "Kriminalgericht Moabit" else 0x78726B
    for triangle in triangulate(MultiPoint(points)):
      clipped = triangle.intersection(roof)
      if clipped.is_empty:
        continue
      for leaf in triangulate(clipped):
        if leaf.area < 1e-8 or not clipped.buffer(1e-7).covers(leaf):
          continue
        row_points = [[x, roof_y(x, z), z] for x, z in list(leaf.exterior.coords)[:3]]
        roof_triangles.append(
          [round(v, 5) for p in row_points for v in p] + [roof_color]
        )
    # A stepped surface envelope joins adjacent roof courses. Use only the
    # local height range over the cell plus overlap, never ground-to-roof fill.
    for z in np.arange(z0 + 0.4, z1, 0.8):
      scan = roof.intersection(LineString([(x0 - 1, z), (x1 + 1, z)]))
      for line in (
        [scan] if scan.geom_type == "LineString" else getattr(scan, "geoms", [])
      ):
        if line.geom_type != "LineString" or line.length < 0.01:
          continue
        lo, hi = line.bounds[0], line.bounds[2]
        count = max(1, math.ceil((hi - lo) / 0.8))
        width = (hi - lo) / count
        for i in range(count):
          x = lo + (i + 0.5) * width
          heights = [
            roof_y(x + dx, z + dz)
            for dx in [-width / 2, 0, width / 2]
            for dz in [-0.4, 0, 0.4]
          ]
          low, high = min(heights) - 0.09, max(heights) + 0.09
          block(x, (low + high) / 2, z, width, high - low, 0.8, roof_color)
    roof_profiles.append(
      {
        "name": name,
        "eaveY": eave,
        "areaM2": roof.area,
        "firstTriangle": start,
        "triangleCount": len(roof_triangles) - start,
        "status": "Thin estimated roof interpolates existing DOP ridge heights over exact original source roof footprints; courts remain open",
      }
    )

  native_segments = segments[native_detail_start:] + [
    s
    for s in segments[:native_detail_start]
    if s[6] == trim and s[1] in {27, 26.2} and s[4] == s[1]
  ]
  for ax, ay, az, bx, by, bz, c in native_segments:
    length = math.dist((ax, ay, az), (bx, by, bz))
    n = max(1, math.ceil(length / 1.1))
    for i in range(n):
      f = (i + 0.5) / n
      block(
        ax + (bx - ax) * f, ay + (by - ay) * f, az + (bz - az) * f, 0.43, 0.43, 0.43, c
      )
  native_boxes = [
    r for i, r in enumerate(boxes) if r[7] == glass or i >= native_box_start
  ]
  # Independent orthogonal skin strips cover the full source wall course.
  # Their axis-aligned bounds overlap at steps, avoiding diagonal slit gaps.
  # Only boundary strips are submitted; there are no interior voxel columns.
  for skin in wall_skins:
    x, y, z, w, h, d, yaw, c = boxes[skin["boxIndex"]]
    n = max(1, math.ceil(w / 0.4))
    span = w / n
    dx, dz = math.cos(yaw), -math.sin(yaw)
    for i in range(n):
      u = (i + 0.5) * span - w / 2
      block(
        x + dx * u,
        y,
        z + dz * u,
        max(0.08, abs(dx) * span + abs(dz) * d),
        h,
        max(0.08, abs(dz) * span + abs(dx) * d),
        c,
      )
  for x, y, z, w, h, d, yaw, c in native_boxes:
    n = max(1, math.ceil(w / 0.8))
    for i in range(n):
      u = (i + 0.5) * w / n - w / 2
      block(
        x + math.cos(yaw) * u, y, z - math.sin(yaw) * u, min(0.78, w), h, max(0.2, d), c
      )
  return {
    "schemaVersion": 1,
    "features": features,
    "segments": segments,
    "boxes": boxes,
    "nativeRows": list(native.values()),
    "estimatedWallSkins": wall_skins,
    "estimatedRoofSkins": roof_profiles,
    "roofTriangles": roof_triangles,
    "moabitTowerHierarchy": towers,
    "palaceTower": {
      "center": [cx, cz],
      "groundY": ground,
      "publishedHeightM": 45,
      "topY": 48,
      "source": "LDA 09040610",
      "status": "DOP-aligned centre; drum/cupola/lantern subdivisions and abstract gilded finial are display estimates",
    },
    "estimatedRidges": estimated_ridges,
    "sourceConflicts": [
      {
        "name": "Kriminalgericht Moabit main wings",
        "partId": "DEBE3DZuPJnvKibt",
        "sourceHeightM": 3.0,
        "displayEaveHeightM": 21.0,
        "displayRoofHeightM": 29.0,
        "displayCentralRoofHeightM": 34.0,
        "decision": "Keep all v166 geometry and its correct two-tower/lower-dome hierarchy. Its wide 3m main-wing part conflicts with current photographs and DOP. Add only a thin upper facade and source-footprint-clipped roof ridge interpretation; heights are display estimates.",
      },
      {
        "name": "Littenstraße courts",
        "parentId": "DEBE01YYK000017e",
        "sourceHeightM": 3.081,
        "displayEaveHeightM": 24,
        "displayRoofHeightM": 28,
        "decision": "Keep source parent; five-level thin upper facade and DOP ridge interpretation. Both 60m historical northern towers were demolished 1968/69 and are not reproduced.",
      },
      {
        "name": "Tegeler Weg court",
        "parentId": "DEBE04YY500008YZ",
        "sourceHeightM": 21.409,
        "displayRidgeHeightM": 30,
        "displayMainGableHeightM": 37,
        "decision": "Keep flat source parent; high roof/main gable are DOP/photo-aligned thin outline estimates.",
      },
      {
        "name": "Schloss Charlottenburg",
        "parentId": "DEBE04YY500000nx",
        "sourceHeightM": 19.184,
        "publishedTowerHeightM": 45,
        "decision": "Keep complete source palace; add independent drum/cupola/lantern contours, no duplicate palace shell.",
      },
    ],
    "policy": "Additive source contours and thin recognition members only; every previous measured surface and generic owner remains visible/eligible. No textures, new building shell, hidden fill or tour stop.",
  }


def main() -> None:
  """Reproduce the bounded overlay from cached source evidence."""
  records = extract()
  payload = build(records)
  native_rows = payload.pop("nativeRows")
  native_path = DEST.with_name("justicePalaceV183Native.json")
  native_path.write_text(
    json.dumps(
      {
        "nativeRows": native_rows,
        "policy": "Independent axis-aligned facade strips and upper recognition contours; complete earlier native city retained",
      },
      separators=(",", ":"),
    )
    + "\n"
  )
  DEST.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
  print(
    json.dumps(
      {
        "records": len(records),
        "segments": len(payload["segments"]),
        "boxes": len(payload["boxes"]),
        "nativeRows": len(native_rows),
        "bytes": DEST.stat().st_size,
      }
    )
  )


if __name__ == "__main__":
  main()
