"""Retain the exact OSM features and local DGM/bDOM/orthophoto samples used at Friedrichsfelde.

Run with a directory containing the Berlin PBF, 2 km official surface/terrain tiles
(400_5816 and 400_5818), and the orthophoto requested by PHOTO_QUERY. No photos
are included in the viewer; sampled median roof colours are quantised at build time.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image
from shapely.geometry import Point, box, mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/tierpark-east-v379-source.json.gz"
PHOTO_QUERY = "https://gdi.berlin.de/services/wms/truedop_2026?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=truedop_2026&STYLES=&CRS=EPSG:25833&BBOX=399500,5817350,400900,5819000&WIDTH=1680&HEIGHT=1980&FORMAT=image/jpeg"
HOUSES = {"way/11269493": "DEBE11YYI0000Ixq", "way/25650546": "DEBE11YYI0000IWe"}
SPECIAL = {"way/192487133", "way/121769085", "way/123268854", "way/1178311018"}
BRIDGES = {"way/21780020", "way/1307063504", "way/1127998058"}
# Source relief stays inside mapped mountain habitats, clear of paths and buildings.
MOUNTAIN = box(10755, 1330, 11220, 1656)


def digest(path):
  with path.open("rb") as f:
    return hashlib.file_digest(f, "sha256").hexdigest()


def raw_osm(pbf):
  import osmium
  from pyproj import Transformer
  from shapely import from_wkb
  from shapely.ops import transform

  to_utm = Transformer.from_crs(4326, 25833, always_xy=True).transform

  def world(xs, ys):
    x, y = to_utm(xs, ys)
    return np.round(np.asarray(x) - 389500, 2), np.round(5820000 - np.asarray(y), 2)

  wkb = osmium.geom.WKBFactory()
  rows = []
  for o in osmium.FileProcessor(str(pbf)).with_locations().with_areas():
    if not len(o.tags) or not (
      o.is_way() or o.is_area() or (o.is_node() and o.tags.get("natural") == "tree")
    ):
      continue
    try:
      p = (
        o.location
        if o.is_node()
        else (o.nodes[0] if o.is_way() else next(iter(o.outer_rings()))[0]).location
      )
      if not (p.valid() and 13.510 < p.lon < 13.543 and 52.489 < p.lat < 52.513):
        continue
      geo = from_wkb(
        wkb.create_point(o)
        if o.is_node()
        else (wkb.create_linestring(o) if o.is_way() else wkb.create_multipolygon(o))
      )
      kind = (
        "node" if o.is_node() else ("way" if o.is_way() or o.from_way() else "relation")
      )
      rows.append(
        [
          f"{kind}/{o.orig_id() if o.is_area() else o.id}",
          dict(o.tags),
          mapping(transform(world, geo)),
        ]
      )
    except (RuntimeError, ValueError, IndexError, StopIteration):
      continue
  return rows


def source_grid(path, north):
  with zipfile.ZipFile(path) as z:
    with z.open(next(k for k in z.namelist() if k.lower().endswith(".xyz"))) as f:
      xyz = np.loadtxt(f, dtype=np.float32)
  values = np.zeros((2000, 2000), dtype=np.float32)
  values[xyz[:, 1].astype(int) - north, xyz[:, 0].astype(int) - 400000] = xyz[:, 2]
  return values


def capture(work, pbf):
  cached = work / "raw.json.gz"
  records = json.load(gzip.open(cached)) if cached.exists() else raw_osm(pbf)
  all_rows = [(i, t, shape(g)) for i, t, g in records]
  zoo = next(
    g for i, t, g in all_rows if i == "way/356446013" and g.geom_type == "MultiPolygon"
  )
  rows = [(i, t, g) for i, t, g in all_rows if zoo.covers(g.representative_point())]
  buildings = unary_union(
    [g for _, t, g in rows if g.geom_type == "MultiPolygon" and "building" in t]
  )
  paths = unary_union(
    [
      g.buffer(2.2)
      for _, t, g in rows
      if g.geom_type == "LineString" and "highway" in t
    ]
  )
  grid = {}
  for n in [5816000, 5818000]:
    for kind in ["dgm", "bdom"]:
      name = kind + ("-s" if n == 5816000 else "") + ".zip"
      local = work / (name + ".npy")
      grid[kind, n] = np.load(local) if local.exists() else source_grid(work / name, n)
  image = np.asarray(Image.open(work / "dop.jpg").convert("RGB"))

  def rgb(x, z):
    u = round((x - 10000) * 1.2)
    v = round((z - 1000) * 1.2)
    return [int(a) for a in np.median(image[v - 1 : v + 2, u - 1 : u + 2], axis=(0, 1))]

  def sample(x, z, kind):
    e = math.floor(389500 + x) - 400000
    n = math.floor(5820000 - z)
    base = 5816000 if n < 5818000 else 5818000
    return round(float(grid[kind, base][n - base, e]), 2)

  features = []
  hills = []
  for i, t, g in rows:
    polygon = g.geom_type == "MultiPolygon"
    if (
      polygon
      and (
        i in HOUSES
        or i in SPECIAL
        or (t.get("building") == "aviary" and t.get("roof:material") == "wire_fence")
      )
    ) or (not polygon and i in BRIDGES):
      row = dict(
        id=i,
        name=t.get("name", ""),
        tags={
          k: v
          for k, v in t.items()
          if k.startswith(
            ("roof:", "building", "bridge", "surface", "height", "ele", "layer")
          )
        },
        geometry=mapping(g),
      )
      if i in HOUSES:
        row["owner"] = HOUSES[i]
        # Two-metre survey grid across the whole roof, including eave sampling margin.
        a, b, c, d = g.bounds
        samples = [
          [x, z, sample(x, z, "bdom"), *rgb(x, z)]
          for x in range(2 * math.floor(a / 2) - 2, math.ceil(c) + 4, 2)
          for z in range(2 * math.floor(b / 2) - 2, math.ceil(d) + 4, 2)
          if g.buffer(3).covers(Point(x, z))
        ]
        row["roofSurvey"] = samples
        row["terrainNHN"] = round(
          float(np.median([sample(x, z, "dgm") for x, z, *_ in samples])), 2
        )
      features.append(row)
    habitat = (
      polygon
      and t.get("attraction") == "animal"
      and t.get("natural") in ("grassland", "bare_rock", "wood")
      and g.area > 180
    )
    if habitat and MOUNTAIN.covers(g.representative_point()):
      land = (
        g.intersection(MOUNTAIN).difference(buildings.buffer(0.7)).difference(paths)
      )
      if land.area < 100:
        continue
      a, b, c, d = land.bounds
      samples = [
        [x, z, sample(x, z, "dgm"), *rgb(x, z)]
        for x in range(4 * math.floor(a / 4) - 4, math.ceil(c) + 6, 4)
        for z in range(4 * math.floor(b / 4) - 4, math.ceil(d) + 6, 4)
        if land.distance(Point(x, z)) < 7
      ]
      hills.append(
        dict(id=i, name=t.get("name", ""), land=mapping(land), samples=samples)
      )
  old_positions = [
    g for _, t, g in rows if g.geom_type == "Point" and t.get("natural") == "tree"
  ]
  old = unary_union(old_positions)
  woods = unary_union(
    [
      g
      for _, t, g in rows
      if g.geom_type == "MultiPolygon"
      and (t.get("natural") == "wood" or t.get("landuse") == "forest")
    ]
  )
  woods = (
    unary_union([woods, *[shape(row["land"]) for row in hills]])
    .intersection(box(10503, 1300, 11220, 2480))
    .difference(buildings.buffer(3.3))
    .difference(paths.buffer(1.6))
  )
  trees = []
  for base in [5816000, 5818000]:
    surf = grid["bdom", base] - grid["dgm", base]
    # Suppress nearby maxima over fourteen metres, then reject isolated or building-like peaks.
    x0, x1 = 0, 725
    ia = max(0, math.floor(5820000 - 2480 - base))
    ib = min(2000, math.ceil(5820000 - 1300 - base))
    local = surf[ia:ib, x0:x1]
    peaks = local.copy()
    for delta in range(1, 8):
      peaks[delta:] = np.maximum(peaks[delta:], local[:-delta])
      peaks[:-delta] = np.maximum(peaks[:-delta], local[delta:])
    vertical = peaks.copy()
    for delta in range(1, 8):
      peaks[:, delta:] = np.maximum(peaks[:, delta:], vertical[:, :-delta])
      peaks[:, :-delta] = np.maximum(peaks[:, :-delta], vertical[:, delta:])
    candidates = []
    for iz, ix in zip(*np.where((local == peaks) & (local > 6.5) & (local < 38))):
      x = 10500 + ix + 0.5
      z = 5820000 - (base + ia + iz + 0.5)
      pt = Point(x, z)
      if not woods.covers(pt) or (not old.is_empty and old.distance(pt) < 5):
        continue
      neigh = local[max(0, iz - 5) : iz + 6, max(0, ix - 5) : ix + 6]
      if np.mean(neigh > 4) < 0.60 or np.std(neigh) < 0.55:
        continue
      h = float(local[iz, ix])
      radius = round(min(5.6, max(2.1, np.sqrt(np.sum(neigh > h * 0.55) / math.pi))), 2)
      candidates.append([x, z, round(h, 2), radius])
    for x, z, h, r in sorted(candidates, key=lambda row: -row[2]):
      if all((x - a) ** 2 + (z - b) ** 2 >= 49 for a, b, *_ in trees):
        trees.append([x, z, h, r])
  trees.sort()
  features.sort(key=lambda r: r["id"])
  hills.sort(key=lambda r: r["id"])
  save = dict(
    sourceDate="2026-11-22",
    pbfSha256=digest(pbf),
    orthophoto=PHOTO_QUERY,
    sources={
      k: digest(work / k)
      for k in ["dop.jpg", "bdom.zip", "bdom-s.zip", "dgm.zip", "dgm-s.zip"]
    },
    features=features,
    hills=hills,
    trees=trees,
  )
  with (
    SOURCE.open("wb") as out,
    gzip.GzipFile(filename="", fileobj=out, mode="wb", mtime=0) as f,
  ):
    f.write(json.dumps(save, separators=(",", ":"), ensure_ascii=False).encode())


if __name__ == "__main__":
  p = argparse.ArgumentParser(description=__doc__)
  p.add_argument("survey_directory", type=Path)
  p.add_argument("pbf", type=Path)
  args = p.parse_args()
  capture(args.survey_directory, args.pbf)
