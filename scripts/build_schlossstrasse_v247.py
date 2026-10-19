"""Finite source-bound Schloßstraße connections at the Albrechtstraße junction."""

from __future__ import annotations

import base64
import gzip
import json
import math
import re

import build_steglitz_details_v246 as base
import numpy as np
from pyproj import Transformer
from shapely import constrained_delaunay_triangles
from shapely.geometry import LineString, Polygon, box, mapping, shape
from shapely.ops import transform, unary_union

ROOT, DATA, GEO = base.ROOT, base.DATA, base.GEO
RAW = GEO / "raw/v182-steglitz/lines.json"
OUT = DATA / "schlossstrasseV247Details.json"
EVIDENCE = GEO / "schlossstrasse-v247-evidence.json"
ROAD_IDS = {"1201444601", "4463223", "1422254219", "30149207", "1422257295"}
KERB_IDS = {
  "1121036710",
  "1121036711",
  "1121036712",
  "1121036715",
  "1121036716",
  "1121036717",
}
EXCLUDED = {"451621864", "483483276"}
ASPHALT, RED, WHITE, KERB = 0x686D6C, 0xA56558, 0xDEDCCD, 0xB6B4A7
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True)


def world(x, y, z=None):
  e, n = PROJECT.transform(x, y)
  try:
    return [v - 389500 for v in e], [5820000 - v for v in n]
  except TypeError:
    return e - 389500, 5820000 - n


def segments(line):
  for a, b in zip(line.coords, list(line.coords)[1:]):
    a, b = np.asarray(a), np.asarray(b)
    d = b - a
    length = float(np.linalg.norm(d))
    if length > 0.001:
      yield a, b, d / length, length


def strip(a, b, width):
  return LineString([a, b]).buffer(width / 2, cap_style=2)


