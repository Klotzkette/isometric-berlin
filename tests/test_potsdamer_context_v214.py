"""Source preservation and bounded facade ownership, not a surveyed opening plan."""

import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon, box

ROOT = Path(__file__).resolve().parents[1]
DIR = ROOT / "src/app/src/data"
DATA = json.loads((DIR / "potsdamerContextV214.json").read_text())
EVIDENCE = json.loads((DIR / "potsdamerContextV214Evidence.json").read_text())
PROFILE = json.loads((DIR / "potsdamerContextV214Profile.json").read_text())
SOURCE_PATH = ROOT / "geo_data/regierungsviertel/potsdamer-context-v214-source.json.gz"
SOURCE = json.loads(gzip.decompress(SOURCE_PATH.read_bytes()))


def test_all_26_original_parts_and_previous_packets_remain():
  assert hashlib.sha256(SOURCE_PATH.read_bytes()).hexdigest() == PROFILE["sourceSha256"]
  assert PROFILE["sourceParts"] == len(SOURCE["owners"]) == 26
  assert [len(f["parts"]) for f in SOURCE["families"]] == [3, 9, 9, 1, 1, 2, 1]
  for name, digest in EVIDENCE["retainedInputs"].items():
    path = ROOT / name
    if not path.exists() and "/raw/" in name:
      continue
    assert hashlib.sha256(path.read_bytes()).hexdigest() == digest
  prisms = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )
  by_id = {p["id"]: p for p in prisms["buildings"]}
  for owner in SOURCE["owners"]:
    assert owner["legacyPrism"] == by_id[owner["id"][-8:]]


def test_street_scope_correction_preserves_every_previous_member():
  for key, owner_index, count, digest in [
    (
      "boxes",
      9,
      802,
      "688254841f1d5df63837c6f6a99bf09f297d8fbe520838a93baaf7db9a167145",
    ),
    (
      "blocks",
      8,
      3387,
      "1e4d26becb3bdf8dd4565fac9609cc0e56fa3c0561e0dd846598f17c4c2a2ed5",
    ),
  ]:
    retained = sorted(r for r in DATA[key] if r[owner_index] < 21)
    assert len(retained) == count
    assert (
      hashlib.sha256(json.dumps(retained, separators=(",", ":")).encode()).hexdigest()
      == digest
    )


def test_every_drawn_detail_fits_its_original_wall_without_ground_barriers():
  parts = {p["id"]: p for f in SOURCE["families"] for p in f["parts"]}
  for x, y, z, w, h, depth, _, _, _, oi, fi in DATA["boxes"]:
    owner = SOURCE["owners"][oi]
    face = EVIDENCE["faces"][fi]
    assert face["owner"] == oi
    if "retainedPrismWall" in face:
      prism = owner["legacyPrism"]
      ring = prism["ring"]
      i = face["retainedPrismWall"]
      start, end = ring[i], ring[(i + 1) % len(ring)]
      raw_bottom = owner["groundY"] - owner["shiftY"]
      raw_top = raw_bottom + prism["h_dm"] / 10
      points = [
        [start[0] / 10, raw_bottom, start[1] / 10],
        [end[0] / 10, raw_bottom, end[1] / 10],
        [end[0] / 10, raw_top, end[1] / 10],
        [start[0] / 10, raw_top, start[1] / 10],
      ]
    else:
      surface = parts[owner["id"]]["surfaces"][face["sourceSurface"]]
      assert surface["kind"] == "WallSurface"
      points = surface["rings"][0]
    a, d, n = (np.array(face[k]) for k in ["a", "d", "normal"])
    u = float((np.array([x, z]) - a) @ d)
    offset = float((np.array([x, z]) - a) @ n)
    local = Polygon(
      [[(np.array([p[0], p[2]]) - a) @ d, p[1] + owner["shiftY"]] for p in points]
    )
    assert local.buffer(0.001).covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2))
    assert 0.14 < offset < 0.28 and depth <= 0.20
    assert y - h / 2 >= owner["groundY"] + 2.999


def test_main_street_accents_are_on_visible_lower_shells_not_recessed_atria():
  prisms = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  nearby = []
  for p in prisms:
    xs, zs = zip(*p["ring"], strict=True)
    if max(xs) < 1700 or min(xs) > 2450 or max(zs) < 11900 or min(zs) > 13400:
      continue
    shape = Polygon(
      [(px / 10, pz / 10) for px, pz in p["ring"]],
      [[(px / 10, pz / 10) for px, pz in hole] for hole in p["holes"]],
    )
    nearby.append((p, shape))
  for oi in range(21, 26):
    owner = SOURCE["owners"][oi]
    rows = [r for r in DATA["boxes"] if r[9] == oi]
    assert rows and min(r[1] for r in rows) < owner["groundY"] + 8
    for x, y, z, w, h, depth, _, _, _, _, fi in rows:
      face = EVIDENCE["faces"][fi]
      assert "retainedPrismWall" in face and face["sourceSurface"] is None
      d, n = np.array(face["d"]), np.array(face["normal"])
      for u in np.linspace(-w / 2, w / 2, 7):
        q = Point(*(np.array([x, z]) + d * u + n * depth / 2))
        for p, shape in nearby:
          if p["id"] == owner["legacyPrism"]["id"]:
            continue
          if p["y0_dm"] / 10 >= y + h / 2 or (p["y0_dm"] + p["h_dm"]) / 10 <= y - h / 2:
            continue
          assert not shape.covers(q), (owner["id"], p["id"], x, y, z)


def test_both_forms_have_only_bounded_facade_members():
  assert len(DATA["boxes"]) == PROFILE["drawnBoxes"] < 4000
  assert len(DATA["blocks"]) == PROFILE["nativeBoxes"] < 14000
  assert {r[8] for r in DATA["boxes"]} == {1, 2, 3, 4}
  for r in DATA["blocks"]:
    assert r[3] == r[5] == 0.75 and 0 < r[4] < 42
    owner = SOURCE["owners"][r[8]]
    assert (
      Polygon(owner["ring"], owner["holes"]).boundary.distance(Point(r[0], r[2])) < 5.7
    )
    assert r[1] - r[4] / 2 >= owner["groundY"] + 2.2
