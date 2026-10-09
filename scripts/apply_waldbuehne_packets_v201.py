"""Install the verified Waldbuehne owner transfer after v201 terrain staging."""

from __future__ import annotations

import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"


def apply() -> None:
  audit = json.loads((GEO / "waldbuehne-v201-packet-audit.json").read_bytes())
  before = {d["id"]: d for d in audit["baselineDescriptors"]}
  after = {d["id"]: d for d in audit["replacementDescriptors"]}
  assert set(before) == set(after)
  staged = {}
  for d in after.values():
    for mode in ("drawn", "minecraft"):
      asset = d[mode]
      url = Path(asset["url"])
      assert not url.is_absolute() and ".." not in url.parts
      raw = (GEO / "raw/waldbuehne-v201/packets" / url).read_bytes()
      assert len(raw) == asset["bytes"] < 650_000
      assert hashlib.sha256(raw).hexdigest() == asset["sha256"]
      plain = gzip.decompress(raw)
      assert len(plain) == asset["decodedBytes"] < 2_600_000
      assert json.loads(plain)["id"] == d["id"]
      staged[url] = raw
  manifests = {}
  for path in (PUBLIC / "manifest.json", GEO / "outskirts-v187-manifest.json"):
    manifest = json.loads(path.read_bytes())
    current = {d["id"]: d for d in manifest["chunks"]}
    assert all(current[k] in (before[k], after[k]) for k in before)
    # Validate every current reference before any replacement is written.
    for d in current.values():
      for mode in ("drawn", "minecraft"):
        asset = d[mode]
        raw = (PUBLIC / asset["url"]).read_bytes()
        assert len(raw) == asset["bytes"]
        assert hashlib.sha256(raw).hexdigest() == asset["sha256"]
    manifests[path] = {
      **manifest,
      "chunks": [after.get(d["id"], d) for d in manifest["chunks"]],
    }
  for url, raw in staged.items():
    path = PUBLIC / url
    pending = path.with_suffix(path.suffix + ".pending-v201")
    pending.write_bytes(raw)
    pending.replace(path)
  for path, manifest in manifests.items():
    path.write_text(json.dumps(manifest, separators=(",", ":")) + "\n")
  print(f"Installed exact Waldbuehne transfer in {len(after)} descriptors")


if __name__ == "__main__":
  apply()
