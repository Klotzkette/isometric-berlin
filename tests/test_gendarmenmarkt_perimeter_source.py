"""Step 10: exact source, courtyard, ownership and street-front contracts."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

import geopandas as gpd
import pytest
from shapely.geometry import LineString, Point, Polygon

from isometric_berlin.data.fetch_lod2 import load_bounds_polygon, project_to_berlin

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/app/src/gendarmenmarktPerimeterSource.json"
PRISMS = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
EXPECTED_PART_COUNTS = {
  "dentons": 1,
  "einstein": 8,
  "hilton": 8,
  "academy": 10,
  "quartier206": 16,
  "newton": 50,
  "borchardt": 3,
  "lutterWegner": 3,
  "hannsEisler": 9,
  "charlottenNorthwest": 6,
  "erdinger": 3,
  "franzoesischeNorthwest": 7,
  "franzoesischeNorth": 1,
  "franzoesischeNortheast": 9,
  "markgrafenSoutheastNorth": 11,
  "taipei": 7,
}
# Approved source-ring fingerprints detect filled or simplified courts without
# depending on the ignored raw CityGML archives in CI.
COURTS = {
  "DEBE01YYK00001GO": (
    27,
    1125.692993,
    "106b22d4d07339e0717ddd6791fe845128fa43abecb62bb95bcf404adfb09519",
  ),
  "DEBE3DDucqfahnTi": (
    18,
    441.3975645,
    "b6b4022481cfb396b873625174a0701c116a1d561aa1128ecf785a1829d06913",
  ),
  "DEBE3DYYext55AlS": (
    4,
    89.6635635,
    "11dd6734e72fa9f5bcb2a1bd69bb45f2102f92364285c8c8c7b683fd728e1e9b",
  ),
  "DEBE3DSB2vKEDzHk": (
    4,
    55.547364,
    "31037435eec804f87b00e01a3c24e735f815d968ff2ff97c36a79f881961ac25",
  ),
}
ROOF_ONLY_PARTS = {
  "DEBE3DuwXG2bQQME",
  "DEBE3DureJTzqT5A",
  "DEBE3DakNUXULI1H",
}


@pytest.fixture(scope="module")
def source() -> dict[str, Any]:
  """Read the committed supplement independently of its generator."""
  return json.loads(SOURCE.read_text())


def test_complete_parent_inventory_and_metric_source_remain_bounded(
  source: dict[str, Any],
) -> None:
  bounds = project_to_berlin(
    load_bounds_polygon(ROOT / "geo_data/regierungsviertel/bounds.geojson")
  )
  assert source["originEpsg25833"] == [389500, 5820000, 30]
  assert source["licenses"] == {
    "geometry": "dl-de/zero-2-0",
    "semanticsAndStreetAxes": "ODbL-1.0",
  }
  assert {b["key"]: len(b["officialParts"]) for b in source["buildings"]} == (
    EXPECTED_PART_COUNTS
  )
  assert len(source["buildings"]) == 16
  parents = [p for b in source["buildings"] for p in b["parentIds"]]
  assert len(parents) == len(set(parents)) == 30
  parts = [p for b in source["buildings"] for p in b["officialParts"]]
  assert len(parts) == len({p["id"] for p in parts}) == 152
  for building in source["buildings"]:
    assert {s["parentId"] for s in building["sources"]} == set(building["parentIds"])
    for evidence in building["sources"]:
      assert evidence["sourceUrl"] in {
        "https://gdi.berlin.de/data/a_lod2/atom/LoD2_390_5819.zip",
        "https://gdi.berlin.de/data/a_lod2/atom/LoD2_391_5819.zip",
      }
      assert len(bytes.fromhex(evidence["sourceSha256"])) == 32
      assert evidence["sourceCreated"].startswith("2026-")
    for part in building["officialParts"]:
      footprint = Polygon(
        [(389500 + x, 5820000 - z) for x, z in part["ring"]],
        [[(389500 + x, 5820000 - z) for x, z in ring] for ring in part["holes"]],
      )
      assert footprint.is_valid, part["id"]
      assert bounds.covers(footprint), part["id"]
      assert part["top_y_m"] - part["ground_y_m"] == pytest.approx(
        part["height_m"], abs=0.002
      )
      expected_surfaces = {"RoofSurface"}
      if part["id"] not in ROOF_ONLY_PARTS:
        expected_surfaces.add("WallSurface")
      assert {s["kind"] for s in part["surfaces"]} == expected_surfaces
      for surface in part["surfaces"]:
        for ring in surface["rings"]:
          assert len(ring) >= 3
          for x, y, z in ring:
            assert bounds.covers(Point(389500 + x, 5820000 - z))
            assert part["ground_y_m"] - 0.002 <= y <= part["top_y_m"]


def test_all_previous_prisms_are_identical_and_have_one_owner(
  source: dict[str, Any],
) -> None:
  canonical = {p["id"]: p for p in json.loads(PRISMS.read_text())["buildings"]}
  previous = [p for b in source["buildings"] for p in b["previousDisplayPrisms"]]
  owned = [i for b in source["buildings"] for i in b["prismIds"]]
  assert len(previous) == len(owned) == len(set(owned)) == 109
  assert (
    source["previousPrismSha256"] == hashlib.sha256(PRISMS.read_bytes()).hexdigest()
  )
  for building in source["buildings"]:
    assert [p["id"] for p in building["previousDisplayPrisms"]] == building["prismIds"]
    for prism in building["previousDisplayPrisms"]:
      assert prism == canonical[prism["id"]]
  # This OSM fallback spans two official parents. Keeping only the larger parent
  # would lose 145 square metres when the old runtime prism is suppressed.
  northwestern = next(
    b for b in source["buildings"] if b["key"] == "franzoesischeNorthwest"
  )
  assert "57099374" in northwestern["prismIds"]
  assert set(northwestern["parentIds"]) == {
    "DEBE01YYK0000Erd",
    "DEBE01YYK0000BJM",
  }


def test_source_and_previous_geometry_fit_the_fast_replacement_bounds(
  source: dict[str, Any],
) -> None:
  for building in source["buildings"]:
    x0, z0, x1, z1 = building["bbox"]
    points = [
      (x, z)
      for p in building["officialParts"]
      for s in p["surfaces"]
      for ring in s["rings"]
      for x, _, z in ring
    ] + [
      (x / 10, z / 10) for p in building["previousDisplayPrisms"] for x, z in p["ring"]
    ]
    assert all(x0 <= x <= x1 and z0 <= z <= z1 for x, z in points)
    # No bbox inflation to the whole district: these are per-family early-outs.
    assert x1 - x0 < 160 and z1 - z0 < 120


def test_front_endpoints_and_eaves_come_from_the_original_wall_sheets(
  source: dict[str, Any],
) -> None:
  assert sum(len(b["streetFronts"]) for b in source["buildings"]) == 216
  pitched_fronts = 0
  for building in source["buildings"]:
    parts = {p["id"]: p for p in building["officialParts"]}
    translation = building["displayYTranslationM"]
    for front in building["streetFronts"]:
      part = parts[front["partId"]]
      wall = part["surfaces"][front["surfaceIndex"]]
      assert wall["kind"] == "WallSurface"
      ring = wall["rings"][0]
      start, end = front["startXZ"], front["endXZ"]
      assert math.dist(start, end) == pytest.approx(front["lengthM"], abs=0.0005)
      line = LineString([start, end])
      assert all(line.distance(Point(x, z)) < 0.002 for x, _, z in ring)
      endpoint_tops = []
      for endpoint in (start, end):
        # One authentic Hilton wall changes x by 1 mm from its lower to upper
        # vertex. Preserve that sheet while recognizing the same vertical edge.
        heights = [y for x, y, z in ring if math.dist([x, z], endpoint) < 0.0021]
        assert heights, (front["partId"], endpoint)
        endpoint_tops.append(max(heights))
      eaves = min(endpoint_tops) + translation
      assert front["wallTopY"] == pytest.approx(eaves, abs=0.0005)
      assert front["originalWallBaseY"] == pytest.approx(
        max(5.2, min(v[1] for v in ring) + translation), abs=0.0005
      )
      assert front["wallBaseY"] == pytest.approx(
        max(front["originalWallBaseY"], front["maxSourceOcclusionY"]), abs=0.0005
      )
      assert front["wallTopY"] <= part["top_y_m"] + translation + 0.0005
      assert front["parentId"] in building["parentIds"]
      pitched_fronts += part["top_y_m"] + translation - eaves > 0.5
  # This prevents a future substitution of each building's ridge height for its
  # actual eaves, which would draw floating facade rectangles through the roofs.
  assert pitched_fronts > 10


def test_low_source_projections_do_not_erase_the_upper_street_facade(
  source: dict[str, Any],
) -> None:
  buildings = {b["key"]: b for b in source["buildings"]}
  canonical = {p["id"]: p for p in json.loads(PRISMS.read_text())["buildings"]}
  official_tops = {
    p["id"]: p["top_y_m"] + b["displayYTranslationM"]
    for b in source["buildings"]
    for p in b["officialParts"]
  }
  for building in source["buildings"]:
    for front in building["streetFronts"]:
      source_tops = []
      for obstruction in front["occlusionSources"]:
        identifier = obstruction["sourceId"]
        if identifier.startswith("prism:"):
          prism = canonical[identifier.removeprefix("prism:")]
          top = (prism["y0_dm"] + prism["h_dm"]) / 10
        else:
          top = official_tops[identifier]
        assert obstruction["topY"] == pytest.approx(top, abs=0.0005)
        source_tops.append(top)
      assert front["maxSourceOcclusionY"] == pytest.approx(
        max(source_tops, default=front["originalWallBaseY"]), abs=0.0005
      )
  # The old 2D footprint-union filter discarded this entire Hilton wall because
  # its ray crossed the low curved entrance, even though the wall starts above it.
  hilton_upper = next(
    f
    for f in buildings["hilton"]["streetFronts"]
    if f["partId"] == "DEBE3DGql1jKio7Y" and f["surfaceIndex"] == 56
  )
  assert hilton_upper["startXZ"] == [1435.132, 777.201]
  assert hilton_upper["endXZ"] == [1429.533, 777.638]
  assert hilton_upper["wallBaseY"] == pytest.approx(8.479)
  assert hilton_upper["wallTopY"] == pytest.approx(32.549)
  assert "DEBE3DaxQzUzfwX8" in {
    item["sourceId"] for item in hilton_upper["occlusionSources"]
  }
  newton_upper = next(
    f
    for f in buildings["newton"]["streetFronts"]
    if f["startXZ"] == [1323.696, 719.828] and f["endXZ"] == [1324.326, 728.259]
  )
  assert newton_upper["originalWallBaseY"] == pytest.approx(5.2)
  assert newton_upper["wallBaseY"] == pytest.approx(13.3)
  assert newton_upper["wallTopY"] == pytest.approx(36.522)
  assert {p["sourceId"] for p in newton_upper["occlusionSources"]} == {
    "prism:JB5YDqKR",
    "prism:QTrRASjB",
  }


def test_front_normals_face_their_mapped_street_and_exclude_courts(
  source: dict[str, Any],
) -> None:
  streets = {s["osmKey"]: s for s in source["streetAxes"]}
  for building in source["buildings"]:
    parts = {p["id"]: p for p in building["officialParts"]}
    for front in building["streetFronts"]:
      part = parts[front["partId"]]
      footprint = Polygon(part["ring"], part["holes"])
      a, b = front["startXZ"], front["endXZ"]
      length = math.dist(a, b)
      side = front["outwardSide"]
      assert side in (-1, 1)
      nx = -(b[1] - a[1]) / length * side
      nz = (b[0] - a[0]) / length * side
      midpoint = Point((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
      assert footprint.exterior.distance(midpoint) < 0.002
      assert not footprint.contains(Point(midpoint.x + nx * 0.1, midpoint.y + nz * 0.1))
      street = streets[front["streetOsmKey"]]
      assert front["street"] == street["name"]
      axis = LineString(street["pointsXZ"])
      nearest = axis.interpolate(axis.project(midpoint))
      distance = nearest.distance(midpoint)
      assert distance == pytest.approx(front["streetDistanceM"], abs=0.0012)
      assert distance < 22.001
      toward_street = (nearest.x - midpoint.x) * nx + (nearest.y - midpoint.y) * nz
      assert toward_street / distance >= 0.7199


def test_concave_dentons_entry_keeps_its_shell_without_hidden_facade_panes(
  source: dict[str, Any],
) -> None:
  dentons = next(b for b in source["buildings"] if b["key"] == "dentons")
  part = dentons["officialParts"][0]
  assert part["id"] == "DEBE01YYK00001GO"
  # This original recessed wall must remain in the shell. Its right-hand pane
  # would be behind the same building's curved return despite a clear centre ray.
  assert part["surfaces"][72]["kind"] == "WallSurface"
  assert not any(f["surfaceIndex"] == 72 for f in dentons["streetFronts"])
  old_pane_normal_ray = LineString([[1507.41966, 773.28639], [1507.036455, 770.310966]])
  footprint = Polygon(part["ring"], part["holes"])
  assert footprint.intersection(old_pane_normal_ray).length > 1.8


def test_einstein_curved_corner_keeps_its_individual_source_planes(
  source: dict[str, Any],
) -> None:
  einstein = next(b for b in source["buildings"] if b["key"] == "einstein")
  for identifier in ("DEBE3DCzUyqPfyhd", "DEBE3DM994kLmtl4"):
    facets = [f for f in einstein["streetFronts"] if f["partId"] == identifier]
    assert len(facets) == 16
    assert all(0.35 < f["lengthM"] < 0.41 for f in facets)
    assert len({f["surfaceIndex"] for f in facets}) == len(facets)
    assert all(f["wallBaseY"] == pytest.approx(5.2) for f in facets)


def test_all_four_exact_source_court_rings_remain_holes(
  source: dict[str, Any],
) -> None:
  holes = {
    p["id"]: p for b in source["buildings"] for p in b["officialParts"] if p["holes"]
  }
  assert set(holes) == set(COURTS)
  assert sum(len(p["holes"]) for p in holes.values()) == 4
  for identifier, part in holes.items():
    ring = part["holes"][0]
    count, area, digest = COURTS[identifier]
    assert len(ring) == count
    assert Polygon(ring).area == pytest.approx(area, abs=0.000001)
    assert (
      hashlib.sha256(json.dumps(ring, separators=(",", ":")).encode()).hexdigest()
      == digest
    )
    assert not Polygon(part["ring"], part["holes"]).contains(
      Polygon(ring).representative_point()
    )


def test_primary_tenant_anchors_match_the_retained_osm_pois(
  source: dict[str, Any],
) -> None:
  expected = {
    "dentons": "9436604541",
    "einstein": "440923198",
    "hilton": "86001840",
    "academy": "549366121",
    "newton": "86005430",
    "borchardt": "86001798",
  }
  pois = gpd.read_file(ROOT / "geo_data/regierungsviertel/osm.gpkg", layer="pois")
  buildings = {b["key"]: b for b in source["buildings"]}
  for key, identifier in expected.items():
    row = pois[(pois.element == "node") & (pois.id == identifier)].iloc[0]
    anchor = next(
      a for a in buildings[key]["osmAnchors"] if a["osmKey"] == f"node/{identifier}"
    )
    assert anchor["positionXZ"] == pytest.approx(
      [row.geometry.x - 389500, 5820000 - row.geometry.y], abs=0.0005
    )
