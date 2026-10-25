"""An exact append after v199, never an exception for changing old geometry."""

from __future__ import annotations

import gzip
import hashlib
import json
import subprocess
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"


@lru_cache(maxsize=1)
def audited_v200_additions() -> dict:
  """Verify the entire old inventory and accept only the finite new supplement."""
  path = PUBLIC / "manifest.json"
  old_bytes = subprocess.check_output(
    ["git", "show", f"v1.0.99:{path.relative_to(ROOT)}"], cwd=ROOT
  )
  old = json.loads(old_bytes)
  current = json.loads(path.read_bytes())
  from packet_receipts_v201 import audited_v201_changes
  from packet_receipts_v201 import baseline as baseline_v200

  audited_v201_changes()
  # Keep the v199→v200 append contract against its immutable released result;
  # the separately replayed v201 proof validates every final replacement.
  published = current
  current = json.loads(baseline_v200(path))
  evidence = json.loads((GEO / "east-city-v200-evidence.json").read_bytes())
  supplement = json.loads((GEO / "east-city-v200-manifest.json").read_bytes())
  assert evidence["baselineRelease"] == "v1.0.99"
  assert evidence["baselineManifestSha256"] == hashlib.sha256(old_bytes).hexdigest()
  assert evidence["retainedChunkCount"] == len(old["chunks"])
  assert evidence["retainedFootprintCount"] == len(old["footprint"])
  assert current["chunks"] == old["chunks"] + supplement["chunks"]
  assert current["footprint"] == old["footprint"] + supplement["footprint"]
  assert current["eastCityV200"] == {
    "retainedFootprintCount": len(old["footprint"]),
    "footprintCount": len(supplement["footprint"]),
    "chunkCount": len(supplement["chunks"]),
    "source": supplement["source"],
  }
  mutable = {"chunks", "footprint", "bounds", "eastCityV200"}
  assert {k: v for k, v in current.items() if k not in mutable} == {
    k: v for k, v in old.items() if k not in mutable
  }
  assert current["bounds"] == [
    (min if i < 2 else max)(old["bounds"][i], supplement["bounds"][i]) for i in range(4)
  ]
  added = {c["id"]: c for c in supplement["chunks"]}
  assert added and len(added) == len(supplement["chunks"])
  assert all(identity.startswith("east200-") for identity in added)
  assert not added.keys() & {c["id"] for c in old["chunks"]}
  assert len(current["chunks"]) <= 2048
  # The released v200 inventory above stays frozen; the current catalogue also
  # carries the finite v255 additions within its separately bounded envelope.
  assert path.stat().st_size <= 2176 * 1024

  # Immutable previous descriptor hashes are checked against actual public bytes,
  # so retaining old metadata alone cannot conceal removed or altered detail.
  for chunk in published["chunks"]:
    for mode in ("drawn", "minecraft"):
      asset = chunk[mode]
      raw = (PUBLIC / asset["url"]).read_bytes()
      assert len(raw) == asset["bytes"] < 5 * 1024 * 1024
      assert hashlib.sha256(raw).hexdigest() == asset["sha256"], asset["url"]
      if chunk["id"] in added:
        plain = gzip.decompress(raw)
        assert len(plain) == asset["decodedBytes"] < 12 * 1024 * 1024
        payload = json.loads(plain)
        assert payload["id"] == chunk["id"]
  asset = supplement["source"]["inventory"]
  raw = (PUBLIC / asset["url"]).read_bytes()
  assert len(raw) == asset["bytes"]
  assert hashlib.sha256(raw).hexdigest() == asset["sha256"]
  final = {c["id"]: c for c in published["chunks"]}
  return {identity: final[identity] for identity in added}


@lru_cache(maxsize=1)
def audited_v200_pre_v242_additions() -> dict:
  """Match historical manifest replays only after auditing every later receipt.

  The current supplement includes the two exact v261 Adlershof replacements.
  Older tests compare a pre-v230 manifest, so their expected descriptors must
  use the same pre-v242 lineage, retaining the independently proved v201 edits.
  Current bytes and the complete reversible later manifest chain are still
  verified; no descriptor difference or missing payload is ignored.
  """
  from scripts.spree_bridge_lineage_v242 import (
    predecessor_manifest_v242,
    predecessor_packet_bytes_v242,
  )

  additions = audited_v200_additions()
  predecessor = predecessor_manifest_v242(
    json.loads((PUBLIC / "manifest.json").read_bytes())
  )
  result = {c["id"]: c for c in predecessor["chunks"] if c["id"] in additions}
  assert result.keys() == additions.keys()
  for descriptor in result.values():
    for mode in ("drawn", "minecraft"):
      asset = descriptor[mode]
      raw = predecessor_packet_bytes_v242(PUBLIC / asset["url"])
      assert len(raw) == asset["bytes"]
      assert hashlib.sha256(raw).hexdigest() == asset["sha256"], asset["url"]
      assert len(gzip.decompress(raw)) == asset["decodedBytes"]
  return result
