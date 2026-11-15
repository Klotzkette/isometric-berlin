"""Retain official DGM1 heights for five verified missing restaurant outlines."""

import gzip
import json

from scripts.build_fuel_terrain_v351 import GEO, build_sites

SITES = {
  8589: 24430646,
  14204: 48395704,
  16811: 161297069,
  17377: 204157828,
  14659: 204281885,
}


def main() -> None:
  source_bytes = (GEO / "gastronomy-v352-address-buildings.json.gz").read_bytes()
  features = json.loads(gzip.decompress(source_bytes))["features"]
  rows = []
  for branch, osm in SITES.items():
    matches = [f for f in features if f["properties"]["osmId"] == f"way/{osm}"]
    assert len(matches) == 1
    feature = matches[0]
    assert f"bk/{branch}" in feature["properties"]["facilityIds"]
    rows.append(
      {
        "roof": {"id": f"way/{osm}", "geometry": feature["geometry"]},
        "site": {"id": f"bk/{branch}", "geometry": feature["geometry"]},
      }
    )
  payload = build_sites(rows, source_bytes)
  destination = GEO / "gastronomy-v352-terrain.json.gz"
  destination.write_bytes(
    gzip.compress(
      json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode(),
      compresslevel=9,
      mtime=0,
    )
  )
  print({"sites": len(payload["sites"]), "bytes": destination.stat().st_size})


if __name__ == "__main__":
  main()
