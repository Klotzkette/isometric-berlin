"""Exact v100 checkpoints and independently verified bounded v201 placements."""

from __future__ import annotations

import base64
import copy
import gzip
import hashlib
import json
import subprocess
import sys
from collections import Counter
from functools import lru_cache
from pathlib import Path

import numpy as np
from shapely import STRtree, make_valid
from shapely.geometry import Point, Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
sys.path.insert(0, str(ROOT / "scripts"))
BASE = "v1.0.100"


def digest(raw: bytes) -> str:
  return hashlib.sha256(raw).hexdigest()


def load(path: Path) -> dict:
  return json.loads(path.read_bytes())


@lru_cache(maxsize=None)
def baseline(path: Path, release: str = BASE) -> bytes:
  return subprocess.check_output(
    ["git", "show", f"{release}:{path.relative_to(ROOT)}"], cwd=ROOT
  )


def checked(raw: bytes, asset: dict) -> dict:
  assert digest(raw) == asset["sha256"]
  assert len(raw) == asset["bytes"] < 650_000
  plain = gzip.decompress(raw)
  assert len(plain) == asset["decodedBytes"] < 2_600_000
  return json.loads(plain)


def expanded(mesh: dict, origin: list) -> np.ndarray:
  pos = (
    np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2")
    .reshape(-1, 3)
    .astype(np.int64)
  )
  pos += np.rint(np.asarray(origin) * 100).astype(np.int64)
  rgb = np.frombuffer(base64.b64decode(mesh["colors"]), dtype="u1").reshape(-1, 3)
  idx = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(-1, 3)
  return np.concatenate([pos, rgb], axis=1)[idx]


