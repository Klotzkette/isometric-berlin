"""Bounded Campus Nord source-retention and exact immutable packet audit."""

import hashlib
import importlib.util
import json
import sys
from pathlib import Path

from shapely.geometry import Polygon, box

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
SPEC = importlib.util.spec_from_file_location(
  "campus_nord_v266", ROOT / "scripts/build_campus_nord_v266.py"
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def test_source_receipt_rebuild_and_retained_theatre() -> None:
  evidence, runtime = MODULE.build()
  assert evidence == json.loads(
    (ROOT / "geo_data/regierungsviertel/campus-nord-v266-evidence.json").read_text()
  )
  assert runtime == json.loads(
    (ROOT / "src/app/src/data/campusNordV266.json").read_text()
  )
  assert len(evidence["profiles"]["mensa"]["parts"]) == 11
  assert len(evidence["profiles"]["rhoda"]["parts"]) == 3
  assert len(evidence["canopySource"]["all_surfaces"]) == 11
  assert runtime["canopy"]["roof"] == [
    s for s in evidence["canopySource"]["surfaces"] if s["kind"] == "RoofSurface"
  ]
  for name, expected in evidence["retainedTheatreSources"].items():
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == expected


def test_exclusive_columns_and_immutable_alt_mitte_packets() -> None:
  evidence = json.loads(
    (ROOT / "geo_data/regierungsviertel/campus-nord-v266-evidence.json").read_text()
  )
  prisms = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  cells = [
    box(
      r["column"][0] * 4,
      r["column"][1] * 4,
      (r["column"][0] + 1) * 4,
      (r["column"][1] + 1) * 4,
    )
    for r in evidence["exclusiveCanopyColumns"]
  ]
  for p in prisms:
    if p["id"] == "K0001xN5":
      continue
    poly = Polygon([(x / 10, z / 10) for x, z in p["ring"]])
    assert all(poly.intersection(cell).area < 0.001 for cell in cells)
  audit = json.loads(
    (
      ROOT / "geo_data/regierungsviertel/campus-nord-v266-alt-mitte-evidence.json"
    ).read_text()
  )
  assert audit["unownedTriangleLoss"] == audit["exactMatchMissing"] == 0
  assert audit["sharedInkPreserved"]
  assert audit["counts"] == {
    "drawn": 25,
    "front": 104,
    "minecraft": 470,
    "inkSegments": 24,
  }
  for name, expected in audit["inputs"].items():
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == expected
