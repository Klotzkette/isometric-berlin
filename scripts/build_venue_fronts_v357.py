"""Build the verified Berlin nightlife, restaurant and corporate venue layer."""

from __future__ import annotations

import argparse
import math
from collections import Counter, defaultdict
from pathlib import Path

from scripts import build_venue_fronts_v355 as venue
from scripts.compile_core_venues_v357 import central_fronts
from scripts.publish_venue_fronts_v355 import write_recipes

COMMON = venue.common
GEO = venue.GEO
SOURCES = (
  GEO / "clubs-v357-source.json.gz",
  GEO / "pubs-amrit-v357-source.json.gz",
  GEO / "corporate-v357-source.json",
)


def prepare(scratch):
  sites = {}
  for input_path in SOURCES:
    for row in COMMON.read(input_path)["sites"]:
      key = row["id"]
      assert key not in sites and row["kind"] in venue.KINDS[6:]
      if owner := row.get("existingOwner"):
        row["authoredLandmark"] = owner
      sites[key] = row
  core = central_fronts(sites)
  core_ids = {row["id"] for row in core}
  streamed = {
    key: {**row, "directoryOnly": True} if key in core_ids else row
    for key, row in sites.items()
  }
  venue.prepare(
    scratch,
    (),
    sites=streamed,
    source_files={p.name: COMMON.sha(p.read_bytes()) for p in SOURCES},
  )
  COMMON.write(scratch / "core.json", core)
  print("Core fronts:", [(row["id"], row["owner"]) for row in core], flush=True)


def publish(scratch):
  data = COMMON.DATA
  inventory = COMMON.read(scratch / "inventory.json")
  capture = COMMON.read(scratch / "result.json")
  core = COMMON.read(scratch / "core.json")
  by_id = {row["id"]: row for row in core}
  core_file = data / "coreVenueFrontsV357.json"
  COMMON.write(core_file, core)
  hosts, source_batches = write_recipes(capture["recipes"], 357)

  cell_size = COMMON.read(data / "publicAmenitiesV332.json")["cellMeters"]
  cells = defaultdict(list)
  sites = {}
  counts = defaultdict(Counter)
  for key, row in sorted(inventory["sites"].items()):
    x, z = (round(n, 2) for n in venue.project(row["lon"], row["lat"]))
    cells[f"{math.floor(x / cell_size)}_{math.floor(z / cell_size)}"].append(
      [key, row["kind"], row["name"], x, z, "", "", row["address"]]
    )
    decision = {
      **inventory["decisions"][key],
      "category": row["kind"],
      "name": row["name"],
      "location": [row["lon"], row["lat"]],
      "sourceUrl": row["sourceUrl"],
    }
    if key == "aok-nordost-wilhelmstrasse":
      survey = GEO / "aok-surface-v357-source.json"
      decision["buildingModel"] = {
        "source": survey.name,
        "sha256": COMMON.sha(survey.read_bytes()),
        "runtime": "AokTowerV357",
      }
    if current := by_id.get(key):
      decision.update(
        status="photographic-core-front"
        if current["reference"]
        else "core-wall-recognition",
        owner=current["owner"],
        plate=bool(current["sign"]),
        facadeReferences=[current["reference"]] if current["reference"] else [],
      )
    if receipt := capture["admitted"].get(key):
      assert key not in by_id
      decision.update(receipt)
      decision["status"] = (
        "photographic-front-detail"
        if receipt["facadeReferences"]
        else "retained-wall-recognition"
      )
    counts[row["kind"]][decision["status"]] += 1
    sites[key] = decision
  directory = data / "venueDirectoryV357.json"
  COMMON.write(directory, dict(cells=dict(sorted(cells.items()))))
  COMMON.write(
    GEO / "venue-fronts-v357-audit.json.gz",
    dict(
      schemaVersion=1,
      sourceFiles=inventory["sourceFiles"],
      counts=counts,
      sites=sites,
      rejectedHosts=capture["rejected"],
      runtimeBytes=directory.stat().st_size
      + core_file.stat().st_size
      + (data / "venueFrontsV357Index.json").stat().st_size
      + sum((data / row["file"]).stat().st_size for row in source_batches),
    ),
  )
  print(
    dict(counts), len(hosts), "streamed hosts", len(core), "core fronts", flush=True
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("action", choices=("prepare", "publish"))
  parser.add_argument("scratch", type=Path)
  args = parser.parse_args()
  (prepare if args.action == "prepare" else publish)(args.scratch)
