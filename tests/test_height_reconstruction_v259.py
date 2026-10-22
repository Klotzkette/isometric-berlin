"""Exact-owner missing tops, unchanged base packets and fail-closed replay."""

import base64
import copy
import gzip
import hashlib
import importlib
import json
from pathlib import Path

import numpy as np
import pytest
import shapely
from shapely.geometry import Polygon
from shapely.ops import unary_union

from scripts import integrate_height_reconstruction_v259 as integration
from scripts.integrate_adlershof_kuehn_v261 import predecessor_manifest_v261

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
EXPECTED = {
  "emmaus": ("DEBE02YY40000015", "51785680", "7_4", 74, 77),
  "apostelPaulus": ("DEBE07YY9000005j", "23453689", "-3_6", 86, 89),
  "luxTower": ("DEBE02YY200001eH", "23971070", "10_3", 63, 66),
}
SOURCE_PARTS = {
  "emmaus": {"DEBE3DhzvJQbD4JA", "DEBE3DpfPd7NxYY0", "DEBE3DDI5SoKMeMq"},
  "apostelPaulus": {"DEBE07YY9000005j"},
  "luxTower": {"DEBE02YY200001eH"},
}
FAMILIES = ("drawn", "minecraft")


def read(path):
  data = path.read_bytes()
  return json.loads(gzip.decompress(data) if path.suffix == ".gz" else data)


@pytest.fixture(scope="module")
def source():
  return read(GEO / "height-reconstruction-v259-source.json.gz")


@pytest.fixture(scope="module")
def addition():
  return read(integration.ADDITION)


@pytest.fixture(scope="module")
def previous():
  return json.loads(integration.baseline_bytes())


def arrays(packet):
  """Decode actual shipped coordinates independently of the geometry builder."""
  for mesh in packet["meshes"]:
    assert mesh["positionType"] == "u16cm"
    points = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
    points = points / 100 + packet["origin"]
    indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    assert 0 < len(points) < 400_000
    assert 0 < len(indices) < 800_000
    assert indices.max() < len(points)
    assert len(base64.b64decode(mesh["colors"])) == len(points) * 3
    assert np.isfinite(points).all()
    yield points, indices


def test_exact_three_owners_have_evidenced_heights_and_explicit_estimates(source):
  assert source["schemaVersion"] == 1
  assert {s["id"] for s in source["sites"]} == EXPECTED.keys()
  assert len(source["sites"]) == 3
  assert "estimat" in source["dimensionStatus"].lower()
  for site in source["sites"]:
    parent, osm, packet_id, height, top = EXPECTED[site["id"]]
    assert site["sourceParent"] == parent
    assert str(site["osmWayId"]) == osm
    assert site["parentDescriptor"]["id"] == packet_id
    assert site["referenceHeightAboveGroundM"] == height
    assert site["topY"] == top
    assert site["estimatedPlan"]
    assert {p["id"] for p in site["sourceParts"]} == SOURCE_PARTS[site["id"]]
    assert site.get("references") or source["references"]
    assert set(site["families"]) == set(FAMILIES)


def test_all_previous_descriptors_coverage_and_limits_are_preserved(previous, addition):
  before = copy.deepcopy(previous)
  merged = integration.merged(previous, addition)
  assert previous == before
  assert predecessor_manifest_v261(read(PUBLIC / "manifest.json")) == merged
  assert merged["chunks"][: len(previous["chunks"])] == previous["chunks"]
  for key, value in previous.items():
    if key != "chunks":
      assert merged[key] == value
  assert len(merged["chunks"]) == len(previous["chunks"]) + 3 <= 2208
  assert len(json.dumps(merged, separators=(",", ":")).encode()) < 2176 * 1024
  descriptors = {d["id"]: d for d in previous["chunks"]}
  assert {d["id"] for d in addition["chunks"]} == {
    f"height259-{r[2]}" for r in EXPECTED.values()
  }
  for descriptor in addition["chunks"]:
    parent = descriptors[descriptor["detailCompanionOf"]]
    assert descriptor["bounds"] == parent["bounds"]
  assert integration.predecessor_manifest_v259(merged) == previous


