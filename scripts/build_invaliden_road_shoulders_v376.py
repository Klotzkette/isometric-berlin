"""Keep measured paving in the three verified Invalidenstraße entrance parcels.

The two modelled ramp bores, their shared opening, the walls and the complete
cross-section between the ramps remain empty of any new ground.
"""

import argparse
import gzip
import json
import subprocess
from pathlib import Path

import shapely as sh
from shapely.geometry import shape

from scripts import build_exterior_street_margins_v373 as margins

GEO = margins.GEO
ARCHIVE = GEO / "invaliden-portal-shoulders-v376-survey.json.gz"
OUTPUT = margins.DATA / "invalidenPortalShouldersV376.json"
CAPTURE = margins.ROOT / "src/app/scripts/capture-invaliden-portal-shoulders-v376.ts"
PORTAL = margins.ROOT / "src/app/src/TunnelPortals.ts"
NORTH_RAIL = margins.ROOT / "src/app/src/HbfNorthApproachProfile.ts"
MEASURED = {"cm_fahrbahn.25086", "cm_fahrbahn.53458", "cl_gehweg.387128"}
BUFFER = 0.25


def geometry(bun):
  capture = json.loads(subprocess.check_output([bun, str(CAPTURE)], cwd=margins.ROOT))
  envelope = sh.MultiPoint(capture["support"]).convex_hull
  return {
    "cells": capture["cells"],
    "protectRing": list(map(list, envelope.exterior.coords)),
    "owners": capture["owners"],
  }


def archive(bun, road_cache, sidewalk_cache):
  model = geometry(bun)
  cells = sh.union_all([sh.box(x, z, x + 4, z + 4) for x, z in model["cells"]])
  records = {}

  def retain(f):
    fid = f["id"]
    if fid in records:
      return
    g = shape(f["geometry"])
    if cells.intersects(margins.world(g)):
      records[fid] = [fid, str(f["properties"].get("material")), sh.to_wkb(g, hex=True)]

  # The study crosses the shared boundary of two original 768 m WFS queries.
  queries = []
  for name in ("-768_-1536_cm_fahrbahn.json.gz", "-768_-768_cm_fahrbahn.json.gz"):
    file = road_cache / name
    d = json.loads(gzip.decompress(file.read_bytes()))
    queries.extend(d["requests"])
    for f in d["features"]:
      retain(f)
  for layer in ("cl_gehweg", "ce_gruenflaeche", "bn_baumscheibe"):
    raw = json.loads((sidewalk_cache / (layer + ".json")).read_bytes())
    for f in raw if isinstance(raw, list) else raw["features"]:
      retain(f)
  assert MEASURED <= records.keys()
  data = {
    "source": "Geoportal Berlin / Straßenbefahrung 2014/15",
    "crs": "EPSG:25833",
    "carriagewayRequests": queries,
    "sidewalkBboxEPSG25833": [385602, 5817089, 391912, 5823618],
    "groundModel": model,
    "features": [records[k] for k in sorted(records)],
  }
  ARCHIVE.write_bytes(
    gzip.compress(json.dumps(data, separators=(",", ":")).encode(), mtime=0)
  )


def build():
  data = json.loads(gzip.decompress(ARCHIVE.read_bytes()))
  record = data["groundModel"]
  original = sh.union_all([sh.box(x, z, x + 4, z + 4) for x, z in record["cells"]])
  aperture = sh.Polygon(record["protectRing"]).buffer(BUFFER)
  clipped = original.difference(aperture)
  protected = []
  surfaces = margins.read(margins.MESH / "surface-polygons.json")
  for road in surfaces["roads"]:
    if len(road["ring"]) >= 3:
      g = margins.dm_polygon(road)
      if clipped.intersects(g):
        protected.append(sh.make_valid(g))
  measured = []
  for fid, mat, wkb in data["features"]:
    if fid in MEASURED:
      measured.append((fid, mat, wkb))
    else:
      protected.append(sh.make_valid(margins.world(sh.from_wkb(wkb))))
  out = margins.build(
    region=(clipped, {"Invalidenstraße": clipped}, surfaces),
    survey=ARCHIVE,
    features=measured,
    exclusions=protected,
    dependencies=[CAPTURE, PORTAL, NORTH_RAIL, margins.MESH / "scene.json"],
  )
  return out


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--road-cache", type=Path)
  parser.add_argument("--sidewalk-cache", type=Path)
  parser.add_argument("--bun", default="bun")
  parser.add_argument("--check", action="store_true")
  opts = parser.parse_args()
  if opts.road_cache:
    archive(opts.bun, opts.road_cache, opts.sidewalk_cache)
  result = build()
  text = json.dumps(result, separators=(",", ":")) + "\n"
  if opts.check:
    from scripts import check_street_surfaces_v376 as verify

    assert (
      geometry(opts.bun)
      == json.loads(gzip.decompress(ARCHIVE.read_bytes()))["groundModel"]
    )
    if verify.original_toolchain():
      assert text == OUTPUT.read_text()
    else:
      verify.check_roads(
        json.loads(OUTPUT.read_bytes()),
        result,
        margins.read(margins.MESH / "ground-context.json"),
      )
  else:
    OUTPUT.write_text(text)
  print({k: v for k, v in result.items() if k not in {"sources", "chunks"}})
