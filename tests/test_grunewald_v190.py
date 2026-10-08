"""Bounded Grunewald terrain and complete named source envelopes."""

import gzip
import json
import math
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon, shape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_grunewald_terrain_v190 as terrain  # noqa: E402


def load(path: str) -> dict:
  return json.loads((ROOT / path).read_bytes())


def test_measured_hill_and_lakes_remain_bounded_and_source_separated() -> None:
  evidence = load("geo_data/regierungsviertel/grunewald-terrain-v190.json")
  field = terrain.field()
  assert [p["stepM"] for p in field["profiles"]] == [32, 8]
  assert len(evidence["sources"]) <= 25
  assert {lake["name"] for lake in evidence["lakes"]} == set(terrain.LAKES)
  for lake in evidence["lakes"]:
    assert shape(lake["geometry"]).is_valid
    assert lake["samples"] > 15
    assert 0 < lake["waterY"] < 4
    assert sum(len(p.exterior.coords) for p in shape(lake["geometry"]).geoms) > 20
  assert 46 < 3 + terrain.offset_at(-11966.52, 4245.25) < 51
  assert 16 < 3 + terrain.offset_at(-6700, 5626) < 21
  assert terrain.offset_at(0, 0) == 0
  for family in ["westLandmarksV187Navigation", "southWestLandmarksV187Navigation"]:
    for part in load(f"src/app/src/data/{family}.json")["buildings"]:
      p = Polygon(part["ring"], part["holes"]).representative_point()
      assert terrain.offset_at(p.x, p.y) == 0, part["id"]


def test_native_banks_follow_eight_metre_steps_without_shearing_shorelines() -> None:
  water = 1.52
  triangle = np.array(
    [[-10668.0, 3.0, 7928.0], [-10644.0, 3.0, 7928.0], [-10668.0, -1.0, 7928.0]]
  )
  pieces = terrain.bank_pieces(triangle, water, True)
  assert len(pieces) >= 3
  for piece in pieces:
    assert np.all(piece[:, 2] == 7928)
    assert np.ptp(piece[:, 0]) <= 8.000001
    normal = np.cross(piece[1] - piece[0], piece[2] - piece[0])
    assert abs(normal[0]) < 1e-8 and abs(normal[1]) < 1e-8
    middle = piece[:, 0].mean()
    top = max(water, 3 + terrain.offset_at(middle, 7928, True))
    assert piece[:, 1].max() <= top + 1e-7
    assert piece[:, 1].min() >= water - 1e-7
  # The complete top source course survives, segmented at every grid crossing.
  top_points = {}
  for piece in pieces:
    for x, y, z in piece:
      top_points[x] = max(top_points.get(x, -math.inf), y)
  assert min(top_points) == -10668 and max(top_points) == -10644
  assert {-10664, -10656, -10648} <= set(top_points)


def test_all_museum_and_terrace_source_sheets_and_navigation_parts_survive() -> None:
  source = json.loads(
    gzip.decompress(
      (
        ROOT / "geo_data/regierungsviertel/grunewald-landmarks-v190-source.json.gz"
      ).read_bytes()
    )
  )
  model = load("src/app/src/data/grunewaldLandmarksV190.json")
  nav = load("src/app/src/data/grunewaldLandmarksV190Navigation.json")["buildings"]
  evidence = load("geo_data/regierungsviertel/grunewald-landmarks-v190-evidence.json")
  offsets = {r["owner"]: r["rigidYOffset"] for r in evidence["owners"]}
  count = 0
  for profile in source["profiles"]:
    site = next(s for s in model["sites"] if s["key"] == profile["key"])
    for part in profile["parts"]:
      actual = [s for s in site["surfaces"] if s.get("part") == part["id"]]
      assert len(actual) == len(part["surfaces"])
      record = next(b for b in nav if b["id"] == part["id"])
      assert record["ring"] == part["ring"] and record["holes"] == part["holes"]
      assert math.isclose(
        record["topY"] - record["groundY"],
        part["top_y_m"] - part["ground_y_m"],
        abs_tol=0.002,
      )
      for before, after in zip(part["surfaces"], actual, strict=True):
        original = {
          (round(x, 3), round(y + offsets[profile["owner"]], 3), round(z, 3))
          for ring in before["rings"]
          for x, y, z in ring
        }
        vertices = {
          tuple(round(v, 3) for v in p) for tri in after["triangles"] for p in tri
        }
        # Ear clipping may remove only collinear ring vertices, not the envelope.
        assert all(
          any(np.linalg.norm(np.array(a) - np.array(b)) < 0.003 for b in original)
          for a in vertices
        )
        count += len(after["triangles"])
  assert count == evidence["sourceTriangles"] == 244
  tower = next(s for s in model["sites"] if s["key"] == "tower")
  top = max(p[1] for s in tower["surfaces"] for tri in s["triangles"] for p in tri)
  base = next(r["displayBaseY"] for r in evidence["owners"] if r["key"] == "tower")
  assert abs(top - base - 55) < 0.002
  assert (
    max(Polygon(b["ring"]).area for b in nav if b["id"] == "grunewaldturm-shaft") < 45
  )


