"""Create the isometric quadrant grid for the Regierungsviertel bounds."""

from __future__ import annotations

import argparse
import math
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from isometric_berlin.data.common import load_bounds_polygon, project_geometry

SCHEMA = """
CREATE TABLE IF NOT EXISTS quadrants (
  id INTEGER PRIMARY KEY,
  row INTEGER NOT NULL,
  col INTEGER NOT NULL,
  minx REAL NOT NULL,
  miny REAL NOT NULL,
  maxx REAL NOT NULL,
  maxy REAL NOT NULL,
  center_x REAL NOT NULL,
  center_y REAL NOT NULL,
  render BLOB,
  generation BLOB,
  status TEXT NOT NULL DEFAULT 'pending',
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
"""


def quadrant_db_path(map_id: str) -> Path:
  return Path("generations") / map_id / "quadrants.db"


def build_grid(
  bounds_path: Path, tile_size_m: float, margin_m: float
) -> list[dict[str, float]]:
  polygon = project_geometry(load_bounds_polygon(bounds_path))
  minx, miny, maxx, maxy = polygon.bounds
  minx -= margin_m
  miny -= margin_m
  maxx += margin_m
  maxy += margin_m
  rows = max(1, math.ceil((maxy - miny) / tile_size_m))
  cols = max(1, math.ceil((maxx - minx) / tile_size_m))
  quadrants: list[dict[str, float]] = []
  ident = 1
  for row in range(rows):
    for col in range(cols):
      q_minx = minx + col * tile_size_m
      q_miny = miny + row * tile_size_m
      q_maxx = q_minx + tile_size_m
      q_maxy = q_miny + tile_size_m
      quadrants.append(
        {
          "id": ident,
          "row": row,
          "col": col,
          "minx": q_minx,
          "miny": q_miny,
          "maxx": q_maxx,
          "maxy": q_maxy,
          "center_x": (q_minx + q_maxx) / 2,
          "center_y": (q_miny + q_maxy) / 2,
        }
      )
      ident += 1
  return quadrants


def write_grid(
  *,
  db_path: Path,
  bounds_path: Path,
  quadrants: list[dict[str, float]],
  tile_size_m: float,
  tile_px: int,
) -> None:
  db_path.parent.mkdir(parents=True, exist_ok=True)
  if db_path.exists():
    db_path.unlink()
  with sqlite3.connect(db_path) as db:
    db.executescript(SCHEMA)
    db.executemany(
      """
      INSERT INTO quadrants
      (id, row, col, minx, miny, maxx, maxy, center_x, center_y, updated_at)
      VALUES
      (:id, :row, :col, :minx, :miny, :maxx, :maxy, :center_x, :center_y, :updated_at)
      """,
      [
        {
          **quad,
          "updated_at": datetime.now(tz=UTC).isoformat(),
        }
        for quad in quadrants
      ],
    )
    metadata = {
      "bounds_path": str(bounds_path),
      "tile_size_m": str(tile_size_m),
      "tile_px": str(tile_px),
      "quadrant_count": str(len(quadrants)),
      "generated_at": datetime.now(tz=UTC).isoformat(),
    }
    db.executemany(
      "INSERT INTO metadata (key, value) VALUES (?, ?)",
      sorted(metadata.items()),
    )


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--bounds", type=Path, required=True)
  parser.add_argument("--map-id", default="regierungsviertel")
  parser.add_argument("--tile-size-m", type=float, default=180.0)
  parser.add_argument("--margin-m", type=float, default=90.0)
  parser.add_argument("--tile-px", type=int, default=512)
  args = parser.parse_args()

  quadrants = build_grid(args.bounds, args.tile_size_m, args.margin_m)
  db_path = quadrant_db_path(args.map_id)
  write_grid(
    db_path=db_path,
    bounds_path=args.bounds,
    quadrants=quadrants,
    tile_size_m=args.tile_size_m,
    tile_px=args.tile_px,
  )
  print(f"Wrote {len(quadrants)} quadrants to {db_path}")


if __name__ == "__main__":
  main()
