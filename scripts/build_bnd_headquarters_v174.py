"""Step 10: additive, public-exterior BND recognition on complete source owners.

The original LoD2 surfaces are never removed. Public OSM building-part polygons
supply the missing stepped upper silhouette; primary 30 m height bounds it.
"""

from __future__ import annotations

import json
import math
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
from build_breitscheid_towers_v161 import triangles_for
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
EVIDENCE = DATA / "bndHeadquartersV174Evidence.json"
DEST = DATA / "bndHeadquartersV174Source.json"
METAL, STONE, GLASS, FRAME, BRICK, ROOF = (
  0xBCBDB0,
  0xD1CCB7,
  0x34413D,
  0x949A8E,
  0x8C6150,
  0x8E958A,
)


def polygons(geometry: Any) -> list[Polygon]:
  if geometry.is_empty:
    return []
  if geometry.geom_type == "Polygon":
    return [geometry]
  return [p for p in geometry.geoms if p.geom_type == "Polygon"]


def poly(record: dict) -> Polygon:
  return Polygon(record["ring"], record.get("holes", []))


def encode_poly(p: Polygon) -> dict:
  return {
    "ring": [[round(x, 4), round(z, 4)] for x, z in list(p.exterior.coords)[:-1]],
    "holes": [
      [[round(x, 4), round(z, 4)] for x, z in list(r.coords)[:-1]] for r in p.interiors
    ],
  }


