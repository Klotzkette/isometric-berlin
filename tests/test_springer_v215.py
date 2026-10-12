"""Current footprint, immutable predecessor, exact ownership and roof evidence."""

import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
SOURCE_PATH = ROOT / "geo_data/regierungsviertel/springer-v215-source.json.gz"
SOURCE = json.loads(gzip.decompress(SOURCE_PATH.read_bytes()))
PROFILE = json.loads((DATA / "springerV215Profile.json").read_bytes())
NAV = json.loads((DATA / "springerV215Navigation.json").read_bytes())
OWNERSHIP = json.loads((DATA / "springerV215Ownership.json").read_bytes())


def unpack(packet: dict) -> list[np.ndarray]:
  triangles = []
  for mesh in packet["meshes"]:
    xyz = (
      np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(-1, 3)
      / 100
      + packet["origin"]
    )
    indices = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(
      -1, 3
    )
    triangles.extend(xyz[indices])
  return triangles


def test_complete_old_source_and_every_original_packet_remain_immutable():
  old = SOURCE["oldSource"]
  assert old["id"] == OWNERSHIP["owner"] == "DEBE01YYK0000Eik"
  assert old["sourceAttributes"]["Grundrissaktualitaet"] == "2017-10-11"
  assert len(old["parts"][0]["surfaces"]) == 24
  assert len(old["legacyPrisms"]) == 1
  assert hashlib.sha256(SOURCE_PATH.read_bytes()).hexdigest() == PROFILE["sourceSha256"]
  for path, expected in SOURCE["retainedInputs"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == expected
  for record in SOURCE["originalPackets"]:
    assert (
      hashlib.sha256((ROOT / record["file"]).read_bytes()).hexdigest()
      == record["sha256"]
    )
  assert {r["part"] for r in OWNERSHIP["records"] + OWNERSHIP["lineRecords"]} == {
    old["id"]
  }


def test_current_named_footprint_and_two_full_width_core_fronts():
  current = SOURCE["currentSource"]
  assert current["id"] == "OSM-way-1282540270"
  assert current["name"] == "Zentrales Springergebäude"
  assert current["tags"]["building:levels"] == "6"
  assert NAV["ring"] == current["ring"]
  assert 832 < Polygon(current["ring"]).area < 834
  fronts = [f for f in SOURCE["faces"] if f["stairFront"]]
  assert len(fronts) == 2
  assert all(8.5 < f["length"] < 9.4 for f in fronts)
  assert len([f for f in SOURCE["fittings"] if f[6] == "lime stair surround"]) == 10
  assert len([f for f in SOURCE["fittings"] if f[6] == "lime entrance field"]) == 2
  # The new current cores must not be reduced to the predecessor's narrow ones.
  assert Polygon(current["ring"]).difference(Polygon(NAV["oldRing"])).area > 140


def test_fittings_are_outside_current_wall_planes_within_actual_edge_extents():
  polygon = Polygon(NAV["ring"])
  for fi, u, y, width, height, offset, _, _ in SOURCE["fittings"]:
    f = SOURCE["faces"][fi]
    assert 0.05 <= offset <= 0.11
    assert -1e-7 <= u - width / 2 < u + width / 2 <= f["length"] + 1e-7
    assert (
      NAV["groundY"] - 1e-7 <= y - height / 2 < y + height / 2 <= NAV["roofY"] + 1e-7
    )
    a, d, n = (np.array(f[k]) for k in ["a", "d", "normal"])
    for q in [u - width / 2, u, u + width / 2]:
      assert not polygon.covers(Point(*(a + d * q + n * offset)))


def test_shared_neighbour_ink_is_never_transferred():
  originals = json.loads(
    gzip.decompress(
      (
        ROOT / "geo_data/regierungsviertel/alt-mitte-v169/source-389_5821-00.json.gz"
      ).read_bytes()
    )
  )["buildings"]
  edges = [
    (a, b)
    for record in originals
    if record["id"] != OWNERSHIP["owner"]
    for part in record["parts"]
    for s in part["surfaces"]
    if s["kind"] in {"WallSurface", "RoofSurface"}
    for r in s["rings"]
    for a, b in zip(r, r[1:] + r[:1], strict=True)
  ]
  for transferred in OWNERSHIP["lineRecords"]:
    packets = [r for r in SOURCE["originalPackets"] if "altMitteV169Drawn" in r["file"]]
    for record in packets:
      packet = json.loads((ROOT / record["file"]).read_bytes())
      if "lines" not in packet:
        continue
      line = packet["lines"]
      value = 2166136261
      for char in line["positions"] + line.get("colors", ""):
        value = ((value ^ ord(char)) * 16777619) & 0xFFFFFFFF
      if value != transferred["fingerprint"]:
        continue
      neighbour = {
        tuple(
          sorted(
            tuple(np.rint((np.array(p) - packet["origin"]) * 100).astype(int))
            for p in [a, b]
          )
        )
        for a, b in edges
      }
      lines = np.frombuffer(base64.b64decode(line["positions"]), dtype="<u2").reshape(
        -1, 2, 3
      )
      assert all(
        tuple(sorted(tuple(p) for p in lines[i])) not in neighbour
        for i in transferred["segments"]
      )


def test_native_roof_cells_match_actual_orthogonal_geometry_and_open_old_projections():
  packet = json.loads((DATA / "springerV215Minecraft.json").read_bytes())
  roofs = {}
  for triangle in unpack(packet):
    normal = np.cross(triangle[1] - triangle[0], triangle[2] - triangle[0])
    assert np.count_nonzero(np.abs(normal) > 1e-8) == 1
    if normal[1] <= 0:
      continue
    poly = Polygon(triangle[:, [0, 2]])
    x0, z0, x1, z1 = poly.bounds
    for x in range(int(x0), int(x1)):
      for z in range(int(z0), int(z1)):
        if poly.covers(Point(x + 0.5, z + 0.5)):
          roofs[x, z] = max(roofs.get((x, z), -100), triangle[0, 1])
  assert roofs and all(abs(y - 28.2) < 1e-6 for y in roofs.values())
  changes = {(x, z): (old, new) for x, z, old, new in NAV["nativeChangedRoofCells"]}
  assert all(
    new is None or abs(roofs[x, z] - new) < 1e-6 for (x, z), (_, new) in changes.items()
  )
  assert any(old is not None and new is None for old, new in changes.values())
  assert any(old is None and new is not None for old, new in changes.values())
  assert set(roofs) == {p for p, (_, new) in changes.items() if new is not None}


def test_roof_level_and_bounded_payload_are_evidence_based():
  samples = SOURCE["bdom"]["samples"]
  assert NAV["roofY"] == round(
    float(np.median([s[2] for s in samples[:5]]))
    + SOURCE["oldSource"]["verticalTransform"]["offsetY"],
    2,
  )
  assert PROFILE["counts"]["drawnGpuBytes"] < 100000
  assert PROFILE["counts"]["minecraftGpuBytes"] < 400000
  for mode in ["Drawn", "Minecraft"]:
    packet = json.loads((DATA / f"springerV215{mode}.json").read_bytes())
    assert len(packet["meshes"]) == 1
    assert len(unpack(packet)) == PROFILE["counts"][mode.lower() + "Triangles"]
