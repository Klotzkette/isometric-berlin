"""Finite, additive university joinery; retained survey and old models stay intact.

Faces above a lower podium need height-aware exposure: V322's conservative 2D
union intentionally left them blank. This extracts only the two named families,
subtracts every neighbouring leaf's conservative vertical envelope, and keeps
the existing independently compiled cardinal fronts for Native fittings.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np
from build_federal_ministries_v321 import shifted_source
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
INPUTS = [
  DATA / "universitiesArchitectureV322.json",
  DATA / "tuWaterV168Source.json",
  GEO / "universities-v322-source.json.gz",
  GEO / "universities-v322-model-audit.json",
]


def compact_face(f):
  return {
    k: f[k]
    for k in ("owner", "parent", "a", "d", "n", "range", "polygon", "holes", "voids")
    if k in f
  }


def individual_faces(part):
  """Actual wall's own vertical datum, including lower Adlershof wings."""
  footprint = Polygon(part["ring"], part["holes"])
  for surface in part["surfaces"]:
    if surface["kind"] != "WallSurface":
      continue
    ring = np.array(surface["rings"][0])
    normal = np.cross(ring[1] - ring[0], ring[2] - ring[0])
    length = np.linalg.norm(normal)
    if length < 0.001 or abs(normal[1] / length) > 0.03:
      continue
    aa, bb = max(
      ((a, b) for a in ring for b in ring),
      key=lambda ab: np.linalg.norm((ab[1] - ab[0])[[0, 2]]),
    )
    a = aa[[0, 2]]
    d = (bb - aa)[[0, 2]]
    width = np.linalg.norm(d)
    if width < 6:
      continue
    d /= width
    n = normal[[0, 2]] / length
    if footprint.covers(Point(*(a + d * width / 2 + n * 0.3))):
      n *= -1
    rings = [
      [[float((np.array(p)[[0, 2]] - a) @ d), p[1]] for p in r]
      for r in surface["rings"]
    ]
    poly = Polygon(rings[0], rings[1:]).buffer(0)
    lo, bottom, hi, top = poly.bounds
    if top - bottom < 2.2:
      continue
    yield dict(
      owner=part["id"],
      parent=part["parentId"],
      a=a.round(3).tolist(),
      d=d.round(9).tolist(),
      n=n.round(9).tolist(),
      range=[
        round(lo + 0.2, 3),
        round(hi - 0.2, 3),
        round(bottom + 0.25, 3),
        round(top - 0.3, 3),
      ],
      polygon=rings[0],
      holes=rings[1:],
      voids=[],
    )


def visible_faces(parts):
  out = []
  for part in parts:
    for face in individual_faces(part):
      a, d, n = map(np.array, (face["a"], face["d"], face["n"]))
      lo, hi, bottom, top = face["range"]
      line = LineString([a + d * lo + n * 0.30, a + d * hi + n * 0.30])
      voids = []
      for other in parts:
        if other["id"] == part["id"]:
          continue
        hit = line.intersection(Polygon(other["ring"], other["holes"]).buffer(0.015))
        if hit.is_empty:
          continue
        pieces = list(hit.geoms) if hasattr(hit, "geoms") else [hit]
        for piece in pieces:
          if piece.geom_type != "LineString" or piece.length < 0.01:
            continue
          uu = [(np.array(p) - a) @ d for p in piece.coords]
          voids.append(
            [
              round(float(min(uu)), 4),
              round(float(max(uu)), 4),
              other["ground_y_m"],
              other["top_y_m"],
            ]
          )
      face["voids"] = voids
      available = Polygon(face["polygon"], face["holes"]).intersection(
        box(lo, bottom, hi, top)
      )
      if voids:
        available = available.difference(
          unary_union([box(v[0], v[2], v[1], v[3]) for v in voids])
        )
      if available.area > 8:
        out.append(compact_face(face))
  return out


