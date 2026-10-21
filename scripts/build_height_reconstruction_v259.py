"""Step 10: three evidenced upper structures above immutable existing bodies.

The source capture retains the original owners, coordinates, complete packet
navigation and byte receipts. Only the three new companion files are written.
Drawn recognition and orthogonal native construction are independent.
"""

from __future__ import annotations

import base64
import json
import math
from collections import Counter
from pathlib import Path
from typing import Any

import build_district_facades_v188 as base
import numpy as np
import shapely
from build_surrounding_outlines import PackedMesh
from shapely.geometry import Point, Polygon, box, shape

GEO, OUT = base.GEO, base.OUT
SOURCE = GEO / "height-reconstruction-v259-source.json.gz"
EVIDENCE = GEO / "height-reconstruction-v259-evidence.json"
ADDITION = GEO / "height-reconstruction-v259-manifest-addition.json"
KIND = "height-reconstruction-v259"
POLICY = (
  "Three source-bound upper reconstructions only: Emmaus, Apostel-Paulus and "
  "LUX/Narva. Every earlier packet, source envelope and navigation record stays "
  "byte-identical. New geometry begins above each family's retained body. "
  "Parish overall heights 74/86 m and mapped LUX height 63 m are distinct from "
  "estimated shaft widths, stage heights, clock faces and decorative fittings. "
  "All new plan vertices remain within the mapped source owner. Native geometry "
  "is independently orthogonal. No new terrain, navigation, texture, animation, "
  "coverage, tour stop or live residency allowance."
)
DIMENSIONS = (
  "OSM perimeter and complete retained LoD2 sheets are source coordinates. "
  "Parish heights are published overall dimensions, not individual surveys. "
  "LUX 63 m/16 levels is explicit OSM evidence. All intermediate stage heights, "
  "shafts, spire proportions, corner pinnacles, clocks, glazing and materials "
  "are reference-guided display estimates. No independent surveyed church "
  "tower-only polygon exists in the retained OSM extract."
)
BRICK = (155, 77, 53)
BRICK_LIGHT = (188, 107, 73)
BRICK_DARK = (105, 49, 39)
STONE = (193, 157, 113)
DARK = (37, 43, 46)
SLATE = (71, 78, 83)
GLASS = (79, 132, 143)
METAL = (169, 184, 182)


def positions(packet: dict[str, Any]) -> np.ndarray:
  """Decode stored coordinates with their declared packet origin."""
  arrays = []
  for mesh in packet["meshes"]:
    dtype = "<u2" if mesh["positionType"] == "u16cm" else "<f4"
    values = np.frombuffer(base64.b64decode(mesh["positions"]), dtype=dtype)
    points = values.reshape(-1, 3).astype(float)
    if mesh["positionType"] == "u16cm":
      points = points * 0.01 + np.array(packet["origin"])
    arrays.append(points)
  return np.concatenate(arrays) if arrays else np.empty((0, 3))


