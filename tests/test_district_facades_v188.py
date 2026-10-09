"""Independent source ownership, old-city preservation and packet bounds."""

import base64
import gzip
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from packet_additions_v200 import audited_v200_additions
from packet_receipts_v190 import (
  assert_retained_descriptor,
  audited_v190_changes,
  baseline_v189,
  v190_additions,
)
from shapely.affinity import affine_transform, translate
from shapely.geometry import LineString, Point, Polygon, shape
from shapely.ops import nearest_points
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"


def read(path: Path) -> dict:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


EVIDENCE = read(GEO / "district-facades-v188-evidence.json.gz")
CONTEXT = read(GEO / "district-facades-v188-context.json.gz")
MANIFEST = read(OUT / "manifest.json")


def test_every_previous_packet_descriptor_and_payload_is_retained() -> None:
  old = EVIDENCE["oldDescriptors"]
  assert len(old) == 1369
  changes, _ = audited_v190_changes()
  additions = {**v190_additions(), **audited_v200_additions()}
  retained = [
    c
    for c in MANIFEST["chunks"]
    if not c["id"].startswith("district188-") and c["id"] not in additions
  ]
  assert [d["id"] for d in retained] == [d["id"] for d in old]
  for previous, current in zip(old, retained, strict=True):
    assert_retained_descriptor(previous, current, changes)
  assert {d["id"]: d for d in MANIFEST["chunks"] if d["id"] in additions} == additions
  # Old metadata remains exact; only the explicitly appended north footprint
  # and its union bounds extend the original spatial coverage.
  previous_manifest = json.loads(baseline_v189(OUT / "manifest.json"))
  north = read(GEO / "north-city-v190-manifest.json")
  east = read(GEO / "east-city-v200-manifest.json")
  for key, expected in EVIDENCE["oldManifestFieldSha256"].items():
    value = (
      previous_manifest[key]
      if key in {"bounds", "footprint", "outskirtsV187"}
      else MANIFEST[key]
    )
    raw = json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    assert hashlib.sha256(raw).hexdigest() == expected
  assert MANIFEST["outskirtsV187"] == {
    **previous_manifest["outskirtsV187"],
    "chunkCount": previous_manifest["outskirtsV187"]["chunkCount"]
    + sum(
      d.get("detailCompanionOf", "").startswith("outer187-") for d in additions.values()
    ),
  }
  assert (
    MANIFEST["footprint"]
    == previous_manifest["footprint"] + north["footprint"] + east["footprint"]
  )
  assert MANIFEST["bounds"] == [
    min(previous_manifest["bounds"][0], north["bounds"][0], east["bounds"][0]),
    min(previous_manifest["bounds"][1], north["bounds"][1], east["bounds"][1]),
    max(previous_manifest["bounds"][2], north["bounds"][2], east["bounds"][2]),
    max(previous_manifest["bounds"][3], north["bounds"][3], east["bounds"][3]),
  ]


def test_selected_fronts_keep_actual_original_wall_triangles_and_owner() -> None:
  by_chunk = defaultdict(list)
  for face in EVIDENCE["faces"]:
    by_chunk[face["chunk"]].append(face)
  authored = set(CONTEXT["authoredIds"])
  protected = STRtree([shape(f["geometry"]) for f in CONTEXT["protectedBuildings"]])
  for chunk, faces in by_chunk.items():
    descriptor = next(d for d in MANIFEST["chunks"] if d["id"] == chunk)
    source = read(OUT / descriptor["drawn"]["url"])
    ox, oy, oz = source["origin"]
    triangles = set()
    for part in source["meshes"]:
      if part["kind"] != "city":
        continue
      p = np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(-1, 3)
      c = np.frombuffer(base64.b64decode(part["colors"]), "u1").reshape(-1, 3)
      ix = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
      for indices in ix:
        if (c[indices] == [166, 161, 139]).all():
          triangles.add(tuple(sorted(tuple(map(int, v)) for v in p[indices])))
    for face in faces:
      assert face["owner"] not in authored
      owner = next(
        b
        for b in source["nav"]["buildings"]
        if b["sourceId"] == face["owner"]
        and Polygon(b["ring"], b["holes"]).boundary.distance(
          Point(face["a"][0] - ox, face["a"][1] - oz)
        )
        < 0.02
      )
      geometry = translate(Polygon(owner["ring"], owner["holes"]), ox, oz)
      assert not len(protected.query(geometry, predicate="intersects"))
      corners = [
        (face["a"][0], face["low"], face["a"][1]),
        (face["b"][0], face["low"], face["b"][1]),
        (face["b"][0], face["high"], face["b"][1]),
        (face["a"][0], face["high"], face["a"][1]),
      ]
      q = [
        tuple(round((v - origin) * 100) for v, origin in zip(point, [ox, oy, oz]))
        for point in corners
      ]
      assert (
        tuple(sorted([q[0], q[1], q[2]])) in triangles
        and tuple(sorted([q[0], q[2], q[3]])) in triangles
      ) or (
        tuple(sorted([q[0], q[1], q[3]])) in triangles
        and tuple(sorted([q[1], q[2], q[3]])) in triangles
      )