def native_near(faces, targets):
  """Keep actual independent cardinal faces, never rotate/voxelise Drawn detail."""
  selected = []
  for face in faces:
    lo, hi, bottom, top = face["range"]
    a, d = np.array(face["a"]), np.array(face["d"])
    center = a + d * (lo + hi) / 2
    for target in targets:
      ta, td = np.array(target["a"]), np.array(target["d"])
      tl, th, tb, tt = target["range"]
      line = LineString([ta + td * tl, ta + td * th])
      if (
        line.distance(Point(center)) < 2.9
        and min(top, tt) - max(bottom, tb) > 2
        and np.dot(face["n"], target["n"]) > 0.45
      ):
        selected.append(
          {**compact_face(face), **({"vine": True} if target.get("vine") else {})}
        )
        break
  return selected


def tu_faces(source):
  part = next(p for p in source["sourceParts"] if p["id"] == "DEBE3DrjkRIowu3J")
  footprint = unary_union([Polygon(q["ring"], q["holes"]) for q in part["polygons"]])
  out = []
  for s in source["surfaces"]:
    if s.get("partId") != part["id"] or s["kind"] != "WallSurface":
      continue
    ring = s["rings"][0]
    aa, bb = max(
      ((a, b) for a in ring for b in ring),
      key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
    )
    a = np.array([aa[0], aa[2]])
    d = np.array([bb[0] - aa[0], bb[2] - aa[2]])
    width = np.linalg.norm(d)
    if width < 30:
      continue
    d /= width
    n = np.array([-d[1], d[0]])
    if footprint.covers(Point(*(a + d * width / 2 + n * 0.3))):
      n *= -1
    rings = [[[(np.array([p[0], p[2]]) - a) @ d, p[1]] for p in r] for r in s["rings"]]
    poly = Polygon(rings[0], rings[1:])
    lo, bottom, hi, top = poly.bounds
    out.append(
      dict(
        owner=part["id"],
        parent=part["parentId"],
        a=a.tolist(),
        d=d.tolist(),
        n=n.tolist(),
        range=[lo + 0.2, hi - 0.2, bottom + 0.25, top - 0.3],
        polygon=rings[0],
        holes=rings[1:],
        voids=[],
      )
    )
  # Native source is the independently compiled one-metre skin from V168.
  cells = set()
  for x, y, z, w, h, depth, _ in source["nativeRows"]:
    if not (-3124 < x < -2943 and 658 < z < 695 and 5 < y < 52):
      continue
    for ix in range(round(x - w / 2), round(x + w / 2)):
      for iz in range(round(z - depth / 2), round(z + depth / 2)):
        cells.add((ix, round(y - 5.2 - 0.5), iz))
  sheets = defaultdict(list)
  for x, y, z in cells:
    for axis, sign in ((0, -1), (0, 1), (2, -1), (2, 1)):
      q = (x + sign, y, z) if axis == 0 else (x, y, z + sign)
      if q not in cells:
        fixed = (x if axis == 0 else z) + (1 if sign > 0 else 0)
        u = z if axis == 0 else x
        sheets[axis, sign, fixed].append(box(u, 5.2 + y, u + 1, 6.2 + y))
  native = []
  for (axis, sign, fixed), rects in sorted(sheets.items()):
    poly = unary_union(rects)
    for p in list(poly.geoms) if hasattr(poly, "geoms") else [poly]:
      if p.area < 8:
        continue
      lo, bottom, hi, top = p.bounds
      native.append(
        dict(
          owner="independent-tu-v168-skin",
          a=[fixed, 0] if axis == 0 else [0, fixed],
          d=[0, 1] if axis == 0 else [1, 0],
          n=[sign, 0] if axis == 0 else [0, sign],
          range=[lo + 0.1, hi - 0.1, bottom + 0.1, top - 0.1],
          polygon=list(map(list, p.exterior.coords))[:-1],
          holes=[list(map(list, h.coords))[:-1] for h in p.interiors],
          voids=[],
        )
      )
  return out, native_near(native, out)


