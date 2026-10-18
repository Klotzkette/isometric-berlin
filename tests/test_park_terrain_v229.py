"""Actual source-height refinement and mapped sled slope preserve all old owners."""

import hashlib
import json
import sys
from pathlib import Path

from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_park_terrain_v229 import field, sample  # noqa:E402

DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"


def read(path):
  return json.loads(path.read_text())


def sha(path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def test_retained_dgm_and_old_packets_replay_exact_profile_and_preserve_foundations():
  evidence = read(GEO / "park-terrain-v229-evidence.json")
  profile = read(DATA / "parkTerrainV229Profile.json")
  for p in evidence["packets"]:
    assert sha(DATA / p["path"]) == p["sha256"]
  # CI can replay the committed bounded samples without the ignored120MB raw archive.
  for x, z, measured, previous, weight in evidence["samples"]:
    assert abs(sample(profile, x, z) - (measured - previous) * weight) < 0.00002
  if (GEO / evidence["archive"]).exists():
    assert sha(GEO / evidence["archive"]) == evidence["sha256"]
    replay, receipt = field()
    assert replay == profile
    assert receipt["samples"] == evidence["samples"]
  assert sample(profile, 832, -6704) == 2.495
  source = read(GEO / "north-parks-v198-source.json")
  for building in source["buildings"]:
    geometry = shape(building["geometry"])
    for ring in (
      [geometry.exterior]
      if geometry.geom_type == "Polygon"
      else [p.exterior for p in geometry.geoms]
    ):
      for x, z in ring.coords:
        assert abs(sample(profile, x, z)) < 1e-10
  assert sample(profile, 300, -6900) == 0


def test_transferred_ground_preserves_plan_area_and_old_source_prefix_contract():
  changes = read(DATA / "parkTerrainV229Changes.json")
  for patch in changes["cells"]:
    old = next(
      c
      for suffix in [0, 1]
      for c in read(
        DATA / f"northParksV198{'Native' if patch['native'] else 'Drawn'}{suffix}.json"
      )["cells"]
      if c["id"] == patch["id"]
    )
    assert patch["remove"] == sorted(set(patch["remove"]))
    assert patch["sourceCounts"] == [
      len(old["positions"]),
      len(old["indices"]),
      len(old["boxes"]),
    ]

    def area(pos, indices):
      total = 0
      for i in range(0, len(indices), 3):
        a, b, c = [pos[j * 3 : j * 3 + 3] for j in indices[i : i + 3]]
        total += abs((b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2])) / 2
      return total

    selected = [j for i in patch["remove"] for j in old["indices"][i : i + 3]]
    assert (
      abs(area(old["positions"], selected) - area(patch["positions"], patch["indices"]))
      < 0.01
    )
    for i, old_y, new_y in patch["boxY"]:
      assert old["boxes"][i][1] == old_y
      assert abs(new_y - old_y) < 4
    for i, old_y, new_y in patch["vertexY"]:
      assert old["positions"][i * 3 + 1] == old_y


def test_rodelbahn_is_the_exact_source_grass_piste_on_the_delivered_hill():
  source = read(GEO / "fritz-rodelbahn-v229-source.json")
  e = read(GEO / "fritz-rodelbahn-v229-evidence.json")
  assert source["id"] == "way/121068797"
  assert source["tags"]["piste:type"] == "sled"
  assert source["tags"]["surface"] == "grass"
  assert sha(GEO / "fritz-rodelbahn-v229-source.json") == e["sourceSha256"]
  assert (
    sha(ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json")
    == e["groundContextSha256"]
  )
  poly = shape(source["geometry"])
  model = read(DATA / "fritzRodelbahnV229.json")["models"][0]
  p = model["positions"]
  ii = model["indices"]
  triangles = [
    Polygon([(p[j * 3], p[j * 3 + 2]) for j in ii[i : i + 3]])
    for i in range(0, len(ii), 3)
  ]
  assert unary_union(triangles).symmetric_difference(poly).area < 0.003
  assert e["heightRange"][1] - e["heightRange"][0] > 12
  assert len(read(DATA / "fritzRodelbahnV229.json")["models"][1]["boxes"]) == 377
