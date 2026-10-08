"""Step 10: bounded western recognition at retained OSM/official anchors.

Complete original source shells and feature inventory are archived independently;
known coarse stadium and belfry closed-void conflicts are interpreted explicitly. Local bays,
steel sections, seating rows and battlements are labelled display estimates.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
from build_bebelplatz_building_source import extract_parent, part_profile
from build_breitscheid_towers_v161 import triangles_for
from pyproj import Transformer
from shapely.geometry import LineString, MultiPolygon, Point, Polygon, mapping, shape
from shapely.ops import transform, unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts
from isometric_berlin.data.fetch_osm import parse_hstore

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
RAW = GEO / "raw/v187-west"
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True).transform
UNPROJECT = Transformer.from_crs(25833, 4326, always_xy=True).transform
GROUND = 3.55
PARENTS = [
  ("Preussenturm", "380_5819", "DEBE04YY500008Cu", ["way/48983461"], 0xC6BA9E),
  ("Bayernturm", "380_5819", "DEBE04YY500006Fm", ["way/48983460"], 0xC6BA9E),
  ("Olympiastadion", "380_5819", "DEBE04AL5LX00002", ["way/24296022"], 0xC4BCA9),
  ("Olympiastadion", "380_5819", "DEBE04AL5LX00003", ["way/24296022"], 0xBDB6A5),
  ("Olympiastadion", "380_5819", "DEBE04AL5LX00004", ["way/24296022"], 0xBDB6A5),
  ("Glockenturm", "380_5819", "DEBE04YY500001If", ["way/48983459"], 0xBFB7A2),
  ("Juliusturm", "378_5822", "DEBE05YYY0000FBI", ["way/25867264"], 0xA36E52),
  ("Palas", "378_5822", "DEBE05YYY000031N", ["way/25867257"], 0xB37559),
  ("Torhaus", "378_5822", "DEBE05YYY00006av", ["way/84502073"], 0xC7B89B),
  ("Torhaus", "378_5822", "DEBE05YYY0000Ppa", ["way/84502073"], 0xB97D61),
]


def world(lon: float, lat: float) -> list[float]:
  """Project the retained OSM coordinates to the unchanged viewer frame."""
  e, n = PROJECT(lon, lat)
  return [round(e - 389500, 3), round(5820000 - n, 3)]


def tags(f: dict[str, Any]) -> dict[str, Any]:
  """Read the retained OGR promoted and hstore tags."""
  p = f["properties"]
  return {
    **parse_hstore(p.get("other_tags") or ""),
    **{k: v for k, v in p.items() if isinstance(v, str) and k != "other_tags"},
  }


def identity(f: dict[str, Any]) -> str:
  """Retain way/relation identity."""
  p = f["properties"]
  if p.get("osm_way_id"):
    return f"way/{p['osm_way_id']}"
  return f"{'relation' if f['geometry']['type'].startswith('Multi') else 'way'}/{p['osm_id']}"


def extract_sources() -> dict[str, Any]:
  """Freeze a small source selection, never the whole raw input cache."""
  dest = GEO / "west-landmarks-v187-osm.json"
  if dest.exists():
    return json.loads(dest.read_text())
  fs = []
  ids = {
    "way/24296022",
    "way/48983459",
    "way/569075075",
    "way/25867264",
    "way/25867257",
    "way/84502073",
    "way/4902365",
    "way/38862723",
    "way/38863016",
    "way/4555267",
  }
  for area in ["olympic", "citadel"]:
    for f in json.loads((RAW / f"{area}-multipolygons.json").read_text())["features"]:
      t, g, oid = tags(f), shape(f["geometry"]), identity(f)
      c = g.centroid
      sports = (
        area == "olympic"
        and 13.224 < c.x < 13.252
        and 52.512 < c.y < 52.5219
        and t.get("leisure") in {"pitch", "swimming_pool", "track", "bleachers"}
      )
      tower = (
        area == "olympic"
        and oid in {f"way/{n}" for n in range(48983460, 48983483)}
        and t.get("height") == "36"
      )
      if oid in ids or sports or tower:
        fs.append(
          {
            "type": "Feature",
            "properties": {"id": oid, "tags": t, "area": area},
            "geometry": f["geometry"],
          }
        )
  result = {
    "type": "FeatureCollection",
    "source": "Geofabrik retained Berlin extract 2026-09-29",
    "license": "ODbL-1.0",
    "pbfSha256": hashlib.sha256(
      (GEO / "raw/outer-v159/berlin-260929.osm.pbf").read_bytes()
    ).hexdigest(),
    "features": fs,
  }
  dest.write_text(json.dumps(result, separators=(",", ":")) + "\n")
  return result


def roundrow(r: Any) -> list[float]:
  """Keep small millimetre-scale construction payloads."""
  return [round(float(v), 3) for v in r[:-1]] + [int(r[-1])]


def build() -> tuple[dict[str, Any], dict[str, Any]]:
  """Build independent active-mode representations from the frozen sources."""
  osm = extract_sources()
  features = {f["properties"]["id"]: f for f in osm["features"]}
  groups: dict[str, dict[str, Any]] = {}
  evidence: dict[str, Any] = {
    "schemaVersion": 1,
    "owners": [],
    "sources": [],
    "conflicts": [],
    "estimates": "Truss sections, floor glazing, belfry subdivisions, seating and castle-wall/crown detail are display interpretation, not a facade or landscape survey.",
  }
  exclusions = []

  def group(name: str) -> dict[str, Any]:
    return groups.setdefault(
      name, {"name": name, "surfaces": [], "boxes": [], "rods": [], "native": []}
    )

  def box(
    g: dict,
    x: float,
    y: float,
    z: float,
    w: float,
    h: float,
    d: float,
    color: int,
    angle: float = 0,
  ) -> None:
    g["boxes"].append(roundrow([x, y, z, w, h, d, angle, color]))

  def rod(g: dict, a: list, b: list, width: float, color: int) -> None:
    g["rods"].append(roundrow([*a, *b, width, color]))

  def surface(g: dict, rings: list, color: int) -> None:
    triangles = [
      [[round(float(v), 3) for v in p] for p in t] for t in triangles_for(rings)
    ]
    if triangles:
      g["surfaces"].append({"triangles": triangles, "color": color})

  def ring_surface(g: dict, poly: Any, y: float, color: int) -> None:
    polygons = [poly] if poly.geom_type == "Polygon" else list(poly.geoms)
    for p in polygons:
      rings = [[[x, y, z] for x, z in r.coords] for r in [p.exterior, *p.interiors]]
      surface(g, rings, color)

  def footprint(oid: str) -> Any:
    return transform(lambda x, y, z=None: world(x, y), shape(features[oid]["geometry"]))

  # Exact LoD2 owners. Their complete original profiles also remain in evidence.
  profiles = []
  for name, tile, pid, oids, tint in PARENTS:
    archive = GEO / f"raw/lod2/LoD2_{tile}.zip"
    parent = extract_parent(archive, pid)
    parts = [part_profile(p) for p in leaf_building_parts(parent) or [parent]]
    # The operator specifies a sunken stadium. Use a common plaza datum of
    # NHN 67m for all source stadium sheets instead of floating its three owners.
    datum = 37.0 if name == "Olympiastadion" else min(p["ground_y_m"] for p in parts)
    offset = GROUND - datum
    record = {
      "name": name,
      "parentId": pid,
      "osmIds": oids,
      "sourceUrl": f"https://gdi.berlin.de/data/a_lod2/atom/{archive.name}",
      "sourceSha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
      "offsetY": round(offset, 3),
      "sourceParts": parts,
    }
    profiles.append(record)
    evidence["owners"].append(
      {k: v for k, v in record.items() if k != "sourceParts"}
      | {
        "sourcePartIds": [p["id"] for p in parts],
        "sourceSurfaces": sum(len(p["surfaces"]) for p in parts),
      }
    )
    g = group(
      "Olympiastadion"
      if name == "Olympiastadion"
      else "Glockenturm"
      if name == "Glockenturm"
      else "Olympic gateway pylons"
      if name in {"Preussenturm", "Bayernturm"}
      else "Zitadelle"
    )
    for p in parts:
      for s in p["surfaces"]:
        rings = [
          [[round(x, 3), round(y + offset, 3), round(z, 3)] for x, y, z in r]
          for r in s["rings"]
        ]
        # The belfry is a known opening omitted by the coarse cuboid source.
        # Its surveyed plan/shaft remains; the opening is detailed below.
        if name == "Glockenturm" or pid == "DEBE04AL5LX00004":
          continue
        if name == "Olympiastadion" and s["kind"] == "WallSurface":
          # LoD2 extrudes the canopy down to the ground. Its lower wall is not
          # an opaque real facade: retain exact top fascia, detail open piers.
          threshold = max(p[1] for r in rings for p in r) - 0.85
          clipped = []
          for ring in rings:
            out = []
            for a, b in zip(ring, [*ring[1:], ring[0]]):
              aa, bb = a[1] >= threshold, b[1] >= threshold
              if aa:
                out.append(a)
              if aa != bb:
                t = (threshold - a[1]) / (b[1] - a[1])
                out.append([round(a[i] + t * (b[i] - a[i]), 3) for i in range(3)])
            if len(out) >= 3:
              clipped.append(out)
          rings = clipped
          if not rings:
            continue
        shade = (
          1
          if s["kind"] == "RoofSurface"
          else 0.88
          if abs(rings[0][0][0] - rings[0][1][0]) < 0.1
          else 0.96
        )
        rgb = [int(((tint >> k) & 255) * shade) for k in [16, 8, 0]]
        color = sum(c << k for c, k in zip(rgb, [16, 8, 0]))
        if s["kind"] == "RoofSurface":
          color = (
            0xD9DED6
            if name == "Olympiastadion"
            else 0x6D6154
            if name in {"Palas", "Torhaus"}
            else color
          )
        surface(g, rings, color)
    for oid in oids:
      if not any(f["properties"]["osmId"] == oid for f in exclusions):
        exclusions.append(
          {
            "type": "Feature",
            "geometry": features[oid]["geometry"],
            "properties": {
              "osmId": oid,
              "name": name,
              "parentIds": [r[2] for r in PARENTS if oid in r[3]],
              "policy": "Exact matching generic building owner only; all complete source sheets retained in west-landmarks-v187-source.json",
            },
          }
        )

  # More legible steelwork, central lift shaft and glazed decks over the retained
  # 147m v179/v182 tower; no old model or source line is suppressed.
  mast = next(
    a
    for a in json.loads((GEO / "outer-thin-outlines-v179.json").read_text())["anchors"]
    if a["name"] == "Funkturm"
  )
  x, z = world(mast["lon"], mast["lat"])
  g = group("Funkturm")
  levels = [(0, 10), (25, 7), (55, 4), (85, 3), (126, 2.5), (138, 0.7), (147, 0.15)]
  corners = [(-1, -1), (-1, 1), (1, 1), (1, -1)]
  for (lo, a), (hi, b) in zip(levels, levels[1:]):
    for sx, sz in corners:
      rod(
        g,
        [x + sx * a, GROUND + lo, z + sz * a],
        [x + sx * b, GROUND + hi, z + sz * b],
        0.35 if hi < 86 else 0.23,
        0x8F8A77,
      )
    count = math.ceil((hi - lo) / 5)
    for j in range(count):
      y0, y1 = lo + (hi - lo) * j / count, lo + (hi - lo) * (j + 1) / count
      w0, w1 = a + (b - a) * j / count, a + (b - a) * (j + 1) / count
      for (aa, bb), (cc, dd) in zip(corners, [*corners[1:], corners[0]]):
        rod(
          g,
          [x + aa * w0, GROUND + y0, z + bb * w0],
          [x + cc * w1, GROUND + y1, z + dd * w1],
          0.14,
          0xA49A83,
        )
        rod(
          g,
          [x + cc * w0, GROUND + y0, z + dd * w0],
          [x + aa * w1, GROUND + y1, z + bb * w1],
          0.14,
          0xA49A83,
        )
  for y, w, h in [(55, 15, 3), (126, 10, 2)]:
    box(g, x, GROUND + y - 0.15, z, w + 0.8, 0.3, w + 0.8, 0xAAA58C)
    box(g, x, GROUND + y + h + 0.15, z, w + 0.9, 0.3, w + 0.9, 0xB9B4A4)
    for i in range(9):
      for side in [-1, 1]:
        u = (i / 8 - 0.5) * w
        box(
          g,
          x + u,
          GROUND + y + h / 2,
          z + side * (w / 2 + 0.08),
          0.10,
          h,
          0.14,
          0xBCB6A0,
        )
        box(
          g,
          x + side * (w / 2 + 0.08),
          GROUND + y + h / 2,
          z + u,
          0.14,
          h,
          0.10,
          0xBCB6A0,
        )
  box(g, x + 0.55, GROUND + 63, z, 0.08, 126, 1.1, 0x6D8990)
  box(g, x, GROUND + 63, z + 0.55, 1.1, 126, 0.08, 0x758D91)
  for y in range(2, 127, 3):
    box(g, x, GROUND + y, z, 1.1, 0.10, 1.1, 0xB9BAB0)
  for sx, sz in corners:
    rod(
      g,
      [x + sx * 0.55, GROUND, z + sz * 0.55],
      [x + sx * 0.55, GROUND + 126, z + sz * 0.55],
      0.13,
      0x719091,
    )
  g["anchor"] = [x, GROUND + 60, z]

  # Source-bound stadium opening. Keep the genuine below-plaza pitch visible
  # through a separate exact ground cutout. Terrace subdivisions are estimates.
  source_outer = next(r for r in profiles if r["parentId"] == "DEBE04AL5LX00004")[
    "sourceParts"
  ][0]["ring"]
  stadium = MultiPolygon([Polygon(source_outer)])
  athletic = footprint("relation/2418295")
  track_outer = Polygon(list(athletic.geoms)[0].exterior)
  pitch_y = GROUND + 50.783 - 67.0
  pitch_bounds = stadium.bounds
  gs = group("Olympiastadion")
  ring_surface(gs, stadium, pitch_y - 0.05, 0x8A9387)
  rim = stadium.difference(stadium.buffer(-6))
  ring_surface(gs, rim, GROUND, 0xBDB6A5)
  tower_center = footprint("way/48983459").centroid
  centre = track_outer.centroid
  marathon = LineString(
    [[centre.x, centre.y], [tower_center.x, tower_center.y]]
  ).buffer(12.325, cap_style=2)
  # Operator's 136 stone colonnade piers, kept off the 24.65m western gap.
  source_outer = next(r for r in profiles if r["parentId"] == "DEBE04AL5LX00004")[
    "sourceParts"
  ][0]["ring"]
  outline = Polygon(source_outer).exterior
  for i in range(136):
    u = (i + 0.5) * outline.length / 136
    p = outline.interpolate(u)
    if marathon.covers(p):
      continue
    a = outline.interpolate(max(0, u - 0.25))
    b = outline.interpolate(min(outline.length, u + 0.25))
    angle = math.atan2(-(b.y - a.y), b.x - a.x)
    box(gs, p.x, GROUND + 8.185, p.y, 1.65, 16.37, 1.8, 0xBFB7A1, angle)
  for y in [8.4, 16.37]:
    for a, b in zip(outline.coords, list(outline.coords)[1:]):
      if marathon.covers(Point((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)):
        continue
      rod(gs, [a[0], GROUND + y, a[1]], [b[0], GROUND + y, b[1]], 0.9, 0xC3BBA6)
  support = track_outer.buffer(8).exterior
  for i in range(20):
    p = support.interpolate((i + 0.5) * support.length / 20)
    if marathon.covers(p):
      continue
    rod(gs, [p.x, 18.7, p.y], [p.x, 27.2, p.y], 0.35, 0xBCC4C0)
  nav = [
    {"role": "stadium-bottom", "y": round(pitch_y, 3), "geometry": mapping(stadium)}
  ]
  for row in range(36):
    inner = track_outer.buffer(row * 1.25 + 0.5, quad_segs=12)
    outer = track_outer.buffer((row + 1) * 1.25 + 0.5, quad_segs=12)
    terrace = outer.difference(inner).intersection(stadium).difference(marathon)
    y = pitch_y + 1 + (row + 1) * 0.87
    if not terrace.is_empty:
      ring_surface(gs, terrace, y, 0x547495 if row % 2 else 0x607E9B)
      for poly in [terrace] if terrace.geom_type == "Polygon" else terrace.geoms:
        for ring in [poly.exterior, *poly.interiors]:
          for a, b in zip(ring.coords, list(ring.coords)[1:]):
            surface(
              gs,
              [
                [
                  [a[0], y - 0.87, a[1]],
                  [b[0], y - 0.87, b[1]],
                  [b[0], y, b[1]],
                  [a[0], y, a[1]],
                ]
              ],
              0x6F889C,
            )
      nav.append(
        {
          "role": "estimated-seating-step",
          "y": round(y, 3),
          "geometry": mapping(terrace),
        }
      )
  gs["anchor"] = [round(centre.x, 3), 6, round(centre.y, 3)]
  land_geometry = mapping(
    transform(lambda x, z, y=None: UNPROJECT(x + 389500, 5820000 - z), stadium)
  )
  (GEO / "west-landmarks-v187-stadium-cutout.geojson").write_text(
    json.dumps(
      {
        "type": "FeatureCollection",
        "features": [
          {
            "type": "Feature",
            "properties": {
              "osmId": "way/24296022",
              "sourceParentId": "DEBE04AL5LX00004",
              "policy": "Exact full LoD2 outer stadium plan only; rendered source walls/roofs and authored infield/terraces replace flat new land. Source inventory remains.",
              "pitchY": round(pitch_y, 3),
              "plazaY": GROUND,
            },
            "geometry": land_geometry,
          }
        ],
      },
      separators=(",", ":"),
    )
    + "\n"
  )
  (DATA / "westernStadiumV187Navigation.json").write_text(
    json.dumps(
      {
        "schemaVersion": 1,
        "coordinateFrame": "viewer x/z metres",
        "bounds": list(pitch_bounds),
        "pitchY": round(pitch_y, 3),
        "cutout": mapping(stadium),
        "trackOuter": mapping(track_outer),
        "marathonOpening": mapping(marathon.intersection(stadium)),
        "seating": {
          "firstOffsetM": 0.5,
          "rowDepthM": 1.25,
          "rows": 36,
          "firstRiseM": 1,
          "risePerRowM": 0.87,
        },
        "rimWidthM": 6,
        "rimY": GROUND,
      },
      separators=(",", ":"),
    )
    + "\n"
  )
  evidence["conflicts"].append(
    {
      "name": "Olympiastadion enclosing ground owner",
      "parentId": "DEBE04AL5LX00004",
      "sourceAreaM2": 56125.991,
      "policy": "The newly imported LoD2 owner is a closed 3m-high plate across the documented sunken infield. Its complete profile remains in the source receipt; active representation keeps its exact exterior outline as a6m circulation rim at plaza ground, allowing the real infield and open western passage. Measured roof sheets remain unchanged. Coarse canopy-to-ground wall extrusions are trimmed to their top0.85m fascia; published colonnade/post counts guide the open structural reading below.",
    }
  )
  evidence["stadium"] = {
    "sourcePitchNHN": 50.783,
    "plazaDatumNHN": 67.0,
    "pitchY": round(pitch_y, 3),
    "seatingRows": 36,
    "marathonOpeningM": 24.65,
    "status": "Exact LoD2 outer ground cutout and OSM athletic plan, retained full LoD2 shells. Common67m plaza datum and blue seat terraces are bounded display estimates; not individual seat survey.",
  }

  # Exact athletics/pool/pitch boundaries and the Olympic site pylons.
  for f in osm["features"]:
    t, oid = f["properties"]["tags"], f["properties"]["id"]
    if f["properties"]["area"] != "olympic":
      continue
    p = footprint(oid)
    if t.get("leisure") in {"pitch", "swimming_pool", "track", "bleachers"}:
      c = p.centroid
      g = group(f"Olympiapark {math.floor(c.x / 512)}:{math.floor(c.y / 512)}")
      color = (
        0x63975C
        if t["leisure"] == "pitch"
        else 0x529CA8
        if t["leisure"] == "swimming_pool"
        else 0xB6A990
        if t["leisure"] == "bleachers"
        else 0x537993
      )
      level = (
        pitch_y + 0.02 if stadium.covers(p.representative_point()) else GROUND + 0.05
      )
      ring_surface(g, p, level, color)
      for poly in [p] if p.geom_type == "Polygon" else p.geoms:
        for r in [poly.exterior, *poly.interiors]:
          for a, b in zip(r.coords, list(r.coords)[1:]):
            rod(
              g, [a[0], level + 0.06, a[1]], [b[0], level + 0.06, b[1]], 0.16, 0xCCCAB4
            )
    if (
      t.get("height") == "36"
      and t.get("man_made") == "tower"
      and oid not in {"way/48983460", "way/48983461"}
    ):
      g = group("Olympic gateway pylons")
      ring_surface(g, p, GROUND + 36, 0xCAC0A4)
      for poly in [p] if p.geom_type == "Polygon" else p.geoms:
        for a, b in zip(poly.exterior.coords, list(poly.exterior.coords)[1:]):
          surface(
            g,
            [
              [
                [a[0], GROUND, a[1]],
                [b[0], GROUND, b[1]],
                [b[0], GROUND + 36, b[1]],
                [a[0], GROUND + 36, a[1]],
              ]
            ],
            0xC6BA9E,
          )
      exclusions.append(
        {
          "type": "Feature",
          "geometry": f["geometry"],
          "properties": {
            "osmId": oid,
            "name": t["name"],
            "parentIds": [],
            "policy": "Exact OSM pylon owner retained in dedicated 36m outline",
          },
        }
      )

  # The surveyed Glockenturm box is opened at the belfry. Keep the surveyed
  # plan and height; 77.17m includes its architectural base (source datum differs).
  g = group("Glockenturm")
  tower = footprint("way/48983459")
  c = tower.centroid
  coords = (
    list(tower.geoms[0].exterior.coords)
    if tower.geom_type == "MultiPolygon"
    else list(tower.exterior.coords)
  )
  a, b = max(zip(coords, coords[1:]), key=lambda ab: math.dist(*ab))
  width = math.dist(a, b)
  angle = math.atan2(-(b[1] - a[1]), b[0] - a[0])
  depth = tower.area / width
  source_height = 143.092 - 68.226
  shaft_top = source_height - 12.0
  box(g, c.x, GROUND + shaft_top / 2, c.y, width, shaft_top, depth, 0xC9C2AB, angle)
  # Open chamber: four corner piers, internal bell, thin roof and parapet.
  co, si = math.cos(angle), -math.sin(angle)

  def local(u: float, v: float) -> tuple[float, float]:
    return c.x + co * u - si * v, c.y + si * u + co * v

  for u in [-width / 2 + 0.4, width / 2 - 0.4]:
    for v in [-depth / 2 + 0.4, depth / 2 - 0.4]:
      px, pz = local(u, v)
      box(g, px, GROUND + shaft_top + 5.0, pz, 0.8, 10, 0.8, 0xCFC8B3, angle)
  for level in [shaft_top, source_height - 1.8]:
    box(g, c.x, GROUND + level, c.y, width + 0.5, 0.6, depth + 0.5, 0xB9B29F, angle)
  for u in [-width / 2, width / 2]:
    px, pz = local(u, 0)
    box(g, px, GROUND + source_height - 0.6, pz, 0.25, 1.2, depth, 0xBEB8A6, angle)
  for v in [-depth / 2, depth / 2]:
    px, pz = local(0, v)
    box(g, px, GROUND + source_height - 0.6, pz, width, 1.2, 0.25, 0xBEB8A6, angle)
  for i in range(4):
    box(
      g,
      c.x,
      GROUND + shaft_top + 3.8 + i * 0.55,
      c.y,
      2.6 - i * 0.5,
      0.55,
      2.6 - i * 0.5,
      0x737459,
      angle,
    )
  g["anchor"] = [round(c.x, 3), GROUND + 35, round(c.y, 3)]
  evidence["conflicts"].append(
    {
      "name": "Glockenturm",
      "publishedHeightM": 77.17,
      "sourceShaftHeightM": round(source_height, 3),
      "policy": "Keep source height and plan; different base datum. Coarse cuboid belfry upper12m opened into estimated chamber/pier silhouette, full original source retained.",
    }
  )

  # Mapped fortress curtain and four angular bastions remain hollow; no filled
  # square footprint that would bury the inner court or neighbouring moat.
  g = group("Zitadelle")
  castle = footprint("way/4902365")
  for poly in [castle] if castle.geom_type == "Polygon" else castle.geoms:
    for a, b in zip(poly.exterior.coords, list(poly.exterior.coords)[1:]):
      d = math.dist(a, b)
      if d < 0.02:
        continue
      rod(g, [a[0], GROUND + 4.1, a[1]], [b[0], GROUND + 4.1, b[1]], 0.8, 0xA77861)
      # A vertical, source-bound curtain strip rather than opaque site fill.
      surface(
        g,
        [
          [
            [a[0], GROUND, a[1]],
            [b[0], GROUND, b[1]],
            [b[0], GROUND + 8, b[1]],
            [a[0], GROUND + 8, a[1]],
          ]
        ],
        0xA77861,
      )
      rod(g, [a[0], GROUND + 8.15, a[1]], [b[0], GROUND + 8.15, b[1]], 0.5, 0x8A896A)
  jt = footprint("way/25867264").centroid
  g["anchor"] = [round(jt.x, 3), GROUND + 15, round(jt.y, 3)]
  # Preserve the real cylindrical source crown. Sparse slit windows make the
  # tower readable without inventing a repetitive glazed facade.
  for y in [10, 19]:
    for i in range(8):
      t = i * math.tau / 8
      box(
        g,
        jt.x + 6.0 * math.cos(t),
        GROUND + y,
        jt.y + 6.0 * math.sin(t),
        0.50,
        1.9,
        0.12,
        0x45483E,
        math.pi / 2 - t,
      )

  # Each source sheet is also interpreted as independent block-native surface
  # samples, generated offline without hidden volume infill or a smooth double.
  for g in groups.values():
    native: dict[tuple, list] = {}

    def block(
      x: float, y: float, z: float, w: float, h: float, d: float, col: int
    ) -> None:
      r = roundrow([x, y, z, w, h, d, col])
      native[tuple(r)] = r

    for r in g["boxes"]:
      c, s = abs(math.cos(r[6])), abs(math.sin(r[6]))
      block(
        r[0],
        r[1],
        r[2],
        max(0.23, r[3] * c + r[5] * s),
        r[4],
        max(0.23, r[3] * s + r[5] * c),
        r[7],
      )
    for r in g["rods"]:
      a, b = np.asarray(r[:3]), np.asarray(r[3:6])
      count = max(1, math.ceil(float(np.linalg.norm(b - a)) / 1.5))
      dv = np.abs(b - a) / count
      for j in range(count):
        p = a + (b - a) * (j + 0.5) / count
        block(*p, max(0.28, dv[0]), max(0.28, dv[1]), max(0.28, dv[2]), r[7])
    for s in g["surfaces"]:
      for tri in s["triangles"]:
        a, b, c = np.asarray(tri)
        normal = np.cross(b - a, c - a)
        if np.linalg.norm(normal) < 1e-5:
          continue
        axis = int(np.argmax(np.abs(normal)))
        dims = [i for i in range(3) if i != axis]
        poly = Polygon([[v[i] for i in dims] for v in [a, b, c]])
        lo0, lo1, hi0, hi1 = poly.bounds
        # 2m native source skin: no solid voxel interiors.
        step = 2.0
        for i in range(math.floor(lo0 / step), math.ceil(hi0 / step)):
          for j in range(math.floor(lo1 / step), math.ceil(hi1 / step)):
            q = Point((i + 0.5) * step, (j + 0.5) * step)
            if not poly.covers(q):
              continue
            p = np.zeros(3)
            p[dims] = [q.x, q.y]
            p[axis] = (
              a[axis] - sum(normal[d] * (p[d] - a[d]) for d in dims) / normal[axis]
            )
            size = [step, step, step]
            size[axis] = 0.4
            block(*p, *size, s["color"])
    # Lossless coalescing of neighbouring coplanar native boxes. In particular
    # a large mapped pitch is a few row runs, never tens of thousands of cubes.
    rows = list(native.values())
    for axis in [0, 2, 1]:
      collections: dict[tuple, list] = {}
      for r in rows:
        key = tuple(r[i] for i in range(7) if i not in [axis, axis + 3])
        collections.setdefault(key, []).append(r)
      rows = []
      for members in collections.values():
        members.sort(key=lambda r: r[axis])
        current = members[0].copy()
        for r in members[1:]:
          hi = current[axis] + current[axis + 3] / 2
          lo = r[axis] - r[axis + 3] / 2
          if abs(hi - lo) < 0.001:
            end = r[axis] + r[axis + 3] / 2
            start = current[axis] - current[axis + 3] / 2
            current[axis] = round((end + start) / 2, 3)
            current[axis + 3] = round(end - start, 3)
          else:
            rows.append(current)
            current = r.copy()
        rows.append(current)
    g["native"] = rows
    if "anchor" not in g:
      points = [p for s in g["surfaces"] for t in s["triangles"] for p in t] + [
        r[:3] for r in g["boxes"]
      ]
      g["anchor"] = (
        [round(float(v), 2) for v in np.mean(points, axis=0)] if points else [0, 0, 0]
      )
  # The expansion's new generic LoD2 shells incorrectly fill the open steel
  # lattice of the already-authored Funkturm. Retain these exact full sources,
  # but transfer their complete footprints to the combined v179/v182/v187 model.
  for pid in ["DEBE04YY500006Zr", "DEBE04YY50002bpq"]:
    archive = GEO / "raw/lod2/LoD2_383_5818.zip"
    parent = extract_parent(archive, pid)
    parts = [part_profile(p) for p in leaf_building_parts(parent) or [parent]]
    record = {
      "name": "Funkturm open lattice source conflict",
      "parentId": pid,
      "osmIds": ["way/30926247"],
      "sourceUrl": f"https://gdi.berlin.de/data/a_lod2/atom/{archive.name}",
      "sourceSha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
      "offsetY": round(GROUND - min(p["ground_y_m"] for p in parts), 3),
      "sourceParts": parts,
    }
    profiles.append(record)
    evidence["owners"].append(
      {k: v for k, v in record.items() if k != "sourceParts"}
      | {
        "sourcePartIds": [p["id"] for p in parts],
        "sourceSurfaces": sum(len(p["surfaces"]) for p in parts),
      }
    )
  evidence["conflicts"].append(
    {
      "name": "Funkturm generic opaque shafts",
      "parentIds": ["DEBE04YY500006Zr", "DEBE04YY50002bpq"],
      "policy": "These newly introduced generic enclosing masses hide the existing open147m lattice and its decks. Transfer exact complete source footprints to the retained v179/v182 and refined v187 model; original source profiles remain archived. No old source packet or tower detail removed.",
    }
  )
  # Geometry-based packet clipping needs full official owners as well as OSM
  # anchors. OSM stadium C-rings and tiny pylon cores do not include courtyards,
  # low wings or the false enclosing stadium plate. Never substitute a bbox.
  for record in profiles:
    footprint_union = unary_union(
      [Polygon(p["ring"], p["holes"]) for p in record["sourceParts"]]
    )
    geometry = mapping(
      transform(
        lambda x, z, y=None: UNPROJECT(x + 389500, 5820000 - z), footprint_union
      )
    )
    exclusions.append(
      {
        "type": "Feature",
        "geometry": geometry,
        "properties": {
          "name": record["name"],
          "osmId": record["osmIds"][0],
          "sourceParentId": record["parentId"],
          "parentIds": [record["parentId"]],
          "kind": "official-complete-footprint",
          "areaM2": round(footprint_union.area, 3),
          "policy": "Exact union of complete official source parts and holes; corresponding displayed hero retains real solids/explicit open-space interpretation. Archive full original profiles.",
        },
      }
    )
  navigation = {"buildings": []}
  for record in profiles:
    if record["parentId"] in {
      "DEBE04AL5LX00004",
      "DEBE04YY500001If",
      "DEBE04YY500006Zr",
      "DEBE04YY50002bpq",
    }:
      continue
    for part in record["sourceParts"]:
      top = part["top_y_m"] + record["offsetY"]
      low = (
        top - 0.85
        if record["name"] == "Olympiastadion"
        else part["ground_y_m"] + record["offsetY"]
      )
      navigation["buildings"].append(
        {
          "id": part["id"],
          "owner": record["parentId"],
          "ring": part["ring"],
          "holes": part["holes"],
          "groundY": round(low, 3),
          "topY": round(top, 3),
        }
      )
  for gn in ["Glockenturm", "Olympiastadion"]:
    for i, r in enumerate(groups[gn]["boxes"]):
      co, si = math.cos(r[6]), -math.sin(r[6])
      ring = [
        [round(r[0] + co * u - si * v, 3), round(r[2] + si * u + co * v, 3)]
        for u, v in [
          (-r[3] / 2, -r[5] / 2),
          (r[3] / 2, -r[5] / 2),
          (r[3] / 2, r[5] / 2),
          (-r[3] / 2, r[5] / 2),
        ]
      ]
      navigation["buildings"].append(
        {
          "id": f"west-v187-{gn}-{i}",
          "owner": "DEBE04YY500001If" if gn == "Glockenturm" else "DEBE04AL5LX00004",
          "ring": ring,
          "holes": [],
          "groundY": round(r[1] - r[4] / 2, 3),
          "topY": round(r[1] + r[4] / 2, 3),
        }
      )
  for f in osm["features"]:
    t = f["properties"]["tags"]
    if (
      t.get("height") == "36"
      and t.get("man_made") == "tower"
      and f["properties"]["id"] not in {"way/48983460", "way/48983461"}
    ):
      p = footprint(f["properties"]["id"])
      for poly in [p] if p.geom_type == "Polygon" else p.geoms:
        navigation["buildings"].append(
          {
            "id": f["properties"]["id"],
            "owner": f["properties"]["id"],
            "ring": list(poly.exterior.coords),
            "holes": [list(h.coords) for h in poly.interiors],
            "groundY": GROUND,
            "topY": GROUND + 36,
          }
        )
  (DATA / "westLandmarksV187Navigation.json").write_text(
    json.dumps(navigation, separators=(",", ":")) + "\n"
  )
  evidence["gatewaySourcePolicy"] = (
    "Preussenturm and Bayernturm keep all three measured parts, including low3m wings. LoD2 measured shafts32.418/32.479m take precedence over unsurveyed OSM36m tag; other four pylons retain their mapped36m display height."
  )
  evidence["sources"] = [
    {
      "url": "https://www.messe-berlin.de/de/veranstalter/locations/funkturm/fakten",
      "facts": "Restaurant55m, observation126m, glass lift",
    },
    {
      "url": "https://www.messe-berlin.de/de/presse/pressemitteilungen/news_21504.html",
      "facts": "Total147m",
    },
    {
      "url": "https://olympiastadion.berlin/en/facts-figures/",
      "facts": "Published dimensions, 136columns, sunken pitch, roof and Marathon opening",
    },
    {
      "url": "https://olympiastadion.berlin/de/geschichte/",
      "facts": "Roof remains open toward the western Marathon gate",
    },
    {
      "url": "https://www.berlin.de/sehenswuerdigkeiten/3561753-3558930-glockenturm.html",
      "facts": "Reconstructed tower77.17m, platform and bell chamber",
    },
    {
      "url": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09040530",
      "facts": "Axial Olympic site, pylons, Langemarckhalle and Maifeld",
    },
    {
      "url": "https://www.berlin.de/ba-spandau/ueber-den-bezirk/tourismus/sehenswertes/artikel.288536.php",
      "facts": "Four-bastion fortress,30m Julius tower, Palas and gate",
    },
  ]
  evidence["budgets"] = {
    "groups": len(groups),
    "triangles": sum(
      len(s["triangles"]) for g in groups.values() for s in g["surfaces"]
    ),
    "boxes": sum(len(g["boxes"]) for g in groups.values()),
    "rods": sum(len(g["rods"]) for g in groups.values()),
    "nativeBlocks": sum(len(g["native"]) for g in groups.values()),
  }
  (GEO / "west-landmarks-v187-source.json").write_text(
    json.dumps({"schemaVersion": 1, "profiles": profiles}, separators=(",", ":")) + "\n"
  )
  (GEO / "west-landmarks-v187-exclusions.geojson").write_text(
    json.dumps(
      {"type": "FeatureCollection", "features": exclusions}, separators=(",", ":")
    )
    + "\n"
  )
  return {"schemaVersion": 1, "groups": list(groups.values())}, evidence


def main() -> None:
  """Write bounded deterministic viewer data and source receipts."""
  payload, evidence = build()
  (DATA / "westLandmarksV187.json").write_text(
    json.dumps(payload, separators=(",", ":")) + "\n"
  )
  (GEO / "west-landmarks-v187-evidence.json").write_text(
    json.dumps(evidence, indent=2) + "\n"
  )
  print(evidence["budgets"])


if __name__ == "__main__":
  main()
