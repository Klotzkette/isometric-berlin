"""Complete source-supported airport surfaces, junctions and bounded packets."""

import base64
import hashlib
import sys
from collections import defaultdict
from functools import lru_cache
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_ber_airport_v236 as build  # noqa: E402


@lru_cache
def model():
  source = build.base.read_json(build.SOURCE)
  return source, build.ground_model(source)


def test_complete_previous_airport_sources_and_new_station_entrances():
  source, (surfaces, _, _, _) = model()
  features = {f["id"]: f for f in source["features"]}
  old = build.base.read_json(build.region.SOURCE)
  previous = [f for f in old["features"] if f["site"] == "BER"]
  assert len(previous) == 906
  assert source["previousBerSourceIds"] == sorted(f["id"] for f in previous)
  for f in previous:
    assert f["id"] in features
    assert shape(features[f["id"]]["geometry"]).equals_exact(
      build.projected(f["geometry"]), 1e-7
    )
  painted = unary_union([g for _, g, _ in surfaces])
  for identity in (193019556, 193019557, 193019551, 1083495099):
    entrance = features[f"way/{identity}"]
    assert entrance["kind"] == "building"
    assert painted.intersection(shape(entrance["geometry"])).area < 1e-6
  assert features["way/158251999"]["tags"]["min_height"] == "7"
  for filename, digest in source["inputs"].items():
    path = ROOT / filename
    if path.exists():
      assert hashlib.sha256(path.read_bytes()).hexdigest() == digest


def test_full_runways_stay_below_retained_thresholds_and_labels():
  source, (surfaces, _, _, _) = model()
  features = {f["id"]: f for f in source["features"]}
  north = unary_union(
    [build.footprint(features[f"way/{key}"]) for key in (4645618, 509961148, 509961149)]
  )
  south = build.footprint(features["way/95201688"])
  assert abs(north.area / (3600 * 45) - 1) < 0.003
  assert abs(south.area / (4000 * 60) - 1) < 0.003
  runway = unary_union([g for k, g, _ in surfaces if k == "runway"])
  assert runway.covers(north) and runway.covers(south)
  assert [y for k, _, y in surfaces if k == "runway"] == [3.03]
  assert 3.03 < 3.10 - 0.08 / 2  # Existing v205 marking undersides.
  assert len([f for f in source["features"] if f["kind"] == "taxiway"]) == 292
  thin = LineString([(0, 0), (12, 4)]).buffer(0.15, cap_style="flat")
  pixels = build.native_surface(thin, 0.125)
  assert not pixels.is_empty and thin.covers(pixels)


def test_upper_forecourt_and_mapped_ramps_share_endpoint_heights():
  source, (_, raised, _, _) = model()
  by_id = {f["id"]: (f, g, y) for f, g, y in raised}
  assert "way/161841885" not in by_id  # Explicit E0 remains ground-level.
  assert by_id["way/158258896"][2] == 8.03
  assert by_id["way/158258900"][2] == 8.03
  owners = defaultdict(list)
  ramp_count = 0
  for f, _, y in raised:
    line = shape(f["geometry"])
    if line.geom_type != "LineString":
      continue
    ramp_count += any(f["_groundEndpoints"])
    for x, z in line.coords:
      owners[round(x, 4), round(z, 4)].append(build.deck_height(f, y, x, z))
    for point, ground in zip((line.coords[0], line.coords[-1]), f["_groundEndpoints"]):
      if ground:
        assert abs(build.deck_height(f, y, *point) - 3.03) < 1e-7
  for f in source["features"]:
    if (
      f["kind"] == "road"
      and build.above_ground(f["tags"])
      and build.ground_road(f["tags"])
    ):
      for line in build.line_parts(shape(f["geometry"])):
        for x, z in line.coords:
          owners[round(x, 4), round(z, 4)].append(3.03)
  assert ramp_count > 0
  assert all(max(heights) - min(heights) < 1e-7 for heights in owners.values())
  assert source["estimates"]["unmeasuredDeckLevelM"] == 5


def test_all_airport_packets_keep_native_faces_bounds_and_memory_caps():
  addition = build.base.read_json(build.PATCH)
  evidence = build.base.read_json(build.EVIDENCE)
  assert 0 < len(addition["chunks"]) <= 100
  assert addition["source"]["footprintMetadataPrecisionM"] == 0.01
  assert (
    len(__import__("json").dumps(addition["footprint"], separators=(",", ":"))) < 290000
  )
  for p in addition["footprint"]:
    assert shape(
      {"type": "Polygon", "coordinates": [p["ring"], *p.get("holes", [])]}
    ).is_valid
  counts = defaultdict(int)
  for descriptor in addition["chunks"]:
    assert descriptor["id"].startswith("ber236-")
    x0, z0, x1, z1 = descriptor["bounds"]
    assert x1 - x0 == z1 - z0 == 512
    for family in ("drawn", "minecraft"):
      path = build.OUT / descriptor[family]["url"]
      assert build.base.digest(path) == descriptor[family]["sha256"]
      assert path.stat().st_size == descriptor[family]["bytes"]
      assert descriptor[family]["decodedBytes"] < 12 * 1024**2
      packet = build.base.read_json(path)
      assert packet["origin"] == [x0, -10, z0]
      assert packet["nav"]["groundY"] == 3
      assert len(packet["meshes"]) <= 16
      nv = ni = 0
      for mesh in packet["meshes"]:
        points = (
          np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3) / 100
          + packet["origin"]
        )
        indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
        assert len(points) <= 400_000 and indices.size <= 2_400_000
        assert indices.size == 0 or indices.max() < len(points)
        assert points[:, 0].min() >= x0 and points[:, 0].max() <= x1
        assert points[:, 2].min() >= z0 and points[:, 2].max() <= z1
        if family == "minecraft":
          triangles = points[indices]
          normals = np.cross(
            triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]
          )
          assert np.all(np.sum(np.abs(normals) > 1e-7, axis=1) <= 1)
        nv += len(points)
        ni += indices.size
      actual = nv * 12 + ni * (2 if nv <= 65535 else 4)
      assert (
        actual == evidence["packets"][f"{family}:{descriptor['id']}"]["geometryBytes"]
      )
      counts[family] += actual
  # Even the complete new airport fits under the unchanged 24 MiB residency cap.
  assert max(counts.values()) < 24 * 1024**2
