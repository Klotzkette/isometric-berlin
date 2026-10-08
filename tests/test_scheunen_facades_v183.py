"""Bounded source preservation for the small v183 Scheunen facade addition."""

import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
SOURCE_PATH = ROOT / "geo_data/regierungsviertel/scheunenviertel-v168.json"
SOURCE = json.loads(SOURCE_PATH.read_text())
EVIDENCE = json.loads(
  (ROOT / "geo_data/regierungsviertel/scheunen-facades-v183-evidence.json").read_text()
)
DRAWN = json.loads((DATA / "scheunenFacadesV183.json").read_text())
NATIVE = json.loads((DATA / "scheunenFacadesV183Native.json").read_text())


def test_exact_unique_source_faces_and_small_surface_only_budget() -> None:
  owners = {
    b["id"]: b
    for name in ["buildings", "retainedDetailedBuildings"]
    for b in SOURCE[name]
  }
  assert len(EVIDENCE["faces"]) == 97
  assert len({f["parentId"] for f in EVIDENCE["faces"]}) == 97
  for face in EVIDENCE["faces"]:
    parent = owners[face["parentId"]]
    part = next(p for p in parent["parts"] if p["id"] == face["partId"])
    assert any(
      s["kind"] == "WallSurface" and s["rings"] == face["rings"]
      for s in part["surfaces"]
    )
    assert face["parentId"] not in SOURCE["excludedDetailedOwners"]
  assert (
    EVIDENCE["sourceSha256"] == hashlib.sha256(SOURCE_PATH.read_bytes()).hexdigest()
  )
  assert len(DRAWN["boxes"]) == 370
  assert len(NATIVE["nativeRows"]) == 2262
  assert (DATA / "scheunenFacadesV183.json").stat().st_size < 30_000
  assert (DATA / "scheunenFacadesV183Native.json").stat().st_size < 160_000
  assert all(r[5] <= 0.37 for r in DRAWN["boxes"])
  assert all(r[4] <= 0.7 for r in NATIVE["nativeRows"])


def test_reproducible_without_rewriting_any_streamed_packet() -> None:
  spec = importlib.util.spec_from_file_location(
    "scheunen183", ROOT / "scripts/build_scheunen_facades_v183.py"
  )
  assert spec and spec.loader
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  result = module.build(SOURCE)
  assert result.pop("faces") == EVIDENCE["faces"]
  assert result.pop("nativeRows") == NATIVE["nativeRows"]
  assert result == DRAWN
