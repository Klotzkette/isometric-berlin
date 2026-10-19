"""Exact core transfer, complete source sheets and independent native geometry."""

from __future__ import annotations

import base64
import importlib.util
import math
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from shapely import STRtree
from shapely.geometry import Point, Polygon

from scripts.spree_bridge_lineage_v242 import assert_preserved_v242

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location(
  "schloss239", ROOT / "scripts/build_schlossplatz_v239.py"
)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def vertices(mesh):
  return np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)


def test_complete_source_families_and_all_measured_vertices_survive():
  source, runtime = m.read(m.SOURCE), m.read(m.RUNTIME)
  assert runtime["sourceSha256"] == m.sha(m.SOURCE)
  parts = [p for b in source["buildings"] for p in b["parts"]]
  assert Counter(p["parent"] for p in parts) == {
    "DEBE01YYK000060j": 2,
    "DEBE01YYK0000Bfk": 6,
    "DEBE01YYK00008jV": 1,
    "DEBE01YYK0000CnW": 1,
  }
  packet = runtime["core"]["drawn"]
  assert len(packet["meshes"]) == 2
  got = {tuple(q) for mesh in packet["meshes"] for q in vertices(mesh)}
  origin = np.array(packet["origin"])
  for p in parts:
    for s in p["surfaces"]:
      for ring in s["rings"]:
        for xyz in ring:
          q = tuple(np.round((np.array(xyz) - origin) * 100).astype(int))
          assert q in got, (p["id"], s["kind"], q)
  # Original absolute source elevation, never basement-to-street inflation.
  staatsrat = source["buildings"][0]
  assert staatsrat["parts"][0]["ground_y_m"] == 2.727
  assert staatsrat["parts"][0]["top_y_m"] == 33.139
  assert sum(len(p["surfaces"]) for p in parts) == 125


def test_old_prisms_and_packets_are_immutable_and_only_two_owners_yield():
  source, owners = m.read(m.SOURCE), m.read(m.OWNERS)
  for path, digest in source["inputs"].items():
    assert m.sha(ROOT / path) == digest
  current = {p["id"]: p for p in m.read(m.PRISMS)["buildings"]}
  assert owners["prismIds"] == ["23075450", "94079583"]
  assert owners["previousPrisms"] == [current[k] for k in owners["prismIds"]]
  assert owners["sourceSha256"] == m.sha(m.SOURCE)
  for b in source["buildings"]:
    assert b["previousPrism"] == current[b["prism"]]


def test_native_retirement_matches_exact_snapped_vertical_source_tuples():
  owners = m.read(m.OWNERS)
  payload = m.read(m.VOXELS)
  shapes = [(p, Polygon(np.array(p["ring"]) / 10)) for p in owners["previousPrisms"]]
  expected = set()
  for ri, row in enumerate(payload["building_rows"]):
    z = (ri + payload["grid"]["min_z_idx"]) * 4 + 2
    if not 270 < z < 450:
      continue
    for start, length, low, high, kind in row:
      for i in range(length):
        x = (start + i + payload["grid"]["min_x_idx"]) * 4 + 2
        if not 1950 < x < 2280:
          continue
        for p, g in shapes:
          # build_minecraft_voxels.snap_up: source height rounds to 4m blocks.
          top = p["y0_dm"] + math.ceil(p["h_dm"] / 40 - 1e-9) * 40
          if g.covers(Point(x, z)) and (low, high) == (p["y0_dm"], top):
            expected.add((x, z, low, high, kind, p["id"]))
  got = {
    (c["x"], c["z"], c["low"], c["high"], c["kind"], identity)
    for c in owners["previousColumns"]
    for identity in c["prismIds"]
  }
  assert got == expected
  assert len(got) == 506
  assert Counter(c[-1] for c in got) == {"23075450": 232, "94079583": 274}
  assert {(c[2], c[3], c[4]) for c in got} == {(52, 292, 3)}
  assert all(len(c["prismIds"]) == 1 for c in owners["previousColumns"])
  non_targets = [
    p for p in m.read(m.PRISMS)["buildings"] if p["id"] not in owners["prismIds"]
  ]
  tree = STRtree(
    [
      Polygon(np.array(p["ring"]) / 10, [np.array(h) / 10 for h in p["holes"]])
      for p in non_targets
    ]
  )
  # No different source owner occupies even one of the selected core centres,
  # independent of matching heights; the 506 receipts are unambiguous.
  for c in owners["previousColumns"]:
    assert len(tree.query(Point(c["x"], c["z"]), predicate="intersects")) == 0


def test_native_normals_are_orthogonal_and_per_site_buffers_stay_bounded():
  runtime = m.read(m.RUNTIME)
  for mode, packet in runtime["core"].items():
    assert packet["origin"] == [1900, -10, 240]
    assert packet["nav"] == {"groundY": 5.2, "ground": [], "water": [], "buildings": []}
    assert len(packet["meshes"]) == 2
    total = 0
    for mesh in packet["meshes"]:
      v = vertices(mesh)
      ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      assert len(v) <= 65535
      assert len(ix) < 200000
      total += len(v) * 12 + ix.size * 2
      assert np.max(v[:, 0]) <= 40000
      assert np.max(v[:, 2]) <= 25000
      if mode == "minecraft":
        tri = v[ix].astype(float)
        normals = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
        assert np.all(np.count_nonzero(abs(normals) > 1e-8, axis=1) <= 1)
    assert total < (1_100_000 if mode == "drawn" else 2_100_000)
  assert m.RUNTIME.stat().st_size < 5 * 1024 * 1024


