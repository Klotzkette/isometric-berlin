"""Fetch optional Berlin official support layers (ALKIS, DOP, DGM).

These layers are additive fusion inputs. The command keeps raw service
metadata under ``geo_data/regierungsviertel/raw/<layer>/`` and writes
small derived artefacts next to the other clipped project data:

- ``alkis.gpkg``: clipped ALKIS parcel features from the public WFS.
- ``dop_preview.png``: low-resolution DOP WMS reference image.
- ``dgm_preview.png``: low-resolution DGM hillshade/reference image.

Large raw raster ZIPs remain referenced in the per-layer manifest and
are not downloaded by default.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import geopandas as gpd

from isometric_berlin.data.common import (
  BERLIN_PROJECTED,
  load_bounds_polygon,
  project_geometry,
)

USER_AGENT = "isometric-berlin/0.1 (Klotzkette)"
VALID_LAYERS = ("alkis", "dop", "dgm")

ALKIS_WFS = "https://gdi.berlin.de/services/wfs/alkis_flurstuecke"
DOP_WMS = "https://gdi.berlin.de/services/wms/dop_2025_fruehjahr"
DOP_ATOM = "https://gdi.berlin.de/data/dop_2025_fruehjahr/atom/"
DGM_WMS = "https://gdi.berlin.de/services/wms/dgm1"
DGM_ATOM = "https://gdi.berlin.de/data/dgm1/atom/"


def parse_layers(value: str) -> list[str]:
  """Parse and validate a comma-separated support-layer selection."""
  layers = [item.strip().lower() for item in value.split(",") if item.strip()]
  unknown = sorted(set(layers) - set(VALID_LAYERS))
  if unknown:
    raise ValueError(f"Unknown support layer(s): {', '.join(unknown)}")
  return list(dict.fromkeys(layers))


def bounds_25833(bounds_path: Path) -> tuple[float, float, float, float]:
  """Return the project bounds as an EPSG:25833 bbox."""
  return project_geometry(load_bounds_polygon(bounds_path)).bounds


def request_bytes(url: str, *, timeout: int) -> tuple[bytes, str]:
  """Download a public URL using the project user agent."""
  request = Request(url, headers={"User-Agent": USER_AGENT})
  with urlopen(request, timeout=timeout) as response:
    return response.read(), response.headers.get_content_type()


def write_download(url: str, path: Path, *, timeout: int) -> dict[str, Any]:
  """Download a URL to disk and return manifest metadata."""
  data, content_type = request_bytes(url, timeout=timeout)
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_bytes(data)
  return {
    "url": url,
    "path": str(path),
    "bytes": len(data),
    "content_type": content_type,
  }


def service_url(base_url: str, params: dict[str, str]) -> str:
  return f"{base_url}?{urlencode(params)}"


def wms_getmap_url(
  *,
  service: str,
  layer: str,
  bbox: tuple[float, float, float, float],
  width: int = 900,
  image_format: str = "image/png",
) -> str:
  """Build a WMS 1.3.0 GetMap URL for the EPSG:25833 project bbox."""
  minx, miny, maxx, maxy = bbox
  aspect = max((maxy - miny) / (maxx - minx), 0.1)
  height = min(max(int(round(width * aspect)), 256), 2048)
  return service_url(
    service,
    {
      "SERVICE": "WMS",
      "VERSION": "1.3.0",
      "REQUEST": "GetMap",
      "LAYERS": layer,
      "STYLES": "",
      "CRS": BERLIN_PROJECTED,
      "BBOX": f"{minx},{miny},{maxx},{maxy}",
      "WIDTH": str(width),
      "HEIGHT": str(height),
      "FORMAT": image_format,
      "TRANSPARENT": "FALSE",
    },
  )


def dgm_tile_codes(bbox: tuple[float, float, float, float]) -> list[str]:
  """Return DGM 2 km tile codes intersecting a bbox."""
  minx, miny, maxx, maxy = bbox

  def even_km_range(min_m: float, max_m: float) -> range:
    start = math.floor((min_m / 1000.0) / 2.0) * 2
    end = math.floor(((max_m - 0.001) / 1000.0) / 2.0) * 2
    return range(int(start), int(end) + 1, 2)

  return [
    f"{x}_{y}" for x in even_km_range(minx, maxx) for y in even_km_range(miny, maxy)
  ]


def write_manifest(layer_dir: Path, payload: dict[str, Any]) -> None:
  layer_dir.mkdir(parents=True, exist_ok=True)
  (layer_dir / "manifest.json").write_text(
    json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
  )


def fetch_alkis(
  *, bounds_path: Path, raw_root: Path, geo_dir: Path, timeout: int
) -> dict[str, Any]:
  """Fetch and clip ALKIS parcels for the project bounds."""
  bbox = bounds_25833(bounds_path)
  layer_dir = raw_root / "alkis"
  downloads = [
    write_download(
      service_url(ALKIS_WFS, {"request": "GetCapabilities", "service": "WFS"}),
      layer_dir / "alkis_flurstuecke_capabilities.xml",
      timeout=timeout,
    )
  ]
  feature_url = service_url(
    ALKIS_WFS,
    {
      "service": "WFS",
      "version": "2.0.0",
      "request": "GetFeature",
      "typenames": "alkis_flurstuecke:flurstuecke",
      "outputFormat": "application/json",
      "srsName": BERLIN_PROJECTED,
      "bbox": f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]},{BERLIN_PROJECTED}",
      "count": "10000",
    },
  )
  raw_geojson = layer_dir / "flurstuecke.geojson"
  downloads.append(write_download(feature_url, raw_geojson, timeout=timeout))

  parcels = gpd.read_file(raw_geojson)
  if parcels.crs is None:
    parcels = parcels.set_crs(BERLIN_PROJECTED)
  parcels = parcels.to_crs(BERLIN_PROJECTED)
  clipped = gpd.clip(parcels, project_geometry(load_bounds_polygon(bounds_path)))
  clipped = clipped[clipped.geometry.notna() & ~clipped.geometry.is_empty].copy()
  derived = geo_dir / "alkis.gpkg"
  if derived.exists():
    derived.unlink()
  clipped.to_file(derived, layer="flurstuecke", driver="GPKG")

  manifest = {
    "source": "alkis",
    "available": True,
    "license": "dl-de/zero-2-0",
    "downloads": downloads,
    "derived": {"path": str(derived), "feature_count": len(clipped)},
  }
  write_manifest(layer_dir, manifest)
  return manifest


def fetch_dop(
  *,
  bbox: tuple[float, float, float, float],
  raw_root: Path,
  geo_dir: Path,
  timeout: int,
) -> dict[str, Any]:
  """Fetch DOP service metadata and a small WMS preview."""
  layer_dir = raw_root / "dop"
  downloads = [
    write_download(DOP_ATOM, layer_dir / "atom.xml", timeout=timeout),
    write_download(f"{DOP_ATOM}0.atom", layer_dir / "atom_0.xml", timeout=timeout),
    write_download(
      service_url(DOP_WMS, {"request": "GetCapabilities", "service": "WMS"}),
      layer_dir / "dop_2025_capabilities.xml",
      timeout=timeout,
    ),
  ]
  preview = geo_dir / "dop_preview.png"
  downloads.append(
    write_download(
      wms_getmap_url(service=DOP_WMS, layer="dop_2025", bbox=bbox),
      preview,
      timeout=timeout,
    )
  )
  manifest = {
    "source": "dop",
    "available": True,
    "license": "dl-de/zero-2-0",
    "downloads": downloads[:-1],
    "derived": {"path": str(preview), "bytes": preview.stat().st_size},
    "raw_tile_archives": [f"{DOP_ATOM}Mitte.zip"],
  }
  write_manifest(layer_dir, manifest)
  return manifest


def fetch_dgm(
  *,
  bbox: tuple[float, float, float, float],
  raw_root: Path,
  geo_dir: Path,
  timeout: int,
) -> dict[str, Any]:
  """Fetch DGM service metadata, relevant tile refs, and a WMS preview."""
  layer_dir = raw_root / "dgm"
  downloads = [
    write_download(DGM_ATOM, layer_dir / "atom.xml", timeout=timeout),
    write_download(f"{DGM_ATOM}0.atom", layer_dir / "atom_0.xml", timeout=timeout),
    write_download(
      service_url(DGM_WMS, {"request": "GetCapabilities", "service": "WMS"}),
      layer_dir / "dgm1_capabilities.xml",
      timeout=timeout,
    ),
  ]
  preview = geo_dir / "dgm_preview.png"
  downloads.append(
    write_download(
      wms_getmap_url(service=DGM_WMS, layer="b_dgm1_schummerung,c_dgm1", bbox=bbox),
      preview,
      timeout=timeout,
    )
  )
  tile_codes = dgm_tile_codes(bbox)
  manifest = {
    "source": "dgm",
    "available": True,
    "license": "dl-de/zero-2-0",
    "downloads": downloads[:-1],
    "derived": {"path": str(preview), "bytes": preview.stat().st_size},
    "raw_tile_archives": [f"{DGM_ATOM}DGM1_{code}.zip" for code in tile_codes],
  }
  write_manifest(layer_dir, manifest)
  return manifest


def fetch_layers(
  *, bounds_path: Path, layers: list[str], out_dir: Path, timeout: int
) -> dict[str, Any]:
  """Fetch selected official support layers and return a summary."""
  bbox = bounds_25833(bounds_path)
  geo_dir = out_dir.parent
  summary: dict[str, Any] = {}
  for layer in layers:
    try:
      if layer == "alkis":
        summary[layer] = fetch_alkis(
          bounds_path=bounds_path, raw_root=out_dir, geo_dir=geo_dir, timeout=timeout
        )
      elif layer == "dop":
        summary[layer] = fetch_dop(
          bbox=bbox, raw_root=out_dir, geo_dir=geo_dir, timeout=timeout
        )
      elif layer == "dgm":
        summary[layer] = fetch_dgm(
          bbox=bbox, raw_root=out_dir, geo_dir=geo_dir, timeout=timeout
        )
    except Exception as exc:
      layer_dir = out_dir / layer
      manifest = {
        "source": layer,
        "available": False,
        "reason": f"{type(exc).__name__}: {exc}",
      }
      write_manifest(layer_dir, manifest)
      summary[layer] = manifest
  return summary


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--bounds", type=Path, required=True)
  parser.add_argument(
    "--layers",
    default="alkis,dop,dgm",
    help="Comma-separated subset of alkis,dop,dgm.",
  )
  parser.add_argument(
    "--out-dir",
    type=Path,
    default=Path("geo_data/regierungsviertel/raw"),
  )
  parser.add_argument("--timeout", type=int, default=60)
  args = parser.parse_args()

  layers = parse_layers(args.layers)
  summary = fetch_layers(
    bounds_path=args.bounds,
    layers=layers,
    out_dir=args.out_dir,
    timeout=args.timeout,
  )
  status = ", ".join(
    f"{layer}={'available' if payload.get('available') else 'unavailable'}"
    for layer, payload in summary.items()
  )
  print(f"Wrote official support layer manifests: {status}")


if __name__ == "__main__":
  main()
