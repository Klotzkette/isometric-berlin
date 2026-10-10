"""The historical chain accepts only a fully proven exact-owner v205 transfer."""

import base64
import copy
import gzip
import json

import numpy as np
import pytest
from packet_receipts_v205 import (
  GEO,
  PUBLIC,
  audit,
  audited_v205_changes,
  baseline,
  digest,
  packed_json,
  predecessor_v205,
)


def test_all_fourteen_live_packets_return_byte_exact_v104_predecessors():
  changes, checkpoints = audited_v205_changes()
  assert len(changes) == len(checkpoints) == 14
  for path, previous in checkpoints.items():
    assert predecessor_v205(path) == previous == baseline(path)
    assert previous != path.read_bytes()
  assert predecessor_v205(PUBLIC / "manifest.json") == baseline(
    PUBLIC / "manifest.json"
  )


@pytest.mark.parametrize("field", ["unrelated_triangle", "replacement_height"])
def test_forged_current_hashes_cannot_hide_geometry_or_navigation_loss(field):
  receipt = json.loads((GEO / "religious-sites-v205-packet-patch.json").read_bytes())
  manifest = json.loads((PUBLIC / "manifest.json").read_bytes())
  chunk = receipt["chunks"][0]
  mode = "drawn"
  asset = chunk["descriptor"][mode]
  path = PUBLIC / asset["url"]
  payload = json.loads(gzip.decompress(path.read_bytes()))
  if field == "unrelated_triangle":
    mesh = next(m for m in payload["meshes"] if m["kind"] == "city")
    indices = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(
      -1, 3
    )
    mesh["indices"] = base64.b64encode(indices[1:].tobytes()).decode()
  else:
    row = next(
      b
      for b in payload["nav"]["buildings"]
      if b.get("refinement") == "religious-sites-v205"
    )
    row["height"] += 1
    chunk["modes"][mode]["addedNavigationRecords"][0]["height"] += 1
  plain = packed_json(payload)
  data = gzip.compress(plain, mtime=0)
  asset.update(bytes=len(data), decodedBytes=len(plain), sha256=digest(data))
  chunk["modes"][mode].update(
    newBytes=len(data), newDecodedBytes=len(plain), newSha256=digest(data)
  )
  for descriptor in manifest["chunks"]:
    if descriptor["id"] == chunk["id"]:
      descriptor[mode] = copy.deepcopy(asset)
  with pytest.raises(AssertionError):
    audit(receipt, manifest, lambda p: data if p == path else p.read_bytes())


@pytest.mark.parametrize("omit", ["packet", "mode"])
def test_missing_receipt_scope_cannot_skip_a_published_packet(omit):
  receipt = json.loads((GEO / "religious-sites-v205-packet-patch.json").read_bytes())
  manifest = json.loads((PUBLIC / "manifest.json").read_bytes())
  if omit == "packet":
    receipt["chunks"].pop()
  else:
    receipt["chunks"][0]["modes"].pop("minecraft")
  with pytest.raises(AssertionError):
    audit(receipt, manifest, lambda p: p.read_bytes())


def test_receipt_owner_id_cannot_be_bound_to_another_shape_or_height():
  from packet_receipts_v205 import verify_owner_navigation

  receipt = json.loads((GEO / "religious-sites-v205-packet-patch.json").read_bytes())
  originals = receipt["chunks"][0]["modes"]["drawn"]["removedNavigationRecords"]
  verify_owner_navigation(list(reversed(originals)), originals)
  for field in ["sourceId", "ring", "height"]:
    forged = copy.deepcopy(originals)
    if field == "sourceId":
      forged[0][field] = originals[1]["sourceId"]
    elif field == "ring":
      forged[0][field] = copy.deepcopy(originals[1]["ring"])
    else:
      forged[0][field] += 1
    with pytest.raises(AssertionError):
      verify_owner_navigation(forged, originals)


def test_packet_transfer_cannot_change_asset_url_or_encoding():
  original = json.loads((GEO / "religious-sites-v205-packet-patch.json").read_bytes())
  manifest = json.loads((PUBLIC / "manifest.json").read_bytes())
  for field, value in [
    ("url", "unverified-new-path.json.gz"),
    ("encoding", "new-encoding"),
  ]:
    receipt = copy.deepcopy(original)
    forged_manifest = copy.deepcopy(manifest)
    chunk = receipt["chunks"][0]
    chunk["descriptor"]["drawn"][field] = value
    next(d for d in forged_manifest["chunks"] if d["id"] == chunk["id"])["drawn"][
      field
    ] = value
    with pytest.raises(AssertionError):
      audit(receipt, forged_manifest, lambda p: p.read_bytes())
