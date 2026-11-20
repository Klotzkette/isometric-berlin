"""Sample the open GeoBasis-DE/LGB bDOM and DGM at mapped spans in Berlin.

A difference between two grids is a height estimate for registration on the
flattened local model, not a surveyed track or engineering clearance.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import math
from pathlib import Path

import numpy as np
import rasterio
import requests
from build_steel_rail_catalogue_v369 import HEIGHTS, save, select
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

BASE = "https://isk.geobasis-bb.de/ows/"
PERCENT = np.linspace(0.08, 0.92, 11)


def sample_span(data, cache):
  row, polygon, line, edges, width, offsets = data
  rid = str(row["id"])
  xmin, zmin, xmax, zmax = polygon.bounds
  bounds = (
    math.floor(xmin + 389500 - 4),
    math.floor(5820000 - zmax - 4),
    math.ceil(xmax + 389500 + 4),
    math.ceil(5820000 - zmin + 4),
  )
  assert (bounds[2] - bounds[0]) * (bounds[3] - bounds[1]) < 75000
  u = np.array(line.coords[-1]) - line.coords[0]
  n = np.array([-u[1], u[0]]) / np.linalg.norm(u)
  # Roadway/track returns beside the actual running rails reduce outliers due
  # to thin electric lines and the metal rails themselves.
  tracks = [
    np.array(line.interpolate(f, normalized=True).coords[0]) + n * (off + shift)
    for f in PERCENT
    for off in offsets or [0.0]
    for shift in [-0.40, 0.0, 0.40]
  ]
  # Parallel outer chord observations distinguish high sided trusses from a
  # mapped truss that is entirely below the rail deck. A loose edge strip is
  # needed because the official raster has 1 m cells.
  from shapely.geometry import LineString

  edge_lines = [LineString(points) for points in edges]
  ch = [
    np.array(e.interpolate(f, normalized=True).coords[0]) + n * shift
    for e in edge_lines
    for f in PERCENT
    for shift in [-0.9, 0.0, 0.9]
  ]
  centre_ground = [
    line.interpolate(f, normalized=True).coords[0] for f in (0.3, 0.4, 0.5, 0.6, 0.7)
  ]
  ends = [line.interpolate(f, normalized=True).coords[0] for f in (0, 1)]
  flanks = [
    np.array(e.interpolate(0.5, normalized=True).coords[0]) + s * n * 2.2
    for e, s in zip(edge_lines, [1, -1])
  ]
  points = [*tracks, *ch, *centre_ground, *ends, *flanks]
  xyz = [(float(p[0] + 389500), float(5820000 - p[1])) for p in points]
  result = {"bounds": bounds}
  for kind in ["bdom", "dgm"]:
    path = cache / f"{rid}-{bounds[0]}-{bounds[1]}-{bounds[2]}-{bounds[3]}-{kind}.tif"
    if not path.exists():
      params = [
        ("service", "WCS"),
        ("version", "2.0.1"),
        ("request", "GetCoverage"),
        ("coverageid", f"bb_{kind}"),
        ("subset", f"x({bounds[0]},{bounds[2]})"),
        ("subset", f"y({bounds[1]},{bounds[3]})"),
        ("format", "image/tiff"),
      ]
      with requests.Session() as session:
        session.mount(
          "https://",
          HTTPAdapter(
            max_retries=Retry(
              total=3, backoff_factor=0.3, status_forcelist=[429, 500, 502, 503, 504]
            )
          ),
        )
        resp = session.get(BASE + kind + "_wcs", params=params, timeout=20)
        resp.raise_for_status()
      if not resp.content.startswith((b"II", b"MM")):
        raise ValueError(resp.text[:200])
      path.write_bytes(resp.content)
    with rasterio.open(path) as raster:
      if raster.crs.to_epsg() != 25833 or not np.allclose(raster.res, [1, 1]):
        raise ValueError((raster.crs, raster.res))
      samples = np.array([s[0] for s in raster.sample(xyz)])
    if np.any(samples < -500):
      return rid, {"status": "missing elevation raster samples", "bounds": bounds}

    def fmt(arr):
      return np.round(arr, 2).tolist()

    samples = samples.astype("float64")
    i, j = len(tracks), len(tracks) + len(ch)
    result[kind] = {
      "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
      "track": fmt(samples[:i].reshape(11, -1)),
      "sides": fmt(samples[i:j].reshape(2, 11, 3)),
      "datum": fmt(samples[j : j + 5]),
      "ends": fmt(samples[-4:-2]),
      "flanks": fmt(samples[-2:]),
    }
  return rid, result


def main(cache: Path):
  cache.mkdir(parents=True, exist_ok=True)
  candidates, _ = select()
  with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
    rows = dict(ex.map(lambda row: sample_span(row, cache), candidates))
  save(
    HEIGHTS,
    {
      "providers": "© GeoBasis-DE/LGB, dl-de/by-2-0; © Geoportal Berlin, dl-de/by-2-0 (Daten geändert)",
      "licenseURL": "https://www.govdata.de/dl-de/by-2-0",
      "services": [BASE + "bdom_wcs", BASE + "dgm_wcs"],
      "sampling": "1m WCS 2.0.1; 11 stations per mapped rail and two edge strips, DGM beneath the middle 40 percent of the deck; centimetre-rounded source height in metres NHN. Missing or occluded source support is retained as unresolved.",
      "records": rows,
    },
  )
  print("Source samples", len(rows))


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("cache", type=Path)
  main(parser.parse_args().cache)
