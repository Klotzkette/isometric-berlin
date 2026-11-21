"""Index the finite surveyed bank reaches by the render packet that carries them."""

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
SOURCES = ("Central", "North", "Spree")
WORLD_HOSTS = {"core", "panke-v229", "west-lakes-v194"}


def build():
  directory = {}
  footprints = {}
  seen = set()
  manifest = ROOT / "src/app/public/mesh/surrounding-berlin-v159/manifest.json"
  packet_ids = {tile["id"] for tile in json.loads(manifest.read_bytes())["chunks"]}
  for section in SOURCES:
    path = DATA / f"waterwayBanksV370{section}.json"
    for index, row in enumerate(json.loads(path.read_bytes())["records"]):
      name, host = row["id"], row["host"]
      if name in seen:
        raise ValueError(f"Duplicate bank reach {name}")
      seen.add(name)
      points = row["points"] + row.get("nativePoints", [])
      if not points or not all(
        len(p) == 2 and all(map(math.isfinite, p)) for p in points
      ):
        raise ValueError(f"Invalid water boundary for {name}")
      for key, line in (
        ("topY", row["points"]),
        ("nativeTopY", row.get("nativePoints", row["points"])),
      ):
        tops = row.get(key)
        if tops is not None and (
          len(tops) != len(line) or not all(map(math.isfinite, tops))
        ):
          raise ValueError(f"Incomplete bank crest for {name}")
      if not all(
        map(math.isfinite, (row["waterY"], row.get("nativeWaterY", row["waterY"])))
      ):
        raise ValueError(f"Missing water level for {name}")
      if host in WORLD_HOSTS:
        xs, zs = zip(*points, strict=True)
        x = math.floor((min(xs) + max(xs)) / 1024)
        z = math.floor((min(zs) + max(zs)) / 1024)
        host = f"waterbank370-{x}_{z}"
        pad = 1 + math.ceil(max(row.get("width", 0), 2))
        extent = [
          math.floor(min(xs)) - pad,
          math.floor(min(zs)) - pad,
          math.ceil(max(xs)) + pad,
          math.ceil(max(zs)) + pad,
        ]
        previous = footprints.get(host, extent)
        footprints[host] = [
          min(previous[0], extent[0]),
          min(previous[1], extent[1]),
          max(previous[2], extent[2]),
          max(previous[3], extent[3]),
        ]
      elif host not in packet_ids:
        raise ValueError(f"Unregistered host {host} for {name}")
      directory.setdefault(host, {}).setdefault(section, []).append(index)
  index = {"sections": directory, "bounds": footprints}
  (DATA / "waterwayBankHostsV370.json").write_text(
    json.dumps(index, sort_keys=True, separators=(",", ":")) + "\n"
  )


if __name__ == "__main__":
  build()
