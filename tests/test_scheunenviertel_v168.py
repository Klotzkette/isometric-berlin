"""Scheunenviertel: exact source families, face ownership and frozen packet proof."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import sys
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import Point, box, shape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_scheunenviertel_v168 import (  # noqa: E402
  BASE_TAG,
  DEFAULT_OUTPUT,
  EXPLICIT_RESERVED,
  KIND,
  QUARTER,
  SOURCE,
  base_bytes,
  core_footprint,
  court_front,
  digest,
  face_additions,
  footprint,
  previous_sources,
  scoped_bounds,
)

DATA = json.loads(SOURCE.read_text())
CANDIDATE = Path("/tmp/v168-scheunen-packets")


def test_finite_scope_and_retained_owners_are_source_exact() -> None:
  scope, _ = scoped_bounds()
  assert DATA["baseRelease"] == BASE_TAG == "v1.0.67"
  assert scope.equals(QUARTER)
  assert 0.3e6 < scope.area < 1e6
  for r in DATA["roads"]:
    assert scope.buffer(1e-6).covers(shape(r["geometry"]))
  prior = previous_sources()
  buildings = {b["id"]: b for s in prior for b in s["buildings"]}
  core = {p["id"]: p for s in prior for p in s["corePrisms"]}
  ids = {b["id"] for b in DATA["buildings"]}
  assert not ids.intersection(DATA["excludedDetailedOwners"])
  assert not ids.intersection(buildings)
  for b in DATA["buildings"]:
    assert scope.covers(footprint(b))
  for b in DATA["retainedDetailedBuildings"]:
    assert b == buildings[b["id"]]
  for p in DATA["retainedDetailedCorePrisms"]:
    assert p == core[p["id"]]
    assert core_footprint(p).intersects(scope)
  for key in (
    "corePrisms",
    "retainedDetailedCorePrisms",
    "buildings",
    "retainedDetailedBuildings",
  ):
    assert not {p["id"] for p in DATA[key]}.intersection(EXPLICIT_RESERVED)
  assert {
    "Almstadtstraße",
    "Steinstraße",
    "Münzstraße",
    "Weydingerstraße",
    "Weinmeisterstraße",
    "Hirtenstraße",
  } <= {r["name"] for r in DATA["roads"]}


def test_court_front_rejects_party_walls_and_occupied_gaps() -> None:
  wall = [[(2400, 3, -850), (2412, 3, -850), (2412, 22, -850), (2400, 22, -850)]]
  behind = Point(2406, -880)
  mass = box(2400, -870, 2412, -850)
  exposed = court_front(wall, mass, behind, 3, 22)
  assert exposed.triangles
  assert all(role.startswith("court ") for _, _, role in exposed.triangles)
  assert not any("shopfront" in role for _, _, role in exposed.triangles)
  assert not court_front(
    wall, mass.union(box(2400, -850, 2412, -842)), behind, 3, 22
  ).triangles
  assert not court_front(wall, mass, Point(2406, -845), 3, 22).triangles


def test_old_street_windows_are_not_regenerated() -> None:
  wall = [[(2400, 3, -850), (2412, 3, -850), (2412, 22, -850), (2400, 22, -850)]]
  road = Point(2406, -840)
  drawn, native = face_additions(
    [wall], road, road, box(2400, -870, 2412, -850), 3, 22, True, False
  )
  assert drawn.triangles
  assert {role for _, _, role in drawn.triangles} <= {
    "lintel cap",
    "spandrel inset",
    "shopfront pier",
    "cornice dentil",
  }
  assert not native.triangles
  drawn, native = face_additions(
    [wall], road, road, box(2400, -870, 2412, -850), 3, 22, True, True
  )
  assert not drawn.triangles and not native.triangles


def test_complete_lod2_source_parts_and_sheets_match_original_archives() -> None:
  ns = {
    "b": "http://www.opengis.net/citygml/building/1.0",
    "g": "http://www.opengis.net/gml",
  }
  remaining = {b["id"]: b for b in DATA["buildings"]}
  assert len(remaining) > 100
  for archive in DATA["sourceArchives"]:
    path = (
      ROOT / "geo_data/regierungsviertel/raw/lod2" / archive["url"].rsplit("/", 1)[1]
    )
    if not path.exists():
      pytest.skip("Optional ignored official archives are unavailable")
    assert hashlib.sha256(path.read_bytes()).hexdigest() == archive["sha256"]
    with zipfile.ZipFile(path) as raw:
      tree = ET.fromstring(raw.read(raw.namelist()[0]))
    for parent in tree.findall(".//b:Building", ns):
      identity = parent.get("{" + ns["g"] + "}id")
      if identity not in remaining:
        continue
      stored = remaining.pop(identity)
      ground = min(
        float(v)
        for e in parent.findall(".//b:GroundSurface//g:posList", ns)
        for v in e.text.split()[2::3]
      )
      assert ground == stored["groundNHN"]
      parts = []
      for part in parent.findall(".//b:BuildingPart", ns) or [parent]:
        surfaces = []
        for boundary in part.findall("b:boundedBy", ns):
          for surface in boundary:
            for polygon in surface.findall(".//g:Polygon", ns):
              rings = []
              for e in polygon.findall(".//g:posList", ns):
                values = list(map(float, e.text.split()))
                ring = [
                  [
                    round(x - 389500, 3),
                    round(y - ground + 3, 3),
                    round(5820000 - z, 3),
                  ]
                  for x, z, y in zip(values[::3], values[1::3], values[2::3])
                ]
                if ring[0] == ring[-1]:
                  ring.pop()
                rings.append(ring)
              if rings:
                surfaces.append({"kind": surface.tag.split("}")[-1], "rings": rings})
        parts.append({"id": part.get("{" + ns["g"] + "}id"), "surfaces": surfaces})
      assert stored["parts"] == parts, identity
  assert not remaining


def test_candidates_preserve_every_prior_mesh_nav_and_all_source_parts() -> None:
  audit_path = (
    ROOT / "geo_data/regierungsviertel/scheunenviertel-v168-preservation.json"
  )
  if not audit_path.exists() or not CANDIDATE.is_dir():
    pytest.skip("Authoring candidates are intentionally not bundled")
  preservation = json.loads(audit_path.read_text())
  owned = {b["id"] for b in DATA["buildings"]}
  found = defaultdict(set)
  for identity, modes in preservation.items():
    for mode, before in modes.items():
      raw = gzip.decompress((CANDIDATE / f"{identity}.{mode}.json.gz").read_bytes())
      packet = json.loads(raw)
      assert len(packet["meshes"]) <= 16
      assert (
        sum(len(base64.b64decode(m["positions"])) // 6 for m in packet["meshes"])
        <= 400_000
      )
      assert (
        sum(len(base64.b64decode(m["indices"])) // 4 for m in packet["meshes"])
        <= 2_400_000
      )
      assert (
        len(base64.b64decode(packet.get("lines", {}).get("positions", ""))) // 6
        <= 400_000
      )
      if before["baseSha256"] is not None:
        base = base_bytes(DEFAULT_OUTPUT / f"{identity}.{mode}.json.gz")
        assert hashlib.sha256(base).hexdigest() == before["baseSha256"]
        original = json.loads(gzip.decompress(base))
        assert digest(original["meshes"]) == before["meshes"]
      else:
        assert identity.endswith("-scheunen-v168")
        assert packet["nav"]["buildings"] == []
      assert len(raw) < 12 * 1024 * 1024
      assert (
        digest([m for m in packet["meshes"] if m["kind"] != KIND]) == before["meshes"]
      )
      assert (
        digest(
          {
            **packet["nav"],
            "buildings": [
              b for b in packet["nav"]["buildings"] if b["sourceId"] not in owned
            ],
          }
        )
        == before["unownedNavigation"]
      )
      for nav in packet["nav"]["buildings"]:
        if nav["sourceId"] in owned:
          assert nav.get("partId"), nav["sourceId"]
          found[mode].add((nav["sourceId"], nav["partId"]))
      if mode == "minecraft":
        for mesh in packet["meshes"]:
          if mesh["kind"] != KIND:
            continue
          points = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(
            -1, 3
          )
          indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(
            -1, 3
          )
          triangles = points[indices]
          assert np.all(
            np.any(np.max(triangles, axis=1) == np.min(triangles, axis=1), axis=1)
          )
  for building in DATA["buildings"]:
    assert footprint(building).area > 0
    for part in building["parts"]:
      if any(s["kind"] == "GroundSurface" for s in part["surfaces"]):
        for mode in ("drawn", "minecraft"):
          assert (building["id"], part["id"]) in found[mode]


def test_native_merge_preserves_coloured_planes_and_openings() -> None:
  from build_karl_marx_allee_v161 import Detail
  from build_scheunenviertel_v168 import merge_native_faces
  from shapely.geometry import Polygon
  from shapely.ops import unary_union

  detail = Detail()
  # A 10x10 source wall with one genuinely open central cell and a separate
  # differently coloured face. A union must not fill the court/window hole.
  for x in range(0, 10, 2):
    for y in range(0, 10, 2):
      if x == 4 and y == 4:
        continue
      detail.polygon(
        [[x, y, 0], [x + 2, y, 0], [x + 2, y + 2, 0], [x, y + 2, 0]],
        (120, 130, 140) if x < 8 else (200, 160, 100),
        "block",
      )
  merged = merge_native_faces(detail)
  assert len(merged.triangles) < len(detail.triangles)
  for color in {(120, 130, 140), (200, 160, 100)}:

    def cover(d):
      return unary_union(
        [Polygon([(x, y) for x, y, _ in t]) for t, c, _ in d.triangles if c == color]
      )

    assert cover(detail).equals(cover(merged))
    assert not cover(merged).covers(Point(5, 5))
  assert all(
    np.cross(np.subtract(t[1], t[0]), np.subtract(t[2], t[0]))[2] > 0
    for t, _, _ in merged.triangles
  )
