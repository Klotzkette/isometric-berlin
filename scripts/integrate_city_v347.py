"""Append finite V347 details and Frohnau while retaining every published tile."""

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
BASELINE = "84d3c452"


def sha(data: bytes) -> str:
  return hashlib.sha256(data).hexdigest()


def wire(value: object) -> bytes:
  return (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


def integrate() -> None:
  raw = subprocess.check_output(
    [
      "git",
      "show",
      BASELINE + ":src/app/public/mesh/surrounding-berlin-v159/manifest.json",
    ],
    cwd=ROOT,
  )
  prior, current = json.loads(raw), json.loads(raw)
  identities = {c["id"] for c in prior["chunks"]}
  added: list[str] = []
  for label, filename, directory in [
    ("ber347", "ber-fittings-v347-manifest.json", "ber-fittings-v347/packets"),
    ("sacred347", "sacred-places-v347-manifest.json", "sacred-places-v347/packets"),
    (
      "buddhist347",
      "buddhist-frohnau-v347-manifest.json",
      "buddhist-frohnau-v347/packets",
    ),
  ]:
    source = GEO / filename
    supplement = json.loads(source.read_bytes())
    for chunk in supplement["chunks"]:
      assert chunk["id"].startswith(label + "-") and chunk["id"] not in identities
      identities.add(chunk["id"])
      for mode in ("drawn", "minecraft"):
        descriptor = chunk[mode]
        path = GEO / "raw" / directory / descriptor["url"]
        data = path.read_bytes()
        decoded = gzip.decompress(data)
        assert len(data) == descriptor["bytes"] and sha(data) == descriptor["sha256"]
        assert len(decoded) == descriptor["decodedBytes"]
        packet = json.loads(decoded)
        assert packet.get("id", chunk["id"]) == chunk["id"]
        assert packet["schemaVersion"] == 1 and len(packet["origin"]) == 3
        assert len(data) <= 4 * 1024**2 and len(decoded) <= 12 * 1024**2
        shutil.copyfile(path, PUBLIC / descriptor["url"])
        added.append(descriptor["url"])
      current["chunks"].append(chunk)
    current["footprint"].extend(supplement["footprint"])
    current[label + "V347"] = dict(
      sourceFile=filename,
      sourceSha256=sha(source.read_bytes()),
      chunks=[c["id"] for c in supplement["chunks"]],
    )
  for chunk in prior["chunks"]:
    for mode in ("drawn", "minecraft"):
      d = chunk[mode]
      data = (PUBLIC / d["url"]).read_bytes()
      assert len(data) == d["bytes"] and sha(data) == d["sha256"], d["url"]
  assert current["chunks"][: len(prior["chunks"])] == prior["chunks"]
  assert current["footprint"][: len(prior["footprint"])] == prior["footprint"]
  data = wire(current)
  # Public files can be hard-linked into older local packages: replace atomically.
  temporary = PUBLIC / "manifest.v347.tmp"
  temporary.write_bytes(data)
  temporary.replace(PUBLIC / "manifest.json")
  proof = dict(
    baseline=BASELINE,
    previousManifestSha256=sha(raw),
    manifestSha256=sha(data),
    preservedChunks=len(prior["chunks"]),
    newChunks=len(current["chunks"]) - len(prior["chunks"]),
    newFiles=added,
    newPacketBytes=sum((PUBLIC / name).stat().st_size for name in added),
    newFootprints=len(current["footprint"]) - len(prior["footprint"]),
    policy="Every published v226 packet byte, descriptor and source footprint retained; finite V347 additions only. All six modes and existing live limits remain unchanged.",
  )
  (GEO / "city-coverage-v347-receipt.json").write_bytes(wire(proof))
  print({k: v for k, v in proof.items() if k != "newFiles"})


if __name__ == "__main__":
  integrate()
