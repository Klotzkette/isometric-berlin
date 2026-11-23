"""Capture low, unobstructed 2026 roof returns beneath oversized old city prisms.

Use the same survey directory and published predecessor packets as the park
generator. The arguments are scene metres. A split building retains the actual
samples from each participating packet.
"""

import argparse
import gzip
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image
from shapely.geometry import Point, Polygon

from scripts.capture_tierpark_east_v379 import ROOT, source_grid


def capture(work):
  out = []
  packets = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
  for x in [20, 21]:
    for z in [2, 3, 4]:
      tile = f"outer187-{x}_{z}"
      d = json.load(gzip.open(packets / (tile + ".drawn.json.gz")))
      for b in d["nav"]["buildings"]:
        poly = Polygon(b["ring"], b["holes"]).buffer(0)
        if poly.is_empty or not (3 < poly.area < 220 and b["height"] >= 14):
          continue
        c = poly.centroid
        wx = c.x + x * 512
        wz = c.y + z * 512
        if 10400 < wx < 11170 and 1330 < wz < 2370:
          out.append(
            (
              round(b["height"], 1),
              b["sourceId"],
              round(wx, 1),
              round(wz, 1),
              round(poly.area),
            )
          )
  grids = {}
  for kind in ["dgm", "bdom"]:
    for south, north in [(0, 5818000), (1, 5816000)]:
      name = kind + ("-s" if south else "") + ".zip"
      cache = work / (name + ".npy")
      grids[kind, south] = (
        np.load(cache, mmap_mode="r")
        if cache.exists()
        else source_grid(work / name, north)
      )
  image = np.asarray(Image.open(work / "dop.jpg").convert("RGB"))
  sites = {}
  for old, owner, x, z, area in sorted(set(out), reverse=True):
    if x < 10500 or area < 5:
      continue
    tile = f"outer187-{math.floor(x / 512)}_{math.floor(z / 512)}"
    d = json.load(gzip.open(packets / (tile + ".drawn.json.gz")))
    b = next(b for b in d["nav"]["buildings"] if b["sourceId"] == owner)
    ox, _, oz = d["origin"]
    poly = Polygon([(a + ox, b + oz) for a, b in b["ring"]]).buffer(-0.35)
    if poly.is_empty:
      continue
    rec = []
    a, b, c, e = poly.bounds
    for u in range(int(a), int(c) + 1):
      for v in range(int(b), int(e) + 1):
        if not poly.contains(Point(u + 0.5, v + 0.5)):
          continue
        south = int(v >= 2000)
        north = 5816000 if south else 5818000
        iz = 5820000 - v - 1 - north
        ix = u - 10500
        h = grids["bdom", south][iz, ix] - grids["dgm", south][iz, ix]
        rgb = image[int((v + 0.5 - 1000) * 1.2), int((u + 0.5 - 10000) * 1.2)].tolist()
        rec.append([u + 0.5, v + 0.5, round(float(h), 2), *rgb])
    if len(rec) < 5:
      continue
    h = np.array(rec)[:, 2]
    low, mid, hi, top = np.quantile(h, [0.15, 0.5, 0.9, 0.99])
    vacant = top < 1.55 and mid < 0.85
    roof = (
      hi < old - 3
      and 1.6 < mid < 10
      and (hi - low < 2.65 or np.mean(abs(h - mid) < 1.3) > 0.85)
    )
    if vacant or roof:
      sites.setdefault(owner, {})[tile] = dict(
        form="open" if vacant else "roof", prior=old, samples=rec
      )
  dest = ROOT / "geo_data/regierungsviertel/tierpark-east-v379-low-buildings.json.gz"
  evidence = dict(
    source="2026 Berlin bDOM minus DGM1 at 1m measured cell centres; RGB from TrueDOP 2026. Source ZIPs and orthophoto hashes in tierpark-east-v379-source.json.gz.",
    sites=sites,
  )
  with (
    dest.open("wb") as f,
    gzip.GzipFile(fileobj=f, mode="wb", filename="", mtime=0) as z,
  ):
    z.write(json.dumps(evidence, separators=(",", ":")).encode())


if __name__ == "__main__":
  p = argparse.ArgumentParser(description=__doc__)
  p.add_argument("survey_directory", type=Path)
  capture(p.parse_args().survey_directory)
