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
from isometric_berlin.generation.export_dzi import (
  export_dzi,
  wikimedia_extra_attribution,
  write_preview,
)
from isometric_berlin.generation.render_quadrants import (
  BACKGROUND,
  load_landmarks,
  load_layer,
  load_reference_geometries,
  load_wikimedia_material_cues,
  project_point,
  render_quadrant,
)

DEFAULT_RENDER_PX = 32_768
DEFAULT_CANVAS_WIDTH = 16_384
DEFAULT_CANVAS_HEIGHT = 11_616
DEFAULT_PREVIEW_MAX_WIDTH = 6_144
PREVIEW_PALETTE_COLORS = 256


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


def fit_preview(image: Image.Image, max_width: int) -> Image.Image:
  """Return a compact derived preview without changing the DZI source."""
  if image.width <= max_width:
    return image.copy()
  height = max(1, round(image.height * max_width / image.width))
  return image.resize((max_width, height), Image.Resampling.LANCZOS)


def compact_preview(
  image: Image.Image, *, colors: int = PREVIEW_PALETTE_COLORS
) -> Image.Image:
  """Keep the high-resolution fallback below the repository binary limit."""
  return image.convert("RGB").quantize(
    colors=colors,
    method=Image.Quantize.MEDIANCUT,
    dither=Image.Dither.NONE,
  )


def landmark_records(
  *,
  landmarks: gpd.GeoDataFrame,
  quad: dict[str, float],
  crop_bbox: tuple[int, int, int, int],
  render_px: int,
  canvas_width: int,
  canvas_height: int,
  margin_m: float,
) -> list[dict[str, str | float | int]]:
  left, upper, right, lower = crop_bbox
  width = right - left
  height = lower - upper
  span_x = quad["maxx"] - quad["minx"] + margin_m * 2
  span_y = quad["maxy"] - quad["miny"] + margin_m * 2
  scale = render_px / ((span_x + span_y) * 0.7)
  records: list[dict[str, str | float | int]] = []
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
      width=canvas_width,
      height=canvas_height,
    )
    x = min(max(px - left, 0), width)
    y = min(max(py - upper, 0), height)
    records.append(
      {
        "name": str(row.get("name", "")),
        "role": str(row.get("role", "context")),
        "tourOrder": int(row.get("tour_order", 1_000)),
        "x": round(x, 2),
        "y": round(y, 2),
        "nx": round(x / width, 6) if width else 0,
        "ny": round(y / height, 6) if height else 0,
      }
    )
  return records


def write_wikimedia_attribution(out_dir: Path, manifest_path: Path) -> None:
  if not manifest_path.exists():
    return
  try:
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
  except (OSError, json.JSONDecodeError):
    return
  records = []
  for record in payload.get("records", []):
    if not isinstance(record, dict):
      continue
    records.append(
      {
        "landmark_id": record.get("landmark_id"),
        "title": record.get("title"),
        "page_url": record.get("page_url"),
        "license": record.get("license"),
        "license_url": record.get("license_url"),
        "artist": record.get("artist"),
        "credit": record.get("credit"),
      }
    )
  (out_dir / "wikimedia_attribution.json").write_text(
    json.dumps(
      {
        "source": "wikimedia",
        "note": "Visual material references only; geometry remains Berlin LoD2 and semantics remain OSM.",
        "records": records,
      },
      ensure_ascii=False,
      indent=2,
    )
    + "\n",
    encoding="utf-8",
  )


def load_overview_context(
  *, osm_path: Path, alkis_path: Path, tunnel_path: Path
) -> dict[str, gpd.GeoDataFrame]:
  """Load every surface and underground context layer used by the DZI."""
  layers = {
    layer: load_layer(osm_path, layer)
    for layer in ["roads", "water", "parks", "rail", "pois"]
  }
  layers["alkis"] = load_layer(alkis_path, "flurstuecke")
  layers["tunnel_routes"] = load_reference_geometries(tunnel_path)
  return layers


