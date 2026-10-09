"""Finite new outskirts keep the old city, bounded packets and real lake holes."""

from __future__ import annotations

import base64
import copy
import gzip
import hashlib
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pytest
from packet_additions_v200 import audited_v200_additions
from packet_receipts_v190 import assert_retained_descriptor, audited_v190_changes
from shapely import make_valid
from shapely.geometry import Point, Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
sys.path.insert(0, str(ROOT / "scripts"))
import build_outskirts_v187 as builder  # noqa: E402


def load(path: Path) -> dict[str, Any]:
  """Read one committed metadata file."""
  return json.loads(path.read_bytes())


def read_packet(asset: dict[str, Any]) -> dict[str, Any]:
  """Check the published bytes before inspecting their geometry."""
  raw = (PUBLIC / asset["url"]).read_bytes()
  assert len(raw) == asset["bytes"] < 650_000
  assert hashlib.sha256(raw).hexdigest() == asset["sha256"]
  decoded = gzip.decompress(raw)
  assert len(decoded) == asset["decodedBytes"] < 2_600_000
  return json.loads(decoded)


def test_scope_subtracts_exact_old_union_and_reaches_requested_places() -> None:
  """The extension reaches its named sites without blanketing all of Berlin."""
  old = unary_union(
    [
      builder.exporter.load_projected_polygon(DATA / name)
      for name in (
        "bounds.geojson",
        "bounds-ring-v182.geojson",
        "bounds-city-v183.geojson",
      )
    ]
  )
  retained = builder.exporter.load_projected_polygon(
    DATA / "bounds-retained-v186.geojson"
  )
  assert old.symmetric_difference(retained).area < 0.001
  extent = builder.exporter.load_projected_polygon(
    DATA / "bounds-outskirts-v187.geojson"
  )
  expected = builder.exporter.world(extent.difference(old))
  scope = load(ROOT / "src/app/src/data/outskirtsScopeV187.json")
  actual = unary_union([Polygon(p["ring"], p["holes"]) for p in scope["footprint"]])
  # Runtime coordinates are stored at centimetre precision, not simplified.
  assert actual.symmetric_difference(expected).area < expected.length * 0.0075
  assert (
    actual.intersection(builder.exporter.world(old)).area < expected.length * 0.0075
  )
  assert 100e6 < expected.area < 150e6
  for lon, lat in [
    (13.2395, 52.5147),  # Olympiastadion
    (13.2215, 52.5138),  # Glockenturm
    (13.2124, 52.5407),  # Spandau Zitadelle
    (13.2876, 52.4573),  # Domäne Dahlem
    (13.2925, 52.4522),  # FU Rost-/Silberlaube
    (13.2320, 52.4368),  # Mexikoplatz
    (13.5236, 52.5047),  # Schloss Friedrichsfelde
    (13.5344, 52.4997),  # Alfred-Brehm-Haus
    (13.5730, 52.4439),  # Schloss Köpenick
    (13.6440, 52.4340),  # Müggelsee
    (13.1728, 52.4278),  # Wannsee
  ]:
    assert extent.covers(Point(*builder.PROJECT(lon, lat))), (lon, lat)
  # Neither distant northern Berlin nor the airport was requested here.
  for lon, lat in [(13.41, 52.64), (13.50, 52.37)]:
    assert not extent.covers(Point(*builder.PROJECT(lon, lat)))


def test_v186_descriptors_packets_and_bounds_remain_byte_exact() -> None:
  """Only exact, named v190 owner/terrain receipts can change prior city bytes."""
  path = PUBLIC / "manifest.json"
  old = json.loads(
    subprocess.check_output(
      ["git", "show", f"v1.0.86:{path.relative_to(ROOT)}"], cwd=ROOT
    )
  )
  current = load(path)
  changes, _ = audited_v190_changes()
  assert [c["id"] for c in current["chunks"][: len(old["chunks"])]] == [
    c["id"] for c in old["chunks"]
  ]
  for before, after in zip(old["chunks"], current["chunks"], strict=False):
    assert_retained_descriptor(before, after, changes)
  assert current["footprint"][: len(old["footprint"])] == old["footprint"]
  assert current["source"] == old["source"]
  for name in (
    "bounds.geojson",
    "bounds-ring-v182.geojson",
    "bounds-city-v183.geojson",
  ):
    path = DATA / name
    assert path.read_bytes() == subprocess.check_output(
      ["git", "show", f"v1.0.86:{path.relative_to(ROOT)}"], cwd=ROOT
    )
  supplement = load(DATA / "outskirts-v187-manifest.json")
  snapshot = copy.deepcopy(current)
  assert builder.merge_manifest(current, supplement) == current
  assert current == snapshot


