"""Step 10: bounded Gipsdreieck and Koppenplatz recognition in one old batch."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import numpy as np
from build_lennon_v250 import fingerprint
from build_north_mitte_fronts_v239 import current_triangles
from build_schools_places_v205 import Face, group
from shapely.geometry import box, shape

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
OWNER = "DEBE01YYK00001Eq"
ORIGIN = [1950, 0, -950]
BRICK, TERRACOTTA, STONE = 0xA86A49, 0xBF895D, 0xC4BDA7
GLASS, FRAME, COPPER, DARK = 0x59747B, 0xDDD8BD, 0x53675E, 0x35413E


def read(path: Path) -> dict:
  """Read retained finite sources."""
  return json.loads(path.read_text())


def build() -> tuple[dict, dict]:
  """Keep every old source; replace only one exactly receipted authored group."""
  source = read(GEO / "gips-koppen-v252-source.json")
  triangle_keys, packet_receipts = current_triangles(box(1770, -980, 1810, -920))
  assert len(source["openingReceipts"]) == 56
  assert all(
    bytes.fromhex(key) in triangle_keys
    for opening in source["openingReceipts"]
    for key in opening["triangles"]
  )
  old = next(
    e for e in read(DATA / "schoolsPlacesV205.json")["schools"] if e["owner"] == OWNER
  )
  g = group("Gipsstraße and Koppenplatz", OWNER)
  sections = []

  def mark(name: str, start: list[int]) -> None:
    sections.append(
      {
        "name": name,
        "first": start,
        "counts": [
          len(g[k]) - n for k, n in zip(["boxes", "rods", "nativeRows"], start)
        ],
      }
    )

  def cursor() -> list[int]:
    return [len(g[k]) for k in ["boxes", "rods", "nativeRows"]]

  def member(
    center: list, width: float, height: float, depth: float, yaw: float, color: int
  ) -> None:
    """Thin drawn cuboid and independently stepped axis-aligned native surface."""
    g["boxes"].append([*center, width, height, depth, yaw, color])
    steps = max(1, math.ceil(width / 0.65))
    dx, dz = math.cos(yaw), -math.sin(yaw)
    for i in range(steps):
      u = (i + 0.5) * width / steps - width / 2
      g["nativeRows"].append(
        [
          center[0] + u * dx,
          center[1],
          center[2] + u * dz,
          max(depth, abs(dx) * width / steps),
          height,
          max(depth, abs(dz) * width / steps),
          color,
        ]
      )

  def stroke(a: list, b: list, width: float, color: int) -> None:
    """Procedural curve segment; native uses its own orthogonal small members."""
    g["rods"].append([*a, *b, width, color])
    length = math.dist(a, b)
    for i in range(max(1, math.ceil(length / 0.28))):
      count = max(1, math.ceil(length / 0.28))
      t = (i + 0.5) / count
      p = [a[k] + (b[k] - a[k]) * t for k in range(3)]
      g["nativeRows"].append([*p, width, max(width, length / count), width, color])

  # The old selected main-school face had six invented storeys. The heritage
  # record explicitly says four. Replace its complete v205 authored complement,
  # leaving original LoD2 walls/roofs and v185 cornice members intact.
  start = cursor()
  raw = next(
    f for f in source["faces"] if f["owner"] == OWNER and f["surfaceIndex"] == 23
  )
  f = Face(g, raw["rings"])
  levels = [5.8, 10.6, 15.4, 20.2]
  pitch = (f.right - f.left) / 3
  for level, y in enumerate(levels):
    for bay in range(3):
      u = f.left + (bay + 0.5) * pitch
      w, h = 1.52, 2.65
      f.member(u, y, w, h, GLASS, 0.065, 0.22)
      for dx in [-w / 2, 0, w / 2]:
        f.member(u + dx, y, 0.075, h, TERRACOTTA)
      for dy in [-h / 2, 0.37, h / 2]:
        f.member(u, y + dy, w + 0.12, 0.075, BRICK)
      f.member(u, y - h / 2 - 0.16, w + 0.28, 0.14, TERRACOTTA, 0.18)
      f.arch(u, y + h / 2 + 0.06, w + 0.22, 0.25, BRICK)
      if level == 1:
        f.member(u, y - h / 2 - 0.47, w, 0.25, TERRACOTTA)
        for dx in [-0.42, 0, 0.42]:
          f.member(u + dx, y - h / 2 - 0.47, 0.13, 0.12, BRICK, 0.12)
  # Original window grids on the remaining faces stay visible. New members
  # occupy only their roof margin, so no second glazing register is invented.
  for raw in [r for r in source["faces"] if r["owner"] == OWNER]:
    f = Face(g, raw["rings"])
    length, mid = f.right - f.left, (f.right + f.left) / 2
    for y, h in [(f.top - 0.18, 0.14), (f.top - 0.65, 0.13)]:
      f.member(mid, y, length - 0.16, h, TERRACOTTA, 0.15)
    for u in np.arange(f.left + 0.35, f.right - 0.2, 0.72):
      f.member(float(u), f.top - 0.43, 0.16, 0.28, BRICK, 0.20)
  mark("Kastanienbaum main: four levels and source-wall cornices", start)

  start = cursor()
  front = next(
    s
    for s in read(GEO / "schools-v185-evidence.json")["schools"]
    if s["owner"] == "OSM-way-23991547"
  )["faces"][0]
  f = Face(g, front["rings"], front["normal"])
  pitch, storey = (f.right - f.left) / 4, (f.top - f.base) / 3
  # Panels on the closed LEFT door only; the right courtyard passage stays open.
  # This source face runs east-to-west: its final bay is the photograph's
  # street-left closed door. The first bay is the right-hand court passage.
  u = f.right - pitch / 2
  for yy in [f.base + 0.65, f.base + 1.27]:
    for xx in [-0.38, 0.38]:
      f.member(u + xx, yy, 0.55, 0.47, 0x7B4033, 0.06, 0.38)
  for bay in range(4):
    u = f.left + (bay + 0.5) * pitch
    y = f.base + 1.52 * storey - 1.16
    for j in range(4):
      a = 2 * math.pi * j / 4
      f.member(u + math.cos(a) * 0.28, y + math.sin(a) * 0.07, 0.09, 0.07, BRICK)
  f.member((f.left + f.right) / 2, f.top - 0.76, f.length - 0.2, 0.10, TERRACOTTA)
  mark("Kastanienbaum director house: retained door and terracotta detail", start)

  start = cursor()
  # Final production QA exposed five apparent rows in the old 56-pane grid,
  # whereas the official photograph has three occupied levels. The exact old
  # 112 triangle receipts above admit a complete shallow facing on those six
  # original planes. Source shells/roofs and the original packets remain intact.
  # No surrounding wall, new territory or unmatched opening can be covered.
  koppen_openings = []
  bays = {
    ("DEBE3DjD2eO7FgdL", 1): 7,
    ("DEBE3DG94v6wivJl", 0): 5,
    ("DEBE3DG94v6wivJl", 1): 2,
    ("DEBE3DG94v6wivJl", 10): 5,
    ("DEBE3DQ03Y0beSFq", 0): 5,
    ("DEBE3DQ03Y0beSFq", 3): 2,
  }
  for raw in [r for r in source["faces"] if r["owner"] == "DEBE01YYK0000AxW"]:
    f = Face(g, raw["rings"])
    mid, length = (f.left + f.right) / 2, f.right - f.left
    # The source planes have slightly sloping tops. Use the common original
    # wall interval so the facing does not intersect or invent a roof edge.
    high = min(p[1] for p in raw["rings"][0] if p[1] > f.base + 0.5) - 0.03
    low = f.base + 0.02
    f.member(mid, (low + high) / 2, length - 0.035, high - low, 0xD0CBB9, 0.05, 0.57)
    for y, h, color in [(high - 0.10, 0.14, STONE), (high - 0.34, 0.08, FRAME)]:
      f.member(mid, y, length - 0.06, h, color, 0.10, 0.68)
    central = raw["partId"] == "DEBE3DG94v6wivJl"
    portal = central and raw["surfaceIndex"] == 1
    count = bays[raw["partId"], raw["surfaceIndex"]]
    pitch = length / count
    for level, y in enumerate([8.75, 14.05, 20.3 if central else 19.35]):
      if portal and level == 0:
        continue
      height = 4.45 if central and level == 2 else 3.1
      width = min(1.18, pitch * 0.64)
      for bay in range(count):
        u = f.left + (bay + 0.5) * pitch
        f.member(u, y, width + 0.14, height + 0.12, STONE, 0.05, 0.67)
        f.member(u, y, width, height, GLASS, 0.06, 0.72)
        for dx in [-width / 2, 0, width / 2]:
          f.member(u + dx, y, 0.065, height, FRAME, 0.06, 0.79)
        for dy in [-height / 2, height * 0.21, height / 2]:
          f.member(u, y + dy, width + 0.10, 0.065, FRAME, 0.06, 0.79)
        f.member(u, y - height / 2 - 0.13, width + 0.25, 0.12, STONE, 0.13, 0.79)
        if central and level == 2:
          f.member(u, y - height * 0.16, width, 0.065, FRAME, 0.06, 0.79)
        koppen_openings.append(
          {
            "partId": raw["partId"],
            "surfaceIndex": raw["surfaceIndex"],
            "level": level,
            "center": f.point(u, y, 0.72),
            "height": height,
          }
        )
    if portal:
      # Source central face is exactly the narrow entrance bay.
      y = f.base + 2.02
      f.member(mid, y, 2.12, 3.90, DARK, 0.06, 0.72)
      for dx in [-1.20, 1.20]:
        f.member(mid + dx, y, 0.20, 4.02, STONE, 0.16, 0.80)
        f.member(mid + dx, f.base + 0.35, 0.29, 0.52, STONE, 0.20, 0.80)
      f.member(mid, f.base + 4.33, 2.58, 0.22, STONE, 0.21, 0.80)
      f.member(mid, f.base + 1.40, 0.08, 2.6, STONE, 0.06, 0.80)
      first_rod, first_native = len(g["rods"]), len(g["nativeRows"])
      f.arch(mid, f.base + 2.58, 2.12, 1.15, STONE)
      for row in g["rods"][first_rod:]:
        for index in [0, 3]:
          row[index] += f.n[0] * 0.44
          row[index + 2] += f.n[2] * 0.44
      for row in g["nativeRows"][first_native:]:
        row[0] += f.n[0] * 0.44
        row[2] += f.n[2] * 0.44
  mark(
    "Koppenplatz school: complete three-storey replacement on six source faces", start
  )

  start = cursor()
  # The retained LoD2 has the complete mansard but omits the documented turret.
  # Its dimensions are photo-proportional estimates; it never replaces a roof.
  tower = [1793.4, 0, -950.4]
  yaw = math.atan2(0.3140154, 0.9494179)
  normal = np.array([math.cos(yaw), 0, -math.sin(yaw)])
  tangent = np.array([-normal[2], 0, normal[0]])

  def towerpoint(u: float, y: float, out: float) -> list:
    p = np.array(tower) + tangent * u + normal * out
    return [float(p[0]), y, float(p[2])]

  for side in range(4):
    a = yaw + side * math.pi / 2
    n = np.array([math.cos(a), 0, -math.sin(a)])
    for y, h, radius, width, color in [
      (31.1, 3.8, 2.10, 4.20, COPPER),
      (33.15, 0.25, 2.25, 4.50, DARK),
      (35.1, 3.65, 1.64, 3.28, COPPER),
      (37.05, 0.22, 1.90, 3.80, DARK),
    ]:
      c = np.array(tower) + n * radius
      member([float(c[0]), y, float(c[2])], width, h, 0.14, a + math.pi / 2, color)
    # Visible belfry louvers, rather than another filled upper wall.
    c = np.array(tower) + n * 1.74
    for y in np.arange(33.65, 36.65, 0.35):
      member(
        [float(c[0]), float(y), float(c[2])], 2.45, 0.09, 0.10, a + math.pi / 2, DARK
      )
  # Bulbous copper roof with a smaller upper lantern and cap.
  for y, radius in [
    (37.2, 1.95),
    (37.5, 2.12),
    (37.8, 2.13),
    (38.1, 1.94),
    (38.4, 1.59),
    (38.7, 1.13),
    (39.0, 0.94),
    (39.3, 0.90),
    (39.6, 0.94),
    (40.0, 1.06),
    (40.3, 1.03),
    (40.6, 0.84),
    (40.9, 0.51),
    (41.2, 0.30),
  ]:
    for j in range(8):
      a = 2 * math.pi * (j + 0.5) / 8
      c = [tower[0] + math.cos(a) * radius, y, tower[2] + math.sin(a) * radius]
      member(
        c, 2 * radius * math.tan(math.pi / 8), 0.33, 0.13, -a + math.pi / 2, COPPER
      )
  member([tower[0], 41.95, tower[2]], 0.13, 1.35, 0.13, 0, DARK)
  # Clock diameter and static hands are recognition estimates, not a timepiece.
  first_clock_native = len(g["nativeRows"])
  for i in range(32):
    a, b = 2 * math.pi * i / 32, 2 * math.pi * (i + 1) / 32
    stroke(
      towerpoint(1.10 * math.cos(a), 31.10 + 1.10 * math.sin(a), 2.23),
      towerpoint(1.10 * math.cos(b), 31.10 + 1.10 * math.sin(b), 2.23),
      0.075,
      FRAME,
    )
  for i in range(12):
    a = 2 * math.pi * i / 12
    stroke(
      towerpoint(0.84 * math.cos(a), 31.10 + 0.84 * math.sin(a), 2.25),
      towerpoint(math.cos(a), 31.10 + math.sin(a), 2.25),
      0.06,
      FRAME,
    )
  for u, y in [(0.0, 31.90), (-0.55, 30.82)]:
    stroke(towerpoint(0, 31.10, 2.27), towerpoint(u, y, 2.27), 0.08, FRAME)
  # The retained native roof is stepped above the measured drawn roof. Lift
  # only this complete native turret just enough to clear its actual top.
  roof_bounds = [tower[0] - 3, tower[2] - 3, tower[0] + 3, tower[2] + 3]
  native_roof_spans, native_roof_receipts = [], {}
  for packet in ["packet-006.json", "packet-007.json"]:
    path = DATA / "altMitteV169Navigation" / packet
    native_roof_receipts[str(path.relative_to(ROOT))] = hashlib.sha256(
      path.read_bytes()
    ).hexdigest()
    native_roof_spans.extend(
      r
      for r in read(path)
      if r[0] < roof_bounds[2]
      and r[2] > roof_bounds[0]
      and r[1] < roof_bounds[3]
      and r[3] > roof_bounds[1]
    )
  native_roof_y = max(r[4] for r in native_roof_spans)
  clock_bottom = min(r[1] - r[4] / 2 for r in g["nativeRows"][first_clock_native:])
  native_tower_lift = max(
    0, math.ceil((native_roof_y + 0.15 - clock_bottom) * 100) / 100
  )
  for row in g["nativeRows"][start[2] :]:
    row[1] += native_tower_lift
  native_clock_audit = {
    "roofBounds": roof_bounds,
    "roofSpans": native_roof_spans,
    "roofPacketReceipts": native_roof_receipts,
    "roofTopY": native_roof_y,
    "unshiftedClockBottomY": clock_bottom,
    "clearanceM": 0.15,
    "offsetY": native_tower_lift,
    "nativeFirst": start[2],
    "nativeCount": len(g["nativeRows"]) - start[2],
    "clockNativeFirst": first_clock_native,
  }
  mark("Koppenplatz school: documented clock turret recognition", start)

  start = cursor()
  raw = next(r for r in source["faces"] if r["owner"] == "DEBE01YYK0000DXF")
  f = Face(g, raw["rings"])
  mid, length = (f.left + f.right) / 2, f.right - f.left
  f.member(mid, f.base + 3.40, length - 0.18, 0.69, DARK, 0.07, 0.42)
  f.member(mid, f.base + 3.81, length - 0.10, 0.09, FRAME, 0.14, 0.44)
  for u in [f.left + 0.20, f.right - 0.20]:
    f.member(u, f.base + 1.65, 0.11, 2.90, DARK, 0.09, 0.42)
  # Explicitly familiar historical name requested by the owner. Current retained
  # OSM node 3902472802 instead names Symple Coffee Mitte; no POI is relabelled.
  d = f.d if f.d[0] > 0 else -f.d
  g["labels"].append(
    {
      "text": "MILCHHALLE",
      "center": f.point(mid, f.base + 3.40, 0.49),
      "direction": d.tolist(),
      "normal": f.n.tolist(),
      "height": 0.44,
      "color": FRAME,
    }
  )
  mark("Auguststraße 50: historical Milchhalle storefront sign", start)

  start = cursor()
  ground = read(ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json")
  ground_samples, edge_audit = [], []
  edge_ids = {"1065187943", "1065187944", "1146128553", "1146128554"}
  for feature in source["features"]:
    p = feature["properties"]
    if p.get("osm_way_id") not in edge_ids:
      continue
    polygon = shape(feature["geometry"]).geoms[0]
    for ring in [polygon.exterior, *polygon.interiors]:
      for a, b in zip(ring.coords, list(ring.coords)[1:]):
        length = math.dist(a, b)
        if length < 0.005:
          continue
        h = ground["ground_height"]
        samples = []
        for point in [a, b]:
          x = point[0] / ground["cell_m"] - ground["grid"]["min_x_idx"]
          z = point[1] / ground["cell_m"] - ground["grid"]["min_z_idx"]
          col, row = int(x // h["stride_cells"]), int(z // h["stride_cells"])
          samples.append(h["y_dm"][row * h["cols"] + col] / 10)
        assert samples == [5.2, 5.2]
        ground_samples.extend(samples)
        member(
          [(a[0] + b[0]) / 2, 5.225, (a[1] + b[1]) / 2],
          length,
          0.045,
          0.075,
          -math.atan2(b[1] - a[1], b[0] - a[0]),
          STONE,
        )
        edge_audit.append({"owner": p["osm_way_id"], "a": list(a), "b": list(b)})
    assert polygon.is_valid
  mark("Gipsdreieck and Koppenplatz: exact grass and flowerbed edge courses", start)

  colors = sorted(
    {int(r[-1]) for key in ["boxes", "rods", "nativeRows"] for r in g[key]}
  )

  def pack(row: list, kind: str) -> list:
    stop = 6 if kind == "rods" else 3
    return [
      round((float(v) - (ORIGIN[i % 3] if i < stop else 0)) * 1000)
      if i < (7 if kind == "rods" else 6)
      else round(v * 1e6)
      if i == 6 and kind == "boxes"
      else colors.index(int(v))
      for i, v in enumerate(row)
    ]

  payload = {
    "schemaVersion": 1,
    "owner": OWNER,
    "origin": ORIGIN,
    "palette": colors,
    **{k: [pack(r, k) for r in g[k]] for k in ["boxes", "rods", "nativeRows"]},
    "labels": g["labels"],
    "previous": {k: fingerprint(old[k]) for k in ["boxes", "rods", "nativeRows"]},
    "counts": {k: len(g[k]) for k in ["boxes", "rods", "nativeRows"]},
    "koppenReplacement": {
      "oldVerifiedPanes": 56,
      "occupiedLevels": 3,
      "newPanes": len(koppen_openings),
    },
  }
  evidence = {
    "schemaVersion": 1,
    "source": "gips-koppen-v252-source.json",
    "sourceSha256": hashlib.sha256(
      (GEO / "gips-koppen-v252-source.json").read_bytes()
    ).hexdigest(),
    "sections": sections,
    "faceAudit": g["faces"],
    "koppenOpenings": koppen_openings,
    "koppenOldPacketReceipts": packet_receipts,
    "edgeAudit": edge_audit,
    "mainSchoolLevels": levels,
    "clockTowerCenter": tower,
    "clockTowerTopY": 42.625,
    "nativeClockClearance": native_clock_audit,
    "groundSamples": sorted(set(ground_samples)),
    "replacedAuthoredOwner": OWNER,
    "previous": payload["previous"],
    "policy": "Only the exact v205 main-school decoration yields to its four-storey replacement. The exact 56 verified old Koppenplatz openings and their six source faces receive a source-clipped facing and complete three-storey replacement; original packet triangles remain retained behind it. Every measured building, roof, court hole, v185 detail and unrelated v205 group remains. All facade/clock/edge dimensions and hues are display estimates. No new descriptor, material, frame loop, source territory or navigation floor.",
    "milchhalleConflict": "Requested historical MILCHHALLE recognition at Auguststrasse 50. Retained current OSM cafe node 3902472802 is Symple Coffee Mitte; its source identity remains unchanged.",
    "limits": "Koppenplatz has three photo-supported occupied levels and taller central Aula openings. Individual spacing, small fitting dimensions and colors remain proportional estimates, not a surveyed elevation. The source-clipped facing lies outside the exact earlier verified pane/detail register and never substitutes a measured roof or courtyard. Kastanienbaum main has four source-described levels on the corrected selected face only. Other main-school source faces gain only cornice details, without competing panes. Ground edging is a 4.5 cm finish following complete existing plant-bed rings, never a filled plaza or barrier across paths.",
  }
  return payload, evidence


if __name__ == "__main__":
  payload, evidence = build()
  for path, value in [
    (DATA / "gipsKoppenV252.json", payload),
    (GEO / "gips-koppen-v252-evidence.json", evidence),
  ]:
    path.write_text(json.dumps(value, separators=(",", ":")) + "\n")
  print(
    json.dumps(
      {**payload["counts"], "jsonBytes": (DATA / "gipsKoppenV252.json").stat().st_size}
    )
  )
