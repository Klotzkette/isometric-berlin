"""Step 10: finite botanical park and additive Spandau source details.

The park is the exact OSM site; no surrounding district is generated. Original
Spandau meshes remain intact. Untagged fittings and the flat park datum are
explicit display estimates. Full source rows remain separate from runtime data.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import geopandas as gpd
import numpy as np
from pyproj import Transformer
from shapely import constrained_delaunay_triangles
from shapely.geometry import LineString, Point, Polygon, mapping, shape
from shapely.ops import transform, unary_union

from isometric_berlin.data.fetch_lod2 import NS, building_footprint, leaf_building_parts
from scripts.build_bebelplatz_building_source import part_profile

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
SOURCE = GEO / "spandau-botanical-v230-source.json"
PBF = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
TILES = [GEO / f"raw/lod2/LoD2_{x}_5829.zip" for x in [390, 391]]
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True).transform
UNPROJECT = Transformer.from_crs(25833, 4326, always_xy=True).transform


def write(path: Path, value: object) -> None:
  path.write_text(json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n")


def digest(path: Path) -> str:
  return hashlib.file_digest(path.open("rb"), "sha256").hexdigest()


def world(g):
  return transform(
    lambda x, y, z=None: (x - 389500, 5820000 - y), transform(PROJECT, g)
  )


def rings(g) -> list:
  return [
    [list(p) for p in g.exterior.coords],
    *[[list(p) for p in r.coords] for r in g.interiors],
  ]


def extract() -> dict:
  """Read exact bounded OSM and official building sheets, no photo assets."""
  features = []
  for layer in ["multipolygons", "lines", "points"]:
    df = gpd.read_file(
      PBF, layer=layer, bbox=(13.387, 52.602, 13.402, 52.609), engine="pyogrio"
    )
    for _, r in df.iterrows():
      t = dict(re.findall(r'"([^\"]+)"=>"([^\"]*)"', str(r.get("other_tags", ""))))
      t.update(
        {
          k: str(v)
          for k, v in r.items()
          if k not in ["geometry", "other_tags"]
          and v is not None
          and not (isinstance(v, float) and math.isnan(v))
        }
      )
      oid = (
        "node/"
        if layer == "points"
        else "way/"
        if t.get("osm_way_id") or layer == "lines"
        else "relation/"
      ) + (t.get("osm_way_id") or t.get("osm_id"))
      features.append(
        dict(id=oid, tags=t, geometry=mapping(world(r.geometry)), layer=layer)
      )
  park = shape(next(f["geometry"] for f in features if f["id"] == "way/26633037"))
  selected = []
  for f in features:
    g = shape(f["geometry"])
    t = f["tags"]
    if f["id"] == "way/26633037" or (
      g.intersects(park)
      and not t.get("admin_level")
      and g.area < park.area * 1.2
      and any(
        t.get(k)
        for k in [
          "natural",
          "landuse",
          "leisure",
          "building",
          "highway",
          "barrier",
          "amenity",
        ]
      )
    ):
      selected.append(f)
  # Complete official parents whose ground is mostly inside the named park.
  parents = []
  for tile in TILES:
    with zipfile.ZipFile(tile) as archive:
      for member in archive.namelist():
        if not member.endswith((".gml", ".xml")):
          continue
        with archive.open(member) as stream:
          for _, p in ET.iterparse(stream, events=("end",)):
            if p.tag != f"{{{NS['bldg']}}}Building":
              continue
            fp = building_footprint(p)
            if fp is not None and fp.area:
              w = transform(lambda x, y, z=None: (x - 389500, 5820000 - y), fp)
              if (
                park.covers(w.representative_point())
                and w.intersection(park).area / w.area > 0.9
              ):
                parts = [part_profile(q) for q in (leaf_building_parts(p) or [p])]
                parents.append(
                  dict(
                    id=p.get("{http://www.opengis.net/gml}id"),
                    parts=parts,
                    offsetY=3.2 - min(q["ground_y_m"] for q in parts),
                  )
                )
            p.clear()
  # Full retained citadel evidence; only bounded ornaments are emitted.
  west = json.loads((GEO / "west-landmarks-v187-source.json").read_text())
  citadel = [p for p in west["profiles"] if p["name"] in ["Juliusturm", "Palas"]]
  # Exact ordinary owner envelopes adjoining the two Altstadt walking streets.
  streets = []
  street_rows = gpd.read_file(
    PBF, layer="lines", bbox=(13.20, 52.532, 13.217, 52.542), engine="pyogrio"
  )
  for _, f in street_rows.iterrows():
    if f.get("name") in [
      "Breite Straße",
      "Carl-Schurz-Straße",
      "Markt",
      "Reformationsplatz",
    ]:
      streets.append(world(f.geometry))
  street = unary_union(streets)
  buildings = gpd.read_file(
    GEO / "raw/outskirts-v187/resolved-outlines.gpkg",
    layer="buildings",
    bbox=(-11800, -2700, -11000, -1500),
  )
  fronts = []
  for _, r in buildings.iterrows():
    g = r.geometry
    if (
      g.distance(street) > 11
      or g.area > 1000
      or not math.isfinite(r.height)
      or r.height < 5
      or r.height > 26
    ):
      continue
    parts = list(g.geoms) if g.geom_type == "MultiPolygon" else [g]
    best = []
    for p in parts:
      for a, b in zip(p.exterior.coords, list(p.exterior.coords)[1:]):
        line = LineString([a, b])
        length = line.length
        if 5 < length < 38 and line.distance(street) < 9:
          mid = line.interpolate(0.5, normalized=True)
          d = np.array(b) - a
          d = d / np.linalg.norm(d)
          n = np.array([-d[1], d[0]])
          if g.contains(Point(*(np.array(mid.coords[0]) + n * 0.1))):
            n = -n
          best.append([*a, *b, *n])
    if best:
      fronts.append(dict(id=r.sourceId, height=r.height, base=3.0, edges=best[:2]))
  source = dict(
    license="OSM ODbL-1.0; Berlin LoD2 dl-de/zero-2-0",
    pbfSha256=digest(PBF),
    tiles=[
      dict(sha256=digest(t), url="https://gdi.berlin.de/data/a_lod2/atom/" + t.name)
      for t in TILES
    ],
    features=selected,
    buildings=parents,
    citadel=citadel,
    fronts=fronts[:24],
    preservedInputs={
      name: digest(DATA / name)
      for name in [
        "westLandmarksV187.json",
        "tegelSpandauV198.json",
        "tegelSpandauV198Native.json",
      ]
    },
  )
  write(SOURCE, source)
  return source


def build() -> dict:
  """Rebuild compact geometry deterministically from the retained source receipt."""
  s = json.loads(SOURCE.read_text())
  features = s["features"]
  park = shape(next(f["geometry"] for f in features if f["id"] == "way/26633037"))
  sites = {}
  ground_layers = []

  def site(key):
    if key not in sites:
      sites[key] = dict(key=key, positions=[], colors=[], boxes=[], native=[])
    return sites[key]

  def plane(key, g, y, color, step=4):
    if g.is_empty:
      return
    o = site(key)
    if key.startswith("Botanical park:") and "ponds" not in key:
      ground_layers.extend(
        dict(rings=rings(p), y=y)
        for p in (g.geoms if g.geom_type == "MultiPolygon" else [g])
        if p.geom_type == "Polygon"
      )
    for p in list(g.geoms) if g.geom_type == "MultiPolygon" else [g]:
      if p.geom_type != "Polygon":
        continue
      for tri in constrained_delaunay_triangles(p).geoms:
        for x, z in list(tri.exterior.coords)[:3]:
          o["positions"].extend([round(x, 3), y, round(z, 3)])
          o["colors"].append(color)
      # Greedy horizontal row runs: native floors stay independently orthogonal.
      x0, z0, x1, z1 = p.bounds
      for z in range(math.floor(z0 / step), math.ceil(z1 / step)):
        run = None
        for x in range(math.floor(x0 / step), math.ceil(x1 / step) + 1):
          inside = p.covers(Point((x + 0.5) * step, (z + 0.5) * step))
          if inside and run is None:
            run = x
          elif not inside and run is not None:
            o["native"].append(
              [
                (run + x) * step / 2,
                y - 0.06,
                (z + 0.5) * step,
                (x - run) * step,
                0.12,
                step,
                color,
              ]
            )
            run = None

  def member(key, a, b, w, color):
    a = np.array(a)
    b = np.array(b)
    length = np.linalg.norm(b - a)
    if length < 0.001:
      return
    o = site(key)
    o["boxes"].append([*map(float, a), *map(float, b), w, color])
    n = max(1, math.ceil(length / 0.8))
    d = np.abs(b - a) / n
    for i in range(n):
      p = a + (b - a) * (i + 0.5) / n
      o["native"].append([*map(float, p), *[max(w, float(v)) for v in d], color])

  # Exact park footprint. Mapped water and every building remain cut out.
  waters = [
    shape(f["geometry"]).intersection(park)
    for f in features
    if f["tags"].get("natural") == "water"
  ]
  building_areas = [shape(f["geometry"]) for f in features if f["tags"].get("building")]
  water = unary_union(waters)
  plane("Botanical park: exact source ground", park.difference(water), 3, 0x91A17B)
  paths = []
  for f in features:
    g = shape(f["geometry"])
    t = f["tags"]
    if f["layer"] == "lines" and t.get("highway") in [
      "footway",
      "path",
      "track",
      "service",
      "steps",
    ]:
      width = (
        float(t.get("width", "2.2").split()[0])
        if re.fullmatch(r"\d+(\.\d+)?", t.get("width", "2.2"))
        else 2.2
      )
      p = (
        g.buffer(width / 2, cap_style=2, join_style=2)
        .intersection(park)
        .difference(water)
      )
      paths.append(p)
      plane("Botanical park: mapped paths", p, 3.08, 0xB7AD92, 1)
    if f["layer"] == "multipolygons":
      col = (
        0x647C56
        if t.get("natural") == "wood" or t.get("landuse") == "forest"
        else 0x9AA97E
        if t.get("landuse") == "meadow"
        else 0xA8A274
        if t.get("leisure") == "garden"
        else None
      )
      if col:
        plane(
          "Botanical park: mapped garden and woodland beds",
          g.intersection(park).difference(water),
          3.035,
          col,
        )
  for p in waters:
    plane("Botanical park: source ponds", p, 2.96, 0x668E8E, 4)
  blockers = unary_union([water, *paths, *building_areas])
  trees = []
  for f in features:
    if (
      f["layer"] == "points"
      and f["tags"].get("natural") == "tree"
      and park.covers(shape(f["geometry"]))
    ):
      trees.append([*shape(f["geometry"]).coords[0], 9, "mapped"])
  woods = unary_union(
    [
      shape(f["geometry"]).intersection(park)
      for f in features
      if f["tags"].get("natural") == "wood" or f["tags"].get("landuse") == "forest"
    ]
  )
  if not woods.is_empty:
    x0, z0, x1, z1 = woods.bounds
    for x in range(math.ceil(x0 / 18), math.floor(x1 / 18)):
      for z in range(math.ceil(z0 / 18), math.floor(z1 / 18)):
        p = Point(
          x * 18 + 3 * math.sin(x * 2.3 + z), z * 18 + 3 * math.cos(z * 1.8 + x)
        )
        if (
          woods.covers(p)
          and blockers.distance(p) > 5
          and all(math.dist(p.coords[0], t[:2]) > 9 for t in trees)
        ):
          trees.append([p.x, p.y, 8 + (x * 7 + z * 3) % 5, "illustrative woodland"])
  # Trees use compact crossed crowns in drawn and separate orthogonal clusters.
  for x, z, h, _ in trees:
    key = f"Botanical trees {math.floor(x / 192)}:{math.floor(z / 192)}"
    member(key, [x, 3, z], [x, 3 + h * 0.65, z], 0.32, 0x776F52)
    for dx, dz in [(0, 0), (1.2, 0.4), (-0.7, -1.1)]:
      member(
        key,
        [x + dx - 2.3, 3 + h - 2, z + dz],
        [x + dx + 2.3, 3 + h - 2, z + dz],
        3.5,
        0x58774D + (int(h) % 3) * 0x030503,
      )
  # All measured building wall/roof sheets, shifted rigidly to the park datum.
  solids = []
  for parent in s["buildings"]:
    for p in parent["parts"]:
      key = "Botanical measured buildings"
      offset = parent["offsetY"]
      poly = Polygon(p["ring"], p["holes"])
      isglass = any(
        f["tags"].get("building") == "greenhouse"
        and shape(f["geometry"]).intersection(poly).area > poly.area * 0.5
        for f in features
      )
      solids.append(
        dict(
          id=p["id"],
          rings=[p["ring"], *p["holes"]],
          bottom=p["ground_y_m"] + offset,
          top=p["top_y_m"] + offset,
          bounds=list(poly.bounds),
          native=[],
          nativeRoof=[],
          roof=[],
        )
      )
      for surface in p["surfaces"]:
        rr = surface["rings"]
        a = np.array(rr[0][0])
        normal = None
        for v in rr[0][2:]:
          n = np.cross(np.array(rr[0][1]) - a, np.array(v) - a)
          if np.linalg.norm(n) > 0.00001:
            normal = n
            break
        if normal is None:
          continue
        axis = int(np.argmax(np.abs(normal)))
        dims = [i for i in range(3) if i != axis]
        polygon = Polygon(
          [[v[i] for i in dims] for v in rr[0]],
          [[[v[i] for i in dims] for v in r] for r in rr[1:]],
        )
        if not polygon.is_valid:
          polygon = polygon.buffer(0)
        color = (
          0x8AA4A0
          if isglass
          else 0x9A8471
          if surface["kind"] == "WallSurface"
          else 0x796B5C
        )
        o = site(key)

        def lift(q):
          v = np.zeros(3)
          v[dims] = q
          v[axis] = (np.dot(normal, a) - sum(normal[i] * v[i] for i in dims)) / normal[
            axis
          ]
          v[1] += offset
          return [round(float(n), 3) for n in v]

        for tri in constrained_delaunay_triangles(polygon).geoms:
          if surface["kind"] == "RoofSurface":
            solids[-1]["roof"].append(
              [n for q in list(tri.exterior.coords)[:3] for n in lift(q)]
            )
          for q in list(tri.exterior.coords)[:3]:
            o["positions"].extend(lift(q))
            o["colors"].append(color)
        lo0, lo1, hi0, hi1 = polygon.bounds
        for i in range(math.floor(lo0 / 1.5), math.ceil(hi0 / 1.5)):
          for j in range(math.floor(lo1 / 1.5), math.ceil(hi1 / 1.5)):
            q = ((i + 0.5) * 1.5, (j + 0.5) * 1.5)
            if polygon.covers(Point(q)):
              sz = [1.5] * 3
              sz[axis] = 0.18
              row = [*lift(q), *sz]
              o["native"].append([*row, color])
              solids[-1]["native"].append(row)
              if surface["kind"] == "RoofSurface":
                solids[-1]["nativeRoof"].append(row)
        if isglass:
          for ring in rr:
            for u, v in zip(ring, ring[1:] + ring[:1]):
              member(
                "Botanical greenhouse source framing",
                [u[0], u[1] + offset + 0.04, u[2]],
                [v[0], v[1] + offset + 0.04, v[2]],
                0.095,
                0xD5D7C4,
              )
          if surface["kind"] == "WallSurface":
            ring = rr[0]
            lo = min(v[1] for v in ring) + offset
            hi = max(v[1] for v in ring) + offset
            for i in range(1, max(1, int(math.dist(ring[0][::2], ring[1][::2]) / 1.7))):
              t = i / max(1, int(math.dist(ring[0][::2], ring[1][::2]) / 1.7))
              x = ring[0][0] * (1 - t) + ring[1][0] * t
              z = ring[0][2] * (1 - t) + ring[1][2] * t
              member(
                "Botanical greenhouse source framing",
                [x, lo, z],
                [x, hi, z],
                0.065,
                0xD5D7C4,
              )
  # Geological wall is the mapped narrow footprint; no protected display plan.
  for f in features:
    if f["id"] == "way/82889487":
      g = shape(f["geometry"])
      r = (
        list(max(g.geoms, key=lambda p: p.area).exterior.coords)
        if g.geom_type == "MultiPolygon"
        else list(g.exterior.coords)
      )
      for a, b in zip(r, r[1:]):
        member(
          "Botanical geological wall",
          [a[0], 3.9, a[1]],
          [b[0], 3.9, b[1]],
          1.7,
          0x9A8C79,
        )
  # Small cornice/shopfront cues on retained ordinary street edges only.
  for front in s["fronts"]:
    for x, z, xx, zz, nx, nz in front["edges"]:
      base = front["base"]
      top = base + front["height"]
      key = "Spandau old-town source fronts"
      for y in [base + 0.35, base + 3.2, top - 0.3]:
        member(
          key,
          [x + nx * 0.12, y, z + nz * 0.12],
          [xx + nx * 0.12, y, zz + nz * 0.12],
          0.12,
          0xD2C2AA,
        )
  # Palas roof ridges and pointed window recognition follow its real wall planes.
  for profile in s["citadel"]:
    if profile["name"] != "Palas":
      continue
    for p in profile["sourceParts"]:
      poly = Polygon(p["ring"])
      offset = profile["offsetY"]
      for surf in p["surfaces"]:
        if surf["kind"] != "WallSurface":
          continue
        r = surf["rings"][0]
        edges = [(a, b) for a in r for b in r if abs(a[1] - b[1]) < 0.02]
        a, b = max(edges, key=lambda e: math.dist(e[0], e[1]), default=(r[0], r[1]))
        length = math.dist(a, b)
        lo = min(v[1] for v in r) + offset
        hi = max(v[1] for v in r) + offset
        if length < 8 or hi - lo < 8:
          continue
        dx = (b[0] - a[0]) / length
        dz = (b[2] - a[2]) / length
        nx = -dz
        nz = dx
        if poly.contains(
          Point((a[0] + b[0]) / 2 + nx * 0.1, (a[2] + b[2]) / 2 + nz * 0.1)
        ):
          nx = -nx
          nz = -nz
        for i in range(1, max(2, int(length / 4))):
          t = i / max(2, int(length / 4))
          x = a[0] * (1 - t) + b[0] * t + nx * 0.14
          z = a[2] * (1 - t) + b[2] * t + nz * 0.14
          y = lo + 6
          for aa, bb in [
            ([-dx * 0.7, 0, -dz * 0.7], [-dx * 0.7, 2.8, -dz * 0.7]),
            ([dx * 0.7, 0, dz * 0.7], [dx * 0.7, 2.8, dz * 0.7]),
            ([-dx * 0.7, 2.8, -dz * 0.7], [0, 3.55, 0]),
            ([0, 3.55, 0], [dx * 0.7, 2.8, dz * 0.7]),
          ]:
            member(
              "Zitadelle Palas: source-wall pointed window frames",
              [x + aa[0], y + aa[1], z + aa[2]],
              [x + bb[0], y + bb[1], z + bb[2]],
              0.12,
              0xC5A07C,
            )
  # Exact previous Juliusturm source cap: no edit to the measured XY silhouette.
  tower = next(p for p in s["citadel"] if p["name"] == "Juliusturm")
  shaft = max(tower["sourceParts"], key=lambda p: p["top_y_m"])
  footprint = Polygon(shaft["ring"])
  top = round(shaft["top_y_m"] + tower["offsetY"], 3)
  cap = round(top - 1.1, 3)
  old = next(
    g
    for g in json.loads((DATA / "westLandmarksV187.json").read_text())["groups"]
    if g["name"] == "Zitadelle"
  )
  vertices = [
    p
    for surface in old["surfaces"]
    for triangle in surface["triangles"]
    for p in triangle
  ]
  ids = [
    [i, *p]
    for i, p in enumerate(vertices)
    if p[1] > cap and footprint.buffer(0.003).covers(Point(p[0], p[2]))
  ]
  oldrows = [
    [i, *r]
    for i, r in enumerate(old["native"])
    if r[1] + r[4] / 2 > cap and footprint.buffer(1.5).covers(Point(r[0], r[2]))
  ]
  assert len(ids) > 50 and len(oldrows) == 21
  receipt = dict(
    sourceSha256=s["preservedInputs"]["westLandmarksV187.json"],
    partId=shaft["id"],
    capY=cap,
    topY=top,
    drawnVertexCount=len(vertices),
    nativeCount=len(old["native"]),
    drawnVertices=ids,
    nativeRows=oldrows,
  )
  write(DATA / "citadelCrownV230Previous.json", receipt)
  cx, cz = footprint.centroid.coords[0]
  # Twelve source-ring sectors; the unsupported exact crenel spacing is an estimate.
  for i in range(12):
    angle = 2 * math.pi * i / 12
    px = cx + 5.4 * math.cos(angle)
    pz = cz + 5.4 * math.sin(angle)
    dx = -math.sin(angle) * 0.58
    dz = math.cos(angle) * 0.58
    member(
      "Zitadelle Juliusturm: bounded Schinkel crown",
      [px - dx, (cap + top) / 2, pz - dz],
      [px + dx, (cap + top) / 2, pz + dz],
      1.1,
      0xA87653,
    )
  # Exact park scope is independently provided for root's global bounds union.
  geo = transform(lambda x, z: (x + 389500, 5820000 - z), park)
  geographic = transform(UNPROJECT, geo)
  write(
    GEO / "bounds-botanical-v230.geojson",
    dict(
      type="FeatureCollection",
      features=[
        dict(
          type="Feature",
          properties=dict(sourceId="way/26633037", newOnly=True, areaM2=park.area),
          geometry=mapping(geographic),
        )
      ],
    ),
  )
  nav = dict(
    groundY=3,
    polygons=[rings(p) for p in park.geoms]
    if park.geom_type == "MultiPolygon"
    else [rings(park)],
    water=[
      rings(q)
      for p in waters
      for q in (p.geoms if p.geom_type == "MultiPolygon" else [p])
      if q.geom_type == "Polygon"
    ],
    solids=solids,
    groundLayers=ground_layers,
    nativeGround=[
      r
      for k, v in sites.items()
      if k.startswith("Botanical park:") and "ponds" not in k
      for r in v["native"]
    ],
    nativeWater=[
      r for k, v in sites.items() if "source ponds" in k for r in v["native"]
    ],
  )
  write(DATA / "botanicalV230Navigation.json", nav)
  for v in sites.values():
    v["boxes"] = [
      [round(n, 3) if isinstance(n, float) else n for n in r] for r in v["boxes"]
    ]
    v["native"] = [
      [round(n, 3) if isinstance(n, float) else n for n in r] for r in v["native"]
    ]
  model = dict(sites=list(sites.values()))
  write(DATA / "spandauBotanicalV230.json", model)
  evidence = dict(
    sourceSha256=digest(SOURCE),
    runtimeBytes=(DATA / "spandauBotanicalV230.json").stat().st_size,
    parkAreaM2=park.area,
    buildings=len(s["buildings"]),
    parts=len(solids),
    frontOwners=len(s["fronts"]),
    mappedTrees=sum(t[3] == "mapped" for t in trees),
    illustrativeTrees=sum(t[3] != "mapped" for t in trees),
    counts={
      k: dict(
        vertices=len(v["positions"]) // 3,
        drawnMembers=len(v["boxes"]),
        nativeBoxes=len(v["native"]),
      )
      for k, v in sites.items()
    },
    estimates=[
      "Flat new park datum y3m",
      "Unsurveyed path width2.2m",
      "Tree heights/crowns illustrative; additional crowns only in mapped woods clear of paths, water and buildings",
      "Source facade trim/windows procedural display estimates",
      "Twelve Juliusturm crenel sectors and 1.1m crown height estimated inside measured XY/maximum height; exact receipt lowers only former smooth cap",
    ],
  )
  write(GEO / "spandau-botanical-v230-evidence.json", evidence)
  return evidence


if __name__ == "__main__":
  import sys

  if "--extract" in sys.argv:
    extract()
  print(json.dumps(build()))