def extract() -> dict[str, Any]:
  """Freeze the independently audited source capture; normal builds use it."""
  cache = Path.home() / ".cache/codex-berlin-v259/height-candidates.json"
  audit = base.read_json(cache)
  sites, receipts = [], {}
  for candidate in audit["sites"]:
    site = dict(candidate)
    site["topY"] = 3 + site["referenceHeightAboveGroundM"]
    site["families"] = {}
    owner = shape(site["osmWorldGeometry"])
    for family in ("drawn", "minecraft"):
      desc = site["parentDescriptor"][family]
      path = OUT / desc["url"]
      packet = base.read_json(path)
      points = positions(packet)
      selected = points[
        shapely.contains_xy(owner.buffer(0.15), points[:, 0], points[:, 2])
      ]
      envelope = [float(selected[:, 1].min()), float(selected[:, 1].max())]
      site["families"][family] = {
        "origin": packet["origin"],
        "originalPacketUrl": desc["url"],
        "sha256": base.digest(path),
        "originalNav": packet["nav"],
        "ownerBuildings": [
          b
          for b in packet["nav"]["buildings"]
          if b.get("sourceId") == site["sourceParent"]
        ],
        "originalYEnvelope": envelope,
        "minimumNewY": round(envelope[1] + 0.02, 2),
      }
      receipts[desc["url"]] = {"sha256": base.digest(path), "nav": packet["nav"]}
    if site["id"] == "emmaus":
      center, axis = [3993.4835, 2211.6715], [1.869, 7.199]
      plan = {
        "centerXZ": center,
        "longAxis": axis,
        "maximumWidthM": 11.6,
        "shaftWidthM": 8.8,
        "sourcePartId": "DEBE3DDI5SoKMeMq",
        "orientationEvidence": "Exact southern LoD2 tower/annex part and its roof ridge; reference photograph separates surviving tower from north nave.",
      }
    elif site["id"] == "apostelPaulus":
      center, axis = [-1347.083, 3257.539], [7.068, 46.279]
      plan = {
        "centerXZ": center,
        "longAxis": axis,
        "maximumWidthM": 10.8,
        "shaftWidthM": 8.4,
        "sourcePartId": site["sourceParent"],
        "orientationEvidence": "Official heritage record identifies square north tower at Grunewaldstrasse; exact northern source ridge point anchors the estimated shaft.",
      }
    else:
      center, axis = site["osmCentroidXZ"], [-11.049, 22.775]
      plan = {
        "centerXZ": center,
        "longAxis": axis,
        "maximumWidthM": 23,
        "glassDepthM": 24,
        "brickWidthM": 19,
        "brickDepthM": 20,
        "orientationEvidence": "Exact independent OSM tower perimeter. Rectangular stages are conservative inset estimates; the glass block overhangs only the narrower new brick shaft.",
      }
      site["references"].extend(
        [
          {
            "url": "https://undmica.de/projekte/2131/",
            "evidence": "Project architect confirms five-storey glass addition on historic industrial tower; future lighting/lettering proposals are not reconstructed.",
          },
          {
            "url": "https://undmica.de/wp-content/uploads/2023/10/LUX_Tower_Fotos_Hans_Glave-5-768x542.jpg.webp",
            "evidence": "Hans Glave photograph, reference only; no pixels bundled.",
          },
          {
            "url": "https://lux.berlin/lux-tower/",
            "evidence": "Current property identity and existing upper glass block.",
          },
        ]
      )
    plan["center"] = center
    plan["dimensionStatus"] = (
      "Explicit display estimate, wholly within original OSM owner"
    )
    site["estimatedPlan"] = plan
    sites.append(site)
  source = {
    "schemaVersion": 1,
    "policy": POLICY,
    "dimensionStatus": DIMENSIONS,
    "worldOrigin": [389500, 30, 5820000],
    "sites": sites,
    "packetReceipts": receipts,
    "excludedCompleteOwners": audit["excluded"],
  }
  base.write_json(SOURCE, source)
  return source


