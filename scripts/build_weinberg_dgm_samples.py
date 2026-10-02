"""Step 4: retain a bounded, reproducible extract of Berlin's official DGM1."""

from __future__ import annotations

import hashlib
import json
import math
import zipfile
from pathlib import Path
from typing import Any

import numpy as np
import requests

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "geo_data/regierungsviertel/raw/dgm/weinberg-v176"
DEST = ROOT / "geo_data/regierungsviertel/weinberg-v176/dgm-samples.json"
BASE_URL = "https://gdi.berlin.de/data/dgm1/atom/"
SOURCE_HASHES = {
  "390_5820": "f6c3abb0ea62d4ee77e37f0319443a55cd9db9ccef0bd13d85017501cac3d8e7",
  "390_5822": "0f9e931d78265dce12c12eddc73d1eba3155f92bf3720f69b3a8f3b216f8b176",
  "392_5820": "2ad2b40e73bcf3e0152e166bc95fc6d000328a1a72894b0df963268fc3f55952",
  "392_5822": "6e2a3c11706c08081b6d61813d82a430a69732a974c487ebf9d3f22498714723",
}
GRID = {
  "minX": 1600.5,
  "minZ": -2600.5,
  "stepM": 10,
  "width": 161,
  "height": 161,
  "order": "heightsNHN[zIndex][xIndex]; x and z increase with index",
}
# OSM/LoD2 coordinates locate each query only. The quoted height is exclusively
# the original DGM1 sample at the nearest 1 m source cell centre.
POINTS = [
  ("Rosenthaler Platz", 2049.95, -1157.12, "OSM way/572780583 centroid"),
  ("Weinbergsweg lower", 2076.09, -1209.44, "OSM way/1122497068 centroid"),
  ("Weinbergsweg middle", 2183.45, -1400.91, "OSM way/16571799 centroid"),
  ("Weinbergsweg / Kastanienallee", 2266.59, -1534.38, "OSM road endpoint"),
  ("Weinbergspark centre", 2080.99, -1448.66, "OSM way/104954713 centroid"),
  ("Weinbergspark Plansche", 2132.33, -1408.48, "OSM way/1040831626 centroid"),
  ("Weinbergspark blue playground", 2187.5, -1516.0, "retained v174 surface"),
  ("Zionskirche", 2231.897, -1706.217, "LoD2 DEBE01YYK0000014 centroid"),
  (
    "Kastanienallee 49 / former Cafe 103",
    2312.765,
    -1659.195,
    "LoD2 DEBE01YYK0000CIk centroid",
  ),
  ("Kastanienallee 50", 2288.836, -1630.581, "LoD2 DEBE01YYK00005G6 centroid"),
  ("Zionskirchstrasse 21", 2166.761, -1755.317, "LoD2 DEBE01YYK0000C4w centroid"),
  ("Zionskirchstrasse 22/24", 2160.697, -1702.196, "LoD2 DEBE01YYK00008CV centroid"),
  ("Kastanienallee north", 2617.91, -2091.44, "OSM way/344753256 centroid"),
  (
    "Kastanienallee before Schoenhauser Allee",
    2782.61,
    -2336.56,
    "OSM way/30123475 centroid",
  ),
  ("Pappelallee beginning", 2834.42, -2409.61, "OSM way/41931377 centroid"),
  ("Pappelallee north", 2925.71, -2543.74, "OSM way/86208414 centroid"),
]


def tile_code(easting: float, northing: float) -> str:
  """Identify the official 2 km tile containing an EPSG:25833 coordinate."""
  return f"{math.floor(easting / 2000) * 2}_{math.floor(northing / 2000) * 2}"


def sample_height(
  tiles: dict[str, np.ndarray], x: float, z: float
) -> tuple[float, float, float, str]:
  """Return original NHN height and nearest source centre in viewer x/z."""
  east, north = 389500 + x, 5820000 - z
  code = tile_code(east, north)
  base_east, base_north = (int(v) * 1000 for v in code.split("_"))
  ix, iz = math.floor(east - base_east), math.floor(north - base_north)
  height = float(tiles[code][iz, ix])
  source_x = base_east + ix + 0.5 - 389500
  source_z = 5820000 - (base_north + iz + 0.5)
  return round(height, 2), source_x, source_z, code