@pytest.fixture(scope="module")
def packet_audit() -> dict[str, Any]:
  """Stream each packet once; retain only compact QA counts and hero records."""
  manifest = load(DATA / "outskirts-v187-manifest.json")
  nav_records, sources, chunks = [], set(), set()
  hero = builder.exclusions()[0]
  forest_triangles = {"drawn": 0, "minecraft": 0}
  _, companions = audited_v190_changes()
  companion_ids = {c["id"] for c in companions}
  for chunk in manifest["chunks"]:
    assert chunk["id"].startswith("outer187-")
    assert chunk["id"] not in chunks
    chunks.add(chunk["id"])
    for mode in ("drawn", "minecraft"):
      packet = read_packet(chunk[mode])
      assert packet["id"] == chunk["id"]
      if chunk["id"] in companion_ids:
        assert all(
          not packet["nav"].get(k)
          for k in ["ground", "buildings", "water", "roads", "bridges"]
        )
        assert chunk["detailCompanionOf"] in chunks or any(
          c["id"] == chunk["detailCompanionOf"] for c in manifest["chunks"]
        )
      else:
        assert packet["nav"]["ground"]
      assert len(packet["origin"]) == 3
      if mode == "minecraft":
        assert "lines" not in packet
      for mesh in packet["meshes"]:
        assert mesh["positionType"] == "u16cm"
        positions = np.frombuffer(
          base64.b64decode(mesh["positions"]), dtype="<u2"
        ).reshape(-1, 3)
        colors = np.frombuffer(
          base64.b64decode(mesh["colors"]), dtype=np.uint8
        ).reshape(-1, 3)
        indices = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4")
        assert len(colors) == len(positions)
        assert len(indices) % 3 == 0
        assert indices.size and int(indices.max()) < len(positions)
        assert int(positions[:, [0, 2]].max()) <= 51200
        if mesh["kind"] == "outskirts-v187-forest":
          forest_triangles[mode] += len(indices) // 3
          if mode == "minecraft":
            triangles = positions[indices].reshape(-1, 3, 3).astype(np.int32)
            normals = np.cross(
              triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]
            )
            assert np.all(np.count_nonzero(normals, axis=1) <= 1)
      if mode != "drawn":
        continue
      ox, _, oz = packet["origin"]
      for row in packet["nav"]["buildings"]:
        sources.add(row["sourceId"])
        assert row["height"] > row["minHeight"] >= 0
        # Navigation explicitly means exterior minus each hole. A tiny source
        # residue can collapse to identical exterior/hole rings at centimetre
        # precision; applying make_valid to that compound ring would wrongly
        # promote the collapsed hole into a filled building.
        poly = make_valid(Polygon([(x + ox, z + oz) for x, z in row["ring"]]))
        holes = [
          make_valid(Polygon([(x + ox, z + oz) for x, z in h])) for h in row["holes"]
        ]
        if holes:
          poly = poly.difference(unary_union(holes))
        if row.get("partId") or poly.intersects(hero):
          nav_records.append({**row, "geometry": poly})
  return {
    "manifest": manifest,
    "sources": sources,
    "heroNav": nav_records,
    "forestTriangles": forest_triangles,
    "heroGeometry": hero,
  }


