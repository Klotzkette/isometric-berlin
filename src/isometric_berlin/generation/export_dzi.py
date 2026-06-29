"""Export generated quadrant tiles to a Deep Zoom pyramid and preview HTML."""

from __future__ import annotations

import argparse
import io
import json
import math
import sqlite3
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image

WIKIMEDIA_ATTRIBUTION = " · Visual references: Wikimedia Commons/Wikipedia"
DEFAULT_WIKIMEDIA_REFERENCES = Path(
  "geo_data/regierungsviertel/wikimedia_references.json"
)


def load_mosaic(map_id: str, tile_px: int) -> Image.Image:
  from isometric_berlin.generation.create_grid import quadrant_db_path

  db_path = quadrant_db_path(map_id)
  with sqlite3.connect(db_path) as db:
    db.row_factory = sqlite3.Row
    rows = db.execute(
      "SELECT row, col, generation, render FROM quadrants ORDER BY row, col"
    ).fetchall()
  if not rows:
    raise SystemExit(f"No quadrants in {db_path}")
  max_row = max(row["row"] for row in rows)
  max_col = max(row["col"] for row in rows)
  mosaic = Image.new(
    "RGB", ((max_col + 1) * tile_px, (max_row + 1) * tile_px), (232, 226, 206)
  )
  for row in rows:
    data = row["generation"] or row["render"]
    if data is None:
      continue
    tile = Image.open(io.BytesIO(data)).convert("RGB").resize((tile_px, tile_px))
    mosaic.paste(tile, (row["col"] * tile_px, row["row"] * tile_px))
  return mosaic


def export_dzi(
  image: Image.Image,
  *,
  dzi_path: Path,
  tile_size: int = 256,
  overlap: int = 0,
  fmt: str = "jpg",
) -> None:
  dzi_path.parent.mkdir(parents=True, exist_ok=True)
  tiles_root = dzi_path.with_name(f"{dzi_path.stem}_files")
  if tiles_root.exists():
    for path in sorted(tiles_root.rglob("*"), reverse=True):
      if path.is_file():
        path.unlink()
      else:
        path.rmdir()
  tiles_root.mkdir(parents=True, exist_ok=True)

  width, height = image.size
  max_level = math.ceil(math.log2(max(width, height)))
  for level in range(max_level + 1):
    scale = 2 ** (max_level - level)
    level_size = (math.ceil(width / scale), math.ceil(height / scale))
    level_image = image.resize(level_size, Image.Resampling.LANCZOS)
    level_dir = tiles_root / str(level)
    level_dir.mkdir(parents=True, exist_ok=True)
    cols = math.ceil(level_size[0] / tile_size)
    rows = math.ceil(level_size[1] / tile_size)
    for row in range(rows):
      for col in range(cols):
        left = col * tile_size
        upper = row * tile_size
        tile = level_image.crop(
          (
            left,
            upper,
            min(left + tile_size, level_size[0]),
            min(upper + tile_size, level_size[1]),
          )
        )
        tile.save(level_dir / f"{col}_{row}.{fmt}", quality=88)

  image_elem = ET.Element(
    "Image",
    TileSize=str(tile_size),
    Overlap=str(overlap),
    Format=fmt,
    xmlns="http://schemas.microsoft.com/deepzoom/2008",
  )
  ET.SubElement(image_elem, "Size", Width=str(width), Height=str(height))
  ET.ElementTree(image_elem).write(dzi_path, encoding="utf-8", xml_declaration=True)


def write_preview(
  html_path: Path,
  *,
  title: str,
  overview_path: Path,
  dzi_path: Path,
  extra_attribution: str = "",
) -> None:
  html_path.write_text(
    f"""<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <style>
    body {{ margin: 0; background: #1f2524; color: #f4eee0; font-family: system-ui, sans-serif; }}
    header {{ padding: 14px 18px; display: flex; justify-content: space-between; gap: 16px; align-items: center; }}
    main {{ overflow: auto; height: calc(100vh - 58px); background: #2b3331; }}
    img {{ display: block; width: min(100%, 1800px); height: auto; image-rendering: pixelated; margin: 0 auto; }}
    .attr {{ font-size: 12px; opacity: .8; }}
    code {{ color: #ffe0a3; }}
  </style>
</head>
<body>
  <header>
    <strong>{title}</strong>
    <span class="attr">© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0){extra_attribution}</span>
  </header>
  <main>
    <img src="{overview_path.name}" alt="Isometric Berlin preview">
  </main>
  <!-- DZI descriptor for OpenSeadragon integration: {dzi_path.name} -->
</body>
</html>
""",
    encoding="utf-8",
  )


def wikimedia_extra_attribution(manifest_path: Path) -> str:
  if not manifest_path.exists():
    return ""
  try:
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
  except (OSError, json.JSONDecodeError):
    return ""
  return WIKIMEDIA_ATTRIBUTION if payload.get("records") else ""


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--map-id", default="regierungsviertel")
  parser.add_argument("--tile-px", type=int, default=512)
  parser.add_argument(
    "--out-dir",
    type=Path,
    default=Path("src/app/public/dzi/regierungsviertel"),
  )
  parser.add_argument(
    "--wikimedia-references",
    type=Path,
    default=DEFAULT_WIKIMEDIA_REFERENCES,
  )
  args = parser.parse_args()

  image = load_mosaic(args.map_id, args.tile_px)
  args.out_dir.mkdir(parents=True, exist_ok=True)
  overview = args.out_dir / "overview.png"
  image.save(overview, optimize=True)
  dzi = args.out_dir / "regierungsviertel.dzi"
  export_dzi(image, dzi_path=dzi)
  write_preview(
    args.out_dir / "preview.html",
    title="Isometric Berlin Regierungsviertel",
    overview_path=overview,
    dzi_path=dzi,
    extra_attribution=wikimedia_extra_attribution(args.wikimedia_references),
  )
  print(f"Wrote overview and DZI to {args.out_dir}")


if __name__ == "__main__":
  main()