def test_district_and_named_street_evidence_does_not_claim_full_wedding() -> None:
  names = {
    "Moabit",
    "Tiergarten",
    "Wedding",
    "Kreuzberg",
    "Friedrichshain",
    "Charlottenburg",
    "Schöneberg",
  }
  boundaries = read(GEO / "district-facades-v188-boundaries.geojson")
  districts = {
    f["properties"]["nam"]: affine_transform(
      shape(f["geometry"]), [1, 0, 0, -1, -389500, 5820000]
    )
    for f in boundaries["features"]
  }
  assert set(districts) == names
  roads = {r["id"]: shape(r["geometry"]) for r in CONTEXT["roads"]}
  counts = Counter(f["district"] for f in EVIDENCE["faces"])
  assert counts == {
    "Charlottenburg": 1994,
    "Moabit": 264,
    "Schöneberg": 1849,
    "Wedding": 21,
    "Kreuzberg": 1979,
    "Friedrichshain": 1665,
  }
  assert len(EVIDENCE["faces"]) == len({f["owner"] for f in EVIDENCE["faces"]}) == 7772
  for face in EVIDENCE["faces"]:
    center = Point(*((np.array(face["a"]) + face["b"]) / 2))
    assert districts[face["district"]].buffer(0.05).covers(center)
    near = nearest_points(center, roads[face["streetId"]])[1]
    toward = np.array([near.x - center.x, near.y - center.y])
    distance = float(np.linalg.norm(toward))
    assert 3 <= distance <= 30
    assert np.dot(toward, face["normal"]) / distance >= 0.8
  assert "does not complete Wedding" in EVIDENCE["policy"]


def test_new_packets_have_no_navigation_ownership_and_bounded_native_geometry() -> None:
  previous = {d["id"]: d for d in EVIDENCE["oldDescriptors"]}
  added = [d for d in MANIFEST["chunks"] if d["id"].startswith("district188-")]
  assert added == EVIDENCE["companions"]
  assert len(added) == 153
  geometry = Counter()
  transfer = 0
  for desc in added:
    assert desc["bounds"] == previous[desc["detailCompanionOf"]]["bounds"]
    for family in ["drawn", "minecraft"]:
      asset = desc[family]
      raw = (OUT / asset["url"]).read_bytes()
      assert hashlib.sha256(raw).hexdigest() == asset["sha256"]
      assert len(gzip.decompress(raw)) == asset["decodedBytes"] < 12 * 1024 * 1024
      packet = read(OUT / asset["url"])
      assert packet["id"] == desc["id"]
      assert packet["nav"] == {"groundY": 3, "ground": [], "water": [], "buildings": []}
      assert len(packet["meshes"]) <= 1 and "lines" not in packet
      transfer += len(raw)
      for mesh in packet["meshes"]:
        assert mesh["kind"] == "district-facades-v188"
        p = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
        ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4")
        assert len(p) < 400000 and ix.max() < len(p)
        assert (p[:, [0, 2]] <= 51200).all()
        geometry[family] += len(p) * 12 + len(ix) * (2 if len(p) <= 65535 else 4)
        if family == "minecraft":
          quads = p.reshape(-1, 4, 3)
          assert (
            (np.ptp(quads[:, :, 0], axis=1) == 0)
            | (np.ptp(quads[:, :, 2], axis=1) == 0)
          ).all()
  assert transfer == 4878190 < 6 * 1024 * 1024
  assert geometry == {"drawn": 9393600, "minecraft": 2818320}
  assert (OUT / "district-facades-v188-evidence.json.gz").read_bytes() == (
    GEO / "district-facades-v188-evidence.json.gz"
  ).read_bytes()


def test_all_new_drawn_vertices_stay_on_selected_source_wall_envelopes() -> None:
  for desc in EVIDENCE["companions"]:
    packet = read(OUT / desc["drawn"]["url"])
    mesh = packet["meshes"][0]
    points = (
      np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3) / 100
      + packet["origin"]
    )
    offset = 0
    for face in [
      f for f in EVIDENCE["faces"] if f["chunk"] == desc["detailCompanionOf"]
    ]:
      count = (face["windowCount"] + 2) * 4
      selected = points[offset : offset + count]
      offset += count
      assert selected[:, 1].min() >= face["low"] + 0.67
      assert selected[:, 1].max() <= face["high"] - 0.27
      line = LineString([face["a"], face["b"]])
      assert max(line.distance(Point(x, z)) for x, _, z in selected) <= 0.113
    assert offset == len(points)


