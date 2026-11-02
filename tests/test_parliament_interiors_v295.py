"""Independent source ownership and unchanged measured-plan checks for v295."""

import json
import re
from functools import lru_cache
from hashlib import sha256
from pathlib import Path

from shapely.geometry import Polygon, box
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "src/app/public/mesh/regierungsviertel"
RECEIPT = ROOT / "geo_data/regierungsviertel/parliament-native-v295-receipt.json"


@lru_cache(maxsize=1)
def audit():
  receipt = json.loads(RECEIPT.read_text())
  prism_bytes = (PUBLIC / "lod2-prisms.json").read_bytes()
  voxel_bytes = (PUBLIC / "minecraft-voxels.json").read_bytes()
  assert sha256(prism_bytes).hexdigest() == receipt["source_prisms_sha256"]
  assert sha256(voxel_bytes).hexdigest() == receipt["source_voxels_sha256"]
  source, voxels = json.loads(prism_bytes), json.loads(voxel_bytes)
  buildings = source["buildings"]
  polygons = [
    Polygon(
      [(x / 10, z / 10) for x, z in b["ring"]],
      [[(x / 10, z / 10) for x, z in r] for r in b.get("holes", [])],
    )
    for b in buildings
  ]
  tree = STRtree(polygons)
  allowed = set(receipt["source_ids"])
  union = unary_union([p for b, p in zip(buildings, polygons) if b["id"] in allowed])
  admitted, rejected = [], []
  for zi, row in enumerate(voxels["building_rows"]):
    z = voxels["grid"]["min_z_idx"] + zi
    if not -2 <= z <= 21:
      continue
    for start, count, lo, hi, kind in row:
      for j in range(count):
        x = voxels["grid"]["min_x_idx"] + start + j
        if not 63 <= x <= 86:
          continue
        cell = box(x * 4, z * 4, (x + 1) * 4, (z + 1) * 4)
        owners = [
          buildings[int(i)]["id"]
          for i in tree.query(cell)
          if polygons[int(i)].intersection(cell).area > 1e-8
          and buildings[int(i)]["y0_dm"] < hi
          and buildings[int(i)]["y0_dm"] + buildings[int(i)]["h_dm"] > lo
        ]
        if not any(owner in allowed for owner in owners):
          continue
        if cell.difference(union).area < 1e-8 and set(owners) <= allowed:
          admitted.append([x, z, lo, hi, kind])
        else:
          rejected.append([x, z, owners])
  return receipt, admitted, rejected, source


def test_every_admitted_complete_voxel_cell_has_only_the_three_exact_source_owners():
  receipt, admitted, _, _ = audit()
  assert len(admitted) == 356
  assert admitted == receipt["columns"]
  ts = (ROOT / "src/app/src/ParliamentNativeColumnsV295.ts").read_text()
  tuples = json.loads(re.search(r"RECEIPTS_V295[^=]*=\s*(\[.*?\]);", ts, re.S)[1])
  assert tuples == admitted


def test_edge_and_foreign_cells_are_rejected_instead_of_spatially_deleted():
  receipt, _, rejected, _ = audit()
  assert len(rejected) == 75
  expected = {
    (x, z): set(owners) for x, z, owners in receipt["rejected_edge_or_foreign_columns"]
  }
  assert {(x, z): set(owners) for x, z, owners in rejected} == expected
  assert any(set(owners) - set(receipt["source_ids"]) for _, _, owners in rejected)


def test_estimated_berlin_plenary_roof_preserves_measured_courts_and_outside_roof():
  _, _, _, source = audit()
  main = next(b for b in source["buildings"] if b["id"] == "eaCxS2u2")
  assert main["h_dm"] == 30  # faulty original source remains original evidence
  assert len(main["holes"]) == 6
  import math

  yaw = math.atan2(3.3, 47.4)

  def world(u, v):
    return (
      658.3 + u * math.cos(yaw) + v * math.sin(yaw),
      1287.65 - u * math.sin(yaw) + v * math.cos(yaw),
    )

  estimated_roof = Polygon(
    [world(-20, -80), world(20, -80), world(20, -44), world(-20, -44)]
  )
  measured = Polygon(
    [(x / 10, z / 10) for x, z in main["ring"]],
    [[(x / 10, z / 10) for x, z in r] for r in main["holes"]],
  )
  assert estimated_roof.difference(measured).area < 1e-8
  for ring in main["holes"]:
    court = Polygon([(x / 10, z / 10) for x, z in ring])
    assert estimated_roof.intersection(court).area == 0
  outside = measured.difference(estimated_roof)
  assert abs(outside.area + estimated_roof.area - measured.area) < 1e-8
