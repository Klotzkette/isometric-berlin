"""Step 10: source-bound Zoo station halls and Amerika Haus, prepared offline."""

from __future__ import annotations

import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import numpy as np
from build_breitscheid_towers_v161 import normal_of, triangles_for
from pyproj import Transformer
from shapely import constrained_delaunay_triangles
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import polygonize, unary_union

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_386_5818.zip"
OSM = ROOT / "geo_data/regierungsviertel/raw/zoo-station-v165/osm-map.xml"
DEST = ROOT / "src/app/src/data/zooStationV165Source.json"
NS = {
  "b": "http://www.opengis.net/citygml/building/1.0",
  "g": "http://www.opengis.net/gml",
}
PARENTS = {
  "DEBE04YY500000tN": "Zoo north hall and station base",
  "DEBE04YY50002d4Q": "Zoo regional hall",
  "DEBE04YY50002cek": "Zoo S-Bahn hall",
  "DEBE04YY50002beL": "Terrassen am Zoo",
  "DEBE04YY50002bg4": "Zoo platform canopy east",
  "DEBE04YY50002d5W": "Zoo platform canopy west",
  "DEBE04YY50002bYJ": "Zoo Jebensstrasse entrance",
  "DEBE04YY500005rJ": "Amerika Haus",
}
AMERIKA = "DEBE04YY500005rJ"
GROUND, PLATFORM = 5.2, 13.2
COLORS = {
  "stone": 0xC8C7B8,
  "roof": 0x727D79,
  "glass": 0xA8C2BD,
  "frame": 0x434F4C,
  "paving": 0xA4A59C,
}


def rounded(value: object) -> object:
  if isinstance(value, float):
    return round(value, 4)
  if isinstance(value, (list, tuple)):
    return [rounded(v) for v in value]
  if isinstance(value, dict):
    return {k: rounded(v) for k, v in value.items()}
  return value


def polygon_records(poly: object) -> list[dict]:
  return [
    {
      "ring": list(p.exterior.coords)[:-1],
      "holes": [list(h.coords)[:-1] for h in p.interiors],
    }
    for p in getattr(poly, "geoms", [poly])
    if isinstance(p, Polygon) and p.area > 0
  ]


def horizontal(poly: object, y: float) -> list:
  return [
    [[float(x), y, float(z)] for x, z in list(t.exterior.coords)[:3]]
    for p in getattr(poly, "geoms", [poly])
    if isinstance(p, Polygon)
    for t in constrained_delaunay_triangles(p).geoms
  ]