def test_every_native_pane_is_inside_its_own_finite_selected_frontage() -> None:
  """A nearby endpoint must never admit the rest of a long stepped wall."""
  total = 0
  for desc in EVIDENCE["companions"]:
    packet = read(OUT / desc["minecraft"]["url"])
    if not packet["meshes"]:
      assert not any(
        f["nativeWindowCount"]
        for f in EVIDENCE["faces"]
        if f["chunk"] == desc["detailCompanionOf"]
      )
      continue
    p = (
      np.frombuffer(base64.b64decode(packet["meshes"][0]["positions"]), "<u2").reshape(
        -1, 3
      )
      / 100
      + packet["origin"]
    )
    offset = 0
    for face in [
      f for f in EVIDENCE["faces"] if f["chunk"] == desc["detailCompanionOf"]
    ]:
      source = LineString([face["a"], face["b"]])
      corridor = source.buffer(1.66, cap_style=2)
      count = face["nativeWindowCount"] * 4
      assert sum(s["windowCount"] for s in face["nativeSpans"]) * 4 == count
      vertices = p[offset : offset + count]
      offset += count
      if not count:
        continue
      # Check every corner against its OWN approved frontage, rather than the
      # closest unrelated street-facing building elsewhere in this packet.
      assert all(corridor.covers(Point(x, z)) for x, _, z in vertices), face["owner"]
      assert vertices[:, 1].min() >= face["low"]
      assert vertices[:, 1].max() <= face["high"]
      for span in face["nativeSpans"]:
        # Micrometre tolerance includes the flat end caps as well as sides;
        # changing only the corridor width does not move a flat cap plane.
        assert (
          source.buffer(1.6, cap_style=2)
          .buffer(0.000001)
          .covers(LineString([span["a"], span["b"]]))
        )
      if face["owner"] == "DEBE02YY40000D9c":
        # Tivoliplatz's old 62m native wall touched a ~27m selected frontage.
        # The previously emitted x=633.935 pane was ~46m beyond that frontage.
        assert vertices[:, 0].max() < 589
      total += count // 4
    assert offset == len(p)
  assert total == EVIDENCE["counts"]["nativeWindows"]


def test_every_drawn_window_column_has_its_own_clear_outward_approach() -> None:
  """Five whole-front probes cannot detect a narrow intervening neighbour."""
  occupied = []
  for asset in EVIDENCE["oldAssets"]:
    if not asset["url"].endswith(".drawn.json.gz"):
      continue
    packet = read(OUT / asset["url"])
    if not any(part["kind"] == "city" for part in packet["meshes"]):
      continue
    ox, _, oz = packet["origin"]
    for b in packet["nav"]["buildings"]:
      geometry = translate(Polygon(b["ring"], b["holes"]), ox, oz)
      if geometry.is_valid and not geometry.is_empty:
        occupied.append(geometry)
  index = STRtree(occupied)
  regression_seen = False
  for desc in EVIDENCE["companions"]:
    packet = read(OUT / desc["drawn"]["url"])
    p = (
      np.frombuffer(base64.b64decode(packet["meshes"][0]["positions"]), "<u2").reshape(
        -1, 3
      )
      / 100
      + packet["origin"]
    )
    offset = 0
    for face in [
      f for f in EVIDENCE["faces"] if f["chunk"] == desc["detailCompanionOf"]
    ]:
      panes = p[offset : offset + face["windowCount"] * 4].reshape(-1, 4, 3)
      offset += (face["windowCount"] + 2) * 4
      n = np.array(face["normal"])
      # One sample per actually emitted column; centimetre storage can differ
      # by 5mm, so begin at .10m outside the wall rather than at .025m.
      columns = {tuple(quad[0, [0, 2]]) + tuple(quad[1, [0, 2]]) for quad in panes}
      for coords in columns:
        left, right = np.array(coords[:2]), np.array(coords[2:])
        approach = Polygon(
          [left + n * 0.03, right + n * 0.03, right + n * 2.9, left + n * 2.9]
        )
        assert not len(index.query(approach, predicate="intersects")), face["owner"]
      if face["owner"] == "DEBE07YY900009Rm":
        regression_seen = True
        assert face["omittedWindowColumns"]
        centers = panes.mean(axis=1)[:, [0, 2]]
        previous = np.array([-2361.9333333, 3775.5633333]) + n * 0.075
        assert np.min(np.linalg.norm(centers - previous, axis=1)) > 1
    assert offset == len(p)
  assert regression_seen
