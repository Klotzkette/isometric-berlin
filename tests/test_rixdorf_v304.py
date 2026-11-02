"""Source completeness, exact old-owner complements and native Rixdorf physics."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
import pytest
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_rixdorf_v304 as compiler  # noqa: E402
from build_bebelplatz_building_source import extract_parent, part_profile  # noqa: E402
from build_breitscheid_towers_v161 import triangles_for  # noqa: E402

from isometric_berlin.data.fetch_lod2 import leaf_building_parts  # noqa: E402


def read(path: str | Path) -> Any:
  path = ROOT / path
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


@pytest.fixture(scope="module")
def evidence() -> dict[str, Any]:
  return read("geo_data/regierungsviertel/rixdorf-v304-evidence.json.gz")


@pytest.fixture(scope="module")
def source() -> dict[str, Any]:
  return read("geo_data/regierungsviertel/rixdorf-v304-source.json.gz")


@pytest.fixture(scope="module")
def plans() -> dict[str, Any]:
  return read("src/app/src/data/rixdorfV304.json")


def arrays(mesh: dict[str, Any]) -> tuple[np.ndarray, ...]:
  p = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
  c = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
  ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  return p, c, ix


def test_finite_correct_neukoelln_source_inventory(
  source: dict[str, Any], evidence: dict[str, Any]
) -> None:
  assert evidence["counts"]["addressedFamilies"] == 70
  assert len(source["parents"]) == 72  # Two complete companions of the same hall.
  assert len(source["oldOwners"]) == 77
  assert sum(len(p["parts"]) for p in source["parents"]) == 217
  assert sum(len(q["surfaces"]) for p in source["parents"] for q in p["parts"]) == 2452
  labels = " ".join(a for p in source["parents"] for a in p["labels"])
  assert all(
    n in labels
    for n in ["Richardplatz", "Kirchgasse", "Richardstraße", "Schudomastraße"]
  )
  assert all(
    4600 < x < 5550 and 4750 < z < 5450
    for p in source["parents"]
    for q in p["parts"]
    for x, z in q["ring"]
  )
  assert "09090370" in source["factualReferences"][0]


@pytest.mark.parametrize(
  "identity",
  [
    "DEBE08YYF00003jZ",
    "DEBE08YYF00008QN",
    "DEBE08YYF00003ry",
    "DEBE08YYF0000Ado",
    "DEBE08YYF000005c",
    "DEBE08YYF0000AbQ",
    "DEBE08YYF00008yd",
  ],
)
def test_complete_raw_official_families_match_without_sheet_or_hole_loss(
  source: dict[str, Any], identity: str
) -> None:
  record = next(p for p in source["parents"] if p["id"] == identity)
  path = ROOT / "geo_data/regierungsviertel/raw/lod2" / record["archive"]
  raw = extract_parent(path, identity)
  assert [part_profile(p) for p in leaf_building_parts(raw) or [raw]] == record["parts"]
  receipt = next(a for a in source["archives"] if a["url"].endswith(path.name))
  assert hashlib.sha256(path.read_bytes()).hexdigest() == receipt["sha256"]


def test_previous_church_smithy_source_and_additive_details_are_outside_transfer(
  source: dict[str, Any], evidence: dict[str, Any], plans: dict[str, Any]
) -> None:
  keep = set(evidence["preservedV210Owners"])
  assert len(keep) == 5
  assert not keep & {p["id"] for p in source["parents"]}
  assert not keep & {p for plan in plans["packets"].values() for p in plan["owners"]}
  assert not {
    "OSM-way-47023388",
    "OSM-way-334062969",
    "OSM-way-334062957",
    "OSM-way-88382458",
    "OSM-way-334062967",
  } & {r["sourceId"] for plan in plans["packets"].values() for r in plan["retireNav"]}


def test_only_eight_existing_bounded_packets_with_unchanged_limits(
  plans: dict[str, Any], evidence: dict[str, Any]
) -> None:
  assert plans["schemaVersion"] == 1
  assert plans["keys"] == list(plans["packets"])
  assert len(plans["keys"]) == 8
  assert {k.split(":")[1] for k in plans["keys"]} == {
    "ring182-9_9",
    "ring182-9_10",
    "ring182-10_9",
    "ring182-10_10",
  }
  assert all(
    r["vertices"] <= 400000 and r["indices"] <= 2400000 and r["sourceParts"] + 1 <= 16
    for r in evidence["receipts"]
  )
  assert all(
    plan["append"]["kind"] == "rixdorf-v304"
    and plan["appendFingerprint"] == compiler.fingerprint(plan["append"])
    for plan in plans["packets"].values()
  )


def test_current_packet_bytes_and_every_old_mesh_remain_exact_inputs(
  plans: dict[str, Any], evidence: dict[str, Any]
) -> None:
  for receipt in evidence["receipts"]:
    path = ROOT / "src/app/public/mesh/surrounding-berlin-v159" / receipt["url"]
    assert hashlib.sha256(path.read_bytes()).hexdigest() == receipt["sourceSha256"]
    packet = compiler.read(path)
    plan = plans["packets"][receipt["key"]]
    assert plan["origin"] == packet["origin"]
    assert plan["records"] == [
      dict(mesh=i, kind=m["kind"], fingerprint=compiler.fingerprint(m))
      for i, m in enumerate(packet["meshes"])
    ]
    assert all(
      r["mesh"] < len(plan["preparedRecords"])
      and r["triangles"] == sorted(set(r["triangles"]))
      for r in plan["retire"]
    )


def test_complete_source_drawn_bodies_roofs_and_court_sheets_are_present(
  source: dict[str, Any], plans: dict[str, Any]
) -> None:
  # Compare every independently retained official source triangle with the
  # appended packed geometry. Fittings cannot compensate for a missing roof.
  for key, plan in plans["packets"].items():
    if not key.startswith("drawn:"):
      continue
    origin = np.array(plan["origin"])
    p, _, ix = arrays(plan["append"])
    actual = Counter(tuple(sorted(tuple(map(int, q)) for q in tri)) for tri in p[ix])
    tile = box(origin[0], origin[2], origin[0] + 512, origin[2] + 512)
    expected = Counter()
    for parent in source["parents"]:
      low = min(part["ground_y_m"] for part in parent["parts"])
      for part in parent["parts"]:
        for sheet in part["surfaces"]:
          rings = [
            [[x, round(y - low + 3, 3), z] for x, y, z in ring]
            for ring in sheet["rings"]
          ]
          for triangle in triangles_for(rings):
            points = triangle
            for axis, edge, lower in [
              (0, tile.bounds[0], True),
              (0, tile.bounds[2], False),
              (2, tile.bounds[1], True),
              (2, tile.bounds[3], False),
            ]:
              points = compiler.clip_polygon(points, axis, edge, lower)
              if len(points) < 3:
                break
            for i in range(1, len(points) - 1):
              q = np.rint(
                (np.array([points[0], points[i], points[i + 1]]) - origin) * 100
              ).astype(int)
              if len({tuple(v) for v in q}) == 3:
                expected[tuple(sorted(tuple(v) for v in q))] += 1
    assert not expected - actual, (key, sum((expected - actual).values()))


def test_native_geometry_and_navigation_are_independently_cardinal(
  plans: dict[str, Any],
) -> None:
  for key, plan in plans["packets"].items():
    if not key.startswith("minecraft:"):
      continue
    p, _, ix = arrays(plan["append"])
    assert np.all(np.any(np.ptp(p[ix].astype(np.int32), axis=1) == 0, axis=1))
    assert not plan.get("appendLines") and not plan["retireLines"]
    for b in plan["appendNav"]:
      assert "roofTriangles" not in b
      assert b["nativeRoofCaps"]
      for ring in [b["ring"], *b["holes"]]:
        assert all(
          a[0] == c[0] or a[1] == c[1] for a, c in zip(ring, ring[1:] + ring[:1])
        )
      assert b["height"] == max(c[4] for c in b["nativeRoofCaps"])
      assert all(
        c[0] < c[2] and c[1] < c[3] and c[4] >= b["minHeight"]
        for c in b["nativeRoofCaps"]
      )


def test_drawn_nav_has_actual_pitched_roof_heights_and_granular_source_leaves(
  plans: dict[str, Any],
) -> None:
  buildings = [
    b
    for k, p in plans["packets"].items()
    if k.startswith("drawn:")
    for b in p["appendNav"]
  ]
  assert all("roofTriangles" in b and "nativeRoofCaps" not in b for b in buildings)
  assert sum(bool(b["holes"]) for b in buildings) > 0
  assert any(
    np.ptp(np.array(t)[:, 1]) > 2 for b in buildings for t in b["roofTriangles"]
  )
  assert any(b["height"] < 6 for b in buildings)
  assert any(b["height"] > 22 for b in buildings)


def test_native_cap_merging_preserves_every_cell_and_height() -> None:
  cells = [
    [x, z, x + 1, z + 1, 8 if z < 3 else 9]
    for x in range(6)
    for z in range(5)
    if (x, z) not in {(2, 2), (3, 2)}
  ]
  merged = compiler.merge_caps(cells)
  expected = {(x, z): y for x, z, _, _, y in cells}
  actual = {
    (x, z): y
    for x0, z0, x1, z1, y in merged
    for x in range(x0, x1)
    for z in range(z0, z1)
  }
  assert actual == expected
  assert len(merged) < len(cells)


def test_only_exact_superseded_legacy_frontage_instances_have_receipts(
  source: dict[str, Any], plans: dict[str, Any]
) -> None:
  data = read("src/app/src/data/legacyFittingsV304.json")
  old = read("geo_data/regierungsviertel/south-kiez-v185-evidence.json")["features"]
  owners = {o["sourceId"] for o in source["oldOwners"]}
  assert len(data["records"]) == 56
  for r in data["records"]:
    field, first, count = (
      ("nativeRows", "firstNative", "nativeCount")
      if r["native"]
      else ("boxes", "firstBox", "boxCount")
    )
    original = read(
      "src/app/src/data/"
      + ("southKiezV185Native.json" if r["native"] else "southKiezV185.json")
    )[field]
    feature = next(f for f in old if f.get("sourceId") == r["owner"])
    assert feature["role"] == "source-frontage-profile" and r["owner"] in owners
    assert r["expectedCount"] == len(original)
    assert [q["index"] for q in r["rows"]] == list(
      range(feature[first], feature[first] + feature[count])
    )
    assert all(q["row"] == original[q["index"]] for q in r["rows"])
    mode = "minecraft:" if r["native"] else "drawn:"
    expected = [
      k
      for k, p in plans["packets"].items()
      if k.startswith(mode) and any(b["sourceId"] == r["owner"] for b in p["retireNav"])
    ]
    assert r["requiredPacketKeys"] == expected


def test_open_yards_and_comenius_garden_not_filled(
  source: dict[str, Any], plans: dict[str, Any]
) -> None:
  # New body coverage stays inside its 72 finite original official families.
  # It cannot become a broad opaque neighbourhood or garden overlay.
  source_union = unary_union(
    [Polygon(q["ring"], q["holes"]) for p in source["parents"] for q in p["parts"]]
  )
  for key, p in plans["packets"].items():
    if not key.startswith("drawn:"):
      continue
    ox, _, oz = p["origin"]
    for b in p["appendNav"]:
      g = shape({"type": "Polygon", "coordinates": [b["ring"], *b["holes"]]})
      from shapely.affinity import translate

      assert translate(g, ox, oz).difference(source_union.buffer(0.002)).area < 0.001


def test_prior_exact_roof_material_follows_complete_replacement_in_both_modes(
  source: dict[str, Any], plans: dict[str, Any], evidence: dict[str, Any]
) -> None:
  """A new complete source body must inherit the old mapped roof observation."""
  owner = "DEBE08YYF0000CEW"
  assert compiler.retained_roof_colours(source) == {owner: 0xC59D8F}
  old = next(r for r in source["oldOwners"] if r["sourceId"] == "OSM-way-168921751")
  assert old["replacementOwners"] == [owner] and old["measuredCoverage"] > 0.99
  assert evidence["materialTransfers"] == [
    {
      "oldOwner": "OSM-way-168921751",
      "replacementOwner": owner,
      "source": "outer-materials-v254-evidence.json.gz",
      "sourceSha256": "4362a8e8e596470fac9408849f7c056c02ffadd7f09c2a0f8ca48da240f98948",
      "roofColour": "#c59d8f",
      "roofMaterial": "roof_tiles",
      "bothModes": True,
      "preservedOtherGeometryAndColours": True,
    }
  ]
  parent = next(p for p in source["parents"] if p["id"] == owner)
  footprints = {
    p["id"]: unary_union([Polygon(q["ring"], q["holes"]) for q in p["parts"]])
    for p in source["parents"]
  }
  occupied = unary_union(
    [shape(row["geometry"]) for row in source["oldOwners"]] + list(footprints.values())
  )
  detail = compiler.Detail()
  surfaces, _ = compiler.translated_surfaces(parent)
  for surface in surfaces:
    colour = 0xC59D8F if surface["kind"] == "RoofSurface" else 0xDED6BF
    detail.triangles.extend(
      (triangle, compiler.rgb(colour), "source " + surface["kind"])
      for triangle in triangles_for(surface["rings"])
    )
  for surface in surfaces:
    if surface["kind"] == "WallSurface":
      compiler.facade(detail, surface, parent, occupied, footprints[owner])
  native, _ = compiler.native_model(detail)
  expected_counts = {"drawn": 14, "minecraft": 694}
  for mode, model in [("drawn", detail), ("minecraft", native)]:
    plan = plans["packets"][mode + ":ring182-9_9"]
    roof = compiler.Detail()
    roof.triangles = [
      row for row in model.triangles if tuple(row[1]) == (197, 157, 143)
    ]
    packed = compiler.packed_detail(roof, box(4608, 4608, 5120, 5120))
    assert packed is not None
    expected_p, expected_c, expected_i = arrays(packed)
    assert len(expected_i) == expected_counts[mode]
    assert np.all(expected_c[expected_i] == [142, 86, 70])
    p, c, ix = arrays(plan["append"])
    actual = Counter(
      (tuple(map(tuple, p[tri])), tuple(map(tuple, c[tri]))) for tri in ix
    )
    expected = Counter(
      (tuple(map(tuple, expected_p[tri])), tuple(map(tuple, expected_c[tri])))
      for tri in expected_i
    )
    assert not expected - actual
