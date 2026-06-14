"""Create the isometric quadrant grid for the Regierungsviertel bounds.

TODO:
- Read ``bounds.geojson``.
- Compute an isometric quadrant grid (512x512 px each, matching NYC)
  that covers the bounds.
- Persist the grid to a SQLite ``quadrants.db`` under
  ``generations/<MAP_ID>/`` with placeholder rows (no render, no
  generation yet).
"""

from __future__ import annotations

import argparse
from pathlib import Path


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--bounds", type=Path, required=True)
  parser.add_argument("--map-id", default="regierungsviertel")
  parser.parse_args()
  raise NotImplementedError(
    "create_grid is a scaffold. Implement isometric quadrant grid."
  )


if __name__ == "__main__":
  main()