def test_staged_or_published_packets_keep_budgets_and_full_triangle_accounting() -> (
  None
):
  receipt = terrain.read_receipt()
  stage = ROOT / "geo_data/regierungsviertel/raw/grunewald-v190/packets"
  public = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
  import hashlib

  assert (
    receipt["terrainSha256"] == hashlib.sha256(terrain.DATA.read_bytes()).hexdigest()
  )
  evidence = load("geo_data/regierungsviertel/grunewald-terrain-v190.json")
  water = {body["name"]: body for body in evidence["additionalWater"]}
  assert len(evidence["additionalWater"]) == 32
  assert water["Käuzchensteigteich"]["waterY"] == 9.91
  assert water["Pücklerteich"]["waterY"] == 13.21
  assert all(body["samples"] > 0 for body in evidence["additionalWater"])

  descriptors = receipt["replacementDescriptors"] + receipt["extraDescriptors"]
  for d in descriptors:
    for mode in ["drawn", "minecraft"]:
      asset = d[mode]
      path = stage / asset["url"]
      if not path.exists():
        path = public / asset["url"]
      from packet_receipts_v195 import historical_v190_asset

      zipped = historical_v190_asset(d, mode)
      raw = gzip.decompress(zipped)
      assert len(zipped) == asset["bytes"] < 650_000
      assert len(raw) == asset["decodedBytes"] < 2_600_000
      assert hashlib.sha256(zipped).hexdigest() == asset["sha256"]
      p = json.loads(raw)
      if d.get("detailCompanionOf"):
        assert all(
          not p["nav"][key]
          for key in ["ground", "buildings", "water", "roads", "bridges"]
        )
      assert all(b.get("minHeight", 0) >= 0 for b in p["nav"]["buildings"])
  for p in receipt["packets"]:
    for mode in p["representations"]:
      for mesh in mode["meshes"]:
        assert sum(run[1] for run in mesh["placementRuns"]) == mesh["sourceTriangles"]
        assert (
          sum(run[1] * run[4] for run in mesh["placementRuns"])
          == mesh["resultTriangles"]
        )
      lines = mode["lines"]
      if lines:
        assert sum(run[1] for run in lines["placementRuns"]) == lines["sourceSegments"]
        assert (
          sum(run[1] * run[4] for run in lines["placementRuns"])
          == lines["resultSegments"]
        )


def test_original_source_navigation_and_forest_shape_are_preserved() -> None:
  """Full retained ground/water polygons; forest trunks/crowns never sheared."""
  import base64

  receipt = terrain.read_receipt()
  descriptors = {d["id"]: d for d in receipt["replacementDescriptors"]}
  all_descriptors = [*descriptors.values(), *receipt["extraDescriptors"]]
  stage = terrain.RAW / "packets"

  def packet(d: dict, mode: str) -> dict:
    path = stage / d[mode]["url"]
    if not path.exists():
      path = terrain.PUBLIC / d[mode]["url"]
    return json.loads(gzip.decompress(path.read_bytes()))

  def triangles(p: dict) -> np.ndarray:
    meshes = [m for m in p["meshes"] if m["kind"] == "outskirts-v187-forest"]
    result = []
    for m in meshes:
      positions = (
        np.frombuffer(base64.b64decode(m["positions"]), dtype="<u2")
        .reshape(-1, 3)
        .astype(np.int64)
      )
      positions += np.rint(np.asarray(p["origin"]) * 100).astype(np.int64)
      indices = np.frombuffer(base64.b64decode(m["indices"]), dtype="<u4").reshape(
        -1, 3
      )
      result.append(positions[indices])
    return np.concatenate(result) if result else np.empty((0, 3, 3))

  for identity in ["outer187--24_8", "outer187--14_10", "outer187--17_11"]:
    d = descriptors[identity]
    family = [
      d,
      *[c for c in all_descriptors if c.get("detailCompanionOf") == identity],
    ]
    for mode in ["drawn", "minecraft"]:
      original = json.loads(
        gzip.decompress(terrain.original(terrain.PUBLIC / d[mode]["url"]))
      )
      current = packet(d, mode)
      for key in ["ground", "water", "roads", "bridges"]:
        assert current["nav"][key] == original["nav"][key]
      before = triangles(original)
      after = np.concatenate([triangles(packet(c, mode)) for c in family])
      assert before.shape == after.shape
      assert np.array_equal(before[:, :, [0, 2]], after[:, :, [0, 2]])
      delta = (after - before)[:, :, 1].reshape(-1, 18 * 3)
      assert np.all(np.ptp(delta, axis=1) == 0)


