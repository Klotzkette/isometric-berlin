"""Generate pixel-art tiles for each quadrant.

When ``MODAL_INFERENCE_URL`` is configured, this module is ready to be
extended to call the fine-tuned image model. Without that endpoint it
creates a deterministic local pixel-art pass from the rendered source
tile, so the rest of the viewer/export pipeline remains usable.
"""

from __future__ import annotations

import argparse
import io
import os
import sqlite3
from datetime import UTC, datetime

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

INK = (70, 62, 53)


def crisp_ink_mask(image: Image.Image, size: tuple[int, int]) -> Image.Image:
  """Return a subdued edge mask for the deterministic pixel-art pass."""
  edges = image.convert("L").filter(ImageFilter.FIND_EDGES)
  edges = ImageOps.autocontrast(edges.resize(size, Image.Resampling.BOX), cutoff=1)
  return edges.point(lambda value: 82 if value > 32 else 0)


def local_pixel_art(render: bytes, tile_px: int = 512) -> bytes:
  image = Image.open(io.BytesIO(render)).convert("RGB")
  return pixel_art_image(image, target_size=(tile_px, tile_px))


def pixel_art_image(
  image: Image.Image, *, target_size: tuple[int, int] | None = None
) -> bytes:
  image = image.convert("RGB")
  target_size = target_size or image.size
  image = ImageOps.autocontrast(image, cutoff=0)
  image = ImageEnhance.Color(image).enhance(1.06)
  image = ImageEnhance.Contrast(image).enhance(1.04)
  small_size = (max(1, target_size[0] // 4), max(1, target_size[1] // 4))
  small = image.resize(small_size, Image.Resampling.BOX)
  small = small.quantize(colors=56, method=Image.Quantize.MEDIANCUT).convert("RGB")
  small = Image.composite(
    Image.new("RGB", small_size, INK),
    small,
    crisp_ink_mask(image, small_size),
  )
  pixel = small.resize(target_size, Image.Resampling.NEAREST)
  pixel = ImageEnhance.Sharpness(pixel).enhance(1.08)
  pixel = pixel.filter(ImageFilter.UnsharpMask(radius=0.55, percent=110, threshold=2))
  output = io.BytesIO()
  pixel.save(output, format="PNG", optimize=True)
  return output.getvalue()


def generate_local_tiles(map_id: str, *, all_tiles: bool, limit: int | None) -> int:
  from isometric_berlin.generation.create_grid import quadrant_db_path

  db_path = quadrant_db_path(map_id)
  if not db_path.exists():
    raise SystemExit(f"Missing quadrant database: {db_path}")
  count = 0
  with sqlite3.connect(db_path) as db:
    db.row_factory = sqlite3.Row
    where = (
      "WHERE render IS NOT NULL"
      if all_tiles
      else "WHERE render IS NOT NULL AND generation IS NULL"
    )
    query = f"SELECT id, row, col, render FROM quadrants {where} ORDER BY row, col"
    if limit:
      query += f" LIMIT {int(limit)}"
    rows = db.execute(query).fetchall()
    tile_dir = db_path.parent / "tiles"
    tile_dir.mkdir(parents=True, exist_ok=True)
    for row in rows:
      tile = local_pixel_art(row["render"])
      db.execute(
        "UPDATE quadrants SET generation = ?, status = ?, updated_at = ? WHERE id = ?",
        (
          tile,
          "generated_local_pixel_art",
          datetime.now(tz=UTC).isoformat(),
          row["id"],
        ),
      )
      (tile_dir / f"q_{row['row']:03d}_{row['col']:03d}.png").write_bytes(tile)
      count += 1
    db.commit()
  return count


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--all", action="store_true")
  parser.add_argument("--map-id", default="regierungsviertel")
  parser.add_argument("--limit", type=int)
  args = parser.parse_args()

  if os.environ.get("MODAL_INFERENCE_URL"):
    print(
      "MODAL_INFERENCE_URL is set, but the local deterministic generator is used until the model client is implemented."
    )
  count = generate_local_tiles(args.map_id, all_tiles=args.all, limit=args.limit)
  print(f"Generated {count} local pixel-art tiles")


if __name__ == "__main__":
  main()
