"""Admit the nine park-path packets whose only source change was a disjoint sports mesh."""

import base64
import gzip
import hashlib
import json
import subprocess
from pathlib import Path

import numpy as np
from build_rixdorf_v304 import fingerprint
from shapely.geometry import Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
ORIGINAL = "3d621f17f7f1eaf5fff27ad8ef3872e00c25bfbd"
DATA = ROOT / "src/app/src/data"


def footprint(part):
  vertices = np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(-1, 3)
  indices = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
  points = vertices[:, [0, 2]] / 100
  return unary_union(
    [polygon for tri in indices if (polygon := Polygon(points[tri])).area]
  )


def unpack(raw):
  return json.loads(gzip.decompress(raw) if raw.startswith(b"\x1f\x8b") else raw)


def main():
  evidence = unpack(
    (ROOT / "geo_data/regierungsviertel/park-paths-v329-source.json.gz").read_bytes()
  )
  plans = json.loads((DATA / "parkPathsV329Packets.json").read_bytes())["packets"]
  records = {}
  for key, plan in plans.items():
    source = evidence["packets"][key]
    path = Path("src/app/public/mesh/surrounding-berlin-v159") / source["path"]
    current = unpack((ROOT / path).read_bytes())
    if len(current["meshes"]) == len(plan["records"]):
      continue
    old_bytes = subprocess.check_output(["git", "show", f"{ORIGINAL}:{path}"], cwd=ROOT)
    historical = unpack(old_bytes)
    assert hashlib.sha256(old_bytes).hexdigest() == source["sha256"]
    parts = current["meshes"]
    assert len(parts) == 2 and len(plan["records"]) == 1
    assert historical == {**current, "meshes": parts[:1]}
    assert plan["records"][0]["fingerprint"] == fingerprint(parts[0])
    assert parts[1]["kind"] == "mapped-sports-surfaces"
    assert footprint(plan["append"]).intersection(footprint(parts[1])).area == 0
    records[key] = fingerprint(parts[1])
  assert len(records) == 9
  (DATA / "parkPathSportsHostsV368.json").write_text(
    json.dumps(records, indent=2, sort_keys=True) + "\n"
  )


if __name__ == "__main__":
  main()