def test_connected_water_keeps_original_plane_and_colour_across_relief_boundary() -> (
  None
):
  """Actual drawn/native triangles must meet unchanged source water without a step."""
  from repair_grunewald_banks_v190 import triangles

  receipt = terrain.read_receipt()
  evidence = load("geo_data/regierungsviertel/grunewald-terrain-v190.json")
  baseline = json.loads(terrain.original(terrain.PUBLIC / "manifest.json"))
  before = {d["id"]: d for d in baseline["chunks"]}
  edited = {d["id"]: d for d in receipt["replacementDescriptors"]}
  current = {**before, **edited}
  retained = {
    w["sourceId"]: w
    for w in evidence["additionalWater"]
    if w.get("displayWaterPolicy") == "retain-connected-v189-plane"
  }
  assert set(retained) == {
    "OSM-relation-4578498",
    "OSM-way-4436463",
    "OSM-way-20447324",
    "OSM-way-157043658",
    "OSM-way-158521683",
  }
  for water in retained.values():
    assert water["waterY"] == water["baselineWaterY"] == -1.15
    assert water["baselineWaterTriangles"] > 0
    assert water["baselineRelease"] == terrain.BASE
    assert water["measuredWaterY"] != water["waterY"]
  # The contained Lieper Bucht joins the same component; the four larger full
  # source polygons each cross an edited/unchanged packet edge.
  checks = evidence["connectedWaterBoundaryChecks"]
  assert {c["sourceId"] for c in checks} == set(retained) - {"OSM-way-157043658"}

  def surfaces_at(identity: str, mode: str, point: list, original: bool) -> set:
    descriptor = before[identity] if original else current[identity]
    extras = (
      baseline["chunks"]
      if original or identity not in edited
      else receipt["extraDescriptors"]
    )
    family = [
      descriptor,
      *[d for d in extras if d.get("detailCompanionOf") == identity],
    ]
    result = set()
    for d in family:
      url = d[mode]["url"]
      if original:
        data = terrain.original(terrain.PUBLIC / url)
      else:
        path = (
          terrain.RAW / "packets" / url if identity in edited else terrain.PUBLIC / url
        )
        if not path.exists():
          path = terrain.PUBLIC / url
        data = path.read_bytes()
      packet = json.loads(gzip.decompress(data))
      for mesh in packet["meshes"]:
        if mesh["kind"] != "city":
          continue
        vertices, colours = triangles(mesh)
        vertices = vertices.astype(float) / 100 + np.asarray(packet["origin"])
        for pts, colour in zip(vertices, colours, strict=True):
          if np.ptp(pts[:, 1]) > 0.001 or not -3 < pts[0, 1] < 0:
            continue
          polygon = Polygon(pts[:, [0, 2]])
          if polygon.area > 0.0001 and polygon.buffer(0.005).covers(Point(*point)):
            result.add(
              (
                round(float(pts[0, 1]), 2),
                tuple(sorted({tuple(int(v) for v in row) for row in colour})),
              )
            )
    return result

  for check in checks:
    assert check["insidePacket"] in edited
    assert check["outsidePacket"] not in edited
    source_polygon = shape(retained[check["sourceId"]]["geometry"])
    for mode in ["drawn", "minecraft"]:
      all_sides = []
      for side in ["inside", "outside"]:
        point = check[f"{side}Point"]
        assert source_polygon.covers(Point(*point))
        old = surfaces_at(check[f"{side}Packet"], mode, point, True)
        actual = surfaces_at(check[f"{side}Packet"], mode, point, False)
        assert old and actual == old, (check["sourceId"], mode, side)
        assert {height for height, _ in actual} == {check["waterY"]}
        all_sides.append(actual)
      assert all_sides[0] == all_sides[1]
