"""Retained museum owners, native source receipts and authentic rail anchors."""

import gzip
import hashlib
import json
import math
import sys
from pathlib import Path

from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import NS

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_bebelplatz_building_source import extract_parent, world_ring  # noqa: E402

DATA = json.loads((ROOT / "src/app/src/data/technikmuseumV272.json").read_bytes())
EVIDENCE = json.loads(
  gzip.decompress(
    (
      ROOT / "geo_data/regierungsviertel/technikmuseum-v272-evidence.json.gz"
    ).read_bytes()
  )
)


def plan(prism):
  return Polygon(
    [(x / 10, z / 10) for x, z in prism["ring"]],
    [[(x / 10, z / 10) for x, z in h] for h in prism.get("holes", [])],
  )


def test_complete_original_official_sheets_and_legacy_plans_retained():
  for source in EVIDENCE["sources"]:
    with (ROOT / source["path"]).open("rb") as f:
      assert hashlib.file_digest(f, "sha256").hexdigest() == source["sha256"]
  archive = ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_389_5817.zip"
  for source in EVIDENCE["official"]:
    parent = extract_parent(archive, source["id"])
    sheets = [
      dict(
        kind=s.tag.split("}")[-1],
        rings=[world_ring(r) for r in p.findall(".//gml:posList", NS)],
      )
      for boundary in parent.findall("bldg:boundedBy", NS)
      for s in boundary
      for p in s.findall(".//gml:Polygon", NS)
    ]
    assert sheets == source["surfaces"]
  assert len(EVIDENCE["official"][0]["surfaces"]) == 325
  assert len(EVIDENCE["official"][1]["surfaces"]) == 106
  for site, original in zip(DATA["sites"], DATA["previousPrisms"], strict=True):
    assert site["ring"] == [[x / 10, z / 10] for x, z in original["ring"]]
    assert site["holes"] == original["holes"]
  assert DATA["sites"][0]["roofY"] == 25.879
  assert DATA["sites"][2]["roofY"] == 14.914
  assert "flat-campus" in DATA["estimates"]


def test_native_receipts_exist_and_never_retire_shared_or_unrelated_owners():
  actual = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_bytes()
  )["buildings"]
  voxel = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json").read_bytes()
  )
  for old in DATA["previousPrisms"]:
    assert next(p for p in actual if p["id"] == old["id"]) == old
  selected = unary_union([plan(p) for p in DATA["previousPrisms"]])
  neighbours = unary_union([plan(p) for p in DATA["neighbours"]])
  cell = DATA["cellM"]
  assert len(DATA["columns"]) == 909 and len(DATA["retainedSharedColumns"]) == 45
  for ix, iz, lo, hi, kind in DATA["columns"]:
    runs = voxel["building_rows"][iz - voxel["grid"]["min_z_idx"]]
    assert any(
      voxel["grid"]["min_x_idx"] + off <= ix < voxel["grid"]["min_x_idx"] + off + n
      and (lo, hi, kind) == (low, high, k)
      for off, n, low, high, k in runs
    )
    square = box(ix * cell, iz * cell, (ix + 1) * cell, (iz + 1) * cell)
    assert selected.intersection(square).area > 0.001
    assert neighbours.intersection(square).area <= 0.001
  assert set(map(tuple, DATA["columns"])).isdisjoint(
    map(tuple, DATA["retainedSharedColumns"])
  )


def test_native_cardinal_footprint_is_exact_union_of_visible_roof_cells():
  cell = 1.2
  for site in DATA["sites"]:
    original = Polygon(site["ring"], site["holes"])
    xmin, zmin, xmax, zmax = original.bounds
    native = Polygon(site["nativeRing"], site["nativeHoles"])
    cells = []
    for ix in range(math.floor(xmin / cell), math.ceil(xmax / cell)):
      for iz in range(math.floor(zmin / cell), math.ceil(zmax / cell)):
        centre = Point((ix + 0.5) * cell, (iz + 0.5) * cell)
        if native.contains(centre):
          assert original.contains(centre) or original.boundary.distance(centre) < 1e-7
          cells.append(box(ix * cell, iz * cell, (ix + 1) * cell, (iz + 1) * cell))
        elif original.contains(centre):
          assert original.boundary.distance(centre) < 1e-7
    assert len(cells) == site["nativeCells"]
    native = Polygon(site["nativeRing"], site["nativeHoles"])
    assert unary_union(cells).symmetric_difference(native).area < 1e-6
    for ring in [site["nativeRing"], *site["nativeHoles"]]:
      for a, b in zip(ring, ring[1:] + ring[:1], strict=True):
        assert a[0] == b[0] or a[1] == b[1]


def test_aircraft_rotor_turntables_and_locomotives_use_retained_mapped_anchors():
  assert DATA["aircraft"]["id"] == "way/167983108"
  assert DATA["rotor"]["id"] == "way/255072469"
  assert len(DATA["tracks"]) == 91
  ids = [
    "way/40985994",
    "way/40985997",
    "way/40985992",
    "way/39093470",
    "way/39093627",
    "way/39093628",
  ]
  for i, identifier in enumerate(ids):
    track = next(t for t in DATA["tracks"] if t["id"] == identifier)
    a, b = track["geometry"]["coordinates"][:2]
    length = math.dist(a, b)
    direction = [(b[j] - a[j]) / length for j in [0, 1]]
    site = DATA["sites"][1 if i < 3 else 2]
    shed = Polygon(site["ring"])
    # The full locomotive and tender, not just their anchor, remain in the shed.
    for distance in [2.85, 14.95]:
      for side in [-1.45, 1.45]:
        x = a[0] + direction[0] * distance - direction[1] * side
        z = a[1] + direction[1] * distance + direction[0] * side
        assert shed.contains(Point(x, z))
  assert (ROOT / "src/app/src/data/technikmuseumV272.json").stat().st_size < 100000
  assert all(
    r["url"].startswith("https://technikmuseum.berlin/") for r in DATA["references"]
  )
