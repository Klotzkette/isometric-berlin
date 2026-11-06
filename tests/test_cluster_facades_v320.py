"""Exact source/front/complement contracts for the finite V320 facade compiler."""

from __future__ import annotations

import base64
import copy
import gzip
import hashlib
from collections import Counter

import numpy as np
import pytest
from shapely.geometry import Polygon, box

from scripts import build_cluster_facades_v320 as m


def front():
  return dict(
    owner="ordinary",
    a=[2, 2],
    b=[14, 2],
    normal=[0, -1],
    low=3,
    high=15,
    nativeSpans=[dict(a=[2, 2], b=[14, 2], normal=[0, -1], low=3, high=15)],
    omittedWindowColumns=[],
  )


def old_packet():
  mesh = m.base.FacadeMesh([0, 0, 0])
  m.base.window_grid(mesh, front())
  mesh.quad([[20, 3, 20], [21, 3, 20], [21, 4, 20], [20, 4, 20]], [70, 90, 110])
  return mesh.payload()


def expanded(part):
  p, c, ix = m.arrays(part)
  return [(tuple(map(int, p[i])), tuple(map(int, c[i]))) for t in ix for i in t]


def test_full_exact_old_multiset_and_unrelated_complement():
  packet = old_packet()
  original = copy.deepcopy(packet)
  plan = m.retire_generic(packet, [front()], False, "district-facades-v188")
  _, _, ix = m.arrays(packet["meshes"][0])
  assert plan == [{"mesh": 0, "triangles": list(range(len(ix) - 2))}]
  assert packet == original
  assert [list(t) for i, t in enumerate(ix) if i not in plan[0]["triangles"]] == [
    list(t) for t in ix[-2:]
  ]


def test_wrong_rgb_missing_and_coincident_extra_old_fittings_reject():
  packet = old_packet()
  changed = copy.deepcopy(packet)
  part = changed["meshes"][0]
  colors = bytearray(base64.b64decode(part["colors"]))
  colors[0] ^= 1
  part["colors"] = base64.b64encode(colors).decode()
  with pytest.raises(ValueError, match="multiset"):
    m.retire_generic(changed, [front()], False, "district-facades-v188")
  missing = copy.deepcopy(packet)
  missing["meshes"][0]["indices"] = base64.b64encode(
    base64.b64decode(packet["meshes"][0]["indices"])[12:]
  ).decode()
  with pytest.raises(ValueError, match="multiset"):
    m.retire_generic(missing, [front()], False, "district-facades-v188")
  extra = copy.deepcopy(packet)
  part = extra["meshes"][0]
  raw = base64.b64decode(part["indices"])
  part["indices"] = base64.b64encode(raw + raw[:12]).decode()
  with pytest.raises(ValueError, match="multiset"):
    m.retire_generic(extra, [front()], False, "district-facades-v188")


def test_deduplication_keeps_every_expanded_word_winding_and_colour():
  mesh = m.FrontMesh([0, 0, 0])
  m.build_front(
    mesh,
    front(),
    m.normalized_style({"key": "test", "wallRgb": [221, 214, 201]}),
    [],
    False,
  )
  before = mesh.payload()["meshes"][0]
  old_count = len(mesh.positions)
  mesh.compact()
  after = mesh.payload()["meshes"][0]
  assert len(mesh.positions) < old_count
  assert expanded(before) == expanded(after)


def test_doors_have_exact_wall_skin_apertures_and_no_window_cover():
  face = front()
  door = dict(face, point=[8, 2], width=1.1, height=2.25)
  style = m.normalized_style({"key": "test", "wallRgb": [221, 214, 201]})
  mesh = m.FrontMesh([0, 0, 0])
  report = m.build_front(mesh, face, style, [door], False)
  assert report["doorCellsOmitted"] > 0
  assert report["doorBounds"] == [[5.28, 2.98, 6.72, 5.47]]
  p, c, ix = m.arrays(mesh.payload()["meshes"][0])
  skin = tuple(m.base.linear(style["wallRgb"]))
  hole = box(7.28, 2.98, 8.72, 5.47)
  area = 0
  for triangle in ix:
    if all(tuple(color) == skin for color in c[triangle]):
      q = p[triangle] / 100
      # Quantized backing is visibly separated from the old wall at z=2.
      assert np.all(q[:, 2] == 1.97)
      polygon = Polygon(q[:, [0, 1]])
      assert polygon.intersection(hole).area == 0
      area += polygon.area
  assert area == pytest.approx(12 * 12 - 1.44 * 2.47)


