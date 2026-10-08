"""Step 10: complete the directly square-facing retained LoD2 facade inventory."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from build_breitscheid_towers_v161 import normal_of, triangles_for
from build_zionskirche_v174 import native_blocks
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import nearest_points, unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
SOURCE = ROOT / "geo_data/regierungsviertel/alt-mitte-v169/source-391_5821-00.json.gz"
PROFILE = ROOT / "geo_data/regierungsviertel/zionskirchplatz-v193-source.json"
OLD = DATA / "zionskirchplatzV175Profile.json"


def footprint(record: dict) -> Polygon:
  """Keep complete retained parent footprints and their courtyard holes."""
  return unary_union(
    [Polygon(p["ring"], p["holes"]) for p in record["footprintPolygons"]]
  )


def frontages(records: list[dict], square: Polygon) -> list[dict]:
  """Select only directly exposed square-facing source walls, never rear courts."""
  nearby = [r for r in records if footprint(r).intersects(square.buffer(100))]
  offsets = json.loads((DATA / "weinbergBuildingOffsetsV176.json").read_text())[
    "offsets"
  ]
  obstacles = [
    (
      Polygon(p["ring"], p["holes"]).buffer(-0.06),
      max(part["topY"] for part in r["parts"]) + offsets.get(r["id"], 0),
    )
    for r in nearby
    if r["id"] != "DEBE01YYK0000014"
    for p in r["footprintPolygons"]
    if Polygon(p["ring"], p["holes"]).area > 80
  ]
  result = []
  for r in nearby:
    fp = footprint(r)
    if fp.distance(square) > 27 or fp.area < 100 or r["id"] == "DEBE01YYK0000014":
      continue
    for part in r["parts"]:
      for s in part["surfaces"]:
        if s["kind"] != "WallSurface":
          continue
        ring = np.asarray(s["rings"][0])
        n = np.asarray(normal_of(ring.tolist()))
        if abs(n[1]) > 0.01 or min(ring[:, 1]) > r["groundY"] + 0.11:
          continue
        a, b = max(
          ((a, b) for a in ring for b in ring),
          key=lambda t: np.linalg.norm((t[0] - t[1])[[0, 2]]),
        )
        a, b, n = a[[0, 2]], b[[0, 2]], n[[0, 2]]
        length = float(np.linalg.norm(b - a))
        if length < 1.5:
          continue
        if fp.contains(Point(*((a + b) / 2 + n * 0.3))):
          n = -n
        visible_bases = []
        for t in [0.2, 0.5, 0.8]:
          p = a + (b - a) * t + n * 0.2
          ray = LineString([p, p + n * 42])
          meet = ray.intersection(square)
          if meet.is_empty:
            continue
          target = nearest_points(Point(*p), meet)[1]
          sight = LineString([p, target.coords[0]])
          blocking_top = max(
            (
              top
              for polygon, top in obstacles
              if sight.intersection(polygon).length >= 0.02
            ),
            default=-100,
          )
          visible_bases.append(
            max(r["groundY"], blocking_top - offsets.get(r["id"], 0) + 0.13)
          )
        if len(visible_bases) < 2:
          continue
        visible_from = sorted(visible_bases)[1]
        if max(ring[:, 1]) - visible_from < 2:
          continue
        # Reader-right with the outward normal, so bay/door order is stable.
        d = (b - a) / length
        if d[0] * n[1] - d[1] * n[0] < 0:
          a, b, d = b, a, -d
        result.append(
          dict(
            parentId=r["id"],
            sourcePolygonId=s["sourcePolygonId"],
            a=a.tolist(),
            b=b.tolist(),
            normal=n.tolist(),
            length=length,
            rings=s["rings"],
            visibleFromY=round(visible_from, 3),
          )
        )
  return sorted(result, key=lambda f: (f["parentId"], f["sourcePolygonId"]))


def make_payloads() -> tuple[dict, dict]:
  """Write shallow coloured wall sheets plus restrained architectural members."""
  profile = json.loads(PROFILE.read_text())
  records = json.loads(gzip.decompress(SOURCE.read_bytes()))["buildings"]
  by_id = {r["id"]: r for r in records}
  old = json.loads(OLD.read_text())
  old_faces = {f["sourcePolygonId"] for r in old["buildings"] for f in r["faces"]}
  selected = frontages(records, shape(profile["osmSquare"]["worldGeometry"]))
  owners = []
  for owner_id in sorted({f["parentId"] for f in selected}):
    r = by_id[owner_id]
    fp = footprint(r)
    owners.append(
      dict(
        id=owner_id,
        anchor=[fp.centroid.x, fp.centroid.y],
        groundY=r["groundY"],
        groundNHN=r["groundNHN"],
        osmTags=r["osmTags"],
        sourceSha256=hashlib.sha256(json.dumps(r, sort_keys=True).encode()).hexdigest(),
        roofPolygons=sum(
          s["kind"] == "RoofSurface" for p in r["parts"] for s in p["surfaces"]
        ),
      )
    )
  owner_index = {r["id"]: i for i, r in enumerate(owners)}
  surfaces, boxes, blocks, audit = [], [], [], []
  for f in selected:
    if f["sourcePolygonId"] in old_faces:
      audit.append({**f, "status": "existing-v175-preserved"})
      continue
    oi = owner_index[f["parentId"]]
    style = profile["styles"][f["parentId"]]
    a, b, n = np.array(f["a"]), np.array(f["b"]), np.array(f["normal"])
    length, d = f["length"], (b - a) / f["length"]
    rings = [[[(np.array([p[0], p[2]]) - a) @ d, p[1]] for p in r] for r in f["rings"]]
    complete_wall = Polygon(rings[0], rings[1:]).buffer(0)
    ground, top = complete_wall.bounds[1], complete_wall.bounds[3]
    wall = complete_wall.intersection(
      box(-0.1, f["visibleFromY"], length + 0.1, top + 0.1)
    )
    # Keep the original gable contour; ornament stays below the lowest eave.
    eave = min(p[1] for p in f["rings"][0] if p[1] > ground + 1)
    part = {"surfaces": [], "facadeBoxes": [], "detailRods": []}

    def point(u: float, y: float, out: float) -> list[float]:
      p = a + d * u + n * out
      return [round(float(p[0]), 5), round(float(y), 5), round(float(p[1]), 5)]

    def paint(poly: Polygon, color: int) -> None:
      for q in getattr(poly, "geoms", [poly]):
        if q.is_empty or q.geom_type != "Polygon":
          continue
        triangles = triangles_for(
          [[point(u, y, 0.21) for u, y in q.exterior.coords]]
          + [[point(u, y, 0.21) for u, y in h.coords] for h in q.interiors]
        )
        part["surfaces"].append(
          dict(color=color, role=1, normal=n.tolist(), triangles=triangles)
        )

    def member(
      u: float,
      y: float,
      w: float,
      h: float,
      color: int,
      out: float = 0.31,
      depth: float = 0.08,
      role: int = 2,
    ) -> None:
      if not wall.buffer(0.002).covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)):
        return
      part["facadeBoxes"].append(
        point(u, y, out)
        + [
          round(w, 5),
          round(h, 5),
          depth,
          -math.atan2(d[1], d[0]),
          color,
          role,
          *n.tolist(),
        ]
      )

    base_height = min(eave - ground, 6.3 if f["parentId"].endswith("0C4w") else 3.9)
    base_top = ground + base_height
    paint(wall.intersection(box(-0.1, ground, length + 0.1, base_top)), style["base"])
    paint(
      wall.intersection(box(-0.1, base_top, length + 0.1, top + 0.1)), style["paint"]
    )
    frame, glass = 0xECE9D9, 0x688184
    bays = max(1, round(length / 3.65))
    # Each source bay/return stays distinct; narrow polygon strips get one field.
    levels = max(1, min(6, style["levels"], round((eave - ground) / 3.25)))
    pitch = (eave - base_top - 0.7) / max(1, levels - 1)
    for y, h in [(ground + 0.35, 0.14), (base_top, 0.16), (eave - 0.26, 0.22)]:
      member(length / 2, y, length - 0.10, h, 0xD5D0BD, depth=0.22, role=3)
    for row in range(levels - 1):
      y = base_top + pitch * (row + 0.5)
      h, w = min(2.05, pitch * 0.62), min(1.40, length / bays * 0.43)
      for i in range(bays):
        u = length * (i + 0.5) / bays
        member(u, y, w + 0.20, h + 0.20, frame)
        member(u, y, w, h, glass, out=0.40, depth=0.025)
        member(u, y, 0.08, h, frame, out=0.44, depth=0.025)
        member(u, y + h * 0.15, w, 0.08, frame, out=0.44, depth=0.025)
        member(
          u, y - h / 2 - 0.15, w + 0.30, 0.13, 0xDAD3BD, out=0.42, depth=0.22, role=3
        )
    # Restrained residential doors and divided low windows: no invented tenants.
    for i in range(bays):
      u, door = length * (i + 0.5) / bays, i == bays // 2 and length > 6
      h, w = (2.85, 1.4) if door else (1.8, min(1.40, length / bays * 0.43))
      y = ground + (0.22 if door else 1.1) + h / 2
      member(u, y, w + 0.22, h + 0.18, frame, role=4)
      member(u, y, w, h, 0x52675F if door else glass, out=0.40, depth=0.03, role=4)
      member(u, y, 0.10, h, frame, out=0.44, depth=0.025, role=4)
      member(u, y + h * 0.23, w, 0.10, frame, out=0.44, depth=0.025, role=4)
    start = len(boxes)
    surfaces.extend({**s, "owner": oi} for s in part["surfaces"])
    boxes.extend(r + [oi] for r in part["facadeBoxes"])
    blocks.extend(r + [oi] for r in native_blocks(part))
    audit.append(
      {
        **f,
        "status": "new-v193",
        "owner": oi,
        "eave": eave,
        "baysEstimate": bays,
        "levelsEstimate": levels,
        "firstBox": start,
        "boxCount": len(boxes) - start,
      }
    )
  data = dict(
    schemaVersion=1, owners=owners, surfaces=surfaces, boxes=boxes, blocks=blocks
  )
  evidence = dict(
    schemaVersion=1,
    sourceSha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    profileSha256=hashlib.sha256(PROFILE.read_bytes()).hexdigest(),
    existingV175Sha256=hashlib.sha256(OLD.read_bytes()).hexdigest(),
    squareWayId="50436070",
    selectedFaces=audit,
    retainedOldOwners=[r["parentId"] for r in old["buildings"]],
    coverageOwnerIds=sorted(
      set(owner_index) | {r["parentId"] for r in old["buildings"]}
    ),
    interpretation=profile["interpretation"],
    counts=dict(
      owners=len(owners),
      newFaces=sum(f["status"] == "new-v193" for f in audit),
      drawnTriangles=sum(len(s["triangles"]) for s in surfaces),
      drawnBoxes=len(boxes),
      nativeRuns=len(blocks),
    ),
  )
  return data, evidence


if __name__ == "__main__":
  data, evidence = make_payloads()
  for suffix, value in [("", data), ("Evidence", evidence)]:
    path = DATA / f"zionskirchplatzV193{suffix}.json"
    path.write_text(json.dumps(value, separators=(",", ":")) + "\n")
    print(path.name, path.stat().st_size)
  print(evidence["counts"])
