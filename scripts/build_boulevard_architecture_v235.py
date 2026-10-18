"""Step 10: bounded front-plane articulation for the complete Ku'damm/Tauentzien.

Only existing verified v163/v165 opening fields are refined. Source roofs,
opening axes, nav, heroes, doors and all original encoded packets remain intact.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import shapely
from build_roof_house_v233 import fingerprint, protected_ids
from build_surrounding_outlines import linear_rgb_bytes
from build_west_streets_v163 import facade
from shapely.geometry import Point, Polygon, shape
from shapely.ops import nearest_points, unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
RUNTIME = ROOT / "src/app/src/data/boulevardArchitectureV235.json"
EVIDENCE = GEO / "boulevard-architecture-v235-evidence.json.gz"
GLASS = tuple(linear_rgb_bytes(np.array([62, 82, 87])).tolist())
KINDS = {
  "west-streets-v163": "city-west-street-fronts-v163",
  "tauentzien-v165": "tauentzien-street-fronts-v165",
}


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def source_protection():
  outer = protected_ids() | {
    b["owner"] for b in read(GEO / "roof-house-v233-source.json.gz")["owners"]
  }
  core = set()

  def visit(value):
    if isinstance(value, dict):
      for key, child in value.items():
        if key == "legacyPrisms" and isinstance(child, list):
          core.update(str(p["id"]) for p in child if isinstance(p, dict) and "id" in p)
        elif key == "replacementPrismIds":
          core.update(map(str, child))
        else:
          visit(child)
    elif isinstance(value, list):
      for child in value:
        visit(child)

  for path in list((ROOT / "src/app/src/data").glob("*.json")) + list(
    (ROOT / "src/app/src").glob("*Source.json")
  ):
    if path.name not in {
      "buildingAttributeSource.json",
      "roofHouseV233.json",
      "boulevardArchitectureV235.json",
    }:
      visit(read(path))
  hero = (ROOT / "src/app/src/CityWestDetails.ts").read_text()
  core.update(s[-8:] for s in re.findall(r'"OSM-way-(\d+)"', hero))
  return outer, core


class Capture:
  def __init__(self):
    self.quads = []

  def polygon(self, points, colour, role):
    if role in ("window glazing", "shopfront glazing"):
      self.quads.append((np.array(points), role))


def fields():
  outer, core = source_protection()
  result, audit = [], {}
  for name, kind in KINDS.items():
    source = read(GEO / f"{name}.json")
    core.update(source.get("excludedDetailedOwners", []))
    roads = unary_union([shape(r["geometry"]) for r in source["roads"]])
    main = unary_union(
      [
        shape(r["geometry"])
        for r in source["roads"]
        if r["name"] in ("Kurfürstendamm", "Tauentzienstraße")
      ]
    )
    audit[name] = {
      "sha256": hashlib.sha256((GEO / f"{name}.json").read_bytes()).hexdigest(),
      "roadBounds": list(main.bounds),
      "completeMeasuredOwnersRetained": len(source["buildings"]),
      "coreOwnersRetained": len(source["corePrisms"]),
      "protected": [],
    }
    for b in source["buildings"] + source["corePrisms"]:
      identity = b["id"]
      if identity in outer or identity in core:
        audit[name]["protected"].append(identity)
        continue
      d = Capture()
      if "parts" in b:
        for part in b["parts"]:
          top = max(p[1] for s in part["surfaces"] for ring in s["rings"] for p in ring)
          for surface in part["surfaces"]:
            if surface["kind"] == "WallSurface":
              facade(d, surface["rings"], roads, 3, top)
      else:
        polygon = shapely.orient_polygons(
          Polygon([(x / 10, z / 10) for x, z in b["ring"]]), exterior_cw=True
        )
        low, top = b["y0_dm"] / 10, (b["y0_dm"] + b["h_dm"]) / 10
        for a, z in zip(polygon.exterior.coords, list(polygon.exterior.coords)[1:]):
          facade(
            d,
            [
              [
                (a[0], low, a[1]),
                (z[0], low, z[1]),
                (z[0], top, z[1]),
                (a[0], top, a[1]),
              ]
            ],
            roads,
            low,
            top,
          )
      for points, role in d.quads:
        center = np.mean(points, axis=0)
        normal = np.cross(points[1] - points[0], points[2] - points[0])
        normal /= np.linalg.norm(normal)
        near = nearest_points(Point(center[0], center[2]), main)[1]
        towards = np.array([near.x - center[0], 0, near.y - center[2]])
        if np.linalg.norm(towards) > 48 or np.dot(normal, towards) < 0.1:
          continue
        result.append(
          {
            "owner": identity,
            "kind": kind,
            "points": points.tolist(),
            "normal": normal.tolist(),
            "role": role,
            "section": "Tauentzien"
            if name.startswith("tauentzien")
            else "West-Halensee"
            if center[0] < -4900
            else "Lehniner-Platz"
            if center[0] < -4050
            else "Central-Kudamm"
            if center[0] < -3200
            else "Breitscheidplatz",
          }
        )
  return result, audit


def decode(part, origin):
  points = (
    np.frombuffer(base64.b64decode(part["positions"]), "<u2")
    .reshape(-1, 3)
    .astype(float)
    / 100
    + origin
  )
  colours = np.frombuffer(base64.b64decode(part["colors"]), "u1").reshape(-1, 3)
  triangles = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
  return points, colours, triangles


def key(points):
  return tuple(
    sorted(tuple(int(v) for v in p) for p in np.rint(np.array(points) * 100))
  )


def plan(points, normal, owner, origin):
  points = np.array(points)
  center = np.mean(points, axis=0)
  axis = np.array([-normal[2], 0, normal[0]])
  width = np.ptp(points @ axis)
  height = np.ptp(points[:, 1])
  c = center - origin
  return [
    *[round(float(v), 3) for v in c],
    round(float(axis[0]), 9),
    round(float(axis[2]), 9),
    round(float(normal[0]), 9),
    round(float(normal[2]), 9),
    round(float(width), 3),
    round(float(height), 3),
    0,
  ]


def main():
  candidates, audit = fields()
  grouped = defaultdict(list)
  for field in candidates:
    center = np.mean(field["points"], axis=0)
    grouped[f"{math.floor(center[0] / 512)}_{math.floor(center[2] / 512)}"].append(
      field
    )
  door_data = read(ROOT / "src/app/src/data/houseDoorsV233.json")["chunks"]
  packets, evidence, stats = {}, [], Counter()
  for identity, fields_here in sorted(grouped.items()):
    selected = []
    for mode in ("drawn", "minecraft"):
      path = OUT / f"{identity}.{mode}.json.gz"
      if not path.exists():
        continue
      chunk = read(path)
      origin = np.array(chunk["origin"])
      recipes, guards, records = [], [], []
      for index, part in enumerate(chunk["meshes"]):
        if part["kind"] not in KINDS.values():
          continue
        points, colours, triangles = decode(part, origin)
        glass = [t for t in triangles if all(tuple(colours[i]) == GLASS for i in t)]
        if mode == "drawn":
          keys = {key(points[t]) for t in glass}
          for field in fields_here:
            if field["kind"] != part["kind"]:
              continue
            p = np.array(field["points"])
            if key(p[[0, 1, 2]]) not in keys or key(p[[0, 2, 3]]) not in keys:
              stats["unmatchedDrawnFields"] += 1
              continue
            # Existing real mapped entry decorations retain their complete opening.
            doors = door_data.get(identity, {}).get(mode, {}).get("doors", [])
            center = np.mean(p, axis=0)
            if field["role"] == "shopfront glazing" and any(
              math.hypot(center[0] - (d[0] + origin[0]), center[2] - (d[2] + origin[2]))
              < 2
              for d in doors
            ):
              stats["protectedDoorFields"] += 1
              continue
            recipes.append(plan(p, field["normal"], field["owner"], origin))
            records.append(field)
            selected.append(field)
        else:
          # Native detail follows real delivered exposed 2m cell faces, never the
          # slanted drawn plane. Pair exactly the two triangles of each square.
          match = [f for f in selected if f["kind"] == part["kind"]]
          if not match:
            continue
          centers = [Point(np.mean(f["points"], axis=0)[[0, 2]]) for f in match]
          tree = STRtree(centers)
          faces = defaultdict(list)
          for t in glass:
            p = points[t]
            n = np.cross(p[1] - p[0], p[2] - p[0])
            length = np.linalg.norm(n)
            if length < 0.01:
              continue
            n /= length
            if abs(n[1]) > 0.001 or np.count_nonzero(np.abs(n) > 0.001) != 1:
              continue
            bounds = tuple(
              np.rint(np.concatenate([p.min(axis=0), p.max(axis=0)]) * 100).astype(int)
            )
            faces[(bounds, tuple(n))].append(p)
          for (bounds, normal), pair in faces.items():
            if len(pair) != 2:
              continue
            p = np.unique(np.vstack(pair), axis=0)
            if len(p) != 4:
              continue
            center = np.mean(p, axis=0)
            choices = tree.query(Point(center[[0, 2]]).buffer(2.5))
            choices = [
              match[i]
              for i in choices
              if abs(np.mean(match[i]["points"], axis=0)[1] - center[1]) < 1.65
              and np.dot(normal, match[i]["normal"]) > 0.55
            ]
            if not choices:
              continue
            field = min(
              choices,
              key=lambda f: np.linalg.norm(np.mean(f["points"], axis=0) - center),
            )
            recipes.append(plan(p, normal, field["owner"], origin))
            records.append(
              {
                "owner": field["owner"],
                "section": field["section"],
                "cellFace": [int(v) for v in bounds],
                "normal": list(normal),
              }
            )
        if recipes:
          guards.append(
            {
              "mesh": index,
              "kind": part["kind"],
              "fingerprint": fingerprint(
                [part["positions"], part["colors"], part["indices"]]
              ),
            }
          )
      if recipes:
        # De-duplicate identical source field positions, independent of owner tags.
        unique = {}
        unique_records = {}
        for recipe, record in zip(recipes, records):
          unique[tuple(recipe[:9])] = recipe
          unique_records[tuple(recipe[:9])] = record
        recipes = list(unique.values())
        records = list(unique_records.values())
        assert len(recipes) <= 2400, (identity, mode, len(recipes))
        packets[f"{mode}:{identity}"] = {
          "origin": chunk["origin"],
          "guards": guards,
          "fields": recipes,
        }
        evidence.append(
          {
            "key": f"{mode}:{identity}",
            "packetSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "fields": records,
          }
        )
        stats[mode] += len(recipes)
        for record in records:
          stats[f"{mode}:{record['section']}"] += 1
  data = {"schema": 1, "ids": sorted(packets), "packets": packets}
  RUNTIME.write_text(json.dumps(data, separators=(",", ":")) + "\n")
  proof = {
    "schema": 1,
    "policy": "Source geometry and existing estimated opening rhythm retained. Only verified street-facing opening fields receive 5cm reveals and muted glass indication; dimensions/colours of profiles and glass are display estimates, not surveyed facade facts. Native faces derive independently from existing orthogonal source cells. No roofs, source triangles, doors, nav or budgets removed or replaced.",
    "sources": audit,
    "statistics": dict(stats),
    "packets": evidence,
    "references": [
      "https://www.schaubuehne.de/de/seiten/architektur.html",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096298",
    ],
  }
  EVIDENCE.write_bytes(
    gzip.compress(json.dumps(proof, separators=(",", ":")).encode(), mtime=0)
  )
  print(
    json.dumps(
      {
        "packets": len(packets),
        "runtimeBytes": RUNTIME.stat().st_size,
        "statistics": dict(stats),
      }
    )
  )


if __name__ == "__main__":
  main()
