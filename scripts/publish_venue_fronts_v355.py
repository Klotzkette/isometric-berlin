"""Write finite lazy recipes and retain the source outcome of every venue."""

from __future__ import annotations

import argparse
import math
from collections import Counter, defaultdict
from pathlib import Path

from scripts import build_cluster_facades_v320 as common
from scripts.build_venue_fronts_v355 import GEO, project


def write_recipes(recipes, version):
  data = common.DATA
  hosts = sorted({key.split(":", 1)[1] for key in recipes["keys"]})
  sources = []
  for group in range(0, len(hosts), 16):
    keys = sorted(
      f"{mode}:{host}"
      for host in hosts[group : group + 16]
      for mode in ("drawn", "minecraft")
    )
    file = f"venueFrontsV{version}Packets{group // 16:02d}.json"
    common.write(
      data / file,
      dict(
        schemaVersion=1, keys=keys, packets={k: recipes["packets"][k] for k in keys}
      ),
    )
    sources.append(dict(file=file, keys=keys))
  common.write(data / f"venueFrontsV{version}Index.json", dict(sources=sources))

  return hosts, sources


def write(scratch):
  inventory = common.read(scratch / "inventory.json")
  capture = common.read(scratch / "result.json")
  data = common.DATA
  hosts, sources = write_recipes(capture["recipes"], 355)

  previous = common.read(data / "publicAmenitiesV332.json")
  cell = previous["cellMeters"]
  police = {
    row[0]: row
    for rows in previous["cells"].values()
    for row in rows
    if row[1] in ("police", "police-hq")
  }
  cells = defaultdict(list)
  duplicate_ids = set()
  report = {}
  for key, row in sorted(inventory["sites"].items()):
    location = row.get("entrance") or row
    x, z = map(lambda n: round(n, 2), project(location["lon"], location["lat"]))
    kind = row["kind"]
    if kind == "police":
      matching = {
        old_id
        for old_id, old in police.items()
        if key == old_id or math.hypot(x - old[3], z - old[4]) < 3
      }
      duplicate_ids |= matching
      if any(police[old_id][1] == "police-hq" for old_id in matching):
        kind = "police-hq"
    cells[f"{math.floor(x / cell)}_{math.floor(z / cell)}"].append(
      [key, kind, row["name"], x, z, "", "", row.get("address") or ""]
    )
    receipt = capture["admitted"].get(key)
    report[key] = {
      **inventory["decisions"][key],
      "category": row["kind"],
      "name": row["name"],
      "sourceUrl": row["sourceUrl"],
      "location": [row["lon"], row["lat"]],
      "directoryLocation": True,
    }
    if receipt:
      report[key].update(receipt)
      report[key]["status"] = (
        "photographic-front-detail"
        if receipt["facadeReferences"]
        else "retained-wall-recognition"
      )
  common.write(
    data / "venueDirectoryV355.json",
    dict(cells=dict(sorted(cells.items())), policeIds=sorted(duplicate_ids)),
  )
  counts = {}
  for item in report.values():
    counts.setdefault(item["category"], Counter())[item["status"]] += 1
  common.write(
    GEO / "venue-fronts-v355-audit.json.gz",
    dict(
      schemaVersion=1,
      sourceFiles=inventory["sourceFiles"],
      counts=counts,
      sites=report,
      rejectedHosts=capture["rejected"],
      runtimeBytes=sum((data / row["file"]).stat().st_size for row in sources)
      + (data / "venueDirectoryV355.json").stat().st_size,
    ),
  )
  print(counts, len(hosts), "admitted hosts")


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("scratch", type=Path)
  write(parser.parse_args().scratch)
