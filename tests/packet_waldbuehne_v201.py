"""Independent exact-owner and floor-cut proof for the final Waldbühne transfer."""

from __future__ import annotations

import base64
import copy
import gzip
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from shapely import STRtree
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
DATA = ROOT / "src/app/src/data"
sys.path.insert(0, str(ROOT / "scripts"))
FAMILY = "outer187--19_0"
IDS = {FAMILY, FAMILY + "-olympic-v201-1"}
MODES = {"drawn", "minecraft"}
SEATS = {
  "DEBE04AL2ua000" + suffix
  for suffix in "3k 3w 2k 3e 36 2p 34 3h 3i 38 2o 2l 39 3B 3n 3x 3j 4V 3s 2n 2m".split()
}
OWNERS = SEATS | {"DEBE04YY500002GT", "OSM-way-767528490"}


def load(path: Path) -> dict:
  return json.loads(path.read_bytes())


def digest(raw: bytes) -> str:
  return hashlib.sha256(raw).hexdigest()


def checked(raw: bytes, asset: dict) -> dict:
  assert digest(raw) == asset["sha256"]
  assert len(raw) == asset["bytes"] < 650_000
  plain = gzip.decompress(raw)
  assert len(plain) == asset["decodedBytes"] < 2_600_000
  return json.loads(plain)


def unique_rows(rows: list[dict], expected: set[str]) -> dict:
  result = {r["id"]: r for r in rows}
  assert len(result) == len(rows) and set(result) == expected
  return result


def triangles(mesh: dict) -> np.ndarray:
  pos = np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(-1, 3)
  rgb = np.frombuffer(base64.b64decode(mesh["colors"]), dtype="u1").reshape(-1, 3)
  ix = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(-1, 3)
  return np.column_stack([pos, rgb])[ix]


def world_polygon(row: dict, origin: list) -> Polygon:
  ox, _, oz = origin
  return Polygon(
    [(x + ox, z + oz) for x, z in row["ring"]],
    [[(x + ox, z + oz) for x, z in h] for h in row.get("holes", [])],
  )


def _same_area(actual, expected, tolerance: float = 1e-7) -> None:
  assert actual.symmetric_difference(expected).area <= tolerance


def _replacement_masks(source: dict, masks: dict) -> dict:
  """Cuts are covered by actual drawn/native floor geometry and navigation."""
  from build_west_landmarks_v187 import world

  seats = unary_union(
    [
      Polygon(p["ring"], p["holes"])
      for o in source["owners"]
      if o["id"] in SEATS
      for p in o["parts"]
    ]
  )
  tent = transform(lambda x, y: world(x, y), shape(source["tentOSM"]["geometry"]))
  if tent.geom_type == "MultiPolygon":
    tent = max(tent.geoms, key=lambda p: p.area)
  deck = tent.buffer(-3.5)
  nav = load(DATA / "waldbuehneV201Navigation.json")
  _same_area(Polygon(nav["deck"]["ring"]), deck)
  assert nav["deck"]["y"] == 6.55
  _same_area(shape(masks["seatingDrawn"]), seats)
  _same_area(shape(masks["stageDrawn"]), deck)
  expected = {"drawn": unary_union([seats, deck])}
  _same_area(shape(masks["drawn"]), expected["drawn"])

  drawn = load(DATA / "waldbuehneV201.json")
  floors, floor_faces = [], Counter()
  for site in drawn["sites"]:
    assert set(site["owners"]) == OWNERS
    vertices = np.asarray(site["positions"]).reshape(-1, 3)
    colors = np.asarray(site["colors"])
    for indices in np.asarray(site["indices"]).reshape(-1, 3):
      if not np.all(colors[indices] == colors[indices[0]]):
        continue
      color = int(colors[indices[0]])
      if color not in (0xB7B1A0, 0x797A75):
        continue
      points = vertices[indices]
      floors.append(Polygon(points[:, [0, 2]]))
      floor_faces[tuple(sorted(map(tuple, np.round(points, 5))))] += 1
      if color == 0x797A75:
        assert np.all(points[:, 1] == nav["deck"]["y"])
  # Independently rounded millimetre source rings/roof sheets can differ by
  # <=sqrt(2)/2000 m in XZ; the measured seam here closes within 0.5 mm.
  rendered = unary_union(floors)
  assert expected["drawn"].difference(rendered.buffer(0.000708)).area < 1e-7
  assert rendered.difference(expected["drawn"].buffer(0.000708)).area < 1e-7
  for tri in nav["floorTriangles"]:
    key = tuple(sorted(map(tuple, np.round(tri, 5))))
    assert floor_faces[key] > 0
  nav_floor = unary_union(
    [Polygon([(x, z) for x, _, z in t]) for t in nav["floorTriangles"]] + [deck]
  )
  assert expected["drawn"].difference(nav_floor.buffer(0.000708)).area < 1e-7

  native = load(DATA / "waldbuehneV201Native.json")
  native_floors = Counter()
  for site in native["sites"]:
    assert set(site["owners"]) == OWNERS
    for x, y, z, sx, sy, sz, color in site["boxes"]:
      if color not in (0xB7B1A0, 0x797A75):
        continue
      assert sx == sz == 1 and sy == (0.2 if color == 0xB7B1A0 else 0.24)
      assert x % 1 == z % 1 == 0.5
      native_floors[x - 0.5, z - 0.5, round(y + sy / 2, 6)] += 1
  assert native_floors == Counter(
    (x, z, round(y, 6)) for x, z, y in nav["nativeFloors"]
  )
  expected["minecraft"] = unary_union(
    [box(x, z, x + 1, z + 1) for x, z, _ in native_floors]
  )
  _same_area(shape(masks["minecraft"]), expected["minecraft"])
  return expected


