"""Exact final v166 ownership: preserve old city data and every new leaf record."""

from __future__ import annotations

import base64
import copy
import gzip
import hashlib
import json
import math
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import numpy as np
import pytest
from shapely.geometry import MultiPoint, Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from integrate_city_refinements_v166 import (  # noqa: E402
  line_signature,
  subtract_lines,
  subtract_meshes,
)

PACKETS = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
STREET_KIND = "mitte-street-fronts-v166"
DATA = ROOT / "src/app/src/data"


def read(path: Path) -> Any:
  return json.loads(path.read_text())


def canonical(value: Any) -> str:
  return json.dumps(value, sort_keys=True, separators=(",", ":"))


def triangle_keys(meshes: list[dict]) -> Counter:
  """Independent reader: position and colour both distinguish submitted faces."""
  result = Counter()
  for mesh in meshes:
    points = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
    colors = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
    indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    vertices = np.concatenate((points, colors.astype("<u2")), axis=1)
    result.update(
      b"".join(sorted(bytes(vertex) for vertex in vertices[index])) for index in indices
    )
  return result


def number_of_triangles(meshes: list[dict]) -> int:
  return sum(len(base64.b64decode(m["indices"])) // 12 for m in meshes)


def mesh(triangles: list, colors: list, kind: str = "city") -> dict:
  return {
    "kind": kind,
    "positionType": "u16cm",
    "positions": base64.b64encode(np.array(triangles, "<u2").tobytes()).decode(),
    "colors": base64.b64encode(np.array(colors, "u1").tobytes()).decode(),
    "indices": base64.b64encode(
      np.arange(len(triangles) * 3, dtype="<u4").tobytes()
    ).decode(),
  }


def test_subtraction_preserves_duplicate_multiplicity_colour_and_refined_meshes():
  triangle = [[0, 1300, 0], [100, 1300, 0], [0, 1400, 100]]
  red, blue = [70, 10, 10], [10, 10, 70]
  owned = mesh([triangle], [[red] * 3])
  city = mesh([triangle, triangle, triangle], [[red] * 3, [red] * 3, [blue] * 3])
  previous_detail = mesh([triangle], [[red] * 3], "retained-older-detail")
  original = [city, previous_detail]
  snapshot = copy.deepcopy(original)
  result = subtract_meshes(original, triangle_keys([owned]))
  assert original == snapshot
  assert result[-1] == previous_detail
  assert triangle_keys(result) == triangle_keys(original) - triangle_keys([owned])
  assert len(base64.b64decode(result[0]["indices"])) // 12 == 2
  with pytest.raises(AssertionError, match="Missing requested source triangles"):
    subtract_meshes([previous_detail], triangle_keys([owned]))


def test_line_subtraction_preserves_colours_multiplicity_and_detects_absent_owner():
  points = np.array([[0, 1402, 0], [100, 1402, 0]] * 3, "<u2")
  colors = np.array([[70, 10, 10]] * 4 + [[10, 10, 70]] * 2, "u1")
  lines = {
    "positionType": "u16cm",
    "positions": base64.b64encode(points.tobytes()).decode(),
    "colors": base64.b64encode(colors.tobytes()).decode(),
  }
  key = next(iter(line_signature(lines)))
  result = subtract_lines(lines, Counter({key: 1}))
  assert line_signature(result) == line_signature(lines) - Counter({key: 1})
  with pytest.raises(AssertionError):
    subtract_lines(lines, Counter({key: 3}))


@pytest.fixture(scope="module")
def release() -> dict:
  try:
    raw = subprocess.check_output(
      [
        "git",
        "show",
        "v1.0.65:src/app/public/mesh/surrounding-berlin-v159/manifest.json",
      ],
      cwd=ROOT,
      stderr=subprocess.DEVNULL,
    )
  except subprocess.CalledProcessError:
    pytest.skip("Exact released-packet comparison requires the retained v1.0.65 tag")
  return {p["id"]: p for p in json.loads(raw)["chunks"]}


def expected_owners() -> set[str]:
  streets = read(ROOT / "geo_data/regierungsviertel/mitte-streets-v166.json")
  heritage = read(DATA / "mitteHeritageV166Navigation.json")
  alexander = read(DATA / "alexanderNorthV166Navigation.json")
  cinemas = read(DATA / "cityWestCinemasV166Navigation.json")
  kosmos = read(DATA / "kosmosV166Navigation.json")
  return (
    {b["id"] for b in streets["buildings"]}
    | set(heritage["outerOwners"])
    | {p["id"] for p in alexander["outerOwners"]}
    | {p["id"] for p in cinemas["parents"] if p["outer"]}
    | {p["id"] for p in kosmos["parents"] if p["outer"]}
  )


def test_manifest_registers_new_interior_street_chunks_and_exact_source_packages(
  release,
):
  manifest = read(PACKETS / "manifest.json")
  audit = read(ROOT / "geo_data/regierungsviertel/city-refinements-v166-audit.json")
  street_audit = read(ROOT / "geo_data/regierungsviertel/mitte-streets-v166-audit.json")
  descriptors = {p["id"]: p for p in manifest["chunks"]}
  assert len(descriptors) == len(manifest["chunks"])
  required = {p["id"] for p in street_audit["chunks"]}
  assert required <= descriptors.keys()
  assert {"3_-1", "2_-2", "2_-3", "1_-4", "2_-1"} <= required - release.keys()
  owners = expected_owners()
  assert (
    set(manifest["source"]["cityRefinementsV166"]["exactMovedOuterSourceIds"]) == owners
  )
  assert audit["ownerCount"] == len(owners)
  assert {s for c in audit["chunks"] for s in c["sourceIds"]} == owners
  assert audit["unownedTriangleLoss"] == audit["unownedNavigationLoss"] == 0
  assert {c["id"] for c in audit["chunks"]} <= descriptors.keys()
  # Added independent scopes such as Kosmos must not be rejected by a frozen
  # total chunk count; all their precise identities are checked above.


def source_prisms_by_top(rows: list[dict], owners: set[str]) -> dict:
  result = defaultdict(list)
  for row in rows:
    if row["sourceId"] not in owners:
      continue
    assert "partId" not in row, f"Already-refined owner replaced: {row['sourceId']}"
    polygon = Polygon(row["ring"], row["holes"])
    high = round((3 + row["height"]) * 100)
    result[high].append((polygon, 3 + row["minHeight"], 3 + row["height"]))
  return result


def belongs_to_source(key: bytes, by_top: dict, lines: bool = False) -> bool:
  points = np.frombuffer(key, "<u2").reshape(2 if lines else 3, 6)[:, :3] / 100
  points[:, 1] -= 10  # Packet y origin; X/Z remain in local nav coordinates.
  xz = points[:, [0, 2]]
  high = round(float(points[:, 1].max()) * 100) - (2 if lines else 0)
  for polygon, low, top in by_top[high]:
    if lines:
      if all(polygon.boundary.distance(Point(p)) <= 0.03 for p in xz):
        return True
    elif np.ptp(points[:, 1]) < 0.001:
      if polygon.buffer(0.03).covers(MultiPoint(xz).convex_hull):
        return True
    elif (
      float(points[:, 1].min()) >= low - 0.011
      and float(points[:, 1].max()) <= top + 0.011
    ):
      if all(polygon.boundary.distance(Point(p)) <= 0.03 for p in xz):
        return True
  return False


def test_final_packets_preserve_unowned_surfaces_navigation_and_all_street_leaf_parts(
  release,
):
  manifest = read(PACKETS / "manifest.json")
  descriptors = {p["id"]: p for p in manifest["chunks"]}
  audit = read(ROOT / "geo_data/regierungsviertel/city-refinements-v166-audit.json")
  source = read(ROOT / "geo_data/regierungsviertel/mitte-streets-v166.json")
  owners = expected_owners()
  street_owners = {p["id"] for p in source["buildings"]}
  collected = {mode: defaultdict(list) for mode in ("drawn", "minecraft")}
  nav_heights = {mode: defaultdict(set) for mode in collected}
  empty_nav = {
    "ground": [],
    "water": [],
    "roads": [],
    "bridges": [],
    "buildings": [],
    "groundY": 3,
  }
  for entry in audit["chunks"]:
    descriptor = descriptors[entry["id"]]
    for mode, measurements in entry["modes"].items():
      packed = (PACKETS / descriptor[mode]["url"]).read_bytes()
      raw = gzip.decompress(packed)
      assert len(packed) == descriptor[mode]["bytes"]
      assert len(raw) == descriptor[mode]["decodedBytes"]
      assert hashlib.sha256(packed).hexdigest() == descriptor[mode]["sha256"]
      after = json.loads(raw)
      assert after["id"] == entry["id"]
      old_descriptor = release.get(entry["id"])
      if old_descriptor:
        path = PACKETS / old_descriptor[mode]["url"]
        old_blob = subprocess.check_output(
          ["git", "show", f"v1.0.65:{path.relative_to(ROOT)}"], cwd=ROOT
        )
        before = json.loads(gzip.decompress(old_blob))
        assert measurements["oldSha256"] == hashlib.sha256(old_blob).hexdigest()
      else:
        before = {"meshes": [], "nav": empty_nav}
        assert measurements["oldSha256"] is None
      previous_details = Counter(
        canonical(m) for m in before["meshes"] if m["kind"] != "city"
      )
      final_details = Counter(
        canonical(m) for m in after["meshes"] if m["kind"] not in {"city", STREET_KIND}
      )
      assert previous_details == final_details
      old_city = triangle_keys([m for m in before["meshes"] if m["kind"] == "city"])
      new_city = triangle_keys([m for m in after["meshes"] if m["kind"] == "city"])
      assert not new_city - old_city
      removed = old_city - new_city
      assert sum(removed.values()) == measurements["removedTriangles"]
      assert (
        number_of_triangles(before["meshes"]) - sum(removed.values())
        == measurements["preservedTriangles"]
      )
      assert (
        number_of_triangles([m for m in after["meshes"] if m["kind"] == STREET_KIND])
        == measurements["addedTriangles"]
      )
      assert (
        number_of_triangles(after["meshes"])
        == measurements["preservedTriangles"] + measurements["addedTriangles"]
      )
      by_top = source_prisms_by_top(before["nav"]["buildings"], owners)
      assert all(belongs_to_source(key, by_top) for key in removed), (
        entry["id"],
        mode,
        "unowned triangle removed",
      )
      if "lines" in before:
        old_lines, new_lines = (
          line_signature(before["lines"]),
          line_signature(after["lines"]),
        )
        assert not new_lines - old_lines
        assert all(
          belongs_to_source(key, by_top, lines=True) for key in old_lines - new_lines
        )
      for field in ("ground", "water", "roads", "bridges", "groundY"):
        assert after["nav"][field] == before["nav"][field]
      assert Counter(
        canonical(p) for p in before["nav"]["buildings"] if p["sourceId"] not in owners
      ) == Counter(
        canonical(p) for p in after["nav"]["buildings"] if p["sourceId"] not in owners
      )
      assert not [
        p
        for p in after["nav"]["buildings"]
        if p["sourceId"] in owners
        and (p["sourceId"] not in street_owners or "partId" not in p)
      ]
      for p in after["nav"]["buildings"]:
        if p["sourceId"] not in street_owners:
          continue
        key = p["sourceId"], p["partId"]
        ox, _, oz = after["origin"]
        collected[mode][key].append(
          Polygon(
            [[x + ox, z + oz] for x, z in p["ring"]],
            [[[x + ox, z + oz] for x, z in h] for h in p["holes"]],
          )
        )
        nav_heights[mode][key].add(p["height"])
  expected = {}
  for building in source["buildings"]:
    for part in building["parts"]:
      grounds = [
        Polygon(
          [(x, z) for x, _, z in s["rings"][0]],
          [[(x, z) for x, _, z in h] for h in s["rings"][1:]],
        )
        for s in part["surfaces"]
        if s["kind"] == "GroundSurface"
      ]
      if not grounds:
        continue
      footprint = unary_union(grounds)
      top = max(p[1] for s in part["surfaces"] for r in s["rings"] for p in r) - 3
      key = building["id"], part["id"]
      expected[key] = footprint
      for mode in collected:
        assert key in collected[mode], (key, mode, "refined navigation lost")
        actual = unary_union(collected[mode][key])
        assert (
          actual.symmetric_difference(footprint).area <= footprint.length * 0.02 + 0.01
        )
        displayed = math.ceil(top / 2) * 2 + 2 if mode == "minecraft" else top
        assert all(abs(h - displayed) < 1e-6 for h in nav_heights[mode][key])
  for mode in collected:
    assert collected[mode].keys() == expected.keys()
