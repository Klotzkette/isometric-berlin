"""Step 10: bounded measured central-site shells and facade interpretation.

Retain every previous source and packet. Only previously unrendered reference
LoD2 parents receive complete sheets; already rendered parents get relief only.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from build_breitscheid_towers_v161 import normal_of, triangles_for
from build_linden_corridor_v197 import footprint, merge_native_runs
from build_zionskirche_v174 import native_blocks
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
PROFILE = ROOT / "geo_data/regierungsviertel/central-sites-v200-source.json"
SOURCES = [
  ROOT / f"geo_data/regierungsviertel/alt-mitte-v169/source-{t}-00.json.gz"
  for t in ["390_5819", "390_5820", "391_5820"]
]
HU_SOURCE = ROOT / "src/app/src/bebelplatzBuildingSource.json"


def digest(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def load_records() -> list[dict]:
  return [
    r for p in SOURCES for r in json.loads(gzip.decompress(p.read_bytes()))["buildings"]
  ]


def polygons(geometry: BaseGeometry) -> list[Polygon]:
  return [
    p
    for p in getattr(geometry, "geoms", [geometry])
    if p.geom_type == "Polygon" and not p.is_empty
  ]


def shell_blocks(surfaces: list[dict]) -> list[list]:
  """One-metre surface cells, never courtyard or hidden interior solid fill."""
  cells = {}
  for s in surfaces:
    for t in s["triangles"]:
      a, b, c = np.asarray(t)
      steps = max(
        1,
        math.ceil(
          max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b))
          / 0.58
        ),
      )
      for i in range(steps + 1):
        for j in range(steps + 1 - i):
          p = a + (b - a) * i / steps + (c - a) * j / steps
          key = tuple(math.floor(float(v)) for v in p)
          cells[key] = (s["color"], s["role"])
  # Exact cube-union coalescing: first vertical, then horizontal equal material.
  columns = {}
  for (x, y, z), (color, role) in cells.items():
    columns.setdefault((x, z, color, role), []).append(y)
  result = []
  for (x, z, color, role), ys in sorted(columns.items()):
    ys.sort()
    lo = hi = ys[0]
    for y in [*ys[1:], None]:
      if y is not None and y == hi + 1:
        hi = y
        continue
      result.append(
        [x + 0.5, (lo + hi + 1) / 2, z + 0.5, color, 1, role, hi - lo + 1, 1]
      )
      lo = hi = y
  return merge_native_runs(result)


def make_payloads() -> tuple[dict, dict, dict]:
  profile = json.loads(PROFILE.read_text())
  records = load_records()
  by_id = {r["id"]: r for r in records}
  styles = {s["parentId"]: s for s in profile["buildings"]}
  hu = json.loads(HU_SOURCE.read_text())
  # Reuse the exact already displayed HU sheets/datum, not a second survey epoch.
  hu_record = dict(by_id["DEBE01YYK0000Cm9"])
  hu_record["parts"] = hu["profiles"]["humboldt"]["parts"]
  hu_record["groundY"] = 5.2
  by_id[hu_record["id"]] = hu_record
  occupied = [footprint(r).buffer(-0.08) for r in records]
  tree = STRtree(occupied)
  heckmann = shape(profile["heckmannSite"]["geometry"])
  hu_garden = Polygon(profile["huGardenSelection"])
  owners, surfaces, boxes, blocks, audits, shell_audit, nav = [], [], [], [], [], [], []

  for owner_id, style in styles.items():
    r = by_id[owner_id]
    fp = footprint(r)
    oi = len(owners)
    owners.append(
      dict(
        id=owner_id,
        site=style["site"],
        anchor=[fp.centroid.x, fp.centroid.y],
        groundY=r["groundY"],
        groundNHN=r["groundNHN"],
        osmContext=r["osmContext"],
        category=r["category"],
      )
    )
    new_shell = r["category"] == "retained" and style["site"] != "hu-main"
    source_surfaces = []
    for part in r["parts"]:
      for si, s in enumerate(part["surfaces"]):
        if s["kind"] == "GroundSurface":
          continue
        if new_shell:
          tris = triangles_for(s["rings"])
          color = style["roof"] if s["kind"] == "RoofSurface" else style["paint"]
          row = dict(
            triangles=tris,
            color=color,
            role=0,
            normal=[0, 0],
            owner=oi,
            sourcePolygonId=s.get("sourcePolygonId", f"{part['id']}-{si}"),
          )
          surfaces.append(row)
          source_surfaces.append(row)
    if new_shell:
      blocks.extend(row + [oi] for row in shell_blocks(source_surfaces))
      shell_audit.append(
        dict(
          parentId=owner_id,
          originalCategory=r["category"],
          sourcePolygons=[s["sourcePolygonId"] for s in source_surfaces],
          sourceRecordSha256=hashlib.sha256(
            json.dumps(r, sort_keys=True).encode()
          ).hexdigest(),
          legacyPrismsRetained=r.get("ownershipBinding", {}).get("legacyPrismIds", []),
        )
      )
      # Complete source footprint with original holes; no courtyard closure.
      roof_triangles = [
        t
        for part in r["parts"]
        for s in part["surfaces"]
        if s["kind"] == "RoofSurface"
        for t in triangles_for(s["rings"])
      ]
      nav.append(
        dict(
          id=owner_id,
          groundY=r["groundY"],
          anchor=owners[-1]["anchor"],
          polygons=r["footprintPolygons"],
          legacyPrismIds=r.get("ownershipBinding", {}).get("legacyPrismIds", []),
          roofTriangles=roof_triangles,
        )
      )

    for part in r["parts"]:
      for si, s in enumerate(part["surfaces"]):
        if s["kind"] != "WallSurface":
          continue
        ring = np.asarray(s["rings"][0])
        n3 = np.asarray(normal_of(ring.tolist()))
        if abs(n3[1]) > 0.01 or min(ring[:, 1]) > r["groundY"] + 0.3:
          continue
        a, b = max(
          ((p, q) for p in ring for q in ring),
          key=lambda pq: np.linalg.norm((pq[0] - pq[1])[[0, 2]]),
        )
        a, b, n = a[[0, 2]], b[[0, 2]], n3[[0, 2]]
        length = float(np.linalg.norm(b - a))
        if length < 2.6:
          continue
        if fp.contains(Point(*((a + b) / 2 + n * 0.3))):
          n = -n
        d = (b - a) / length
        if d[0] * n[1] - d[1] * n[0] < 0:
          a, b, d = b, a, -d
        ground = max(r["groundY"], float(min(ring[:, 1])))
        eave = min(float(p[1]) for p in ring if p[1] > ground + 1)
        if eave - ground < 3.4:
          continue
        wall = Polygon(
          [[(np.asarray([p[0], p[2]]) - a) @ d, p[1]] for p in s["rings"][0]],
          [
            [[(np.asarray([p[0], p[2]]) - a) @ d, p[1]] for p in h]
            for h in s["rings"][1:]
          ],
        ).buffer(0)
        wall = wall.intersection(box(0, ground, length, eave - 0.12))

        def clear(u: float) -> bool:
          p = a + d * u
          sight = LineString([p + n * 0.32, p + n * 2.8])
          if any(
            sight.intersection(occupied[i]).length > 0.03 for i in tree.query(sight)
          ):
            return False
          if style["selection"] == "hu-garden":
            return hu_garden.buffer(0.3).contains(Point(*(p + n * 3)))
          if style["selection"] == "heckmann":
            # Court-facing planes or the two actual street entrance houses.
            return (
              heckmann.contains(Point(*(p + n * 2)))
              or (owner_id.endswith("0BdM") and n[1] > 0.65)
              or (owner_id.endswith("05n7") and n[1] < -0.65)
            )
          return True

        count = max(1, math.ceil(length / 0.35))
        intervals = []
        for i in range(count):
          lo, hi = length * i / count, length * (i + 1) / count
          if not all(clear(u) for u in [lo + 0.02, (lo + hi) / 2, hi - 0.02]):
            continue
          if intervals and abs(intervals[-1][1] - lo) < 1e-6:
            intervals[-1][1] = hi
          else:
            intervals.append([lo, hi])
        if not intervals:
          continue
        wall = wall.intersection(
          unary_union(
            [
              box(lo + 0.02, ground, hi - 0.02, eave)
              for lo, hi in intervals
              if hi - lo > 0.04
            ]
          )
        )
        if wall.area < 6:
          continue
        fi = len(audits)
        first_box, first_surface, first_block = len(boxes), len(surfaces), len(blocks)
        facade = dict(surfaces=[], facadeBoxes=[], detailRods=[])
        kind = style["style"]

        def point(u: float, y: float, out: float) -> list[float]:
          p = a + d * u + n * out
          return [round(float(p[0]), 5), round(float(y), 5), round(float(p[1]), 5)]

        def paint(poly, color: int) -> None:
          for p in polygons(poly):
            tris = triangles_for(
              [[point(u, y, 0.21) for u, y in p.exterior.coords]]
              + [[point(u, y, 0.21) for u, y in h.coords] for h in p.interiors]
            )
            facade["surfaces"].append(
              dict(triangles=tris, color=color, role=1, normal=n.tolist())
            )

        def member(
          u: float,
          y: float,
          w: float,
          h: float,
          color: int,
          out: float = 0.34,
          depth: float = 0.12,
          role: int = 2,
        ) -> None:
          for p in polygons(
            wall.intersection(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2))
          ):
            lo, low, hi, high = p.bounds
            if (
              hi - lo < 0.025
              or high - low < 0.025
              or not wall.buffer(0.0005).covers(box(lo, low, hi, high))
            ):
              continue
            facade["facadeBoxes"].append(
              point((lo + hi) / 2, (low + high) / 2, out)
              + [
                round(hi - lo, 5),
                round(high - low, 5),
                depth,
                round(-math.atan2(d[1], d[0]), 9),
                color,
                role,
                *n.tolist(),
              ]
            )

        base_top = ground + min(3.5, (eave - ground) * 0.28)
        paint(wall, style["paint"])
        base_color = 0xB19B7E if kind.startswith("barracks") else style["trim"]
        paint(wall.intersection(box(-1, ground, length + 1, base_top)), base_color)
        levels = max(2, min(style["levelsEstimate"], round((eave - ground) / 3.0)))
        # One site-anchored coordinate pitch aligns fragmented coplanar walls.
        global_u = float(a @ d)
        pitch = style["bayPitchEstimate"]
        columns = [
          i * pitch - global_u
          for i in range(
            math.floor(global_u / pitch) - 1, math.ceil((global_u + length) / pitch) + 1
          )
        ]
        columns = [u for u in columns if -0.9 < u < length + 0.9]
        glass = 0x637B7B if kind != "clinker" else 0x526D70
        window_fields = []
        row_pitch = (eave - base_top - 0.55) / (levels - 1)
        for row in range(levels - 1):
          y = base_top + row_pitch * (row + 0.5)
          h = min(2.25, row_pitch * 0.67)
          w = min(2.12, pitch * (0.64 if kind == "postwar" else 0.48))
          for u in columns:
            member(u, y, w + 0.20, h + 0.2, style["trim"])
            before = len(facade["facadeBoxes"])
            member(u, y, w, h, glass, 0.62, 0.03)
            if len(facade["facadeBoxes"]) > before:
              window_fields.append(
                dict(
                  u=u,
                  row=row,
                  localBoxes=list(range(before, len(facade["facadeBoxes"]))),
                )
              )
            member(u, y, 0.12, h, style["trim"], 0.80, 0.04)
            member(u, y + h * 0.17, w, 0.11, style["trim"], 0.80, 0.04)
            member(u, y - h / 2 - 0.18, w + 0.3, 0.16, style["trim"], 0.40, 0.26, 3)
            if kind in ["clinker", "barracks-east"]:
              member(
                u,
                y + h / 2 + 0.26,
                w + 0.38,
                0.20,
                0xB77A60 if kind == "clinker" else style["trim"],
                0.40,
                0.24,
                3,
              )
          if kind in ["postwar", "august"]:
            member(
              length / 2,
              y - h / 2 - 0.27,
              length - 0.12,
              0.16,
              style["trim"],
              0.38,
              0.22,
              3,
            )
        # Public/commercial ground fields; modeled as shallow frames, no holes
        # cut into the measured source wall and no claimed surveyed doorway.
        for u in columns:
          w = min(2.6, pitch * 0.65)
          h = base_top - ground - 0.55
          member(u, ground + 0.25 + h / 2, w + 0.22, h + 0.16, style["trim"], role=4)
          member(u, ground + 0.25 + h / 2, w, h, glass, 0.62, 0.03, 4)
          member(u, ground + 0.25 + h / 2, 0.12, h, style["trim"], 0.80, 0.04, 4)
          member(u, base_top - 0.75, w, 0.11, style["trim"], 0.80, 0.04, 4)
        for y, h in [(ground + 0.18, 0.15), (base_top, 0.22), (eave - 0.3, 0.26)]:
          member(length / 2, y, length - 0.10, h, style["trim"], 0.38, 0.24, 3)
        if kind == "clinker":
          # Repeated narrow fired-clay piers and layered inserts, documented by LDA.
          for u in columns:
            member(
              u + pitch / 2,
              (base_top + eave) / 2,
              0.36,
              eave - base_top,
              0x96614F,
              0.44,
              0.28,
              3,
            )
            for y in np.arange(base_top + 0.5, eave - 0.35, 0.58):
              member(u + pitch / 2, float(y), 0.47, 0.12, 0xB98364, 0.62, 0.10, 3)
        elif kind == "august":
          member(
            length / 2,
            base_top + row_pitch * 1.88,
            length - 0.12,
            0.30,
            0xB77859,
            0.39,
            0.19,
            3,
          )
        elif kind.startswith("barracks"):
          # Brick/sandstone courses, bounded by the measured risalits; no invented
          # gables, towers or copy of the east tower on the simplified west half.
          for y in np.arange(ground + 0.65, base_top - 0.3, 0.65):
            member(length / 2, float(y), length - 0.1, 0.065, 0xA68E72, 0.25, 0.035, 3)
          for u in [0.30, length - 0.30]:
            for y in np.arange(base_top + 0.3, eave - 0.5, 0.85):
              member(u, float(y), 0.42, 0.32, style["trim"], 0.41, 0.18, 3)
        elif kind == "palace-court":
          member(
            length / 2, eave - 0.75, length - 0.1, 0.19, style["trim"], 0.41, 0.28, 3
          )
        surfaces.extend({**q, "owner": oi, "face": fi} for q in facade["surfaces"])
        boxes.extend(q + [oi] for q in facade["facadeBoxes"])
        normalised = []
        for q in facade["facadeBoxes"]:
          q = q[:]
          offset = float((np.asarray([q[0], q[2]]) - a) @ n)
          q[0] -= n[0] * (offset - 0.40)
          q[2] -= n[1] * (offset - 0.40)
          normalised.append(q)
        native = {**facade, "facadeBoxes": normalised}
        blocks.extend(q + [oi] for q in merge_native_runs(native_blocks(native)))
        audits.append(
          dict(
            parentId=owner_id,
            owner=oi,
            sourcePolygonId=s.get("sourcePolygonId", f"{part['id']}-{si}"),
            rings=s["rings"],
            a=a.tolist(),
            b=b.tolist(),
            normal=n.tolist(),
            length=length,
            ground=ground,
            eave=eave,
            clearIntervals=intervals,
            style=kind,
            levelsEstimate=levels,
            windowFields=[
              {**field, "boxes": [first_box + i for i in field["localBoxes"]]}
              for field in window_fields
            ],
            firstBox=first_box,
            boxCount=len(boxes) - first_box,
            firstSurface=first_surface,
            surfaceCount=len(surfaces) - first_surface,
            firstBlock=first_block,
            blockCount=len(blocks) - first_block,
          )
        )

  # Sparse paving joints remain wholly inside the existing exact plaza sheet.
  # They are display estimates, not surveyed paving courses, and stay outside
  # both the library roof patch and the glass inset.
  plaza = (
    Polygon(hu["plaza_source"]["ring"])
    .buffer(-0.6)
    .difference(box(1511, 295, 1525, 305))
  )
  oi = len(owners)
  owners.append(
    dict(
      id="OSM-way-205728152",
      site="bebelplatz",
      anchor=[1518.9904098202, 299.9489484141],
      groundY=5.2,
      groundNHN=None,
      category="existing-plaza",
      osmContext={},
    )
  )
  ground_rows = []
  for z in np.arange(220, 353, 8):
    # Existing memorial plaza is at sampled ground + .08; these are .025 above it.
    for p in polygons(plaza.intersection(box(1430, z - 0.055, 1620, z + 0.055))):
      tris = triangles_for([[[x, 5.305, y] for x, y in p.exterior.coords]])
      ground_rows.append(
        dict(triangles=tris, color=0xABA89D, role=6, owner=oi, normal=[0, 0])
      )
  surfaces.extend(ground_rows)
  # Same fine joints in native mode: orthogonal strips; not large floating blocks.
  first_plaza_block = len(blocks)
  for s in ground_rows:
    for t in s["triangles"]:
      xz = Polygon([(p[0], p[2]) for p in t])
      lo, zn, hi, zs = xz.bounds
      for x in np.arange(math.ceil(lo * 2) / 2, hi, 0.5):
        if xz.covers(Point(x + 0.25, (zn + zs) / 2)):
          blocks.append(
            [
              round(float(x + 0.25), 5),
              5.30,
              (zn + zs) / 2,
              0xABA89D,
              0.5,
              6,
              0.06,
              zs - zn,
              oi,
            ]
          )
  blocks[first_plaza_block:] = [
    r + [oi] for r in merge_native_runs([r[:8] for r in blocks[first_plaza_block:]])
  ]
  data = dict(
    schemaVersion=1, owners=owners, surfaces=surfaces, boxes=boxes, blocks=blocks
  )
  evidence = dict(
    schemaVersion=1,
    sourceSha256={str(p.relative_to(ROOT)): digest(p) for p in [*SOURCES, HU_SOURCE]},
    profileSha256=digest(PROFILE),
    interpretation=profile["interpretation"],
    primarySources=profile["primarySources"],
    sourceShells=shell_audit,
    selectedFaces=audits,
    plazaExclusion=[1511, 295, 1525, 305],
    counts=dict(
      owners=len(owners),
      newSourceShells=len(shell_audit),
      faces=len(audits),
      drawnTriangles=sum(len(s["triangles"]) for s in surfaces),
      drawnBoxes=len(boxes),
      nativeRuns=len(blocks),
    ),
  )
  return (
    data,
    evidence,
    dict(schemaVersion=1, buildings=nav, newCourtWalls=False, newPassageClosures=False),
  )


if __name__ == "__main__":
  data, evidence, navigation = make_payloads()
  for suffix, payload in [
    ("", data),
    ("Evidence", evidence),
    ("Navigation", navigation),
  ]:
    path = DATA / f"centralSitesV200{suffix}.json"
    path.write_text(
      json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
    )
    print(path.name, path.stat().st_size)
  print(evidence["counts"])
