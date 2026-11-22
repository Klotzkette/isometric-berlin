"""Independently match the shipped faces to the municipal feature records."""

import base64
import gzip
import json
from pathlib import Path

import numpy as np
import shapely
from shapely.affinity import affine_transform

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "geo_data/regierungsviertel/gate-forecourts-v374-survey.json.gz"
MESH = ROOT / "src/app/src/data/gateForecourtsV374.json"


def test_municipal_boundaries_and_competing_owners():
  records = json.loads(gzip.decompress(ARCHIVE.read_bytes()))
  data = json.loads(MESH.read_bytes())
  rows = {
    fid: affine_transform(shapely.from_wkb(wkb), [1, 0, 0, -1, -389500, 5820000])
    for fid, _, _, wkb in records["features"]
  }
  vertices = np.frombuffer(
    gzip.decompress(base64.b64decode(data["vertices"])), "<u2"
  ).reshape(-1, 3)
  indices = np.frombuffer(
    gzip.decompress(base64.b64decode(data["indices"])), "<u2"
  ).reshape(-1, 3)
  xz = vertices[:, :2] / 100 + [292, 220]
  types = vertices[indices, 2]
  flat = types.min(axis=1) == types.max(axis=1)
  faces = shapely.polygons(xz[indices[flat]])
  types = types[flat, 0]
  styles = list(data["styles"])
  unions = {key: shapely.union_all(faces[types == i]) for i, key in enumerate(styles)}
  base = shapely.union_all(
    [
      g
      for k, g in unions.items()
      if k not in ("kerb", "flushKerb", "gardenStone", "flowerSoil")
    ]
  )
  # Clipping to the 8 m DGM cells re-snaps their boundary intersections
  # to centimetres. Less than half a square metre changes across 25,053 m².
  assert abs(base.area - data["surveyAreaM2"]) < 0.5
  assert 25_000 < base.area < 25_100
  assert sums_are_disjoint(unions, base)
  plaza = unions["plaza"]
  west = rows["ci_oeffentlicher_platz.1728"]
  assert plaza.difference(west.buffer(0.015)).area < 0.01
  assert 1090 < plaza.area < 1110
  assert (
    unions["median"].difference(rows["cf_trennstreifen.18607"].buffer(0.015)).area
    < 0.01
  )
  true_beds = shapely.union_all(
    [rows["ce_gruenflaeche.21433"], rows["ce_gruenflaeche.41614"]]
  )
  assert unions["grass"].difference(true_beds.buffer(0.015)).area < 0.01
  assert true_beds.difference(unions["grass"].buffer(0.015)).area < 0.05
  for id, geometry in rows.items():
    if id.startswith(("bv_springbrunnen_", "bm_zugangsbauwerk", "cc_treppe")):
      assert base.intersection(geometry.buffer(-0.015)).area < 0.01
  raised, low = [], []
  for id, _, bor, _ in records["features"]:
    if id.startswith("bd_bordstein."):
      (raised if bor == 1 else low).append(rows[id])
  for key, lines in [("kerb", raised), ("flushKerb", low)]:
    assert unions[key].difference(shapely.union_all(lines).buffer(0.10)).area < 0.005
  assert len(data["laneMarks"]) > 40
  for _, ax, az, bx, bz in data["laneMarks"]:
    line = shapely.LineString([(ax / 100, az / 100), (bx / 100, bz / 100)])
    assert unions["asphalt"].buffer(0.015).covers(line)
  assert len(indices) * 2 + len(vertices) * 19 < 600_000



def sums_are_disjoint(unions, base):
  area = sum(
    g.area
    for k, g in unions.items()
    if k not in ("kerb", "flushKerb", "gardenStone", "flowerSoil")
  )
  return abs(area - base.area) < 0.1
