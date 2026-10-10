"""Later named facades must retain priority over the v213 generic appearance."""

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
  "alt_mitte_protection_v213", ROOT / "scripts/build_alt_mitte_protection_v213.py"
)
assert SPEC and SPEC.loader
PROTECTION = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PROTECTION)


def test_authored_protection_reproduces_exact_bounded_receipts():
  published = json.loads(PROTECTION.OUTPUT.read_text())
  assert PROTECTION.build() == published
  assert len(published["ids"]) < 2000
  assert all(
    "alt-mitte-v169/source-" not in row["file"] for row in published["evidence"]
  )


def test_late_named_owners_and_short_core_aliases_are_protected():
  ids = set(PROTECTION.build()["ids"])
  for filename in (
    "centralSitesV200.json",
    "labourQuartierV208.json",
    "librariesV202.json",
  ):
    data = json.loads((ROOT / "src/app/src/data" / filename).read_text())
    for owner in data["owners"]:
      assert owner["id"] in ids
      if owner["id"].startswith("DEBE"):
        assert owner["id"][-8:] in ids
      if "parentId" in owner:
        assert owner["parentId"] in ids
  assert {"DEBE01YYK00001YG", "K00001YG", "7b3ZwNAB"} <= ids


def test_osm_aliases_keep_way_and_relation_identity_distinct():
  assert PROTECTION.aliases({"way/123"}) == {"way/123", "OSM-way-123", "123"}
  assert PROTECTION.aliases({"OSM-relation-123"}) == {
    "relation/123",
    "OSM-relation-123",
    "-123",
  }
  assert (
    PROTECTION.named_ids({"description": "DEBE owner next door", "colour": "DEBE"})
    == set()
  )
