"""Independent, read-only spatial audit of the generated V347 cemetery overlays."""

from __future__ import annotations

import base64
import json
import sys
from collections import defaultdict
from functools import lru_cache
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import build_sacred_places_v347 as b  # noqa: E402
import numpy as np
import shapely
from shapely.geometry import box, shape
from shapely.ops import unary_union


@lru_cache(maxsize=2)
def module(path: str):
  return b.read(Path(path))


def review() -> dict:
  source = b.read(b.GEO / "sacred-places-v347-inventory.json.gz")
  evidence = b.read(b.GEO / "sacred-places-v347-evidence.json.gz")
  cemeteries = unary_union(
    [shapely.make_valid(shape(r["geometry"])) for r in source["cemeteries"]]
  )
  paths = [
    r
    for r in source["details"]
    if r["tags"].get("highway") in {"path", "footway", "pedestrian", "service"}
  ]
  routes = []
  for record in paths:
    width = b.road_width_m(record["tags"])
    if width is not None and 0.3 <= width <= 8:
      routes.append(
        shape(record["geometry"]).buffer(width / 2, cap_style="flat", quad_segs=2)
      )
  route_tree = shapely.STRtree(routes)
  plans = {
    key: str(b.APP / item["file"])
    for item in b.read(b.APP / "sacredPlacesV347Index.json")["sources"]
    for key in item["keys"]
  }
  companions = {}
  for desc in b.read(b.GEO / "sacred-places-v347-manifest.json")["chunks"]:
    for mode in ("drawn", "minecraft"):
      companions[f"{mode}:{desc['detailCompanionOf']}"] = (
        b.RAW / "packets" / desc[mode]["url"]
      )
  checked, triangle_count, area, failures = 0, 0, 0.0, []
  for line in (b.RAW / "predecessors.jsonl").open():
    receipt = json.loads(line)
    key = receipt["key"]
    if key not in evidence["sourceInputs"]:
      continue
    input_asset = evidence["sourceInputs"][key]
    raw_path = b.PUBLIC / input_asset["url"]
    assert b.sha(raw_path) == input_asset["sha256"], key
    raw = b.read(raw_path)
    ox, _, oz = raw["origin"]
    if key in companions:
      append = b.read(companions[key])["meshes"][0]
    else:
      plan = module(plans[key])["packets"][key]
      assert plan["retire"] == [], key
      append = plan["append"]
    p = (
      np.frombuffer(base64.b64decode(append["positions"]), "<u2").reshape(-1, 3) / 100
      + raw["origin"]
    )
    ix = np.frombuffer(base64.b64decode(append["indices"]), "<u4").reshape(-1, 3)
    triangles = p[ix]
    assert np.all(np.ptp(triangles[:, :, 1], axis=1) < 1e-8), key
    if key.startswith("minecraft:"):
      assert np.max(abs(p[:, [0, 2]] * 2 - np.round(p[:, [0, 2]] * 2))) < 1e-8, key
    domain = cemeteries.intersection(box(ox, oz, ox + 512, oz + 512))
    ground = unary_union(
      [b.nav_polygon(r, ox, oz) for r in raw["nav"]["ground"]]
    ).intersection(domain)
    prior = b.earlier_support(receipt["priorAdditions"], raw["origin"], ground)
    obstacles = unary_union(
      [
        b.nav_polygon(r, ox, oz)
        for category in ("buildings", "water", "bridges")
        for r in raw["nav"].get(category, [])
      ]
    )
    old_fingerprints = {b.fingerprint(m) for m in raw["meshes"]}
    mask_fingerprints = {b.fingerprint(m) for m in receipt["priorAdditions"]}
    assert all(
      r["fingerprint"] in old_fingerprints | mask_fingerprints
      for r in receipt["preparedRecords"]
    ), key
    floors = b.raw_floors(raw, ground)
    support_by_y = defaultdict(list)
    for by_y in floors.values():
      for y, g in by_y.items():
        support_by_y[round(y + 0.02, 2)].append(g)
    near_routes = route_tree.query(ground, predicate="intersects")
    permitted_routes = unary_union([routes[int(i)] for i in near_routes]).buffer(0.0072)
    for y in np.unique(np.round(triangles[:, 0, 1], 2)):
      batch = triangles[np.isclose(triangles[:, 0, 1], y)]
      footprint = unary_union(shapely.polygons(batch[:, :, [0, 2]]))
      allowed = unary_union(support_by_y[round(y, 2)]).difference(
        unary_union([prior, obstacles]).buffer(0.03)
      )
      for name, scope in (
        ("cemetery-and-navground", ground),
        ("literal-floor-minus-old-fittings", allowed),
        ("actual-mapped-path-strip", permitted_routes),
      ):
        excess = footprint.difference(scope.buffer(1e-7)).area
        if excess > 0.0001:
          failures.append(
            dict(key=key, height=float(y), rule=name, excessAreaM2=excess)
          )
      if key.startswith("minecraft:"):
        boundary = footprint.boundary
        for part in shapely.get_parts(boundary):
          coords = np.asarray(part.coords)
          delta = np.diff(coords, axis=0)
          assert np.all((abs(delta[:, 0]) < 1e-8) | (abs(delta[:, 1]) < 1e-8)), key
      area += footprint.area
    triangle_count += len(ix)
    checked += 1
    if checked % 40 == 0:
      print("Checked", checked, "cemetery packets", flush=True)
  return dict(
    packets=checked,
    triangles=triangle_count,
    drawnPlusNativeAreaM2=round(area, 3),
    failures=failures,
    scope="Every output packet incl. companion; mapped cemetery and source navigation ground; literal original horizontal floor and height; actual mapped-width route strip within centimetre quantization; original obstacle and all admitted prior-fitting exclusion; full cardinal Native boundaries; no retired old meshes",
  )


if __name__ == "__main__":
  report = review()
  b.write(b.GEO / "sacred-ground-v347-independent-review.json", report)
  print(json.dumps(report))
  assert not report["failures"]
