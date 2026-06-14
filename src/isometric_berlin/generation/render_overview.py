"""Render one global isometric preview from the fused source stack."""

from __future__ import annotations

import argparse
import io
import json
from pathlib import Path

import geopandas as gpd
from PIL import Image, ImageChops

from isometric_berlin.data.common import load_bounds_polygon, project_geometry
from isometric_berlin.generate_tile import pixel_art_image
from isometric_berlin.generation.export_dzi import export_dzi, write_preview
from isometric_berlin.generation.render_quadrants import (
  BACKGROUND,
  load_landmarks,
  load_layer,
  project_point,
  render_quadrant,
)


def content_bbox(image: Image.Image, pad: int = 96) -> tuple[int, int, int, int]:
  background = Image.new(image.mode, image.size, BACKGROUND)
  diff = ImageChops.difference(image, background)
  bbox = diff.getbbox()
  if bbox is None:
    return (0, 0, image.width, image.height)
  left = max(0, bbox[0] - pad)
  upper = max(0, bbox[1] - pad)
  right = min(image.width, bbox[2] + pad)
  lower = min(image.height, bbox[3] + pad)
  return (left, upper, right, lower)


def crop_to_content(
  image: Image.Image, pad: int = 96
) -> tuple[Image.Image, tuple[int, int, int, int]]:
  bbox = content_bbox(image, pad=pad)
  return image.crop(bbox), bbox


def landmark_records(
  *,
  landmarks: gpd.GeoDataFrame,
  quad: dict[str, float],
  crop_bbox: tuple[int, int, int, int],
  render_px: int,
  margin_m: float,
) -> list[dict[str, str | float]]:
  left, upper, right, lower = crop_bbox
  width = right - left
  height = lower - upper
  span_x = quad["maxx"] - quad["minx"] + margin_m * 2
  span_y = quad["maxy"] - quad["miny"] + margin_m * 2
  scale = render_px / ((span_x + span_y) * 0.7)
  records: list[dict[str, str | float]] = []
  for _, row in landmarks.iterrows():
    if row.geometry.geom_type != "Point":
      continue
    px, py = project_point(
      row.geometry.x,
      row.geometry.y,
      z=18,
      center_x=quad["center_x"],
      center_y=quad["center_y"],
      scale=scale,
      width=render_px,
      height=render_px,
    )
    x = min(max(px - left, 0), width)
    y = min(max(py - upper, 0), height)
    records.append(
      {
        "name": str(row.get("name", "")),
        "role": str(row.get("role", "context")),
        "x": round(x, 2),
        "y": round(y, 2),
        "nx": round(x / width, 6) if width else 0,
        "ny": round(y / height, 6) if height else 0,
      }
    )
  return records


def render_overview(
  *,
  bounds_path: Path,
  buildings_path: Path,
  osm_path: Path,
  landmarks_path: Path,
  out_dir: Path,
  render_px: int,
  margin_m: float,
) -> None:
  bounds = project_geometry(load_bounds_polygon(bounds_path))
  minx, miny, maxx, maxy = bounds.bounds
  quad = {
    "minx": minx - margin_m,
    "miny": miny - margin_m,
    "maxx": maxx + margin_m,
    "maxy": maxy + margin_m,
    "center_x": (minx + maxx) / 2,
    "center_y": (miny + maxy) / 2,
  }
  buildings = load_layer(buildings_path, "buildings")
  osm_layers = {
    layer: load_layer(osm_path, layer)
    for layer in ["roads", "water", "parks", "rail", "pois"]
  }
  landmarks = load_landmarks(landmarks_path)
  out_dir.mkdir(parents=True, exist_ok=True)
  source = render_quadrant(
    quad=quad,
    buildings=buildings,
    osm_layers=osm_layers,
    landmarks=landmarks,
    render_px=render_px,
    context_m=margin_m,
    show_labels=False,
  )
  source, crop_bbox = crop_to_content(source)
  source_path = out_dir / "overview_source.png"
  source.save(source_path, optimize=True)
  pixel = Image.open(io.BytesIO(pixel_art_image(source)))
  pixel_path = out_dir / "overview.png"
  pixel.save(pixel_path, optimize=True)
  (out_dir / "landmarks.json").write_text(
    json.dumps(
      {
        "image": {"width": pixel.width, "height": pixel.height},
        "landmarks": landmark_records(
          landmarks=landmarks,
          quad=quad,
          crop_bbox=crop_bbox,
          render_px=render_px,
          margin_m=margin_m,
        ),
      },
      ensure_ascii=False,
      indent=2,
    )
    + "\n",
    encoding="utf-8",
  )
  dzi = out_dir / "regierungsviertel.dzi"
  export_dzi(pixel.convert("RGB"), dzi_path=dzi)
  write_preview(
    out_dir / "preview.html",
    title="Isometric Berlin Regierungsviertel",
    overview_path=pixel_path,
    dzi_path=dzi,
  )


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--bounds",
    type=Path,
    default=Path("geo_data/regierungsviertel/bounds.geojson"),
  )
  parser.add_argument(
    "--buildings",
    type=Path,
    default=Path("geo_data/regierungsviertel/buildings.gpkg"),
  )
  parser.add_argument(
    "--osm", type=Path, default=Path("geo_data/regierungsviertel/osm.gpkg")
  )
  parser.add_argument(
    "--landmarks",
    type=Path,
    default=Path("geo_data/regierungsviertel/landmarks.geojson"),
  )
  parser.add_argument(
    "--out-dir",
    type=Path,
    default=Path("src/app/public/dzi/regierungsviertel"),
  )
  parser.add_argument("--render-px", type=int, default=4096)
  parser.add_argument("--margin-m", type=float, default=220)
  args = parser.parse_args()
  render_overview(
    bounds_path=args.bounds,
    buildings_path=args.buildings,
    osm_path=args.osm,
    landmarks_path=args.landmarks,
    out_dir=args.out_dir,
    render_px=args.render_px,
    margin_m=args.margin_m,
  )
  print(f"Wrote global isometric preview to {args.out_dir}")


if __name__ == "__main__":
  main()
