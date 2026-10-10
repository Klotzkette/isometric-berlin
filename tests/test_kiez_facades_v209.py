"""Independent v209 scope, immutable packets, source planes and transfer checks."""

import base64
import gzip
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, shape
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"


def read(path: Path) -> dict:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


EVIDENCE = read(GEO / "kiez-facades-v209-evidence.json.gz")
CONTEXT = read(GEO / "kiez-facades-v209-context.json.gz")
NAMED = read(GEO / "helmholtz-sites-v209-source.json")
DATA = read(ROOT / "src/app/src/data/kiezFacadesV209.json")
RECEIPT = read(ROOT / "src/app/src/data/kiezSitesOwnershipV209.json")


def test_complete_scope_selection_and_unchanged_prior_descriptors() -> None:
  faces = EVIDENCE["faces"]
  assert len(faces) == len({f["owner"] for f in faces}) == 575
  assert Counter(f["district"] for f in faces) == {
    "Moabit": 264,
    "Weinbergsweg / Kastanienallee": 19,
    "Kollwitzkiez": 190,
    "Helmholtzplatz": 102,
  }
  current = {d["id"]: d for d in read(OUT / "manifest.json")["chunks"]}
  for old in EVIDENCE["oldDescriptors"]:
    assert current[old["id"]] == old
  assert len(EVIDENCE["companions"]) == 14
  assert len(current) <= 2048
  old_panes = read(GEO / "district-facades-v188-evidence.json.gz")
  old_moabit = {f["owner"] for f in old_panes["faces"] if f["district"] == "Moabit"}
  assert {f["owner"] for f in faces if f["previousV188"]} == old_moabit
  assert (
    hashlib.sha256((GEO / "kiez-facades-v209-context.json.gz").read_bytes()).hexdigest()
    == EVIDENCE["contextSha256"]
  )


def test_every_new_frontage_still_matches_two_exact_original_source_wall_triangles() -> (
  None
):
  old = {d["id"]: d for d in EVIDENCE["oldDescriptors"]}
  grouped = defaultdict(list)
  for face in EVIDENCE["faces"]:
    grouped[face["chunk"]].append(face)
  protected = STRtree([shape(b["geometry"]) for b in CONTEXT["protectedBuildings"]])
  authored = set(CONTEXT["authoredIds"])
  region = shape(CONTEXT["selectionRegion"])
  for chunk, faces in grouped.items():
    descriptor = old[chunk]
    path = OUT / descriptor["drawn"]["url"]
    assert (
      hashlib.sha256(path.read_bytes()).hexdigest() == descriptor["drawn"]["sha256"]
    )
    packet = read(path)
    triangles = set()
    for part in packet["meshes"]:
      if part["kind"] != "city":
        continue
      positions = np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(
        -1, 3
      )
      colors = np.frombuffer(base64.b64decode(part["colors"]), "u1").reshape(-1, 3)
      indices = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
      for ix in indices:
        if (colors[ix] == [166, 161, 139]).all():
          triangles.add(tuple(sorted(tuple(map(int, v)) for v in positions[ix])))
    ox, oy, oz = packet["origin"]
    for face in faces:
      assert face["owner"] not in authored
      q = [
        tuple(round((v - o) * 100) for v, o in zip(p, [ox, oy, oz], strict=True))
        for p in [
          [*face["a"][:1], face["low"], face["a"][1]],
          [*face["b"][:1], face["low"], face["b"][1]],
          [*face["b"][:1], face["high"], face["b"][1]],
          [*face["a"][:1], face["high"], face["a"][1]],
        ]
      ]
      assert (
        tuple(sorted([q[0], q[1], q[2]])) in triangles
        and tuple(sorted([q[0], q[2], q[3]])) in triangles
      ) or (
        tuple(sorted([q[0], q[1], q[3]])) in triangles
        and tuple(sorted([q[1], q[2], q[3]])) in triangles
      )
      line = LineString([face["a"], face["b"]])
      assert region.buffer(0.05).covers(line)
      assert not len(protected.query(line, predicate="intersects"))


