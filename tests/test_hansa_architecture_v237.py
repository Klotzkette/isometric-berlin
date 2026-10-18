"""Surveyed library replacement and bounded, source-attached Interbau details."""

import base64
import gzip
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from scripts import build_hansa_architecture_v237 as subject  # noqa: E402


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def sha(path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def test_complete_source_receipts_and_exact_four_library_owners():
  source = read(subject.SOURCE)
  evidence = read(subject.EVIDENCE)
  assert sha(subject.SOURCE) == evidence["sourceSha256"]
  original_path = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  assert sha(original_path) == source["previousCoreSha256"]
  assert (
    sha(ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json")
    == source["nativeCoreSha256"]
  )
  original = {p["id"]: p for p in read(original_path)["buildings"]}
  assert len(source["buildings"]) == 16
  assert sum(len(b["parts"]) for b in source["buildings"]) == 49
  archives = {b["archive"]: b["archiveSha256"] for b in source["buildings"]}
  for path, expected in archives.items():
    assert sha(ROOT / path) == expected
  for building in source["buildings"]:
    assert building["previousPrisms"]
    for p in building["previousPrisms"]:
      assert original[p["id"]] == p
    for p in building["parts"]:
      assert Polygon(p["ring"], p["holes"]).is_valid
      assert {s["kind"] for s in p["surfaces"]} >= {"WallSurface", "RoofSurface"}
  receipt = source["libraryProxyReceipt"]
  old = subprocess.check_output(
    ["git", "show", receipt["baseline"] + ":" + receipt["path"]], cwd=ROOT
  )
  assert hashlib.sha256(old).hexdigest() == receipt["wholeFileSha256"]
  assert receipt["retiredBlock"] in old.decode()
  assert receipt["retiredBlock"] not in (ROOT / receipt["path"]).read_text()
  assert evidence["libraryPrismIds"] == ["UfOiMKPI", "5yW3Z2oo", "Ldcl7dCO", "RRTGvA3Y"]
  assert "not surveyed openings" in source["policy"]


def test_library_measured_roofs_ground_and_open_courtyard():
  source = read(subject.SOURCE)
  library = next(b for b in source["buildings"] if b["id"] == subject.LIBRARY)
  profile = read(subject.PROFILE)
  assert profile["previousPrisms"] == library["previousPrisms"]
  assert profile["sourceSha256"] == sha(subject.SOURCE)
  courtyard = Point(-1953.5, 155.6)
  for p, output in zip(library["parts"], profile["parts"]):
    polygon = Polygon(p["ring"], p["holes"])
    assert not polygon.covers(courtyard)
    assert not subject.stepped_polygon(polygon).covers(courtyard)
    assert abs(output["groundY"] - 5.2) < 1e-8
    assert output["ground_y_m"] == output["groundY"]
    assert output["top_y_m"] == output["topY"]
    assert output["ring"] == p["ring"] and output["holes"] == p["holes"]
    roofs = [s for s in p["surfaces"] if s["kind"] == "RoofSurface"]
    assert len(roofs) == len(output["surfaces"])
    for original, result in zip(roofs, output["surfaces"]):
      for a, b in zip(original["rings"], result["rings"]):
        expected = np.asarray(a) + [0, library["displayShift"], 0]
        assert np.array_equal(expected, b)


def test_all_named_houses_both_families_and_packet_limits():
  source = read(subject.SOURCE)
  evidence = read(subject.EVIDENCE)
  addition = read(subject.ADDITION)
  assert len(addition["chunks"]) == 3 and addition["footprint"] == []
  families = {"drawn": set(), "minecraft": set()}
  total = dict.fromkeys(families, 0)
  for tile in addition["chunks"]:
    for family in families:
      descriptor = tile[family]
      path = subject.OUT / descriptor["url"]
      assert sha(path) == descriptor["sha256"]
      packed = path.read_bytes()
      raw = gzip.decompress(packed)
      assert len(packed) == descriptor["bytes"]
      assert len(raw) == descriptor["decodedBytes"] < 12 * 1024**2
      packet = json.loads(raw)
      assert packet["id"] == tile["id"] and len(packet["meshes"]) == 1
      assert all(
        packet["nav"][key] == []
        for key in ("buildings", "ground", "roads", "water", "bridges")
      )
      mesh = packet["meshes"][0]
      xyz = (
        np.frombuffer(base64.b64decode(mesh["positions"]), "<u2")
        .reshape(-1, 3)
        .astype(float)
        / 100
        + packet["origin"]
      )
      indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      assert np.isfinite(xyz).all() and indices.max() < len(xyz)
      assert len(xyz) < 400000 and indices.size < 2400000
      bounds = tile["bounds"]
      assert xyz[:, 0].min() >= bounds[0] - 0.01 and xyz[:, 0].max() <= bounds[2] + 0.01
      assert xyz[:, 2].min() >= bounds[1] - 0.01 and xyz[:, 2].max() <= bounds[3] + 0.01
      if family == "minecraft":
        triangles = xyz[indices]
        normals = np.cross(
          triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]
        )
        assert ((np.abs(normals) > 1e-7).sum(axis=1) <= 1).all()
      receipt = evidence["packets"][family + ":" + tile["id"]]
      gpu = 12 * len(xyz) + indices.size * (2 if len(xyz) < 65536 else 4)
      assert gpu == receipt["geometryBytes"]
      total[family] += gpu
      for role in receipt["roles"]:
        families[family].add(role.split(":")[0])
  expected = {b["id"] for b in source["buildings"]}
  assert all(expected <= families[f] for f in families)
  assert total == dict(drawn=1993116, minecraft=3595116)


def test_native_panels_stay_outside_existing_coarse_columns():
  axis = dict(
    a=[0, 0],
    d=[0, 1],
    n=[1, 0],
    nativeColumns=np.array([[0, 0, 0, 10.0]]),
    nativeAlong=np.array([0]),
    nativeReach=np.array([0]),
  )
  detail = subject.Detail()
  subject.pane(detail, axis, 0, 5, 1.2, 1.8, subject.GLASS, "test", True, 0.19)
  assert detail.triangles
  for triangle, _, _ in detail.triangles:
    assert np.allclose(np.asarray(triangle)[:, 0], 2.22)
  hidden = subject.Detail()
  subject.pane(hidden, axis, 0, 12, 1.2, 1.8, subject.GLASS, "no source backing", True)
  assert not hidden.triangles


def test_compiler_replays_bytes_without_mutating_sources(monkeypatch, tmp_path):
  original_addition = read(subject.ADDITION)
  expected = {
    d[f]["url"]: d[f]["sha256"]
    for d in original_addition["chunks"]
    for f in ("drawn", "minecraft")
  }
  original_profile, original_evidence = sha(subject.PROFILE), sha(subject.EVIDENCE)
  monkeypatch.setattr(subject, "OUT", tmp_path)
  monkeypatch.setattr(subject, "PROFILE", tmp_path / "profile.json")
  monkeypatch.setattr(subject, "ADDITION", tmp_path / "addition.json")
  original_write = subject.base.write_json

  # Preserve the repository-relative evidence path while diverting output bytes.
  def write(path, data):
    if path == subject.ADDITION:
      return
    if path == subject.EVIDENCE:
      return original_write(tmp_path / "evidence.json", data)
    return original_write(path, data)

  monkeypatch.setattr(subject.base, "write_json", write)
  result = subject.build()
  assert result["buildings"] == 16
  assert all(sha(tmp_path / name) == value for name, value in expected.items())
  assert sha(tmp_path / "profile.json") == original_profile
  assert sha(tmp_path / "evidence.json") == original_evidence
