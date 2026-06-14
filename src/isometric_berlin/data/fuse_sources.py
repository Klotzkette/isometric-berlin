"""Build the fused source-stack manifest for the Regierungsviertel.

This is pipeline step 6 (see ``AGENTS.md`` §5 and
``docs/data.md``). It does **additive** fusion: every permitted source
that is available contributes; conflicts are recorded, not silently
resolved.

Output
------

Writes ``geo_data/regierungsviertel/fused_sources.json`` with the
shape documented in ``docs/data.md`` ("Fused source-stack manifest").

Inputs
------

- ``geo_data/regierungsviertel/buildings.gpkg`` (LoD2, required)
- ``geo_data/regierungsviertel/osm.gpkg`` (OSM, required)
- ``geo_data/regierungsviertel/raw/alkis/`` (optional)
- ``geo_data/regierungsviertel/raw/dop/`` (optional)
- ``geo_data/regierungsviertel/raw/dgm/`` (optional)
- ``geo_data/regierungsviertel/raw/google_3d_tiles/manifest.json``
  (optional, opt-in)

Behaviour
---------

- A source that is missing or unavailable is recorded as
  ``available: false`` with a ``reason`` — it is NOT silently dropped.
- Conflicts between sources on the same attribute are recorded in
  ``conflict_log`` and BOTH values stay in the per-feature evidence
  list. The winning value is chosen per the ranking table in
  ``docs/data.md``.
- Hero features (Reichstag dome, Hauptbahnhof glass roof) may be
  marked ``manual: true`` to bypass automatic conflict resolution.
"""

from __future__ import annotations

import argparse
from pathlib import Path


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--bounds",
    type=Path,
    default=Path("geo_data/regierungsviertel/bounds.geojson"),
  )
  parser.add_argument(
    "--out",
    type=Path,
    default=Path("geo_data/regierungsviertel/fused_sources.json"),
  )
  parser.parse_args()
  raise NotImplementedError(
    "fuse_sources is a scaffold. Implement additive fusion with "
    "per-feature provenance and conflict_log per docs/data.md."
  )


if __name__ == "__main__":
  main()
