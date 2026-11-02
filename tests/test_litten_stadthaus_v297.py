"""Source, native-volume and exact generic-estimate transfer proofs for v297."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, box

from scripts.historical_asset_reader_v194 import historical_asset_bytes_v194

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> dict:
  """Read one bounded receipt."""
  p = ROOT / path
  raw = p.read_bytes()
  return json.loads(gzip.decompress(raw) if p.suffix == ".gz" else raw)


def test_complete_unchanged_source_records_and_source_planes() -> None:
  """The new render descriptors cannot stand in for deleted metric sources."""
  data = read("src/app/src/data/littenStadthausV297.json")
  proof = read("geo_data/regierungsviertel/litten-stadthaus-v297-source.json.gz")
  for path, expected in data["sourceReceipts"].items():
    raw = historical_asset_bytes_v194(ROOT / path, expected)
    assert hashlib.sha256(raw).hexdigest() == expected
  originals = {
    b["id"]: b
    for tile in ["391_5819", "392_5819"]
    for b in read(
      f"geo_data/regierungsviertel/alt-mitte-v169/source-{tile}-00.json.gz"
    )["buildings"]
  }
  assert len(proof["buildings"]) == 15
  for building in proof["buildings"]:
    assert building == originals[building["id"]]
  for face in data["faces"]:
    p = next(p for p in originals[face["owner"]]["parts"] if p["id"] == face["part"])
    surface = p["surfaces"][face["index"]]
    vertices = surface["rings"][0]
    assert surface["kind"] == "WallSurface"
    assert any([v[0], v[2]] == face["a"] for v in vertices)
    assert any([v[0], v[2]] == face["b"] for v in vertices)
    assert face["bottom"] == min(v[1] for v in vertices)
    assert face["top"] == max(v[1] for v in vertices)
  assert len(proof["stadthaus"]["part"]["holes"]) == 5
  assert proof["stadthaus"]["towerHeightM"] == 80


def test_every_atomic_native_member_fits_actual_complete_source_faces() -> None:
  """Merged concave source faces retain their real holes and exterior plane."""
  proof = read("geo_data/regierungsviertel/litten-stadthaus-v297-source.json.gz")
  supports = {p["id"]: Polygon(p["ring"], p["holes"]) for p in proof["nativeSupports"]}
  for rows_key, fits_key in [
    ("nativeAtomicRows", "nativeFits"),
    ("replacementNativeAtomicRows", "replacementNativeFits"),
  ]:
    rows = proof[rows_key]
    assert len(rows) == len(proof[fits_key])
    for rec in proof[fits_key]:
      row = rows[rec["row"]]
      axis, sign, plane, *_ = rec["face"]
      axis = int(axis)
      along = 2 - axis
      assert row["yaw"] == 0
      assert np.isfinite(row["p"] + row["s"]).all()
      assert min(row["s"]) > 0
      field = box(
        row["p"][along] - row["s"][along] / 2,
        row["p"][1] - row["s"][1] / 2,
        row["p"][along] + row["s"][along] / 2,
        row["p"][1] + row["s"][1] / 2,
      )
      assert supports[rec["support"]].buffer(0.000011).covers(field)
      assert (row["p"][axis] - plane) * sign - row["s"][axis] / 2 >= 0.03498
  windows = {
    r["role"]
    for r in proof["replacementNativeAtomicRows"]
    if r["role"].endswith("-glazing")
  }
  assert windows == {
    f"podewil-seven-by-three-window-{bay}-{level}-glazing"
    for bay in range(7)
    for level in range(3)
  }
  assert (
    sum(r["role"] == "instanz-north-return-name" for r in proof["nativeAtomicRows"])
    == 290
  )


def bounds(row: dict) -> tuple:
  """Exact integer half-microunit bounds of the retained fitting definition."""
  return tuple(
    round((p + side * s / 2) * 200000)
    for p, s in zip(row["p"], row["s"], strict=True)
    for side in [-1, 1]
  )


def test_native_compaction_is_an_exact_occupied_volume_union() -> None:
  """Every merge joins equal cross sections and never spans even a tiny gap."""
  proof = read("geo_data/regierungsviertel/litten-stadthaus-v297-source.json.gz")
  data = read("src/app/src/data/littenStadthausV297.json")
  for atomic_key, merge_key, result in [
    ("nativeAtomicRows", "nativeMergeProof", data["nativeRows"]),
    (
      "replacementNativeAtomicRows",
      "replacementNativeMergeProof",
      proof["replacementNativeRows"],
    ),
  ]:
    remaining = Counter(bounds(r) for r in proof[atomic_key])
    for step in proof[merge_key]:
      axis, a, b = step["axis"], step["a"], step["b"]
      ta, tb = tuple(v for q in a for v in q), tuple(v for q in b for v in q)
      assert remaining[ta] > 0 and remaining[tb] > 0
      if ta == tb:
        assert remaining[ta] >= 2
      remaining[ta] -= 1
      remaining[tb] -= 1
      assert all(a[i] == b[i] for i in range(3) if i != axis)
      assert a[axis][1] >= b[axis][0]
      merged = [list(q) for q in a]
      merged[axis] = [min(a[axis][0], b[axis][0]), max(a[axis][1], b[axis][1])]
      remaining[tuple(v for q in merged for v in q)] += 1
    assert +remaining == Counter(bounds(r) for r in result)
    assert len(result) < len(proof[atomic_key])


def test_only_the_single_original_podewil_estimate_transfers() -> None:
  """No source body, roof, courtyard or neighbouring facade is retired."""
  proof = read("geo_data/regierungsviertel/litten-stadthaus-v297-source.json.gz")
  c = proof["podewilCorrection"]
  assert c["oldDrawnTriangleCount"] == 200
  packets = c["packets"]["packets"]
  assert set(packets) == {"drawn:5_0", "minecraft:alt-mitte-v169-5_0-piece-0"}
  assert [sum(len(r["triangles"]) for r in p["records"]) for p in packets.values()] == [
    200,
    18,
  ]
  for p in packets.values():
    assert p["sourceOwner"] == p["sourcePart"] == "DEBE01YYK00002Vr"
    assert p["sourceSurfaceIndex"] == 33
    assert p["sourcePlane"] == c["sourcePlane"]
    assert p["openingCount"] == 21
    raw = historical_asset_bytes_v194(ROOT / p["packetPath"], p["packetSha256"])
    assert hashlib.sha256(raw).hexdigest() == p["packetSha256"]
  assert len(proof["replacementDrawnRows"]) == 240
  assert (
    sum(r["role"].endswith("-glazing") for r in proof["replacementDrawnRows"]) == 21
  )
  assert not any(
    "facing" in r["role"] or "skin" in r["role"] for r in proof["replacementDrawnRows"]
  )

  assert {t[2] for t in c["oldDrawnFittings"]} == {
    "window surround",
    "window glazing",
    "window mullion",
    "stone window sill",
  }
  native = packets["minecraft:alt-mitte-v169-5_0-piece-0"]
  path = ROOT / native["packetPath"]
  raw = historical_asset_bytes_v194(path, native["packetSha256"])
  old = json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)

  def triangles(packet: dict, mesh: dict) -> list[tuple]:
    vertices = (
      np.frombuffer(base64.b64decode(mesh["positions"]), "<u2")
      .reshape(-1, 3)
      .astype(float)
      / 100
      + packet["origin"]
    )
    indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    colors = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
    return [
      (
        tuple(sorted(tuple(round(float(v) * 100) for v in q) for q in vertices[t])),
        tuple(int(v) for v in colors[t[0]]),
      )
      for t in indices
    ]

  restored = Counter(
    key
    for key, color in triangles(old, native["complement"])
    if color == (164, 154, 125)
  )
  retired = Counter()
  for receipt in native["records"]:
    original = triangles(old, old["meshes"][receipt["mesh"]])
    for index in receipt["triangles"]:
      key, color = original[index]
      assert color == (22, 38, 44)
      retired[key] += 1
  assert restored == retired
