"""Step 10: retained Hermann-Ehlers-Platz fountain in existing Steglitz batches."""

from __future__ import annotations

import base64
import gzip
import json
import math

import numpy as np
from build_steglitz_details_v246 import DATA, GEO, PUBLIC, ROOT, merge_boxes, read, sha
from pyproj import Transformer
from shapely import constrained_delaunay_triangles
from shapely.geometry import Polygon, box, mapping, shape
from shapely.geometry.polygon import orient
from shapely.ops import transform

RAW = GEO / "raw/v182-steglitz/multipolygons.json"
OUT = DATA / "hermannEhlersFountainV248.json"
EVIDENCE = GEO / "hermann-ehlers-fountain-v248-evidence.json"
BRICK, MID, BASE, CONCRETE, WATER, JET, METAL = (
  0x9A6554,
  0x895A4C,
  0x80564A,
  0x98988A,
  0x698C91,
  0xD0DEDA,
  0x686D65,
)
GROUND, RIM_TOP, WATER_TOP = 3.025, 3.625, 3.18
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True)


def world(x: float, y: float) -> tuple[float, float]:
  e, n = PROJECT.transform(x, y)
  return e - 389500, 5820000 - n


def footprint(row: list, native: bool = False) -> Polygon:
  x, _, z, w, _, d = row[:6]
  angle = 0 if native else row[6]
  t, n = (
    np.array([math.cos(angle), -math.sin(angle)]),
    np.array([math.sin(angle), math.cos(angle)]),
  )
  return Polygon(
    [
      np.array([x, z]) + a * w / 2 * t + b * d / 2 * n
      for a, b in [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    ]
  )


def compact_cells(rows: list) -> list:
  """Exact rectangle partitions; try eight scan directions without omitting cells."""
  result = []
  keys = sorted({(r[1], r[4], r[6]) for r in rows})
  for y, height, colour in keys:
    original = {
      (round((r[0] - 0.125) * 4), round((r[2] - 0.125) * 4))
      for r in rows
      if (r[1], r[4], r[6]) == (y, height, colour)
    }
    alternatives = []
    for sx, sz, swap in [
      (sx, sz, swap)
      for swap in [False, True]
      for sx, sz in [(1, 1), (-1, 1), (1, -1), (-1, -1)]
    ]:
      left = {(z * sx, x * sz) if swap else (x * sx, z * sz) for x, z in original}
      boxes = []
      while left:
        x, z = min(left, key=lambda p: (p[1], p[0]))
        width = 0
        while (x + width, z) in left:
          width += 1
        best = (width, 1)
        depth = 1
        while (x, z + depth) in left:
          current = 0
          while current < width and (x + current, z + depth) in left:
            current += 1
          width = current
          depth += 1
          if width * depth > best[0] * best[1]:
            best = (width, depth)
        w, d = best
        cells = {(a, b) for a in range(x, x + w) for b in range(z, z + d)}
        assert cells <= left
        left -= cells
        xx = [a * sx for a, b in cells]
        zz = [b * sz for a, b in cells]
        row = [
          (min(xx) + max(xx) + 1) / 8,
          y,
          (min(zz) + max(zz) + 1) / 8,
          w / 4,
          height,
          d / 4,
          colour,
        ]
        if swap:
          row = [row[2], row[1], row[0], row[5], row[4], row[3], row[6]]
        boxes.append(row)
      alternatives.append(boxes)
    result.extend(min(alternatives, key=len))
  return result


def build() -> tuple[dict, dict]:
  feature = next(
    f for f in read(RAW)["features"] if f["properties"].get("osm_way_id") == "775414456"
  )
  outer = orient(transform(world, shape(feature["geometry"])).geoms[0], sign=1)
  plaza = read(GEO / "hermann-ehlers-v247-evidence.json")
  hole = Polygon(shape(plaza["worldGeometry"]).geoms[0].interiors[0])
  assert outer.equals(hole)
  inner = outer.buffer(-0.65, join_style=2)
  rim = outer.difference(inner)
  drawn, native, surfaces = [], [], []

  def put(rows: list, row: list) -> None:
    rows.append([round(float(v), 6) for v in row[:-1]] + [row[-1]])

  def surface(polygon: Polygon, y: float, colour: int, role: str) -> None:
    triangles = []
    for triangle in constrained_delaunay_triangles(polygon).geoms:
      points = [[x, y, z] for x, z in list(triangle.exterior.coords)[:3]]
      if (
        np.cross(np.subtract(points[1], points[0]), np.subtract(points[2], points[0]))[
          1
        ]
        < 0
      ):
        points.reverse()
      triangles.append(points)
    surfaces.append(
      {"owner": f"way/775414456/{role}", "color": colour, "triangles": triangles}
    )

  # The complete original contour is retained on the upper clinker cap. The
  # mapped figure (9.779 x 5.354m) is not enlarged to the older catalogue's
  # 12 x 7m overall measurement, which would cover earlier plaza paving.
  surface(rim, RIM_TOP, BRICK, "rim")
  surface(inner, WATER_TOP, WATER, "water")

  def wall_strips(
    polygon: Polygon, low: float, high: float, colour: int, inward: bool
  ) -> None:
    ring = list(orient(polygon, sign=1).exterior.coords)
    for a, b in zip(ring, ring[1:]):
      a, b = np.array(a), np.array(b)
      t = b - a
      length = float(np.linalg.norm(t))
      t /= length
      normal = np.array([-t[1], t[0]]) * (1 if inward else -1)
      # A narrow physical wall under the exact ring cap; shorten only at
      # corners to stay wholly on the source-bound rim, never on the plaza.
      width = 0.075
      centre = (a + b) / 2 + normal * width / 2
      usable = length
      for _ in range(40):
        row = [
          centre[0],
          (low + high) / 2,
          centre[1],
          usable,
          high - low,
          width,
          math.atan2(-t[1], t[0]),
          colour,
        ]
        if rim.buffer(1e-7).covers(footprint(row)):
          put(drawn, row)
          break
        usable *= 0.88
      else:
        raise AssertionError("No source-bound wall interval")

  wall_strips(outer.buffer(-0.16, join_style=2), GROUND, 3.225, BASE, True)
  wall_strips(outer.buffer(-0.08, join_style=2), 3.225, 3.425, MID, True)
  wall_strips(outer, 3.425, RIM_TOP - 0.006, BRICK, True)
  wall_strips(inner, GROUND, RIM_TOP - 0.01, CONCRETE, False)

  # Native geometry is constructed independently from complete .25m source
  # cells at each tier. Equal-material cells merge without filling gaps.
  def cells(polygon: Polygon, low: float, high: float, colour: int) -> None:
    step = 0.25
    for ix in range(
      math.floor(polygon.bounds[0] / step), math.ceil(polygon.bounds[2] / step)
    ):
      for iz in range(
        math.floor(polygon.bounds[1] / step), math.ceil(polygon.bounds[3] / step)
      ):
        x, z = ix * step, iz * step
        if polygon.covers(box(x, z, x + step, z + step)):
          put(
            native,
            [
              x + step / 2,
              (low + high) / 2,
              z + step / 2,
              step,
              high - low,
              step,
              colour,
            ],
          )

  cells(outer.buffer(-0.16, join_style=2).difference(inner), GROUND, 3.225, BASE)
  cells(outer.buffer(-0.08, join_style=2).difference(inner), 3.225, 3.425, MID)
  cells(rim, 3.425, RIM_TOP, BRICK)
  cells(inner, GROUND, WATER_TOP - 0.025, CONCRETE)
  cells(inner, WATER_TOP - 0.025, WATER_TOP, WATER)
  native = min([merge_boxes(native), compact_cells(native)], key=len)

  # Three small static abstract jets, no animation, particles or transparency.
  # Their longitudinal arrangement is documented; precise spacing/heights are
  # display estimates and not an assertion of present pump operation.
  c = np.array(outer.centroid.coords[0])
  corners = list(outer.minimum_rotated_rectangle.exterior.coords)
  a, b = max(zip(corners, corners[1:]), key=lambda p: np.linalg.norm(np.subtract(*p)))
  axis = np.subtract(b, a)
  axis /= np.linalg.norm(axis)
  for offset, high in [(-2, 3.65), (0, 4.25), (2, 3.65)]:
    p = c + axis * offset
    assert inner.buffer(-0.2).covers(
      box(p[0] - 0.1, p[1] - 0.1, p[0] + 0.1, p[1] + 0.1)
    )
    for rows, is_native in [(drawn, False), (native, True)]:
      for low, top, width, colour in [
        (GROUND, WATER_TOP + 0.035, 0.18, METAL),
        (WATER_TOP + 0.035, high, 0.08, JET),
      ]:
        row = [p[0], (low + top) / 2, p[1], width, top - low, width]
        put(rows, row + ([colour] if is_native else [0, colour]))

  triangles = sum(len(s["triangles"]) for s in surfaces)
  drawn_bytes = len(drawn) * 76 + triangles * 108
  native_bytes = len(native) * 76
  assert drawn_bytes <= 12_000 and native_bytes <= 18_000, (
    len(drawn),
    len(native),
    triangles,
    drawn_bytes,
    native_bytes,
  )
  preserved = [
    RAW,
    DATA / "steglitzV182Source.json",
    DATA / "steglitzV182Native.json",
    DATA / "steglitzV182Navigation.json",
    DATA / "steglitzV246Details.json",
    DATA / "hermannEhlersV247Details.json",
    DATA / "schlossstrasseV247Details.json",
  ]
  original_ground = []
  for family in ["drawn", "minecraft"]:
    for name in ["ring182--7_13", "ring182--8_13"]:
      path = PUBLIC / f"{name}.{family}.json.gz"
      preserved.append(path)
      packet = json.loads(gzip.decompress(path.read_bytes()))
      for mesh in packet["meshes"]:
        v = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(
          -1, 3
        ) / 100 + np.array(packet["origin"])
        indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
        colors = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
        for index in indices:
          t = v[index]
          if (
            t[:, 0].max() < outer.bounds[0]
            or t[:, 0].min() > outer.bounds[2]
            or t[:, 2].max() < outer.bounds[1]
            or t[:, 2].min() > outer.bounds[3]
          ):
            continue
          if Polygon(t[:, [0, 2]]).intersection(outer).area > 0.001:
            assert np.all(t[:, 1] == 3) and np.all(colors[index] == [125, 131, 103])
            original_ground.append(
              {"packet": name, "family": family, "y": 3, "rgb": [125, 131, 103]}
            )
  assert len(original_ground) == 2
  data = {"version": 248, "surfaces": surfaces, "boxes": drawn, "nativeRows": native}
  evidence = {
    "version": 248,
    "owner": "way/775414456",
    "sourceFeature": feature,
    "worldContour": mapping(outer),
    "innerContour": mapping(inner),
    "sourceSha256": {str(p.relative_to(ROOT)): sha(p) for p in preserved},
    "originalGround": original_ground,
    "counts": {
      "drawn": len(drawn),
      "native": len(native),
      "triangles": triangles,
      "drawnAttributeBytes": drawn_bytes,
      "nativeAttributeBytes": native_bytes,
    },
    "groundY": GROUND,
    "rimTopY": RIM_TOP,
    "waterY": WATER_TOP,
    "measuredRimHeightM": 0.6,
    "measuredRimWidthM": 0.65,
    "catalogueOverallDimensionsM": [12, 7],
    "policy": "Original OSM outline and v247 hole retained exactly; earlier models and packets unchanged. Catalogue overall dimensions differ from mapped outline and are not used to expand the fountain. Tier offsets, local wall thickness, water level, jet proportions and tones are display estimates. Three static opaque jets describe the documented arrangement, not live pump operation. Independent native source cells; unchanged batches, budgets and full mobile detail.",
    "references": [
      {
        "url": "https://bildhauerei-in-berlin.de/bildwerk/brunnenanlage-5560/",
        "credit": "Bildhauerei in Berlin; Susanne Kähler and Jörg Kuhn",
        "use": "Text-only primary survey: red clinker, two recessed tiers, concrete basin, three fountains, 0.60m rim height and 0.65m width. No photograph or pixels used.",
      },
      {
        "url": "https://mein.berlin.de/vorhaben/2024-00949/",
        "credit": "Bezirksamt Steglitz-Zehlendorf / meinBerlin",
        "use": "District status last edited 20 April 2026: proposed square redesign is not represented as built.",
      },
      {
        "url": "https://www.openstreetmap.org/way/775414456",
        "credit": "© OpenStreetMap contributors, ODbL-1.0",
        "use": "Full retained fountain outline, matching the existing v247 plaza opening.",
      },
    ],
  }
  return data, evidence


if __name__ == "__main__":
  data, evidence = build()
  for path, value in [(OUT, data), (EVIDENCE, evidence)]:
    path.write_text(json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n")
  print(json.dumps({"bytes": OUT.stat().st_size, **evidence["counts"]}))
