"""Source immutability and explicit museum correction boundaries."""

import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
  "charite_v265", ROOT / "scripts/build_charite_campus_v265.py"
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def test_complete_source_snapshot_is_reproducible() -> None:
  committed = json.loads(MODULE.DEST.read_text())
  assert MODULE.build() == committed
  assert len(committed["parts"]) == 32
  assert (
    committed["sourceSha256"]
    == hashlib.sha256((ROOT / MODULE.SOURCE).read_bytes()).hexdigest()
  )


def test_museum_guard_is_exact_and_legacy_recipe_remains() -> None:
  receipt = json.loads(
    (
      ROOT / "geo_data/regierungsviertel/charite-campus-v265-preservation.json"
    ).read_text()
  )
  groups = receipt["retiredWindowGroups"]
  assert len(groups) == 19
  assert {g["sourceId"] for g in groups} == {"gwXjAt32"}
  assert {g["wall"]["index"] for g in groups} == {14, 16}
  assert MODULE.build()["museumVitrineHeightM"] == 6