def main():
  old = json.loads(INPUTS[0].read_text())
  source = json.load(gzip.open(INPUTS[2], "rt"))["sites"]
  audit = json.loads(INPUTS[3].read_text())["sites"]
  profiles = []
  for key, parent, kind in (
    ("bht-wedding", "DEBE01YYK0003tI7", "grashof"),
    ("hu-adlershof", "DEBE09YYO0000JKS", "physics"),
  ):
    site = next(s for s in old["sites"] if s["key"] == key)
    family = next(f for f in source[key]["families"] if f["id"] == parent)
    delta = next(
      d["rigidYOffsetM"]
      for d in next(a for a in audit if a["site"] == key)["datums"]
      if d["parent"] == parent
    )
    parts = [{**shifted_source(p, delta), "parentId": parent} for p in family["parts"]]
    faces = visible_faces(parts)
    # Only genuinely missing Drawn faces; old grids remain untouched.
    faces = [
      f
      for f in faces
      if not any(
        f["owner"] == o["owner"] and f["a"] == o["a"] and f["d"] == o["d"]
        for o in site["faces"]
      )
    ]
    if kind == "physics":
      for f in faces:
        if f["n"][0] > 0.35 and f["n"][1] > 0.35:
          f["vine"] = True
    # The physics photographs show the long south-east vine screen. Other
    # elevations receive ribbed glazing only, never an invented green wall.
    profiles.append(
      dict(
        key=key,
        kind=kind,
        parents=[parent],
        faces=faces,
        nativeFaces=native_near(site["nativeFaces"], faces),
        pitch=site["pitch"],
        storey=site["storey"],
        ratio=site["ratio"],
        newDrawnGlazing=True,
      )
    )
  for key, kind, indices in (
    ("hwr-schoeneberg", "hwr-stone", [1, 2, 4, 17, 26, 32, 33, 41, 43]),
    ("fu-henry-ford", "ford-pilasters", [0, 4, 11, 12]),
  ):
    site = next(s for s in old["sites"] if s["key"] == key)
    faces = [compact_face(site["faces"][i]) for i in indices]
    profiles.append(
      dict(
        key=key,
        kind=kind,
        parents=sorted(set(f["parent"] for f in faces)),
        faces=faces,
        nativeFaces=native_near(site["nativeFaces"], faces),
        pitch=site["pitch"],
        storey=site["storey"],
        ratio=site["ratio"],
        newDrawnGlazing=False,
      )
    )
  drawn, native = tu_faces(json.loads(INPUTS[1].read_text()))
  profiles.append(
    dict(
      key="tu-main",
      kind="tu-aluminium",
      parents=["DEBE04YY500006Rw"],
      faces=drawn,
      nativeFaces=native,
      pitch=2.65,
      storey=4.35,
      ratio=0.72,
      newDrawnGlazing=False,
    )
  )
  data = dict(schemaVersion=1, universitiesSourceControl=1141110182, profiles=profiles)
  path = DATA / "universityRefinementV347.json"
  path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n")
  evidence = dict(
    schemaVersion=1,
    inputs=[
      dict(
        path=str(p.relative_to(ROOT)), sha256=hashlib.sha256(p.read_bytes()).hexdigest()
      )
      for p in INPUTS
    ],
    retainedGeometry="No source, prior facade, owner, roof, navigation or campus footprint is replaced",
    calibration="Small fitting positions, dimensions and colours are reference-guided display estimates, not a photogrammetric survey",
    physicsHeightLimitation="The retained raw GML family DEBE09YYO0000JKS gives main leaf DEBE3DNx5J2uyOEc only 3m. All four direct leaves are complete; no ancestor surface is missing. Official photographs show more upper glazing. This pass does not stretch or replace that source roof and must not be described as a corrected complete-height physics reconstruction.",
    sites=[
      dict(
        key=p["key"],
        kind=p["kind"],
        parents=p["parents"],
        drawnFaces=len(p["faces"]),
        nativeFaces=len(p["nativeFaces"]),
      )
      for p in profiles
    ],
    currentAudit=dict(
      huMain="Retain full V168 palace, 95 original boundaries and existing ornament; no demonstrated missing envelope",
      fuMain="Retain V187 Rost-/Silberlaube and library and V322 Holzlaube complete families",
      huSecondary="Retain V266 Campus Nord and V322 Grimm/Hegelplatz",
      hwrLichtenberg="Retain all existing source buildings and glass links; no guessed replacement",
      tuMain="Retain all 24 TU/VWS source parts, Audimax and original courtyards; no interior/access change",
    ),
  )
  (GEO / "university-refinement-v347-evidence.json").write_text(
    json.dumps(evidence, ensure_ascii=False, indent=2) + "\n"
  )
  print(json.dumps(dict(bytes=path.stat().st_size, sites=evidence["sites"]), indent=2))


if __name__ == "__main__":
  main()