def render_overview(
  *,
  bounds_path: Path,
  buildings_path: Path,
  osm_path: Path,
  alkis_path: Path,
  tunnel_path: Path,
  landmarks_path: Path,
  wikimedia_references_path: Path,
  out_dir: Path,
  render_px: int,
  canvas_width: int,
  canvas_height: int,
  preview_max_width: int,
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
  osm_layers = load_overview_context(
    osm_path=osm_path,
    alkis_path=alkis_path,
    tunnel_path=tunnel_path,
  )
  landmarks = load_landmarks(landmarks_path)
  material_cues = load_wikimedia_material_cues(wikimedia_references_path)
  out_dir.mkdir(parents=True, exist_ok=True)
  source = render_quadrant(
    quad=quad,
    buildings=buildings,
    osm_layers=osm_layers,
    landmarks=landmarks,
    material_cues=material_cues,
    render_px=render_px,
    render_size=(canvas_width, canvas_height),
    context_m=margin_m,
    show_labels=False,
  )
  crop_bbox = (0, 0, source.width, source.height)
  dzi = out_dir / "regierungsviertel.dzi"
  export_dzi(source, dzi_path=dzi)

  preview_source = compact_preview(fit_preview(source, preview_max_width))
  source_path = out_dir / "overview_source.png"
  preview_source.save(source_path, optimize=True)
  pixel = Image.open(io.BytesIO(pixel_art_image(preview_source)))
  pixel_path = out_dir / "overview.png"
  pixel.save(pixel_path, optimize=True)
  (out_dir / "landmarks.json").write_text(
    json.dumps(
      {
        "image": {"width": source.width, "height": source.height},
        "landmarks": landmark_records(
          landmarks=landmarks,
          quad=quad,
          crop_bbox=crop_bbox,
          render_px=render_px,
          canvas_width=canvas_width,
          canvas_height=canvas_height,
          margin_m=margin_m,
        ),
      },
      ensure_ascii=False,
      indent=2,
    )
    + "\n",
    encoding="utf-8",
  )
  write_wikimedia_attribution(out_dir, wikimedia_references_path)
  write_preview(
    out_dir / "preview.html",
    title="Isometric Berlin Regierungsviertel",
    overview_path=source_path,
    dzi_path=dzi,
    extra_attribution=wikimedia_extra_attribution(wikimedia_references_path),
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
    "--alkis", type=Path, default=Path("geo_data/regierungsviertel/alkis.gpkg")
  )
  parser.add_argument(
    "--landmarks",
    type=Path,
    default=Path("geo_data/regierungsviertel/landmarks.geojson"),
  )
  parser.add_argument(
    "--tunnel-route",
    type=Path,
    default=Path("geo_data/regierungsviertel/tiergartentunnel.geojson"),
  )
  parser.add_argument(
    "--wikimedia-references",
    type=Path,
    default=Path("geo_data/regierungsviertel/wikimedia_references.json"),
  )
  parser.add_argument(
    "--out-dir",
    type=Path,
    default=Path("src/app/public/dzi/regierungsviertel"),
  )
  parser.add_argument("--render-px", type=int, default=DEFAULT_RENDER_PX)
  parser.add_argument("--canvas-width", type=int, default=DEFAULT_CANVAS_WIDTH)
  parser.add_argument("--canvas-height", type=int, default=DEFAULT_CANVAS_HEIGHT)
  parser.add_argument(
    "--preview-max-width", type=int, default=DEFAULT_PREVIEW_MAX_WIDTH
  )
  parser.add_argument("--margin-m", type=float, default=220)
  args = parser.parse_args()
  render_overview(
    bounds_path=args.bounds,
    buildings_path=args.buildings,
    osm_path=args.osm,
    alkis_path=args.alkis,
    tunnel_path=args.tunnel_route,
    landmarks_path=args.landmarks,
    wikimedia_references_path=args.wikimedia_references,
    out_dir=args.out_dir,
    render_px=args.render_px,
    canvas_width=args.canvas_width,
    canvas_height=args.canvas_height,
    preview_max_width=args.preview_max_width,
    margin_m=args.margin_m,
  )
  print(f"Wrote global isometric preview to {args.out_dir}")


if __name__ == "__main__":
  main()