def test_companion_geometry_is_bounded_empty_nav_and_native_is_orthogonal() -> None:
  all_faces = defaultdict(list)
  for face in EVIDENCE["faces"]:
    all_faces[face["chunk"]].append(face)
  total = Counter()
  for desc in EVIDENCE["companions"]:
    for mode in ["drawn", "minecraft"]:
      asset = desc[mode]
      path = OUT / asset["url"]
      assert hashlib.sha256(path.read_bytes()).hexdigest() == asset["sha256"]
      packet = read(path)
      assert packet["nav"] == {"groundY": 3, "ground": [], "water": [], "buildings": []}
      assert len(packet["meshes"]) == 1
      for mesh in packet["meshes"]:
        p = (
          np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3) / 100
          + packet["origin"]
        )
        assert np.isfinite(p).all()
        assert (
          np.min(p[:, 0]) >= desc["bounds"][0] and np.max(p[:, 0]) <= desc["bounds"][2]
        )
        assert (
          np.min(p[:, 2]) >= desc["bounds"][1] and np.max(p[:, 2]) <= desc["bounds"][3]
        )
        for quad in p.reshape(-1, 4, 3):
          if mode == "minecraft":
            assert np.ptp(quad[:, 0]) < 0.001 or np.ptp(quad[:, 2]) < 0.001

          # Every emitted pane/sill/edge lies against one approved finite wall.
          def contained(face: dict) -> bool:
            a, b = np.array(face["a"]), np.array(face["b"])
            d = b - a
            length = np.linalg.norm(d)
            d /= length
            delta = quad[:, [0, 2]] - a
            u, depth = delta @ d, delta @ np.array(face["normal"])
            return (
              min(u) >= -0.02
              and max(u) <= length + 0.02
              and min(depth) >= -0.02
              and max(depth) <= 0.125
              and min(quad[:, 1]) >= face["low"]
              and max(quad[:, 1]) <= face["high"]
            )

          candidates = all_faces[desc["detailCompanionOf"]]
          if mode == "minecraft":
            candidates = [s for f in candidates for s in f["nativeSpans"]]
          assert any(contained(f) for f in candidates)
        total[mode] += len(p)
  assert total == {"drawn": 92172, "minecraft": 13408}
  assert EVIDENCE["counts"]["drawnGeometryBytes"] < 1_400_000
  assert EVIDENCE["counts"]["minecraftGeometryBytes"] < 210_000


def fnv(strings: list[str]) -> int:
  value = 2166136261
  for text in strings:
    for c in text:
      value = ((value ^ ord(c)) * 16777619) & 0xFFFFFFFF
  return value


def test_exact_named_transfer_receipts_match_immutable_packets_without_overlap() -> (
  None
):
  assert {r["owner"] for r in RECEIPT["records"]} == {
    b["id"] for b in NAMED["buildings"]
  }
  used = defaultdict(set)
  for r in RECEIPT["records"]:
    path = OUT / f"{r['tile']}.{r['mode']}.json.gz"
    assert hashlib.sha256(path.read_bytes()).hexdigest() == r["sha256"]
    packet = read(path)
    mesh = next(m for m in packet["meshes"] if m["kind"] == r["kind"])
    assert (
      fnv([mesh[k] for k in ["positions", "colors", "indices"]]) == r["fingerprint"]
    )
    key = r["tile"], r["mode"], r["kind"]
    assert not used[key].intersection(r["triangles"])
    used[key].update(r["triangles"])
    count = len(base64.b64decode(mesh["indices"])) // 12
    assert r["triangles"] and min(r["triangles"]) >= 0 and max(r["triangles"]) < count
  assert sum(len(r["triangles"]) for r in RECEIPT["records"]) == 295
  for r in RECEIPT["lineRecords"]:
    lines = read(OUT / f"{r['tile']}.drawn.json.gz")["lines"]
    assert fnv([lines[k] for k in ["positions", "colors"]]) == r["fingerprint"]
    assert max(r["segments"]) < len(base64.b64decode(lines["positions"])) // 12
  assert sum(len(r["segments"]) for r in RECEIPT["lineRecords"]) == 24


def test_source_sheets_remain_exact_except_documented_single_storey_height() -> None:
  assert len(NAMED["buildings"]) == 3
  assert sum(len(b["parts"]) for b in NAMED["buildings"]) == 5
  for oi, building in enumerate(NAMED["buildings"]):
    expected_xz = {
      (p[0], p[2])
      for part in building["parts"]
      for s in part["surfaces"]
      for ring in s["rings"]
      for p in ring
    }
    points = [
      p
      for s in DATA["surfaces"]
      if s["owner"] == oi
      for triangle in s["triangles"]
      for p in triangle
    ]
    assert expected_xz == {(p[0], p[2]) for p in points}
    if building["id"] == "DEBE03YY60000DEJ":
      assert building["parts"][0]["height_m"] == 12.071
      assert max(p[1] for p in points) == 6.4
      assert '"building:levels"=>"1"' in building["osmTags"]
    else:
      low = DATA["owners"][oi]["sourceGroundY"]
      original = {
        (p[0], round(p[1] - low + 3, 7), p[2])
        for part in building["parts"]
        for s in part["surfaces"]
        for ring in s["rings"]
        for p in ring
      }
      assert original == {(p[0], round(p[1], 7), p[2]) for p in points}
  assert all(
    r["newHeight"] == 3.4 and r["owner"] == "DEBE03YY60000DEJ"
    for r in RECEIPT["navigationRecords"]
  )
  for r in RECEIPT["navigationRecords"]:
    candidates = read(OUT / f"{r['tile']}.{r['mode']}.json.gz")["nav"]["buildings"]
    assert r["original"] in candidates
  assert len(NAMED["visualReferences"]) == 2
  assert all(
    r["author"] == "Mazbln" and r["license"] == "CC BY-SA 3.0"
    for r in NAMED["visualReferences"]
  )
