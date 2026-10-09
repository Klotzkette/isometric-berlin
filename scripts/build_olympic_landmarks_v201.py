"""Step10: preserve Olympic detail while attaching each part to measured ground."""

from __future__ import annotations

import hashlib
import json
import math

import build_weinberg_terrain_packets_v176 as draper
import numpy as np
from build_olympic_terrain_v201 import (
  GEO,
  OLYMPIC_OFFSETS,
  ROOT,
  SUPPORT,
  encode,
  offset_at,
)
from build_west_landmarks_v187 import world
from shapely.geometry import Point, Polygon, shape
from shapely.ops import transform, unary_union

DATA = ROOT / "src/app/src/data"
OLD_PITCH = -12.667
OLD_RIM = 3.55
PITCH = 23.05
RIM = 37.0


def stadium_y(y: float) -> float:
  if y >= OLD_RIM:
    return y + 33.45
  return PITCH + (y - OLD_PITCH) * (RIM - PITCH) / (OLD_RIM - OLD_PITCH)


def grid_cuts(a: float, b: float) -> list[float]:
  return [a, *range((math.floor(a / 8) + 1) * 8, math.ceil(b / 8) * 8, 8), b]


def build() -> dict:
  original = DATA / "westLandmarksV187.json"
  old = json.loads(original.read_bytes())
  draper.SUPPORT = SUPPORT
  draper.STEP = draper.NATIVE_STEP = 8
  draper.sample_offset = lambda x, z: offset_at(x, z)
  draper.sample_native_offset = lambda x, z: offset_at(x, z, True)
  pools = []
  for group in old["groups"]:
    if not group["name"].startswith("Olympiapark"):
      continue
    for surface in group["surfaces"]:
      if surface["color"] != 0x529CA8:
        continue
      triangles = surface["triangles"]
      polygon = unary_union([Polygon([(p[0], p[2]) for p in t]) for t in triangles])
      # DGM often measures the empty pool bottom. A single conservative rim
      # datum preserves the old horizontal water, without a sloping liquid.
      level = max(p[1] + offset_at(p[0], p[2]) for t in triangles for p in t)
      pools.append((polygon, round(level, 6)))

  def pool_level(x: float, z: float) -> float | None:
    p = Point(x, z)
    for polygon, y in pools:
      if polygon.buffer(0.2).covers(p):
        return y
    return None

  groups, audit = [], []
  for g in old["groups"]:
    if not g["name"].startswith("Olympiapark"):
      continue
    result = {**g, "surfaces": [], "rods": [], "native": []}
    triangle_runs = []
    for s in g["surfaces"]:
      triangles = []
      water_y = (
        max(p[1] + offset_at(p[0], p[2]) for t in s["triangles"] for p in t)
        if s["color"] == 0x529CA8
        else None
      )
      for tri in s["triangles"]:
        if water_y is not None:
          pieces = [np.asarray([[x, water_y, z] for x, y, z in tri])]
        elif tri[0][1] < 0:
          pieces = [np.asarray([[x, stadium_y(y), z] for x, y, z in tri])]
        else:
          pieces = draper.drape_triangle(np.asarray(tri))
        triangle_runs.append(len(pieces))
        triangles.extend(np.round(v, 6).tolist() for v in pieces)
      result["surfaces"].append(
        {
          **s,
          "triangles": triangles,
          **({"waterY": round(water_y, 6)} if water_y is not None else {}),
        }
      )
    for r in g["rods"]:
      if r[1] < 0:
        result["rods"].append(
          [r[0], stadium_y(r[1]), r[2], r[3], stadium_y(r[4]), r[5], *r[6:]]
        )
        continue
      water_y = pool_level((r[0] + r[3]) / 2, (r[2] + r[5]) / 2)
      if water_y is not None:
        result["rods"].append(
          [r[0], water_y + r[1] - 3.6, r[2], r[3], water_y + r[4] - 3.6, r[5], *r[6:]]
        )
        continue
      # Split at every cell axis and diagonal: each retained line follows the
      # exact same plane as its field/pool/seating sheet instead of floating.
      cuts = {0.0, 1.0}
      for axis in (0, 2):
        d = r[axis + 3] - r[axis]
        if abs(d) > 1e-9:
          lo, hi = sorted((r[axis], r[axis + 3]))
          cuts.update((v - r[axis]) / d for v in grid_cuts(lo, hi)[1:-1])
      diagonal_delta = (r[3] - r[5]) - (r[0] - r[2])
      if abs(diagonal_delta) > 1e-9:
        lo, hi = sorted((r[0] - r[2], r[3] - r[5]))
        cuts.update(
          (v - (r[0] - r[2])) / diagonal_delta for v in grid_cuts(lo, hi)[1:-1]
        )
      stops = sorted(cuts)
      for a, b in zip(stops, stops[1:]):
        points = []
        for t in (a, b):
          x, y, z = [r[j] + (r[j + 3] - r[j]) * t for j in range(3)]
          points.extend([x, y + offset_at(x, z), z])
        result["rods"].append([*points, *r[6:]])
    native_runs = []
    for r in g["native"]:
      count = 0
      if r[1] < 0:
        low, high = stadium_y(r[1] - r[4] / 2), stadium_y(r[1] + r[4] / 2)
        result["native"].append(
          [r[0], (low + high) / 2, r[2], r[3], high - low, r[5], r[6]]
        )
        count = 1
      elif (water_y := pool_level(r[0], r[2])) is not None:
        result["native"].append([r[0], water_y + r[1] - 3.6, r[2], *r[3:]])
        count = 1
      else:
        xs, zs = (
          grid_cuts(r[0] - r[3] / 2, r[0] + r[3] / 2),
          grid_cuts(r[2] - r[5] / 2, r[2] + r[5] / 2),
        )
        for a, b in zip(xs, xs[1:]):
          for c, d in zip(zs, zs[1:]):
            x, z = (a + b) / 2, (c + d) / 2
            result["native"].append(
              [x, r[1] + offset_at(x, z, True), z, b - a, r[4], d - c, r[6]]
            )
            count += 1
      native_runs.append(count)
    result["anchor"] = [
      g["anchor"][0],
      3 + offset_at(g["anchor"][0], g["anchor"][2]),
      g["anchor"][2],
    ]
    groups.append(result)
    audit.append(
      {
        "name": g["name"],
        "sourceTriangles": sum(len(s["triangles"]) for s in g["surfaces"]),
        "resultTriangles": sum(len(s["triangles"]) for s in result["surfaces"]),
        "triangleRuns": triangle_runs,
        "sourceNativeBoxes": len(g["native"]),
        "resultNativeBoxes": len(result["native"]),
        "nativeRuns": native_runs,
        "sourceRods": len(g["rods"]),
        "resultRods": len(result["rods"]),
      }
    )
  # Source pylons are in one old batch but have distinct measured base datums.
  source = json.loads((GEO / "west-landmarks-v187-source.json").read_bytes())
  anchors = []
  for owner in source["profiles"]:
    if owner["name"] not in ("Preussenturm", "Bayernturm"):
      continue
    polygon = unary_union(
      [Polygon(p["ring"], p["holes"]) for p in owner["sourceParts"]]
    )
    anchors.append((polygon, -owner["offsetY"], owner["parentId"]))
  osm = json.loads((GEO / "west-landmarks-v187-osm.json").read_bytes())
  for f in osm["features"]:
    t = f["properties"]["tags"]
    oid = f["properties"]["id"]
    if (
      t.get("height") == "36"
      and t.get("man_made") == "tower"
      and oid not in ("way/48983460", "way/48983461")
    ):
      poly = transform(lambda x, y: world(x, y), shape(f["geometry"]))
      p = poly.representative_point()
      anchors.append((poly, offset_at(p.x, p.y), oid))

  def placement(x: float, z: float) -> float:
    p = Point(x, z)
    return min(anchors, key=lambda a: a[0].distance(p))[1]

  gateway = next(g for g in old["groups"] if g["name"] == "Olympic gateway pylons")
  offsets = {
    "surfaces": [
      placement(s["triangles"][0][0][0], s["triangles"][0][0][2])
      for s in gateway["surfaces"]
    ],
    "native": [placement(r[0], r[2]) for r in gateway["native"]],
  }
  payload = {"schemaVersion": 1, "groups": groups, "gatewayOffsets": offsets}
  path = DATA / "olympicGroundsV201.json"
  # Exact owner-floor cutouts are a reversible final transition, separate from
  # the measured terrain/datum receipts for all seven original groups.
  masks_path = GEO / "waldbuehne-v201-ground-masks.json"
  if masks_path.exists():
    from clip_olympic_seating_v201 import clip_seating

    payload, seating_audit = clip_seating(payload, json.loads(masks_path.read_bytes()))
    (GEO / "olympic-seating-v201-audit.json").write_bytes(encode(seating_audit))
  path.write_bytes(encode(payload))
  evidence = {
    "schemaVersion": 1,
    "baseRelease": "v1.0.100",
    "sourceSha256": hashlib.sha256(original.read_bytes()).hexdigest(),
    "resultSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    "groups": audit,
    "gatewaySources": [{"sourceId": a[2], "offsetY": a[1]} for a in anchors],
    "rigidDatumOffsets": OLYMPIC_OFFSETS,
    "flatPools": [{"ring": list(p.exterior.coords), "waterY": y} for p, y in pools],
    "poolPolicy": "Six retained water polygons remain level, estimated at the maximum sampled rim rather than sloping down to the DGM pool bottom. No plan/colour/detail changed.",
    "pitchCorrection": {
      "oldPitchY": OLD_PITCH,
      "oldRimY": OLD_RIM,
      "newPitchY": PITCH,
      "newRimY": RIM,
      "policy": "The old pitch used the minimum LoD2 ground sheet rather than the DGM playing surface. Remap authored below-plaza arena/rows monotonically; above-plaza measured source sheets are rigidly shifted only.",
    },
    "policy": "Full old arrays stay immutable; all original XZ, source triangles/colours, line courses and independent native boxes retained. Only exact terrain subdivisions and declared vertical datum corrections.",
  }
  (GEO / "olympic-landmarks-v201.json").write_bytes(encode(evidence))
  return evidence


if __name__ == "__main__":
  print(json.dumps(build()["groups"], indent=2)[:1200])
