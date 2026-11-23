"""Recover the exact park and native tree rows at four named Berlin sites."""

import argparse
import gzip
import json
import math
import sys
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

from shapely import Point, STRtree, box

if __package__ in (None, ""):
  sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.build_mitte_trees_v375 import (  # noqa: E402
  BOUNDS,
  DATA,
  LAYER,
  PUBLIC,
  ROOT,
  SERVICE,
  SURVEY,
  encode,
  polygon,
  read,
)

SITES = (
  ("Robert-Koch-Platz",),
  ("Invalidenpark",),
  (
    "Geschichtspark",
    "Geschichtspark Vorflächen",
    "Geschichtspark, Invalidenstr. 54 - 55",
    "Geschichtspark Zufahrt Lehrter Str. 5 b - d",
  ),
  ("Agnes-Sorma-Park Reinhardtstr.", "Reinhardtstr. - Schumannstr.im Agnes-Sorma-Park"),
)
RECEIPT = ROOT / "geo_data/regierungsviertel/mitte-canopy-sites-v376.json.gz"
OUTPUT = DATA / "mitteCanopyV376.json"


def capture(cache=None):
  """Retain just the official identifiers and site names omitted by the v375 inventory."""
  x0, z0, x1, z1 = BOUNDS
  groups = [[] for _ in SITES]
  for layer in LAYER:
    if cache:
      data = read(cache / f"inner-{layer}.json")
    else:
      query = urllib.parse.urlencode(
        dict(
          service="WFS",
          version="2.0.0",
          request="GetFeature",
          typeNames=f"baumbestand:{layer}",
          srsName="EPSG:25833",
          bbox=f"{389500 + x0},{5820000 - z1},{389500 + x1},{5820000 - z0},EPSG:25833",
          outputFormat="application/json",
          count=100000,
        )
      )
      with urllib.request.urlopen(f"{SERVICE}?{query}", timeout=90) as response:
        data = json.load(response)
    if len(data["features"]) != int(data["numberMatched"]):
      raise ValueError("Incomplete municipal catalogue")
    for feature in data["features"]:
      properties = feature["properties"]
      name = (properties["namenr"] or "").strip()
      for index, names in enumerate(SITES):
        if name in names:
          groups[index].append([properties["gisid"], name])
  result = dict(
    service=SERVICE,
    layers=LAYER,
    crs="EPSG:25833",
    license="dl-de/zero-2-0",
    groups=[sorted(rows) for rows in groups],
  )
  RECEIPT.write_bytes(gzip.compress(encode(result), mtime=0))


def build():
  source = read(PUBLIC / "park-details.json")
  trees, vocabulary = source["trees"], source["tree_vocabulary"]
  # A five-centimetre match resolves only rounding in the stored park positions.
  # No nearest-neighbour substitution between neighbouring trunks.
  index = STRtree([Point(t["position"][0], t["position"][2]) for t in trees])
  native = read(PUBLIC / "minecraft-voxels.json")
  grid = native["grid"]
  voxels = {
    (grid["min_x_idx"] + dx, grid["min_z_idx"] + dz): (y, h)
    for dz, row in enumerate(native["tree_rows"])
    for dx, y, h in row
  }
  surfaces = read(PUBLIC / "surface-polygons.json")
  protected = STRtree(
    [
      polygon(record, 0.1)
      for record in surfaces["roads"]
      + surfaces["water"]
      + read(PUBLIC / "lod2-prisms.json")["buildings"]
    ]
  )
  survey = {r[1]: r for r in json.loads(gzip.decompress(SURVEY.read_bytes()))["rows"]}
  represented = {t["i"] for t in read(DATA / "mitteTreesV375.json")["additions"]}
  occupied = set()
  groups = []
  blocks = []
  words = {}
  for site, labels in enumerate(
    json.loads(gzip.decompress(RECEIPT.read_bytes()))["groups"]
  ):
    group = []
    for gid, _ in labels:
      _, _, x, z, *_ = survey[gid]
      hits = index.query(Point(x, z), predicate="dwithin", distance=0.05)
      if len(hits) != 1 or gid in represented:
        continue
      i = int(hits[0])
      if i in occupied:
        raise ValueError("Two municipal identities resolve to the same park tree")
      t = trees[i]
      if vocabulary["source"][t["s"]] != "berlin_official":
        continue
      occupied.add(i)
      if site == 0:
        if vocabulary["species"][t["sp"]] != "Gemeine Rosskastanie":
          raise ValueError("Robert-Koch-Platz catalogue changed")
        px, _, pz = t["position"]
        radius = t["tr"]
        footprint = box(px - radius, pz - radius, px + radius, pz + radius)
        if protected.query(footprint, predicate="intersects").size:
          raise ValueError("Measured chestnut stem intersects unrelated ground")
        group.append([i, px, pz, radius, t["h"], 2 * t["cr"]])
      else:
        packed = [i, *t["position"], t["h"], t["cr"], t["tr"], t["v"]]
        for key, code in (
          ("catalogue", "c"),
          ("species", "sp"),
          ("tree_group", "g"),
          ("leaf_type", "lt"),
        ):
          word = vocabulary[key][t[code]] if code in t else None
          table = words.setdefault(key, [])
          if word not in table:
            table.append(word)
          packed.append(table.index(word))
        group.append(packed)
      cx, cz = math.floor(x / 4), math.floor(z / 4)
      if (cx, cz) in voxels:
        bx, bz = cx * 4 + 2, cz * 4 + 2
        footprint = box(bx - 0.9, bz - 0.9, bx + 0.9, bz + 0.9)
        if site == 0 or not protected.query(footprint, predicate="intersects").size:
          blocks.append([i, cx, cz, *voxels[cx, cz]])
    groups.append(sorted(group))
  claims = Counter((row[1], row[2]) for row in blocks)
  blocks = [row for row in blocks if claims[row[1], row[2]] == 1]
  return dict(groups=groups, vocabulary=words, native=sorted(blocks))


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--capture", action="store_true")
  parser.add_argument("--cache", type=Path)
  args = parser.parse_args()
  if args.capture:
    capture(args.cache)
  packet = build()
  OUTPUT.write_bytes(encode(packet) + b"\n")
  print(
    "Matched by site:",
    [len(group) for group in packet["groups"]],
    "clear native cells:",
    len(packet["native"]),
  )
