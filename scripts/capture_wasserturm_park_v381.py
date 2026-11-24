"""Capture the public Wasserturmpark surveys and the small outbuildings (EPSG:25833)."""

import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
import shapely as sh
from PIL import Image
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Point, Polygon, mapping, shape

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "geo_data/regierungsviertel/wasserturm-park-v381.json.gz"
TOWERS = {137353386, 321793371, 40926070, 137353388, 321793368}
OSM_KEYS = (
  "highway",
  "step_count",
  "surface",
  "width",
  "incline",
  "handrail",
  "steps",
  "natural",
  "building",
  "leisure",
  "sport",
  "material",
  "landuse",
  "barrier",
  "amenity",
  "backrest",
  "direction",
  "playground",
  "entrance",
  "historic",
  "memorial",
  "name",
  "man_made",
  "tourism",
)


def capture(cache):
  from capture_zoo_west_v379 import leaf_parts

  raw = json.loads((cache / "osm.json").read_bytes())
  park_row = next(row for row in raw["ways"] if row[0] == 40926071)
  area = Polygon(park_row[2])

  def retained(tags):
    return {k: tags[k] for k in OSM_KEYS if k in tags}

  ways = []
  nodes = []
  towers = {}
  for i, t, g in raw["ways"]:
    geom = LineString(g)
    if i in TOWERS:
      towers[i] = Polygon(g)
    if not (i in TOWERS or len(retained(t)) and geom.intersection(area).length > 0.10):
      continue
    if not (
      i in TOWERS
      or i == 40926071
      or any(
        k in t
        for k in ("highway", "barrier", "natural", "landuse", "leisure", "amenity")
      )
    ):
      continue
    ways.append([i, retained(t), g])
  for i, t, g in raw["nodes"]:
    if area.covers(Point(g)) and any(
      k in t for k in ("amenity", "playground", "entrance", "historic", "tourism")
    ):
      nodes.append([i, retained(t), g])

  def records(name):
    return json.loads(gzip.decompress((cache / (name + ".json.gz")).read_bytes()))[
      "features"
    ]

  def local(f):
    return sh.set_precision(
      affine_transform(shape(f["geometry"]), [1, 0, 0, -1, -389500, 5820000]), 0.01
    )

  trees = []
  for f in records("anlagenbaeume"):
    pt = sh.get_parts(local(f))[0]
    if area.covers(pt):
      t = f["properties"]
      trees.append(
        [
          t["gisid"],
          pt.x,
          pt.y,
          t["gattung"],
          t["baumhoehe"],
          t["kronedurch"],
          t["stammumfg"],
        ]
      )
  alkis = []
  for f in records("bauwerkeflaechen"):
    g = local(f)
    if not g.intersects(area):
      continue
    t = f["properties"]
    alkis.append([t["uuid"], t["bezeich"], t["bezbwf"], mapping(g)])
  public_areas = []
  for layer in ["gruenanlagen", "spielplaetze"]:
    for f in records(layer):
      g = local(f)
      t = f["properties"]
      if g.intersects(area):
        public_areas.append([t["kennzeich"], t["namenr"], mapping(g)])
  # WCS tiepoint is the upper-left grid corner. A sample lies at (+.5,+.5).
  dgm = np.array(Image.open(cache / "dgm.tif"))
  bdom = np.array(Image.open(cache / "bdom.tif"))
  terrain = np.rint((dgm[134:336, 62:247] - 50) * 100).astype("<i2")
  heights = {}
  for i, g in towers.items():
    x0, z0, x1, z1 = g.bounds
    pts = [
      (x, z)
      for z in range(int(z0) - 1, int(z1) + 1)
      for x in range(int(x0), int(x1) + 1)
      if g.covers(Point(x + 0.5, z + 0.5))
    ]
    vals = [float(bdom[z + 1810, x - 3040] - dgm[z + 1810, x - 3040]) for x, z in pts]
    heights[i] = np.percentile(vals, [25, 50, 80, 95]).round(2).tolist()
  # Direct bDOM samples retain the stepped drum, roof pitch and narrow
  # chimney missing from the generalized LoD2 roof.
  xs = 3040.5 + np.arange(bdom.shape[1])
  zs = -1809.5 + np.arange(bdom.shape[0])
  xx, zz = np.meshgrid(xs, zs)
  radii = np.hypot(xx - 3236.36, zz + 1629.52)
  profile = [
    np.percentile(bdom[(radii >= i) & (radii < i + 1)], [10, 50, 85, 99])
    .round(2)
    .tolist()
    for i in range(13)
  ]
  measured = {}
  for osm, part in leaf_parts(cache / "LoD2_392_5821.zip", towers):
    measured.setdefault(osm, []).append(part)
  urls = json.loads((cache / "urls.json").read_bytes())
  urls.update(
    {
      n: "https://gdi.berlin.de/services/wfs/" + service
      for n, service in [
        ("bauwerkeflaechen.json.gz", "alkis"),
        ("spielplaetze.json.gz", "gruenanlagen"),
        ("gruenanlagen.json.gz", "gruenanlagen"),
      ]
    }
  )
  meta = {
    k: {"url": v, "sha256": hashlib.sha256((cache / k).read_bytes()).hexdigest()}
    for k, v in urls.items()
    if (cache / k).exists()
    and k
    in (
      "dgm.tif",
      "bdom.tif",
      "anlagenbaeume.json.gz",
      "true2026.jpg",
      "LoD2_392_5821.zip",
      "gruenanlagen.json.gz",
      "spielplaetze.json.gz",
      "bauwerkeflaechen.json.gz",
    )
  }
  src = dict(
    osmDate="2026-11-22",
    surveyDate="2026-11-24",
    sources=meta,
    park=park_row[2],
    ways=ways,
    nodes=nodes,
    treeRegister=sorted(trees),
    mainRoofByMetre=profile,
    alkis=alkis,
    publicParcels=public_areas,
    roofHeightQuantiles=heights,
    buildings=measured,
    dgm=dict(
      x=3102.5,
      z=-1675.5,
      nx=185,
      nz=202,
      datum=50,
      centimeters=base64.b64encode(gzip.compress(terrain.tobytes(), mtime=0)).decode(),
    ),
  )
  OUT.write_bytes(
    gzip.compress(
      json.dumps(src, ensure_ascii=False, separators=(",", ":")).encode(), mtime=0
    )
  )
  print(
    "trees",
    len(trees),
    "paths/areas",
    len(ways),
    "point fixtures",
    len(nodes),
    "LoD2",
    [(k, [v["id"] for v in values]) for k, values in measured.items()],
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("cache", type=Path)
  capture(parser.parse_args().cache)