def _owner_replays(records: list[dict], packets: list[dict], native: bool):
  """Original owner generator plus independently applied pre-transfer nav offsets."""
  from build_karl_marx_allee_v161 import mesh_signature
  from build_surrounding_outlines import chunk_payload
  from build_weinberg_terrain_packets_v176 import is_ground_triangle
  from integrate_airports_v194 import signature_sha
  from integrate_city_refinements_v166 import subtract_meshes

  origin = packets[0]["origin"]
  assert all(p["origin"] == origin for p in packets)
  shapes, offsets = [], []
  for p in packets:
    for row in p["nav"]["buildings"]:
      shapes.append(world_polygon(row, origin).buffer(0.1))
      offsets.append(row.get("groundOffset", 0))
  tree = STRtree(shapes)

  def offset(points: np.ndarray) -> float:
    centre = Point(*points[:, [0, 2]].mean(axis=0))
    for i in tree.query(centre):
      if shapes[i].covers(centre):
        return offsets[i]
    return 0.0

  tile = box(-9728, 0, -9216, 512)
  empty = chunk_payload(FAMILY, tile, tile, [], {}, minecraft=native)
  assert empty["origin"] == origin
  remove, ink, replay = Counter(), Counter(), []
  for record in records:
    packet = chunk_payload(FAMILY, tile, tile, [record], {}, minecraft=native)
    assert packet["origin"] == origin
    packet["meshes"] = subtract_meshes(packet["meshes"], mesh_signature(empty))
    faces, segments = Counter(), Counter()
    for mesh in packet["meshes"]:
      for tri in triangles(mesh):
        points = tri[:, :3] / 100 + origin
        assert not is_ground_triangle(mesh["kind"], points, tri[:, 3:])
        shifted = tri.astype(np.int64)
        shifted[:, 1] += round(offset(points) * 100)
        assert np.all((shifted >= 0) & (shifted <= 65535))
        faces[b"".join(sorted(r.tobytes() for r in shifted.astype("<u2")))] += 1
    if not native:
      lines = packet["lines"]
      pos = np.frombuffer(base64.b64decode(lines["positions"]), dtype="<u2").reshape(
        -1, 2, 3
      )
      rgb = np.frombuffer(base64.b64decode(lines["colors"]), dtype="u1").reshape(
        -1, 2, 3
      )
      for points, colors in zip(pos, rgb, strict=True):
        world = points / 100 + origin
        assert not (np.ptp(world[:, 1]) < 0.001 and abs(world[0, 1] - 3.13) < 0.002)
        shifted = np.column_stack([points, colors]).astype(np.int64)
        shifted[:, 1] += round(offset(world) * 100)
        assert np.all((shifted >= 0) & (shifted <= 65535))
        segments[b"".join(sorted(r.tobytes() for r in shifted.astype("<u2")))] += 1
    assert faces
    replay.append(
      {
        "sourceId": record["sourceId"],
        "triangles": sum(faces.values()),
        "triangleSha256": signature_sha(faces),
        "inkSegments": sum(segments.values()),
        "inkSha256": signature_sha(segments),
      }
    )
    remove.update(faces)
    ink.update(segments)
  return remove, ink, replay


