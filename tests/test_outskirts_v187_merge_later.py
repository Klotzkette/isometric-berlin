"""Rebuilding an older independent layer must preserve newer queue ordering."""

import copy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_outskirts_v187 as builder  # noqa: E402


def test_repeat_merge_keeps_late_chunks_and_footprints_in_their_positions() -> None:
  original = {
    "bounds": [0, 0, 20, 20],
    "chunks": [{"id": "core", "asset": "unchanged"}],
    "footprint": [{"ring": "core", "holes": ["courtyard"]}],
    "source": {"inventory": "retained-core"},
  }
  supplement = {
    "bounds": [-10, -10, 30, 30],
    "chunks": [{"id": "outer187-a", "asset": "a"}, {"id": "outer187-b", "asset": "b"}],
    "footprint": [{"ring": "outer-a"}, {"ring": "outer-b", "holes": ["lake-island"]}],
    "source": {"inventory": "outer187"},
  }
  current = builder.merge_manifest(original, supplement)
  current["chunks"].insert(
    2,
    {"id": "late-between", "detailCompanionOf": "outer187-a", "asset": "keep-between"},
  )
  current["chunks"].append({"id": "district188-tail", "asset": "keep-tail"})
  current["footprint"].append({"ring": "later-extension", "holes": ["later-water"]})
  current["laterRelease"] = {"identity": "untouched", "source": ["later-source"]}
  snapshot = copy.deepcopy(current)
  supplement_snapshot = copy.deepcopy(supplement)
  merged = builder.merge_manifest(current, supplement)
  assert merged == current == snapshot
  assert supplement == supplement_snapshot
  assert [c["id"] for c in merged["chunks"]] == [
    "core",
    "outer187-a",
    "late-between",
    "outer187-b",
    "district188-tail",
  ]
  assert merged["footprint"][3] == {"ring": "later-extension", "holes": ["later-water"]}
  assert merged["outskirtsV187"]["retainedFootprintCount"] == 1

  # A refresh can replace an owned asset and append a new owned tile while all
  # unrelated values and their relative ordering remain intact.
  changed = copy.deepcopy(supplement)
  changed["chunks"][0]["asset"] = "new-a"
  changed["chunks"].append({"id": "outer187-c", "asset": "new-c"})
  changed["footprint"][0] = {"ring": "revised-outer-a"}
  refreshed = builder.merge_manifest(current, changed)
  assert [c["id"] for c in refreshed["chunks"]] == [
    "core",
    "outer187-a",
    "late-between",
    "outer187-b",
    "outer187-c",
    "district188-tail",
  ]
  assert refreshed["chunks"][1]["asset"] == "new-a"
  assert [c for c in refreshed["chunks"] if not c["id"].startswith("outer187-")] == [
    c for c in current["chunks"] if not c["id"].startswith("outer187-")
  ]
  assert refreshed["footprint"] == [
    current["footprint"][0],
    changed["footprint"][0],
    changed["footprint"][1],
    current["footprint"][3],
  ]
  assert refreshed["laterRelease"] == current["laterRelease"]
  assert builder.merge_manifest(refreshed, changed) == refreshed
  assert current == snapshot
