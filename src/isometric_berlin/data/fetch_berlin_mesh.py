"""Fetch official Berlin 3D Mesh 2025 tiles for the project bounds."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import requests
from shapely.geometry import shape

REPO_ROOT = Path(__file__).resolve().parents[3]
BOUNDS_PATH = REPO_ROOT / "geo_data/regierungsviertel/bounds.geojson"
RAW_DIR = REPO_ROOT / "geo_data/regierungsviertel/raw/berlin_3d_mesh_2025"
MANIFEST_PATH = REPO_ROOT / "geo_data/regierungsviertel/berlin_3d_mesh_sources.json"

PORTAL_URL = "https://www.businesslocationcenter.de/berlin3d-downloadportal/"
INDEX_URL = f"{PORTAL_URL}datasource-data/berlin-mesh-2025/mesh-index-2025.json"
TILE_BASE_URL = f"{PORTAL_URL}datasource-data/berlin-mesh-2025"
TERMS_URL = f"{PORTAL_URL}resources/terms/terms.de.html"
ATTRIBUTION = "3D mesh: Berlin Partner für Wirtschaft und Technologie GmbH"
USER_AGENT = "isometric-berlin/0.1 (+https://github.com/Klotzkette/isometric-berlin)"


def terms_accepted(
  *, explicit: bool = False, environ: dict[str, str] | None = None
) -> bool:
  """Return whether the required Berlin 3D license was accepted for this run."""
  values = os.environ if environ is None else environ
  return explicit or values.get("BERLIN_3D_MESH_TERMS_ACCEPTED", "").lower() == "true"


def decode_index(content: bytes) -> dict[str, Any]:
  """Decode the portal index, including servers that omit gzip headers."""
  if content.startswith(b"\x1f\x8b"):
    content = gzip.decompress(content)
  payload = json.loads(content.decode("utf-8-sig"))
  if payload.get("type") != "FeatureCollection":
    raise ValueError("Berlin 3D mesh index is not a GeoJSON FeatureCollection")
  return payload


def load_bounds_geometry(path: Path = BOUNDS_PATH) -> Any:
  """Load the single Regierungsviertel polygon in CRS84 coordinates."""
  payload = json.loads(path.read_text(encoding="utf-8"))
  features = payload.get("features", [])
  if len(features) != 1:
    raise ValueError(f"Expected one bounds feature in {path}")
  return shape(features[0]["geometry"])


def select_index_features(
  payload: dict[str, Any], bounds_geometry: Any
) -> list[dict[str, Any]]:
  """Select only source-tile index features intersecting project bounds."""
  selected = [
    feature
    for feature in payload.get("features", [])
    if shape(feature["geometry"]).intersects(bounds_geometry)
  ]
  return sorted(selected, key=lambda feature: feature["properties"]["url"])


def sha256_file(path: Path) -> str:
  """Return the SHA-256 digest of one downloaded archive."""
  digest = hashlib.sha256()
  with path.open("rb") as stream:
    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
      digest.update(chunk)
  return digest.hexdigest()


def download_file(session: requests.Session, url: str, destination: Path) -> None:
  """Stream one archive atomically unless an existing ZIP is valid."""
  if destination.exists() and destination.stat().st_size > 1_000_000:
    return
  destination.parent.mkdir(parents=True, exist_ok=True)
  temporary = destination.with_suffix(destination.suffix + ".part")
  with session.get(url, stream=True, timeout=(20, 180)) as response:
    response.raise_for_status()
    with temporary.open("wb") as stream:
      for chunk in response.iter_content(chunk_size=1024 * 1024):
        if chunk:
          stream.write(chunk)
  temporary.replace(destination)


def build_manifest(
  *,
  accept_terms: bool = False,
  download_content: bool = False,
  bounds_path: Path = BOUNDS_PATH,
  raw_dir: Path = RAW_DIR,
  manifest_path: Path = MANIFEST_PATH,
  session: requests.Session | None = None,
) -> dict[str, Any]:
  """Select official mesh tiles, optionally download them, and write provenance."""
  if not terms_accepted(explicit=accept_terms):
    raise RuntimeError(
      "Berlin 3D Mesh terms must be accepted with --accept-terms or "
      "BERLIN_3D_MESH_TERMS_ACCEPTED=true"
    )
  client = session or requests.Session()
  client.headers.update({"User-Agent": USER_AGENT})
  response = client.get(INDEX_URL, timeout=(20, 120))
  response.raise_for_status()
  index_payload = decode_index(response.content)
  selected = select_index_features(index_payload, load_bounds_geometry(bounds_path))

  tiles = []
  for feature in selected:
    filename = str(feature["properties"]["url"])
    url = f"{TILE_BASE_URL}/{filename}"
    destination = raw_dir / filename
    if download_content:
      download_file(client, url, destination)
    tiles.append(
      {
        "filename": filename,
        "url": url,
        "index_geometry": feature["geometry"],
        "downloaded": destination.exists(),
        "bytes": destination.stat().st_size if destination.exists() else None,
        "sha256": sha256_file(destination) if destination.exists() else None,
      }
    )

  manifest = {
    "schema_version": 1,
    "generated_at": datetime.now(UTC).isoformat(),
    "source": {
      "name": "Berlin 3D Mesh Model 2025",
      "provider": "Berlin Partner für Wirtschaft und Technologie GmbH",
      "portal_url": PORTAL_URL,
      "index_url": INDEX_URL,
      "terms_url": TERMS_URL,
      "survey": "June 2025 aerial survey",
      "attribution": ATTRIBUTION,
      "license_summary": "Free use and modification, including commercial use, subject to provider attribution and portal terms.",
    },
    "terms_accepted_for_run": True,
    "bounds_path": str(bounds_path.relative_to(REPO_ROOT)),
    "tile_count": len(tiles),
    "tiles": tiles,
  }
  manifest_path.parent.mkdir(parents=True, exist_ok=True)
  manifest_path.write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
  )
  return manifest


def main() -> None:
  """CLI entry point for bounded Berlin 3D Mesh acquisition."""
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--accept-terms",
    action="store_true",
    help="Confirm that the portal terms were read and accepted for this run.",
  )
  parser.add_argument(
    "--download-content",
    action="store_true",
    help="Download the selected OBJ/texture ZIP archives into gitignored raw data.",
  )
  args = parser.parse_args()
  manifest = build_manifest(
    accept_terms=args.accept_terms,
    download_content=args.download_content,
  )
  print(
    f"Selected {manifest['tile_count']} Berlin 3D Mesh tiles; "
    f"download_content={args.download_content}"
  )


if __name__ == "__main__":
  main()
