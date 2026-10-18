"""Source preservation and native geometry contracts for the outer-house pass."""

import hashlib
from pathlib import Path

import numpy as np
from shapely.geometry import LineString

from scripts import build_district_facades_v188 as base
from scripts import build_outer_facades_v230 as build

ROOT = Path(__file__).resolve().parents[1]


def test_previous_packets_and_established_bounds_remain_exact():
  evidence = base.read_json(build.EVIDENCE)
  for asset in evidence["oldAssets"]:
    with (build.OUT / asset["url"]).open("rb") as stream:
      assert hashlib.file_digest(stream, "sha256").hexdigest() == asset["sha256"]
  manifest = base.read_json(build.OUT / "manifest.json")
  assert len(manifest["chunks"]) <= 2048
  assert 0 < len(evidence["companions"]) <= 90
  assert (
    sum(c[f]["bytes"] for c in evidence["companions"] for f in ["drawn", "minecraft"])
    < 2 * 1024**2
  )


def test_new_fronts_match_real_original_walls_and_leave_prior_facades_alone():
  evidence = base.read_json(build.EVIDENCE)
  context = base.read_json(build.CONTEXT)
  assert not set(f["owner"] for f in evidence["faces"]) & set(context["authoredIds"])
  assert len({f["owner"] for f in evidence["faces"]}) == len(evidence["faces"])
  manifest = {c["id"]: c for c in base.read_json(build.OUT / "manifest.json")["chunks"]}
  packets = {}
  for face in evidence["faces"]:
    if face["chunk"] not in packets:
      p = base.read_json(build.OUT / manifest[face["chunk"]]["drawn"]["url"])
      packets[face["chunk"]] = p, base.mesh_wall_triangles(p)
    packet, triangles = packets[face["chunk"]]
    ox, oy, oz = packet["origin"]
    assert base.source_wall_exists(
      triangles,
      np.array(face["a"]) - [ox, oz],
      np.array(face["b"]) - [ox, oz],
      face["low"] - oy,
      face["high"] - oy,
    )
    for span in face["nativeSpans"]:
      a, b = span["a"], span["b"]
      assert a[0] == b[0] or a[1] == b[1]
      assert (
        LineString([a, b])
        .difference(LineString([face["a"], face["b"]]).buffer(1.601, cap_style=2))
        .length
        < 0.001
      )


def test_new_packets_are_only_facade_marks_with_no_collision_or_ground():
  e = base.read_json(build.EVIDENCE)
  for desc in e["companions"]:
    for family in ["drawn", "minecraft"]:
      p = base.read_json(build.OUT / desc[family]["url"])
      assert (
        not p["nav"]["buildings"] and not p["nav"]["ground"] and not p["nav"]["water"]
      )
      assert all(m["kind"] == "outer-facades-v230" for m in p["meshes"])
