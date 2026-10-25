"""Bounded immutable-owner audit for the Tacheles skyline correction."""

import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"


def read(p):
  raw = p.read_bytes()
  return json.loads(gzip.decompress(raw) if p.suffix == ".gz" else raw)


def arrays(p):
  return (
    np.frombuffer(base64.b64decode(p["positions"]), "<u2").reshape(-1, 3),
    np.frombuffer(base64.b64decode(p["colors"]), "u1").reshape(-1, 3),
    np.frombuffer(base64.b64decode(p["indices"]), "<u4").reshape(-1, 3),
  )


def signature(v):
  return b"".join(sorted(row.tobytes() for row in v))


def test_complete_owner_and_unchanged_originals():
  e = read(ROOT / "geo_data/regierungsviertel/golgatha-v270-evidence.json.gz")
  source = ROOT / e["sourceFile"]
  assert hashlib.sha256(source.read_bytes()).hexdigest() == e["sourceSha256"]
  actual = next(b for b in read(source)["buildings"] if b["id"] == "DEBE01YYK000002g")
  assert actual == e["originalOwner"]
  assert len(actual["parts"]) == 8
  assert sum(len(p["surfaces"]) for p in actual["parts"]) == 112
  assert (
    max(p["topY"] for p in actual["parts"] if p["id"] != "DEBE3Dwcdzr9GoF6") < e["cutY"]
  )
  for path, digest in e["originals"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest


def test_receipts_preserve_all_unowned_triangles():
  e = read(ROOT / "geo_data/regierungsviertel/golgatha-v270-evidence.json.gz")
  for audit in e["audit"]:
    packet = read(ROOT / audit["file"])
    mesh = packet["meshes"][audit["meshIndex"]]
    positions, colours, indices = arrays(mesh)
    v = np.column_stack([positions, colours])
    receipt = next(
      r
      for r in e["sourceTriangleReceipts"]
      if r["tile"] == audit["tile"] and r["mode"] == audit["mode"]
    )
    selected = set(receipt["triangles"])
    assert len(selected) == audit["removed"]
    assert max(selected) < len(indices)
    assert all(
      (positions[t, 1].max() / 100 + packet["origin"][1]) > e["cutY"]
      for i, t in enumerate(indices)
      if i in selected
    )
    preserved = [signature(v[t]) for i, t in enumerate(indices) if i not in selected]
    assert len(preserved) == audit["preserved"]
    assert hashlib.sha256(b"".join(preserved)).hexdigest() == audit["preservedSha256"]
  assert sum(r["removed"] for r in e["audit"]) == 343
  assert sum(len(r["segments"]) for r in e["sourceLineReceipts"]) == 17


def test_upper_model_and_exact_lower_complements():
  d = read(DATA / "golgathaV270.json")
  p = read(DATA / "golgathaV270Profile.json")
  for mode in ["drawn", "native"]:
    lower, _, _ = arrays(d[mode][0])
    upper, _, indices = arrays(d[mode][1])
    assert lower[:, 1].max() / 100 + d["origin"][1] == p["cutY"]
    assert upper[:, 1].min() / 100 + d["origin"][1] >= p["cutY"] - 0.001
    assert upper[:, 1].max() / 100 + d["origin"][1] == p["topY"]
    if mode == "native":
      for part in d[mode]:
        v, _, ix = arrays(part)
        for t in v[ix].astype(float):
          normal = np.cross(t[1] - t[0], t[2] - t[0])
          assert np.count_nonzero(abs(normal) > 0.01) <= 1
  assert len(p["cornerPinnacles"]) == 4
  assert len(p["nativeColumns"]) < 400
  assert (DATA / "golgathaV270.json").stat().st_size < 150_000
  assert (
    p["metrics"]["drawnTriangles"] < 2500 and p["metrics"]["nativeTriangles"] < 3500
  )
  assert all(max(a[1], b[1]) <= p["cutY"] for a, b in d["lowerLines"])


def test_every_republished_lower_colour_is_original_or_receipted_masonry():
  d = read(DATA / "golgathaV270.json")
  e = read(ROOT / "geo_data/regierungsviertel/golgatha-v270-evidence.json.gz")
  original_colours = {"drawn": set(), "native": set()}
  colours = read(DATA / "golgathaV270Colours.json")
  masonry = {(c >> 16, (c >> 8) & 255, c & 255) for c in colours["palette"]}
  for a in e["audit"]:
    packet = read(ROOT / a["file"])
    _, colours, indices = arrays(packet["meshes"][a["meshIndex"]])
    r = next(
      r
      for r in e["sourceTriangleReceipts"]
      if r["tile"] == a["tile"] and r["mode"] == a["mode"]
    )
    original_colours["native" if a["mode"] == "minecraft" else "drawn"].update(
      tuple(c) for t in indices[r["triangles"]] for c in colours[t]
    )
  for mode in ["drawn", "native"]:
    _, colours, _ = arrays(d[mode][0])
    assert set(map(tuple, colours)) <= original_colours[mode] | masonry


def test_masonry_colour_receipts_never_touch_foreign_or_roof_incident_faces():
  e = read(ROOT / "geo_data/regierungsviertel/golgatha-v270-evidence.json.gz")
  assert len(e["colourAudit"]) == 2
  for audit in e["colourAudit"]:
    packet = read(ROOT / audit["file"])
    _, _, ix = arrays(packet["meshes"][audit["meshIndex"]])
    owned = set(audit["ownedTriangles"])
    changed = set(audit["changedVertices"])
    assert changed
    for i, triangle in enumerate(ix):
      if changed.intersection(map(int, triangle)):
        assert i in owned
    assert not changed.intersection(audit["excludedSharedVertices"])
