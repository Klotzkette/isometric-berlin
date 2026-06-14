"""Fetch optional Berlin official support layers (ALKIS, DOP, DGM).

These are additive fusion inputs (see ``docs/data.md``):

  - ``alkis``  Official parcel context / alignment.
  - ``dop``    Digital orthophotos (texture / QA reference).
  - ``dgm``    Digital terrain model (where useful, e.g. Spree bank).

All are licensed under dl-de/zero-2-0 (effectively public domain).
Raw downloads go under ``geo_data/regierungsviertel/raw/<layer>/``
which is gitignored.

Usage
-----

.. code-block:: bash

   uv run python -m isometric_berlin.data.fetch_official_support \\
     --bounds geo_data/regierungsviertel/bounds.geojson \\
     --layers alkis,dop,dgm \\
     --out-dir geo_data/regierungsviertel/raw/
"""

from __future__ import annotations

import argparse
from pathlib import Path


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--bounds", type=Path, required=True)
  parser.add_argument(
    "--layers",
    default="alkis,dop,dgm",
    help="Comma-separated subset of alkis,dop,dgm.",
  )
  parser.add_argument(
    "--out-dir",
    type=Path,
    default=Path("geo_data/regierungsviertel/raw"),
  )
  parser.parse_args()
  raise NotImplementedError(
    "fetch_official_support is a scaffold. Implement per-layer "
    "downloads against Geoportal Berlin WFS/WMS endpoints."
  )


if __name__ == "__main__":
  main()