def test_new_packets_keep_bounded_buffers_and_source_receipts(
  packet_audit: dict[str, Any],
) -> None:
  """Both representations have valid data and all source owners remain auditable."""
  manifest = packet_audit["manifest"]
  _, companions = audited_v190_changes()
  assert len(manifest["chunks"]) == 822 + len(
    [c for c in companions if c["detailCompanionOf"].startswith("outer187-")]
  )
  assert len(packet_audit["sources"]) > 40_000
  assert min(packet_audit["forestTriangles"].values()) > 100_000
  asset = manifest["source"]["inventory"]
  raw = (PUBLIC / asset["url"]).read_bytes()
  assert len(raw) == asset["bytes"]
  assert hashlib.sha256(raw).hexdigest() == asset["sha256"]
  inventory = json.loads(gzip.decompress(raw))
  assert len(inventory["roadSources"]) > 40_000
  assert len(inventory["heroReplacements"]["records"]) > 10
  # Centimetre storage may move a boundary by a few millimetres; no coarse
  # parent-height navigation may remain in the interior of a replaced owner.
  interior = packet_audit["heroGeometry"].buffer(-0.02)
  for row in packet_audit["heroNav"]:
    if not row.get("partId"):
      assert row["geometry"].intersection(interior).area < 0.000001, row["sourceId"]


@pytest.mark.parametrize("family", ["west", "southWest", "east"])
def test_all_hero_parts_retain_exact_new_scope_footprints_and_vertical_envelopes(
  packet_audit: dict[str, Any],
  family: str,
) -> None:
  """Each family's low parts stay distinct from towers and tall roof envelopes."""
  expected = load(ROOT / f"src/app/src/data/{family}LandmarksV187Navigation.json")[
    "buildings"
  ]
  scope = builder.exporter.world(
    builder.exporter.load_projected_polygon(
      DATA / "bounds-outskirts-v187.geojson"
    ).difference(
      builder.exporter.load_projected_polygon(DATA / "bounds-retained-v186.geojson")
    )
  )
  for part in expected:
    assert part["topY"] > part["groundY"]
    original = builder.exporter.polygonal(
      make_valid(Polygon(part["ring"], part["holes"])).intersection(scope)
    )
    # Some western source parts are already wholly owned by retained coverage.
    if original.is_empty:
      continue
    rows = [row for row in packet_audit["heroNav"] if row.get("partId") == part["id"]]
    assert rows, part["id"]
    from build_olympic_terrain_v201 import OLYMPIC_OFFSETS
    from packet_receipts_v201 import audited_v201_changes

    shift = OLYMPIC_OFFSETS.get(part["owner"], 0) if family == "west" else 0
    if shift:
      audited_v201_changes()  # Complete old source, same footprint/span, measured datum.
    assert all(
      abs(row["height"] - (part["topY"] + shift - 3)) < 0.02 for row in rows
    ), part["id"]
    assert all(
      abs(row["minHeight"] - (part["groundY"] + shift - 3)) < 0.02 for row in rows
    ), part["id"]
    actual = unary_union([row["geometry"] for row in rows])
    assert actual.symmetric_difference(original).area < original.length * 0.02, part[
      "id"
    ]


def water_at(lon: float, lat: float, manifest: dict[str, Any]) -> bool:
  """Probe rendered horizontal water triangles, not just navigation labels."""
  e, n = builder.PROJECT(lon, lat)
  x, z = e - 389500, 5820000 - n
  relief = load(DATA / "grunewald-terrain-v190.json")
  placement = load(DATA / "grunewald-v190-packet-audit.json")
  elevated_ids = {d["id"] for d in placement["replacementDescriptors"]}
  elevated_ids.update(d["id"] for d in placement["extraDescriptors"])
  water_color = builder.exporter.linear_rgb_bytes(
    np.asarray(builder.exporter.COLORS["water"])
  )
  for chunk in manifest["chunks"]:
    a, b, c, d = chunk["bounds"]
    if not (a <= x <= c and b <= z <= d):
      continue
    expected_level = -1.15
    if chunk["id"] in elevated_ids:
      for lake in relief["lakes"] + relief["additionalWater"]:
        if shape(lake["geometry"]).covers(Point(x, z)):
          expected_level = lake["waterY"]
          break
    packet = read_packet(chunk["drawn"])
    origin = np.asarray(packet["origin"])
    for mesh in packet["meshes"]:
      positions = (
        np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(-1, 3)
        / 100
        + origin
      )
      indices = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4")
      triangles = positions[indices].reshape(-1, 3, 3)
      colors = np.frombuffer(base64.b64decode(mesh["colors"]), dtype=np.uint8).reshape(
        -1, 3
      )
      triangle_colors = colors[indices].reshape(-1, 3, 3)
      flat_water = triangles[
        np.all(abs(triangles[:, :, 1] - expected_level) < 0.001, axis=1)
        & np.all(triangle_colors == water_color, axis=(1, 2))
      ]
      for triangle in flat_water:
        if Polygon(triangle[:, [0, 2]]).covers(Point(x, z)):
          return True
  return False