def build():
  features = {f["properties"]["osm_id"]: f for f in base.read(RAW)["features"]}
  roads, kerbs, drawn, native = [], [], [], []
  for identity in sorted(ROAD_IDS | KERB_IDS):
    feature = features[identity]
    tags = dict(
      re.findall(
        r'"([^\"]+)"=>"([^\"]*)"', feature["properties"].get("other_tags") or ""
      )
    )
    line = transform(world, shape(feature["geometry"]))
    row = {"id": identity, "tags": tags, "geometry": mapping(line)}
    if identity in ROAD_IDS:
      assert feature["properties"]["name"] == "Schloßstraße"
      assert tags["cycleway:right:marking:both"] == "dashed_line"
      assert tags["width"] and tags["cycleway:right:width"]
      roads.append(row)
    else:
      assert feature["properties"]["barrier"] == "kerb"
      kerbs.append(row)
  mapped = unary_union(
    [
      shape(r["geometry"]).buffer(
        float(r["tags"]["width"]) / 2, cap_style=2, join_style=2
      )
      for r in roads
    ]
  )
  ground, buildings, oldroads, packet_paths, ground_triangles = [], [], [], [], []
  for identity in ["ring182--8_13", "ring182--7_13"]:
    path = base.PUBLIC / f"{identity}.drawn.json.gz"
    packet_paths.append(path)
    packet = json.loads(gzip.decompress(path.read_bytes()))
    ox, _, oz = packet["origin"]
    for key, target in [
      ("ground", ground),
      ("buildings", buildings),
      ("roads", oldroads),
    ]:
      for p in packet["nav"][key]:
        polygon = Polygon(
          [(x + ox, z + oz) for x, z in p["ring"]],
          [[(x + ox, z + oz) for x, z in h] for h in p.get("holes", [])],
        )
        target.append(polygon if polygon.is_valid else polygon.buffer(0))
    for mesh in packet["meshes"]:
      vertices = np.frombuffer(
        base64.b64decode(mesh["positions"]), dtype="<u2"
      ).reshape(-1, 3) / 100 + np.asarray(packet["origin"])
      indices = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(
        -1, 3
      )
      colours = np.frombuffer(base64.b64decode(mesh["colors"]), dtype="u1").reshape(
        -1, 3
      )
      for ids in indices:
        t = vertices[ids]
        if np.ptp(t[:, 1]) > 1e-5 or not 2.9 < t[0, 1] < 3.3:
          continue
        if (
          t[:, 0].max() < mapped.bounds[0]
          or t[:, 0].min() > mapped.bounds[2]
          or t[:, 2].max() < mapped.bounds[1]
          or t[:, 2].min() > mapped.bounds[3]
        ):
          continue
        overlap = Polygon(t[:, [0, 2]]).intersection(mapped).area
        if overlap > 0.001:
          ground_triangles.append(
            {
              "y": float(t[0, 1]),
              "rgb": colours[ids[0]].tolist(),
              "overlapM2": round(overlap, 6),
            }
          )
  for p in base.read(DATA / "steglitzV182Navigation.json")["buildings"]:
    buildings.append(Polygon(p["ring"], p.get("holes", [])))
  ground = unary_union(ground)
  occupied = unary_union([g if g.is_valid else g.buffer(0) for g in buildings])
  assert ground.buffer(0.02).covers(mapped)
  assert occupied.intersection(mapped).area < 0.01
  assert unary_union(oldroads).intersection(mapped).area < 0.01
  # Actual existing mesh scan, beyond nav metadata: only the old green ground
  # is present, at 3m. No old asphalt/paint surface is overdrawn in these gaps.
  assert ground_triangles and all(
    t["y"] == 3 and t["rgb"] == [125, 131, 103] for t in ground_triangles
  )

  def put(rows, row):
    rows.append([round(float(v), 4) for v in row[:-1]] + [row[-1]])

  def box_on_line(a, b, width, y, height, colour):
    d = b - a
    p = (a + b) / 2
    put(
      drawn,
      [
        p[0],
        y,
        p[1],
        np.linalg.norm(d),
        height,
        width,
        math.atan2(-d[1], d[0]),
        colour,
      ],
    )

  # Connected complete mapped road bodies. Keep all old roads and outlines.
  for road in roads:
    for a, b, _, _ in segments(shape(road["geometry"])):
      box_on_line(a, b, float(road["tags"]["width"]), 3.045, 0.09, ASPHALT)

  # A bent OSM axis has a real mitred corner between its rectangular legs.
  # Close precisely those small source-bounded gaps in the existing shell
  # batch; no estimated rectangle spills outside the mapped carriageway.
  def drawn_footprint(row):
    t = np.array([math.cos(row[6]), -math.sin(row[6])])
    n = np.array([math.sin(row[6]), math.cos(row[6])])
    return Polygon(
      [
        np.array([row[0], row[2]]) + t * a * row[3] / 2 + n * b * row[5] / 2
        for a, b in [(-1, -1), (1, -1), (1, 1), (-1, 1)]
      ]
    )

  existing_strips = unary_union([drawn_footprint(r) for r in drawn])
  joints = mapped.difference(existing_strips)
  joint_triangles = []
  for polygon in getattr(joints, "geoms", [joints]):
    if polygon.area < 1e-9:
      continue
    for triangle in constrained_delaunay_triangles(polygon).geoms:
      if polygon.buffer(1e-8).covers(triangle):
        points = [[x, 3.09, z] for x, z in list(triangle.exterior.coords)[:3]]
        if (
          np.cross(np.array(points[1]) - points[0], np.array(points[2]) - points[0])[1]
          < 0
        ):
          points.reverse()
        joint_triangles.append(points)
  surfaces = [
    {
      "owner": "Schloßstraße mapped road joints",
      "color": ASPHALT,
      "triangles": joint_triangles,
    }
  ]
  assert (
    abs(
      sum(Polygon([(p[0], p[2]) for p in tri]).area for tri in joint_triangles)
      - joints.area
    )
    < 1e-5
  )
  floor_tiles = []
  for x in range(math.floor(mapped.bounds[0]), math.ceil(mapped.bounds[2])):
    for z in range(math.floor(mapped.bounds[1]), math.ceil(mapped.bounds[3])):
      tile = box(x, z, x + 1, z + 1)
      if mapped.covers(tile):
        floor_tiles.append(tile)
        put(native, [x + 0.5, 3.045, z + 0.5, 1, 0.09, 1, ASPHALT])
  native_floor = unary_union(floor_tiles)
  paint_receipts = []
  for road in roads:
    line, tags = shape(road["geometry"]), road["tags"]
    width, cycle = float(tags["width"]), float(tags["cycleway:right:width"])
    # Ends remain open at each mapped junction; no invented zebra/stop/arrows.
    local = line.buffer(width / 2, cap_style=2, join_style=2)
    for distance in np.arange(2, line.length - 2, 2):
      a = np.asarray(line.interpolate(distance).coords[0])
      b = np.asarray(line.interpolate(min(distance + 2, line.length - 2)).coords[0])
      delta = b - a
      length = float(np.linalg.norm(delta))
      if length < 0.1:
        continue
      tangent = delta / length
      right = np.asarray([-tangent[1], tangent[0]])  # world Z is southwards
      if tags["cycleway:right:surface:colour"] == "red":
        offset = right * (width - cycle) / 2
        colour_area = strip(a + offset, b + offset, cycle)
        if local.buffer(0.025).covers(colour_area):
          box_on_line(a + offset, b + offset, cycle, 3.104, 0.012, RED)
          paint_receipts.append(
            {"id": road["id"], "kind": "red", "polygon": mapping(colour_area)}
          )
          for x in np.arange(
            math.floor(colour_area.bounds[0] * 2) / 2, colour_area.bounds[2], 0.5
          ):
            for z in np.arange(
              math.floor(colour_area.bounds[1] * 2) / 2, colour_area.bounds[3], 0.5
            ):
              tile = box(x, z, x + 0.5, z + 0.5)
              if colour_area.covers(tile) and native_floor.covers(tile):
                put(native, [x + 0.25, 3.104, z + 0.25, 0.5, 0.012, 0.5, RED])
      if int(distance) % 4 != 2:
        continue
      for edge_offset in [width / 2 - cycle, width / 2 - 0.1]:
        centre = (a + b) / 2 + right * edge_offset
        half = min(0.7, length / 2)
        ma, mb = centre - tangent * half, centre + tangent * half
        area = strip(ma, mb, 0.12)
        if not local.covers(area):
          continue
        box_on_line(ma, mb, 0.12, 3.12, 0.012, WHITE)
        paint_receipts.append(
          {"id": road["id"], "kind": "dashed", "polygon": mapping(area)}
        )
        steps = max(1, math.ceil(2 * half / 0.5))
        for i in range(steps):
          q = ma + (mb - ma) * (i + 0.5) / steps
          w, d = (
            max(0.12, abs(tangent[0]) * 2 * half / steps),
            max(0.12, abs(tangent[1]) * 2 * half / steps),
          )
          tile = box(q[0] - w / 2, q[1] - d / 2, q[0] + w / 2, q[1] + d / 2)
          if native_floor.covers(tile):
            put(native, [q[0], 3.12, q[1], w, 0.012, d, WHITE])
  native_kerb_receipts = []
  for kerb in kerbs:
    line = shape(kerb["geometry"])
    assert ground.buffer(0.02).covers(line.buffer(0.13))
    assert occupied.intersection(line.buffer(0.13)).area < 0.01
    top = 3.105 if kerb["tags"].get("kerb") == "lowered" else 3.16
    for a, b, tangent, length in segments(line):
      box_on_line(a, b, 0.18, (3 + top) / 2, top - 3, KERB)
      # Independent Manhattan steps on the exact mapped curb. Each rectangle
      # stays within 0.25m of its source edge; reduced crossings stay low.
      steps = max(1, math.ceil(length / 0.35))
      for i in range(steps):
        p = a + (b - a) * i / steps
        q = a + (b - a) * (i + 1) / steps
        c = (p + q) / 2
        w, d = max(0.18, abs(q[0] - p[0])), max(0.18, abs(q[1] - p[1]))
        footprint = box(c[0] - w / 2, c[1] - d / 2, c[0] + w / 2, c[1] + d / 2)
        assert line.buffer(0.25).covers(footprint)
        put(native, [c[0], (3 + top) / 2, c[1], w, top - 3, d, KERB])
        native_kerb_receipts.append({"id": kerb["id"], "footprint": mapping(footprint)})
  native = base.merge_boxes(native)
  assert len(drawn) <= 450 and len(native) <= 520, (len(drawn), len(native))
  preserve = [
    RAW,
    DATA / "steglitzV182Source.json",
    DATA / "steglitzV182Native.json",
    DATA / "steglitzV182Navigation.json",
    DATA / "steglitzV246Details.json",
    *packet_paths,
  ]
  evidence = {
    "version": 247,
    "policy": "Five finite mapped Schloßstraße gaps at Albrechtstraße, not the full boulevard. Original surfaces, v246 ways, building/navigation sources and all earlier details remain byte-identical. Full touch detail, existing batch and unchanged caps. No inferred crossing or road lane axis. Curb width/height, paint thickness/dash cadence and tone are display estimates; lowered source kerbs remain lowered.",
    "sourceSha256": {str(p.relative_to(ROOT)): base.sha(p) for p in preserve},
    "excludedPriorWays": sorted(EXCLUDED),
    "roads": roads,
    "kerbs": kerbs,
    "paint": paint_receipts,
    "nativeKerbSupports": native_kerb_receipts,
    "sourceGroundTriangles": ground_triangles,
    "roadLengthM": round(sum(shape(r["geometry"]).length for r in roads), 3),
    "kerbLengthM": round(sum(shape(r["geometry"]).length for r in kerbs), 3),
    "counts": {
      "drawn": len(drawn),
      "native": len(native),
      "jointTriangles": len(joint_triangles),
    },
    "jointAreaM2": joints.area,
  }
  return {
    "version": 247,
    "boxes": drawn,
    "nativeRows": native,
    "surfaces": surfaces,
  }, evidence


if __name__ == "__main__":
  data, evidence = build()
  for path, content in [(OUT, data), (EVIDENCE, evidence)]:
    path.write_text(
      json.dumps(content, separators=(",", ":"), ensure_ascii=False) + "\n"
    )
  print(
    json.dumps(
      {
        "bytes": OUT.stat().st_size,
        **evidence["counts"],
        "roadLengthM": evidence["roadLengthM"],
        "kerbLengthM": evidence["kerbLengthM"],
      }
    )
  )