def verify_mesh(
  source: dict,
  origin: list,
  pieces: list[tuple[dict, dict]],
  report: dict,
  native: bool,
  offset_at,
  owner_at=None,
) -> None:
  """Every face, colour, XZ coverage and field height checked, not just a hash."""
  from build_weinberg_terrain_packets_v176 import is_ground_triangle
  from test_weinberg_terrain_packets_v176 import _terrain_coverage

  before = expanded(source, origin)
  after = np.concatenate([expanded(m, p["origin"]) for p, m in pieces])
  assert all(m["kind"] == source["kind"] for _, m in pieces)
  for _, mesh in pieces:
    assert {
      k: v for k, v in mesh.items() if k not in ("positions", "colors", "indices")
    } == {
      k: v for k, v in source.items() if k not in ("positions", "colors", "indices")
    }
  assert (
    len(before) == report["sourceTriangles"] and len(after) == report["resultTriangles"]
  )
  cursor = out = 0
  for start, count, kind, dy, n in report["placementRuns"]:
    assert start == cursor and count > 0 and n >= 0
    a = before[start : start + count]
    b = after[out : out + count * n]
    assert len(a) == count and len(b) == count * n
    if kind == "rigid":
      assert n == 1
      np.testing.assert_array_equal(a[:, :, [0, 2, 3, 4, 5]], b[:, :, [0, 2, 3, 4, 5]])
      assert np.max(np.abs(b[:, :, 1] - a[:, :, 1] - dy)) <= 1
      if owner_at is not None and source["kind"] != "outskirts-v187-forest":
        for face in a:
          points = face[:, :3] / 100
          if is_ground_triangle(source["kind"], points, face[:, 3:]):
            assert dy == 0
          elif not (
            source["kind"] == "city"
            and np.min(points[:, 1]) < 0
            and np.max(points[:, 1]) <= 3.001
          ):
            assert dy == round(owner_at(points) * 100)
    else:
      assert kind in ("terrain", "bank")
      if kind == "terrain":
        assert all(
          is_ground_triangle(source["kind"], face[:, :3] / 100, face[:, 3:])
          for face in a
        )
      else:
        assert source["kind"] == "city"
        assert np.all(np.min(a[:, :, 1], axis=1) < 0)
        assert np.all(np.max(a[:, :, 1], axis=1) <= 300.1)
        assert np.all(np.ptp(a[:, :, 1], axis=1) > 0)
      assert np.all(a[:, :, 3:] == a[:, :1, 3:])
      np.testing.assert_array_equal(
        np.repeat(a[:, :1, 3:], n * 3, axis=1).reshape(-1, 3, 3), b[:, :, 3:]
      )
      for i, face in enumerate(a):
        result = b[i * n : (i + 1) * n]
        # Identical single-face XZ is already a complete exact coverage proof.
        # Reserve polygon-union work for actual subdivisions/bank splits.
        if len(result) != 1 or not np.array_equal(
          face[:, [0, 2]], result[0, :, [0, 2]]
        ):
          _terrain_coverage(face[:, :3], result[:, :, :3], native)
        elif native:
          normal = np.cross(
            result[0, 1, :3] - result[0, 0, :3], result[0, 2, :3] - result[0, 0, :3]
          )
          assert np.count_nonzero(normal) <= 1
        if kind == "terrain" and len(result) and np.ptp(face[:, 1]) == 0:
          # Check every draped vertex, with the exact native-cell centre datum.
          for tri in result:
            if native:
              cross = np.cross(tri[1, :3] - tri[0, :3], tri[2, :3] - tri[0, :3])
              if cross[1] == 0:
                continue
              x, z = tri[:, [0, 2]].mean(axis=0) / 100
              assert (
                np.max(
                  np.abs(tri[:, 1] / 100 - face[0, 1] / 100 - offset_at(x, z, True))
                )
                < 0.061
              )
            else:
              for x, y, z in tri[:, :3] / 100:
                assert abs(y - face[0, 1] / 100 - offset_at(x, z)) < 0.061
    cursor += count
    out += count * n
  assert cursor == len(before) and out == len(after)
  if source["kind"] == "outskirts-v187-forest":
    assert len(before) % 18 == 0 and before.shape == after.shape
    delta = (after[:, :, 1] - before[:, :, 1]).reshape(-1, 54)
    assert np.all(np.ptp(delta, axis=1) == 0)
    for n in range(len(before) // 18):
      trunk = before[n * 18 : n * 18 + 8, :, :3].reshape(-1, 3) / 100
      x, z = (trunk[:, [0, 2]].min(axis=0) + trunk[:, [0, 2]].max(axis=0)) / 2
      assert abs(delta[n, 0] - round(offset_at(x, z, native) * 100)) <= 1


def verify_lines(before: dict, after: dict, origin: list, report: dict) -> None:
  from test_weinberg_terrain_packets_v176 import _verify_ink_receipts

  if not report:
    assert before == after
  else:
    _verify_ink_receipts(before, after, origin, report)


def world_polygon(row: dict, origin: list) -> Polygon:
  ox, _, oz = origin
  return Polygon(
    [(x + ox, z + oz) for x, z in row["ring"]],
    [[(x + ox, z + oz) for x, z in h] for h in row.get("holes", [])],
  )


def owner_offsets(packets: list[dict], offset_at, native: bool = False) -> dict:
  owners = {}
  for p in packets:
    for row in p["nav"]["buildings"]:
      owners.setdefault(row.get("partId", row["sourceId"]), []).append(
        make_valid(world_polygon(row, p["origin"]))
      )
  result = {}
  for key, shapes in owners.items():
    anchor = unary_union(shapes).representative_point()
    result[key] = round(offset_at(anchor.x, anchor.y, native), 2)
  return result


def source_owner_at(packet: dict, offsets: dict, padding: float, excluded=()):
  """Independently look up the immutable source owner, not receipt placement tags."""
  shapes, values = [], []
  for row in packet["nav"]["buildings"]:
    if row["sourceId"] not in excluded:
      shapes.append(world_polygon(row, packet["origin"]).buffer(padding))
      values.append(offsets.get(row.get("partId", row["sourceId"]), 0))
  tree = STRtree(shapes)

  def sample(points: np.ndarray) -> float:
    center = Point(float(points[:, 0].mean()), float(points[:, 2].mean()))
    for index in tree.query(center):
      if shapes[index].covers(center):
        return values[index]
    return 0

  return sample


def _wuhl(receipt: dict, old: dict, current: dict) -> tuple[dict, dict]:
  from build_karl_marx_allee_v161 import mesh_signature
  from build_surrounding_outlines import chunk_payload
  from build_wuhlheide_v201 import offset_at
  from integrate_airports_v194 import signature_sha
  from integrate_city_refinements_v166 import (
    line_signature,
    subtract_lines,
    subtract_meshes,
  )

  assert receipt["baselineRelease"] == BASE
  assert receipt["baselineManifestSha256"] == digest(baseline(PUBLIC / "manifest.json"))
  assert receipt["completeReplacementOwners"] == [
    "OSM-way-20418995",
    "OSM-way-33468397",
  ]
  owners = set(receipt["completeReplacementOwners"])
  raw = (GEO / receipt["checkpoint"]["url"]).read_bytes()
  assert digest(raw) == receipt["checkpoint"]["sha256"]
  checkpoints = {(r["id"], r["mode"]): r for r in json.loads(gzip.decompress(raw))}
  descriptors = {d["id"]: d for d in receipt["descriptors"]}
  assert set(descriptors) == {
    "outer187-22_13",
    "outer187-23_13",
    "east200-22_12",
    "east200-22_13",
    "east200-23_12",
    "east200-23_13",
  }
  assert set(checkpoints) == {
    (i, m) for i in descriptors for m in ("drawn", "minecraft")
  }
  assert len(receipt["chunks"]) == len(descriptors)
  assert {row["id"] for row in receipt["chunks"]} == set(descriptors)
  assert all(set(row["modes"]) == {"drawn", "minecraft"} for row in receipt["chunks"])
  assert receipt["sourceSha256"] == digest(
    (GEO / "wuhlheide-v201-source.json.gz").read_bytes()
  )
  records = [{**r, "geometry": shape(r["geometry"])} for r in receipt["sourceRecords"]]
  assert {r["sourceId"] for r in records} == owners
  before_packets = {}
  for key, row in checkpoints.items():
    identity, mode = key
    assert row["descriptor"] == old[identity][mode]
    data = base64.b64decode(row["gzipBase64"])
    assert data == baseline(PUBLIC / row["descriptor"]["url"])
    before_packets[key] = checked(data, row["descriptor"])
  offsets = {
    m: owner_offsets(
      [p for (i, n), p in before_packets.items() if n == m], offset_at, m == "minecraft"
    )
    for m in ("drawn", "minecraft")
  }
  changes, counts = {}, {}
  for chunk in receipt["chunks"]:
    identity = chunk["id"]
    d = descriptors[identity]
    assert d == current[identity]
    for mode, report in chunk["modes"].items():
      assert (
        report["oldDescriptor"] == old[identity][mode]
        and report["newDescriptor"] == d[mode]
      )
      before = before_packets[identity, mode]
      after = checked((PUBLIC / d[mode]["url"]).read_bytes(), d[mode])
      tile = box(*d["bounds"])
      records_here = [r for r in records if r["geometry"].intersects(tile)]
      selected = chunk_payload(
        identity, tile, tile, records_here, {}, minecraft=mode == "minecraft"
      )
      empty = chunk_payload(identity, tile, tile, [], {}, minecraft=mode == "minecraft")
      removed = mesh_signature(selected) - mesh_signature(empty)
      assert not removed - mesh_signature(before)
      assert sum(removed.values()) == report["removedTriangles"]
      assert signature_sha(removed) == report["removedTriangleSha256"]
      source = copy.deepcopy(before)
      source["meshes"] = subtract_meshes(source["meshes"], removed.copy())
      assert (
        signature_sha(mesh_signature(source)) == report["preservedSourceTriangleSha256"]
      )
      ink = Counter()
      if mode == "drawn":
        ink = line_signature(selected["lines"]) - line_signature(empty["lines"])
        assert not ink - line_signature(before["lines"])
        source["lines"] = subtract_lines(source["lines"], ink.copy())
      assert sum(ink.values()) == report["removedInkSegments"]
      assert len(source["meshes"]) == len(after["meshes"]) == len(report["meshes"])
      owner_at = source_owner_at(source, offsets[mode], 0.08, owners)
      for left, right, r in zip(
        source["meshes"], after["meshes"], report["meshes"], strict=True
      ):
        verify_mesh(
          left,
          source["origin"],
          [(after, right)],
          r,
          mode == "minecraft",
          offset_at,
          owner_at,
        )
      verify_lines(
        source.get("lines", {}),
        after.get("lines", {}),
        source["origin"],
        report["lines"],
      )
      from test_teufelsberg_packets_v195 import water

      assert water([(before, m) for m in before["meshes"]]) == water(
        [(after, m) for m in after["meshes"]]
      )
      assert {
        k: v for k, v in before.items() if k not in ("meshes", "lines", "nav")
      } == {k: v for k, v in after.items() if k not in ("meshes", "lines", "nav")}
      assert {k: v for k, v in before["nav"].items() if k != "buildings"} == {
        k: v for k, v in after["nav"].items() if k != "buildings"
      }
      expected = []
      for row in before["nav"]["buildings"]:
        if row["sourceId"] in owners:
          continue
        row = copy.deepcopy(row)
        dy = offsets[mode][row.get("partId", row["sourceId"])]
        if dy:
          row["groundOffset"] = round(row.get("groundOffset", 0) + dy, 2)
        expected.append(row)
      assert after["nav"]["buildings"] == expected
      assert report["ownerOffsets"] == {k: v for k, v in offsets[mode].items() if v}
      assert report["removedNav"] == [
        r for r in before["nav"]["buildings"] if r["sourceId"] in owners
      ]
      if d[mode] != old[identity][mode]:
        changes[identity, mode] = (old[identity][mode]["sha256"], d[mode]["sha256"])
    # The descriptor counts drawn source owners. The independent block-native
    # outline can already omit a sub-cell sliver in the immutable v100 source;
    # its exact navigation is proved above, not used to redefine this count.
    drawn_before = before_packets[identity, "drawn"]["nav"]["buildings"]
    assert old[identity]["buildingCount"] == len({r["sourceId"] for r in drawn_before})
    assert d["buildingCount"] == len(
      {r["sourceId"] for r in drawn_before if r["sourceId"] not in owners}
    )
    if d["buildingCount"] != old[identity]["buildingCount"]:
      counts[identity] = (old[identity]["buildingCount"], d["buildingCount"])
    assert {
      k: v for k, v in d.items() if k not in ("drawn", "minecraft", "buildingCount")
    } == {
      k: v
      for k, v in old[identity].items()
      if k not in ("drawn", "minecraft", "buildingCount")
    }
  return changes, counts


def _olympic(
  receipt: dict, old: dict, current: dict, checkpoints: dict[Path, bytes]
) -> tuple[dict, list]:
  from build_grunewald_terrain_v190 import without_hero_ink
  from build_olympic_terrain_v201 import (
    OLYMPIC_OFFSETS,
    SUPPORT,
    offset_at,
  )
  from build_weinberg_terrain_packets_v176 import is_ground_triangle

  assert (
    receipt["baseRelease"] == BASE and receipt["inheritedSourceRelease"] == "v1.0.89"
  )
  assert receipt["baseManifestSha256"] == digest(baseline(PUBLIC / "manifest.json"))
  assert receipt["terrainSha256"] == digest(
    (ROOT / "src/app/src/data/olympicTerrainV201.json").read_bytes()
  )
  blob = (GEO / receipt["details"]["url"]).read_bytes()
  assert (
    digest(blob) == receipt["details"]["sha256"]
    and len(blob) == receipt["details"]["bytes"] < 5 * 1024**2
  )
  plain = gzip.decompress(blob)
  assert len(plain) == receipt["details"]["decodedBytes"]
  details = json.loads(plain)
  descriptors = receipt["replacementDescriptors"] + receipt["extraDescriptors"]
  primary = {d["id"]: d for d in receipt["replacementDescriptors"]}
  expected_ids = {f"outer187--{x}_{z}" for x in range(16, 22) for z in range(-3, 3)} - {
    "outer187--16_-3"
  }
  assert set(primary) == expected_ids
  assert len(receipt["baselineDescriptors"]) == 37
  for d in receipt["baselineDescriptors"]:
    assert d == old[d["id"]]
    for mode in ("drawn", "minecraft"):
      checked(baseline(PUBLIC / d[mode]["url"]), d[mode])
  for d in descriptors:
    assert d == current[d["id"]]
    if d["id"] in old:
      assert {k: v for k, v in d.items() if k not in ("drawn", "minecraft")} == {
        k: v for k, v in old[d["id"]].items() if k not in ("drawn", "minecraft")
      }
    else:
      assert (
        d["id"].startswith(d["detailCompanionOf"] + "-olympic-v201-")
        and d["bounds"] == primary[d["detailCompanionOf"]]["bounds"]
      )
  flat = json.loads(baseline(PUBLIC / "manifest.json", "v1.0.89"))
  flat_by_id = {d["id"]: d for d in flat["chunks"]}
  region = box(SUPPORT[0] - 512, SUPPORT[1] - 512, SUPPORT[2] + 512, SUPPORT[3] + 512)
  neighboring = [d for d in flat["chunks"] if region.intersects(box(*d["bounds"]))]
  source_drawn = {
    d["id"]: json.loads(
      gzip.decompress(baseline(PUBLIC / d["drawn"]["url"], "v1.0.89"))
    )
    for d in neighboring
  }
  offsets = owner_offsets(list(source_drawn.values()), offset_at)
  assert offsets == details["parentOffsets"]
  heroes = set(OLYMPIC_OFFSETS)
  assert heroes == {
    "DEBE04AL5LX00002",
    "DEBE04AL5LX00003",
    "DEBE04AL5LX00004",
    "DEBE04YY500001If",
    "DEBE04YY500008Cu",
    "DEBE04YY500006Fm",
  }
  old_hero_path = ROOT / "src/app/src/data/westLandmarksV187Navigation.json"
  assert old_hero_path.read_bytes() == baseline(old_hero_path)
  all_hero_shapes = []
  for p in source_drawn.values():
    for r in p["nav"]["buildings"]:
      if r.get("partId", r["sourceId"]) in heroes:
        all_hero_shapes.append(make_valid(world_polygon(r, p["origin"])))
  mapped_heroes = unary_union(all_hero_shapes).buffer(0.08)
  reports = {r["id"]: r for r in details["packets"]}
  splits = {r["id"]: r for r in receipt["splitPackets"]}
  assert set(reports) == set(splits) == set(primary)
  changes = {}
  for identity, d in primary.items():
    family = [d, *[c for c in descriptors if c.get("detailCompanionOf") == identity]]
    for mode in ("drawn", "minecraft"):
      asset = flat_by_id[identity][mode]
      raw = baseline(PUBLIC / asset["url"], "v1.0.89")
      source = checked(raw, asset)
      owner_at = source_owner_at(source, offsets, 0.1)
      r = next(v for v in reports[identity]["representations"] if v["mode"] == mode)
      split = next(v for v in splits[identity]["representations"] if v["mode"] == mode)
      assert digest(raw) == r["baseSha256"] and r["sha256"] == split["unsplitSha256"]
      actual = [
        checked(
          checkpoints.get(PUBLIC / c[mode]["url"])
          or (PUBLIC / c[mode]["url"]).read_bytes(),
          c[mode],
        )
        for c in family
      ]
      pieces = [(p, m) for p in actual for m in p["meshes"]]
      assert sum(split["packetMeshes"]) == sum(split["meshPieceCounts"]) == len(pieces)
      assert [len(p["meshes"]) for p in actual[: len(split["packetMeshes"])]] == split[
        "packetMeshes"
      ]
      assert len(source["meshes"]) == len(r["meshes"]) == len(split["meshPieceCounts"])
      active = (
        mapped_heroes
        if mode == "drawn"
        else unary_union(
          [
            world_polygon(b, source["origin"]).buffer(0.08)
            for b in source["nav"]["buildings"]
            if b["sourceId"] in heroes
          ]
        )
      )
      piece_cursor = 0
      for mesh, report, count in zip(
        source["meshes"], r["meshes"], split["meshPieceCounts"], strict=True
      ):
        rows = expanded(mesh, source["origin"])
        keep = []
        for i, tri in enumerate(rows):
          pts = tri[:, :3] / 100
          remove = (
            mesh["kind"] != "outskirts-v187-forest"
            and not is_ground_triangle(mesh["kind"], pts, tri[:, 3:])
            and np.min(pts[:, 1]) >= 2.999
            and all(active.covers(Point(x, z)) for x, _, z in pts)
          )
          if not remove:
            keep.append(i)
        assert len(rows) - len(keep) == report["replacedHeroTriangles"]
        selected = {
          **mesh,
          "indices": base64.b64encode(
            np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4")
            .reshape(-1, 3)[keep]
            .tobytes()
          ).decode(),
        }
        verify_mesh(
          selected,
          source["origin"],
          pieces[piece_cursor : piece_cursor + count],
          report,
          mode == "minecraft",
          offset_at,
          owner_at,
        )
        piece_cursor += count
      assert piece_cursor == len(pieces)
      if source.get("lines", {}).get("positions"):
        lines, removed = without_hero_ink(source["lines"], source["origin"], active)
        assert removed == r["lines"]["replacedHeroSegments"]
        verify_lines(lines, actual[0]["lines"], source["origin"], r["lines"])
      else:
        assert source.get("lines", {}) == actual[0].get("lines", {})
      from test_teufelsberg_packets_v195 import water

      previous_family = [
        json.loads(gzip.decompress(baseline(PUBLIC / old[c["id"]][mode]["url"])))
        for c in family
        if c["id"] in old
      ]
      assert water([(p, m) for p in previous_family for m in p["meshes"]]) == water(
        pieces
      )
      assert {
        k: v for k, v in source.items() if k not in ("meshes", "lines", "nav")
      } == {k: v for k, v in actual[0].items() if k not in ("meshes", "lines", "nav")}
      expected_nav = copy.deepcopy(source["nav"])
      # Re-appending the corrected hero rows preserves each source partition's
      # order; no ring/part or unrelated row may change or disappear.
      rows = expected_nav["buildings"]
      expected_nav["buildings"] = [b for b in rows if b["sourceId"] not in heroes] + [
        b for b in rows if b["sourceId"] in heroes
      ]
      for b in expected_nav["buildings"]:
        if b["sourceId"] in heroes:
          # Original building coverage remains independent of walkable ground.
          # In particular, the stadium's ring has a deliberate ground cutout.
          dy = OLYMPIC_OFFSETS[b["sourceId"]]
          b["height"] += dy
          b["minHeight"] = b.get("minHeight", 0) + dy
        else:
          dy = offsets[b.get("partId", b["sourceId"])]
          if dy:
            b["groundOffset"] = round(b.get("groundOffset", 0) + dy, 2)
      assert expected_nav == actual[0]["nav"]
      for companion in actual[1:]:
        assert all(
          not companion["nav"][k]
          for k in ("ground", "water", "roads", "bridges", "buildings")
        )
        assert not companion.get("lines", {}).get("positions")
      for c in family:
        if c["id"] in old and c[mode] != old[c["id"]][mode]:
          changes[c["id"], mode] = (old[c["id"]][mode]["sha256"], c[mode]["sha256"])
  return changes, receipt["extraDescriptors"]


@lru_cache(maxsize=1)
def audited_v201_changes() -> tuple[dict, list, dict]:
  """Check exact source geometry, full current manifest and both finite patches."""
  old_manifest = json.loads(baseline(PUBLIC / "manifest.json"))
  from packet_receipts_v205 import predecessor_v205

  current_manifest = json.loads(predecessor_v205(PUBLIC / "manifest.json"))
  old = {d["id"]: d for d in old_manifest["chunks"]}
  current = {d["id"]: d for d in current_manifest["chunks"]}
  olympic = load(GEO / "olympic-v201-packet-audit.json")
  wuhl = load(GEO / "wuhlheide-v201-packet-audit.json")
  updates = (
    olympic["replacementDescriptors"]
    + olympic["extraDescriptors"]
    + wuhl["descriptors"]
  )
  updated = {d["id"]: d for d in updates}
  assert len(updated) == len(updates)
  # First prove the final exact-owner transfer and its complete immutable
  # terrain checkpoint. The terrain proof below then validates those same
  # checkpoint bytes against the original pre-v201 source, not a trusted flag.
  from packet_waldbuehne_v201 import audit_waldbuehne

  intermediate = {**old, **updated}
  checkpoints, waldb_final, waldb_counts = audit_waldbuehne(intermediate, current)
  assert set(waldb_final) == {"outer187--19_0", "outer187--19_0-olympic-v201-1"}
  updated.update(waldb_final)
  expected = copy.deepcopy(old_manifest)
  expected["chunks"] = [updated.get(d["id"], d) for d in old_manifest["chunks"]] + [
    updated[d["id"]] for d in updates if d["id"] not in old
  ]
  expected["outskirtsV187"]["chunkCount"] += sum(
    d["id"] not in old and d.get("detailCompanionOf", "").startswith("outer187-")
    for d in updates
  )
  assert current_manifest == expected
  assert (
    len(current) <= 2048 and (PUBLIC / "manifest.json").stat().st_size < 2 * 1024**2
  )
  # Unchanged rows must retain actual old bytes, not merely immutable metadata.
  for d in current.values():
    for mode in ("drawn", "minecraft"):
      raw = predecessor_v205(PUBLIC / d[mode]["url"])
      assert len(raw) == d[mode]["bytes"] and digest(raw) == d[mode]["sha256"]
  a, companions = _olympic(olympic, old, intermediate, checkpoints)
  b, counts = _wuhl(wuhl, old, current)
  assert not a.keys() & b.keys()
  for identity, d in waldb_final.items():
    for mode in ("drawn", "minecraft"):
      if identity in old:
        key = identity, mode
        assert a[key][1] == intermediate[identity][mode]["sha256"]
        a[key] = (a[key][0], d[mode]["sha256"])
  assert not counts.keys() & waldb_counts.keys()
  companions = [waldb_final.get(d["id"], d) for d in companions]
  return {**a, **b}, companions, {**counts, **waldb_counts}


@lru_cache(maxsize=1)
def prior_asset_index() -> dict:
  manifest = json.loads(baseline(PUBLIC / "manifest.json"))
  return {
    PUBLIC / d[m]["url"]: (d["id"], m, d[m])
    for d in manifest["chunks"]
    for m in ("drawn", "minecraft")
  }


def predecessor_v201(path: Path) -> bytes:
  """Only verified v201 changes may expose their immutable v100 checkpoint."""
  from packet_receipts_v205 import predecessor_v205

  current = predecessor_v205(path)
  match = prior_asset_index().get(path)
  if match is None:
    return current
  identity, mode, asset = match
  if digest(current) == asset["sha256"]:
    return current
  changes, _, _ = audited_v201_changes()
  assert changes[identity, mode] == (asset["sha256"], digest(current))
  previous = baseline(path)
  assert digest(previous) == asset["sha256"] and len(previous) == asset["bytes"]
  return previous