def test_native_new_geometry_is_independently_cardinal_and_glass_not_occluded():
  mesh = m.FrontMesh([0, 0, 0])
  style = m.normalized_style(
    {"key": "deep", "revealDepthM": 0.13, "wallRgb": [221, 214, 201]}
  )
  m.build_front(mesh, front(), style, [], True)
  p, c, ix = m.arrays(mesh.payload()["meshes"][0])
  normals = np.cross(
    p[ix[:, 1]].astype(int) - p[ix[:, 0]], p[ix[:, 2]].astype(int) - p[ix[:, 0]]
  )
  assert np.all(np.count_nonzero(normals, axis=1) == 1)
  glass = tuple(m.base.linear(style["glassRgb"]))
  frame = tuple(m.base.linear(style["frameRgb"]))
  glass_z = p[np.all(c == glass, axis=1), 2]
  frame_z = p[np.all(c == frame, axis=1), 2]
  assert len(glass_z) and len(frame_z)
  assert min(frame_z) < min(glass_z)  # outward normal is negative Z
  assert set(glass_z) == {192}  # same exact centimetre plane for every pane


def test_actual_wall_proof_rejects_nav_only_or_foreign_paint():
  mesh = m.base.FacadeMesh([0, 0, 0])
  mesh.quad([[2, 3, 2], [14, 3, 2], [14, 15, 2], [2, 15, 2]], [211, 208, 195])
  packet = mesh.payload()
  packet["meshes"][0]["kind"] = "city"
  m.verify_wall(packet, front(), False)
  m.verify_wall(packet, front(), True)
  packet["meshes"][0]["colors"] = base64.b64encode(bytes([1] * 12)).decode()
  with pytest.raises(ValueError, match="ordinary drawn wall"):
    m.verify_wall(packet, front(), False)
  with pytest.raises(ValueError, match="coverage"):
    m.verify_wall(packet, front(), True)


def test_new_only_owner_must_have_the_same_actual_source_edge_and_datum():
  packet = dict(
    origin=[0, 0, 0],
    nav=dict(
      groundY=3,
      buildings=[
        dict(
          sourceId="ordinary",
          ring=[[2, 2], [14, 2], [14, 8], [2, 8]],
          minHeight=0,
          height=12,
        )
      ],
    ),
  )
  m.verify_primary_owner(packet, front())
  for face in [
    dict(front(), owner="foreign"),
    dict(front(), high=14.99),
    dict(front(), a=[2, 2.01]),
  ]:
    with pytest.raises(ValueError, match="selected owner"):
      m.verify_primary_owner(packet, face)


def test_new_only_positive_audit_cannot_be_a_truthy_label_or_partial_record():
  audit = next(
    f["ordinaryWallAudit"]
    for c in m.read(m.GEO / "cluster-facades-v320-south-profile.json")["clusters"]
    for f in c["faces"]
    if f["family"] == "primary"
  )
  m.validate_primary_audit(audit)
  for foreign in [
    True,
    "ordinary",
    {},
    dict(audit, building="school"),
    dict(audit, wallMaterialTagsAbsent=False),
    dict(audit, footprintIoU=0.71),
    dict(audit, previousGenericFittingsAbsent=False),
  ]:
    with pytest.raises(ValueError, match="positive ordinary"):
      m.validate_primary_audit(foreign)