def _cut_plane(
  world: np.ndarray, mask, interior_mask=None
) -> tuple[list[int], Polygon, object]:
  """Intersect a floor in XZ, or extrude mask intervals through a vertical wall."""
  normal = np.cross(world[1] - world[0], world[2] - world[0])
  if abs(normal[1]) > 1e-8:
    poly = Polygon(world[:, [0, 2]])
    return [0, 2], poly, poly.difference(mask)
  axis = 0 if np.ptp(world[:, 0]) >= np.ptp(world[:, 2]) else 2
  axes = [axis, 1]
  poly = Polygon(world[:, axes])
  if np.ptp(world[:, axis]) < 1e-8 or abs(normal[2 if axis == 0 else 0]) < 1e-8:
    return axes, poly, poly
  # World-coordinate floats can turn a straight cm-grid trace into a tiny
  # polygon. Prove collinearity in the immutable integer grid, then use its
  # extreme source endpoints instead of a floating-point convex hull.
  xz_cm = np.rint(world[:, [0, 2]] * 100).astype(np.int64)
  a, b = xz_cm[1:] - xz_cm[0]
  assert a[0] * b[1] - a[1] * b[0] == 0
  order = np.argsort(xz_cm[:, 0 if axis == 0 else 1])
  trace = LineString(xz_cm[order[[0, -1]]] / 100)
  # Retain a face lying on the exact mask perimeter. Only its strict interior
  # trace is replaced; this is a 0.1 micrometre boundary convention, not padding.
  section = trace.intersection(
    mask.buffer(-1e-7) if interior_mask is None else interior_mask
  )
  strips = []
  for part in getattr(section, "geoms", [section]):
    if part.geom_type == "LineString" and part.length >= 1e-7:
      values = [p[0 if axis == 0 else 1] for p in part.coords]
      strips.append(
        box(min(values), world[:, 1].min() - 1, max(values), world[:, 1].max() + 1)
      )
  return axes, poly, poly.difference(unary_union(strips))


