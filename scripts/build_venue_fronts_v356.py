"""Build and audit the next set of source-matched Berlin venue exteriors."""

from __future__ import annotations

import argparse
import hashlib
import math
from collections import Counter, defaultdict
from pathlib import Path

from scripts import build_cluster_facades_v320 as common
from scripts import build_venue_fronts_v355 as venue
from scripts.publish_venue_fronts_v355 import write_recipes

GEO = venue.GEO
DONER = GEO / "doener-v356-source.json.gz"
CONTINUATION = GEO / "venue-continuation-v356-source.json.gz"
FACADES = GEO / "doener-v356-facades.json"
PRIOR_AUDIT = GEO / "venue-fronts-v355-audit.json.gz"


def prepare(scratch, doner=DONER, facades=FACADES):
  paths = [GEO / name for name in venue.SOURCES]
  prior = {row["id"]: row for path in paths for row in common.read(path)["sites"]}
  previous = common.read(PRIOR_AUDIT)["sites"]
  selected = {}
  continuation = common.read(CONTINUATION)
  for binding in continuation["sites"]:
    key = binding["id"]
    row = prior[key]
    assert previous[key]["status"] in ("building-unresolved", "retained-shell")
    assert binding["point"] == [row["lon"], row["lat"]], key
    selected[key] = {**row, "wallBinding": binding}
    if binding.get("facadeReference"):
      selected[key]["facadeReference"] = binding["facadeReference"]
  for existing in continuation["existingAuthored"]:
    key = existing["id"]
    row = prior[key]
    assert key not in selected and previous[key]["status"] == "building-unresolved"
    assert existing["point"] == [row["lon"], row["lat"]]
    assert (
      common.sha((common.ROOT / existing["sourceFile"]).read_bytes())
      == existing["sourceSha256"]
    )
    selected[key] = {
      **row,
      "authoredLandmark": existing["authoredLandmark"],
      "authoredEvidence": existing,
    }
  fronts = common.read(facades)
  for row in common.read(doner)["sites"]:
    key = row["id"]
    assert key not in selected and key not in prior and row["kind"] == "doner"
    if key in fronts:
      row = {**row, "facadeReference": fronts[key]}
    if row.get("existingOwner"):
      row["authoredLandmark"] = row["existingOwner"]
    selected[key] = row
  assert fronts.keys() <= selected.keys(), sorted(fronts.keys() - selected.keys())
  return venue.prepare(
    scratch,
    (),
    sites=selected,
    source_files={
      path.name: hashlib.sha256(path.read_bytes()).hexdigest()
      for path in [*paths, PRIOR_AUDIT, CONTINUATION, doner, facades]
    },
  )


def publish(scratch):
  data = common.DATA
  inventory = common.read(scratch / "inventory.json")
  capture = common.read(scratch / "result.json")
  hosts, sources = write_recipes(capture["recipes"], 356)
  cell_size = common.read(data / "publicAmenitiesV332.json")["cellMeters"]
  cells = defaultdict(list)
  audit = {}
  counts = defaultdict(Counter)
  for key, row in sorted(inventory["sites"].items()):
    is_doner = row["kind"] == "doner"
    if is_doner:
      x, z = [round(n, 2) for n in venue.project(row["lon"], row["lat"])]
      cell = f"{math.floor(x / cell_size)}_{math.floor(z / cell_size)}"
      cells[cell].append(
        [key, "doner", row["name"], x, z, "", "", row.get("address", "")]
      )
    result = {
      **inventory["decisions"][key],
      "category": row["kind"],
      "name": row["name"],
      "location": [row["lon"], row["lat"]],
      "sourceUrl": row["sourceUrl"],
      "directory": "v356" if is_doner else "v355",
    }
    if binding := row.get("wallBinding"):
      result["buildingEvidence"] = binding["evidence"]
    if existing := row.get("authoredEvidence"):
      result["buildingEvidence"] = existing["evidence"]
      result["owner"] = existing["owner"]
    if key == "mustafas-mehringdamm" and result.get("core") == ["06766834"]:
      result.update(
        status="photographic-core-front",
        owner="06766834",
        facadeReferences=["https://mustafas.de/assets/laden.jpeg"],
      )
    if receipt := capture["admitted"].get(key):
      result.update(receipt)
      result["status"] = (
        "photographic-front-detail"
        if receipt["facadeReferences"]
        else "retained-wall-recognition"
      )
    counts[row["kind"]][result["status"]] += 1
    audit[key] = result
  directory = data / "donerDirectoryV356.json"
  common.write(directory, dict(cells=dict(sorted(cells.items()))))
  common.write(
    GEO / "venue-fronts-v356-audit.json.gz",
    dict(
      schemaVersion=1,
      sourceFiles=inventory["sourceFiles"],
      counts=counts,
      sites=audit,
      rejectedHosts=capture["rejected"],
      runtimeBytes=directory.stat().st_size
      + (data / "venueFrontsV356Index.json").stat().st_size
      + sum((data / row["file"]).stat().st_size for row in sources),
    ),
  )
  print(dict(counts), len(hosts), "admitted hosts", flush=True)


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("action", choices=("prepare", "publish"))
  parser.add_argument("scratch", type=Path)
  parser.add_argument("--doner", type=Path, default=DONER)
  parser.add_argument("--facades", type=Path, default=FACADES)
  args = parser.parse_args()
  if args.action == "prepare":
    prepare(args.scratch, args.doner, args.facades)
  else:
    publish(args.scratch)