def build() -> tuple[dict, dict]:
  evidence = json.loads(EVIDENCE.read_text())
  parents = {p["id"]: p for p in evidence["sourceParents"]}
  main = parents["DEBE00YY1tw0009x"]
  main_foot = unary_union([poly(p) for p in main["footprintPolygons"]])
  low = main["parts"][0]["topY"]
  mapped = {p["role"]: p for p in evidence["mappedExteriorParts"]}
  # Relative heights are display estimates; only the 30 m maximum is published.
  heights = {
    "central-bar": 35.2,
    "main-comb-wings": 31.2,
    "north-gatehouse": 22.2,
    "south-gatehouse": 22.2,
    "north-eastern-wing": 22.2,
  }
  volumes, used = [], Polygon()
  for role, top in heights.items():
    part = mapped[role]
    footprint = poly(part).intersection(main_foot).difference(used)
    used = unary_union([used, footprint])
    for index, p in enumerate(polygons(footprint)):
      if p.area < 0.05:
        continue
      volumes.append(
        {
          "id": f"bnd-v174-{role}-{index}",
          "osmId": part["id"],
          "role": role,
          "groundY": low,
          "topY": top,
          "color": STONE if "gate" in role else METAL,
          **encode_poly(p),
        }
      )
  upper = [(v, poly(v)) for v in volumes]
  # Complete public exterior planes, including low north wing and court faces.
  planes = []
  for parent in parents.values():
    foot = unary_union([poly(p) for p in parent["footprintPolygons"]])
    for part in parent["parts"]:
      for surface in part["surfaces"]:
        if surface["kind"] != "WallSurface":
          continue
        ring = surface["rings"][0]
        a, b = max(
          ((a, b) for a in ring for b in ring),
          key=lambda p: math.hypot(p[0][0] - p[1][0], p[0][2] - p[1][2]),
        )
        length = math.hypot(b[0] - a[0], b[2] - a[2])
        if length < 1.3:
          continue
        start, end = np.array([a[0], a[2]]), np.array([b[0], b[2]])
        direction = (end - start) / length
        normal = np.array([direction[1], -direction[0]])
        mid = (start + end) / 2
        if foot.contains(Point(mid + normal * 0.1)):
          normal *= -1
        south = parent["id"] == "DEBE00YY1tw0009m"
        planes.append(
          {
            "sourceId": surface["sourcePolygonId"],
            "owner": parent["id"],
            "role": "visitor-center-brick" if south else "source-base",
            "start": start,
            "end": end,
            "normal": normal,
            "low": min(p[1] for p in ring),
            "top": max(p[1] for p in ring),
            "color": BRICK if south else METAL,
          }
        )
  surfaces, boxes, axes = [], [], []

  def add_surface(rings: list, color: int, role: str) -> None:
    triangles = triangles_for(rings)
    if triangles:
      surfaces.append({"role": role, "color": color, "triangles": triangles})

  for v, p in upper:
    low_y, top = v["groundY"], v["topY"]
    add_surface(
      [[[x, top, z] for x, z in r] for r in [v["ring"], *v["holes"]]],
      ROOF,
      "mapped-upper-roof",
    )
    for ring in [p.exterior, *p.interiors]:
      for a, b in zip(ring.coords, list(ring.coords)[1:]):
        start, end = np.array(a), np.array(b)
        length = float(np.linalg.norm(end - start))
        if length < 0.01:
          continue
        d = (end - start) / length
        n = np.array([d[1], -d[0]])
        mid = (start + end) / 2
        if p.contains(Point(mid + n * 0.05)):
          n *= -1
        # Keep only exposed elevation above the highest adjoining mapped part.
        other_top = max(
          (
            o["topY"]
            for o, q in upper
            if o is not v and q.buffer(0.002).covers(Point(mid + n * 0.05))
          ),
          default=low_y,
        )
        bottom = max(low_y, other_top)
        if top <= bottom + 0.02:
          continue
        add_surface(
          [
            [
              [a[0], bottom, a[1]],
              [b[0], bottom, b[1]],
              [b[0], top, b[1]],
              [a[0], top, a[1]],
            ]
          ],
          v["color"],
          "mapped-upper-wall",
        )
        if length > 1.3:
          planes.append(
            {
              "sourceId": v["osmId"],
              "owner": main["id"],
              "role": v["role"],
              "start": start,
              "end": end,
              "normal": n,
              "low": bottom,
              "top": top,
              "color": v["color"],
            }
          )

  for index, plane in enumerate(planes):
    a, b, n = plane["start"], plane["end"], plane["normal"]
    length = float(np.linalg.norm(b - a))
    d = (b - a) / length
    low_y, top = plane["low"], plane["top"]
    if top - low_y < 1:
      continue
    role = plane["role"]
    south = role == "visitor-center-brick"
    gate = "gatehouse" in role
    material = plane["color"]
    axes.append(
      {k: (v.tolist() if isinstance(v, np.ndarray) else v) for k, v in plane.items()}
    )
    # A thin cladding plane conceals the earlier generic window estimate while
    # retaining the complete underlying wall and roof geometry and ownership.
    cladding_offset = 0.18
    add_surface(
      [
        [
          [*(a + n * cladding_offset)[:1], low_y, (a + n * cladding_offset)[1]],
          [(b + n * cladding_offset)[0], low_y, (b + n * cladding_offset)[1]],
          [(b + n * cladding_offset)[0], top, (b + n * cladding_offset)[1]],
          [(a + n * cladding_offset)[0], top, (a + n * cladding_offset)[1]],
        ]
      ],
      material,
      "thin-exterior-cladding",
    )

    def emit(
      u: float,
      y: float,
      w: float,
      h: float,
      depth: float,
      offset: float,
      color: int,
      detail_role: str,
    ) -> None:
      if h <= 0 or w <= 0:
        return
      point = a + d * u + n * offset
      boxes.append(
        [
          round(float(point[0]), 4),
          round(y, 4),
          round(float(point[1]), 4),
          round(w, 4),
          round(h, 4),
          depth,
          round(math.atan2(-d[1], d[0]), 7),
          color,
          detail_role,
          index,
        ]
      )

    pitch = 2.2 if south else 1.67
    count = max(1, round(length / pitch))
    pitch = length / count
    # Anchor all floors to a consistent site datum, never each short surface.
    floor_pitch = 4.12 if south else (4.1 if gate else 3.25)
    window_height = 2.50 if south else 2.55
    for j in range(count):
      u = (j + 0.5) * pitch
      for y in np.arange(7.45, 36.0, floor_pitch):
        # Split panes crossing the original low roof elevation. The original
        # source boundary is retained without turning it into a blank band.
        bottom = max(float(y - window_height / 2), low_y + 0.025)
        upper_y = min(float(y + window_height / 2), top - 0.20)
        height = upper_y - bottom
        if height < 0.65:
          continue
        center_y = (bottom + upper_y) / 2
        width = min(pitch * 0.56, 1.3 if south else 1.02)
        emit(
          u,
          center_y,
          width + 0.20,
          min(height + 0.12, top - low_y - 0.05),
          0.06,
          0.225,
          FRAME,
          "recessed-frame",
        )
        emit(u, center_y, width, height, 0.06, 0.275, GLASS, "vertical-glazing")
        if bottom + 0.08 < y - 0.57 < upper_y - 0.08:
          emit(u, float(y) - 0.57, width, 0.075, 0.10, 0.32, FRAME, "transom")
      if not south:
        emit(
          u - pitch / 2 + 0.06,
          (low_y + top) / 2,
          0.115,
          top - low_y - 0.10,
          0.22,
          0.285,
          material,
          "projecting-vertical-fin",
        )
    for y in np.arange(5.2, 36, floor_pitch):
      if low_y + 0.2 < y < top - 0.1:
        emit(
          length / 2,
          float(y),
          length - 0.06,
          0.20 if south else 0.14,
          0.10,
          0.26,
          material,
          "horizontal-floor-joint",
        )
    emit(
      length / 2,
      top - 0.12,
      length - 0.04,
      0.18,
      0.25,
      0.285,
      STONE if south or gate else METAL,
      "roof-edge-cap",
    )

  # Source-aligned public portal marker at the visitor-centre OSM POI. Only
  # the externally visible door/surround is shown, with no interior model.
  visitor = evidence["visitorCenter"]["position"]
  candidates = [
    (i, p) for i, p in enumerate(planes) if p["role"] == "visitor-center-brick"
  ]
  # Select actual nearest finite segment, not its infinite plane.
  from shapely.geometry import LineString

  vi, front = min(
    candidates,
    key=lambda ip: LineString([ip[1]["start"], ip[1]["end"]]).distance(Point(visitor)),
  )
  line = LineString([front["start"], front["end"]])
  at = np.array(line.interpolate(line.project(Point(visitor))).coords[0])
  direction = (front["end"] - front["start"]) / line.length
  normal = front["normal"]
  yaw = math.atan2(-direction[1], direction[0])
  entry_rows = []
  for du, y, w, h, color, name in [
    (0, 7.1, 3.2, 3.8, 0xC8C4B4, "visitor-portal-surround"),
    (0, 6.98, 2.55, 3.35, GLASS, "visitor-portal-glass"),
    (0, 6.98, 0.085, 3.35, FRAME, "visitor-door-mullion"),
    (0, 9.36, 5.8, 0.64, 0xD9D7C8, "visitor-name-band"),
  ]:
    q = at + direction * du + normal * (0.39 + len(entry_rows) * 0.035)
    row = [
      round(float(q[0]), 4),
      y,
      round(float(q[1]), 4),
      w,
      h,
      0.12,
      yaw,
      color,
      name,
      vi,
    ]
    boxes.append(row)
    entry_rows.append(row)

  # Orthogonal, surface-only native skin. No smooth shell and no volume fill.
  native = {}
  for v, p in upper:
    top = math.ceil(v["topY"])
    x0, z0, x1, z1 = p.bounds
    for x in range(math.floor(x0), math.ceil(x1)):
      for z in range(math.floor(z0), math.ceil(z1)):
        pt = Point(x + 0.5, z + 0.5)
        if not p.covers(pt):
          continue
        # Roof slabs are one-block thick. Boundary columns carry only the skin.
        if p.boundary.distance(pt) < 0.77:
          base = math.floor(v["groundY"])
          native[x, z] = [
            x + 0.5,
            (base + top) / 2,
            z + 0.5,
            1,
            top - base,
            1,
            v["color"],
          ]
        else:
          native[x, z] = [x + 0.5, top - 0.5, z + 0.5, 1, 1, 1, ROOF]
  # Lossless horizontal runs retain every surface cell while reducing memory.
  bands: dict[tuple, list[float]] = {}
  for x, y, z, _, h, _, color in native.values():
    bands.setdefault((y, z, h, color), []).append(x)
  native_boxes = []
  for (y, z, h, color), xs in sorted(bands.items()):
    start = previous = sorted(xs)[0]
    for x in [*sorted(xs)[1:], float("inf")]:
      if x > previous + 1.01:
        native_boxes.append(
          [(start + previous) / 2, y, z, previous - start + 1, h, 1, color]
        )
        start = x
      previous = x
  # Lower footprint facades and upper windows use separate orthogonal runs;
  # fine pane mullions remain a drawn-only surface cue, never a smooth clone.
  for x, y, z, w, h, dep, yaw, color, role, _ in boxes:
    if role not in [
      "vertical-glazing",
      "roof-edge-cap",
      "visitor-portal-glass",
      "visitor-name-band",
    ]:
      continue
    steps = max(1, math.ceil(w / 1.6))
    for j in range(steps):
      u = -w / 2 + (j + 0.5) * w / steps
      native_boxes.append(
        [
          round(x + math.cos(yaw) * u, 4),
          y,
          round(z - math.sin(yaw) * u, 4),
          round(max(0.25, w / steps * abs(math.cos(yaw))), 4),
          h,
          round(max(0.25, w / steps * abs(math.sin(yaw))), 4),
          color,
        ]
      )

  preserved = [
    {
      "id": p["id"],
      "partIds": [v["id"] for v in p["parts"]],
      "surfaceCount": sum(len(v["surfaces"]) for v in p["parts"]),
      "holeCount": sum(len(q["holes"]) for q in p["footprintPolygons"]),
    }
    for p in parents.values()
  ]
  nav = {
    "schemaVersion": 1,
    "preservedOwners": preserved,
    "newReplacedOwners": [],
    "upperParts": [{k: v for k, v in p.items() if k != "color"} for p in volumes],
    "visitorCenter": evidence["visitorCenter"],
    "publishedMainHeightM": 30,
    "groundY": 5.2,
    "originalMainTopY": low,
    "policy": "Existing LoD2 source base, all source roofs and courts remain owned by Alt-Mitte v169. Add only mapped upper exterior surfaces and thin cladding. New roof and collision support covers only upperParts; all holes remain open.",
  }
  return (
    {
      "schemaVersion": 1,
      "renderBudget": {
        "drawnBatches": 2,
        "nativeBatches": 1,
        "sourceOwnersRetained": len(preserved),
        "measuredSurfacesRetained": sum(p["surfaceCount"] for p in preserved),
        "upperVolumes": len(volumes),
        "facadeInstances": len(boxes),
        "nativeInstances": len(native_boxes),
        "surfaceTriangles": sum(len(p["triangles"]) for p in surfaces),
      },
      "preservedOwners": preserved,
      "newReplacedOwners": [],
      "upperVolumes": volumes,
      "surfaces": surfaces,
      "boxes": [r[:8] for r in boxes],
      "detailRoleCounts": dict(Counter(r[8] for r in boxes)),
      "nativeBoxes": native_boxes,
      "axes": axes,
      "visitorPortal": {
        "point": at.tolist(),
        "normal": normal.tolist(),
        "tangent": direction.tolist(),
        "y": 9.19,
      },
      "detailStatus": "Public exterior only. Source footprint and mapped upper-part plan boundaries; primary published 30 m maximum; procedural facade subdivision and remaining elevations are labelled estimates.",
    },
    nav,
  )


def main() -> None:
  model, nav = build()
  DEST.write_text(json.dumps(model, separators=(",", ":")) + "\n")
  DEST.with_name("bndHeadquartersV174Navigation.json").write_text(
    json.dumps(nav, separators=(",", ":")) + "\n"
  )
  print(
    {
      k: len(model[k])
      for k in ["upperVolumes", "surfaces", "boxes", "nativeBoxes", "axes"]
    }
  )


if __name__ == "__main__":
  main()
