"""Actual rendered approach bottoms must overlap their exact retained support.

Checks every bottom triangle at its centre and three inset corners against new
contact meshes, paired underdeck floors, exact source outside fragments, and
unretired original city ground. No abstract profile can substitute for a mesh.
"""

from __future__ import annotations

import argparse
import base64
import json
from pathlib import Path

import numpy as np
import shapely
from build_rail_sse_v307 import DATA, ROOT, read_v307
from shapely.geometry import Point
from shapely.strtree import STRtree


def triangles_v307(model):
  p = np.frombuffer(base64.b64decode(model["positions"]), "<u2").reshape(-1, 3)
  p = p.astype(float) / 100 + model["origin"]
  ix = np.frombuffer(base64.b64decode(model["indices"]), "<u4").reshape(-1, 3)
  return p[ix]


def heights_v307(triangles, x, z):
  if not len(triangles):
    return []
  a, b, c = triangles[:, 0], triangles[:, 1], triangles[:, 2]
  d = (b[:, 2] - c[:, 2]) * (a[:, 0] - c[:, 0]) + (c[:, 0] - b[:, 0]) * (
    a[:, 2] - c[:, 2]
  )
  ok = abs(d) > 1e-7
  a, b, c, d = a[ok], b[ok], c[ok], d[ok]
  u = ((b[:, 2] - c[:, 2]) * (x - c[:, 0]) + (c[:, 0] - b[:, 0]) * (z - c[:, 2])) / d
  v = ((c[:, 2] - a[:, 2]) * (x - c[:, 0]) + (a[:, 0] - c[:, 0]) * (z - c[:, 2])) / d
  ok = np.minimum(np.minimum(u, v), 1 - u - v) >= -1e-6
  return (u * a[:, 1] + v * b[:, 1] + (1 - u - v) * c[:, 1])[ok]


def audit_approach_contacts_v307():
  pavement = read_v307(DATA / "railBridgeApproachV307Pavement.json")
  ground = read_v307(DATA / "railBridgeApproachV307Ground.json")
  lower = read_v307(DATA / "railBridgeUnderdeckApproachV309.json")
  plans = read_v307(DATA / "railTerrainContactApproachV309Packets.json")
  contacts = {r["key"]: r for r in pavement["contacts"]}
  outside, legacy = [], []
  for key, plan in plans["packets"].items():
    mode, tile = key.split(":")
    if tile not in {"3_-7", "3_-6"}:
      continue
    if plan.get("append"):
      outside.append(
        dict(**plan["append"], origin=plan["origin"], native=mode == "minecraft")
      )
    packet = read_v307(
      ROOT / "src/app/public/mesh/surrounding-berlin-v159" / f"{tile}.{mode}.json.gz"
    )
    retired = {r["mesh"]: set(r["triangles"]) for r in plan["retire"]}
    for mesh, part in enumerate(packet["meshes"]):
      if part["kind"] != "city":
        continue
      ts = triangles_v307(dict(**part, origin=packet["origin"]))
      eligible = (ts[:, :, 1].min(1) >= 2.99) & (ts[:, :, 1].max(1) <= 3.19)
      for ordinal in retired.get(mesh, []):
        if ordinal < len(eligible):
          eligible[ordinal] = False
      legacy.append((mode == "minecraft", ts[eligible]))
  results = []
  for native in [False, True]:
    arrays = [
      triangles_v307(q)
      for q in ground["meshes"] + lower["models"] + outside
      if q["native"] == native
    ]
    arrays += [ts for mode, ts in legacy if mode == native]
    ts = np.concatenate(arrays)
    area = abs(np.cross(ts[:, 1] - ts[:, 0], ts[:, 2] - ts[:, 0])[:, 1])
    ts = ts[area > 1e-6]
    tree = STRtree(shapely.polygons(ts[:, :, [0, 2]]))
    maximum, worst, sampled, missing = -1e9, None, 0, []
    for model in pavement["models"]:
      if model["native"] != native:
        continue
      faces = triangles_v307(model)
      bottoms = sorted(
        {i for row in contacts[model["key"]]["volumes"] for i in row[1:]}
      )
      for ordinal in bottoms:
        triangle = faces[ordinal]
        centre = triangle.mean(0)
        for point in [centre, *[v * 0.999 + centre * 0.001 for v in triangle]]:
          x, y, z = point
          heights = heights_v307(ts[tree.query(Point(x, z))], x, z)
          if not len(heights):
            missing.append([model["key"], ordinal, float(x), float(z)])
            continue
          gap = float(y - max(heights))
          sampled += 1
          if gap > maximum:
            maximum = gap
            worst = [
              model["key"],
              ordinal,
              float(x),
              float(z),
              float(y),
              float(max(heights)),
            ]
    results.append(
      dict(
        native=native,
        samples=sampled,
        maxGap=maximum,
        worst=worst,
        missingCount=len(missing),
        missingExamples=missing[:4],
      )
    )
  return results


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--out", type=Path)
  args = parser.parse_args()
  result = audit_approach_contacts_v307()
  text = json.dumps(result, indent=2) + "\n"
  if args.out:
    args.out.write_text(text)
  print(text)
  if any(r["missingCount"] or r["maxGap"] > -0.02 for r in result):
    raise SystemExit("An actual approach body lacks a continuous source support")
