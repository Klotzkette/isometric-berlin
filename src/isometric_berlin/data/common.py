"""Shared geodata helpers for the Isometric Berlin pipeline."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from pyproj import Transformer
from shapely.geometry import Polygon, shape
from shapely.ops import transform

WGS84 = "EPSG:4326"
BERLIN_PROJECTED = "EPSG:25833"


def repo_root() -> Path:
  return Path(__file__).resolve().parents[3]


def load_first_geometry(path: Path) -> Any:
  data = json.loads(path.read_text(encoding="utf-8"))
  return shape(data["features"][0]["geometry"])


def load_bounds_polygon(path: Path) -> Polygon:
  geom = load_first_geometry(path)
  if not isinstance(geom, Polygon):
    raise ValueError(f"Expected Polygon bounds in {path}")
  return geom


def transformer(source: str, target: str) -> Transformer:
  return Transformer.from_crs(source, target, always_xy=True)


def project_geometry(
  geom: Any, source: str = WGS84, target: str = BERLIN_PROJECTED
) -> Any:
  tx = transformer(source, target)
  return transform(tx.transform, geom)


def sha256_file(path: Path) -> str:
  digest = hashlib.sha256()
  with path.open("rb") as handle:
    for chunk in iter(lambda: handle.read(1024 * 1024), b""):
      digest.update(chunk)
  return digest.hexdigest()


def write_json(path: Path, data: dict[str, Any]) -> None:
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
