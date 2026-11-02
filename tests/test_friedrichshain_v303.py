"""Independent source/geometry checks for the finite Friedrichshain pass."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
from pathlib import Path
from typing import Any

import numpy as np
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

from scripts import build_friedrichshain_v303 as build
from scripts.build_breitscheid_towers_v161 import triangles_for

ROOT = Path(__file__).resolve().parents[1]


def load(path: Path) -> Any:
  value = path.read_bytes()
  return json.loads(gzip.decompress(value) if path.suffix == ".gz" else value)


DATA = load(build.DATA)
SOURCE = load(build.SOURCE)
EVIDENCE = load(build.EVIDENCE)


def arrays(mesh: dict[str, Any]) -> tuple[np.ndarray, ...]:
  return (
    np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3),
    np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3),
  )


def test_complete_four_families_and_original_archives_are_retained() -> None:
  assert {p["address"] for p in SOURCE["parents"]} == {
    "Boxhagener Straße 70",
    "Boxhagener Straße 71",
    "Boxhagener Straße 72",
    "Bänschstraße 74",
  }
  assert sum(len(p["parts"]) for p in SOURCE["parents"]) == 6
  for a in SOURCE["archives"]:
    assert hashlib.sha256((ROOT / a["file"]).read_bytes()).hexdigest() == a["sha256"]
  for p in SOURCE["parents"]:
    assert p["coverage"] > 0.99
    assert all(
      part["surfaces"] and part["top_y_m"] > part["ground_y_m"] for part in p["parts"]
    )


def test_every_official_drawn_sheet_triangle_is_present_in_its_complete_model() -> None:
  for parent in SOURCE["parents"]:
    plan = DATA["packets"]["drawn:" + parent["packet"]]
    points, indices = arrays(plan["append"])
    represented = {build.triangle_key(points[t]) for t in indices}
    receipt = next(
      r
      for r in EVIDENCE["completeBodies"]
      if r["parent"] == parent["id"] and r["key"].startswith("drawn:")
    )
    origin = np.array(plan["origin"])
    offset = receipt["offsetY"]
    for part in parent["parts"]:
      for surface in part["surfaces"]:
        for triangle in triangles_for(surface["rings"]):
          triangle = np.array(triangle)
          triangle[:, 1] += offset
          packed = np.rint((triangle - origin) * 100).astype(int)
          if len(set(map(tuple, packed))) == 3:
            assert build.triangle_key(packed) in represented


def test_old_body_retirements_never_include_foreign_prepared_parts() -> None:
  assert len([p for p in DATA["packets"].values() if "preparedRecords" in p]) == 4
  for key, plan in DATA["packets"].items():
    if "preparedRecords" not in plan:
      continue
    assert plan["retireNav"] and plan["appendNav"]
    assert {b["sourceId"] for b in plan["retireNav"]} == set(plan["owners"])
    assert set(plan["owners"]) <= set(p["owner"] for p in SOURCE["parents"])
    for record in plan["retire"]:
      assert plan["preparedRecords"][record["mesh"]]["kind"] == "city"
      assert record["triangles"] == sorted(set(record["triangles"]))
    assert plan["retireLines"] == sorted(set(plan["retireLines"]))
    if key.startswith("minecraft:"):
      assert not plan["retireLines"] and "appendLines" not in plan
    else:
      assert plan["appendLines"] and plan["retireLines"]


def test_all_native_faces_are_independently_cardinal() -> None:
  for key, plan in DATA["packets"].items():
    if not key.startswith("minecraft:"):
      continue
    points, indices = arrays(plan["append"])
    normals = np.cross(
      points[indices[:, 1]].astype(np.int64) - points[indices[:, 0]],
      points[indices[:, 2]].astype(np.int64) - points[indices[:, 0]],
    )
    assert np.all((normals != 0).sum(axis=1) <= 1), key


def test_native_navigation_is_the_actual_cardinal_roof_footprint() -> None:
  for key, plan in DATA["packets"].items():
    if not key.startswith("minecraft:") or "preparedRecords" not in plan:
      continue
    for b in plan["appendNav"]:
      ring = b["ring"]
      assert all(
        a[0] == z[0] or a[1] == z[1] for a, z in zip(ring, ring[1:] + ring[:1])
      )
      shape = Polygon(ring, b["holes"])
      caps = unary_union([box(*c[:4]) for c in b["nativeRoofCaps"]])
      # One complete family can contain several disconnected cardinal polygons;
      # each polygon owns the subset of actual caps intersecting it.
      assert shape.difference(caps).area < 1e-7
      assert all(b["height"] + 3 + 1e-6 >= c[4] for c in b["nativeRoofCaps"])
      assert not shape.is_empty and shape.is_valid
      for h in b["holes"]:
        assert not shape.covers(Polygon(h).representative_point())


def test_roof_nav_matches_preserved_drawn_source_triangles() -> None:
  for parent in SOURCE["parents"]:
    plan = DATA["packets"]["drawn:" + parent["packet"]]
    records = [b for b in plan["appendNav"] if b["sourceId"] == parent["id"]]
    assert len(records) == len(parent["parts"])
    for record, part in zip(records, parent["parts"], strict=True):
      expected = sum(
        len(triangles_for(s["rings"]))
        for s in part["surfaces"]
        if s["kind"] == "RoofSurface"
      )
      assert len(record["roofTriangles"]) == expected
      assert record["holes"] == [
        [
          [round(x - plan["origin"][0], 4), round(z - plan["origin"][2], 4)]
          for x, z in h
        ]
        for h in part["holes"]
      ]


def test_finite_profiles_have_unambiguous_addresses_and_both_views() -> None:
  profiles = load(build.PROFILES)
  assert len(profiles) == 27
  assert len({p["owner"] for p in profiles}) == 27
  assert {
    "Rigaer Straße",
    "Silvio-Meier-Straße",
    "Simon-Dach-Straße",
    "Boxhagener Straße",
  } == {p["address"].rsplit(" ", 1)[0] for p in profiles}
  represented = {
    (r["profile"]["owner"], r["key"].startswith("minecraft:"))
    for r in EVIDENCE["fronts"]
  }
  assert all(
    (p["owner"], native) in represented for p in profiles for native in [False, True]
  )
  assert all(p["estimate"] and p["addressSource"] for p in profiles)


def test_full_raw_mesh_guards_and_same_packet_limits() -> None:
  for key, plan in DATA["packets"].items():
    native = key.startswith("minecraft:")
    raw = load(build.packet_path(key.split(":", 1)[1], native))
    assert plan["records"] == build.source_records(raw)
    assert plan["appendFingerprint"] == build.front.mesh_fingerprint(plan["append"])
    mesh = plan["append"]
    points, indices = arrays(mesh)
    assert int(indices.max()) < len(points)
    assert len(base64.b64decode(mesh["colors"])) == len(points) * 3
    assert len(plan.get("preparedRecords", plan["records"])) + 1 <= 16
    assert (
      sum(len(base64.b64decode(m["positions"])) // 6 for m in raw["meshes"])
      + len(points)
      <= 400000
    )


def test_reference_sources_are_attributed_and_no_photo_pixels_are_distributed() -> None:
  refs = load(ROOT / "geo_data/regierungsviertel/friedrichshain-v303-references.json")
  assert len(refs["references"]) >= 9
  for r in refs["references"]:
    assert r["url"].startswith("https:") and r["credit"] and r["use"]
    for photo in r.get("photos", []):
      assert len(photo["imageSha256"]) == 64
  assert (
    "photographic" in refs["policy"].lower() or "photography" in refs["policy"].lower()
  )
  assert all(p["append"]["positionType"] == "u16cm" for p in DATA["packets"].values())


def test_retired_generic_fittings_are_only_exact_known_front_panes() -> None:
  proof = EVIDENCE["retiredGenericPanes"]
  assert proof
  owners = {p["owner"] for p in load(build.PROFILES)}
  assert all(r["owner"] in owners and len(r["quadSha256"]) == 64 for r in proof)
  assert not {p["owner"] for p in SOURCE["parents"]} & {r["owner"] for r in proof}