def test_six_base_packets_keep_exact_bytes_and_navigation(source, previous):
  descriptors = {d["id"]: d for d in previous["chunks"]}
  for site in source["sites"]:
    parent = descriptors[EXPECTED[site["id"]][2]]
    assert site["parentDescriptor"] == parent
    for mode in FAMILIES:
      asset = parent[mode]
      data = (PUBLIC / asset["url"]).read_bytes()
      assert len(data) == asset["bytes"]
      assert hashlib.sha256(data).hexdigest() == asset["sha256"]
      packet = json.loads(gzip.decompress(data))
      receipt = site["families"][mode]
      assert receipt["originalPacketUrl"] == asset["url"]
      assert receipt["sha256"] == asset["sha256"]
      assert receipt["originalNav"] == packet["nav"]
      owners = [
        b for b in packet["nav"]["buildings"] if b["sourceId"] == site["sourceParent"]
      ]
      assert owners == receipt["ownerBuildings"]
      assert owners


def test_added_geometry_starts_above_bodies_and_ends_at_published_tops(
  source, addition
):
  sites = {s["parentDescriptor"]["id"]: s for s in source["sites"]}
  for descriptor in addition["chunks"]:
    site = sites[descriptor["detailCompanionOf"]]
    allowed = unary_union(
      [Polygon(p["ring"], p["holes"]) for p in site["sourceParts"]]
    ).buffer(0.015)
    mode_normals = {}
    for mode in FAMILIES:
      packet = read(PUBLIC / descriptor[mode]["url"])
      assert packet["id"] == descriptor["id"]
      assert packet["schemaVersion"] == 1
      assert packet["nav"]["groundY"] == 3
      assert all(
        not packet["nav"].get(k)
        for k in (
          "ground",
          "water",
          "buildings",
          "roads",
          "bridges",
          "spreeBridgesV242",
        )
      )
      points_and_indices = list(arrays(packet))
      vertices = np.concatenate([p for p, _ in points_and_indices])
      receipt = site["families"][mode]
      old_top = max(
        packet["nav"]["groundY"] + b.get("groundOffset", 0) + b["height"]
        for b in receipt["ownerBuildings"]
      )
      assert vertices[:, 1].min() >= old_top + 0.01
      assert vertices[:, 1].min() >= receipt["minimumNewY"] - 0.0051
      assert vertices[:, 1].max() == pytest.approx(EXPECTED[site["id"]][4], abs=0.005)
      assert np.all(
        shapely.covers(allowed, shapely.points(vertices[:, 0], vertices[:, 2]))
      )
      x0, z0, x1, z1 = descriptor["bounds"]
      assert vertices[:, 0].min() >= x0 and vertices[:, 0].max() <= x1
      assert vertices[:, 2].min() >= z0 and vertices[:, 2].max() <= z1
      normals = []
      for points, indices in points_and_indices:
        triangles = points[indices]
        n = np.cross(
          triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]
        )
        assert (np.linalg.norm(n, axis=1) > 1e-8).all()
        normals.append(n)
      mode_normals[mode] = np.concatenate(normals)
      assert descriptor[mode]["decodedBytes"] < 4 * 1024**2
    native_nonzero = np.count_nonzero(np.abs(mode_normals["minecraft"]) > 1e-8, axis=1)
    assert np.all(native_nonzero == 1)
    assert descriptor["drawn"]["sha256"] != descriptor["minecraft"]["sha256"]
    if site["id"] != "luxTower":
      assert np.any(np.count_nonzero(np.abs(mode_normals["drawn"]) > 1e-8, axis=1) > 1)


@pytest.mark.parametrize(
  "mutation", ["old", "missing", "extra", "bounds", "size", "metadata"]
)
def test_manifest_replay_rejects_unreceipted_changes(previous, addition, mutation):
  current = copy.deepcopy(integration.merged(previous, addition))
  if mutation == "old":
    current["chunks"][0]["drawn"]["sha256"] = "0" * 64
  elif mutation == "missing":
    current["chunks"].pop()
  elif mutation == "extra":
    current["chunks"].append({**current["chunks"][-1], "id": "height259-unapproved"})
  elif mutation == "bounds":
    current["chunks"][-1]["bounds"][0] += 1
  elif mutation == "size":
    current["chunks"][-1]["drawn"]["decodedBytes"] += 1
  else:
    current["heightReconstructionV259"] = "unreceipted"
  with pytest.raises(AssertionError):
    integration.predecessor_manifest_v259(current)