class Model:
  """Offline surface writer with a source-bounded local coordinate frame."""

  def __init__(self, site: dict[str, Any], family: str) -> None:
    self.site = site
    self.family = family
    self.origin = site["families"][family]["origin"]
    assert self.origin[1] == -10
    self.mesh = PackedMesh(self.origin[0], self.origin[2])
    self.center = np.array(site["estimatedPlan"]["centerXZ"])
    self.v = np.array(site["estimatedPlan"]["longAxis"], dtype=float)
    self.v /= np.linalg.norm(self.v)
    self.u = np.array([self.v[1], -self.v[0]])
    self.low = site["families"][family]["minimumNewY"]
    self.count: Counter[str] = Counter()

  def point(self, x: float, y: float, z: float) -> tuple[float, float, float]:
    """Transform a drawn-model point; native uses direct world coordinates."""
    p = self.center + self.u * x + self.v * z
    return float(p[0]), float(y), float(p[1])

  def quad(self, points: list, colour: tuple) -> None:
    """Emit two exact indexed surface triangles."""
    self.mesh.triangle(points[:3], colour)
    self.mesh.triangle([points[0], points[2], points[3]], colour)

  def prism(
    self, ring: list, low: float, high: float, colour: tuple, cap: bool = True
  ) -> None:
    """Write exposed side sheets and optional upper cap, never solid infill."""
    for a, b in zip(ring, ring[1:] + ring[:1]):
      self.quad(
        [(a[0], low, a[1]), (b[0], low, b[1]), (b[0], high, b[1]), (a[0], high, a[1])],
        colour,
      )
    if cap:
      self.mesh.surface(Polygon(ring), high, colour)
    self.count["surfacePrisms"] += 1

  def local_ring(
    self, width: float, depth: float | None = None, x: float = 0, z: float = 0
  ) -> list:
    """Return an oriented estimated rectangle anchored in the source owner."""
    depth = width if depth is None else depth
    return [
      [p[0], p[2]]
      for p in [
        self.point(x + u, 0, z + v)
        for u, v in [
          (-width / 2, -depth / 2),
          (width / 2, -depth / 2),
          (width / 2, depth / 2),
          (-width / 2, depth / 2),
        ]
      ]
    ]

  def local_box(
    self,
    x: float,
    z: float,
    width: float,
    depth: float,
    low: float,
    high: float,
    colour: tuple,
  ) -> None:
    """Draw one source-oriented surface box."""
    self.prism(self.local_ring(width, depth, x, z), low, high, colour)

  def octagon(self, radius: float, x: float = 0, z: float = 0) -> list:
    """Eight-sided source-oriented church crown in the drawn representation."""
    return [
      [p[0], p[2]]
      for p in [
        self.point(x + radius * math.cos(a), 0, z + radius * math.sin(a))
        for a in np.arange(8) * math.pi / 4 + math.pi / 8
      ]
    ]

  def taper(
    self,
    radius: float,
    low: float,
    high: float,
    colour: tuple,
    x: float = 0,
    z: float = 0,
  ) -> None:
    """Eight open-bottom slate faces with restrained alternating light."""
    ring = self.octagon(radius, x, z)
    tip = self.point(x, high, z)
    for i, (a, b) in enumerate(zip(ring, ring[1:] + ring[:1])):
      shade = tuple(max(0, min(255, c + (8 if i % 3 == 0 else 0))) for c in colour)
      self.mesh.triangle([(a[0], low, a[1]), (b[0], low, b[1]), tip], shade)
    self.count["octagonalSpires"] += 1

  def member(self, a: tuple, b: tuple, width: float, colour: tuple) -> None:
    """A small surface-only three-dimensional architectural stroke."""
    a, b = np.array(a), np.array(b)
    d = b - a
    d /= np.linalg.norm(d)
    trial = np.array([0.0, 1.0, 0.0]) if abs(d[1]) < 0.95 else np.array([1.0, 0.0, 0.0])
    u = np.cross(d, trial)
    u *= width / (2 * np.linalg.norm(u))
    v = np.cross(d, u)
    corners = [u + v, -u + v, -u - v, u - v]
    for i in range(4):
      self.quad(
        [
          tuple(a + corners[i]),
          tuple(a + corners[(i + 1) % 4]),
          tuple(b + corners[(i + 1) % 4]),
          tuple(b + corners[i]),
        ],
        colour,
      )

  def face_point(
    self, side: int, horizontal: float, y: float, distance: float
  ) -> tuple:
    """Locate a detail on one of four drawn tower faces."""
    angle = side * math.pi / 2
    return self.point(
      math.cos(angle) * distance - math.sin(angle) * horizontal,
      y,
      math.sin(angle) * distance + math.cos(angle) * horizontal,
    )

  def panel(
    self,
    side: int,
    horizontal: float,
    y: float,
    width: float,
    height: float,
    distance: float,
    colour: tuple,
  ) -> None:
    """Shallow exterior plane, retaining the new body behind its opening cue."""
    self.quad(
      [
        self.face_point(side, horizontal - width / 2, y - height / 2, distance),
        self.face_point(side, horizontal + width / 2, y - height / 2, distance),
        self.face_point(side, horizontal + width / 2, y + height / 2, distance),
        self.face_point(side, horizontal - width / 2, y + height / 2, distance),
      ],
      colour,
    )

  def lancet(
    self,
    side: int,
    horizontal: float,
    low: float,
    high: float,
    width: float,
    distance: float,
  ) -> None:
    """Pointed belfry recess, brick arch, central shaft and dark louvers."""
    spring = high - width * 0.85
    self.panel(
      side, horizontal, (low + spring) / 2, width, spring - low, distance, DARK
    )
    a = self.face_point(side, horizontal - width / 2, spring, distance)
    b = self.face_point(side, horizontal + width / 2, spring, distance)
    top = self.face_point(side, horizontal, high, distance)
    self.mesh.triangle([a, b, top], DARK)
    for h in (-width / 2, width / 2):
      self.member(
        self.face_point(side, horizontal + h, low, distance + 0.06),
        self.face_point(side, horizontal + h, spring, distance + 0.06),
        0.15,
        BRICK_LIGHT,
      )
      self.member(
        self.face_point(side, horizontal + h, spring, distance + 0.06),
        self.face_point(side, horizontal, high + 0.08, distance + 0.06),
        0.16,
        BRICK_LIGHT,
      )
    self.member(
      self.face_point(side, horizontal, low, distance + 0.08),
      self.face_point(side, horizontal, spring, distance + 0.08),
      0.10,
      STONE,
    )
    for y in np.arange(low + 0.45, spring, 0.55):
      self.panel(
        side, horizontal, float(y), width - 0.12, 0.12, distance + 0.05, (76, 67, 56)
      )
    self.count["pointedBelfryOpenings"] += 1

  def clock(self, side: int, y: float, radius: float, distance: float) -> None:
    """One unlabelled clock, with twelve marks and two static hands."""
    for r, col, dep in [
      (radius + 0.16, BRICK_DARK, distance),
      (radius + 0.08, STONE, distance + 0.025),
      (radius, (196, 210, 209), distance + 0.05),
    ]:
      mid = self.face_point(side, 0, y, dep)
      for a in np.arange(24) * math.pi / 12:
        self.mesh.triangle(
          [
            mid,
            self.face_point(side, r * math.sin(a), y + r * math.cos(a), dep),
            self.face_point(
              side,
              r * math.sin(a + math.pi / 12),
              y + r * math.cos(a + math.pi / 12),
              dep,
            ),
          ],
          col,
        )
    for a in np.arange(12) * math.pi / 6:
      self.member(
        self.face_point(
          side,
          0.77 * radius * math.sin(a),
          y + 0.77 * radius * math.cos(a),
          distance + 0.08,
        ),
        self.face_point(
          side,
          0.92 * radius * math.sin(a),
          y + 0.92 * radius * math.cos(a),
          distance + 0.08,
        ),
        0.06,
        DARK,
      )
    for angle, length in [(-math.pi / 3, 0.67), (math.pi / 3, 0.85)]:
      self.member(
        self.face_point(side, 0, y, distance + 0.11),
        self.face_point(
          side,
          length * radius * math.sin(angle),
          y + length * radius * math.cos(angle),
          distance + 0.11,
        ),
        0.09,
        DARK,
      )
    self.count["clocks"] += 1


