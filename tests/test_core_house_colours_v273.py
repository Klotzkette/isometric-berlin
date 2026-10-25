"""Every core source is audited; only source-bound unknown residential paint changes."""

from __future__ import annotations

import gzip
import json
from collections import defaultdict

from scripts import build_core_house_colours_v273 as module


def evidence() -> dict:
  """Read the finite immutable colour/source receipt."""
  return json.loads(gzip.decompress(module.EVIDENCE.read_bytes()))


def test_all_existing_core_parts_have_an_audited_outcome() -> None:
  data = evidence()
  source = json.loads(module.PRISMS.read_text())
  assert data["sourceParts"] == len(source["buildings"]) == 29818
  assert sum(data["counts"].values()) == 29818
  assert sum(x["auditedParts"] for x in data["regions"].values()) == 29818
  assert data["counts"]["selected"] == len(data["selected"]) == 7174
  assert data["regions"]["Moabit"]["selected"] == 2599
  assert data["regions"]["Kreuzberg"]["selected"] == 1063
  assert data["regions"]["Schöneberg"]["selected"] == 196
  for receipt in data["inputs"]:
    assert module.digest(module.ROOT / receipt["file"]) == receipt["sha256"]


def test_exact_receipts_reject_modified_geometry_or_sample_and_keep_family_colour() -> (
  None
):
  data = evidence()
  source = json.loads(module.PRISMS.read_text())["buildings"]
  runtime = json.loads(module.OUTPUT.read_text())["owners"]
  families = defaultdict(set)
  for row in data["selected"]:
    part = source[row["index"]]
    assert part["id"] == row["id"]
    assert row["function"] in module.RESIDENTIAL
    assert module.source_guard(part) == row["receipt"][:2]
    assert row["receipt"] in runtime[part["id"]]
    assert part["id"] not in data["protectedIds"]
    assert row["family"] not in data["blockedFamilies"]
    families[row["family"]].add(row["receipt"][2])
    for key in ("class", "h_dm", "y0_dm", "roof"):
      assert (
        module.source_guard(part | {key: part.get(key, 0) + 1}) != row["receipt"][:2]
      )
  assert all(len(colours) == 1 for colours in families.values())
  assert len(set(row["receipt"][2] for row in data["selected"])) == 12


def test_mapped_materials_and_coloured_or_non_residential_owners_remain_outside() -> (
  None
):
  data = evidence()
  source = json.loads(module.PRISMS.read_text())["buildings"]
  attributes = json.loads(module.ATTR.read_text())
  for row in data["selected"]:
    part = source[row["index"]]
    assert max(part["tone"]) - min(part["tone"]) < 24
    assert part["class"] == 0
    tags = (
      attributes["records"][attributes["prisms"][part["id"]]]["tags"]
      if part["id"] in attributes["prisms"]
      else {}
    )
    assert not any(
      key in tags
      for key in (
        "building:colour",
        "building:material",
        "facade:colour",
        "facade:material",
      )
    )
    if any(key in tags for key in ("roof:colour", "roof:material")):
      assert row["receipt"][3] == row["receipt"][5] == -1
  assert data["geometryChanges"] == data["newRuntimeMeshes"] == data["newGpuBytes"] == 0


def test_compiler_is_reproducible_without_rewriting_source() -> None:
  runtime, _ = module.compile_receipts()
  assert runtime == json.loads(module.OUTPUT.read_text())
