"""Every Litfin-neighbour plane stays traceable to its intact source family."""

import gzip
import hashlib
import json

from scripts.build_litfin_neighbours_v215 import DEST, OWNERS, PACKET, ROOT, build


def test_litfin_neighbours_are_reproducible_and_do_not_replace_owners():
  data = json.loads(DEST.read_text())
  assert build() == data
  assert data["sourceGeometryRetained"] and data["replacementOwners"] == []
  assert {b["ownerId"] for b in data["buildings"]} == set(OWNERS)
  for receipt in data["sourceReceipts"]:
    assert (
      hashlib.sha256((ROOT / receipt["path"]).read_bytes()).hexdigest()
      == receipt["sha256"]
    )


def test_neighbour_planes_and_complete_part_identity_match_source():
  originals = {
    b["id"]: b for b in json.loads(gzip.decompress(PACKET.read_bytes()))["buildings"]
  }
  data = json.loads(DEST.read_text())
  assert [len(b["partIds"]) for b in data["buildings"]] == [3, 2, 2]
  for b in data["buildings"]:
    owner = originals[b["ownerId"]]
    assert b["partIds"] == [p["id"] for p in owner["parts"]]
    for wall in b["walls"]:
      part = next(p for p in owner["parts"] if p["id"] == wall["sourcePartId"])
      face = next(
        s for s in part["surfaces"] if s["sourcePolygonId"] == wall["sourcePolygonId"]
      )
      assert face["kind"] == "WallSurface"
      assert wall["ring"] == face["rings"][0]
      assert wall["wallBaseY"] == min(p[1] for p in wall["ring"])
  # No tower, street, hospital, additional courtyard mass or regional geometry.
  assert len(data["buildings"]) == 3
