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
  assert path.stat().st_size <= 2 * 1024 * 1024

  # Immutable previous descriptor hashes are checked against actual public bytes,
  # so retaining old metadata alone cannot conceal removed or altered detail.
  for chunk in current["chunks"]:
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
  return added
