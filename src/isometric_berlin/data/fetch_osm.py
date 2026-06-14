"""Fetch OSM context (streets, water, parks, rail, POIs) for the
Regierungsviertel bounds via OSMnx / Overpass.

TODO:
- Use ``osmnx`` to download highway, waterway, leisure=park, railway,
  amenity layers within the bounds polygon.
- Save to ``geo_data/regierungsviertel/osm.gpkg``.

License: OSM data is © OpenStreetMap contributors, ODbL 1.0.
The viewer must show the attribution string defined in NOTICE.md.
"""

from __future__ import annotations

import argparse
from pathlib import Path


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--bounds", type=Path, required=True)
  parser.add_argument("--out", type=Path, required=True)
  parser.parse_args()
  raise NotImplementedError(
    "fetch_osm is a scaffold. Implement Overpass / OSMnx download."
  )


if __name__ == "__main__":
  main()
