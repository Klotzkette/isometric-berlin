"""Relief changes altitude only; previous complete city geometry remains."""

import gzip
import json
from pathlib import Path

import pytest
from packet_receipts_v194 import audited_v194_changes, baseline_v193
from relief_receipts_v183 import restore_v183_altitudes

from scripts.build_park_relief_v182 import original, sample

ROOT = Path(__file__).resolve().parents[1]
PROFILES = json.loads((ROOT / "src/app/src/data/parkReliefV182.json").read_bytes())[
  "profiles"
]


def test_source_peaks_and_zero_weight_at_mapped_scope_edges() -> None:
  expected = (36.58, 56.46, 48.2)
  for profile, height in zip(PROFILES, expected, strict=True):
    assert max(map(max, profile["offsets"])) + 3 == pytest.approx(height)
    x0, z0, x1, z1 = profile["support"]
    for x, z in ((x0, z0), (x1, z1), (x0 - 10, z0 - 10), (0, 0)):
      assert sample(profile, x, z) == 0
  assert 3 + sample(PROFILES[1], 1000, -3160) == pytest.approx(56.44)


def test_core_geometry_and_old_sample_receipts_survive() -> None:
  folder = ROOT / "src/app/public/mesh/regierungsviertel"
  report = json.loads(
    (ROOT / "geo_data/regierungsviertel/park-relief-v182-audit.json").read_bytes()
  )
  for entry in report["core"]:
    path = ROOT / entry["file"]
    before = json.loads(original(path))
    after = json.loads(path.read_bytes())
    # Both payload families carry this identical terrain field; its strict
    # field digest is recorded by the core-ground receipt, independently of
    # the native tree-row receipt associated with minecraft-voxels.json.
    heights = restore_v183_altitudes(after["ground_height"], "ground-context.json")[
      "y_dm"
    ][:]
    for index, old, new in entry["changedSamples"]:
      assert heights[index] == new
      heights[index] = old
    assert heights == before["ground_height"]["y_dm"]
    for key in ("ground_rows", "classes", "grid"):
      assert after[key] == before[key]
  before = json.loads(original(folder / "lod2-prisms.json"))
  after = json.loads((folder / "lod2-prisms.json").read_bytes())
  assert len(before["buildings"]) == len(after["buildings"])
  for a, b in zip(before["buildings"], after["buildings"], strict=True):
    assert {k: v for k, v in a.items() if k not in {"y0_dm", "h_dm"}} == {
      k: v for k, v in b.items() if k not in {"y0_dm", "h_dm"}
    }


def test_all_outer_triangles_accounted_for_and_navigation_keeps_every_ring() -> None:
  report = json.loads(
    (ROOT / "geo_data/regierungsviertel/park-relief-v182-audit.json").read_bytes()
  )
  # Prove this old altitude-only operation against the immutable predecessor
  # where later exact source-owner substitutions are independently verified.
  changes = audited_v194_changes()
  for entry in report["outer"]:
    path = ROOT / entry["file"]
    before = json.loads(gzip.decompress(original(path)))
    cell, mode, _, _ = path.name.split(".")
    retained = baseline_v193(path) if (cell, mode) in changes else path.read_bytes()
    after = json.loads(gzip.decompress(retained))
    assert len(before["meshes"]) == len(after["meshes"])
    for receipt in entry["meshes"]:
      assert (
        sum(row[1] for row in receipt["placementRuns"]) == receipt["sourceTriangles"]
      )
      assert receipt["resultTriangles"] >= receipt["sourceTriangles"]
    for kind in ("ground", "roads", "water", "bridges"):
      assert before["nav"].get(kind) == after["nav"].get(kind)
    for a, b in zip(before["nav"]["buildings"], after["nav"]["buildings"], strict=True):
      assert {k: v for k, v in a.items() if k != "groundOffset"} == {
        k: v for k, v in b.items() if k != "groundOffset"
      }


def test_park_positions_keep_every_tree_path_and_equipment_identity() -> None:
  path = ROOT / "src/app/public/mesh/regierungsviertel/park-details.json"

  def scrub_altitude(value: object, coordinates: bool = False) -> object:
    if isinstance(value, dict):
      return {
        k: scrub_altitude(
          v, k in {"position", "points", "outline", "rings", "ring", "anchor"}
        )
        for k, v in value.items()
      }
    if isinstance(value, list):
      if (
        coordinates
        and len(value) == 3
        and all(isinstance(n, (int, float)) for n in value)
      ):
        return [value[0], 0, value[2]]
      return [scrub_altitude(v, coordinates) for v in value]
    return value

  assert scrub_altitude(json.loads(original(path))) == scrub_altitude(
    json.loads(path.read_bytes())
  )
