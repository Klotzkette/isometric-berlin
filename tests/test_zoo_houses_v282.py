"""Complete measured house-source replay, independent of runtime visibility."""

import gzip
import json

import pytest
from shapely.geometry import Polygon, box

from scripts.build_zoo_houses_v282 import (
  DATA,
  EVIDENCE,
  OFFSET,
  RECEIPT,
  ROOT,
  RUNTIME,
  build,
  digest,
  encode,
)


@pytest.fixture(scope="module")
def replay() -> tuple[dict, dict, dict]:
  """Regenerate from original LoD2, previous native rows and OSM witnesses."""
  return build()


def test_exact_source_replay(replay: tuple[dict, dict, dict]) -> None:
  runtime, receipt, evidence = replay
  assert RUNTIME.read_bytes() == encode(runtime)
  assert RECEIPT.read_bytes() == encode(receipt)
  assert gzip.decompress(EVIDENCE.read_bytes()) == encode(evidence)
  for relative, sha in evidence["preservedInputs"].items():
    assert digest(ROOT / relative) == sha


def test_basements_preserved_with_one_rigid_offset(
  replay: tuple[dict, dict, dict],
) -> None:
  runtime, _, evidence = replay
  source = [p for parent in evidence["parents"] for p in parent["parts"]]
  assert len(source) == len(runtime["penguin"]["parts"]) == 4
  assert len(runtime["penguin"]["surfaces"]) == 263
  assert OFFSET == pytest.approx(1.510)
  for original, part in zip(source, runtime["penguin"]["parts"], strict=True):
    assert part["id"] == original["id"]
    assert part["ring"] == original["ring"]
    assert part["holes"] == original["holes"]
    assert part["minY"] == pytest.approx(original["ground_y_m"] + OFFSET)
    assert part["maxY"] == pytest.approx(original["top_y_m"] + OFFSET)
    assert len(original["surfaces"]) == len(
      [s for s in runtime["penguin"]["surfaces"] if s["owner"] == part["id"]]
    )
  assert min(p["minY"] for p in runtime["penguin"]["parts"]) == -0.131
  assert max(p["maxY"] for p in runtime["penguin"]["parts"]) == 12.018
  assert 12.018 - runtime["penguin"]["groundY"] == pytest.approx(6.818)


def test_native_receipt_is_complete_and_exclusive(
  replay: tuple[dict, dict, dict],
) -> None:
  runtime, receipt, _ = replay
  assert len(receipt["columns"]) == 45
  assert len({tuple(c) for c in receipt["columns"]}) == 45
  assert receipt["retainedSharedColumns"] == []
  assert len(runtime["penguin"]["nativeRows"]) == 340
  for x, y, z, w, h, d, _ in runtime["penguin"]["nativeRows"]:
    assert min(w, h, d) > 0
    for center, size in [(x, w), (y, h), (z, d)]:
      assert center - size / 2 == round(center - size / 2)
      assert center + size / 2 == round(center + size / 2)


def test_brehm_full_existing_body_and_real_entrance_witnesses(
  replay: tuple[dict, dict, dict],
) -> None:
  runtime, _, _ = replay
  east = json.loads(
    (ROOT / "geo_data/regierungsviertel/east-landmarks-v187-evidence.json").read_bytes()
  )
  source = next(
    p for p in east["sourceProfiles"] if p["id"] == runtime["brehm"]["sourceId"]
  )["parts"][0]
  assert runtime["brehm"]["ring"] == source["ring"]
  assert len(source["ring"]) == 124
  assert runtime["brehm"]["topY"] == 11.071
  assert runtime["brehm"]["packetId"] == "outer187-21_4"
  assert len(runtime["penguin"]["entries"]) == 2
  assert len(runtime["brehm"]["entries"]) == 3
  for entry in runtime["penguin"]["entries"] + runtime["brehm"]["entries"]:
    assert entry["sourceId"].startswith("node/")
    assert entry["offsetDistance"] < 3
  # Existing complete shell/navigation inputs are untouched by recognition.
  assert (DATA / "eastLandmarksV187Navigation.json").exists()


def test_additive_aviary_preserves_all_source_planes_and_existing_owners(
  replay: tuple[dict, dict, dict],
) -> None:
  runtime, receipt, evidence = replay
  aviary, source = runtime["aviary"], evidence["aviary"]["original"]
  assert source["id"] == "DEBE01YYK0003Uqa"
  assert evidence["aviary"]["retiredOwners"] == []
  assert evidence["aviary"]["displayOffsetY"] == pytest.approx(0.885)
  assert aviary["ring"] == source["ring"]
  assert aviary["holes"] == source["holes"] == []
  assert len(aviary["surfaces"]) == len(source["surfaces"]) == 5
  assert aviary["maxY"] - aviary["minY"] == pytest.approx(3.430)
  for old, new in zip(source["surfaces"], aviary["surfaces"], strict=True):
    assert new["kind"] == old["kind"]
    for before, after in zip(old["rings"], new["rings"], strict=True):
      assert len(before) == len(after) == 4
      for (x, y, z), (nx, ny, nz) in zip(before, after, strict=True):
        assert (x, z) == (nx, nz)
        assert ny - y == pytest.approx(0.885)
  # The pre-existing coarse main-house column clips a corner. Retain it and
  # make the route avoid its full visible footprint, rather than deleting it.
  assert [p["id"] for p in aviary["retainedPrisms"]] == ["17957388"]
  assert aviary["retainedNativeColumns"] == [[-605, 299, 52, 172, 3]]
  area = Polygon(aviary["ring"])
  assert area.intersection(box(-2420, 1196, -2416, 1200)).area > 0
  assert "17957388" not in {p["id"] for p in receipt["previousPrisms"]}
  assert aviary["retainedNativeColumns"][0] not in receipt["columns"]