def drawn_church(model: Model) -> None:
  """Reference-led brick shaft, clock stage, belfry, pinnacles and slate helm."""
  emmaus = model.site["id"] == "emmaus"
  width = 8.8 if emmaus else 8.4
  shoulder, spire_base, spire_top = (49.0, 63.0, 75.7) if emmaus else (51.0, 63.5, 87.7)
  model.local_box(0, 0, width, width, model.low, shoulder, BRICK)
  for x in (-width / 2 + 0.25, width / 2 - 0.25):
    for z in (-width / 2 + 0.25, width / 2 - 0.25):
      model.local_box(x, z, 0.85, 0.85, model.low, shoulder + 1, BRICK_LIGHT)
  for y in [model.low + 0.35, 34.8, 39.8, 46.8, shoulder - 0.2]:
    model.local_box(0, 0, width + 0.25, width + 0.25, y, y + 0.28, BRICK_LIGHT)
    model.local_box(0, 0, width + 0.32, width + 0.32, y - 0.10, y, BRICK_DARK)
  for side in range(4):
    model.clock(
      side, 43.0 if emmaus else 42.0, 0.82 if emmaus else 1.04, width / 2 + 0.04
    )
    for horizontal in (-2.65, 2.65):
      model.lancet(side, horizontal, model.low + 1.2, 37.8, 0.76, width / 2 + 0.04)
  crown = model.octagon(4.65) if emmaus else model.local_ring(8.4)
  model.prism(crown, shoulder, spire_base, BRICK)
  for y in [shoulder + 0.25, spire_base - 0.75, spire_base - 0.25]:
    ring = model.octagon(4.8) if emmaus else model.local_ring(8.7)
    model.prism(ring, y, y + 0.23, BRICK_LIGHT)
  for side in range(4):
    if emmaus:
      model.lancet(side, 0, 51.2, 60.8, 2.35, 4.32)
    else:
      for horizontal in (-1.35, 1.35):
        model.lancet(side, horizontal, 51.9, 61.4, 1.75, 4.23)
    # Tall pointed pediments interrupt the eave at each cardinal face.
    y = spire_base - 0.3
    a = model.face_point(side, -2.1, y, 4.24)
    b = model.face_point(side, 2.1, y, 4.24)
    top = model.face_point(side, 0, y + 3.6, 4.24)
    model.mesh.triangle([a, b, top], BRICK_LIGHT)
    model.member(a, top, 0.19, STONE)
    model.member(b, top, 0.19, STONE)
  model.taper(4.65, spire_base, spire_top, SLATE)
  for a in np.arange(8) * math.pi / 4 + math.pi / 8:
    model.member(
      model.point(4.65 * math.cos(a), spire_base, 4.65 * math.sin(a)),
      model.point(0, spire_top, 0),
      0.075,
      (124, 126, 120),
    )
  for y in np.arange(spire_base + 3, spire_top - 1, 3):
    r = 4.65 * (spire_top - y) / (spire_top - spire_base)
    ring = model.octagon(float(r))
    for a, b in zip(ring, ring[1:] + ring[:1]):
      model.member((a[0], float(y), a[1]), (b[0], float(y), b[1]), 0.045, (91, 96, 96))
  # Four corner fials, bounded well inside the same retained church outline.
  for x, z in [(-3.8, -3.8), (3.8, -3.8), (3.8, 3.8), (-3.8, 3.8)]:
    model.local_box(x, z, 0.72, 0.72, spire_base - 3, spire_base + 1.5, BRICK_LIGHT)
    model.taper(
      0.55, spire_base + 1.5, spire_base + (5.2 if emmaus else 6.5), SLATE, x, z
    )
    model.count["cornerPinnacles"] += 1
  model.member(
    model.point(0, spire_top, 0),
    model.point(0, model.site["topY"], 0),
    0.13,
    (115, 104, 79),
  )
  model.member(
    model.point(-0.42, model.site["topY"] - 0.55, 0),
    model.point(0.42, model.site["topY"] - 0.55, 0),
    0.11,
    (115, 104, 79),
  )


