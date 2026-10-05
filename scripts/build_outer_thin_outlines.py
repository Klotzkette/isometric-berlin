"""Bake the owner-requested sparse v179 overlay; never rebuild existing city data."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pyproj import Transformer
from shapely.geometry import LineString, Polygon, mapping
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True).transform
UNPROJECT = Transformer.from_crs(25833, 4326, always_xy=True).transform
GROUND = 3.55  # Cartographic projection, not a surveyed road/rail grade.


def world(point: list[float]) -> tuple[float, float]:
  """Use the existing E389500 / N5820000 viewer frame."""
  x, y = PROJECT(*point[:2])
  return round(x - 389500, 2), round(5820000 - y, 2)


def build(source: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
  """Retain every mapped vertex; add only explicitly labelled wire heights."""
  positions: list[float] = []
  features: list[dict[str, Any]] = []
  scopes = []

  def segment(a: tuple[float, ...], b: tuple[float, ...]) -> None:
    if a != b:
      positions.extend(round(n, 2) for n in (*a, *b))

  def trace(points: list[tuple[float, float]], y: float) -> None:
    for a, b in zip(points, points[1:]):
      segment((a[0], y, a[1]), (b[0], y, b[1]))

  def record(item: dict[str, Any], first: int, **extra: Any) -> None:
    features.append(
      dict(
        name=item["name"],
        osmIds=item.get("osmIds", []),
        firstVertex=first // 3,
        vertexCount=(len(positions) - first) // 3,
        **extra,
      )
    )

  for item in source["lines"]:
    first = len(positions)
    points = [world(p) for p in item["coordinates"]]
    if len(points) < 2:
      continue
    trace(points, GROUND)
    record(item, first, kind=item["kind"], projectedGrade=True)
    scopes.append(transform(PROJECT, LineString(item["coordinates"])).buffer(40))

  defaults = {
    "ICC": 39.5,
    "Flughafen Tempelhof": 20,
    "Bahnhof Gesundbrunnen": 8,
    "Bahnhof Südkreuz": 14,
    "Bahnhof Westkreuz": 10,
    "Steglitzer Kreisel": 118.5,
  }
  for item in source["footprints"]:
    first = len(positions)
    name = item["name"]
    height = (
      0
      if name in {"Tempelhofer Feld", "Funkturm"}
      else float(
        item["height"] if item.get("height") is not None else defaults.get(name, 8)
      )
    )
    for ring in item["rings"]:
      points = [world(p) for p in ring]
      if len(points) < 3:
        continue
      if points[0] != points[-1]:
        points.append(points[0])
      trace(points, GROUND)
      if height:
        trace(points, GROUND + height)
        for x, z in points[:-1]:
          segment((x, GROUND, z), (x, GROUND + height, z))
        if name == "Steglitzer Kreisel":
          # Open structural storey registers; no cladding or solid infill.
          for level in range(1, 30):
            trace(points, GROUND + height * level / 30)
      scopes.append(transform(PROJECT, Polygon(ring)).buffer(20))
    record(
      item,
      first,
      kind=item["kind"],
      displayHeightM=height,
      heightSource=item.get("heightSource", "labelled outline display estimate"),
    )

  mast = next(a for a in source["anchors"] if a["name"] == "Funkturm")
  x, z = world([mast["lon"], mast["lat"]])
  first = len(positions)
  # Operator heights: restaurant 55 m, platform 126 m, total 147 m.
  # Taper widths and brace divisions are sparse recognition estimates.
  sections = [(0, 10), (25, 7), (55, 4), (85, 3), (126, 2.5), (138, 0.7), (147, 0.15)]
  corners = [(-1, -1), (-1, 1), (1, 1), (1, -1)]
  for (low, w0), (high, w1) in zip(sections, sections[1:]):
    for i, (a, b) in enumerate(corners):
      c, d = corners[(i + 1) % 4]
      segment(
        (x + a * w0, GROUND + low, z + b * w0), (x + a * w1, GROUND + high, z + b * w1)
      )
      segment(
        (x + a * w0, GROUND + low, z + b * w0), (x + c * w1, GROUND + high, z + d * w1)
      )
      segment(
        (x + c * w0, GROUND + low, z + d * w0), (x + a * w1, GROUND + high, z + b * w1)
      )
  for level, width in [(55, 7.5), (126, 5)]:
    ring = [(x + a * width, z + b * width) for a, b in [*corners, corners[0]]]
    trace(ring, GROUND + level)
    trace(ring, GROUND + level + 2)
  record(
    mast, first, kind="mast", displayHeightM=147, heightSource="Messe Berlin operator"
  )
  scopes.append(
    transform(
      PROJECT,
      Polygon(
        [
          (mast["lon"] - 0.0003, mast["lat"] - 0.0002),
          (mast["lon"] + 0.0003, mast["lat"] - 0.0002),
          (mast["lon"] + 0.0003, mast["lat"] + 0.0002),
          (mast["lon"] - 0.0003, mast["lat"] + 0.0002),
        ]
      ),
    ).buffer(10)
  )
  bounds = [
    min(positions[0::3]),
    min(positions[2::3]),
    max(positions[0::3]),
    max(positions[2::3]),
  ]
  payload = dict(schemaVersion=1, bounds=bounds, positions=positions, features=features)
  area = unary_union(scopes)
  scope = dict(
    type="FeatureCollection",
    name="Owner-approved v179 thin outline scope",
    features=[
      dict(
        type="Feature",
        properties=dict(
          revision="v1.0.79",
          representation="hairlines only; original city bounds and data unchanged",
          source="OpenStreetMap / ODbL-1.0",
          area_m2=round(area.area, 2),
        ),
        geometry=mapping(transform(UNPROJECT, area)),
      )
    ],
  )
  return payload, scope


def main() -> None:
  """Write compact runtime geometry and the independent approved overlay scope."""
  source = json.loads(
    (ROOT / "geo_data/regierungsviertel/outer-thin-outlines-v179.json").read_text()
  )
  payload, scope = build(source)
  for path, data in [
    ("src/app/src/data/outerThinOutlines.json", payload),
    ("src/app/src/data/outerThinOutlineScope.json", dict(bounds=payload["bounds"])),
    ("geo_data/regierungsviertel/bounds-outline-v179.geojson", scope),
  ]:
    (ROOT / path).write_text(
      json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n"
    )
  print(
    json.dumps(
      dict(
        vertices=len(payload["positions"]) // 3,
        features=len(payload["features"]),
        bounds=payload["bounds"],
      )
    )
  )


if __name__ == "__main__":
  main()