def verify_ground_cuts(before: dict, after: dict, cuts: list[dict], mask) -> None:
  """Every uncut face stays exact; cut faces retain outside area, plane and RGB."""
  from build_surrounding_outlines import COLORS, linear_rgb_bytes

  ground_colors = {
    tuple(linear_rgb_bytes(np.asarray([COLORS[k]]))[0])
    for k in ("ground", "park", "path", "road", "rail")
  }
  by_face = {(r["mesh"], r["sourceTriangle"]): r for r in cuts}
  assert len(by_face) == len(cuts)
  assert len(before["meshes"]) == len(after["meshes"])
  used = set()
  interior_mask = mask.buffer(-1e-7)
  for mi, (left, right) in enumerate(
    zip(before["meshes"], after["meshes"], strict=True)
  ):
    assert {
      k: v for k, v in left.items() if k not in {"positions", "colors", "indices"}
    } == {k: v for k, v in right.items() if k not in {"positions", "colors", "indices"}}
    a, b = triangles(left), triangles(right)
    cursor = 0
    for j, face in enumerate(a):
      world = face[:, :3] / 100 + before["origin"]
      eligible = (
        left["kind"] == "city"
        and tuple(face[0, 3:]) in ground_colors
        and np.all(face[:, 3:] == face[0, 3:])
      )
      if eligible:
        axes, poly, outside = _cut_plane(world, mask, interior_mask)
      else:
        axes = [0, 2]
        poly = outside = Polygon(world[:, axes])
      cut = eligible and outside.area < poly.area - 1e-9
      if not cut:
        assert (mi, j) not in by_face
        np.testing.assert_array_equal(face, b[cursor])
        cursor += 1
        continue
      row = by_face[mi, j]
      used.add((mi, j))
      assert row["source"] == face.tolist() and row["outsideStart"] == cursor
      count = row["outsideCount"]
      assert isinstance(count, int) and count >= 0
      assert row["projectionAxes"] == axes
      removed_area = poly.area - outside.area
      assert abs(row["removedPlaneArea"] - removed_area) < 1e-8
      assert (
        abs(row["removedProjectedArea"] - (removed_area if axes == [0, 2] else 0))
        < 1e-8
      )
      parts = b[cursor : cursor + count]
      assert len(parts) == count
      cursor += count
      if not count:
        assert outside.is_empty
        continue
      assert np.all(parts[:, :, 3:] == face[0, 3:])
      points = parts[:, :, :3] / 100 + before["origin"]
      normal = np.cross(world[1] - world[0], world[2] - world[0])
      assert np.linalg.norm(normal) > 1e-8
      # Rounding each 3D coordinate to centimetres moves a point by <=sqrt(3)/200.
      distance = np.abs((points - world[0]) @ normal) / np.linalg.norm(normal)
      assert np.max(distance) <= 0.008661
      normals = np.cross(points[:, 1] - points[:, 0], points[:, 2] - points[:, 0])
      # A cm-rounded thin triangle can reverse sign. Each vertex moves by at
      # most epsilon, so each edge moves by <=2 epsilon and the normal error
      # is bounded by 2 epsilon (|edge1|+|edge2|) + 4 epsilon². Definite-area
      # reversed faces still fail; only rounding-ambiguous slivers are allowed.
      epsilon = np.sqrt(3) / 200
      edge_lengths = np.linalg.norm(points[:, 1:] - points[:, :1], axis=2).sum(axis=1)
      normal_error = 2 * epsilon * edge_lengths + 4 * epsilon**2
      assert np.all(normals @ (normal / np.linalg.norm(normal)) >= -normal_error)
      polygons = []
      for raw, p in zip(parts, points, strict=True):
        projected = raw[:, axes].astype(np.int64)
        u, v = projected[1:] - projected[0]
        if u[0] * v[1] - u[1] * v[0] == 0:
          # Retain the cm-rounded trace of collapsed slivers in the distance
          # proof. An invalid zero-area Polygon otherwise buffers to empty.
          lengths = np.sum((projected[:, None] - projected[None, :]) ** 2, axis=2)
          first, last = np.unravel_index(np.argmax(lengths), lengths.shape)
          polygons.append(
            LineString([p[first, axes], p[last, axes]])
            if lengths[first, last]
            else Point(p[first, axes])
          )
        else:
          polygons.append(Polygon(p[:, axes]))
      coverage = unary_union(polygons)
      assert coverage.difference(outside.buffer(0.007072)).area < 1e-8
      assert outside.difference(coverage.buffer(0.007072)).area < 1e-8
      tolerance = outside.length * 0.007072 + 0.0002
      assert abs(coverage.area - outside.area) <= tolerance
      assert abs(sum(p.area for p in polygons) - outside.area) <= tolerance
    assert cursor == len(b)
  assert used == set(by_face)


