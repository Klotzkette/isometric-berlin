"""Complete city inventory and independently retained source/triangle guards."""

import hashlib
import json

import pytest

from scripts import build_primary_colours_v273 as builder


def test_complete_primary_inventory_and_unmodified_inputs():
  audit = builder.prior.base.read_json(builder.AUDIT)
  descriptors = builder.primary_tiles()
  assert len(descriptors) == 1635
  assert len(audit["packets"]) == 2 * len(descriptors)
  for descriptor in descriptors:
    for mode in ("drawn", "minecraft"):
      source = builder.OUT / descriptor[mode]["url"]
      digest = hashlib.sha256(source.read_bytes()).hexdigest()
      assert digest == descriptor[mode]["sha256"]
      assert digest == audit["packets"][f"{mode}:{descriptor['id']}"]["sha256"]


def test_shards_are_complete_bounded_and_deterministic():
  audit = builder.prior.base.read_json(builder.AUDIT)
  index = builder.prior.base.read_json(builder.INDEX)
  seen = set()
  for shard in range(builder.SHARDS):
    path = builder.APP / f"primaryColoursV273_{shard:02}.json"
    raw = path.read_bytes()
    bank = json.loads(raw)
    assert len(raw) < 5 * 1024**2
    assert hashlib.sha256(raw).hexdigest() == audit["outputs"][path.name]["sha256"]
    assert bank["keys"] == list(bank["packets"])
    for key, plan in bank["packets"].items():
      assert index[key] == builder.shard_for(key) == shard
      assert key not in seen
      seen.add(key)
      assert plan["records"]
      assert not audit["packets"][key]["previous"]
  assert seen == set(index)


@pytest.mark.parametrize("shard", range(builder.SHARDS))
def test_all_source_incident_triangle_receipts_reproduce(shard):
  bank = builder.prior.base.read_json(
    builder.APP / f"primaryColoursV273_{shard:02}.json"
  )
  proof = builder.prior.base.read_json(
    builder.GEO / f"primary-colours-v273-proof-{shard:02}.json.gz"
  )
  descriptors = {row["id"]: row for row in builder.primary_tiles()}
  for key, plan in bank["packets"].items():
    mode, tile = key.split(":")
    packet = builder.prior.base.read_json(builder.OUT / descriptors[tile][mode]["url"])
    assert builder.prior.nav_fingerprint(packet["nav"]) == plan["guard"]
    assert packet["origin"] == plan["origin"]
    for record, evidence in zip(plan["records"], proof[key], strict=True):
      part = packet["meshes"][record["mesh"]]
      rows, actual = builder.prior.analyse(packet, part)
      decoded = [[row[0], record["owners"][row[1]], *row[2:]] for row in record["rows"]]
      assert rows == decoded
      assert actual == {k: v for k, v in evidence.items() if k != "mesh"}
      assert record["fingerprint"] == builder.prior.fingerprint(
        [part["positions"], part["colors"], part["indices"]]
      )