def test_navigation_follows_complete_source_footprints_and_courtyard_void():
  source, owners = m.read(m.SOURCE), m.read(m.OWNERS)
  parts = [p for b in source["buildings"] for p in b["parts"]]
  assert len(parts) == len(owners["navigationSolids"]) == 10
  for part, nav in zip(parts, owners["navigationSolids"], strict=True):
    assert nav["sourceId"] == part["id"]
    assert nav["ring"] == part["ring"] and nav["holes"] == part["holes"]
    assert nav["minY"] == 5.2 and nav["maxY"] == part["top_y_m"]
  # The former carriage court is open between the source wings.
  assert not any(
    Polygon(s["ring"], s["holes"]).covers(Point(2178, 329))
    for s in owners["navigationSolids"]
  )


def test_reference_supported_recognition_and_distinct_hfm_campus():
  ev = m.read(m.EVIDENCE)
  roles = ev["sourceRoleCounts"]["drawn"]
  assert roles["liebknecht-portal/gilt-baluster"] > 0
  assert roles["liebknecht-portal/baroque-arch"] > 0
  assert roles["hanns-eisler-portico/paired-tuscan-column"] == 800
  assert roles["marstall/colossal-upper-pilaster"] > 0
  assert roles["hanns-eisler-lettering"] > 0
  assert ev["recognition"]["marstall"]["otherCampusPreserved"] == "Charlottenstraße 55"
  assert 17.9 < ev["recognition"]["staatsrat"]["portalWidth"] < 18.1
  heights = [
    s["elevationNHN"]
    for s in m.read(m.GEO / "schlossplatz-v239-bdom.json")["samples"]
    if s["role"] == "portal-transect" and s["v"] in [1.5, 2.5]
  ]
  assert 64.0 < max(heights) < 64.4
  assert 34.0 < ev["recognition"]["staatsrat"]["portalTopY"] < 34.4


def test_exact_v169_transfer_keeps_every_unowned_encoded_triangle_and_packet():
  import build_schlossplatz_alt_mitte_v239 as previous

  receipt, evidence = previous.read(previous.OUT), previous.read(previous.EVIDENCE)
  assert receipt["parents"] == sorted(previous.PARENTS)
  assert receipt["counts"] == {
    "drawn": 391,
    "front": 14766,
    "minecraft": 15857,
    "inkSegments": 353,
  }
  assert evidence["exactMatchMissing"] == evidence["unownedTriangleLoss"] == 0
  for path, digest in evidence["inputs"].items():
    assert_preserved_v242(ROOT / path, digest)
  total = Counter()
  for row in evidence["records"]:
    packet = previous.read(ROOT / row["file"])
    mesh = packet["meshes"][row["meshIndex"]]
    fingerprint = previous.fingerprint(
      [mesh[k] for k in ("positions", "colors", "indices")]
    )
    transfer = [
      r
      for r in receipt["records"]
      if r["tile"] == row["tile"]
      and r["mode"] == row["mode"]
      and r["fingerprint"] == fingerprint
    ]
    assert len(transfer) == 1
    selected = set(transfer[0]["triangles"])
    assert len(selected) == len(transfer[0]["triangles"]) == row["removed"]
    sigs = previous.signatures(mesh)
    assert all(0 <= i < len(sigs) for i in selected)
    kept = [s for i, s in enumerate(sigs) if i not in selected]
    assert previous.hashlib.sha256(b"".join(kept)).hexdigest() == row["preservedSha256"]
    assert len(kept) == row["preserved"]
    total[row["layer"]] += len(selected)
  assert dict(total) == {
    k: v for k, v in receipt["counts"].items() if k != "inkSegments"
  }


def test_previous_navigation_exactly_matches_retained_v169_and_new_part_identity():
  import build_schlossplatz_alt_mitte_v239 as previous

  receipt = previous.read(previous.OUT)
  metadata = previous.read(previous.core.APP_DATA / "altMitteV169Navigation.json")
  actual = [
    p
    for f in metadata["chunkFiles"]
    if f["field"] == "parts"
    for p in previous.read(previous.core.APP_DATA / f["file"])
    if p["sourceId"] in previous.PARENTS
  ]

  def by_id(rows):
    return {r["id"]: r for r in rows}

  assert by_id(receipt["previousNavigationParts"]) == by_id(actual)
  assert len(actual) == 10
  owners = m.read(m.OWNERS)
  assert set(receipt["partIds"]) == {s["sourceId"] for s in owners["navigationSolids"]}
  # Existing v169 raised the Staatsrat basement to ground and therefore its roof
  # too. New source retains the absolute surveyed roof instead of adding 2.473m.
  old = next(p for p in actual if p["id"] == "DEBE3DSwdRWZ80JQ")
  new = next(p for p in owners["navigationSolids"] if p["sourceId"] == old["id"])
  assert old["topY"] == 35.612 and new["maxY"] == 33.139


def test_low_source_wing_retains_fittings_when_whole_old_front_grid_yields():
  evidence = m.read(m.EVIDENCE)
  for mode in ("drawn", "minecraft"):
    roles = evidence["sourceRoleCounts"][mode]
    assert (
      sum(
        count
        for role, count in roles.items()
        if role.startswith("staatsrat-secondary/DEBE3DCblg8Jy42G/")
      )
      > 0
    )
    assert (
      sum(
        count
        for role, count in roles.items()
        if role.startswith("staatsrat-secondary/DEBE3DSwdRWZ80JQ/")
      )
      > 0
    )
