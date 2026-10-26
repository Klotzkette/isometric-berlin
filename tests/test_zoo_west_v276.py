"""Independent finite Zoo West source, elevation, ownership and placement checks."""

import gzip
import hashlib
import json
import math
from pathlib import Path

import pytest
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts
from scripts.build_bebelplatz_building_source import extract_parent, part_profile
from scripts.build_tiergarten_werkhof_v275 import roof_at
from scripts.build_zoo_west_v276 import CORRECTIONS, build, corrected

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "src/app/src/data/zooWestV276.json").read_bytes())
EVIDENCE = json.loads(
  gzip.decompress(
    (ROOT / "geo_data/regierungsviertel/zooWestV276Evidence.json.gz").read_bytes()
  )
)


def test_complete_original_parents_and_prior_zoo_are_unchanged() -> None:
  for parent in EVIDENCE["parents"]:
    path = ROOT / parent["sourcePath"]
    assert hashlib.sha256(path.read_bytes()).hexdigest() == parent["sha256"]
    element = extract_parent(path, parent["id"])
    assert [
      part_profile(p) for p in leaf_building_parts(element) or [element]
    ] == parent["parts"]
  for path, digest in EVIDENCE["preservedInputs"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest
  assert len(EVIDENCE["previousPrisms"]) == 12
  assert all(p["id"] != "K0002RFN" for p in EVIDENCE["previousPrisms"])


def test_only_five_source_heights_corrected_and_all_source_xz_retained() -> None:
  originals = [
    p
    for owner in EVIDENCE["parents"]
    if owner["id"] != "DEBE01YYK0002RFN"
    for p in owner["parts"]
  ]
  assert len(originals) == 11
  for original in originals:
    result = corrected(original)
    assert result["ring"] == original["ring"] and result["holes"] == original["holes"]
    assert len(result["surfaces"]) == len(original["surfaces"])
    for old, new in zip(original["surfaces"], result["surfaces"], strict=True):
      assert old["kind"] == new["kind"]
      for ro, rn in zip(old["rings"], new["rings"], strict=True):
        assert len(ro) == len(rn)
        for a, b in zip(ro, rn, strict=True):
          assert (a[0], a[2]) == (b[0], b[2])
          if original["id"] not in CORRECTIONS:
            assert b[1] == pytest.approx(a[1] + 5.2 - original["ground_y_m"], abs=1e-6)
  assert len(CORRECTIONS) == 5
  assert len(DATA["parts"]) == 12
  assert DATA["retainedUnresolved"] == ["K0002RFN"]


def test_independent_height_points_disprove_tall_restaurant_proxies() -> None:
  samples = EVIDENCE["bdom"]

  def nhn(sample: dict) -> float:
    return float(next(iter(sample["response"]["features"][0]["properties"].values())))

  for ident, maximum in [
    ("DEBE3DI70n23Xdak", 38.12),
    ("DEBE3DqgzekHK7XE", 37.59),
    ("DEBE01YYK0003Ucs", 36.92),
  ]:
    selected = [s for s in samples if s["id"] == ident]
    assert len(selected) >= 5
    assert max(map(nhn, selected)) < maximum
    old = next(p for o in EVIDENCE["parents"] for p in o["parts"] if p["id"] == ident)
    assert old["top_y_m"] + 30 - maximum > 15
    for s in selected:
      assert Polygon(old["ring"]).covers(Point(*s["worldXZ"]))
      assert "EPSG%3A25833" in s["url"] and "GetFeatureInfo" in s["url"]
  talia = [nhn(s) for s in samples if s["id"] == "25396899"]
  assert min(talia) > 39.5 and max(talia) < 40
  dgm = float(
    next(iter(EVIDENCE["dgm"][0]["response"]["features"][0]["properties"].values()))
  )
  assert dgm == 35.14
  assert next(p for p in DATA["parts"] if p["sourceId"] == "25396899")[
    "maxY"
  ] == pytest.approx(5.2 + 39.70 - dgm)


def test_native_roofs_use_actual_cells_and_open_shelters_preserve_air() -> None:
  assert sum(p["openCanopy"] for p in DATA["parts"]) == 5
  for p in DATA["parts"]:
    polygon = Polygon(p["ring"], p["holes"])
    cells = {(x, z): top for x, z, top in p["nativeCells"]}
    x0, z0, x1, z1 = polygon.bounds
    for x in range(math.floor(x0), math.ceil(x1)):
      for z in range(math.floor(z0), math.ceil(z1)):
        overlap = polygon.intersection(box(x, z, x + 1, z + 1))
        if overlap.area < 0.035:
          assert (x, z) not in cells
          continue
        point = overlap.representative_point()
        height = roof_at(p["roofTriangles"], point.x, point.y)
        assert height is not None
        assert cells[x, z] == math.ceil((height - 1e-8) * 4) / 4
    if p["openCanopy"]:
      assert p["posts"]
      for x, y, z, w, h, d, *_ in p["posts"]:
        assert w == d == 0.13 and y - h / 2 == pytest.approx(5.2)


def test_current_wolves_and_planting_fit_exact_habitat_clear_of_existing_features() -> (
  None
):
  assert DATA["wolfSpecies"] == "Canis lupus lupus"
  assert (
    "Europäischer Wolf"
    in next(f for f in EVIDENCE["osm"] if f["id"] == "48164524")["tags"]["name"]
  )
  zoo = json.loads((ROOT / "src/app/src/data/zooGroundsV165Source.json").read_bytes())
  raw = {
    f["id"]: f
    for f in json.loads(
      (
        ROOT / "geo_data/regierungsviertel/raw/zoo-v165/selected-features.json"
      ).read_bytes()
    )
    if f["type"] == "way"
  }
  mask = Polygon(DATA["wolfRing"]).buffer(-2)
  exclusions = unary_union(
    [Polygon(p["ring"], p["holes"]) for p in zoo["parts"]]
    + [Polygon(raw[w["id"]]["coordinates"]) for w in zoo["waters"]]
    + [
      LineString(raw[p["id"]]["coordinates"]).buffer(p["width"] / 2 + 0.8)
      for p in zoo["paths"]
    ]
  )
  for x, z, *_ in [*DATA["wolves"], *DATA["shrubs"]]:
    circle = Point(x, z).buffer(1.4)
    assert mask.covers(circle) and not exclusions.intersects(circle)
  assert len(DATA["wolves"]) == 3


def test_replay_and_exact_restaurant_ownership_receipts() -> None:
  assert json.loads(json.dumps(build())) == DATA
  receipt = json.loads(
    (ROOT / "src/app/src/data/zooWestV276Ownership.json").read_bytes()
  )
  originals = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_bytes()
  )["buildings"]
  assert receipt["previousPrisms"] == EVIDENCE["previousPrisms"]
  assert all(p in originals for p in receipt["previousPrisms"])
  assert set(p["sourceId"] for p in DATA["parts"]) == set(
    p["id"] for p in receipt["previousPrisms"]
  )
  assert len(receipt["columns"]) == 87 and len(receipt["retainedSharedColumns"]) == 17
