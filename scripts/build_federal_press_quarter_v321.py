"""Compile only the exact old X8 fitting family from real JSC/V8 V272 captures."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_SHA = "7dfa3c8c9cf641181382259c8895784afac1d672f346a8373803788d243cc84b"
RUNTIME_SHA = "59b1683bf76f44e31989440d1c3595ee38b773b643538257d9f98bd7e3a89c91"


def compile_capture(folder: Path) -> tuple[dict, dict]:
  captures = []
  for engine in ("bun", "node"):
    path = folder / (engine + ".json")
    if path.is_symlink() or not path.is_file() or path.stat().st_size > 2_000_000:
      raise ValueError("Bounded ordinary actual capture required")
    captures.append(json.loads(path.read_bytes()))
  first, second = captures
  if (
    not first["engine"].get("bun")
    or second["engine"].get("bun")
    or not second["engine"].get("v8")
  ):
    raise ValueError("Actual distinct JSC/V8 constructors required")
  if first["records"] != second["records"] or len(first["records"]) != 2:
    raise ValueError("Complete actual engine words differ")
  for data in captures:
    if (
      data["sourceEvidenceSha256"] != SOURCE_SHA
      or data["sourceRuntimeSha256"] != RUNTIME_SHA
    ):
      raise ValueError("Unknown original V272 source")
  prism_file = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  original = next(
    p for p in json.loads(prism_file.read_bytes())["buildings"] if p["id"] == "32698095"
  )
  plans = {}
  for record in first["records"]:
    native = record["native"]
    if type(native) is not bool or record["sourcePrism"] != original:
      raise ValueError("Full original prism identity required")
    component, expected = record["component"], 1936 if native else 616
    if (
      component["kind"] != "instances"
      or component["retire"] is not True
      or component["instances"]["count"] != expected
    ):
      raise ValueError("Complete exact fitting subset required")
    if len(set(record["selectedGlobalRows"])) != expected:
      raise ValueError("Duplicate/missing actual original row")
    key = "native" if native else "drawn"
    if key in plans:
      raise ValueError("Duplicate presentation family")
    plans[key] = {
      "schemaVersion": 1,
      "native": native,
      "sourceBasename": "press-quarter-v272-source.json.gz",
      "owners": [
        {"id": "32698095", "sourcePrism": original, "components": [component]}
      ],
    }
  if set(plans) != {"drawn", "native"}:
    raise ValueError("Both presentations required")
  proof = {
    "schemaVersion": 1,
    "sourceEvidenceSha256": SOURCE_SHA,
    "sourceRuntimeSha256": RUNTIME_SHA,
    "actualJscV8RecordsIdentical": True,
    "records": first["records"],
    "selectionPolicy": "Exact tenth field owner32698095; other2obsoleteX8ownerszero; originalV272sourceandall13measuredpartsretained",
  }
  return {"schemaVersion": 1, "plans": plans}, proof


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--capture-dir", type=Path, required=True)
  args = parser.parse_args()
  data, proof = compile_capture(args.capture_dir)
  (ROOT / "src/app/src/data/federalMinistryPressQuarterV321.json").write_text(
    json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n"
  )
  raw = (json.dumps(proof, separators=(",", ":")) + "\n").encode()
  path = ROOT / "geo_data/regierungsviertel/federal-press-quarter-v321-evidence.json.gz"
  path.write_bytes(gzip.compress(raw, mtime=0))
  print(hashlib.sha256(raw).hexdigest())


if __name__ == "__main__":
  main()