def test_lakes_render_continuously_but_do_not_fill_mapped_islands() -> None:
  """OSM Havel relations 173239/4578498 retain Pfaueninsel/Schwanenwerder holes."""
  manifest = load(DATA / "outskirts-v187-manifest.json")
  for lon, lat in [
    (13.1728, 52.4278),
    (13.6440, 52.4340),
    (13.118747081015936, 52.435956950000005),
    (13.185091667659286, 52.4632722),
  ]:
    assert water_at(lon, lat, manifest), (lon, lat)
  # Interior source representative locations of ways431335432 / relation16653908.
  for lon, lat in [(13.1283, 52.4353), (13.1697, 52.4475)]:
    assert not water_at(lon, lat, manifest), (lon, lat)


def test_v190_changes_only_receipted_v189_packets_and_named_new_cells() -> None:
  """Every pre-v190 descriptor is frozen unless an exact source receipt owns it."""
  manifest_path = PUBLIC / "manifest.json"
  before = json.loads(
    subprocess.check_output(
      ["git", "show", f"v1.0.89:{manifest_path.relative_to(ROOT)}"], cwd=ROOT
    )
  )
  after = load(manifest_path)
  changes, companions = audited_v190_changes()
  assert [c["id"] for c in after["chunks"][: len(before["chunks"])]] == [
    c["id"] for c in before["chunks"]
  ]
  for old, new in zip(before["chunks"], after["chunks"], strict=False):
    assert_retained_descriptor(old, new, changes)
  assert after["footprint"][: len(before["footprint"])] == before["footprint"]
  assert after["source"] == before["source"]
  additions = after["chunks"][len(before["chunks"]) :]
  north = load(DATA / "north-city-v190-manifest.json")["chunks"]
  east = list(audited_v200_additions().values())
  assert {c["id"] for c in additions} == {c["id"] for c in north + companions + east}
  current_by_id = {c["id"]: c for c in after["chunks"]}
  for expected in north + companions + east:
    assert current_by_id[expected["id"]] == expected
  for companion in companions:
    parent = current_by_id[companion["detailCompanionOf"]]
    assert companion["bounds"] == parent["bounds"]
    for mode in ["drawn", "minecraft"]:
      packet = read_packet(companion[mode])
      assert all(
        not packet["nav"].get(k)
        for k in ["ground", "buildings", "water", "roads", "bridges"]
      )
  # The v187 subset is not a loophole: its originals remain in the same order,
  # and every appended geometry-only companion must be in the finite receipt.
  old_subset = json.loads(
    subprocess.check_output(
      [
        "git",
        "show",
        "v1.0.89:geo_data/regierungsviertel/outskirts-v187-manifest.json",
      ],
      cwd=ROOT,
    )
  )
  current_subset = load(DATA / "outskirts-v187-manifest.json")
  assert len(old_subset["chunks"]) == 822
  subset_companions = [
    c for c in companions if c["detailCompanionOf"].startswith("outer187-")
  ]
  assert len(current_subset["chunks"]) == 822 + len(subset_companions)
  for old, new in zip(old_subset["chunks"], current_subset["chunks"], strict=False):
    assert_retained_descriptor(old, new, changes)
  assert current_subset["chunks"][822:] == subset_companions
  for key in ["source", "bounds", "footprint"]:
    assert current_subset[key] == old_subset[key]


