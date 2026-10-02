"""The hero overlay must preserve the source datum and the complete owner."""

from __future__ import annotations

import gzip
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
SPEC = importlib.util.spec_from_file_location(
  "build_zionskirche_v174", ROOT / "scripts/build_zionskirche_v174.py"
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def test_retained_source_record_and_height_conflict() -> None:
  record = MODULE.source_record()
  evidence = json.loads(
    (ROOT / "src/app/src/data/zionskircheV174Evidence.json").read_text()
  )
  assert record["groundY"] == 3
  assert record["verticalTransform"]["offsetY"] == -50.332
  assert record["category"] == "outer"
  assert sum(len(p["surfaces"]) for p in record["parts"]) == 228
  assert (
    evidence["sourceRecordSha256"]
    == hashlib.sha256(json.dumps(record, sort_keys=True).encode()).hexdigest()
  )
  assert evidence["publishedOverallHeightM"] == 67
  assert evidence["sourceTowerHeightM"] == 48.126
  assert evidence["authoredHeightDifferenceM"] == 18.874


def test_overlay_reproduces_and_has_no_second_survey_shell() -> None:
  actual = MODULE.detail(MODULE.source_record())
  committed = json.loads(
    (ROOT / "src/app/src/data/zionskircheV174Drawn.json").read_text()
  )
  assert actual == committed
  assert "parts" not in committed and "sourceSurfaces" not in committed
  assert {s["role"] for s in committed["surfaces"]} <= set(range(1, 12))
  assert committed["spire"]["finialTopY"] == 70
  assert committed["spire"]["layers"][0][0] == 50.88


def test_reference_licenses_and_source_roofs_stay_explicit() -> None:
  evidence = json.loads(
    (ROOT / "src/app/src/data/zionskircheV174Evidence.json").read_text()
  )
  assert [r["license"] for r in evidence["visualReferences"]] == [
    "CC BY 3.0 DE",
    "CC BY-SA 4.0",
  ]
  records = json.loads(gzip.decompress(MODULE.SOURCE.read_bytes()))["buildings"]
  source = next(r for r in records if r["id"] == MODULE.PARENT)
  assert evidence["sourceRoofBoundaryPolygons"] == sum(
    s["kind"] == "RoofSurface" for p in source["parts"] for s in p["surfaces"]
  )
  assert evidence["sourceRoofBoundaryPolygons"] == 8
