"""Offline additive tropical-hall roof from retained OSM and official heights.

The old 125-sheet LoD2 owner is never edited or retired. The new roof is an
interpolated surface, not a claim to surveyed glass panels or construction ribs.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import pyogrio
from scipy.interpolate import LinearNDInterpolator
from scipy.spatial import Delaunay
from shapely.geometry import Point, Polygon
from shapely.ops import triangulate

ROOT = Path(__file__).resolve().parents[1]
SAMPLES = ROOT / "geo_data/regierungsviertel/brehm-tropical-hall-v282-samples.json.gz"
OSM = ROOT / "geo_data/regierungsviertel/raw/east-v187/candidate.gpkg"
OLD = ROOT / "geo_data/regierungsviertel/east-landmarks-v187-evidence.json"
LOD2 = ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_400_5817.zip"
PACKETS = ROOT / "geo_data/regierungsviertel/raw/outskirts-v187/packets"
RUNTIME = ROOT / "src/app/src/data/brehmTropicalHallV282.json"
RECEIPT = ROOT / "geo_data/regierungsviertel/brehm-tropical-hall-v282-receipt.json"
PARENT = "DEBE11YYI0000Nxm"
GROUND = 3.0


def digest(path: Path) -> str:
  """Fingerprint retained, immutable evidence."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def encode(value: object) -> bytes:
  """Canonical, compact on-disk representation."""
  return (json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n").encode()


def polygons(shape):
  """Return only nonempty area fragments of a clipped roof triangle."""
  if shape.is_empty:
    return []
  if shape.geom_type == "Polygon":
    return [shape]
  return [p for child in getattr(shape, "geoms", []) for p in polygons(child)]


def build() -> tuple[dict, dict]:
  """Constrain interpolation to the exact upper ring; rasterise native anew."""
  retained = json.loads(gzip.decompress(SAMPLES.read_bytes()))
  assert len(retained["samples"]) == 199
  assert digest(OSM) == retained["footprint"]["sha256"]
  record = (
    pyogrio.read_dataframe(OSM, layer="lines", where="osm_id='520730043'")
    .to_crs(25833)
    .iloc[0]
  )
  assert record.geometry.is_ring
  source_ring = list(record.geometry.coords)[:-1]
  assert len(source_ring) == 16
  assert np.allclose(source_ring, retained["footprint"]["coords"][:-1], atol=1e-8)
  ring = [[x - 389500, 5820000 - y] for x, y in source_ring]
  polygon = Polygon(ring)
  old = json.loads(OLD.read_bytes())
  body = next(p for p in old["sourceProfiles"] if p["id"] == PARENT)["parts"][0]
  owner = next(p for p in old["owners"] if p["id"] == PARENT)
  assert len(body["surfaces"]) == 125
  assert Polygon(body["ring"], body["holes"]).contains(polygon)
  bottom = round(body["top_y_m"] + owner["rigidYOffset"], 3)
  assert bottom == 11.071
  terrain = [s["heightNHN"] for s in retained["samples"] if s["service"] == "dgm1"]
  datum = float(np.median(terrain))
  assert len(terrain) == 19 and datum == 38.31
  # Pixels within two metres of a vertical roof edge mix the low surrounding
  # roof and upper wall. Keep them as evidence, never as fabricated roof dips.
  safe = [
    s
    for s in retained["samples"]
    if s.get("role") in ("interior-grid", "ridge-refinement")
    and polygon.boundary.distance(Point(s["x"] - 389500, 5820000 - s["y"])) > 2
  ]
  low_band = [s["heightNHN"] for s in safe if s["heightNHN"] <= 50.5]
  eave_nhn = float(np.median(low_band))
  assert len(low_band) == 52 and eave_nhn == 50.125
  # Robust perimeter estimate supported by the nearly level outer roof band.
  # The sample elevations themselves are neither smoothed nor capped.
  points = np.array(ring + [[s["x"] - 389500, 5820000 - s["y"]] for s in safe])
  heights = np.array([eave_nhn] * len(ring) + [s["heightNHN"] for s in safe])
  mesh = Delaunay(points)
  interpolation = LinearNDInterpolator(mesh, heights)
  roof_vertices, roof_indices, lookup = [], [], {}

  def vertex(x, z, height):
    p = (round(x, 3), round(GROUND + height - datum, 3), round(z, 3))
    if p not in lookup:
      lookup[p] = len(roof_vertices)
      roof_vertices.append(list(p))
    return lookup[p]

  # Delaunay alone spans the concave Y arms. Clip every simplex to the retained
  # footprint; interpolate new edge points on that same original source plane.
  for simplex in mesh.simplices:
    xy, elevation = points[simplex], heights[simplex]
    coefficients = np.linalg.solve(np.column_stack((xy, np.ones(3))), elevation)
    for clipped in polygons(Polygon(xy).intersection(polygon)):
      for triangle in triangulate(clipped):
        if triangle.difference(clipped).area > 1e-9 or triangle.area < 1e-9:
          continue
        coords = list(triangle.exterior.coords)[:3]
        ids = [vertex(x, z, coefficients @ [x, z, 1]) for x, z in coords]
        # XZ winding reverses the conventional XY upward normal.
        a, b, c = [roof_vertices[i] for i in ids]
        if np.cross(np.subtract(b, a), np.subtract(c, a))[1] < 0:
          ids.reverse()
        roof_indices.append(ids)

  # Independent cardinal solid columns from source interpolation at 1m cell
  # centres. Half-metre upward quantisation protects the represented roof.
  columns = []
  xmin, zmin, xmax, zmax = polygon.bounds
  for iz in range(math.floor(zmin), math.ceil(zmax)):
    for ix in range(math.floor(xmin), math.ceil(xmax)):
      if polygon.covers(Point(ix + 0.5, iz + 0.5)):
        height = float(interpolation([[ix + 0.5, iz + 0.5]])[0])
        assert math.isfinite(height)
        columns.append([ix, iz, math.ceil((GROUND + height - datum) * 2) / 2])
  runs = []
  for x, z, top in columns:
    if (
      runs
      and runs[-1][1] == z
      and runs[-1][0] + runs[-1][2] == x
      and runs[-1][3] == top
    ):
      runs[-1][2] += 1
    else:
      runs.append([x, z, 1, top])
  packet_paths = [
    PACKETS / f"outer187-21_4.{mode}.json.gz" for mode in ("drawn", "minecraft")
  ]
  packets = [json.loads(gzip.decompress(path.read_bytes())) for path in packet_paths]
  parent_records = [
    next(b for b in p["nav"]["buildings"] if b.get("partId") == PARENT) for p in packets
  ]
  assert parent_records[0] == parent_records[1]
  assert all(
    p["origin"] == [10752, -10, 2048] and p["nav"]["groundY"] == GROUND for p in packets
  )
  parent_guard = {
    key: parent_records[0][key]
    for key in ("ring", "holes", "height", "minHeight", "sourceId", "partId")
  }
  runtime = dict(
    schemaVersion=1,
    sourceId="osm/520730043+bdom",
    parentId=PARENT,
    packetId="outer187-21_4",
    ring=[[round(x, 3), round(z, 3)] for x, z in ring],
    bottomY=bottom,
    eaveY=round(GROUND + eave_nhn - datum, 3),
    maxY=round(GROUND + float(max(heights)) - datum, 3),
    parentGuard=parent_guard,
    packetOrigin=packets[0]["origin"],
    groundY=GROUND,
    roofVertices=roof_vertices,
    roofIndices=roof_indices,
    nativeBottomY=math.floor(bottom),
    nativeMaxY=max(c[2] for c in columns),
    nativeRuns=runs,
    nativeBounds=[
      min(c[0] for c in columns),
      min(c[1] for c in columns),
      max(c[0] for c in columns) + 1,
      max(c[1] for c in columns) + 1,
    ],
  )
  receipt = dict(
    schemaVersion=1,
    retiredOwners=[],
    parentId=PARENT,
    packetId=runtime["packetId"],
    sourceId="way/520730043",
    sourceRing25833=source_ring,
    sourceAreaM2=polygon.area,
    preservedSheets=125,
    originalBodySha256=hashlib.sha256(encode(body)).hexdigest(),
    preservedInputs={
      str(p.relative_to(ROOT)): digest(p) for p in [OSM, LOD2, OLD, *packet_paths]
    },
    samplesPath=str(SAMPLES.relative_to(ROOT)),
    samplesSha256=digest(SAMPLES),
    samples=199,
    bdomSamples=180,
    terrainSamples=19,
    safeRoofSamples=len(safe),
    safeRoofMarginM=2,
    safePoints=[[s["x"] - 389500, 5820000 - s["y"], s["heightNHN"]] for s in safe],
    terrainMedianNHN=datum,
    terrainRangeNHN=[min(terrain), max(terrain)],
    displayGroundY=GROUND,
    heightAboveTerrain=float(max(heights)) - datum,
    estimatedEaveNHN=eave_nhn,
    eaveSupportingPoints=52,
    peakNHN=float(max(heights)),
    preservedBodyTopY=bottom,
    nativeCellM=1,
    nativeVerticalStepM=0.5,
    nativeColumns=len(columns),
    limits=[
      "Roof is constrained interpolation of official 1m surface raster sampled on a 3m grid with a refined apex; not surveyed construction planes.",
      "Perimeter eave is a robust 50.125m NHN estimate from 52 nearly level roof-band points; pixels within 2m of vertical edges are excluded from interpolation.",
      "DGM median 38.31m is aligned to the existing park's 3m datum. The older body's basement-based translation is deliberately not reused for this upper roof.",
      "The original lower owner remains unchanged. The new side walls begin at its existing flat roof, so lower proportions remain those of the retained model.",
      "Colours and understated glazing treatment are illustrative. No steel/glass panel spacing is claimed as measured.",
    ],
    references=[
      "https://gdi.berlin.de/services/wms/bdom",
      "https://gdi.berlin.de/services/wms/dgm1",
      "https://www.klimaschutzpartner-berlin.de/projekt/energetische-sanierung-des-alfred-brehm-hauses-im-tierpark-berlin-76",
      "https://danpearlman.com/work/alfred-brehm-haus/",
      "https://www.haas-architekten.de/projekte/glashaeuser/alfred-brehm-haus-im-tierpark-berlin",
      "https://www.tierpark-berlin.de/de/tierpark-erleben/tiere-erlebniswelten/regenwaldhaus",
    ],
  )
  assert len(safe) == 118 and runtime["maxY"] == 18.91
  return runtime, receipt


def main():
  """Rebuild or verify deterministic, offline outputs."""
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--check", action="store_true")
  args = parser.parse_args()
  runtime, receipt = build()
  for path, value in [(RUNTIME, runtime), (RECEIPT, receipt)]:
    body = encode(value)
    if args.check:
      assert path.read_bytes() == body, path
    else:
      path.write_bytes(body)
  print(
    json.dumps(
      {
        "vertices": len(runtime["roofVertices"]),
        "triangles": len(runtime["roofIndices"]),
        "nativeRuns": len(runtime["nativeRuns"]),
        "nativeColumns": receipt["nativeColumns"],
        "bytes": len(encode(runtime)),
        "top": runtime["maxY"],
      }
    )
  )


if __name__ == "__main__":
  main()