def drawn_lux(model: Model) -> None:
  """Historic brick shaft, open support gap and five-storey glass cube."""
  model.local_box(0, 0, 19, 20, model.low, 42, BRICK)
  for side in range(4):
    distance = 9.5 if side % 2 == 0 else 10
    width = 20 if side % 2 == 0 else 19
    for u in np.arange(-width / 2 + 2, width / 2 - 1, 3):
      model.panel(side, float(u), 33.3, 1.25, 2.8, distance + 0.035, DARK)
      model.panel(side, float(u), 33.3, 0.95, 2.6, distance + 0.06, GLASS)
      model.panel(side, float(u), 38.6, 1.65, 5.3, distance + 0.04, (174, 190, 188))
      model.panel(side, float(u), 38.6, 1.28, 5.1, distance + 0.07, GLASS)
    for y in [35.3, 41.5]:
      model.panel(side, 0, y, width, 0.3, distance + 0.10, STONE)
  for x in (-8.8, 8.8):
    for z in (-9.2, 9.2):
      model.local_box(x, z, 0.9, 0.9, model.low, 43.6, BRICK_LIGHT)
  for x in (-7, 7):
    for z in (-7, 7):
      model.local_box(x, z, 1.05, 1.05, 42, 45, (81, 85, 80))
  model.local_box(0, 0, 22.8, 23.8, 44.6, 45.0, METAL)
  model.local_box(0, 0, 22.8, 23.8, 45, 64, GLASS)
  for side in range(4):
    distance = 11.4 if side % 2 == 0 else 11.9
    width = 23.8 if side % 2 == 0 else 22.8
    for level in range(5):
      bottom = 45 + level * 3.8
      for i, u in enumerate(np.arange(-width / 2 + 0.6, width / 2, 0.82)):
        model.panel(
          side,
          float(u),
          bottom + 1.84,
          0.63,
          3.42,
          distance + 0.025,
          (77 + 5 * (i % 3), 131 + 6 * (i % 2), 145 + 4 * (i % 3)),
        )
        model.panel(
          side, float(u) + 0.38, bottom + 1.86, 0.065, 3.55, distance + 0.055, METAL
        )
      model.panel(side, 0, bottom + 0.11, width, 0.22, distance + 0.07, (179, 195, 190))
      model.panel(
        side, 0, bottom + 3.68, width, 0.20, distance + 0.075, (181, 192, 187)
      )
    model.count["glassStoreys"] = 5
  model.local_box(0, 0, 23, 24, 64, 64.35, METAL)
  model.local_box(-1, 0, 9, 6, 64.35, 65.65, (194, 197, 188))
  model.local_box(-1, 0, 9.2, 6.2, 65.65, 66, (166, 174, 169))
  for x in np.arange(-4.5, 3.1, 1.1):
    model.local_box(float(x), -3.03, 0.08, 0.06, 64.6, 65.4, DARK)


def native_box(
  model: Model,
  x: float,
  z: float,
  width: float,
  depth: float,
  low: float,
  high: float,
  colour: tuple,
) -> None:
  """Native primitive has only world-axis-parallel faces."""
  model.prism(
    [
      [x - width / 2, z - depth / 2],
      [x + width / 2, z - depth / 2],
      [x + width / 2, z + depth / 2],
      [x - width / 2, z + depth / 2],
    ],
    low,
    high,
    colour,
  )


