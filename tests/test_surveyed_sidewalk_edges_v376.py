"""Check the delivered sidewalk fragments directly against independent WFS footprints."""

import base64
import gzip
import hashlib
import json
from collections import defaultdict

import numpy as np
import pytest
import shapely as sh

from scripts import build_surveyed_sidewalk_edges_v376 as walk


def unpack(encoded):
  return np.frombuffer(gzip.decompress(base64.b64decode(encoded, validate=True)), "<u2")


def test_actual_footprints_classes_and_tree_pits():
  grid, raster, grass, plaza, _ = walk.terrain()
  package = json.loads(walk.OUTPUT.read_bytes())
  assert (
    hashlib.sha256(walk.ARCHIVE.read_bytes()).hexdigest() == package["surveySha256"]
  )
  raw = json.loads(gzip.decompress(walk.ARCHIVE.read_bytes()))["features"]
  originals = defaultdict(list)
  for fid, _code, kind, wkb, eligible in raw:
    if eligible or fid.startswith("bn_baumscheibe."):
      originals[kind].append(sh.make_valid(walk.margins.world(sh.from_wkb(wkb))))
  words = unpack(package["words"])
  areas = defaultdict(list)
  previous = walk.previous_cells()
  i = 0
  while i < len(words):
    row, col, old, n = map(int, words[i : i + 4])
    assert old == raster[row, col] and old in (grass, plaza)
    assert (row, col) not in previous
    xy = words[i + 4 : i + 4 + 6 * n].astype(float).reshape(-1, 3, 2) / 1000
    assert np.all((xy >= 0) & (xy <= 4))
    xy += [(col + grid["min_x_idx"]) * 4, (row + grid["min_z_idx"]) * 4]
    i += 4 + 6 * n
    if not n:
      continue
    d, e = xy[:, 1] - xy[:, 0], xy[:, 2] - xy[:, 0]
    assert np.all(d[:, 0] * e[:, 1] - d[:, 1] * e[:, 0] < 0)
    areas["paving" if old == grass else "green"].extend(sh.polygons(xy))
  assert i == len(words)
  for kind, polys in areas.items():
    covered = sh.union_all(originals[kind]).buffer(0.0016)
    sh.prepare(covered)
    assert np.all(sh.covers(covered, polys))
    assert sh.area(polys).sum() == pytest.approx(package["areaM2"][kind], abs=0.001)
    pit_ids, faces = sh.STRtree(polys).query(originals["other"], predicate="intersects")
    assert len(pit_ids) == 0
  assert len(areas["paving"]) + len(areas["green"]) == package["triangles"]
  assert package["triangles"] < 15000
  assert walk.OUTPUT.stat().st_size < 150000


def test_false_kerbs_are_removed_only_across_source_raster_transitions():
  grid, _, _, _, seams = walk.terrain()
  expected = set(seams)
  package = json.loads(walk.OUTPUT.read_bytes())
  ink = unpack(package["ink"])
  seen = set()
  i = 0
  while i < len(ink):
    row, col, direction, n = map(int, ink[i : i + 4])
    assert (row, col, direction) in expected
    assert (row, col, direction) not in seen
    seen.add((row, col, direction))
    xy = ink[i + 4 : i + 4 + n * 4].astype(float).reshape(-1, 2, 2) / 1000
    xy += [(col + grid["min_x_idx"] - 1) * 4, (row + grid["min_z_idx"] - 1) * 4]
    line = walk.seam_line(grid, row, col, direction)
    retained = sh.linestrings(xy)
    assert np.all(sh.covers(line, retained))
    assert sum(sh.length(retained)) < 4
    i += 4 + n * 4
  assert len(seen) == package["replacedInkEdges"]
