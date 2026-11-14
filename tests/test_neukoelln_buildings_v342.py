"""Complete measured bodies, exact old owners and true cardinal roof navigation."""

from __future__ import annotations

import base64
import copy
import gzip
import hashlib
import json
import sys
from collections import Counter
from functools import lru_cache
from pathlib import Path

import numpy as np
from shapely.affinity import translate
from shapely.geometry import Point, Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_neukoelln_buildings_v342 as builder  # noqa: E402

SOURCE = builder.read(builder.SOURCE)
DATA = builder.read(ROOT / "src/app/src/data/neukoellnBuildingsV342Packets.json")
PROOF = builder.read(builder.GEO / "neukoelln-buildings-v342-packet-evidence.json")


@lru_cache(maxsize=1)
def models():
  return builder.models(SOURCE)


def triangle_key(points):
  return tuple(sorted(tuple(np.round(p, 6)) for p in points))


def decode(plan, mesh):
  positions = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
  indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  return positions / 100 + plan["origin"], indices


def actual_packet(key):
  pin = next(p for p in PROOF["packets"] if p["key"] == key)
  wire = (builder.PUBLIC / pin["before"]["url"]).read_bytes()
  assert hashlib.sha256(wire).hexdigest() == pin["before"]["sha256"]
  return json.loads(gzip.decompress(wire))


def test_all_twelve_official_parts_and_110_sheets_survive_without_filling_courts():
  assert [len(s["parts"]) for s in SOURCE["sites"]] == [5, 7]
  assert sum(len(p["surfaces"]) for s in SOURCE["sites"] for p in s["parts"]) == 110
  assert [s["originalHeight"] for s in SOURCE["sites"]] == [9, 3]
  assert np.allclose([s["measuredHeight"] for s in SOURCE["sites"]], [20.787, 8.411])
  for site in SOURCE["sites"]:
    detail, _, metric, footprint = models()[site["key"]]
    assert site["officialCoveredFraction"] > 0.98
    expected = Counter()
    low = min(p["ground_y_m"] for p in site["parts"])
    for part in site["parts"]:
      for sheet in part["surfaces"]:
        rings = copy.deepcopy(sheet["rings"])
        for ring in rings:
          for p in ring:
            p[1] = round(p[1] - low + 3, 3)
        expected.update(triangle_key(t) for t in builder.triangles_for(rings))
    actual = Counter(
      triangle_key(t) for t, _, role in detail.triangles if role.startswith("source ")
    )
    assert actual == expected
    assert metric["sourceTriangles"] == sum(expected.values())
    old = shape(site["predecessor"]["geometry"])
    assert old.difference(footprint.union(old.difference(footprint))).area < 1e-8
    for p in getattr(old, "geoms", [old]):
      for hole in p.interiors:
        assert not footprint.covers(Polygon(hole).representative_point())


def test_photographic_front_details_are_outside_their_measured_wall_planes():
  # This rejects the genuine behind-wall error; the discarded centroid-sorted
  # preview had diagonal occlusions even though these planes are correctly out.
  for site in SOURCE["sites"]:
    _, _, _, footprint = models()[site["key"]]
    surfaces, _ = builder.translated_surfaces(site)
    populated = 0
    for surface in surfaces:
      if surface["kind"] != "WallSurface":
        continue
      detail = builder.Detail()
      bays = builder.fittings(detail, surface, site["key"], footprint)
      if not bays:
        continue
      populated += bays
      a, d, n, width, plane = builder.front(surface, footprint)
      assert not footprint.covers(Point(a + d * width / 2 + n * 0.1))
      for tri, _, role in detail.triangles:
        coords = np.array(tri)
        offsets = (coords[:, [0, 2]] - a) @ n
        assert np.all(offsets >= 0.099) and np.all(offsets <= 0.271), role
        on_wall = Polygon([[(p[[0, 2]] - a) @ d, p[1]] for p in coords])
        assert on_wall.difference(plane.buffer(1e-7)).area < 1e-6
    assert populated == (18 if site["key"] == "orangerie" else 16)


def test_source_native_is_independent_cardinal_skin_with_matching_roof_navigation():
  for site in SOURCE["sites"]:
    drawn, native, metric, _ = models()[site["key"]]
    assert drawn.triangles != native.triangles
    for tri, _, _ in native.triangles:
      p = np.asarray(tri)
      n = np.cross(p[1] - p[0], p[2] - p[0])
      assert np.count_nonzero(np.abs(n) > 1e-8) == 1
      assert np.allclose(p, np.round(p))
    actual = []
    for key, plan in DATA["packets"].items():
      if not key.startswith("minecraft:") or site["id"] not in plan["owners"]:
        continue
      for nav in plan["appendNav"]:
        if not nav["sourceId"].startswith(site["id"] + ":"):
          continue
        x, _, z = plan["origin"]
        polygon = translate(Polygon(nav["ring"], nav["holes"]), x, z)
        caps = unary_union(
          [box(c[0] + x, c[1] + z, c[2] + x, c[3] + z) for c in nav["nativeRoofCaps"]]
        )
        assert polygon.symmetric_difference(caps).area < 1e-6
        assert nav["height"] == max(c[4] for c in nav["nativeRoofCaps"])
        for c in nav["nativeRoofCaps"]:
          at = Point((c[0] + c[2]) / 2 + x, (c[1] + c[3]) / 2 + z)
          matching = [r for r in metric["nativeRoofCaps"] if box(*r[:4]).covers(at)]
          assert matching and any(abs(r[4] - (c[4] + 3)) < 1e-6 for r in matching)
        actual.append(polygon)
    expected = unary_union([box(*c[:4]) for c in metric["nativeRoofCaps"]])
    assert expected.symmetric_difference(unary_union(actual)).area < 1e-6