@pytest.mark.parametrize("mode", FAMILIES)
@pytest.mark.parametrize("old", [False, True])
def test_replay_checks_real_new_and_affected_old_packet_bytes(
  previous, addition, mode, old
):
  current = integration.merged(previous, addition)
  descriptor = (
    next(d for d in previous["chunks"] if d["id"] == "7_4")
    if old
    else addition["chunks"][0]
  )
  target = PUBLIC / descriptor[mode]["url"]

  def corrupt(path):
    data = path.read_bytes()
    return data[:-1] + bytes([data[-1] ^ 1]) if path == target else data

  with pytest.raises(AssertionError):
    integration.predecessor_manifest_v259(current, corrupt)


@pytest.mark.parametrize("mutation", ["id", "origin", "navigation", "empty", "version"])
def test_matching_hash_does_not_excuse_invalid_new_packets(addition, mutation):
  changed = copy.deepcopy(addition)
  descriptor = changed["chunks"][0]
  asset = descriptor["drawn"]
  target = PUBLIC / asset["url"]
  packet = read(target)
  if mutation == "id":
    packet["id"] = "unrelated-owner"
  elif mutation == "origin":
    packet["origin"][1] += 1
  elif mutation == "navigation":
    packet["nav"]["buildings"] = [{"sourceId": "invented-street-obstacle"}]
  elif mutation == "empty":
    packet["meshes"] = []
  else:
    packet["schemaVersion"] = 2
  raw = json.dumps(packet, separators=(",", ":")).encode()
  packed = gzip.compress(raw, mtime=0)
  asset.update(
    bytes=len(packed), decodedBytes=len(raw), sha256=hashlib.sha256(packed).hexdigest()
  )
  with pytest.raises(AssertionError):
    integration.verify_packets(
      changed, lambda path: packed if path == target else path.read_bytes()
    )


def test_merge_rejects_changed_parent_and_duplicate_companion(previous, addition):
  for mutation in ("parent", "duplicate", "bounds"):
    changed = copy.deepcopy(addition)
    if mutation == "parent":
      changed["chunks"][0]["detailCompanionOf"] = "unrelated"
    elif mutation == "duplicate":
      changed["chunks"][1]["id"] = changed["chunks"][0]["id"]
    else:
      changed["chunks"][0]["bounds"][0] -= 1
    with pytest.raises(AssertionError):
      integration.merged(previous, changed)


def test_reconstruction_replays_byte_exactly_without_mutating_retained_inputs(
  source, addition, tmp_path, monkeypatch
):
  """Replay only into a temporary directory; production inputs stay read-only."""
  monkeypatch.syspath_prepend(str(ROOT / "scripts"))
  builder = importlib.import_module("build_height_reconstruction_v259")
  source_before = builder.SOURCE.read_bytes()
  for url in source["packetReceipts"]:
    (tmp_path / url).write_bytes((PUBLIC / url).read_bytes())
  for name in ("EVIDENCE", "ADDITION"):
    monkeypatch.setattr(builder, name, tmp_path / getattr(builder, name).name)
  monkeypatch.setattr(builder, "OUT", tmp_path)
  builder.build()
  assert builder.SOURCE.read_bytes() == source_before
  assert read(builder.ADDITION) == addition
  assert (
    builder.EVIDENCE.read_bytes()
    == (GEO / "height-reconstruction-v259-evidence.json").read_bytes()
  )
  for descriptor in addition["chunks"]:
    for mode in FAMILIES:
      url = descriptor[mode]["url"]
      assert (tmp_path / url).read_bytes() == (PUBLIC / url).read_bytes()
  for url, receipt in source["packetReceipts"].items():
    assert (
      hashlib.sha256((tmp_path / url).read_bytes()).hexdigest() == receipt["sha256"]
    )