def pixel_ring(
  model: Model,
  polygon: Polygon,
  low: float,
  high: float,
  colour: tuple,
  cell: float = 0.65,
) -> None:
  """Independent whole-cell plan with boundary walls, never rotated sheets."""
  minx, minz, maxx, maxz = polygon.bounds
  occupied = set()
  for ix in range(math.floor(minx / cell), math.ceil(maxx / cell)):
    for iz in range(math.floor(minz / cell), math.ceil(maxz / cell)):
      if polygon.covers(box(ix * cell, iz * cell, (ix + 1) * cell, (iz + 1) * cell)):
        occupied.add((ix, iz))

  def runs(values: list[int]) -> list[tuple[int, int]]:
    """Coalesce adjacent identical source cells without changing their union."""
    if not values:
      return []
    values = sorted(values)
    start = previous = values[0]
    spans = []
    for value in values[1:]:
      if value != previous + 1:
        spans.append((start, previous + 1))
        start = value
      previous = value
    spans.append((start, previous + 1))
    return spans

  # Merge each row of top cells and each collinear exposed boundary exactly.
  # This is a lossless mesh compaction, not coarser native geometry.
  rows = sorted({iz for _, iz in occupied})
  columns = sorted({ix for ix, _ in occupied})
  for iz in rows:
    for left, right in runs([ix for ix, row in occupied if row == iz]):
      x0, x1, z0, z1 = left * cell, right * cell, iz * cell, (iz + 1) * cell
      model.quad(
        [(x0, high, z0), (x1, high, z0), (x1, high, z1), (x0, high, z1)], colour
      )
    for direction in (-1, 1):
      edges = [
        ix for ix, row in occupied if row == iz and (ix, iz + direction) not in occupied
      ]
      zz = (iz + (1 if direction == 1 else 0)) * cell
      for left, right in runs(edges):
        x0, x1 = left * cell, right * cell
        model.quad(
          [(x0, low, zz), (x1, low, zz), (x1, high, zz), (x0, high, zz)], colour
        )
  for ix in columns:
    for direction in (-1, 1):
      edges = [
        iz for col, iz in occupied if col == ix and (ix + direction, iz) not in occupied
      ]
      xx = (ix + (1 if direction == 1 else 0)) * cell
      for start, end in runs(edges):
        z0, z1 = start * cell, end * cell
        model.quad(
          [(xx, low, z0), (xx, low, z1), (xx, high, z1), (xx, high, z0)], colour
        )
  model.count["orthogonalPlanCells"] += len(occupied)


