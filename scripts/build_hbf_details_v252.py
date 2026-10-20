"""Step 10: bounded retained-source Hauptbahnhof street recognition."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pyogrio
from shapely import make_valid
from shapely.geometry import LineString, Polygon, box, mapping
from shapely.ops import substring, unary_union

from isometric_berlin.generation.road_geometry import road_width_m
from scripts.build_house_curbs_v233 import tags, world
from scripts.build_surrounding_outlines import line_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
IDS = {
  "291695261",
  "39350083",
  "318015898",
  "67713448",
  "48859724",
  "291695260",
  "39487919",
  "4395577",
  "44427656",
  "4592633",
  "305801705",
  "4395253",
}


def build() -> None:
  """Add existing-edge caps and tagged cycle/turn paint without new road fill."""
  rows = pyogrio.read_dataframe(
    GEO / "raw/outer-v159/candidate.gpkg",
    layer="lines",
    bbox=(13.362, 52.519, 13.376, 52.528),
  ).to_crs(25833)
  records = rows.to_dict("records")
  selected = [r for r in records if r["osm_id"] in IDS]
  assert {r["osm_id"] for r in selected} == IDS
  scope = box(-440, -930, 40, -400)
  access = unary_union(
    [
      world(r["geometry"]).buffer(1.8)
      for r in records
      if tags(r).get("highway") in ("footway", "path", "cycleway", "steps")
    ]
  )
  source_roads = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/surface-polygons.json").read_text()
  )["roads"]
  asphalt = unary_union(
    [
      make_valid(
        Polygon(
          [(x / 10, z / 10) for x, z in r["ring"]],
          [[(x / 10, z / 10) for x, z in h] for h in r["holes"]],
        )
      ).intersection(scope)
      for r in source_roads
      if r["kind"] == "asphalt"
    ]
  )
  district_path = DATA / "districtStreets.json"
  district = json.loads(district_path.read_text())
  existing_kerbs = unary_union(
    [LineString(p).intersection(scope) for p in district["curbs_m"]]
  )
  features, paint, caps = [], [], []
  for r in sorted(selected, key=lambda p: p["osm_id"]):
    t, g = tags(r), world(r["geometry"])
    width = road_width_m(t)
    assert width
    short = substring(g, min(5, g.length / 3), max(g.length - 5, g.length * 2 / 3))
    # The cap follows an existing rendered asphalt boundary; never infer a
    # separate parallel road, close a mapped pedestrian approach or cap an end.
    sides = unary_union([short.offset_curve(width / 2), short.offset_curve(-width / 2)])
    cap = existing_kerbs.intersection(sides.buffer(0.65)).difference(access)
    for part in line_parts(cap):
      if part.length > 1:
        caps.append(dict(owner=r["osm_id"], points=list(part.coords)))
    for side, sign in (("left", -1), ("right", 1)):
      cycle = t.get(f"cycleway:{side}", t.get("cycleway:both"))
      if cycle != "lane":
        continue
      cycle_width = float(
        t.get(f"cycleway:{side}:width", t.get("cycleway:both:width", "1.5"))
      )
      style = t.get(f"cycleway:{side}:lane", t.get("cycleway:both:lane", "advisory"))
      # Reflection into world XZ reverses OSM's left/right offset convention.
      course = short.offset_curve(sign * (width / 2 - cycle_width))
      for part in line_parts(course.difference(access)):
        paint.append(
          dict(
            owner=r["osm_id"],
            role="cycle-lane-boundary",
            dashed=style == "advisory",
            points=list(part.coords),
          )
        )
    turns = t.get("turn:lanes", "").split("|")
    lanes = int(t.get("lanes", "0"))
    if t.get("oneway") == "yes" and len(turns) == lanes and g.length > 35:
      end, before = g.interpolate(g.length - 12), g.interpolate(g.length - 13)
      dx, dz = end.x - before.x, end.y - before.y
      length = (dx * dx + dz * dz) ** 0.5
      dx, dz = dx / length, dz / length
      for lane, direction in enumerate(turns):
        if direction not in ("through", "left", "right"):
          continue
        offset = width * ((lane + 0.5) / lanes - 0.5)
        cx, cz = end.x - dz * offset, end.y + dx * offset
        glyph = [[(0, -1.6), (0, 1.6)]]
        if direction == "through":
          glyph += [[(-0.65, 0.8), (0, 1.6), (0.65, 0.8)]]
        else:
          sign = -1 if direction == "left" else 1
          glyph = [
            [(0, -1.6), (0, 0.4), (sign * 1.05, 0.4)],
            [(sign * 0.5, -0.2), (sign * 1.05, 0.4), (sign * 0.5, 1)],
          ]
        strokes = [
          LineString([(cx - dz * u + dx * v, cz + dx * u + dz * v) for u, v in stroke])
          for stroke in glyph
        ]
        if all(
          asphalt.covers(s.buffer(0.12)) and s.distance(access) > 0.2 for s in strokes
        ):
          paint.extend(
            dict(
              owner=r["osm_id"],
              role="tagged-turn-arrow",
              dashed=False,
              points=list(s.coords),
            )
            for s in strokes
          )
    features.append(
      dict(
        id=r["osm_id"],
        tags=t,
        geometry=mapping(g),
        widthM=width,
        widthStatus="retained renderer road-width policy; untagged width is estimated",
      )
    )
  source = dict(
    schemaVersion=1,
    source="https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
    license="ODbL-1.0",
    sourceSurfaceSha256=hashlib.sha256(
      (
        ROOT / "src/app/public/mesh/regierungsviertel/surface-polygons.json"
      ).read_bytes()
    ).hexdigest(),
    sourceDistrictStreetsSha256=hashlib.sha256(district_path.read_bytes()).hexdigest(),
    features=features,
    authoredStairReceipt={
      "owner": "ArchitecturalLandmarks.addStationInterior: four deepest authored escalator runs",
      "oldFromAbsoluteLocal": [5.2, -5.4, 76],
      "oldToAbsoluteLocal": [9.5, -14.53, 93.347],
      "newFromAbsoluteLocal": [5.2, -5.15, 72.8],
      "newToAbsoluteLocal": [9.5, -14.055, 81.8],
      "reason": "Old upper landing misses lower cross bridge (z 68.4..73.6); old lower landing extends past island end z 84. Corrected full comb plate ends at z 83.9.",
      "guard": "hbfFlightEndpointsV252 changes only matching six original endpoint coordinates; all other flights pass through.",
      "retained": "All measured source geometry, platform/gallery slabs and guard rails, lifts, tracks, eight other flights, station navigation and roof remain.",
    },
    policy="Exact retained street courses, existing asphalt-edge joints/caps, tagged cycle lanes and positively tagged turn directions only. No new road fill or zebra crossings. Existing source geometry and lane lines retained. Kerb joints, arrow positions, paint intervals and widths are display estimates.",
  )
  encoded = json.dumps(source, separators=(",", ":"), ensure_ascii=False).encode()
  (GEO / "hbf-details-v252-source.json").write_bytes(encoded)
  result = dict(
    sourceSha256=hashlib.sha256(encoded).hexdigest(),
    curbCaps=caps,
    paint=paint,
  )
  (DATA / "hbfStreetDetailsV252.json").write_text(
    json.dumps(result, separators=(",", ":"))
  )
  print(json.dumps(dict(roads=len(features), caps=len(caps), paint=len(paint))))


if __name__ == "__main__":
  build()
