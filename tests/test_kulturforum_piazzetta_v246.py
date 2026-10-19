import hashlib
import json
import math
from pathlib import Path

from shapely.geometry import Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "src/app/public/mesh/regierungsviertel"
DATA = json.loads((ROOT / "src/app/src/data/kulturforumPiazzettaV246.json").read_text())
SOURCE = json.loads(
  (
    ROOT / "geo_data/regierungsviertel/kulturforum-piazzetta-v246-source.json"
  ).read_text()
)


def test_complete_original_source_boundary_and_all_prior_museum_prisms_are_preserved():
  buildings = json.loads((PUBLIC / "lod2-prisms.json").read_text())["buildings"]
  prior = next(p for p in buildings if p["id"] == DATA["sourceId"])
  assert SOURCE["replacedPrism"] == prior
  assert (
    hashlib.sha256(
      json.dumps(prior, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    == SOURCE["replacedPrismSha256"]
  )
  assert DATA["ring"] == [[x / 10, z / 10] for x, z in prior["ring"]]
  xy = [(p[0], p[2]) for p in DATA["positions"]]
  for x, z in DATA["ring"]:
    assert (x, z) in xy
  triangles = [Polygon([xy[i] for i in ids]) for ids in DATA["triangles"]]
  assert all(p.is_valid and p.area > 0 for p in triangles)
  assert (
    unary_union(triangles).symmetric_difference(Polygon(DATA["ring"])).area < 0.0001
  )
  museums = json.loads((ROOT / "src/app/src/kulturforumMuseumsSource.json").read_text())
  for body in museums["bodies"]:
    assert body["source_prism"] == next(
      p for p in buildings if p["id"] == body["prism_id"]
    )


def test_all_drawn_heights_replay_official_dgm_and_unchanged_terrain_fusion():
  terrain = json.loads((PUBLIC / "ground-context.json").read_text())
  assert (
    hashlib.sha256((PUBLIC / "ground-context.json").read_bytes()).hexdigest()
    == SOURCE["retainedTerrainSha256"]
  )
  samples = {
    (round(x - 0.5), round(z - 0.5)): h for x, z, h in SOURCE["dgm"]["usedSamples"]
  }
  grid, h = terrain["grid"], terrain["ground_height"]

  def interpolate(x, z, value):
    ix, iz = math.floor(x), math.floor(z)
    tx, tz = x - ix, z - iz
    return (value(ix, iz) * (1 - tx) + value(ix + 1, iz) * tx) * (1 - tz) + (
      value(ix, iz + 1) * (1 - tx) + value(ix + 1, iz + 1) * tx
    ) * tz

  for x, y, z in DATA["positions"]:
    dgm = interpolate(x - 0.5, z - 0.5, lambda i, j: samples[i, j])
    old = interpolate(
      (x / 4 - grid["min_x_idx"]) / 4 - 0.5,
      (z / 4 - grid["min_z_idx"]) / 4 - 0.5,
      lambda i, j: h["y_dm"][j * h["cols"] + i] / 10,
    )
    assert abs(y - (max(dgm, old) + 0.09)) <= 0.00051
  assert max(p[1] for p in DATA["positions"]) < 7


def test_native_receipts_match_actual_prior_columns_and_new_runs_stay_in_source():
  path = PUBLIC / "minecraft-voxels.json"
  assert hashlib.sha256(path.read_bytes()).hexdigest() == SOURCE["retainedVoxelsSha256"]
  p = json.loads(path.read_text())
  poly = Polygon(DATA["ring"])
  assert len(DATA["previousNativeColumns"]) == 422
  buildings = json.loads((PUBLIC / "lod2-prisms.json").read_text())["buildings"]
  # No second four-metre source owner can contribute these old cells.
  competing = []
  for b in buildings:
    if math.ceil(b["h_dm"] / 40) != 1:
      continue
    footprint = Polygon([(x / 10, z / 10) for x, z in b["ring"]])
    if footprint.is_valid and footprint.intersection(poly).area > 0.001:
      competing.append(b["id"])
  assert competing == [DATA["sourceId"]]
  for x, z, lo, hi in DATA["previousNativeColumns"]:
    zi = round(z / 4 - 0.5 - p["grid"]["min_z_idx"])
    xi = round(x / 4 - 0.5 - p["grid"]["min_x_idx"])
    assert any(
      start <= xi < start + n and low == round(lo * 10) and high == round(hi * 10)
      for start, n, low, high, _ in p["building_rows"][zi]
    )
    assert abs(hi - lo - 4) < 1e-8
    assert poly.intersection(box(x - 2, z - 2, x + 2, z + 2)).area > 0.001
  assert len(DATA["previousNativeColumns"]) == len(
    SOURCE["nativeReplacement"]["columns"]
  )
  for x, z, width, depth, y, _ in DATA["native"]:
    assert poly.covers(box(x, z, x + width, z + depth))
    assert y * 4 == round(y * 4)
