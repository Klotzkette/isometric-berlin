"""Step 10: exact OSM regional hairlines, not a filled metropolitan extension."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import struct
import sys
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path

from pyproj import Transformer
from shapely import make_valid
from shapely.geometry import LineString, Polygon, box, mapping, shape
from shapely.ops import polygonize, transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
RAW = GEO / "raw/region-v200"
DATA = ROOT / "src/app/src/data"
SOURCE = GEO / "region-outlines-v200-source.json.gz"
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True).transform
INVERSE = Transformer.from_crs(25833, 4326, always_xy=True).transform
GROUND = 3.0
CELL = 2048


def encode(value: object) -> bytes:
  return (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


def world(x: float, y: float) -> tuple[float, float]:
  e, n = PROJECT(x, y)
  return e - 389500, 5820000 - n


def polygons(geometry: object) -> list:
  if geometry.is_empty:
    return []
  if geometry.geom_type == "Polygon":
    return [geometry]
  return [p for g in getattr(geometry, "geoms", []) for p in polygons(g)]


def nav_polys(geometry: object) -> list[dict]:
  return [
    {
      "ring": [[round(x, 2), round(z, 2)] for x, z in p.exterior.coords],
      "holes": [[[round(x, 2), round(z, 2)] for x, z in r.coords] for r in p.interiors],
    }
    for p in polygons(geometry)
  ]


def xml_elements(path: Path) -> dict:
  result = {}
  for e in ET.parse(path).getroot():
    if e.tag not in ("node", "way", "relation"):
      continue
    row = {
      "type": e.tag,
      "id": int(e.get("id")),
      "tags": {t.get("k"): t.get("v") for t in e.findall("tag")},
    }
    if e.tag == "node":
      row.update(lon=float(e.get("lon")), lat=float(e.get("lat")))
    elif e.tag == "way":
      row["nodes"] = [int(n.get("ref")) for n in e.findall("nd")]
    else:
      row["members"] = [
        {"type": m.get("type"), "ref": int(m.get("ref")), "role": m.get("role")}
        for m in e.findall("member")
      ]
    result[e.tag, row["id"]] = row
  return result


def mapped_shapes(elements: dict) -> tuple[dict, set]:
  """Assemble exact area outer/inner rings; missing members are never guessed."""
  shapes, used = {}, set()
  for key, row in elements.items():
    if key[0] != "way":
      continue
    assert all(("node", n) in elements for n in row["nodes"])
    pts = [
      (elements["node", n]["lon"], elements["node", n]["lat"]) for n in row["nodes"]
    ]
    shapes[key] = (
      Polygon(pts)
      if row["nodes"][0] == row["nodes"][-1] and len(pts) >= 4
      else LineString(pts)
    )
  for key, row in elements.items():
    if key[0] != "relation" or row["tags"].get("type") != "multipolygon":
      continue
    if not (row["tags"].get("natural") == "water" or row["tags"].get("building")):
      continue
    members = [m for m in row["members"] if m["type"] == "way"]
    assert all(("way", m["ref"]) in shapes for m in members), key
    rings = {}
    for role in ("outer", "inner"):
      lines = []
      for m in members:
        if (m["role"] or "outer") != role:
          continue
        g = shapes["way", m["ref"]]
        lines.append(g.exterior if g.geom_type == "Polygon" else g)
      rings[role] = list(polygonize(lines))
    assert rings["outer"], key
    shapes[key] = unary_union(rings["outer"]).difference(unary_union(rings["inner"]))
    used.update(("way", m["ref"]) for m in members)
  return shapes, used


def extract() -> dict:
  """Reduce bounded official OSM API responses to relevant complete features."""
  all_a10 = json.loads((RAW / "a10-complete.json").read_bytes())["elements"]
  nodes = {e["id"]: e for e in all_a10 if e["type"] == "node"}
  ways = [e for e in all_a10 if e["type"] == "way"]
  relations = [e for e in all_a10 if e["type"] == "relation"]
  original = {
    e["id"]
    for e in json.loads((RAW / "a10-all.json").read_bytes())["elements"]
    if e["type"] == "way"
  }
  rows = []
  for w in ways:
    assert w["tags"]["highway"] == "motorway" and w["tags"]["ref"] == "A 10"
    rows.append(
      {
        "id": f"way/{w['id']}",
        "site": "A10",
        "kind": "motorway",
        "nodes": w["nodes"],
        "tags": w["tags"],
        "geometry": mapping(
          LineString([(nodes[n]["lon"], nodes[n]["lat"]) for n in w["nodes"]])
        ),
      }
    )
  site_shapes = {}
  for site, file in [("BER", "ber-map.osm"), ("Grünheide", "gruenheide-map.osm")]:
    elements = xml_elements(RAW / file)
    if site == "BER":
      elements.update(xml_elements(RAW / "ber-west.osm"))
      elements.update(xml_elements(RAW / "ber-north.osm"))
    if site == "Grünheide":
      elements.update(xml_elements(RAW / "relation-57592.osm"))
    shapes, members = mapped_shapes(elements)
    if site == "BER":
      # The aerodrome outline describes airside land and omits Terminal 2
      # and the named landside airport-center buildings. Add those exact owners.
      airport_keys = [
        ("way", n) for n in (859790021, 1132137322, 700218390, 193676334, 1083495102)
      ] + [("relation", n) for n in (2118408, 2119133, 2119185)]
      scope = unary_union([shapes[k] for k in airport_keys])
      area_ids = [f"{k[0]}/{k[1]}" for k in airport_keys]
    else:
      selected = [
        (k, g)
        for k, g in shapes.items()
        if elements[k]["tags"].get("landuse") == "residential"
        or elements[k]["tags"].get("name") in ("Werlsee", "Peetzsee")
        and elements[k]["tags"].get("natural") == "water"
      ]
      # Only the mapped village clusters selected by this explicit 4.7 km²
      # extraction window; all their complete source rings remain intact.
      scope = unary_union([g for _, g in selected])
      area_ids = [f"{k[0]}/{k[1]}" for k, _ in selected]
    site_shapes[site] = {"geometry": mapping(scope), "ids": area_ids}
    for key, g in shapes.items():
      if key in members or g.is_empty:
        continue
      t = elements[key]["tags"]
      kind = None
      if t.get("building") and t["building"] != "no":
        kind = "building"
      elif t.get("natural") == "water":
        kind = "water"
      elif site == "BER" and t.get("aeroway") in (
        "runway",
        "taxiway",
        "apron",
        "aerodrome",
      ):
        kind = t["aeroway"]
      elif (
        t.get("highway")
        in (
          "motorway",
          "motorway_link",
          "trunk",
          "trunk_link",
          "primary",
          "secondary",
          "tertiary",
          "unclassified",
          "residential",
          "service",
          "living_street",
          "pedestrian",
          "footway",
          "path",
          "cycleway",
        )
        and not t.get("indoor")
        and not t.get("level")
        and t.get("tunnel") != "yes"
      ):
        kind = "road"
      if kind is None or not g.intersects(scope):
        continue
      if kind in ("building", "water") and not g.representative_point().within(
        scope.buffer(0.00002)
      ):
        continue
      # Roads retain their full mapped way when touching the village or airport;
      # navigation scope follows only a narrow road corridor, not a bbox.
      rows.append(
        {
          "id": f"{key[0]}/{key[1]}",
          "site": site,
          "kind": kind,
          "tags": t,
          "geometry": mapping(g),
        }
      )
  return {
    "schemaVersion": 1,
    "license": "OpenStreetMap contributors, ODbL 1.0",
    "retrievedDate": "2026-10-09",
    "sources": [
      "https://api.openstreetmap.org/api/0.6/relation/21105/full.json",
      "https://api.openstreetmap.org/api/0.6/map?bbox=13.48,52.34,13.55,52.385",
      "https://api.openstreetmap.org/api/0.6/map?bbox=13.799,52.408,13.855,52.438",
      "https://api.openstreetmap.org/api/0.6/map?bbox=13.45,52.34,13.48,52.391",
      "https://api.openstreetmap.org/api/0.6/map?bbox=13.48,52.385,13.54,52.392",
      "https://api.openstreetmap.org/api/0.6/relation/57592/full",
    ],
    "rawSha256": {
      f: hashlib.sha256((RAW / f).read_bytes()).hexdigest()
      for f in (
        "a10-all.json",
        "a10-complete.json",
        "ber-map.osm",
        "gruenheide-map.osm",
        "ber-west.osm",
        "ber-north.osm",
        "relation-57592.osm",
      )
    },
    "a10Relations": [
      {"id": e["id"], "tags": e["tags"], "members": e["members"]} for e in relations
    ],
    "a10EndpointRecoveredWays": sorted(
      w["id"] for w in ways if w["id"] not in original
    ),
    "sites": site_shapes,
    "features": rows,
  }


def height(tags: dict) -> tuple[float, str]:
  for key in ("height", "building:levels"):
    try:
      value = float(tags[key].replace("m", "").strip())
      if value > 0:
        return (value if key == "height" else value * 3), (
          "OSM height" if key == "height" else "OSM levels × estimated 3 m"
        )
    except (KeyError, ValueError):
      pass
  if tags.get("aeroway") == "terminal":
    return 15, "unmeasured terminal outline estimate"
  return (
    4 if tags.get("building") in ("garage", "garages", "shed", "roof") else 8
  ), "unmeasured outline estimate"


def build(source: dict) -> dict:
  groups = defaultdict(
    lambda: {
      "positions": [],
      "nativePositions": [],
      "colors": [],
      "nativeColors": [],
      "features": [],
    }
  )
  navcells = defaultdict(
    lambda: {"groundY": GROUND, "ground": [], "roads": [], "water": [], "buildings": []}
  )
  scope_parts = []
  projected = {}
  for site, record in source["sites"].items():
    p = transform(world, shape(record["geometry"]))
    scope_parts.extend(polygons(make_valid(p)))
  colours = {
    "motorway": 0x76796D,
    "road": 0x817C6F,
    "building": 0x84756A,
    "water": 0x6096A0,
    "aerodrome": 0x899276,
    "runway": 0x525F66,
    "taxiway": 0x9A8B56,
    "apron": 0x9A9484,
  }

  def segment(g: dict, a: tuple, b: tuple, colour: int, building: bool) -> None:
    if a == b:
      return
    a, b = [tuple(round(v, 2) for v in point) for point in (a, b)]
    rgb = [(colour >> shift) & 255 for shift in (16, 8, 0)]
    g["positions"].extend((*a, *b))
    g["colors"].extend(rgb * 2)
    # Separate orthogonal outline reading for buildings; source road and water
    # cartography is deliberately shared, like the earlier Ringbahn hairlines.
    if building and a[0] != b[0] and a[2] != b[2]:
      middle = (b[0], a[1], a[2])
      g["nativePositions"].extend((*a, *middle, *middle, *b))
      g["nativeColors"].extend(rgb * 4)
    else:
      g["nativePositions"].extend((*a, *b))
      g["nativeColors"].extend(rgb * 2)

  for feature in source["features"]:
    geometry = make_valid(transform(world, shape(feature["geometry"])))
    projected[feature["id"]] = geometry
    site, kind, tags = feature["site"], feature["kind"], feature["tags"]
    point = geometry.representative_point()
    key = (
      f"A10-{math.floor(point.x / 20000)}-{math.floor(point.y / 20000)}"
      if site == "A10"
      else site
    )
    g = groups[key]
    first, native_first = len(g["positions"]) // 3, len(g["nativePositions"]) // 3
    is_building = kind == "building"
    top, evidence = height(tags) if is_building else (0, "cartographic ground")
    color = colours[kind]
    if geometry.geom_type in ("LineString", "MultiLineString"):
      lines = [geometry] if geometry.geom_type == "LineString" else list(geometry.geoms)
    else:
      lines = [r for p in polygons(geometry) for r in [p.exterior, *p.interiors]]
    for line in lines:
      points = list(line.coords)
      for a, b in zip(points, points[1:]):
        segment(
          g,
          (a[0], GROUND + 0.08, a[1]),
          (b[0], GROUND + 0.08, b[1]),
          color,
          is_building,
        )
        if is_building:
          segment(
            g, (a[0], GROUND + top, a[1]), (b[0], GROUND + top, b[1]), color, True
          )
      if is_building:
        for x, z in points[:-1]:
          segment(g, (x, GROUND + 0.08, z), (x, GROUND + top, z), color, True)
      if (
        kind in ("motorway", "runway", "taxiway") and geometry.geom_type == "LineString"
      ):
        width = float(tags.get("width", "8").split()[0])
        for offset in [-width / 2, width / 2]:
          edge = line.offset_curve(offset)
          for part in [edge] if edge.geom_type == "LineString" else edge.geoms:
            for a, b in zip(part.coords, list(part.coords)[1:]):
              segment(
                g,
                (a[0], GROUND + 0.08, a[1]),
                (b[0], GROUND + 0.08, b[1]),
                color,
                False,
              )
    g["features"].append(
      {
        "id": feature["id"],
        "kind": kind,
        "name": tags.get("name", tags.get("ref", "")),
        "firstVertex": first,
        "vertexCount": len(g["positions"]) // 3 - first,
        "nativeFirstVertex": native_first,
        "nativeVertexCount": len(g["nativePositions"]) // 3 - native_first,
        "height": top,
        "heightSource": evidence,
      }
    )
    if kind in ("motorway", "road", "taxiway"):
      scope_parts.append(geometry.buffer(20, quad_segs=1, join_style="mitre"))
    if kind in ("motorway", "road", "runway", "taxiway"):
      try:
        width = float(tags.get("width", "8" if kind != "road" else "4").split()[0])
      except ValueError:
        width = 8 if kind != "road" else 4
      road = (
        geometry.buffer(width / 2, quad_segs=1, join_style="mitre")
        if geometry.geom_type.endswith("LineString")
        else geometry
      )
      for poly in polygons(road):
        cell = math.floor(poly.centroid.x / CELL), math.floor(poly.centroid.y / CELL)
        navcells[cell]["roads"].extend(nav_polys(poly))
    for poly in polygons(geometry) if is_building or kind == "water" else []:
      cell = math.floor(poly.centroid.x / CELL), math.floor(poly.centroid.y / CELL)
      row = nav_polys(poly)[0]
      if is_building:
        row.update(height=top, minHeight=0, sourceId=feature["id"])
      navcells[cell]["buildings" if is_building else "water"].append(row)
  scope = make_valid(unary_union(scope_parts))
  # Ground ownership adds only the new exact corridor/site complement. All
  # route vertices remain drawn even where an older city already owns ground.
  prior = []
  for name in (
    "surroundingCityScope.json",
    "ringCityScopeV182.json",
    "cityCoverageScopeV183.json",
    "outskirtsScopeV187.json",
    "northCityScopeV190.json",
    "namedScopeV194.json",
    "namedScopeV198.json",
    "eastCityScopeV200.json",
  ):
    old = json.loads((DATA / name).read_bytes())
    prior.extend(make_valid(Polygon(p["ring"], p["holes"])) for p in old["footprint"])
    if "core" in old:
      prior.append(make_valid(Polygon(old["core"]["ring"], old["core"]["holes"])))
  scope = scope.difference(unary_union(prior))
  scope_rows = []
  minx, minz, maxx, maxz = scope.bounds
  for ix in range(math.floor(minx / CELL), math.floor(maxx / CELL) + 1):
    for iz in range(math.floor(minz / CELL), math.floor(maxz / CELL) + 1):
      tile = box(ix * CELL, iz * CELL, (ix + 1) * CELL, (iz + 1) * CELL)
      if not tile.intersects(scope):
        continue
      rows = nav_polys(scope.intersection(tile))
      scope_rows.extend(rows)
      navcells[ix, iz]["ground"] = rows
  nav = []
  for (ix, iz), content in sorted(navcells.items()):
    # Bounds include full houses/water polygons borrowed without copying/slicing.
    pts = [
      p
      for kind in ("ground", "roads", "water", "buildings")
      for row in content[kind]
      for p in row["ring"]
    ]
    if not pts:
      continue
    bounds = [
      min(p[0] for p in pts),
      min(p[1] for p in pts),
      max(p[0] for p in pts),
      max(p[1] for p in pts),
    ]
    nav.append({"origin": [0, 0, 0], "bounds": bounds, "nav": content})
  emitted = []
  for key, g in sorted(groups.items()):
    emitted.append({"key": key, **g})
  for native in (False, True):
    payload = {
      "groups": [
        {
          "key": g["key"],
          "positionsCm": base64.b64encode(
            struct.pack(
              "<" + "i" * len(g["nativePositions" if native else "positions"]),
              *[
                round(v * 100) for v in g["nativePositions" if native else "positions"]
              ],
            )
          ).decode(),
          "colorsU8": base64.b64encode(
            bytes(g["nativeColors" if native else "colors"])
          ).decode(),
          "features": [
            {
              k: v
              for k, v in f.items()
              if k not in ("nativeFirstVertex", "nativeVertexCount")
            }
            | (
              {
                "firstVertex": f["nativeFirstVertex"],
                "vertexCount": f["nativeVertexCount"],
              }
              if native
              else {}
            )
            for f in g["features"]
          ],
        }
        for g in emitted
      ]
    }
    DATA.joinpath(
      "regionOutlinesV200Native.json" if native else "regionOutlinesV200.json"
    ).write_bytes(encode(payload))
  DATA.joinpath("regionOutlinesV200Navigation.json").write_bytes(encode({"tiles": nav}))
  DATA.joinpath("regionalScopeV200.json").write_bytes(
    encode(
      {
        "groundY": GROUND,
        "bounds": [round(x, 2) for x in scope.bounds],
        "footprint": scope_rows,
      }
    )
  )
  crs84 = transform(lambda x, z: INVERSE(x + 389500, 5820000 - z), scope)
  GEO.joinpath("bounds-regional-v200.geojson").write_bytes(
    encode(
      {
        "type": "FeatureCollection",
        "features": [
          {
            "type": "Feature",
            "properties": {
              "scope": "BER, mapped Grünheide village clusters and narrow complete A10 corridor only"
            },
            "geometry": mapping(crs84),
          }
        ],
      }
    )
  )
  a10 = [f for f in source["features"] if f["site"] == "A10"]
  degrees = Counter(n for f in a10 for n in [f["nodes"][0], f["nodes"][-1]])
  assert set(degrees.values()) == {2}
  evidence = {
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "featureCount": len(source["features"]),
    "featuresBySiteKind": dict(
      Counter(f"{f['site']}:{f['kind']}" for f in source["features"])
    ),
    "a10": {
      "rootRelation": 21105,
      "ways": len(a10),
      "endpointDegreeCounts": dict(Counter(degrees.values())),
      "carriagewayLengthM": sum(projected[f["id"]].length for f in a10),
      "recoveredWayIds": source["a10EndpointRecoveredWays"],
    },
    "groups": len(groups),
    "drawnVertices": sum(len(g["positions"]) // 3 for g in emitted),
    "nativeVertices": sum(len(g["nativePositions"]) // 3 for g in emitted),
    "geometryFiles": {
      name: {
        "bytes": (DATA / name).stat().st_size,
        "sha256": hashlib.sha256((DATA / name).read_bytes()).hexdigest(),
      }
      for name in (
        "regionOutlinesV200.json",
        "regionOutlinesV200Native.json",
        "regionOutlinesV200Navigation.json",
        "regionalScopeV200.json",
      )
    },
    "renderBufferBytes": {
      "drawn": sum(len(g["positions"]) * 4 + len(g["colors"]) for g in emitted),
      "native": sum(
        len(g["nativePositions"]) * 4 + len(g["nativeColors"]) for g in emitted
      ),
    },
    "scopeAreaM2": scope.area,
    "scopeBounds": scope.bounds,
    "scopePolygons": len(scope_rows),
    "navigationTiles": len(nav),
    "ground": "Flat cartographic 3m datum, not terrain/grade survey; prior scope geometry repaired read-only where needed and subtracted before cm output rounding",
    "heights": "OSM height including roof, else levels×3m estimate, else explicit 4/8/15m outline estimate. No roof height double counted.",
    "widths": "Tagged width retained; untagged A10/taxiway width8m and local road4m are cartographic estimates; scope buffer20m is presentation only.",
    "sourceCompleteness": "Complete source vertices retained. Two closed directed A10 carriageways; eight missing relation members recovered from exact endpoint-connected OSM A10 ways, never joined with invented lines.",
  }
  GEO.joinpath("region-outlines-v200-evidence.json").write_bytes(encode(evidence))
  return evidence


if __name__ == "__main__":
  if "--extract" in sys.argv or not SOURCE.exists():
    SOURCE.write_bytes(gzip.compress(encode(extract()), mtime=0))
  print(build(json.loads(gzip.decompress(SOURCE.read_bytes()))))
