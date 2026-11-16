"""Independent complete-owner/complement proof for the station-local finish."""

import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
import shapely
from pyproj import Transformer
from shapely.affinity import affine_transform
from shapely.geometry import Polygon, box, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]


def test_masks_equal_exact_current_sources_and_keep_every_green_hole():
  path = ROOT / "geo_data/regierungsviertel/hbf-forecourt-finish-v354-source.json.gz"
  source = json.loads(gzip.decompress(path.read_bytes()))
  data = json.loads(
    (ROOT / "src/app/src/data/hbfForecourtFinishV354.json").read_bytes()
  )
  assert data["sourceSha256"] == hashlib.sha256(path.read_bytes()).hexdigest()
  for name, expected in source["inputSha256"].items():
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == expected
  project = Transformer.from_crs(4326, 25833, always_xy=True).transform

  def world(g):
    return affine_transform(g, [1, 0, 0, -1, -389500, 5820000])

  official = {
    f["properties"]["uuid"]: world(shape(f["geometry"]))
    for f in source["officialOwners"]
  }
  assert set(official) == {"DEBE01YYK0003sLP", "DEBE01YYK0003sQ2", "DEBE01YYK0003sOJ"}
  mapped = {
    str(f["properties"]["osm_id"]): world(transform(project, shape(f["geometry"])))
    for f in source["mappedPaving"]
  }
  assert set(mapped) == {"10726692", "20783801"}
  protected = unary_union(
    [
      shapely.make_valid(world(shape(f["geometry"])))
      for f in source["officialVegetation"]
    ]
    + [
      shapely.make_valid(
        Polygon(np.asarray(p["ring"]) / 10, [np.asarray(h) / 10 for h in p["holes"]])
      )
      for p in source["retainedGreen"]
    ]
  )
  paving = unary_union(
    [
      official["DEBE01YYK0003sLP"].intersection(mapped["10726692"]),
      official["DEBE01YYK0003sQ2"],
      official["DEBE01YYK0003sOJ"],
      mapped["20783801"],
    ]
  )
  actual = unary_union([Polygon(p["ring"], p["holes"]) for p in data["drawn"]])
  assert actual.symmetric_difference(paving.difference(protected)).area < 1e-7
  assert actual.intersection(protected).area < 1e-7
  assert 21392 < actual.area < 21393


def test_native_is_complete_independent_cell_subset_not_smoothed_paving():
  data = json.loads(
    (ROOT / "src/app/src/data/hbfForecourtFinishV354.json").read_bytes()
  )
  drawn = unary_union([Polygon(p["ring"], p["holes"]) for p in data["drawn"]])
  native = unary_union([Polygon(p["ring"], p["holes"]) for p in data["native"]])
  assert native.area == 17600
  assert native.difference(drawn).area < 1e-7
  x0, z0, x1, z1 = drawn.bounds
  cells = []
  for z in range(int(np.floor(z0 / 4)), int(np.ceil(z1 / 4))):
    for x in range(int(np.floor(x0 / 4)), int(np.ceil(x1 / 4))):
      cell = box(x * 4, z * 4, x * 4 + 4, z * 4 + 4)
      if drawn.covers(cell):
        cells.append(cell)
  assert len(cells) == 1100
  assert native.symmetric_difference(unary_union(cells)).area < 1e-7
  for p in data["native"]:
    for ring in [p["ring"], *p["holes"]]:
      assert all(v % 4 == 0 for point in ring for v in point)
      assert all(a[0] == b[0] or a[1] == b[1] for a, b in zip(ring, ring[1:]))
