"""Replace only the false v194 shore strip over mapped Tegel harbour/fließ water.

All original triangle positions remain; only false land/bank faces are clipped.
Every untouched face, all old lake-water faces and all other sites stay exact.
The complete original Tegel site is preserved in a compressed derived receipt.
"""

from __future__ import annotations

import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from build_surrounding_outlines import native_polygon
from pyproj import Transformer
from shapely import constrained_delaunay_triangles
from shapely.geometry import LineString, MultiPolygon, Polygon, box, mapping, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
T = Transformer.from_crs(4326, 25833, always_xy=True).transform


def world(x: float, z: float) -> tuple[float, float]:
  a, b = T(x, z)
  return a - 389500, 5820000 - b


def masks() -> tuple[Polygon | MultiPolygon, Polygon | MultiPolygon]:
  """True source water only, bounded by the previously generated shore strip."""
  source = json.loads((GEO / "tegel-spandau-v198-source.json").read_text())
  water = unary_union(
    [
      transform(world, shape(f["geometry"]))
      for f in source["features"]
      if f["properties"].get("osm_way_id") in {"8659535", "228201346"}
    ]
  )
  original = json.loads((GEO / "west-lakes-v194-source.geojson").read_text())
  lake = transform(
    world,
    shape(
      next(
        f["geometry"]
        for f in original["features"]
        if f["properties"]["key"] == "tegel-water"
      )
    ),
  )
  extent = unary_union([Polygon(p.exterior) for p in lake.geoms]).buffer(22)
  drawn = water.intersection(extent).difference(lake)
  native = (
    native_polygon(drawn).simplify(0).difference(native_polygon(lake).simplify(0))
  )
  return drawn, native


def parts(g):
  return (
    [g]
    if g.geom_type == "Polygon"
    else [p for p in getattr(g, "geoms", []) if p.geom_type == "Polygon"]
  )


def repair() -> None:
  """Idempotent local face repair, no city regeneration or source substitution."""
  mask_pair = masks()
  receipt = {
    "version": "1.0.98",
    "waterOwners": ["way/8659535", "way/228201346"],
    "waterY": -1.15,
    "scopePolicy": "Complete additional owners retained, display only intersection with existing v19422m shore band; old lake triangles and all other sites unchanged.",
    "modes": {},
  }
  for mode, filename, mask in zip(
    ["drawn", "native"], ["westLakesV194.json", "westLakesV194Native.json"], mask_pair
  ):
    path = DATA / filename
    runtime = json.loads(path.read_text())
    archive = GEO / f"tegel-spandau-v198-original-{mode}.json.gz"
    if not archive.exists():
      archive.write_bytes(
        gzip.compress(
          json.dumps(runtime["sites"][0], separators=(",", ":")).encode(), mtime=0
        )
      )
    site = json.loads(gzip.decompress(archive.read_bytes()))
    before = json.loads(json.dumps(site))
    positions = np.array(site["positions"]).reshape(-1, 3)
    output = []
    removed = []
    untouched = 0
    for start in range(0, len(site["indices"]), 3):
      indices = site["indices"][start : start + 3]
      tri = positions[indices]
      if max(tri[:, 1]) < -1.14:
        output.extend(indices)
        untouched += 1
        continue
      # Horizontal surfaces use exact source-water footprint intersection.
      flat = np.ptp(tri[:, 1]) < 1e-5
      if flat:
        triangle = Polygon(tri[:, [0, 2]])
        if triangle.intersection(mask).area < 1e-9:
          output.extend(indices)
          untouched += 1
          continue
        remaining = triangle.difference(mask)

        def lift(x, z):
          return [x, float(tri[0, 1]), z]
      else:
        # A bank wall projects to a line, so clip in local horizontal-distance/Y
        # coordinates. Keep the exact original sloped diagonal and surviving
        # portions, never replace it with a full rectangular new bank.
        axis = int(np.argmax(np.ptp(tri[:, [0, 2]], axis=0))) * 2
        other = 2 - axis
        lo = int(np.argmin(tri[:, axis]))
        hi = int(np.argmax(tri[:, axis]))
        if tri[hi, axis] - tri[lo, axis] < 1e-7:
          output.extend(indices)
          untouched += 1
          continue
        line = LineString([tri[lo, [0, 2]], tri[hi, [0, 2]]])
        intersection = line.intersection(mask.buffer(0.002))
        lines = (
          [intersection]
          if intersection.geom_type == "LineString"
          else [
            p for p in getattr(intersection, "geoms", []) if p.geom_type == "LineString"
          ]
        )
        cuts = []
        for segment in lines:
          values = [p[0 if axis == 0 else 1] for p in segment.coords]
          if values and max(values) - min(values) > 1e-7:
            cuts.append(box(min(values), -2, max(values), 4))
        if not cuts:
          output.extend(indices)
          untouched += 1
          continue
        triangle = Polygon(tri[:, [axis, 1]])
        remaining = triangle.difference(unary_union(cuts))

        def lift(u, y):
          t = (u - tri[lo, axis]) / (tri[hi, axis] - tri[lo, axis])
          v = tri[lo, other] + t * (tri[hi, other] - tri[lo, other])
          return [u, y, v] if axis == 0 else [v, y, u]

      removed.append(start // 3)
      color = site["colors"][indices[0]]
      for p in parts(remaining):
        for t in constrained_delaunay_triangles(p).geoms:
          for uv in list(t.exterior.coords)[:3]:
            output.append(len(site["positions"]) // 3)
            site["positions"].extend([round(float(v), 5) for v in lift(*uv)])
            site["colors"].append(color)
    site["indices"] = output
    runtime["sites"][0] = site
    path.write_text(json.dumps(runtime, separators=(",", ":")) + "\n")
    receipt["modes"][mode] = {
      "archive": archive.name,
      "archiveSha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
      "repairedFile": filename,
      "repairedSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
      "modifiedTriangleIndices": removed,
      "untouchedTriangles": untouched,
      "mask": mapping(mask),
      "maskAreaM2": mask.area,
      "previousVerticesRetained": len(before["positions"]) // 3,
      "unchangedOtherSitesHashes": [
        hashlib.sha256(json.dumps(s, separators=(",", ":")).encode()).hexdigest()
        for s in runtime["sites"][1:]
      ],
    }
  (GEO / "tegel-spandau-v198-shore-repair.json").write_text(
    json.dumps(receipt, separators=(",", ":")) + "\n"
  )
  print(
    {
      k: {
        "maskAreaM2": v["maskAreaM2"],
        "changedFalseShoreFaces": len(v["modifiedTriangleIndices"]),
      }
      for k, v in receipt["modes"].items()
    }
  )


if __name__ == "__main__":
  repair()
