"""Real packet preservation, exact source support and native geometry checks."""

import base64
import gzip
import json

import numpy as np
import pytest
from shapely.geometry import LineString, Point, shape
from shapely.ops import unary_union

from scripts import build_zoo_garden_details_v341 as build


@pytest.fixture(scope="module")
def staged(tmp_path_factory):
  path = tmp_path_factory.mktemp("zoo-garden-v341")
  return path, build.stage(path)


def decode(packet):
  mesh = packet["meshes"][-1]
  points = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
  points = points / 100 + packet["origin"]
  indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  return points, indices


def test_all_six_real_packets_keep_every_old_mesh_nav_and_source(staged):
  directory, receipt = staged
  assert len(receipt["packets"]) == 6
  assert len(receipt["sources"]) == 6
  for path, digest in receipt["sources"].items():
    assert build.sha((build.ROOT / path).read_bytes()) == digest
  for key, row in receipt["packets"].items():
    path = directory / row["after"]["url"]
    wire = path.read_bytes()
    assert build.sha(wire) == row["after"]["sha256"]
    assert len(wire) == row["after"]["bytes"]
    original = build.read(build.PUBLIC / row["before"]["url"])
    current = json.loads(gzip.decompress(wire))
    assert current["meshes"][:-1] == original["meshes"]
    assert current["meshes"][-1]["kind"] == build.KIND
    assert {k: v for k, v in current.items() if k != "meshes"} == {
      k: v for k, v in original.items() if k != "meshes"
    }
    assert len(current["meshes"]) <= 16
    points, indices = decode(current)
    assert len(points) == row["vertices"] < 40000
    assert indices.max() < len(points)
    assert np.isfinite(points).all()
    if key.startswith("minecraft:"):
      triangles = points[indices]
      assert np.all(np.any(np.ptp(triangles, axis=1) < 1e-7, axis=1))


def test_decorations_are_bound_to_the_three_actual_building_groups(staged):
  directory, receipt = staged
  garden = build.read(build.GEO / "marzahn-garden-landmarks-v330.json")
  terrain = build.load_terrain()
  roofs = unary_union(
    [
      shape(garden["osm"][f"way/{i}"]["geometry"])
      for i in [garden["korean"]["kyeOsm"], *garden["korean"]["gatesOsm"]]
    ]
  )
  for key, row in receipt["packets"].items():
    packet = json.loads(gzip.decompress((directory / row["after"]["url"]).read_bytes()))
    points, _ = decode(packet)
    if row["site"] == "antelope":
      assert row["audit"]["owner"] == "DEBE3DlyqEefwivU"
      front = LineString(row["audit"]["sourceFront"])
      assert all(front.distance(Point(x, z)) < 2.1 for x, _, z in points)
      assert points[:, 1].min() > 16 and points[:, 1].max() < 17.3
    elif row["site"] == "palace":
      assert row["audit"]["owner"] == "DEBE11YYI00009hE"
      assert 10255 < points[:, 0].min() < points[:, 0].max() < 10325
      assert 1775 < points[:, 2].min() < points[:, 2].max() < 1830
      assert row["audit"]["frames"] > 60
    else:
      assert row["audit"]["owners"] == [243695792, 243695784, 555478185, 555478186]
      assert row["audit"]["tileCourses"] == 218
      assert all(roofs.buffer(0.3).covers(Point(x, z)) for x, _, z in points)
      # These are roof-only accents, not a new ground skin or blocked gateway.
      for x, y, z in points:
        ground = build.terrain_height(terrain, x, z, key.startswith("minecraft:"))
        assert y - ground > 1.9


def test_changed_source_is_rejected_before_publication(tmp_path, monkeypatch):
  original = build.original

  def drift(path):
    value = original(path)
    return value + b" " if path == build.SOURCES[0] else value

  monkeypatch.setattr(build, "original", drift)
  with pytest.raises(ValueError, match="Changed source owner"):
    build.stage(tmp_path)
  assert not list(tmp_path.iterdir())
