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
**must not** contain the actual API key. URLs are stored as templates
with the ``{GOOGLE_MAPS_API_KEY}`` placeholder so the manifest is safe
to read, diff, and (selectively) share. The raw tile content directory
under the same path stays gitignored.

Usage
-----

.. code-block:: bash

   uv run python -m isometric_berlin.data.fetch_google_tiles \\
     --bounds geo_data/regierungsviertel/bounds.geojson \\
     --out geo_data/regierungsviertel/raw/google_3d_tiles/manifest.json

Add ``--download-content`` **only** when the owner has explicitly
approved tile content download for the current run.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Final
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

REQUIRED_ENV_VARS: Final[tuple[str, ...]] = (
  "GOOGLE_MAPS_API_KEY",
  "GOOGLE_MAPS_3D_TILES_ENABLED",
  "GOOGLE_MAPS_TERMS_ACCEPTED",
)
ROOT_TILESET_URL: Final[str] = "https://tile.googleapis.com/v1/3dtiles/root.json"
API_HOST: Final[str] = "https://tile.googleapis.com"
KEY_PLACEHOLDER: Final[str] = "key={GOOGLE_MAPS_API_KEY}"
GOOGLE_ATTRIBUTION: Final[str] = "Imagery © Google · Google Maps Platform"


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


def to_url_template(url: str) -> str:
  """Return ``url`` with any real ``key`` replaced by the placeholder.

  Other query parameters (e.g. ``session``) are preserved; relative tile
  URIs are resolved against the Google tile host. The literal
  ``{GOOGLE_MAPS_API_KEY}`` placeholder is appended so the manifest never
  contains a real key.
  """
  absolute = url if url.startswith("http") else f"{API_HOST}{url}"
  parsed = urlparse(absolute)
  kept = [(k, v) for k, v in parse_qsl(parsed.query) if k.lower() != "key"]
  query = urlencode(kept)
  query = f"{query}&{KEY_PLACEHOLDER}" if query else KEY_PLACEHOLDER
  return urlunparse(parsed._replace(query=query))


def _content_type(uri: str) -> str:
  path = uri.lower().split("?", 1)[0]
  if path.endswith((".glb", ".gltf")):
    return "model/gltf-binary"
  if path.endswith(".b3dm"):
    return "model/vnd.3dtiles.b3dm"
  if path.endswith(".json"):
    return "application/json+3dtiles"
  return "application/octet-stream"


def _iter_content_uris(tile: dict[str, Any]) -> list[str]:
  """Collect ``content.uri`` values from a 3D Tiles tile tree."""
  uris: list[str] = []
  content = tile.get("content")
  if isinstance(content, dict) and content.get("uri"):
    uris.append(content["uri"])
  for child in tile.get("children", []) or []:
    if isinstance(child, dict):
      uris.extend(_iter_content_uris(child))
  return uris


def build_manifest(tileset: dict[str, Any]) -> dict[str, Any]:
  """Build the available (key-free) google3d manifest from a tileset JSON."""
  root = tileset.get("root", {}) if isinstance(tileset, dict) else {}
  asset = tileset.get("asset", {}) if isinstance(tileset, dict) else {}
  tiles = [
    {
      "url_template": to_url_template(uri),
      "content_type": _content_type(uri),
      "bbox": None,
      "lod": None,
    }
    for uri in _iter_content_uris(root)
  ]
  return {
    "source": "google3d",
    "available": True,
    "attribution": GOOGLE_ATTRIBUTION,
    "url_template": to_url_template(ROOT_TILESET_URL),
    "asset": asset,
    "geometric_error": root.get("geometricError"),
    "tiles": tiles,
  }


def fetch_root_tileset(api_key: str) -> dict[str, Any]:
  """Fetch the Google Photorealistic 3D Tiles root tileset (network)."""
  import requests

  response = requests.get(
    ROOT_TILESET_URL,
    params={"key": api_key},
    headers={"User-Agent": "isometric-berlin/0.1 (Klotzkette)"},
    timeout=60,
  )
  response.raise_for_status()
  return response.json()


def _download_content(
  tileset: dict[str, Any], api_key: str, content_dir: Path
) -> list[str]:
  """Download tile payloads referenced by the root tileset (network)."""
  import requests

  content_dir.mkdir(parents=True, exist_ok=True)
  saved: list[str] = []
  root = tileset.get("root", {}) if isinstance(tileset, dict) else {}
  for index, uri in enumerate(_iter_content_uris(root)):
    full = uri if uri.startswith("http") else f"{API_HOST}{uri}"
    response = requests.get(
      full,
      params={"key": api_key},
      headers={"User-Agent": "isometric-berlin/0.1 (Klotzkette)"},
      timeout=120,
    )
    response.raise_for_status()
    target = content_dir / f"tile_{index:05d}.glb"
    target.write_bytes(response.content)
    saved.append(target.name)
  return saved


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

  api_key = os.environ["GOOGLE_MAPS_API_KEY"]
  tileset = fetch_root_tileset(api_key)
  manifest = build_manifest(tileset)
  if args.download_content:
    manifest["downloaded_content"] = _download_content(
      tileset, api_key, args.out.parent / "content"
    )

  args.out.parent.mkdir(parents=True, exist_ok=True)
  args.out.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
  print(f"[fetch_google_tiles] wrote key-free manifest to {args.out}.")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
