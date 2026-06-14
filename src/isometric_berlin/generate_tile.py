"""Generate pixel-art tiles for each quadrant by calling the Modal
inference endpoint with the rendered source image.

TODO:
- Iterate quadrants in dependency order (use NYC-style 2x2 / 1x2 / 2x1
  / 1x1 infill adjacency rules).
- POST base64-encoded render to ``$MODAL_INFERENCE_URL``.
- Store the returned PNG into the ``generation`` BLOB column.
"""

from __future__ import annotations

import argparse


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--all", action="store_true")
  parser.add_argument("--map-id", default="regierungsviertel")
  parser.parse_args()
  raise NotImplementedError(
    "generate_tile is a scaffold. Implement Modal inference loop."
  )


if __name__ == "__main__":
  main()