def native_church(model: Model) -> None:
  """Independent block tower: square clocks, stepped gables and helm."""
  x, z = model.center
  emmaus = model.site["id"] == "emmaus"
  width = 7.8 if emmaus else 7.2
  shoulder = 49 if emmaus else 51
  start = 63 if emmaus else 63.5
  end = 75.7 if emmaus else 87.7
  native_box(model, x, z, width, width, model.low, shoulder, BRICK)
  for y in [model.low + 0.3, 34.8, 39.8, 46.8, shoulder - 0.2]:
    native_box(model, x, z, width + 0.35, width + 0.35, y, y + 0.3, BRICK_LIGHT)
  for dx in (-width / 2 + 0.2, width / 2 - 0.2):
    for dz in (-width / 2 + 0.2, width / 2 - 0.2):
      native_box(
        model, x + dx, z + dz, 0.65, 0.65, model.low, shoulder + 0.8, BRICK_LIGHT
      )
  crown = (
    Point(x, z).buffer(4.5, quad_segs=2)
    if emmaus
    else box(x - 3.6, z - 3.6, x + 3.6, z + 3.6)
  )
  pixel_ring(model, crown, shoulder, start, BRICK)
  for y in [shoulder + 0.2, start - 0.75, start - 0.25]:
    pixel_ring(model, crown.buffer(0.16, join_style="mitre"), y, y + 0.22, BRICK_LIGHT)
  for side in range(4):
    dx, dz = [(1, 0), (0, 1), (-1, 0), (0, -1)][side]
    y = 43 if emmaus else 42
    distance = width / 2 + 0.03
    # Native clocks are square block faces, deliberately not smooth discs.
    native_box(
      model,
      x + dx * distance,
      z + dz * distance,
      0.12 if dx else 1.8,
      1.8 if dx else 0.12,
      y - 0.9,
      y + 0.9,
      STONE,
    )
    native_box(
      model,
      x + dx * (distance + 0.07),
      z + dz * (distance + 0.07),
      0.09 if dx else 1.5,
      1.5 if dx else 0.09,
      y - 0.75,
      y + 0.75,
      (192, 208, 205),
    )
    native_box(
      model,
      x + dx * (distance + 0.13),
      z + dz * (distance + 0.13),
      0.06 if dx else 0.11,
      0.11 if dx else 0.06,
      y - 0.08,
      y + 0.56,
      DARK,
    )
    native_box(
      model,
      x + dx * (distance + 0.15) + dz * 0.24,
      z + dz * (distance + 0.15) + dx * 0.24,
      0.07 if dx else 0.55,
      0.55 if dx else 0.07,
      y - 0.05,
      y + 0.06,
      DARK,
    )
    model.count["clocks"] += 1
    # Two orthogonal louver recesses per cardinal belfry face.
    for u in (-1.15, 1.15):
      dist = 3.53 if not emmaus else 3.9
      cx, cz = x + dx * dist + dz * u, z + dz * dist + dx * u
      native_box(
        model, cx, cz, 0.12 if dx else 1.25, 1.25 if dx else 0.12, 52, 59.9, DARK
      )
      for row in range(12):
        yy = 52.35 + row * 0.58
        native_box(
          model,
          cx + dx * 0.08,
          cz + dz * 0.08,
          0.09 if dx else 1.3,
          1.3 if dx else 0.09,
          yy,
          yy + 0.12,
          BRICK_LIGHT,
        )
      for step in range(4):
        w = 1.25 * (1 - step * 0.22)
        native_box(
          model,
          cx,
          cz,
          0.14 if dx else w,
          w if dx else 0.14,
          59.9 + step * 0.35,
          60.25 + step * 0.35,
          DARK,
        )
      model.count["pointedBelfryOpenings"] += 1
  stages = max(12, math.ceil((end - start) / 0.75))
  for i in range(stages):
    low = start + (end - start) * i / stages
    high = start + (end - start) * (i + 1) / stages
    radius = max(0.38, 4.5 * (1 - i / stages))
    # Pixel-plan cones produce axis-parallel stepped octagonal silhouettes.
    pixel_ring(model, Point(x, z).buffer(radius, quad_segs=2), low, high, SLATE, 0.38)
  for dx, dz in [(-3.05, -3.05), (3.05, -3.05), (3.05, 3.05), (-3.05, 3.05)]:
    native_box(model, x + dx, z + dz, 0.7, 0.7, start - 3, start + 1.5, BRICK_LIGHT)
    for i in range(6):
      w = max(0.16, 0.75 * (1 - i / 6))
      native_box(
        model, x + dx, z + dz, w, w, start + 1.5 + i * 0.6, start + 2.1 + i * 0.6, SLATE
      )
    model.count["cornerPinnacles"] += 1
  native_box(model, x, z, 0.18, 0.18, end, model.site["topY"], (115, 104, 79))
  native_box(
    model,
    x,
    z,
    0.8,
    0.18,
    model.site["topY"] - 0.6,
    model.site["topY"] - 0.46,
    (115, 104, 79),
  )


def native_lux(model: Model) -> None:
  """Axis-aligned stepped industrial and glazed volumes, derived independently."""
  brick = Polygon(model.local_ring(19, 20))
  glass = Polygon(model.local_ring(22.8, 23.8))
  pixel_ring(model, brick, model.low, 42, BRICK, 0.8)
  for y in [35.3, 41.5]:
    pixel_ring(model, brick, y, y + 0.3, STONE, 0.8)
  for px, pz in model.local_ring(14, 14):
    native_box(model, px, pz, 1, 1, 42, 45, (81, 85, 80))
  pixel_ring(model, glass, 44.6, 45, METAL, 0.8)
  for level in range(5):
    low = 45 + level * 3.8
    pixel_ring(model, glass, low, low + 3.8, GLASS, 0.8)
    pixel_ring(model, glass, low, low + 0.24, METAL, 0.8)
    # Upright mullions follow only world-axis staircase boundary segments.
    for p in shapely.get_parts(shapely.boundary(glass)):
      for t in np.arange(0.05, 0.98, 0.09):
        q = p.interpolate(float(t), normalized=True)
        cell = box(q.x - 0.1, q.y - 0.1, q.x + 0.1, q.y + 0.1)
        if shape(model.site["osmWorldGeometry"]).covers(cell):
          native_box(model, q.x, q.y, 0.15, 0.15, low + 0.25, low + 3.65, METAL)
  model.count["glassStoreys"] = 5
  pixel_ring(model, Polygon(model.local_ring(23, 24)), 64, 64.35, METAL, 0.8)
  x, z = model.center
  native_box(model, x - 1, z, 8, 6, 64.35, 65.65, (194, 197, 188))
  native_box(model, x - 1, z, 8.2, 6.2, 65.65, 66, (166, 174, 169))