def test_connected_havel_keeps_one_datum_across_relief_and_packet_boundaries() -> None:
  """A partial terrain operation must not introduce steps in connected Havel water."""
  import math

  from shapely.geometry import LineString

  relief = load(DATA / "grunewald-terrain-v190.json")
  havel = next(
    lake
    for lake in relief["additionalWater"]
    if lake["sourceId"] == "OSM-relation-4578498"
  )
  geometry = shape(havel["geometry"])
  field = load(ROOT / "src/app/src/data/grunewaldTerrainV190.json")
  west, north, _, south = field["profiles"][0]["support"]
  cuts = [west, math.floor(west / 512) * 512]
  probes = []
  for cut in cuts:
    crossings = geometry.intersection(LineString([(cut, north), (cut, south)]))
    segments = list(crossings.geoms) if hasattr(crossings, "geoms") else [crossings]
    count = 0
    for segment in segments:
      if segment.geom_type != "LineString" or segment.length < 32:
        continue
      p = segment.interpolate(0.5, normalized=True)
      pair = [(cut - 8, p.y), (cut + 8, p.y)]
      assert all(geometry.covers(Point(x, z)) for x, z in pair)
      probes.extend(pair)
      count += 1
    assert count >= 2, "Probe both actual Havel crossings, not an incidental pond"
  baseline = json.loads(
    subprocess.check_output(
      [
        "git",
        "show",
        "v1.0.89:src/app/public/mesh/surrounding-berlin-v159/manifest.json",
      ],
      cwd=ROOT,
    )
  )
  expected = baseline["waterY"]
  connected_ids = {
    "OSM-relation-4578498",
    "OSM-way-4436463",
    "OSM-way-20447324",
    "OSM-way-157043658",
    "OSM-way-158521683",
  }
  connected = [
    lake for lake in relief["additionalWater"] if lake["sourceId"] in connected_ids
  ]
  assert {lake["sourceId"] for lake in connected} == connected_ids
  assert all(lake["waterY"] == expected for lake in connected)
  assert all(
    lake["baselineRelease"] == "v1.0.89"
    and lake["baselineWaterY"] == expected
    and lake["baselineWaterTriangles"] > 0
    and lake["displayWaterPolicy"] == "retain-connected-v189-plane"
    and isinstance(lake["measuredWaterY"], (int, float))
    for lake in connected
  )
  manifest = load(DATA / "outskirts-v187-manifest.json")
  checks = relief["connectedWaterBoundaryChecks"]
  assert {c["sourceId"] for c in checks} == connected_ids - {"OSM-way-157043658"}
  by_id = {d["id"]: d for d in manifest["chunks"]}
  source_geometry = {lake["sourceId"]: shape(lake["geometry"]) for lake in connected}
  for check in checks:
    assert check["waterY"] == expected
    assert check["insidePacket"] != check["outsidePacket"]
    for side in ("inside", "outside"):
      x, z = check[side + "Point"]
      a, b, c, d = by_id[check[side + "Packet"]]["bounds"]
      assert a <= x <= c and b <= z <= d
      assert source_geometry[check["sourceId"]].covers(Point(x, z))
      probes.append((x, z))
  water_color = builder.exporter.linear_rgb_bytes(
    np.asarray(builder.exporter.COLORS["water"])
  )
  decoded = {}
  for mode in ("drawn", "minecraft"):
    for x, z in probes:
      levels = set()
      for desc in manifest["chunks"]:
        a, b, c, d = desc["bounds"]
        if not (a <= x <= c and b <= z <= d):
          continue
        key = (desc["id"], mode)
        if key not in decoded:
          decoded[key] = read_packet(desc[mode])
        packet = decoded[key]
        for mesh in packet["meshes"]:
          if mesh["kind"] != "city":
            continue
          pos = (
            np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(
              -1, 3
            )
            / 100
            + packet["origin"]
          )
          colors = np.frombuffer(
            base64.b64decode(mesh["colors"]), dtype=np.uint8
          ).reshape(-1, 3)
          ix = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(
            -1, 3
          )
          tri = pos[ix]
          water = tri[
            np.all(colors[ix] == water_color, axis=(1, 2))
            & (np.ptp(tri[:, :, 1], axis=1) < 0.001)
          ]
          for triangle in water:
            if Polygon(triangle[:, [0, 2]]).covers(Point(x, z)):
              levels.add(round(float(triangle[0, 1]), 2))
      assert levels == {expected}, (mode, x, z, levels)
