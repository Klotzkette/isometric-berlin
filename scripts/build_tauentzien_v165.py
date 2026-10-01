"""Add exact Tauentzien street fronts/curbs to existing bounded stream packets."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from build_surrounding_outlines import ROOT, write_json
from build_west_streets_v163 import extract_source, publish

SOURCE = ROOT / "geo_data/regierungsviertel/tauentzien-v165.json"
AUDIT = ROOT / "geo_data/regierungsviertel/tauentzien-v165-audit.json"
NAMES = ("Tauentzienstraße",)


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--out", type=Path, default=Path("/tmp/tauentzien-v165"))
  parser.add_argument("--refresh-source", action="store_true")
  args = parser.parse_args()
  if args.refresh_source or not SOURCE.exists():
    source = extract_source(NAMES)
    assert not source["buildings"], (
      "This additive pass must not replace an outer source owner"
    )
    reserved = set()
    for name in [
      "westSquaresV163Source",
      "breitscheidTowersSource",
      "huthmacherSource",
    ]:
      path = ROOT / f"src/app/src/data/{name}.json"
      if path.exists():
        data = json.loads(path.read_text())
        reserved.update(p["id"] for p in data.get("legacyPrisms", []))
    # Fixed exact native / modern owners at Breitscheidplatz and Wittenbergplatz.
    reserved.update(["15777905", "74901812", "64359480", "15218373"])
    bikini = json.loads((ROOT / "src/app/src/bikiniSource.json").read_text())
    reserved.update(bikini["replacementPrismIds"])
    source["corePrisms"] = [p for p in source["corePrisms"] if p["id"] not in reserved]
    source["references"] = [
      "https://www.berlin.de/sehenswuerdigkeiten/3559941-3558930-tauentzienstrasse.html"
    ]
    source["excludedDetailedOwners"] = sorted(reserved)
    write_json(SOURCE, source)
  result = publish(
    args.out,
    SOURCE,
    mesh_kind="tauentzien-street-fronts-v165",
    source_key="tauentzienV165",
    version="1.0.65",
    patch_name="tauentzien-manifest-patch.json",
    audit_path=AUDIT,
    names=NAMES,
  )
  print(json.dumps(result))


if __name__ == "__main__":
  main()
