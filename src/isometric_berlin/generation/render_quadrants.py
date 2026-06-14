"""Render orthographic / isometric 3D views of each quadrant from the
LoD2 buildings + OSM context.

TODO:
- Load buildings.gpkg and osm.gpkg.
- Build a pyvista scene per quadrant (camera angle matching NYC's
  isometric setup).
- Render a 1024x1024 source image (downsampled to 512 in postproc).
- Store as ``render`` BLOB in the quadrants DB.
"""

from __future__ import annotations

import argparse


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--map-id", default="regierungsviertel")
  args = parser.parse_args()
  raise NotImplementedError(
    "render_quadrants is a scaffold. Implement pyvista isometric render."
  )


if __name__ == "__main__":
  main()
