"""Retain official DGM1 heights for nine verified missing restaurant outlines."""

import gzip
import json

from scripts.build_fuel_terrain_v351 import GEO, build_sites

SITES = {
  312: 219903163,
  385: 27482319,
  717: 65070817,
  788: 48797679,
  1173: 27481233,
  1202: 30804198,
  1477: 92202947,
  1564: 76091929,
  1688: 317882080,
}


def main() -> None:
  source_bytes = (GEO / "mcdonalds-v351-address-buildings.json.gz").read_bytes()
  features = json.loads(gzip.decompress(source_bytes))["features"]
  rows = []
  for branch, osm in SITES.items():
    matches = [f for f in features if f["properties"]["osmId"] == f"way/{osm}"]
    assert len(matches) == 1
    feature = matches[0]
    assert f"mcdonalds:{branch}" in feature["properties"]["facilityIds"]
    rows.append(
      {
        "roof": {"id": f"way/{osm}", "geometry": feature["geometry"]},
        "site": {"id": f"mcdonalds:{branch}", "geometry": feature["geometry"]},
      }
    )
  payload = build_sites(rows, source_bytes)
  destination = GEO / "mcdonalds-v351-terrain.json.gz"
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