def load_tiles(raw: Path = RAW) -> tuple[dict[str, np.ndarray], list[dict[str, Any]]]:
  """Read only four bounded archives and fail if the pinned source changed."""
  raw.mkdir(parents=True, exist_ok=True)
  tiles, files = {}, []
  for code, expected_hash in SOURCE_HASHES.items():
    archive = raw / f"DGM1_{code}.zip"
    url = BASE_URL + archive.name
    if not archive.exists():
      response = requests.get(url, timeout=120)
      response.raise_for_status()
      archive.write_bytes(response.content)
    actual_hash = hashlib.sha256(archive.read_bytes()).hexdigest()
    if actual_hash != expected_hash:
      raise ValueError(f"DGM source changed: {archive.name}; review before accepting")
    with zipfile.ZipFile(archive) as zipped:
      expected_member = f"dgm1_33_{code}_2_be.xyz"
      if zipped.namelist() != [expected_member]:
        raise ValueError(f"Unexpected DGM1 archive members: {archive.name}")
      with zipped.open(expected_member) as stream:
        xyz = np.loadtxt(stream)
    base_east, base_north = (int(v) * 1000 for v in code.split("_"))
    if xyz.shape != (4_000_000, 3):
      raise ValueError(f"Unexpected DGM1 sample count: {archive.name}")
    expected_east = np.arange(2000) + base_east + 0.5
    expected_north = np.arange(2000) + base_north + 0.5
    if not np.array_equal(
      xyz[:, 0].reshape(2000, 2000), np.broadcast_to(expected_east, (2000, 2000))
    ):
      raise ValueError(f"Unexpected DGM1 easting order: {archive.name}")
    if not np.array_equal(
      xyz[:, 1].reshape(2000, 2000),
      np.broadcast_to(expected_north[:, None], (2000, 2000)),
    ):
      raise ValueError(f"Unexpected DGM1 northing order: {archive.name}")
    tiles[code] = xyz[:, 2].reshape(2000, 2000).copy()
    files.append(
      {
        "tile": code,
        "sourceUrl": url,
        "archiveSha256": actual_hash,
        "archiveBytes": archive.stat().st_size,
        "member": expected_member,
        "sampleCount": 4_000_000,
      }
    )
  return tiles, files


def build_payload(
  tiles: dict[str, np.ndarray], files: list[dict[str, Any]]
) -> dict[str, Any]:
  """Preserve sampled heights without display offsets, filtering or smoothing."""
  heights = [
    [
      sample_height(
        tiles, GRID["minX"] + ix * GRID["stepM"], GRID["minZ"] + iz * GRID["stepM"]
      )[0]
      for ix in range(GRID["width"])
    ]
    for iz in range(GRID["height"])
  ]
  points = []
  for name, x, z, location_source in POINTS:
    nhn, source_x, source_z, tile = sample_height(tiles, x, z)
    points.append(
      {
        "name": name,
        "queryWorldXZ": [x, z],
        "sourceWorldXZ": [source_x, source_z],
        "heightNHN": nhn,
        "worldYAtNHNMinus30": round(nhn - 30, 2),
        "sourceTile": tile,
        "locationSource": location_source,
      }
    )
  return {
    "schemaVersion": 1,
    "name": "Weinbergspark, Zionskirche and Kastanienallee DGM1 extract",
    "source": "Geoportal Berlin / ATKIS DGM1",
    "sourceUrl": BASE_URL,
    "metadataUrl": "https://gdi.berlin.de/geonetwork/srv/ger/csw?"
    "REQUEST=GetRecordById&SERVICE=CSW&VERSION=2.0.2&"
    "ID=f0e8ff09-2887-3446-9c53-81dbc45af03c&ELEMENTSETNAME=full",
    "datumUrl": "https://www.berlin.de/sen/stadt/stadtdaten/geoinformation/"
    "landesvermessung/geotopographie-atkis/dgm-digitale-gelaendemodelle/",
    "license": "dl-de/zero-2-0",
    "licenseUrl": "https://www.govdata.de/dl-de/zero-2-0",
    "licenseMetadataUrl": "https://daten.berlin.de/datensaetze/"
    "atkis-dgm-digitales-gelandemodell-wms-b0485f06",
    "horizontalCrs": "EPSG:25833",
    "verticalDatum": "DHHN2016 / NHN, EPSG:7837",
    "sourceResolutionM": 1,
    "sourceHeightStorageResolutionM": 0.01,
    "sourceHistory": "ALS 2021-02-24, 2021-02-25, 2021-03-02; photogrammetric "
    "updates from image flights 03/2022, 04/2023, 03/2025, 08/2025",
    "sourceArchiveLastModified": "2026-01-23",
    "sourceRetrievedOn": "2026-10-03",
    "worldTransform": {
      "x": "Easting - 389500",
      "z": "5820000 - Northing",
      "y": "NHN - 30; no presentation transform applied here",
    },
    "sampling": "Every tenth original 1 m source cell centre. Original "
    "centimetre heights retained without interpolation or smoothing.",
    "uncertainty": [
      "A 10 m subset cannot preserve all 1 m landform or step detail.",
      "The source storage precision of 0.01 m is not a stated survey accuracy.",
      "DGM is bare-earth terrain: buildings and vegetation are removed. "
      "Samples inside building footprints are modelled terrain, not floor surveys.",
      "The metadata update dates describe the whole source; an individual cell's "
      "acquisition date is not supplied.",
      "Any blending into the existing scene's flat outer ground is a separate "
      "presentation transform, not part of these source samples.",
    ],
    "grid": GRID,
    "heightsNHN": heights,
    "heightRangeNHN": [min(map(min, heights)), max(map(max, heights))],
    "namedSamples": points,
    "sourceFiles": files,
  }


def main() -> None:
  """Write the small derived evidence file; raw tiles remain gitignored."""
  tiles, files = load_tiles()
  payload = build_payload(tiles, files)
  DEST.parent.mkdir(parents=True, exist_ok=True)
  DEST.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
  print(
    json.dumps(
      {
        "output": str(DEST.relative_to(ROOT)),
        "bytes": DEST.stat().st_size,
        "rangeNHN": payload["heightRangeNHN"],
        "namedSamples": payload["namedSamples"],
      },
      indent=2,
    )
  )


if __name__ == "__main__":
  main()
