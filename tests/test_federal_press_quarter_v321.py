"""The finite late fitting transfer retains every original V272 source word."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_complete_original_owner_box_sources_and_independent_native_subset():
  retained_path = ROOT / "geo_data/regierungsviertel/press-quarter-v272-source.json.gz"
  retained = json.loads(gzip.decompress(retained_path.read_bytes()))
  runtime_path = ROOT / "src/app/src/data/pressQuarterV272.json"
  runtime = json.loads(runtime_path.read_bytes())
  proof = json.loads(
    gzip.decompress(
      (
        ROOT / "geo_data/regierungsviertel/federal-press-quarter-v321-evidence.json.gz"
      ).read_bytes()
    )
  )
  assert (
    proof["sourceEvidenceSha256"]
    == hashlib.sha256(retained_path.read_bytes()).hexdigest()
  )
  assert (
    proof["sourceRuntimeSha256"]
    == hashlib.sha256(runtime_path.read_bytes()).hexdigest()
  )
  assert proof["actualJscV8RecordsIdentical"] is True
  for native, field, expected in [
    (False, "facadeBoxes", 616),
    (True, "nativeBoxes", 1936),
  ]:
    rows = (
      retained["nativeBlocks"] + retained["nativeDetails"]
      if native
      else retained["facadeBoxes"]
    )
    words = [v for r in rows for v in r[:8]]
    assert struct.pack("<" + "f" * len(words), *words) == base64.b64decode(
      runtime[field]
    )
    selected = [i for i, r in enumerate(rows) if len(r) > 9 and r[9] == "32698095"]
    assert len(selected) == expected
    assert all(not (len(r) > 9 and r[9] in {"32698102", "74476580"}) for r in rows)
    record = next(r for r in proof["records"] if r["native"] is native)
    assert selected == record["selectedGlobalRows"]
    assert record["component"]["instances"]["count"] == expected
    assert (
      len(base64.b64decode(record["component"]["instances"]["matrix"])) == expected * 64
    )
    assert (
      len(base64.b64decode(record["component"]["instances"]["color"])) == expected * 12
    )
  assert runtime["sourcePartIds"][-2:] == ["DEBE3DZjmMEK2SZD", "DEBE3DUspil8YjZO"]


def test_only_the_complete_named_old_prism_is_bound_and_neither_plan_claims_voxels():
  data = json.loads(
    (ROOT / "src/app/src/data/federalMinistryPressQuarterV321.json").read_bytes()
  )
  raw = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_bytes()
  )
  old = next(p for p in raw["buildings"] if p["id"] == "32698095")
  for native, key in [(False, "drawn"), (True, "native")]:
    plan = data["plans"][key]
    assert plan["native"] is native
    assert plan["sourceBasename"] == "press-quarter-v272-source.json.gz"
    assert "nativeSource" not in plan
    assert len(plan["owners"]) == 1
    owner = plan["owners"][0]
    assert owner["id"] == "32698095" and owner["sourcePrism"] == old
    assert len(owner["components"]) == 1
    assert owner["components"][0]["kind"] == "instances"
    assert owner["components"][0]["retire"] is True


def test_reproduction_uses_actual_constructor_and_explicit_distinct_engines():
  script = (ROOT / "src/app/scripts/capture-federal-press-quarter-v321.ts").read_text()
  template = json.loads(
    (ROOT / "src/app/scripts/federal-press-quarter-capture-v321.json").read_bytes()
  )["entry"]
  assert 'for(const engine of["bun","node"])' in script
  assert "createPressQuarterV272(native)" in template
  assert "Fulloriginalowner-sourcewordidentityfailed" in template
  assert "root.clear()" in template
  provider = (ROOT / "src/app/src/FederalMinistryPressQuarterV321.ts").read_text()
  assert 'await import("./data/pressQuarterV272.json")' in provider
  assert 'import original from "./data/pressQuarterV272.json"' not in provider
  assert (
    "const prepared=new Map" in provider and "const verified=new WeakMap" in provider
  )