def test_checked_in_plans_bind_full_source_and_only_old_generic_retirements():
  runtime = m.read(m.DATA / "clusterFacadesV320.json")
  proof = m.read(m.GEO / "cluster-facades-v320-evidence.json.gz")
  assert proof["groups"] == 50 and proof["owners"] == 200
  assert proof["sourceBaselineCommit"] == m.SOURCE_BASELINE
  assert proof["pendingBunPrimaryGuards"] == []
  assert runtime["keys"] == sorted(runtime["packets"])
  assert proof["bodyTrianglesRetired"] == proof["sourceFilesWritten"] == 0
  manifest = {d["id"]: d for d in m.read(m.PUBLIC / "manifest.json")["chunks"]}
  for key, plan in runtime["packets"].items():
    mode, packet_id = key.split(":", 1)
    path = m.PUBLIC / manifest[packet_id][mode]["url"]
    original = m.read(path)
    assert len(plan["records"]) == len(original["meshes"])
    for record, part in zip(plan["records"], original["meshes"]):
      assert record["fingerprint"] == m.part_fingerprint(part)
      assert record["kind"] == part["kind"]
    assert plan["origin"] == original["origin"]
    assert plan["appendFingerprint"] == m.part_fingerprint(plan["append"])
    assert plan["navGuard"] != 0 and plan["preparedNavGuard"] != 0
    for retire in plan["retire"]:
      assert original["meshes"][retire["mesh"]]["kind"] in {
        "district-facades-v188",
        "outer-facades-v230",
      }
      assert retire["triangles"] == sorted(set(retire["triangles"]))
    p, _, ix = m.arrays(plan["append"])
    assert len(ix) and len(p)
    assert len(original["meshes"]) < 16
    if mode == "minecraft":
      normals = np.cross(
        p[ix[:, 1]].astype(int) - p[ix[:, 0]], p[ix[:, 2]].astype(int) - p[ix[:, 0]]
      )
      assert np.all(np.count_nonzero(normals, axis=1) == 1)
  for relative, pin in proof["sourceInputs"].items():
    raw = (m.ROOT / relative).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == pin["wireSha256"]
    assert hashlib.sha256(gzip.decompress(raw)).hexdigest() == pin["decodedSha256"]
  assert {
    owner for plan in runtime["packets"].values() for owner in plan["owners"]
  } == {record["face"]["owner"] for record in proof["resolved"]}
  totals = Counter()
  for record in proof["resolved"]:
    assert set(record["modes"]) == {"drawn", "minecraft"}
    for mode, result in record["modes"].items():
      assert sum(front["windows"] for front in result["fronts"]) > 0
      totals[mode] += result["triangles"]
      key = mode + ":" + record["host"]
      plan = runtime["packets"][key]
      for selected in result["retire"]:
        aggregate = next(
          r["triangles"] for r in plan["retire"] if r["mesh"] == selected["mesh"]
        )
        assert set(selected["triangles"]).issubset(aggregate)
  assert totals == {"drawn": 122648, "minecraft": 94834}


def test_regional_groups_are_nonempty_unique_and_balanced_when_complete():
  profiles = [
    m.read(p) for p in sorted(m.GEO.glob("cluster-facades-v320-*-profile.json"))
  ]
  clusters = [c for p in profiles for c in p["clusters"]]
  ids, owners = [], []
  for cluster in clusters:
    assert len(cluster["faces"]) == 4 and cluster["references"]
    ids.append(cluster["id"])
    owners.extend(f["owner"] for f in cluster["faces"])
    m.normalized_style(cluster["style"])
  assert len(set(ids)) == len(ids)
  assert len(set(owners)) == len(owners)
  assert len(clusters) == 50 and len(owners) == 200
  rings = Counter(c["ring"] for c in clusters)
  assert rings == {"inner": 28, "outer": 22}
  with pytest.raises(ValueError, match="Exactly fifty"):
    m.compile_profiles([])
  with pytest.raises(ValueError, match="Unbounded"):
    m.normalized_style({"key": "wrong", "windowWidthRatio": 1.5})