def make_payload() -> dict:
  with zipfile.ZipFile(SOURCE) as archive:
    tree = ET.fromstring(archive.read(archive.namelist()[0]))
  osm = ET.parse(OSM).getroot()
  projection = Transformer.from_crs(4326, 25833, always_xy=True)
  nodes = {}
  for node in osm.findall("node"):
    x, z = projection.transform(float(node.get("lon")), float(node.get("lat")))
    nodes[node.get("id")] = [x - 389500, 5820000 - z]
  ways = {}
  for way in osm.findall("way"):
    coords = [nodes[n.get("ref")] for n in way.findall("nd") if n.get("ref") in nodes]
    ways[way.get("id")] = {
      "id": way.get("id"),
      "tags": {t.get("k"): t.get("v") for t in way.findall("tag")},
      "points": coords,
    }
  for relation in osm.findall("relation"):
    tags = {t.get("k"): t.get("v") for t in relation.findall("tag")}
    if not tags.get("building:part"):
      continue
    lines = []
    for m in relation.findall("member"):
      if (
        m.get("type") == "way"
        and m.get("role") in ["outer", ""]
        and m.get("ref") in ways
      ):
        lines.append(LineString(ways[m.get("ref")]["points"]))
    polygons = list(polygonize(unary_union(lines)))
    if len(polygons) == 1:
      key = "relation-" + relation.get("id")
      ways[key] = {"id": key, "tags": tags, "points": list(polygons[0].exterior.coords)}
  out = {
    "schemaVersion": 1,
    "groundY": GROUND,
    "platformY": PLATFORM,
    "archives": [
      {
        "url": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_386_5818.zip",
        "sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "licence": "dl-de/zero-2-0",
      },
      {
        "url": "https://www.openstreetmap.org/api/0.6/map?bbox=13.3277,52.5053,13.3358,52.5100",
        "sha256": hashlib.sha256(OSM.read_bytes()).hexdigest(),
        "licence": "ODbL-1.0",
      },
    ],
    "parts": [],
    "surfaces": [],
    "beams": [],
    "boxes": [],
    "nativeBlocks": [],
    "platforms": [],
    "tracks": [],
    "stairs": [],
    "legacyPrisms": [],
    "osmEvidence": [],
  }

  def beam(a, b, width=0.12, color=COLORS["frame"]):
    if math.dist(a, b) > 0.08:
      out["beams"].append([*a, *b, width, color])

  def addbox(x, y, z, w, h, d, yaw, color):
    out["boxes"].append([x, y, z, w, h, d, yaw, color])

  def surface(tris, material, owner, kind):
    if tris:
      out["surfaces"].append(
        {
          "owner": owner,
          "kind": kind,
          "material": material,
          "color": COLORS[material],
          "triangles": tris,
        }
      )

  station_polys = []
  amerika_polys = []
  raw_roofs = []
  for parent in tree.findall(".//b:Building", NS):
    pid = parent.get("{" + NS["g"] + "}id")
    if pid not in PARENTS:
      continue
    amerika = pid == AMERIKA
    datum = 31.61 if amerika else 31.68
    for part in parent.findall(".//b:BuildingPart", NS) or [parent]:
      sid = part.get("{" + NS["g"] + "}id")
      record = {
        "id": sid,
        "parentId": pid,
        "name": PARENTS[pid],
        "sourceGroundNHN": datum,
        "sourceSurfaces": [],
        "rings": [],
        "holes": [],
      }
      for boundary in part.findall("b:boundedBy", NS):
        for s in boundary:
          kind = s.tag.split("}")[-1]
          for polygon in s.findall(".//g:Polygon", NS):
            rings = []
            for pos in polygon.findall(".//g:posList", NS):
              v = [float(q) for q in pos.text.split()]
              ring = [
                [v[i] - 389500, v[i + 2] - datum + GROUND, 5820000 - v[i + 1]]
                for i in range(0, len(v), 3)
              ]
              if ring[0] == ring[-1]:
                ring.pop()
              rings.append(ring)
            record["sourceSurfaces"].append({"kind": kind, "rings": rings})
            if kind == "GroundSurface":
              record["rings"].append([[q[0], q[2]] for q in rings[0]])
              record["holes"].append([[[q[0], q[2]] for q in r] for r in rings[1:]])
              continue
            if kind not in ["WallSurface", "RoofSurface"]:
              continue
            normal = normal_of(rings[0])
            tris = triangles_for(rings)
            if kind == "RoofSurface":
              surface(tris, "roof", sid, kind)
              raw_roofs.extend(tris)
              for ring in rings:
                for a, b in zip(ring, ring[1:] + ring[:1], strict=True):
                  beam(a, b, 0.13, 0x56615C)
              continue
            # The station's sealed LoD2 envelopes encode a glass curtain wall, not
            # opaque infill. Retain every plane as low-alpha glazing, with a frame.
            if not amerika:
              is_hall = max(q[1] for q in rings[0]) > PLATFORM + 3.0
              if is_hall:
                # Below platform level keep the source stone base. Open concourse
                # entry glazing occupies its front/rear instead of a solid box.
                surface(tris, "glass", sid, kind)
              else:
                surface(tris, "stone", sid, kind)
            else:
              # The long street-facing wall is glazed. End/rear walls remain
              # opaque source masonry, rather than a transparent empty envelope.
              # Source normals point outward toward Hardenbergstrasse here.
              glazed = (
                sid.endswith("A1c2eNP3")
                and abs(normal[1]) < 0.01
                and float(np.dot(normal, [0.6193, 0, -0.7852])) > 0.98
              )
              surface(tris, "glass" if glazed else "stone", sid, kind)
            if abs(normal[1]) > 0.01:
              continue
            a, b = max(
              ((a, b) for a in rings[0] for b in rings[0]),
              key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
            )
            length = math.hypot(b[0] - a[0], b[2] - a[2])
            if length < 0.6:
              continue
            tangent = np.array([(b[0] - a[0]) / length, 0, (b[2] - a[2]) / length])
            base = np.array(a)
            projected = [
              [(float(np.dot(np.subtract(p, base), tangent)), p[1]) for p in r]
              for r in rings
            ]
            planar = Polygon(projected[0], projected[1:])

            def stroke(line, width, color):
              cut = planar.intersection(line)
              for seg in getattr(cut, "geoms", [cut]):
                if not isinstance(seg, LineString) or seg.length < 0.2:
                  continue
                qa, qb = list(seg.coords)[0], list(seg.coords)[-1]
                aa = base + tangent * qa[0] + normal * 0.065
                bb = base + tangent * qb[0] + normal * 0.065
                aa[1] = qa[1]
                bb[1] = qb[1]
                beam(list(aa), list(bb), width, color)

            low, high = planar.bounds[1], planar.bounds[3]
            pitch = 2.2 if amerika else 3.2
            count = max(1, math.ceil(length / pitch))
            for i in range(count + 1):
              u = i * length / count
              stroke(
                LineString([(u, low), (u, high)]),
                0.105 if amerika else 0.16,
                0xD9DBCD if amerika else COLORS["frame"],
              )
            for y in np.arange(low + 0.5, high, 3.4 if amerika else 2.6):
              stroke(
                LineString([(-0.1, y), (length + 0.1, y)]),
                0.1 if amerika else 0.12,
                0xD4D6C8 if amerika else COLORS["frame"],
              )
            if amerika:
              for y in [5.55, 9.35, 13.2]:
                stroke(LineString([(-0.1, y), (length + 0.1, y)]), 0.28, 0xECE9D8)
              if glazed:
                # The photographed street bar has an opaque dark spandrel
                # between its two window rows. Keep this bounded to the exact
                # source plane; its subdivision heights are display estimates.
                for bottom, top in [(low, 5.64), (9.35, 10.32)]:
                  strip = planar.intersection(
                    Polygon(
                      [(-1, bottom), (length + 1, bottom), (length + 1, top), (-1, top)]
                    )
                  )
                  faces = []
                  for piece in getattr(strip, "geoms", [strip]):
                    if not isinstance(piece, Polygon) or piece.area < 0.01:
                      continue
                    for tri in constrained_delaunay_triangles(piece).geoms:
                      face = []
                      for u, y in list(tri.exterior.coords)[:3]:
                        q = base + tangent * u + normal * 0.045
                        q[1] = y
                        face.append(list(q))
                      faces.append(face)
                  surface(faces, "frame", sid + ":spandrel", "FacadeSpandrel")
      points = [p for s in record["sourceSurfaces"] for r in s["rings"] for p in r]
      record["groundY"] = min(p[1] for p in points)
      record["topY"] = max(p[1] for p in points)
      out["parts"].append(record)
      if amerika:
        footprint = unary_union(
          [Polygon(r, record["holes"][i]) for i, r in enumerate(record["rings"])]
        )
        amerika_polys.append(footprint)
        if sid.endswith("A1c2eNP3"):
          surface(
            horizontal(footprint, 9.97), "paving", sid + ":floor", "EstimatedUpperFloor"
          )
      else:
        station_polys.extend(
          Polygon(r, record["holes"][i]) for i, r in enumerate(record["rings"])
        )
  # Ground finish is bounded by all seven complete source footprints, including
  # their holes. Without this the real glazing incorrectly reveals terrain lawn.
  surface(
    horizontal(unary_union(amerika_polys), 5.42),
    "paving",
    AMERIKA + ":floor",
    "InteriorGroundFloor",
  )
  # Exact OSM building envelope also includes the concourse and overhanging
  # hall perimeter that does not appear in every LoD2 GroundSurface.
  for wid in ["96955257", "20145539", "421829986"]:
    station_polys.append(Polygon(ways[wid]["points"]))
  station_union = unary_union(station_polys)
  out["stationFootprint"] = polygon_records(station_union)
  # All three mapped platform outlines (including holes around stairs).
  for rid in ["3641992", "3641993", "3641994"]:
    relation = next(e for e in osm.findall("relation") if e.get("id") == rid)
    tags = {t.get("k"): t.get("v") for t in relation.findall("tag")}
    lines = {role: [] for role in ["outer", "inner"]}
    for member in relation.findall("member"):
      if member.get("type") != "way" or member.get("ref") not in ways:
        continue
      w = ways[member.get("ref")]
      role = member.get("role") or "outer"
      if role in lines and len(w["points"]) > 1:
        lines[role].append(LineString(w["points"]))
    shells = list(polygonize(unary_union(lines["outer"])))
    holes = list(polygonize(unary_union(lines["inner"]))) if lines["inner"] else []
    poly = unary_union(shells).difference(unary_union(holes))
    furniture = []
    cx, cz = poly.representative_point().coords[0]
    for delta in [-37, 0, 37]:
      candidate = Point(
        cx + math.cos(math.radians(61.1)) * delta,
        cz - math.sin(math.radians(61.1)) * delta,
      )
      if poly.buffer(-1.5).covers(candidate):
        furniture.append(list(candidate.coords[0]))
    out["platforms"].append(
      {
        "id": rid,
        "ref": tags["ref"],
        "polygons": polygon_records(poly),
        "y": PLATFORM + 0.76,
        "furniturePoints": furniture,
      }
    )
    surface(horizontal(poly, PLATFORM + 0.76), "paving", rid, "MappedPlatform")
    for p in getattr(poly, "geoms", [poly]):
      if not isinstance(p, Polygon):
        continue
      for ring in [p.exterior, *p.interiors]:
        coords = list(ring.coords)
        for a, b in zip(coords, coords[1:]):
          beam(
            [a[0], PLATFORM + 0.74, a[1]], [b[0], PLATFORM + 0.74, b[1]], 0.20, 0xE0E0CB
          )
  rail_envelope = unary_union(
    [
      station_union,
      *[
        Polygon(p["ring"], p["holes"])
        for platform in out["platforms"]
        for p in platform["polygons"]
      ],
    ]
  ).buffer(5)
  # Ground concourse slab; open structural volume, not a replacement solid.
  surface(
    horizontal(station_union, GROUND + 0.05), "paving", "station", "ConcourseFloor"
  )
  # Native hollow hall and full source shell are surface samples, never filled.
  # Rails keep exact OSM curves and six numbered track identities.
  for wid, w in ways.items():
    tags = w["tags"]
    pts = w["points"]
    if (
      tags.get("railway") not in ["rail", "light_rail"]
      or tags.get("level") != "2"
      or not tags.get("railway:track_ref")
      or len(pts) < 2
    ):
      continue
    clipped = LineString(pts).intersection(rail_envelope)
    for line in getattr(clipped, "geoms", [clipped]):
      if not isinstance(line, LineString) or line.length < 3:
        continue
      points = list(line.coords)
      out["tracks"].append(
        {"id": wid, "ref": tags["railway:track_ref"], "points": points}
      )
      for a, b in zip(points, points[1:]):
        dx, dz = b[0] - a[0], b[1] - a[1]
        length = math.hypot(dx, dz)
        if length < 0.1:
          continue
        nx, nz = -dz / length, dx / length
        yaw = math.atan2(-dz, dx)
        addbox(
          (a[0] + b[0]) / 2,
          PLATFORM - 0.12,
          (a[1] + b[1]) / 2,
          length + 0.03,
          0.38,
          2.85,
          yaw,
          0x5D6059,
        )
        for offset in [-0.7175, 0.7175]:
          beam(
            [a[0] + nx * offset, PLATFORM + 0.14, a[1] + nz * offset],
            [b[0] + nx * offset, PLATFORM + 0.14, b[1] + nz * offset],
            0.10,
            0xB4B7B1,
          )
        for k in range(math.ceil(length / 0.85)):
          f = (k + 0.5) / math.ceil(length / 0.85)
          addbox(
            a[0] + dx * f,
            PLATFORM + 0.01,
            a[1] + dz * f,
            0.17,
            0.12,
            2.3,
            yaw,
            0x5A4B40,
          )
  # Mapped above-ground stairs: ordinary local geometry; elevation is an explicit
  # display interpolation between source-labelled storeys, not a DB plan trace.
  for wid, w in ways.items():
    tags = w["tags"]
    pts = w["points"]
    if (
      tags.get("highway") != "steps"
      or len(pts) < 2
      or not station_union.buffer(3).covers(Point(pts[0]))
    ):
      continue
    levels = []
    try:
      levels = [float(q) for q in tags.get("level", "").split(";")]
    except ValueError:
      pass
    if not levels or min(levels) < 0 or max(levels) > 2:
      continue
    low, high = GROUND + min(levels) * 4, GROUND + max(levels) * 4
    if high - low < 1:
      continue
    a, b = pts[0], pts[-1]
    length = math.dist(a, b)
    n = max(4, math.ceil((high - low) / 0.18))
    width = min(3.4, float(tags.get("width", "2.4")))
    if tags.get("incline") == "down":
      a, b = b, a
    dx, dz = b[0] - a[0], b[1] - a[1]
    yaw = math.atan2(-dz, dx)
    out["stairs"].append(
      {"id": wid, "a": a, "b": b, "low": low, "high": high, "width": width}
    )
    for i in range(n):
      f = (i + 0.5) / n
      y = low + (i + 1) * (high - low) / n
      addbox(
        a[0] + dx * f,
        y - 0.08,
        a[1] + dz * f,
        length / n + 0.01,
        0.16,
        width,
        yaw,
        0xCDCEC0,
      )
    for sign in [-1, 1]:
      nx, nz = -dz / length * width / 2 * sign, dx / length * width / 2 * sign
      beam(
        [a[0] + nx, low + 1, a[1] + nz],
        [b[0] + nx, high + 1, b[1] + nz],
        0.055,
        0x737D74,
      )
  # Transverse roof ribs follow the measured roof planes, including their curve
  # approximation; longitudinal spacing and member thickness are display values.
  station_part_ids = {p["id"] for p in out["parts"] if p["parentId"] != AMERIKA}
  ux, uz = math.cos(math.radians(61.1)), -math.sin(math.radians(61.1))
  for roof in out["surfaces"]:
    if roof["kind"] != "RoofSurface" or roof["owner"] not in station_part_ids:
      continue
    for t in roof["triangles"]:
      values = [p[0] * ux + p[2] * uz for p in t]
      for u in range(
        math.ceil(min(values) / 9) * 9, math.floor(max(values) / 9) * 9 + 1, 9
      ):
        points = []
        for i, j in [(0, 1), (1, 2), (2, 0)]:
          if abs(values[j] - values[i]) < 1e-9:
            continue
          f = (u - values[i]) / (values[j] - values[i])
          if 0 <= f <= 1:
            q = [t[i][k] + (t[j][k] - t[i][k]) * f for k in range(3)]
            q[1] -= 0.28
            if not any(math.dist(q, p) < 0.001 for p in points):
              points.append(q)
        if len(points) == 2:
          beam(points[0], points[1], 0.23, 0x454E49)
  # Recover exact core owner IDs, including indoor source parts that otherwise
  # masquerade as opaque nine-metre buildings. No radius-based ownership.
  core = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  semantic = {"32493294", "96955257", "20145539", "421829986"}
  for wid, w in ways.items():
    if len(w["points"]) < 3:
      continue
    t = w["tags"]
    if (
      (t.get("indoor") == "yes" or t.get("level") is not None or t.get("building:part"))
      and (t.get("building:part") or t.get("building"))
      and station_union.buffer(1).covers(Polygon(w["points"]).representative_point())
    ):
      semantic.add(wid)
  semantic.update(p["id"][-8:] for p in out["parts"])
  out["legacyPrisms"] = [
    p
    for p in core
    if p["id"] in semantic or any(p["id"] == sid[-8:] for sid in semantic)
  ]
  out["osmEvidence"] = [ways[k] for k in sorted(semantic) if k in ways]
  # Preserve the mapped above-ground shop/lift structures as small, glazed
  # interior subdivisions instead of the former nine-metre solid prisms.
  for w in out["osmEvidence"]:
    tags = w["tags"]
    if tags.get("level", "0") not in ["0", "1", "2"] or len(w["points"]) < 4:
      continue
    poly = Polygon(w["points"])
    if not poly.is_valid or poly.area > 240 or poly.area < 2:
      continue
    floor = GROUND + float(tags.get("level", "0")) * 4
    if tags.get("level") == "1":
      surface(horizontal(poly, floor), "paving", w["id"], "MappedMezzanine")
    for a, b in zip(w["points"], w["points"][1:]):
      length = math.dist(a, b)
      if length < 0.1:
        continue
      beam([a[0], floor + 0.2, a[1]], [a[0], floor + 2.95, a[1]], 0.09, 0x65736C)
      beam([a[0], floor + 2.95, a[1]], [b[0], floor + 2.95, b[1]], 0.12, 0x65736C)
      quad = [
        [a[0], floor + 0.3, a[1]],
        [b[0], floor + 0.3, b[1]],
        [b[0], floor + 2.88, b[1]],
        [a[0], floor + 2.88, a[1]],
      ]
      surface(
        [[quad[0], quad[1], quad[2]], [quad[0], quad[2], quad[3]]],
        "glass",
        w["id"],
        "MappedConcourseInterior",
      )
  out["sourceStatus"] = (
    "All 21 official source parts, source surfaces, curved mapped tracks and three platform polygons retained. Source hall walls are rendered as glazing and structure rather than opaque envelopes. Regional and S-Bahn roofs retain their actual opaque source profiles. Concourse and stair elevations, steel/member/pane dimensions and facade subdivisions are display estimates. No protected station plan was traced."
  )
  out["roofTriangles"] = raw_roofs
  out["colliders"] = [
    {
      "x": (b[0] + b[3]) / 2,
      "z": (b[2] + b[5]) / 2,
      "low": min(b[1], b[4]),
      "high": max(b[1], b[4]),
      "radius": b[6] / 2,
    }
    for b in out["beams"]
    if abs(b[0] - b[3]) < 0.03
    and abs(b[2] - b[5]) < 0.03
    and min(b[1], b[4]) < PLATFORM + 1
    and station_union.buffer(0.3).covers(Point(b[0], b[2]))
  ]
  # Only surface cells, in two-metre blocks; transparent panes remain transparent
  # even in Minecraft. Repeated cell coordinates are deduplicated per material.
  cells = {}
  for s in out["surfaces"]:
    for t in s["triangles"]:
      if (
        np.linalg.norm(np.cross(np.subtract(t[1], t[0]), np.subtract(t[2], t[0])))
        < 1e-8
      ):
        continue
      n = normal_of(t)
      axis = int(np.argmax(abs(n)))
      axes = [a for a in range(3) if a != axis]
      planar = Polygon([[p[a] for a in axes] for p in t])
      if planar.area < 0.01:
        continue
      x0, z0, x1, z1 = planar.bounds
      for u in range(math.floor(x0 / 2), math.ceil(x1 / 2)):
        for v in range(math.floor(z0 / 2), math.ceil(z1 / 2)):
          uv = [u * 2 + 1, v * 2 + 1]
          if not planar.covers(Point(uv)):
            continue
          p = np.zeros(3)
          p[axes] = uv
          p[axis] = (np.dot(n, t[0]) - sum(n[a] * p[a] for a in axes)) / n[axis]
          key = tuple(math.floor(float(q) / 2) * 2 + 1 for q in p)
          material = s["material"]
          cells[(*key, material)] = [*key, s["color"], material]
  out["nativeBlocks"] = list(cells.values())
  return rounded(out)


def main() -> None:
  data = make_payload()
  DEST.write_text(json.dumps(data, separators=(",", ":")) + "\n")
  nav = {
    k: data[k]
    for k in [
      "groundY",
      "platformY",
      "stationFootprint",
      "platforms",
      "stairs",
      "legacyPrisms",
      "roofTriangles",
      "colliders",
    ]
  }
  roof_cells = {}
  for x, y, z, _color, material in data["nativeBlocks"]:
    if material == "roof":
      roof_cells[(x, z)] = max(y + 1, roof_cells.get((x, z), -1000))
  nav["nativeRoofCells"] = [[x, z, y] for (x, z), y in roof_cells.items()]
  nav["parts"] = [
    {k: p[k] for k in ["id", "parentId", "name", "rings", "holes", "groundY", "topY"]}
    for p in data["parts"]
  ]
  DEST.with_name("zooStationV165Navigation.json").write_text(
    json.dumps(nav, separators=(",", ":")) + "\n"
  )
  print(
    {
      k: len(data[k])
      for k in [
        "parts",
        "surfaces",
        "beams",
        "boxes",
        "nativeBlocks",
        "platforms",
        "tracks",
        "stairs",
        "legacyPrisms",
      ]
    }
  )


if __name__ == "__main__":
  main()
