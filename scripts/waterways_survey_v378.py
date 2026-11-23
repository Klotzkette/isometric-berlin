"""Coordinate and geometry helpers for the fixed Landwehrkanal and riverbank extracts."""

import gzip
import json
import os
import pathlib

import numpy as np
from pyproj import Transformer
from shapely import line_merge, make_valid, union_all
from shapely.geometry import LineString, MultiPolygon, Polygon

P = pathlib.Path(os.environ["BERLIN_WATER_SURVEY"])
R = pathlib.Path(__file__).resolve().parents[1]
GEO = R / "geo_data/regierungsviertel"


def load(k):
  return json.load(gzip.open(P / (k + ".json.gz")))


toUTM = Transformer.from_crs(4326, 25833, always_xy=True)


def xy(g):
  g = np.asarray(g)
  a, b = toUTM.transform(g[:, 0], g[:, 1])
  return np.stack((a - 389500, 5820000 - b), axis=-1)


def ppoly(g):
  return make_valid(
    MultiPolygon([Polygon(xy(r[0]), [xy(h) for h in r[1:]]) for r in g])
  )


def geoall(k, area=False):
  return [(i, v, t, ppoly(g) if area else LineString(xy(g))) for i, v, t, g in load(k)]


def segments(g):
  if g.is_empty:
    return []
  if g.geom_type in ("MultiLineString", "GeometryCollection", "MultiPolygon"):
    return [q for p in g.geoms for q in segments(p)]
  return [g]


def dumpjson(p, v):
  s = (
    json.dumps(v, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode()
    + b"\n"
  )
  p.write_bytes(gzip.compress(s, mtime=0) if p.suffix == ".gz" else s)


def loadjson(p):
  return json.loads(
    gzip.decompress(p.read_bytes()) if p.suffix == ".gz" else p.read_bytes()
  )


A = geoall("axis")
lp = [r for r in A if r[2].get("name") == "Landwehrkanal" and r[2].get("boat") == "yes"]
print("waterline", [(r[0], round(r[3].length)) for r in lp], flush=True)
merged = line_merge(union_all([r[3] for r in lp]))
# Each OSM centreline from a confluence to the next should join end to end.
print("merged", merged.geom_type, merged.length, flush=True)
if merged.geom_type == "MultiLineString":
  raise ValueError("Expected one continuous Landwehrkanal centreline")
elif merged.coords[0][0] > merged.coords[-1][0]:
  merged = LineString(list(merged.coords)[::-1])
branches = [("Hauptlauf", merged)]
branches += [
  (r[2].get("name", "Altarm") + " " + r[0], r[3])
  for r in A
  if r not in lp
  and r[2].get("name") in ("Landwehrkanal", "Flutgraben")
  and r[3].distance(merged) < 45
  and r[3].length > 0
]


def crosspoints(line, axis):
  g = line.intersection(axis)
  return [p for p in segments(g) if p.geom_type == "Point"] + [
    p for gg in segments(g) if gg.geom_type == "MultiPoint" for p in gg.geoms
  ]


def axispos(pt):
  return merged.project(pt)
