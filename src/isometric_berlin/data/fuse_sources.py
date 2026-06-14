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

Per-feature evidence is produced by a later step once
``buildings.gpkg`` / ``osm.gpkg`` exist; until then ``features`` and
``conflict_log`` are empty but the source inventory is complete.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from isometric_berlin.data.fetch_google_tiles import opt_in_satisfied

SOURCE_LICENSES: dict[str, str] = {
  "lod2": "dl-de/zero-2-0",
  "osm": "ODbL-1.0",
  "alkis": "dl-de/zero-2-0",
  "dop": "dl-de/zero-2-0",
  "dgm": "dl-de/zero-2-0",
  "google3d": "Google Maps Platform Terms",
}


def _file_source(source_id: str, path: Path) -> dict[str, Any]:
  if path.exists():
    return {
      "available": True,
      "path": str(path),
      "license": SOURCE_LICENSES[source_id],
    }
  return {"available": False, "reason": "not_downloaded"}


def _dir_source(source_id: str, path: Path) -> dict[str, Any]:
  if path.is_dir() and any(path.iterdir()):
    return {
      "available": True,
      "path": str(path),
      "license": SOURCE_LICENSES[source_id],
    }
  return {"available": False, "reason": "not_downloaded"}


def _google_source(manifest_path: Path, env: dict[str, str]) -> dict[str, Any]:
  """Reflect the google3d manifest if present, else record why it is absent.

  Never embeds Google content or keys — only references the manifest by
  path and mirrors its ``available`` flag.
  """
  if manifest_path.exists():
    try:
      payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
      payload = {}
    if payload.get("available"):
      return {
        "available": True,
        "path": str(manifest_path),
        "license": SOURCE_LICENSES["google3d"],
      }
    return {
      "available": False,
      "reason": payload.get("reason", "manifest_unavailable"),
    }
  ok, reason = opt_in_satisfied(env)
  return {"available": False, "reason": "opt_in_env_missing" if not ok else reason}


def discover_sources(geo_dir: Path, env: dict[str, str]) -> dict[str, Any]:
  """Inventory every permitted source (none is dropped because absent)."""
  raw = geo_dir / "raw"
  return {
    "lod2": _file_source("lod2", geo_dir / "buildings.gpkg"),
    "osm": _file_source("osm", geo_dir / "osm.gpkg"),
    "alkis": _dir_source("alkis", raw / "alkis"),
    "dop": _dir_source("dop", raw / "dop"),
    "dgm": _dir_source("dgm", raw / "dgm"),
    "google3d": _google_source(raw / "google_3d_tiles" / "manifest.json", env),
  }


def build_fused_manifest(
  bounds_path: Path, geo_dir: Path, env: dict[str, str]
) -> dict[str, Any]:
  """Build the additive fused source-stack manifest (per docs/data.md)."""
  return {
    "bounds_ref": str(bounds_path),
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "fusion": "additive",
    "sources": discover_sources(geo_dir, env),
    "features": [],
    "conflict_log": [],
  }


def main() -> int:
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
  args = parser.parse_args()

  import os

  manifest = build_fused_manifest(args.bounds, args.bounds.parent, dict(os.environ))
  args.out.parent.mkdir(parents=True, exist_ok=True)
  args.out.write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
  )

  available = sum(1 for s in manifest["sources"].values() if s["available"])
  total = len(manifest["sources"])
  print(f"Wrote fused source manifest to {args.out} ({available}/{total} available).")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
