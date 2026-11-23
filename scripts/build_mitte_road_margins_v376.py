"""Fill real gaps between the raster terrain and source carriageways in Mitte.

The named OSM street corridors only select the study area. Final material
boundaries and every face of the delivered finish come from the full survey.
"""

import argparse
import base64
import gzip
import json
from pathlib import Path

import numpy as np
import pyogrio
import shapely as sh
from shapely.geometry import shape

from scripts import build_exterior_street_margins_v373 as margins
from scripts import build_mitte_path_depth_v375 as depth
from scripts import build_surveyed_sidewalk_edges_v376 as walks

SURVEY = margins.GEO / "mitte-road-margins-v376-survey.json.gz"
OUTPUT = margins.DATA / "mitteRoadMarginsV376.json"
OSM = margins.GEO / "osm.gpkg"
NAMES = {
  "Alt-Moabit",
  "Chausseestraße",
  "Potsdamer Straße",
  "Luxemburger Straße",
  "Müllerstraße",
  "Brunnenstraße",
  "Lehrter Straße",
  "Karl-Liebknecht-Straße",
  "Friedrichstraße",
  "Turmstraße",
  "Invalidenstraße",
  "Otto-Braun-Straße",
}
AUTHORED = [
  "districtStreets",
  "schlossEastStreets",
  "mitteRoadsV343",
  "invalidenGroundV371",
]


def region():
  roads = pyogrio.read_dataframe(
    OSM, layer="roads", columns=["name", "highway", "bridge", "tunnel", "layer"]
  )
  roads = roads[
    roads.name.isin(NAMES)
    & ~roads.bridge.isin(["yes", "viaduct"])
    & ~roads.tunnel.isin(["yes"])
    & roads.layer.isin([None, "0", "nan"])
    & roads.highway.isin(
      [
        "tertiary",
        "secondary",
        "primary",
        "residential",
        "unclassified",
        "trunk",
        "service",
        "living_street",
        "pedestrian",
      ]
    )
  ]
  study = depth.study_scope()
  streets = {}
  for name, features in roads.groupby("name"):
    lines = [
      margins.world(g)
      for g in features.geometry
      if g.geom_type in ("LineString", "MultiLineString")
    ]
    candidate = sh.union_all(lines).buffer(20).intersection(study)
    if candidate.area:
      streets[name] = candidate
  # Store per-street associations without counting the same intersection twice.
  reserved = sh.GeometryCollection()
  for name in sorted(streets):
    current = streets[name]
    streets[name] = current.difference(reserved)
    reserved = reserved.union(current)
  return margins.exterior_cutouts(streets)


def capture(gap, road_cache, sidewalk_cache):
  tree = sh.STRtree(list(margins.polygon_parts(gap)))
  features, sources = {}, []

  def add(f):
    fid = f["id"]
    if fid in features:
      return
    m = str(f["properties"].get("material"))
    geom = shape(f["geometry"])
    if len(tree.query(margins.world(geom), predicate="intersects")):
      features[fid] = [fid, m, sh.to_wkb(geom, hex=True)]

  for p in sorted(road_cache.glob("*cm_fahrbahn.json.gz")):
    data = json.loads(gzip.decompress(p.read_bytes()))
    sources.extend(data["requests"])
    for f in data["features"]:
      add(f)
  for layer in walks.LAYERS:
    raw = json.loads((sidewalk_cache / (layer + ".json")).read_bytes())
    for f in raw if isinstance(raw, list) else raw["features"]:
      add(f)
  archive = {
    "source": "Geoportal Berlin / Straßenbefahrung 2014/15",
    "crs": "EPSG:25833",
    "carriagewayRequests": sources,
    "sidewalkBboxEPSG25833": [385602, 5817089, 391912, 5823618],
    "features": [features[k] for k in sorted(features)],
  }
  SURVEY.write_bytes(
    gzip.compress(json.dumps(archive, separators=(",", ":")).encode(), mtime=0)
  )


def build(*, road_cache=None, sidewalk_cache=None):
  base = region()
  if road_cache:
    capture(base[0], road_cache, sidewalk_cache)
  raw = json.loads(gzip.decompress(SURVEY.read_bytes()))["features"]
  extra = list(depth.RESERVED)
  extra.append(
    sh.box(*margins.read(margins.DATA / "invalidenGroundV371.json")["bounds"])
  )
  # All surveyed tree pits and unidentified surfaces remain open. They include
  # physical openings missing from splits in the older street classification.
  surfaces = []
  for fid, code, wkb in raw:
    layer = fid.split(".")[0]
    if layer == "bn_baumscheibe" or (
      layer != "ce_gruenflaeche" and code not in margins.LEGEND
    ):
      extra.append(sh.make_valid(margins.world(sh.from_wkb(wkb))))
    else:
      surfaces.append((fid, code, wkb))
  for name in AUTHORED[:-1]:
    group = margins.read(margins.DATA / (name + ".json"))
    for row in group["surfaces"] + group.get("supplement", {}).get("surfaces", []):
      xy = (
        np.frombuffer(base64.b64decode(row["positions_cm_b64"]), "<i4").reshape(-1, 2)
        / 100
      )
      indices = np.frombuffer(base64.b64decode(row["indices_b64"]), "<u4").reshape(
        -1, 3
      )
      extra.extend(sh.polygons(xy[indices]))
  return margins.build(
    region=base,
    survey=SURVEY,
    features=surfaces,
    exclusions=extra,
    dependencies=[OSM, *[margins.DATA / (n + ".json") for n in AUTHORED]],
  )


if __name__ == "__main__":
  args = argparse.ArgumentParser(description=__doc__)
  args.add_argument("--road-cache", type=Path)
  args.add_argument("--sidewalk-cache", type=Path)
  args.add_argument("--check", action="store_true")
  opts = args.parse_args()
  result = build(road_cache=opts.road_cache, sidewalk_cache=opts.sidewalk_cache)
  txt = json.dumps(result, separators=(",", ":")) + "\n"
  if opts.check:
    assert OUTPUT.read_text() == txt
  else:
    OUTPUT.write_text(txt)
  print({k: v for k, v in result.items() if k not in {"sources", "chunks"}})
