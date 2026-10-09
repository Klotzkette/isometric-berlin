"""Install two disjoint, privately verified v201 terrain packet transitions."""

from __future__ import annotations

import gzip
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
BASE = "v1.0.100"


def digest(raw: bytes) -> str:
  return hashlib.sha256(raw).hexdigest()


def load(path: Path) -> dict:
  return json.loads(path.read_bytes())


def apply() -> dict:
  """Validate complete baseline and staged bytes before changing public assets."""
  manifest_path = PUBLIC / "manifest.json"
  baseline_bytes = subprocess.check_output(
    ["git", "show", f"{BASE}:{manifest_path.relative_to(ROOT)}"], cwd=ROOT
  )
  baseline = json.loads(baseline_bytes)
  olympic = load(GEO / "olympic-v201-packet-audit.json")
  wuhlheide = load(GEO / "wuhlheide-v201-packet-audit.json")
  assert olympic["baseRelease"] == wuhlheide["baselineRelease"] == BASE
  assert (
    olympic["baseManifestSha256"]
    == wuhlheide["baselineManifestSha256"]
    == digest(baseline_bytes)
  )
  specs = [
    (GEO / "olympic-v201-manifest-patch.json", GEO / "raw/olympic-v201/packets"),
    (
      GEO / "raw/wuhlheide-v201/manifest-patch.json",
      GEO / "raw/wuhlheide-v201/packets",
    ),
  ]
  before = {d["id"]: d for d in baseline["chunks"]}
  updates: dict[str, dict] = {}
  staged: dict[str, bytes] = {}
  for patch_path, stage in specs:
    for descriptor in load(patch_path)["chunks"]:
      identity = descriptor["id"]
      assert identity not in updates, (identity, "overlapping site patches")
      updates[identity] = descriptor
      if identity not in before:
        assert descriptor["detailCompanionOf"] in before
      for mode in ("drawn", "minecraft"):
        asset = descriptor[mode]
        relative = Path(asset["url"])
        assert not relative.is_absolute() and ".." not in relative.parts
        raw = (stage / relative).read_bytes()
        assert digest(raw) == asset["sha256"]
        assert len(raw) == asset["bytes"] < 650_000
        decoded = gzip.decompress(raw)
        assert len(decoded) == asset["decodedBytes"] < 2_600_000
        assert json.loads(decoded)["id"] == identity
        assert asset["url"] not in staged
        staged[asset["url"]] = raw
  result = {
    **baseline,
    "chunks": [updates.get(d["id"], d) for d in baseline["chunks"]]
    + [d for key, d in updates.items() if key not in before],
  }
  subset_path = GEO / "outskirts-v187-manifest.json"
  subset = json.loads(
    subprocess.check_output(
      ["git", "show", f"{BASE}:{subset_path.relative_to(ROOT)}"], cwd=ROOT
    )
  )
  subset_ids = {d["id"] for d in subset["chunks"]}
  new_companions = [d for key, d in updates.items() if key not in before]
  assert all(d["detailCompanionOf"] in subset_ids for d in new_companions)
  next_subset = {
    **subset,
    "chunks": [updates.get(d["id"], d) for d in subset["chunks"]] + new_companions,
  }
  result["outskirtsV187"] = {
    **baseline["outskirtsV187"],
    "chunkCount": len(next_subset["chunks"]),
  }
  assert len(result["chunks"]) <= 2048
  encoded = (json.dumps(result, separators=(",", ":")) + "\n").encode()
  assert len(encoded) < 2 * 1024 * 1024
  # Re-running an already applied transition is harmless; unknown current
  # changes are never overwritten by the immutable checkpoint.
  current = load(manifest_path)
  assert current in (baseline, result), "Public manifest has unrelated changes"
  assert load(subset_path) in (subset, next_subset), (
    "Outskirts manifest has unrelated changes"
  )
  for descriptor in current["chunks"]:
    for mode in ("drawn", "minecraft"):
      asset = descriptor[mode]
      raw = (PUBLIC / asset["url"]).read_bytes()
      assert len(raw) == asset["bytes"] and digest(raw) == asset["sha256"]
  for url, raw in staged.items():
    destination = PUBLIC / url
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".pending-v201")
    temporary.write_bytes(raw)
    temporary.replace(destination)
  manifest_path.write_bytes(encoded)
  subset_path.write_text(json.dumps(next_subset, separators=(",", ":")) + "\n")
  print(f"Installed {len(updates)} descriptors / {len(staged)} assets")
  return result


if __name__ == "__main__":
  apply()
