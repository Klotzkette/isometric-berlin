"""Fetch and clip Berlin LoD2 CityGML to the Regierungsviertel bounds.

TODO:
- Download the relevant Berlin LoD2 tile(s) from the Geoportal Berlin
  (FIS-Broker / WFS) covering the Regierungsviertel bounds.
- Parse CityGML (e.g. via `citygml-tools` or a custom parser).
- Clip to the bounds polygon from
  ``geo_data/regierungsviertel/bounds.geojson``.
- Write a small GeoPackage to
  ``geo_data/regierungsviertel/buildings.gpkg``.

License of source data: dl-de/zero-2-0
(https://www.govdata.de/dl-de/zero-2-0).
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
    "fetch_lod2 is a scaffold. Implement download + CityGML clip."
  )


if __name__ == "__main__":
  main()
