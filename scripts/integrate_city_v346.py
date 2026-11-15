"""Publish additive Kladow/Tegel tiles while proving every v225 tile unchanged."""

from __future__ import annotations

import gzip
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
BASELINE = "daa0c5e372f6c86147dd89962da3fdbd2947e861"


def sha(b):
  return hashlib.sha256(b).hexdigest()


def wire(v):
  return (json.dumps(v, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


def write_ground_scope(prior, current):
  """Only new mapped territory; preserve earlier relief and source-ground owners."""
  footprint = current["footprint"][len(prior["footprint"]):]
  assert current["groundY"] == prior["groundY"] == 3
  scope = dict(schemaVersion=1, groundY=3, footprint=footprint)
  target = ROOT / "src/app/src/data/addedCityScopeV346.json"
  target.write_bytes(wire(scope))


def integrate():
  raw = subprocess.check_output(
    [
      "git",
      "show",
      BASELINE + ":src/app/public/mesh/surrounding-berlin-v159/manifest.json",
    ],
    cwd=ROOT,
  )
  prior = json.loads(raw)
  result = json.loads(raw)
  old = {c["id"]: c for c in prior["chunks"]}
  added = []
  for label, filename, directory in [
    ("kladow346", "kladow-airfield-v346-manifest.json", "kladow-v346"),
    ("tegel346", "tegel-airfield-v346-manifest.json", "airfields-v346"),
  ]:
    source = GEO / filename
    supplement = json.loads(source.read_bytes())
    for chunk in supplement["chunks"]:
      assert chunk["id"].startswith(label + "-") and chunk["id"] not in old
      for mode in ["drawn", "minecraft"]:
        d = chunk[mode]
        path = GEO / "raw" / directory / "packets" / d["url"]
        data = path.read_bytes()
        decoded = gzip.decompress(data)
        assert (
          len(data) == d["bytes"]
          and sha(data) == d["sha256"]
          and len(decoded) == d["decodedBytes"]
        )
        assert json.loads(decoded)["id"] == chunk["id"]
        assert len(data) <= 4 * 1024**2 and len(decoded) <= 12 * 1024**2
        shutil.copyfile(path, PUBLIC / d["url"])
        added.append(d["url"])
      result["chunks"].append(chunk)
    result["footprint"].extend(supplement["footprint"])
    # Both additions lie within the existing approved presentation envelope.
    assert (
      result["bounds"][0] <= supplement["bounds"][0]
      and result["bounds"][1] <= supplement["bounds"][1]
      and result["bounds"][2] >= supplement["bounds"][2]
      and result["bounds"][3] >= supplement["bounds"][3]
    )
    result[label + "V346"] = dict(
      sourceFile=filename,
      sourceSha256=sha(source.read_bytes()),
      source=supplement["source"],
      chunks=[c["id"] for c in supplement["chunks"]],
    )
  for c in prior["chunks"]:
    for mode in ["drawn", "minecraft"]:
      d = c[mode]
      b = (PUBLIC / d["url"]).read_bytes()
      assert len(b) == d["bytes"] and sha(b) == d["sha256"], d["url"]
  assert (
    result["chunks"][: len(old)] == prior["chunks"]
    and result["footprint"][: len(prior["footprint"])] == prior["footprint"]
  )
  data = wire(result)
  (PUBLIC / "manifest.json").write_bytes(data)
  write_ground_scope(prior, result)
  proof = dict(
    baseline=BASELINE,
    previousManifestSha256=sha(raw),
    manifestSha256=sha(data),
    preservedChunks=len(old),
    newChunks=len(result["chunks"]) - len(old),
    newFiles=added,
    newPacketBytes=sum((PUBLIC / n).stat().st_size for n in added),
    policy="Every v225 descriptor, complete packet byte, footprint, bound and source remains; exact new Kladow and Tegel source polygons only. No runtime detail or residency limit changed.",
  )
  (GEO / "city-coverage-v346-receipt.json").write_bytes(wire(proof))
  print({k: v for k, v in proof.items() if k != "newFiles"})


if __name__ == "__main__":
  integrate()
