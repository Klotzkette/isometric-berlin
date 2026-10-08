"""Source-bound facade presentation for the Pariser Platz–Friedrichstraße corridor.

No input packet, footprint, navigation, roof or authored owner is rewritten.
The small offline payload is rendered in two batches, or one native box batch.
"""

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
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
PROFILE = ROOT / "geo_data/regierungsviertel/linden-corridor-v197-source.json"
ROADS = ROOT / "geo_data/regierungsviertel/linden-corridor-v197-roads.json"
SOURCES = [
  ROOT / f"geo_data/regierungsviertel/alt-mitte-v169/source-{s}-00.json.gz"
  for s in ["389_5819", "390_5819", "390_5820"]
]


def digest(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def footprint(record: dict):
  return unary_union(
    [Polygon(p["ring"], p["holes"]) for p in record["footprintPolygons"]]
  )


def source_records() -> list[dict]:
  return [
    r
    for path in SOURCES
    for r in json.loads(gzip.decompress(path.read_bytes()))["buildings"]
  ]


def merge_native_runs(rows: list[list]) -> list[list]:
  """Join only exactly touching same-colour boxes; preserve the cube union."""
  for coordinate, width, other, other_width in [(0, 4, 2, 7), (2, 7, 0, 4)]:
    groups = {}
    for r in rows:
      key = (r[1], r[other], r[3], r[5], r[6], r[other_width])
      groups.setdefault(key, []).append(r[:])
    result = []
    for key in sorted(groups):
      ordered = sorted(groups[key], key=lambda r: r[coordinate])
      current = ordered[0]
      for row in ordered[1:]:
        if (
          abs(
            current[coordinate]
            + current[width] / 2
            - (row[coordinate] - row[width] / 2)
          )
          < 1e-8
        ):
          low = current[coordinate] - current[width] / 2
          current[width] += row[width]
          current[coordinate] = low + current[width] / 2
        else:
          result.append(current)
          current = row
      result.append(current)
    rows = result
  return rows


def select_frontages(records: list[dict], profile: dict) -> list[dict]:
  """Only ground-connected source walls facing an unobstructed named street.

  The all-column check below complements this conservative five-point face
  selection; endpoint contact alone never proves a street-facing wall.
  """
  styles = {r["parentId"]: r for r in profile["buildings"]}
  roads = json.loads(ROADS.read_text())["roads"]
  street_shapes = {
    name: unary_union([shape(r["geometry"]) for r in roads if r["name"] == name])
    for name in {r["name"] for r in roads}
  }
  obstacles = [
    footprint(r).buffer(-0.08)
    for r in records
    if footprint(r).intersects(box(580, 0, 1320, 440))
  ]
  tree = STRtree(obstacles)

  def visible(a: np.ndarray, n: np.ndarray, street) -> bool:
    ray = LineString([a + n * 0.35, a + n * 39])
    meet = ray.intersection(street.buffer(1.1))
    if meet.is_empty:
      return False
    target = nearest_points(Point(*(a + n * 0.35)), meet)[1]
    sight = LineString([a + n * 0.35, target.coords[0]])
    return not any(
      sight.intersection(obstacles[i]).length > 0.03 for i in tree.query(sight)
    )

  result = []
  for record in records:
    if record["id"] not in styles:
      continue
    assert record["category"] == "core", record["id"]
    assert not any(record["id"].endswith(s) for s in profile["protectedSuffixes"])
    fp = footprint(record)
    for part in record["parts"]:
      for s in part["surfaces"]:
        if s["kind"] != "WallSurface":
          continue
        ring = np.asarray(s["rings"][0])
        normal = np.asarray(normal_of(ring.tolist()))
        if abs(normal[1]) > 0.01 or min(ring[:, 1]) > record["groundY"] + 0.12:
          continue
        a, b = max(
          ((a, b) for a in ring for b in ring),
          key=lambda t: np.linalg.norm((t[0] - t[1])[[0, 2]]),
        )
        a, b, n = a[[0, 2]], b[[0, 2]], normal[[0, 2]]
        length = float(np.linalg.norm(b - a))
        if length < 2.2 or max(ring[:, 1]) - record["groundY"] < 5:
          continue
        if fp.contains(Point(*((a + b) / 2 + n * 0.3))):
          n = -n
        matches = [
          name
          for name in styles[record["id"]]["streets"]
          if all(
            visible(a + (b - a) * t, n, street_shapes[name])
            for t in [0.08, 0.29, 0.5, 0.71, 0.92]
          )
        ]
        if not matches:
          continue
        street = min(
          matches, key=lambda name: street_shapes[name].distance(LineString([a, b]))
        )
        d = (b - a) / length
        if d[0] * n[1] - d[1] * n[0] < 0:
          a, b, d = b, a, -d
        # Freeze clear intervals at sub-bay resolution. A missed narrow adjoining
        # footprint cannot acquire an invented painted wall or a window column.
        segments = max(1, math.ceil(length / 0.4))
        clear = [
          i
          for i in range(segments)
          if visible(a + d * length * (i + 0.5) / segments, n, street_shapes[street])
        ]
        intervals = []
        for i in clear:
          low, high = length * i / segments, length * (i + 1) / segments
          if intervals and abs(intervals[-1][1] - low) < 0.0001:
            intervals[-1][1] = high
          else:
            intervals.append([low, high])
        result.append(
          dict(
            parentId=record["id"],
            sourcePolygonId=s["sourcePolygonId"],
            rings=s["rings"],
            a=a.tolist(),
            b=b.tolist(),
            normal=n.tolist(),
            length=length,
            street=street,
            clearIntervals=intervals,
          )
        )
  return sorted(
    result, key=lambda f: (f["parentId"], f["street"], f["sourcePolygonId"])
  )


def make_payloads() -> tuple[dict, dict]:
  profile = json.loads(PROFILE.read_text())
  records = source_records()
  by_id = {r["id"]: r for r in records}
  styles = {r["parentId"]: r for r in profile["buildings"]}
  selected = select_frontages(records, profile)
  split = []
  for face in selected:
    style = styles[face["parentId"]]
    if not style.get("subfronts"):
      split.append(
        {
          **face,
          "composition": style["style"],
          "presentationInterval": [0, face["length"]],
        }
      )
      continue
    a = np.asarray(face["a"])
    d = (np.asarray(face["b"]) - a) / face["length"]
    shapes = [shape(s["worldGeometry"]) for s in style["subfronts"]]

    def subfront(u):
      p = Point(*(a + d * u))
      return min(range(len(shapes)), key=lambda i: shapes[i].distance(p))

    # OSM is address context, not a replacement footprint. Project its nearest
    # subfront boundary onto the unchanged measured wall, splitting presentation
    # intervals wherever that boundary crosses a source polygon.
    previous_u, previous = 0.0, subfront(0)
    start = 0.0
    spans = []
    for u in np.linspace(
      0, face["length"], max(2, math.ceil(face["length"] / 0.2) + 1)
    )[1:]:
      current = subfront(u)
      if current != previous:
        low, high = previous_u, float(u)
        for _ in range(20):
          middle = (low + high) / 2
          if subfront(middle) == previous:
            low = middle
          else:
            high = middle
        boundary = (low + high) / 2
        spans.append((start, boundary, previous))
        start = boundary
      previous_u, previous = float(u), current
    spans.append((start, face["length"], previous))
    for low, high, si in spans:
      sub = style["subfronts"][si]
      split.append(
        {
          **face,
          "composition": sub["style"],
          "addressOsmWayId": sub["osmWayId"],
          "presentationInterval": [low, high],
        }
      )
  selected = split
  # One axis plan across fragmented measured wall polygons. In particular the
  # Zollernhof has twelve axes across BOTH halves, not twelve on each fragment.
  avenue_axis = np.asarray([1.0, -0.084]) / math.hypot(1, 0.084)
  schadow_axis = np.asarray([0.084, 1.0]) / math.hypot(1, 0.084)
  plans = {}
  for f in selected:
    style = styles[f["parentId"]]
    if f["street"] == style.get("rhythmStreet", "Unter den Linden"):
      axis = schadow_axis if style["style"] == "schadow" else avenue_axis
      key = (f["parentId"], f["composition"])
      p = plans.setdefault(key, [])
      a = np.asarray(f["a"])
      d = (np.asarray(f["b"]) - a) / f["length"]
      p.extend(float((a + d * u) @ axis) for u in f["presentationInterval"])
  for key, coordinates in list(plans.items()):
    style = styles[key[0]]
    low, high = min(coordinates), max(coordinates)
    count = 5 if key[1] == "daimler" else style["documentedMainBays"]
    count = count or max(1, round((high - low) / style["bayPitchEstimate"]))
    plans[key] = [low + (high - low) * (i + 0.5) / count for i in range(count)]
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
        osmContext=r["osmContext"],
        sourceSha256=hashlib.sha256(json.dumps(r, sort_keys=True).encode()).hexdigest(),
      )
    )
  index = {r["id"]: i for i, r in enumerate(owners)}
  surfaces, boxes, blocks, audit = [], [], [], []
  for f in selected:
    style = styles[f["parentId"]]
    oi, fi = index[f["parentId"]], len(audit)
    a, n = np.asarray(f["a"]), np.asarray(f["normal"])
    length, d = f["length"], (np.asarray(f["b"]) - a) / f["length"]
    rings = [
      [[(np.asarray([p[0], p[2]]) - a) @ d, p[1]] for p in ring] for ring in f["rings"]
    ]
    wall = Polygon(rings[0], rings[1:]).buffer(0)
    ground, top = wall.bounds[1], wall.bounds[3]
    wall = wall.intersection(
      unary_union(
        [
          box(lo + 0.04, ground, hi - 0.04, top)
          for lo, hi in f["clearIntervals"]
          if hi - lo > 0.08
        ]
      )
    )
    left, right = f["presentationInterval"]
    wall = wall.intersection(box(left, ground, right, top))
    eave = min(p[1] for p in f["rings"][0] if p[1] > ground + 1)
    if eave - ground < 4:
      continue
    part = dict(surfaces=[], facadeBoxes=[], detailRods=[])
    upper_fields = []
    main = f["street"] == style.get("rhythmStreet", "Unter den Linden")
    kind = f["composition"]
    axis = schadow_axis if kind == "schadow" else avenue_axis
    if kind == "daimler":
      style = {**style, "paint": 0xD4C4AC, "base": 0xB8A58B, "trim": 0xDDD0B9}

    def point(u: float, y: float, out: float) -> list[float]:
      p = a + d * u + n * out
      return [round(float(p[0]), 5), round(float(y), 5), round(float(p[1]), 5)]

    def paint(poly, color: int) -> None:
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
      out: float = 0.34,
      depth: float = 0.12,
      role: int = 2,
    ) -> None:
      if min(w, h) <= 0:
        return
      cut = wall.intersection(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2))
      for fragment in getattr(cut, "geoms", [cut]):
        if fragment.is_empty or fragment.geom_type != "Polygon":
          continue
        lo, bottom, hi, upper = fragment.bounds
        # Only rectangular fragments become box members. A gable or hole is
        # never bridged by its bounding rectangle.
        if (
          hi - lo < 0.012
          or upper - bottom < 0.012
          or not wall.buffer(0.0005).covers(box(lo, bottom, hi, upper))
        ):
          continue
        part["facadeBoxes"].append(
          point((lo + hi) / 2, (bottom + upper) / 2, out)
          + [
            round(hi - lo, 5),
            round(upper - bottom, 5),
            depth,
            round(-math.atan2(d[1], d[0]), 9),
            color,
            role,
            *n.tolist(),
          ]
        )

    # Upper Eastside's large compound LoD2 parent does not prove 11 floors on
    # every plane; bound all visible rows by this particular wall's eave.
    levels = max(2, min(style["levels"], round((eave - ground) / 3.1)))
    base_top = ground + min(style["baseHeightEstimate"], (eave - ground) * 0.32)
    paint(wall.intersection(box(-1, ground, length + 1, base_top)), style["base"])
    paint(wall.intersection(box(-1, base_top, length + 1, top + 1)), style["paint"])
    bays = max(1, round(length / style["bayPitchEstimate"]))
    documented = (
      (5 if kind == "daimler" else style["documentedMainBays"]) if main else 0
    )
    if main:
      plan = plans[(f["parentId"], kind)]
      columns = [(x - float(a @ axis)) / float(d @ axis) for x in plan]
      columns = [u for u in columns if left - 3.5 < u < right + 3.5]
      step = abs((plan[1] - plan[0]) / float(d @ axis)) if len(plan) > 1 else length
      bays = sum(left <= u < right for u in columns)
    else:
      step = length / bays
      columns = [step * (i + 0.5) for i in range(bays)]
    paired = kind == "zollern" and main
    banded = kind in ["swiss", "upper", "modern"]
    frame = style["trim"] if banded else 0xE2DDCC
    glass = 0x687C7C if kind != "upper" else 0x596C70
    # Two-storey commercial bases are one coherent field, not two invented
    # generic residential rows; exact dimensions remain proportional estimates.
    upper_rows = max(1, levels - (2 if kind in ["otto", "upper", "modern"] else 1))
    pitch = (eave - base_top - 0.65) / upper_rows
    for y, h in [(ground + 0.24, 0.16), (base_top, 0.20), (eave - 0.22, 0.24)]:
      member(
        length / 2, y, length - 0.20, h, style["trim"], out=0.37, depth=0.25, role=3
      )
    if kind in [
      "wagon",
      "zollern",
      "kaiser",
      "daimler",
      "friedlaender",
      "classical",
      "westin",
      "otto",
      "topas",
      "schadow",
    ]:
      member(
        length / 2,
        eave - 0.65,
        length - 0.24,
        0.19,
        style["trim"],
        out=0.39,
        depth=0.28,
        role=3,
      )
    for row in range(upper_rows):
      y = base_top + pitch * (row + 0.5)
      h = min(2.3, pitch * 0.65)
      w = min(2.25, step * (0.72 if banded else 0.48))
      if paired:
        w = min(1.24, step * 0.29)
      for ci, center in enumerate(columns):
        logical_axis = (
          min(
            range(len(plan)),
            key=lambda i: abs(plan[i] - float((a + d * center) @ axis)),
          )
          if main
          else ci
        )
        for pair, shift in enumerate([-step * 0.18, step * 0.18] if paired else [0]):
          u = center + shift
          member(u, y, w + 0.18, h + 0.18, frame)
          before = len(part["facadeBoxes"])
          member(u, y, w, h, glass, out=0.62, depth=0.03)
          after = len(part["facadeBoxes"])
          if after > before:
            upper_fields.append(
              dict(
                row=row,
                axis=logical_axis,
                pair=pair,
                width=w,
                height=h,
                boxes=list(range(before, after)),
              )
            )
          member(u, y, 0.075, h, frame, out=0.80, depth=0.04)
          if not banded:
            member(u, y + h * 0.15, w, 0.075, frame, out=0.80, depth=0.04)
            member(
              u,
              y - h / 2 - 0.15,
              w + 0.30,
              0.13,
              style["trim"],
              out=0.43,
              depth=0.24,
              role=3,
            )
      if banded:
        member(
          length / 2,
          y - h / 2 - 0.22,
          length - 0.22,
          0.16,
          style["trim"],
          out=0.36,
          depth=0.16,
          role=3,
        )
    # Documented giant order stays on the avenue: no invented historic dress
    # on the simpler Mittelstraße elevations.
    giant = main and kind in ["wagon", "zollern", "kaiser", "daimler", "friedlaender"]
    if giant:
      for center in columns:
        u = center + step / 2
        member(
          u,
          (base_top + eave - 0.8) / 2,
          min(0.52, step * 0.15),
          eave - 0.8 - base_top,
          style["trim"],
          out=0.44,
          depth=0.28,
          role=3,
        )
        member(
          u,
          eave - 0.95,
          min(0.85, step * 0.22),
          0.28,
          style["trim"],
          out=0.47,
          depth=0.32,
          role=3,
        )
    # Each documented commercial base gets framed glazed openings. The main
    # access bay is a proportional interpretation, not an OSM door/survey claim.
    arcaded = kind in ["wagon", "swiss", "westin"]
    for u in columns:
      w = min(step * 0.70, 3.8)
      h = base_top - ground - 0.7
      y = ground + 0.3 + h / 2
      if kind == "schadow":
        portal = float((a + d * u) @ axis) < plans[(f["parentId"], kind)][0] + 0.1
        w, h = (min(w, 2.2), 2.7) if portal else (min(w, 1.55), 1.7)
        y = ground + 0.3 + h / 2 if portal else ground + 1.3 + h / 2
      member(u, y, w + 0.20, h + 0.15, style["trim"], out=0.35, depth=0.18, role=4)
      member(u, y, w, h, 0x586C69, out=0.62, depth=0.03, role=4)
      member(u, y, 0.09, h, style["trim"], out=0.80, depth=0.04, role=4)
      member(u, y + h * 0.18, w, 0.10, style["trim"], out=0.80, depth=0.04, role=4)
      if arcaded and w > 1.5:
        # Five stepped arch-cap fields: readable in both modes, texture-free.
        for j in range(5):
          x = (j - 2) * w / 5
          cap = 0.14 + w * 0.5 * (1 - math.sqrt(max(0, 1 - (2 * x / w) ** 2)))
          member(
            u + x,
            base_top - 0.3 - cap / 2,
            w / 5 + 0.01,
            cap,
            style["base"],
            out=0.89,
            depth=0.035,
            role=4,
          )
      if (
        main
        and len(plan) > 2
        and abs(float((a + d * u) @ axis) - plan[len(plan) // 2]) < 0.001
        and kind != "schadow"
      ):
        member(
          u,
          ground + 1.35,
          min(w * 0.55, 1.5),
          2.1,
          0x435956,
          out=0.86,
          depth=0.035,
          role=4,
        )
        member(
          u, ground + 1.35, 0.07, 2.1, style["trim"], out=1.03, depth=0.025, role=4
        )
    if (
      kind in ["kaiser", "daimler", "classical", "friedlaender", "westin", "schadow"]
      and main
    ):
      for y in np.arange(ground + 0.8, base_top - 0.4, 0.62):
        member(
          length / 2,
          float(y),
          length - 0.24,
          0.045,
          style["trim"],
          out=0.245,
          depth=0.028,
          role=3,
        )
    start, first_surface, first_block = len(boxes), len(surfaces), len(blocks)
    surfaces.extend({**s, "owner": oi, "face": fi} for s in part["surfaces"])
    boxes.extend(r + [oi] for r in part["facadeBoxes"])
    # Drawn layers need visible separation at the viewer's large far plane.
    # Native uses one common half-metre facade lattice: fine marks replace
    # existing cells, never several almost coplanar independently offset skins.
    native_members = []
    for member_row in part["facadeBoxes"]:
      row = member_row[:]
      normal_offset = float((np.asarray([row[0], row[2]]) - a) @ n)
      row[0] -= n[0] * (normal_offset - 0.40)
      row[2] -= n[1] * (normal_offset - 0.40)
      native_members.append(row)
    native_part = {**part, "facadeBoxes": native_members}
    blocks.extend(r + [oi] for r in merge_native_runs(native_blocks(native_part)))
    audit.append(
      {
        **f,
        "owner": oi,
        "eave": eave,
        "bays": bays,
        "columnCenters": [u for u in columns if left <= u < right],
        "upperFields": [
          {**field, "boxes": [start + i for i in field["boxes"]]}
          for field in upper_fields
        ],
        "documentedMainBays": documented,
        "levelsEstimate": levels,
        "style": kind,
        "firstSurface": first_surface,
        "surfaceCount": len(surfaces) - first_surface,
        "firstBox": start,
        "boxCount": len(boxes) - start,
        "firstBlock": first_block,
        "blockCount": len(blocks) - first_block,
      }
    )
  data = dict(
    schemaVersion=1, owners=owners, surfaces=surfaces, boxes=boxes, blocks=blocks
  )
  evidence = dict(
    schemaVersion=1,
    sourceSha256={str(p.relative_to(ROOT)): digest(p) for p in SOURCES},
    profileSha256=digest(PROFILE),
    roadsSha256=digest(ROADS),
    selectedFaces=audit,
    interpretation=profile["interpretation"],
    counts=dict(
      owners=len(owners),
      faces=len(audit),
      drawnTriangles=sum(len(s["triangles"]) for s in surfaces),
      drawnBoxes=len(boxes),
      nativeRuns=len(blocks),
    ),
  )
  return data, evidence


if __name__ == "__main__":
  data, evidence = make_payloads()
  for suffix, value in [("", data), ("Evidence", evidence)]:
    path = DATA / f"lindenCorridorV197{suffix}.json"
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(path.name, path.stat().st_size)
  print(evidence["counts"])
