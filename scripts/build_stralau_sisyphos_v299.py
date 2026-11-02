"""Step 10: bounded additive Stralau/Sisyphos source and packet preparation.

This script never mutates the live manifest or an existing packet. Source sheets
are retained in the evidence archive; centimetre packet encoding is the existing
outer-city display precision. Run only after downloading the named official ZIPs
and exact OSM map extracts into the ignored raw directory.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Any

import build_surrounding_outlines as exporter
import numpy as np
import pyogrio
import shapely
from build_bebelplatz_building_source import part_profile
from build_breitscheid_towers_v161 import triangles_for
from pyproj import Transformer
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Point, Polygon, box, mapping
from shapely.ops import transform, unary_union

from isometric_berlin.data.fetch_lod2 import GML_ID, NS, leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
RAW = GEO / "raw/stralau-v299"
APP = ROOT / "src/app/src/data"
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True).transform
UNPROJECT = Transformer.from_crs(25833, 4326, always_xy=True).transform
PREFIX = "stralau299-"


def sha(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path: Path, value: Any) -> None:
  raw = (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_bytes(
    gzip.compress(raw, compresslevel=9, mtime=0) if path.suffix == ".gz" else raw
  )


def world(g: Any) -> Any:
  return affine_transform(g, [1, 0, 0, -1, -389500, 5820000])


def orthogonal_inside(g: Any, step: float = 0.1) -> Any:
  """Cardinal native complement inside an exact diagonal source-scope seam.

  Full two-metre native cells away from a seam remain untouched. Only a clipped
  building with a noncardinal edge is read on a ten-centimetre boundary grid;
  every emitted cell is wholly inside the exact source/previous-owner mask.
  Original measured sheets remain in the independent source evidence archive.
  """
  if g.is_empty:
    return g
  edges = [
    (a, b)
    for line in exporter.line_parts(g.boundary)
    for a, b in zip(line.coords, list(line.coords)[1:])
  ]
  if all(abs(a[0] - b[0]) < 1e-8 or abs(a[1] - b[1]) < 1e-8 for a, b in edges):
    return g
  minx, minz, maxx, maxz = g.bounds
  xs = np.arange(math.floor(minx / step), math.ceil(maxx / step)) * step
  strips = []
  shapely.prepare(g)
  for iz in range(math.floor(minz / step), math.ceil(maxz / step)):
    z = iz * step
    cells = shapely.box(xs, z, xs + step, z + step)
    occupied = shapely.covers(g, cells)
    edges_at = np.flatnonzero(np.diff(np.concatenate(([False], occupied, [False]))))
    for start, end in zip(edges_at[::2], edges_at[1::2]):
      strips.append(box(xs[start], z, xs[end - 1] + step, z + step))
  return unary_union(strips)


def osm_xml(path: Path) -> tuple[list[dict[str, Any]], dict[str, tuple[float, float]]]:
  root = ET.parse(path).getroot()
  nodes = {
    e.get("id"): PROJECT(float(e.get("lon")), float(e.get("lat")))
    for e in root.findall("node")
  }
  features = []
  for e in root.findall("way"):
    pts = [nodes[n.get("ref")] for n in e.findall("nd") if n.get("ref") in nodes]
    if len(pts) < 2:
      continue
    tags = {t.get("k"): t.get("v") for t in e.findall("tag")}
    geom = Polygon(pts) if len(pts) > 3 and pts[0] == pts[-1] else LineString(pts)
    features.append(dict(id=e.get("id"), tags=tags, geometry=world(geom)))
  return features, nodes


def clip_triangle(
  points: list[list[float]], bounds: tuple[float, ...]
) -> list[list[list[float]]]:
  """Complete exact outside-tile complement without rounding original vertices."""
  polygon = points
  for axis, edge, sign in [
    (0, bounds[0], 1),
    (0, bounds[2], -1),
    (2, bounds[1], 1),
    (2, bounds[3], -1),
  ]:
    out = []
    for a, b in zip(polygon, polygon[1:] + polygon[:1]):
      da, db = sign * (a[axis] - edge), sign * (b[axis] - edge)
      if da >= -1e-8:
        out.append(a)
      if (da >= 0) != (db >= 0):
        t = da / (da - db)
        out.append([a[j] + (b[j] - a[j]) * t for j in range(3)])
    polygon = out
    if len(polygon) < 3:
      return []
  return [[polygon[0], polygon[i], polygon[i + 1]] for i in range(1, len(polygon) - 1)]


def read_official(scope: Any) -> list[dict[str, Any]]:
  result = []
  for name in [
    "LoD2_394_5817.zip",
    "LoD2_395_5817.zip",
    "LoD2_396_5816.zip",
    "LoD2_396_5817.zip",
    "LoD2_397_5816.zip",
    "LoD2_397_5817.zip",
  ]:
    path = GEO / "raw/lod2" / name
    with zipfile.ZipFile(path) as archive:
      for member in archive.namelist():
        if not member.lower().endswith((".gml", ".xml", ".citygml")):
          continue
        with archive.open(member) as stream:
          for _, element in ET.iterparse(stream, events=("end",)):
            if element.tag != f"{{{NS['bldg']}}}Building":
              continue
            try:
              parts = [
                part_profile(p) for p in leaf_building_parts(element) or [element]
              ]
              if any(scope.intersects(Polygon(p["ring"], p["holes"])) for p in parts):
                result.append(dict(id=element.get(GML_ID), archive=name, parts=parts))
            except ValueError:
              pass
            element.clear()
  return result


def additive_chunk(
  chunk_id: str,
  tile: Any,
  ground: Any,
  records: list[dict[str, Any]],
  surfaces: dict[str, Any],
  sheets: dict[str, Any],
  native: bool,
) -> dict[str, Any]:
  """New-only bounded packets, including complete measured drawn roof sheets.

  The old exporter assumes water remains polygonal after native intersection.
  Exact new-only coastal holes can instead produce line-only collections; keep
  only their zero-area polygonal complement here without touching that helper.
  """
  minx, minz, _, _ = tile.bounds

  def polygonal(g: Any) -> Any:
    result = exporter.polygonal(g)
    return Polygon() if result.is_empty else result

  display = {}
  for kind in ["park", "water", "road", "path", "rail", "bridge"]:
    g = polygonal(surfaces.get(kind, Polygon()).intersection(tile))
    if native:
      g = polygonal(exporter.native_polygon(g).intersection(ground))
    display[kind] = g
  mesh = exporter.PackedMesh(minx, minz)
  occupied = display["water"]
  visible = {}
  for kind in ["rail", "path", "road", "park"]:
    visible[kind] = polygonal(
      display[kind]
      .difference(unary_union(list(visible.values())))
      .difference(display["water"])
    )
    occupied = occupied.union(visible[kind])
  mesh.surface(polygonal(ground.difference(occupied)), 3, exporter.COLORS["ground"])
  mesh.surface(display["water"], exporter.WATER_Y, exporter.COLORS["water"])
  for kind, offset in [("park", 0.01), ("road", 0.09), ("path", 0.12), ("rail", 0.15)]:
    mesh.surface(visible[kind], 3 + offset, exporter.COLORS[kind])
  nav = []
  for r in records:
    g = polygonal(r["geometry"].intersection(tile))
    if native:
      g = polygonal(exporter.native_polygon(g).intersection(ground))
      g = polygonal(orthogonal_inside(g))
    if g.is_empty:
      continue
    low, high = 3 + r["minHeight"], 3 + max(r["height"], r["minHeight"] + 0.1)
    if native:
      high = 3 + max(2, round((high - 3) / 2) * 2)
      mesh.building(g, low, high)
    else:
      part, base = sheets[r["partId"]]
      for surface in part["surfaces"]:
        color = exporter.COLORS[
          "roof" if surface["kind"] == "RoofSurface" else "building"
        ]
        for triangle in triangles_for(surface["rings"]):
          original = [[p[0], p[1] - base + 3, p[2]] for p in triangle]
          a, b, c = np.array(original)
          normal = np.cross(b - a, c - a)
          if abs(normal[1]) > 1e-7:
            xy = Polygon([(p[0], p[2]) for p in original]).intersection(g)
            for fragment in exporter.polygons_from_geometry(xy):
              for t in shapely.constrained_delaunay_triangles(fragment).geoms:
                pts = [
                  [
                    x,
                    a[1]
                    - (normal[0] * (x - a[0]) + normal[2] * (z - a[2])) / normal[1],
                    z,
                  ]
                  for x, z in list(t.exterior.coords)[:3]
                ]
                if (
                  np.dot(
                    np.cross(np.subtract(pts[1], pts[0]), np.subtract(pts[2], pts[0])),
                    normal,
                  )
                  < 0
                ):
                  pts.reverse()
                mesh.triangle(pts, color)
          else:
            # Vertical walls have zero XZ area. Clip by each exact covered
            # horizontal interval instead of accepting a centroid and dropping
            # a triangle which happens to straddle a previous scope boundary.
            aa, bb = max(
              ((p, q) for p in original for q in original),
              key=lambda pq: math.hypot(pq[1][0] - pq[0][0], pq[1][2] - pq[0][2]),
            )
            length = math.hypot(bb[0] - aa[0], bb[2] - aa[2])
            if length < 1e-8:
              continue
            dx, dz = (bb[0] - aa[0]) / length, (bb[2] - aa[2]) / length

            def u(p: Any) -> float:
              return (p[0] - aa[0]) * dx + (p[2] - aa[2]) * dz

            course = LineString([(aa[0], aa[2]), (bb[0], bb[2])])
            for segment in exporter.line_parts(course.intersection(g.buffer(1e-8))):
              values = [(x - aa[0]) * dx + (z - aa[2]) * dz for x, z in segment.coords]
              polygon = original
              for threshold, sign in [(min(values), 1), (max(values), -1)]:
                out = []
                for p, q in zip(polygon, polygon[1:] + polygon[:1]):
                  dp, dq = sign * (u(p) - threshold), sign * (u(q) - threshold)
                  if dp >= -1e-8:
                    out.append(p)
                  if (dp >= 0) != (dq >= 0):
                    t = dp / (dp - dq)
                    out.append([p[j] + (q[j] - p[j]) * t for j in range(3)])
                polygon = out
                if len(polygon) < 3:
                  break
              for j in range(1, len(polygon) - 1):
                mesh.triangle([polygon[0], polygon[j], polygon[j + 1]], color)
    nav.extend(
      {
        **p,
        "height": round(high - 3, 3),
        "minHeight": round(low - 3, 3),
        "sourceId": r["sourceId"],
        "partId": r["partId"],
        "heightSource": r["heightSource"],
      }
      for p in exporter.navigation_polygons(g, minx, minz)
    )
  return dict(
    schemaVersion=1,
    id=chunk_id,
    origin=[minx, exporter.POSITION_ORIGIN_Y, minz],
    meshes=[mesh.payload("stralau-v299-source-city")],
    nav=dict(
      ground=exporter.navigation_polygons(ground, minx, minz),
      buildings=nav,
      water=exporter.navigation_polygons(display["water"], minx, minz),
      roads=exporter.navigation_polygons(
        unary_union([display["road"], display["path"]]), minx, minz
      ),
      bridges=exporter.navigation_polygons(display["bridge"], minx, minz),
      groundY=3,
    ),
  )


def build() -> dict[str, Any]:
  RAW.mkdir(exist_ok=True)
  published_manifest = (
    ROOT / "src/app/public/mesh/surrounding-berlin-v159/manifest.json"
  )
  # An integrated release already contains this supplement. The external frozen
  # pre-v299 manifest is the only valid base for rebuilding its exact complement.
  manifest_path = RAW / "baseline-manifest.json"
  if not manifest_path.exists():
    manifest_path.write_bytes(published_manifest.read_bytes())
  previous = json.loads(manifest_path.read_bytes())
  previous_scope = unary_union(
    [shapely.make_valid(Polygon(p["ring"], p["holes"])) for p in previous["footprint"]]
  )
  # The core is a separate source family and must also be excluded exactly.
  core = world(exporter.load_projected_polygon(GEO / "bounds.geojson"))
  previous_scope = previous_scope.union(core)
  candidate = GEO / "raw/outer-v159/candidate.gpkg"
  areas = pyogrio.read_dataframe(
    candidate, layer="multipolygons", bbox=(13.447, 52.487, 13.494, 52.504)
  ).to_crs(25833)
  lines = pyogrio.read_dataframe(
    candidate, layer="lines", bbox=(13.447, 52.487, 13.494, 52.504)
  ).to_crs(25833)
  water = world(
    unary_union([r.geometry for _, r in areas.iterrows() if r.natural == "water"])
  )
  # Actual mapped shores determine the complete peninsula; the narrow western
  # line is the named land-neck limit, not an invented rectangular district.
  neck = Polygon(
    [[6400, 2390], [6660, 2390], [7150, 2690], [7540, 3010], [7540, 3450], [6400, 3450]]
  )
  pieces = neck.difference(water)
  peninsula = next(
    p for p in getattr(pieces, "geoms", [pieces]) if p.covers(Point(7242, 3242))
  )
  club, _ = osm_xml(RAW / "sisyphos-osm.xml")
  club_site = next(f["geometry"] for f in club if f["id"] == "148829988")
  marina, _ = osm_xml(RAW / "marina-osm.xml")
  # Mapped piers, operator-confirmed apartment boats and the intervening source
  # water receive their own finite public-water presentation, no Rummelsburg fill.
  marina_piers = [
    f
    for f in marina
    if f["tags"].get("man_made") == "pier"
    and f["geometry"].intersects(box(7680, 3110, 8040, 3440))
  ]
  waterscope = water.intersection(
    unary_union(
      [peninsula.buffer(32), *[p["geometry"].buffer(23) for p in marina_piers]]
    )
  )
  requested = unary_union([peninsula, waterscope, club_site])
  new_scope = requested.difference(previous_scope)
  feature_ids = [
    "141612818",
    "189065406",
    "32702267",
    "141639586",
    "86813081",
    "24263635",
    "24263642",
    "35140190",
    "693577450",
    "44144787",
    "220198652",
    "1312237093",
  ]
  named_scope = unary_union(
    [world(r.geometry) for _, r in areas.iterrows() if str(r.osm_way_id) in feature_ids]
  )
  official = read_official(requested.union(named_scope))
  source = dict(
    schemaVersion=1,
    step=10,
    date="2026-11-02",
    parents=official,
    osmSnapshotSha256=sha(candidate),
    clubOsmSha256=sha(RAW / "sisyphos-osm.xml"),
    marinaOsmSha256=sha(RAW / "marina-osm.xml"),
    archives=[
      dict(
        name=n,
        sha256=sha(GEO / "raw/lod2" / n),
        url="https://gdi.berlin.de/data/a_lod2/atom/" + n,
      )
      for n in sorted({b["archive"] for b in official})
    ],
    retainedManifestSha256=sha(manifest_path),
    retainedFootprintCount=len(previous["footprint"]),
    retainedCoreBoundsSha256=sha(GEO / "bounds.geojson"),
    scope=mapping(requested),
    newOnlyScope=mapping(new_scope),
    peninsula=mapping(peninsula),
    clubSite=mapping(club_site),
    mappedWater=mapping(waterscope),
    estimatePolicy="Source XZ and complete sheets remain unchanged. A rigid local source-ground alignment to the existing outer-city y=3 display terrain, small facade sections and boat shapes are estimates. No 24/7 opening or private individual berth occupancy is claimed.",
  )
  write(GEO / "stralau-sisyphos-v299-source.json.gz", source)

  # Original bounds stay unchanged. This separate new-only footprint is all that
  # may be appended by the root-owned publication transaction.
  def crs84(g: Any) -> Any:
    return transform(UNPROJECT, affine_transform(g, [1, 0, 0, -1, 389500, 5820000]))

  write(
    GEO / "bounds-stralau-v299.geojson",
    dict(
      type="FeatureCollection",
      features=[
        dict(
          type="Feature",
          properties=dict(
            revision="v299",
            scope="Stralau mapped peninsula, finite berth water and exact Sisyphos site",
            newAreaM2=round(new_scope.area, 3),
          ),
          geometry=mapping(crs84(new_scope)),
        )
      ],
    ),
  )

  # All source-defined part rings and court holes are retained. Parts crossing
  # earlier coverage are clipped geometrically; old packets remain byte-identical.
  records, sheets = [], {}
  for parent in official:
    base = min(p["ground_y_m"] for p in parent["parts"])
    for p in parent["parts"]:
      g = Polygon(p["ring"], p["holes"])
      if not g.is_valid:
        g = shapely.make_valid(g)
      bounded = exporter.polygonal(g.intersection(new_scope))
      if bounded.area < 0.01:
        continue
      rec = dict(
        sourceId=parent["id"],
        partId=p["id"],
        geometry=bounded,
        minHeight=p["ground_y_m"] - base,
        height=p["top_y_m"] - base,
        heightSource="Berlin LoD2 complete measured leaf parts; rigid outer y=3 datum",
      )
      records.append(rec)
      sheets[p["id"]] = (p, base)
  official_epsg = [
    {**r, "geometry": affine_transform(r["geometry"], [1, 0, 0, -1, 389500, 5820000])}
    for r in records
  ]
  epsg_scope = affine_transform(new_scope, [1, 0, 0, -1, 389500, 5820000])
  _, surfaces, inventory = exporter.collect_sources(
    lines, areas, epsg_scope, official_epsg
  )
  surfaces = {k: world(unary_union(v)) for k, v in surfaces.items()}
  # The live API extracts supply the exact separate Club and Citymarina paths.
  surfaces["water"] = water.intersection(new_scope)
  b_union = unary_union([r["geometry"] for r in records if r["minHeight"] < 0.25])
  for kind in ["road", "path", "rail"]:
    surfaces[kind] = (
      surfaces.get(kind, Polygon()).difference(b_union).difference(surfaces["water"])
    )
  surfaces["park"] = surfaces.get("park", Polygon()).difference(surfaces["water"])
  prepared = RAW / "packets"
  prepared.mkdir(exist_ok=True)
  result = dict(
    schemaVersion=1,
    version="v299",
    chunkSize=512,
    bounds=list(new_scope.bounds),
    boundary=exporter.navigation_polygons(requested, 0, 0),
    footprint=exporter.navigation_polygons(new_scope, 0, 0),
    groundY=3,
    waterY=exporter.WATER_Y,
    chunks=[],
    source=dict(
      addedAreaM2=round(new_scope.area, 3),
      sourceEvidence="stralau-sisyphos-v299-source.json.gz",
      sourceEvidenceSha256=sha(GEO / "stralau-sisyphos-v299-source.json.gz"),
      preservedManifestSha256=sha(manifest_path),
      buildingCount=len(records),
      policy=source["estimatePolicy"],
    ),
  )
  minx, minz, maxx, maxz = new_scope.bounds
  for tx in range(math.floor(minx / 512), math.floor(maxx / 512) + 1):
    for tz in range(math.floor(minz / 512), math.floor(maxz / 512) + 1):
      tile = box(tx * 512, tz * 512, (tx + 1) * 512, (tz + 1) * 512)
      ground = exporter.polygonal(new_scope.intersection(tile))
      if ground.area < 0.01:
        continue
      selected = [r for r in records if r["geometry"].intersects(tile)]
      entry = dict(
        id=f"{PREFIX}{tx}_{tz}", bounds=list(tile.bounds), buildingCount=len(selected)
      )
      local_surfaces = {
        k: exporter.polygonal(g.intersection(tile)) for k, g in surfaces.items()
      }
      local_surfaces = {
        k: g if not g.is_empty else Polygon() for k, g in local_surfaces.items()
      }
      for mode in ["drawn", "minecraft"]:
        # Both modes retain each complete measured part footprint and height;
        # native follows the established independent two-metre outer-city grid.
        payload = additive_chunk(
          entry["id"],
          tile,
          ground,
          selected,
          local_surfaces,
          sheets,
          mode == "minecraft",
        )
        raw = (
          json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
        ).encode()
        packed = gzip.compress(raw, compresslevel=9, mtime=0)
        name = entry["id"] + "." + mode + ".json.gz"
        (prepared / name).write_bytes(packed)
        entry[mode] = dict(
          url=name,
          bytes=len(packed),
          decodedBytes=len(raw),
          encoding="gzip",
          sha256=hashlib.sha256(packed).hexdigest(),
        )
      result["chunks"].append(entry)
  # Evidence inventory is source-relative, small and independent of raw downloads.
  inventory["officialParentIds"] = [p["id"] for p in official]
  inventory["sourcePolicy"] = source["estimatePolicy"]
  inv_path = prepared / (PREFIX + "source-inventory.json.gz")
  write(inv_path, inventory)
  result["source"]["inventory"] = dict(
    url=inv_path.name, bytes=inv_path.stat().st_size, sha256=sha(inv_path)
  )
  write(GEO / "stralau-sisyphos-v299-manifest.json", result)
  write(RAW / "scope.json", dict(groundY=3, footprint=result["footprint"]))
  # Small named-owner plans are construction data, not a second full-city copy.
  features = []
  for osm in feature_ids:
    r = next((r for _, r in areas.iterrows() if str(r.osm_way_id) == osm), None)
    if r is None:
      continue
    g = world(r.geometry)
    owners = [
      b
      for b in official
      if unary_union([Polygon(p["ring"], p["holes"]) for p in b["parts"]])
      .intersection(g)
      .area
      > g.area * 0.35
    ]
    parts = [p for b in owners for p in b["parts"]]
    source_base = min((p["ground_y_m"] for p in parts), default=3)
    walls = []
    for owner in owners:
      for p in owner["parts"]:
        footprint = Polygon(p["ring"], p["holes"])
        for surface in p["surfaces"]:
          if surface["kind"] != "WallSurface":
            continue
          ring = surface["rings"][0]
          a, b = max(
            ((a, b) for a in ring for b in ring),
            key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
          )
          length = math.hypot(b[0] - a[0], b[2] - a[2])
          if length < 6:
            continue
          dx, dz = (b[0] - a[0]) / length, (b[2] - a[2]) / length
          probe = Point((a[0] + b[0]) / 2 - dz * 0.05, (a[2] + b[2]) / 2 + dx * 0.05)
          sign = -1 if footprint.covers(probe) else 1
          walls.append(
            dict(
              a=[a[0], a[2]],
              b=[b[0], b[2]],
              sign=sign,
              sourceId=owner["id"],
              partId=p["id"],
              profile=[
                [(q[0] - a[0]) * dx + (q[2] - a[2]) * dz, q[1] - source_base + 3]
                for q in ring
              ],
            )
          )
    features.append(
      dict(
        osmId=osm,
        name=r["name"] if isinstance(r["name"], str) else "",
        ring=list(g.geoms[0].exterior.coords)[:-1],
        owners=[b["id"] for b in owners],
        sourceBase=min((p["ground_y_m"] for p in parts), default=3),
        top=max((p["top_y_m"] - source_base + 3 for p in parts), default=18),
        walls=walls,
      )
    )
  write(
    APP / "stralauSisyphosV299.json",
    dict(
      schemaVersion=1,
      features=features,
      clubRing=list(club_site.exterior.coords)[:-1],
      clubParts=[
        dict(
          id=p["id"],
          ring=p["ring"],
          low=p["ground_y_m"] - min(q["ground_y_m"] for q in b["parts"]) + 3,
          top=p["top_y_m"] - min(q["ground_y_m"] for q in b["parts"]) + 3,
        )
        for b in official
        if b["archive"].startswith("LoD2_397")
        for p in b["parts"]
        if Polygon(p["ring"]).intersection(club_site).area > 1
      ],
      piers=[dict(id=p["id"], points=list(p["geometry"].coords)) for p in marina_piers],
      waterY=exporter.WATER_Y,
      estimatePolicy=source["estimatePolicy"],
    ),
  )
  print(
    json.dumps(
      dict(
        chunks=len(result["chunks"]),
        parents=len(official),
        parts=len(records),
        newAreaM2=new_scope.area,
        packetBytes=sum(
          c[m]["bytes"] for c in result["chunks"] for m in ["drawn", "minecraft"]
        ),
        inventoryBytes=inv_path.stat().st_size,
        runtimeBytes=(APP / "stralauSisyphosV299.json").stat().st_size,
        evidenceBytes=(GEO / "stralau-sisyphos-v299-source.json.gz").stat().st_size,
      )
    )
  )
  return result


def bake_details() -> dict[str, Any]:
  """Bake the independently authored families into only admitted spatial packets.

  Existing packets receive an append-only mesh after exact measured-source
  identity admission. Their original encoded geometry, lines and navigation
  remain byte-identical fields; no removal/owner replacement is needed.
  """
  prepared = RAW / "packets"
  supplement_path = GEO / "stralau-sisyphos-v299-manifest.json"
  supplement = json.loads(supplement_path.read_bytes())
  runtime = json.loads((APP / "stralauSisyphosV299.json").read_bytes())
  published = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
  previous = json.loads((published / "manifest.json").read_bytes())
  owners = {"owner-" + f["osmId"]: set(f["owners"]) for f in runtime["features"]}
  rows = {
    m: json.loads(
      (
        RAW / ("native-rows.json" if m == "minecraft" else "drawn-rows.json")
      ).read_bytes()
    )
    for m in ["drawn", "minecraft"]
  }
  old_updates = []
  all_sources = [dict(entry=e, original=False) for e in supplement["chunks"]]
  for e in previous["chunks"]:
    if box(*e["bounds"]).intersects(box(5190, 1990, 6580, 2630)):
      all_sources.append(dict(entry=e, original=True))
  proof = []
  for item in all_sources:
    original = item["original"]
    entry = item["entry"]
    tile = box(*entry["bounds"])
    updated = json.loads(json.dumps(entry))
    changed = False
    for mode in ["drawn", "minecraft"]:
      asset = entry[mode]
      path = (published if original else prepared) / asset["url"]
      if sha(path) != asset["sha256"]:
        raise ValueError("Stale Stralau source packet: " + str(path))
      payload = json.loads(gzip.decompress(path.read_bytes()))
      retained_fields = json.dumps(payload, sort_keys=True, separators=(",", ":"))
      source_owners = {b["sourceId"] for b in payload["nav"]["buildings"]}
      picked = []
      for row in rows[mode]:
        x, y, z = row["p"]
        radius = math.hypot(row["s"][0], row["s"][2]) / 2
        if not tile.intersects(Point(x, z).buffer(radius + 0.001)):
          continue
        admitted = bool(owners.get(row["site"], set()) & source_owners)
        if original and not admitted:
          continue
        if not original and row["site"].startswith("owner-") and not admitted:
          continue
        picked.append(row)
      if not picked:
        continue
      changed = True
      minx, minz, _, _ = tile.bounds
      detail = exporter.PackedMesh(minx, minz)
      groups = {}
      physical = {}
      floors = {}
      for r in picked:
        x, y, z = r["p"]
        sx, sy, sz = r["s"]
        yaw = r["yaw"]
        c, s = math.cos(yaw), math.sin(yaw)
        polygon = affine_transform(
          box(-sx / 2, -sz / 2, sx / 2, sz / 2), [c, s, -s, c, x, z]
        )
        polygon = polygon.intersection(tile)
        if polygon.area < 1e-10:
          continue
        key = (round(y - sy / 2, 8), round(y + sy / 2, 8), r["tone"])
        groups.setdefault(key, []).append(polygon)
        role = r["role"]
        if any(
          k in role
          for k in [
            "-floating-hull",
            "-cabin",
            "-flat-roof",
            "-deck-rail-post",
            "-deck-handrail",
            "paired-iron-gate",
            "red-cream-frontage",
            "dark-brick-gate-pier",
            "mapped-citymarina-pier",
            "marina-berth-post",
          ]
        ):
          physical.setdefault(key[:2], []).append(polygon)
        if role.endswith("-timber-deck") or role == "mapped-citymarina-pier":
          floors.setdefault(round(y + sy / 2, 8), []).append(polygon)
      # Union equal-height/equal-colour authored boxes only. This removes
      # invisible internal faces while preserving their exact occupied volume,
      # exterior silhouette, colour and every independent native step.
      for (low, high, tone), polygons in groups.items():
        g = unary_union(polygons)
        color = ((tone >> 16) & 255, (tone >> 8) & 255, tone & 255)
        detail.surface(g, high, color)
        detail.surface(g, low, color)
        for line in exporter.line_parts(
          shapely.orient_polygons(g, exterior_cw=True).boundary
        ):
          for (ax, az), (bx, bz) in zip(line.coords, list(line.coords)[1:]):
            a, b, c, d = (ax, low, az), (bx, low, bz), (bx, high, bz), (ax, high, az)
            detail.triangle([a, b, c], color)
            detail.triangle([a, c, d], color)
      extra = detail.payload("stralau-v299-exterior-details")
      if extra:
        payload["meshes"].append(extra)
      if physical or floors:
        bridges = payload["nav"].setdefault(
          "spreeBridgesV242", dict(floors=[], solids=[])
        )
        for y, polygons in floors.items():
          bridges["floors"].extend(
            {**p, "y": y}
            for p in exporter.navigation_polygons(unary_union(polygons), minx, minz)
          )
        for (low, high), polygons in physical.items():
          bridges["solids"].extend(
            {**p, "low": low, "high": high}
            for p in exporter.navigation_polygons(unary_union(polygons), minx, minz)
          )
      raw = (
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
      ).encode()
      packed = gzip.compress(raw, compresslevel=9, mtime=0)
      out = (RAW / "existing-updates" if original else prepared) / asset["url"]
      out.parent.mkdir(exist_ok=True)
      out.write_bytes(packed)
      updated[mode] = {
        **asset,
        "bytes": len(packed),
        "decodedBytes": len(raw),
        "sha256": sha(out),
      }
      proof.append(
        dict(
          id=entry["id"],
          mode=mode,
          existing=original,
          previousSha256=asset["sha256"],
          nextSha256=sha(out),
          addedRows=len(picked),
          sourceOwnerCount=len(source_owners),
          retainedOriginalFieldsSha256=hashlib.sha256(
            retained_fields.encode()
          ).hexdigest(),
          detailVertices=len(detail.vertices),
          detailIndices=len(detail.indices),
        )
      )
    if changed:
      if original:
        old_updates.append(updated)
      else:
        supplement["chunks"][supplement["chunks"].index(entry)] = updated
  write(supplement_path, supplement)
  delta = dict(
    schemaVersion=1,
    previousManifestSha256=sha(published / "manifest.json"),
    existingUpdates=old_updates,
    newSupplement=supplement,
    sourceScope=dict(groundY=3, footprint=supplement["footprint"]),
    proof=proof,
  )
  write(GEO / "stralau-sisyphos-v299-integration.json", delta)
  total = (
    sum(e[m]["bytes"] for e in supplement["chunks"] for m in ["drawn", "minecraft"])
    + supplement["source"]["inventory"]["bytes"]
  )
  old_by_id = {e["id"]: e for e in previous["chunks"]}
  delta_bytes = sum(
    e[m]["bytes"] - old_by_id[e["id"]][m]["bytes"]
    for e in old_updates
    for m in ["drawn", "minecraft"]
  )
  print(
    json.dumps(
      dict(
        newPacketBytes=total,
        existingDeltaBytes=delta_bytes,
        netRuntimePacketBytes=total + delta_bytes,
        newPairs=len(supplement["chunks"]),
        updatedExistingPairs=len(old_updates),
      )
    )
  )
  return delta


def prepare_recipes() -> dict[str, Any]:
  """Lossless bounded construction recipes; retain all complete static rows.

  Ordinary boxes stay compact exact numeric recipes. Only boxes crossing a tile
  edge become offline-clipped triangle meshes. Runtime copies prepared recipes
  to fixed typed arrays with cooperative yields; it does no voxelization or
  triangulation. Published packet files are never modified by this function.
  """

  def fnv(text: str) -> int:
    value = 2166136261
    for b in text.encode("ascii"):
      value = ((value ^ b) * 16777619) & 0xFFFFFFFF
    return value

  prepared = RAW / "packets"
  published = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
  supplement = json.loads((GEO / "stralau-sisyphos-v299-manifest.json").read_bytes())
  baseline = RAW / "baseline-manifest.json"
  previous = json.loads(
    (baseline if baseline.exists() else published / "manifest.json").read_bytes()
  )
  runtime = json.loads((APP / "stralauSisyphosV299.json").read_bytes())
  owners = {"owner-" + f["osmId"]: set(f["owners"]) for f in runtime["features"]}
  row_sets = {
    mode: json.loads(
      (
        RAW / ("native-rows.json" if mode == "minecraft" else "drawn-rows.json")
      ).read_bytes()
    )
    for mode in ["drawn", "minecraft"]
  }
  packets = {}
  proof = []
  candidates = [(e, False) for e in supplement["chunks"]] + [
    (e, True)
    for e in previous["chunks"]
    if box(*e["bounds"]).intersects(box(5190, 1990, 6580, 2630))
  ]
  for entry, existing in candidates:
    tile = box(*entry["bounds"])
    ox, oz, _, _ = tile.bounds
    for mode in ["drawn", "minecraft"]:
      asset = entry[mode]
      path = (published if existing else prepared) / asset["url"]
      if sha(path) != asset["sha256"]:
        raise ValueError("Changed preparation source " + str(path))
      chunk = json.loads(gzip.decompress(path.read_bytes()))
      source_owners = {b["sourceId"] for b in chunk["nav"]["buildings"]}
      boxes = []
      edge_groups = {}
      floor_groups = {}
      solid_groups = {}
      roles = {}
      rows_kept = 0
      corner_proof = hashlib.sha256()

      def corners(row: list[float]) -> list[int]:
        x, y, z, dx, dz, nx, nz, w, h, depth, _ = row
        return [
          math.floor(v * 100 + 0.5)
          for a in [-1, 1]
          for b in [-1, 1]
          for c in [-1, 1]
          for v in [
            x + dx * a * w / 2 + nx * c * depth / 2,
            y + b * h / 2,
            z + dz * a * w / 2 + nz * c * depth / 2,
          ]
        ]

      def compact(row: list[float]) -> list[float]:
        expected = corners(row)
        for precision in range(3, 13):
          candidate = [
            round(v, precision) if i in [0, 1, 2, 7, 8, 9] else v
            for i, v in enumerate(row)
          ]
          if corners(candidate) == expected:
            corner_proof.update(np.asarray(expected, dtype="<u2").tobytes())
            return candidate
        corner_proof.update(np.asarray(expected, dtype="<u2").tobytes())
        return row

      for r in row_sets[mode]:
        x, y, z = r["p"]
        sx, sy, sz = r["s"]
        yaw = r["yaw"]
        c, s = math.cos(yaw), math.sin(yaw)
        polygon = affine_transform(
          box(-sx / 2, -sz / 2, sx / 2, sz / 2), [c, s, -s, c, x, z]
        )
        if not polygon.intersects(tile):
          continue
        admitted = bool(owners.get(r["site"], set()) & source_owners)
        if (existing or r["site"].startswith("owner-")) and not admitted:
          continue
        clipped = exporter.polygonal(polygon.intersection(tile))
        if clipped.area < 1e-10:
          continue
        rows_kept += 1
        roles[r["role"]] = roles.get(r["role"], 0) + 1
        low, high = y - sy / 2, y + sy / 2
        if tile.covers(polygon):
          boxes.append(
            compact(
              [
                x - ox,
                y - exporter.POSITION_ORIGIN_Y,
                z - oz,
                c,
                -s,
                s,
                c,
                sx,
                sy,
                sz,
                r["tone"],
              ]
            )
          )
        else:
          edge_groups.setdefault((low, high, r["tone"]), []).append(clipped)
        role = r["role"]
        if any(
          k in role
          for k in [
            "-floating-hull",
            "-cabin",
            "-flat-roof",
            "-deck-rail-post",
            "-deck-handrail",
            "paired-iron-gate",
            "red-cream-frontage",
            "dark-brick-gate-pier",
            "mapped-citymarina-pier",
            "marina-berth-post",
          ]
        ):
          solid_groups.setdefault((round(low, 8), round(high, 8)), []).append(clipped)
        if role.endswith("-timber-deck") or role == "mapped-citymarina-pier":
          floor_groups.setdefault(round(high, 8), []).append(clipped)
      if not rows_kept:
        continue
      edge = exporter.PackedMesh(ox, oz)
      for (low, high, tone), polys in edge_groups.items():
        g = unary_union(polys)
        color = ((tone >> 16) & 255, (tone >> 8) & 255, tone & 255)
        edge.surface(g, low, color)
        edge.surface(g, high, color)
        for line in exporter.line_parts(
          shapely.orient_polygons(g, exterior_cw=True).boundary
        ):
          for (ax, az), (bx, bz) in zip(line.coords, list(line.coords)[1:]):
            a, b, c, d = (ax, low, az), (bx, low, bz), (bx, high, bz), (ax, high, az)
            edge.triangle([a, b, c], color)
            edge.triangle([a, c, d], color)
      floors = [
        {**p, "y": height}
        for height, polys in floor_groups.items()
        for p in exporter.navigation_polygons(unary_union(polys), ox, oz)
      ]
      solids = [
        {**p, "low": low, "high": high}
        for (low, high), polys in solid_groups.items()
        for p in exporter.navigation_polygons(unary_union(polys), ox, oz)
      ]
      mesh_records = [
        dict(
          mesh=i,
          kind=m["kind"],
          fingerprint=fnv(m["positions"] + m["colors"] + m["indices"]),
        )
        for i, m in enumerate(chunk["meshes"])
      ]
      lines = chunk.get("lines")
      line_guard = (
        fnv((lines.get("positions", "") + lines.get("colors", ""))) if lines else None
      )
      key = mode + ":" + entry["id"]
      packets[key] = dict(
        origin=chunk["origin"],
        guard=0,
        _originalNav=chunk["nav"],
        records=mesh_records,
        lineGuard=line_guard,
        boxes=boxes,
        edgeMesh=edge.payload("stralau-v299-edge-complement"),
        floors=floors,
        solids=solids,
      )
      proof.append(
        dict(
          key=key,
          existing=existing,
          sourceAssetSha256=asset["sha256"],
          rows=rows_kept,
          boxes=len(boxes),
          exactCmCornersSha256=corner_proof.hexdigest(),
          edgeVertices=len(edge.vertices),
          floors=len(floors),
          solids=len(solids),
          roles=roles,
        )
      )
  result = dict(schemaVersion=1, keys=sorted(packets), packets=packets)
  write(APP / "stralauSisyphosV299Packets.json", result)
  delta = dict(
    schemaVersion=1,
    previousManifestSha256=sha(
      baseline if baseline.exists() else published / "manifest.json"
    ),
    newSupplement=supplement,
    sourceScope=dict(groundY=3, footprint=supplement["footprint"]),
    recipeModule="StralauSisyphosV299Packets.ts",
    recipeField="packets",
    proof=proof,
  )
  write(GEO / "stralau-sisyphos-v299-integration.json", delta)
  print(
    json.dumps(
      dict(
        plans=len(packets),
        recipeJsonBytes=(APP / "stralauSisyphosV299Packets.json").stat().st_size,
        recipeGzipBytes=len(
          gzip.compress(
            (APP / "stralauSisyphosV299Packets.json").read_bytes(),
            compresslevel=9,
            mtime=0,
          )
        ),
        packetBytes=sum(
          e[m]["bytes"] for e in supplement["chunks"] for m in ["drawn", "minecraft"]
        ),
      )
    )
  )
  return delta


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--bake-details", action="store_true")
  parser.add_argument("--prepare-recipes", action="store_true")
  args = parser.parse_args()
  if args.prepare_recipes:
    prepare_recipes()
  elif args.bake_details:
    bake_details()
  else:
    build()
