"""Fetch a key-free manifest of Google Photorealistic 3D Tiles covering
the Regierungsviertel bounds (opt-in, additive fusion source).

Owner policy: Google is an *additive* source, not a replacement for
Berlin LoD2 or OSM. This fetcher runs only when all three opt-in env
vars are set:

  - ``GOOGLE_MAPS_API_KEY``
  - ``GOOGLE_MAPS_3D_TILES_ENABLED=true``
  - ``GOOGLE_MAPS_TERMS_ACCEPTED=true``

If any is missing, this command logs a clear no-op and exits 0, so the
fusion step can record ``google3d.available=false`` and continue.

API key hygiene
---------------

The output manifest at
``geo_data/regierungsviertel/raw/google_3d_tiles/manifest.json``
**must not** contain the actual API key. URLs are stored with the
``{GOOGLE_MAPS_API_KEY}`` placeholder so the manifest is safe to read,
diff, and (selectively) share. The raw tile content directory under
the same path stays gitignored.

Usage
-----

.. code-block:: bash

   uv run python -m isometric_berlin.data.fetch_google_tiles \\
     --bounds geo_data/regierungsviertel/bounds.geojson \\
     --out geo_data/regierungsviertel/raw/google_3d_tiles/manifest.json

Add ``--download-content`` **only** when the owner has explicitly
approved tile content download for the current run.

TODO
----

- Resolve the root 3D Tiles tileset URL from the Google Maps Tile API.
- Walk the tileset JSON tree, clip to bounds polygon (lat/lng).
- For each tile that intersects bounds, record a manifest entry with
  ``{url_template, bbox, lod, content_type}``. Strip the API key from
  every URL before writing.
- If ``--download-content``, fetch each tile to
  ``geo_data/regierungsviertel/raw/google_3d_tiles/content/<tile_id>``
  with a sane User-Agent and per-host rate limit.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Final

REQUIRED_ENV_VARS: Final[tuple[str, ...]] = (
  "GOOGLE_MAPS_API_KEY",
  "GOOGLE_MAPS_3D_TILES_ENABLED",
  "GOOGLE_MAPS_TERMS_ACCEPTED",
)


def opt_in_satisfied(env: dict[str, str] | None = None) -> tuple[bool, str]:
  """Return ``(ok, reason)`` based on the three opt-in env vars."""
  e = env if env is not None else os.environ
  if not e.get("GOOGLE_MAPS_API_KEY"):
    return False, "GOOGLE_MAPS_API_KEY is not set"
  if e.get("GOOGLE_MAPS_3D_TILES_ENABLED", "").lower() != "true":
    return False, "GOOGLE_MAPS_3D_TILES_ENABLED is not 'true'"
  if e.get("GOOGLE_MAPS_TERMS_ACCEPTED", "").lower() != "true":
    return False, "GOOGLE_MAPS_TERMS_ACCEPTED is not 'true'"
  return True, "ok"


def write_unavailable_manifest(out_path: Path, reason: str) -> None:
  """Write a manifest declaring google3d as unavailable for this run."""
  out_path.parent.mkdir(parents=True, exist_ok=True)
  payload = {
    "source": "google3d",
    "available": False,
    "reason": reason,
    "url_template": None,
    "tiles": [],
  }
  out_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main() -> int:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--bounds", type=Path, required=True)
  parser.add_argument("--out", type=Path, required=True)
  parser.add_argument(
    "--download-content",
    action="store_true",
    help="Download actual tile content (opt-in per run).",
  )
  args = parser.parse_args()

  ok, reason = opt_in_satisfied()
  if not ok:
    print(
      f"[fetch_google_tiles] opt-in not satisfied: {reason}. "
      "Writing unavailable manifest and exiting 0.",
      file=sys.stderr,
    )
    write_unavailable_manifest(args.out, f"opt_in_env_missing: {reason}")
    return 0

  raise NotImplementedError(
    "fetch_google_tiles is a scaffold. Implement Google 3D Tiles "
    "manifest walk with API-key stripping before merging."
  )


if __name__ == "__main__":
  raise SystemExit(main())
