"""Prepare finite far-outer wire pins against immutable published v195.

Read-only over live packets and the manifest. Only the new source-pin file and
external preparation metadata are written; no old helper or pin is re-signed.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
ANCHOR = "9727870f79db9c6a6e9d6437668e5ac13229522f"
PIN_FILE = ROOT / "src/app/losslessSurroundingV196Sources.json"
DEFAULT_OUTPUT = Path(
  "/Users/klotzkette/Documents/Codex/2026-10-29/find-isometric-berlin/release-plan-v196/lossless-v196"
)


def sha(raw: bytes) -> str:
  return hashlib.sha256(raw).hexdigest()


def git_bytes(path: Path) -> bytes:
  return subprocess.check_output(
    ["git", "show", f"{ANCHOR}:{path.relative_to(ROOT).as_posix()}"], cwd=ROOT
  )


def prepare(count: int, output: Path, group: str = "far-outer") -> dict:
  if count not in (192, 256, 512, 768) or group not in {"far-outer", "ordinary"}:
    raise ValueError("Finite192/256/512/768-file preparation only")
  manifest_bytes = git_bytes(PUBLIC / "manifest.json")
  manifest = json.loads(manifest_bytes)
  excluded = set()
  previous = {}
  for version in [193, 194, 195]:
    path = ROOT / f"geo_data/regierungsviertel/lossless-packets-v{version}.json"
    pin = ROOT / f"src/app/losslessSurroundingV{version}Sources.json"
    previous[str(path.relative_to(ROOT))] = sha(path.read_bytes())
    previous[str(pin.relative_to(ROOT))] = sha(pin.read_bytes())
    excluded.update(r["file"] for r in json.loads(path.read_bytes())["rows"])
  candidates = []
  region_ids = set(
    "1_-7 2_-7 2_-6 3_-7 1_-8 2_-8 3_-8 7_-2 8_-3 8_-2 9_-3 9_-2 10_-3 10_-2 11_-3 11_-2 0_-5 7_-5 8_-5 8_-4 north190-3_-8 ring182-11_-2 district188-10_-2 north190-11_-2 danzigerfront244-10_-2 outer187--8_16 outer187--7_16".split()
  )
  for path in (ROOT / "src/app/src/data").glob("*.json"):
    if any(v in path.name for v in ["V303", "V304", "V305", "V306", "V307", "V308"]):
      data = json.loads(path.read_bytes())
      keys = (
        data.get("keys", list(data.get("packets", {})))
        if isinstance(data, dict)
        else []
      )
      region_ids.update(k.split(":", 1)[1] for k in keys if ":" in k)
  for descriptor in manifest["chunks"]:
    if descriptor["id"] in region_ids:
      continue
    match = re.fullmatch(
      r"outer187-(-?\d+)_(-?\d+)"
      if group == "far-outer"
      else r"(?:ring182-|district188-(?:ring182-)?)?(-?\d+)_(-?\d+)",
      descriptor["id"],
    )
    if not match:
      continue
    x, z = map(int, match.groups())
    if group == "far-outer" and (
      not (x >= 12 or x <= -14) or (-12 <= x <= -7 and 10 <= z <= 16)
    ):
      continue
    for mode in ["drawn", "minecraft"]:
      asset = descriptor.get(mode, {})
      if (
        asset.get("url") in excluded
        or asset.get("url") != f"{descriptor['id']}.{mode}.json.gz"
      ):
        continue
      candidates.append((asset["bytes"], descriptor["id"], mode, asset))
  candidates.sort(key=lambda r: (-r[0], r[1], r[2]))
  rows = []
  for _, identity, mode, a in candidates[:count]:
    path = PUBLIC / a["url"]
    before = git_bytes(path)
    if path.read_bytes() != before:
      raise ValueError("Changed immutable packet " + path.name)
    decoded = gzip.decompress(before)
    if (
      len(before) != a["bytes"]
      or sha(before) != a["sha256"]
      or len(decoded) != a["decodedBytes"]
    ):
      raise ValueError("Unmatched full manifest source " + path.name)
    rows.append(
      dict(
        file=path.name,
        gzipBytes=len(before),
        gzipSha256=sha(before),
        decodedBytes=len(decoded),
        decodedSha256=sha(decoded),
        chunkId=identity,
        mode=mode,
      )
    )
  output.mkdir(parents=True, exist_ok=True)
  pin_file = PIN_FILE if group == "far-outer" else output / "additional-pins.json"
  pin_file.write_text(json.dumps(rows, separators=(",", ":")) + "\n")
  result = dict(
    anchor=ANCHOR,
    applied=False,
    files=len(rows),
    oldWireBytes=sum(r["gzipBytes"] for r in rows),
    oldDecodedBytes=sum(r["decodedBytes"] for r in rows),
    manifestSha256=sha(manifest_bytes),
    sourcesSha256=sha(pin_file.read_bytes()),
    previousPins=previous,
    group=group,
    excludedRegionIds=sorted(region_ids),
    exclusion="Finite unchanged ordinary originals; prior193/194/195 and all303/304/305/306/307/308 whole tile IDs excluded; far-outer x>=12 or<=-14 only; no hero-renamed assets",
    candidates=len(candidates),
  )
  (output / "preparation.json").write_text(json.dumps(result, indent=2) + "\n")
  (output / "predecessor-manifest.json").write_bytes(manifest_bytes)
  return result


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--count", type=int, default=256)
  parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT)
  parser.add_argument("--group", choices=["far-outer", "ordinary"], default="far-outer")
  args = parser.parse_args()
  print(json.dumps(prepare(args.count, args.out, args.group), indent=2))