def build() -> dict[str, Any]:
  """Build exactly three companions, verify their bounds and preserve receipts."""
  source = base.read_json(SOURCE) if SOURCE.exists() else extract()
  for url, receipt in source["packetReceipts"].items():
    assert base.digest(OUT / url) == receipt["sha256"], url
    assert base.read_json(OUT / url)["nav"] == receipt["nav"], url
  descriptors, records = [], []
  totals: dict[str, Counter] = {f: Counter() for f in ("drawn", "minecraft")}
  for site in source["sites"]:
    identity = "height259-" + site["parentDescriptor"]["id"]
    descriptor = {
      "id": identity,
      "detailCompanionOf": site["parentDescriptor"]["id"],
      "bounds": site["parentDescriptor"]["bounds"],
    }
    record = {
      "id": site["id"],
      "sourceParent": site["sourceParent"],
      "osmWayId": site["osmWayId"],
      "topY": site["topY"],
      "dimensionStatus": DIMENSIONS,
      "counts": {},
    }
    for family in ("drawn", "minecraft"):
      model = Model(site, family)
      if family == "drawn":
        (drawn_lux if site["id"] == "luxTower" else drawn_church)(model)
      else:
        (native_lux if site["id"] == "luxTower" else native_church)(model)
      mesh = model.mesh.payload(KIND)
      packet = {
        "schemaVersion": 1,
        "id": identity,
        "origin": model.origin,
        "meshes": [mesh],
        "nav": {"groundY": 3, "ground": [], "water": [], "buildings": []},
      }
      points = positions(packet)
      poly = shape(site["osmWorldGeometry"]).buffer(0.015)
      outside = int(
        (~shapely.covers(poly, shapely.points(points[:, 0], points[:, 2]))).sum()
      )
      assert outside == 0, (site["id"], family, "outside mapped owner", outside)
      assert points[:, 1].min() >= model.low - 0.005
      assert abs(points[:, 1].max() - site["topY"]) < 0.005
      indices = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(
        -1, 3
      )
      tri = points[indices]
      normals = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
      orthogonal = bool(np.all((np.abs(normals) > 0.000001).sum(axis=1) == 1))
      if family == "minecraft":
        assert orthogonal, (site["id"], "native diagonal face")
      url = identity + "." + family + ".json.gz"
      path = OUT / url
      base.write_json(path, packet)
      raw_bytes = len(json.dumps(packet, separators=(",", ":")).encode()) + 1
      vertices = len(points)
      stats = {
        **model.count,
        "vertices": vertices,
        "triangles": len(indices),
        "geometryBytes": vertices * 12
        + len(indices) * 3 * (2 if vertices <= 65535 else 4),
        "transferBytes": path.stat().st_size,
        "decodedBytes": raw_bytes,
        "bounds": [float(points[:, i].min()) for i in range(3)]
        + [float(points[:, i].max()) for i in range(3)],
        "minY": float(points[:, 1].min()),
        "maxY": float(points[:, 1].max()),
        "nativeOrthogonal": orthogonal,
        "sourceOwnerOutsideVertices": outside,
      }
      assert raw_bytes < 4 * 1024 * 1024 and vertices < 400000
      record["counts"][family] = stats
      for key in (
        "vertices",
        "triangles",
        "geometryBytes",
        "transferBytes",
        "decodedBytes",
      ):
        totals[family][key] += stats[key]
      descriptor[family] = {
        "url": url,
        "bytes": path.stat().st_size,
        "decodedBytes": raw_bytes,
        "encoding": "gzip",
        "sha256": base.digest(path),
      }
    descriptors.append(descriptor)
    records.append(record)
  for url, receipt in source["packetReceipts"].items():
    assert base.digest(OUT / url) == receipt["sha256"], url
  evidence = {
    "schemaVersion": 1,
    "policy": POLICY,
    "dimensionStatus": DIMENSIONS,
    "sourceSha256": base.digest(SOURCE),
    "sites": records,
    "counts": totals,
    "packetReceipts": {
      url: {"sha256": r["sha256"], "navUnchanged": True}
      for url, r in source["packetReceipts"].items()
    },
    "companions": descriptors,
    "oldPacketsUnchanged": True,
    "oldNavigationUnchanged": True,
  }
  base.write_json(EVIDENCE, evidence)
  base.write_json(
    ADDITION,
    {
      "chunks": descriptors,
      "heightReconstructionV259": {
        "policy": POLICY,
        "source": "height-reconstruction-v259-source.json.gz",
        "sourceSha256": base.digest(SOURCE),
        "counts": totals,
        "sites": 3,
      },
    },
  )
  print(json.dumps({"counts": totals, "sites": records}, indent=2))
  return evidence


if __name__ == "__main__":
  build()