def test_exact_retirement_is_only_the_two_old_building_owners_and_outside_is_retained():
  scope = builder.world(
    builder.load_projected_polygon(builder.GEO / "bounds-ring-v182.geojson").difference(
      builder.load_projected_polygon(builder.GEO / "bounds.geojson")
    )
  )
  for key, plan in DATA["packets"].items():
    raw = actual_packet(key)
    native = key.startswith("minecraft:")
    x, _, z = raw["origin"]
    tile = box(x, z, x + 512, z + 512)
    expected = Counter()
    sites = [s for s in SOURCE["sites"] if s["id"] in plan["owners"]]
    for site in sites:
      owner = {
        **site["predecessor"],
        "geometry": shape(site["predecessor"]["geometry"]),
      }
      full = builder.chunk_payload(
        raw["id"], tile, scope.intersection(tile), [owner], {}, minecraft=native
      )
      empty = builder.chunk_payload(
        raw["id"], tile, scope.intersection(tile), [], {}, minecraft=native
      )
      expected.update(
        builder.geometry_signature(full) - builder.geometry_signature(empty)
      )
    retired = Counter()
    for receipt in plan["retire"]:
      mesh = raw["meshes"][receipt["mesh"]]
      assert mesh["kind"] == "city"
      pos = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
      ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      retired.update(
        b"".join(sorted(p.tobytes() for p in tri))
        for tri in pos[ix[receipt["triangles"]]]
      )
    assert retired == expected
    domains = [
      unary_union([box(*c[:4]) for c in models()[s["key"]][2]["nativeRoofCaps"]])
      if native
      else models()[s["key"]][3]
      for s in sites
    ]
    domain = unary_union(domains)
    comp = builder.complement_model(raw, plan["retire"], domain, native)
    roofs = unary_union(
      [
        Polygon(np.array(t)[:, [0, 2]])
        for t, _, role in comp.triangles
        if role == "retained exterior roof"
      ]
    )
    desired = unary_union(
      [translate(Polygon(n["ring"], n["holes"]), x, z) for n in plan["retireNav"]]
    ).difference(domain)
    assert desired.difference(roofs.buffer(0.015)).area < 0.05
    nav_complement = unary_union(
      [
        translate(Polygon(n["ring"], n["holes"]), x, z)
        for n in plan["appendNav"]
        if n["sourceId"].endswith(":v342-retained-outside")
      ]
    )
    assert nav_complement.symmetric_difference(desired).area < 1e-5


def test_actual_shipped_append_contains_the_complete_clipped_models_and_stays_bounded():
  assert (
    set(DATA["keys"])
    == set(DATA["packets"])
    == {
      f"{mode}:{host}"
      for mode in ("drawn", "minecraft")
      for host in ("ring182-8_8", "ring182-8_10", "ring182-9_8")
    }
  )
  for key, plan in DATA["packets"].items():
    raw = actual_packet(key)
    x, _, z = raw["origin"]
    tile = box(x, z, x + 512, z + 512)
    detail = builder.Detail()
    for site in SOURCE["sites"]:
      if site["id"] in plan["owners"]:
        detail.triangles.extend(
          models()[site["key"]][key.startswith("minecraft:")].triangles
        )
    expected = builder.packed_detail(detail, tile)
    epos, eix = decode(plan, expected)
    apos, aix = decode(plan, plan["append"])
    missing = Counter(triangle_key(epos[t]) for t in eix) - Counter(
      triangle_key(apos[t]) for t in aix
    )
    assert not missing
    assert np.isfinite(apos).all() and aix.max() < len(apos)
    assert len(raw["meshes"]) + 1 <= 16
    assert (
      sum(
        len(base64.b64decode(m["positions"])) // 6
        for m in [*raw["meshes"], plan["append"]]
      )
      <= 400000
    )
    assert (
      sum(
        len(base64.b64decode(m["indices"])) // 4
        for m in [*raw["meshes"], plan["append"]]
      )
      <= 2400000
    )
    assert plan["append"]["kind"] == builder.KIND
  assert (
    PROOF["sourceSha256"] == hashlib.sha256(builder.SOURCE.read_bytes()).hexdigest()
  )
  assert len(DATA["packets"]) == 6 and "data:image" not in json.dumps(DATA)
  assert all(
    r["photo"].startswith("https://www.berlin.de/") and len(r["imageSha256"]) == 64
    for r in SOURCE["references"]
  )