def audit_waldbuehne(
  terrain_descriptors: dict, current_descriptors: dict
) -> tuple[dict, dict, dict]:
  """Expose exact Olympic checkpoint bytes only after proving this final transfer."""
  from build_karl_marx_allee_v161 import mesh_signature
  from integrate_airports_v194 import signature_sha
  from integrate_city_refinements_v166 import (
    line_signature,
    subtract_lines,
    subtract_meshes,
  )

  receipt = load(GEO / "waldbuehne-v201-packet-audit.json")
  assert receipt["schemaVersion"] == 1 and receipt["sourceOwners"] == sorted(OWNERS)
  before = unique_rows(receipt["baselineDescriptors"], IDS)
  final = unique_rows(receipt["replacementDescriptors"], IDS)
  reports = unique_rows(receipt["packets"], IDS)
  assert set(receipt["ownerReplay"]) == MODES
  assert all(set(r["modes"]) == MODES for r in reports.values())
  for identity in IDS:
    assert before[identity] == terrain_descriptors[identity]
    assert final[identity] == current_descriptors[identity]
    assert before[identity]["bounds"] == [-9728, 0, -9216, 512]
  assert before[FAMILY + "-olympic-v201-1"]["detailCompanionOf"] == FAMILY
  blob = (GEO / receipt["checkpoint"]["url"]).read_bytes()
  assert digest(blob) == receipt["checkpoint"]["sha256"] and len(blob) < 5 * 1024**2
  rows = json.loads(gzip.decompress(blob))
  checkpoints = {(r["id"], r["mode"]): r for r in rows}
  assert len(rows) == len(checkpoints) == 4
  assert set(checkpoints) == {(i, m) for i in IDS for m in MODES}
  old_packets, old_bytes = {}, {}
  for (identity, mode), row in checkpoints.items():
    asset = before[identity][mode]
    assert row["descriptor"] == asset
    raw = base64.b64decode(row["gzipBase64"])
    old_packets[identity, mode] = checked(raw, asset)
    old_bytes[PUBLIC / asset["url"]] = raw
  evidence = load(GEO / "waldbuehne-v201.json")
  assert (
    receipt["sourceRecords"] == evidence["source"] == "waldbuehne-v201-source.json.gz"
  )
  blob = (GEO / receipt["sourceRecords"]).read_bytes()
  assert digest(blob) == evidence["sourceSha256"]
  source = json.loads(gzip.decompress(blob))
  assert set(evidence["owners"]) == OWNERS
  records = [{**r, "geometry": shape(r["geometry"])} for r in source["proxyRecords"]]
  assert len(records) == 23 and {r["sourceId"] for r in records} == OWNERS
  assert {r["id"] for r in source["owners"]} == OWNERS - {"OSM-way-767528490"}
  asset = receipt["groundMasks"]
  blob = (GEO / asset["url"]).read_bytes()
  assert digest(blob) == asset["sha256"]
  masks = _replacement_masks(source, json.loads(blob))
  drawn_nav = {
    r["sourceId"]: r
    for identity in before
    for r in old_packets[identity, "drawn"]["nav"]["buildings"]
    if r["sourceId"] in OWNERS
  }
  assert set(drawn_nav) == OWNERS
  counts = {}
  for mode in ("drawn", "minecraft"):
    remove, ink, replay = _owner_replays(
      records, [old_packets[i, mode] for i in before], mode == "minecraft"
    )
    for row in replay:
      row["groundOffset"] = drawn_nav[row["sourceId"]].get("groundOffset", 0)
    assert replay == receipt["ownerReplay"][mode]
    for identity, descriptor in before.items():
      report = reports[identity]["modes"][mode]
      assert report["oldDescriptor"] == descriptor[mode]
      assert report["newDescriptor"] == final[identity][mode]
      assert {
        k: v
        for k, v in descriptor[mode].items()
        if k not in {"sha256", "bytes", "decodedBytes"}
      } == {
        k: v
        for k, v in final[identity][mode].items()
        if k not in {"sha256", "bytes", "decodedBytes"}
      }
      original = old_packets[identity, mode]
      current = checked(
        (PUBLIC / final[identity][mode]["url"]).read_bytes(), final[identity][mode]
      )
      removed = mesh_signature(original) & remove
      remove -= removed
      expected = copy.deepcopy(original)
      expected["meshes"] = subtract_meshes(expected["meshes"], removed.copy())
      assert sum(removed.values()) == report["removedTriangles"]
      assert signature_sha(removed) == report["removedTriangleSha256"]
      removed_ink = (
        line_signature(original["lines"]) & ink
        if original.get("lines", {}).get("positions")
        else Counter()
      )
      ink -= removed_ink
      if removed_ink:
        expected["lines"] = subtract_lines(expected["lines"], removed_ink.copy())
      assert sum(removed_ink.values()) == report["removedInkSegments"]
      assert signature_sha(removed_ink) == report["removedInkSha256"]
      removed_nav = [r for r in expected["nav"]["buildings"] if r["sourceId"] in OWNERS]
      assert report["removedNav"] == removed_nav
      expected["nav"]["buildings"] = [
        r for r in expected["nav"]["buildings"] if r["sourceId"] not in OWNERS
      ]
      assert {k: v for k, v in expected.items() if k != "meshes"} == {
        k: v for k, v in current.items() if k != "meshes"
      }
      verify_ground_cuts(expected, current, report["groundCuts"], masks[mode])
      if mode == "drawn":
        metadata = copy.deepcopy(descriptor)
        if "buildingCount" in metadata:
          a = metadata["buildingCount"]
          assert a == len({r["sourceId"] for r in original["nav"]["buildings"]})
          b = len({r["sourceId"] for r in current["nav"]["buildings"]})
          metadata["buildingCount"] = b
          if a != b:
            counts[identity] = (a, b)
        assert {k: v for k, v in metadata.items() if k not in MODES} == {
          k: v for k, v in final[identity].items() if k not in MODES
        }
    assert not remove and not ink
  assert counts == {
    FAMILY: (before[FAMILY]["buildingCount"], before[FAMILY]["buildingCount"] - 23)
  }
  return old_bytes, final, counts
