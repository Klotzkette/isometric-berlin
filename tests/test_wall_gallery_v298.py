"""Independent retained-source and raster-centre checks for the v298 walls."""

from __future__ import annotations

import gzip
import hashlib
import json
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import Point, Polygon, shape

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> dict:
  file = ROOT / path
  raw = file.read_bytes()
  return json.loads(gzip.decompress(raw) if path.endswith(".gz") else raw)


def test_current_seven_actual_wall_polygons_retain_every_original_node() -> None:
  data = read("src/app/src/data/wallGalleryV298.json")
  evidence = read("geo_data/regierungsviertel/wall-gallery-v298-evidence.json.gz")
  tr = Transformer.from_crs(4326, 25833, always_xy=True)
  nodes = {
    p["id"]: tr.transform(p["lon"], p["lat"])
    for p in evidence["originalWalls"]
    if p["type"] == "node"
  }
  ways = [p for p in evidence["originalWalls"] if p["type"] == "way"]
  assert len(ways) == len(data["walls"]) == 7
  for w in ways:
    current = next(p for p in data["walls"] if p["id"] == str(w["id"]))
    expected = [[nodes[i][0] - 389500, 5820000 - nodes[i][1]] for i in w["nodes"]]
    assert current["ring"] == expected
    assert current["tags"] == w["tags"]
    assert Polygon(current["ring"]).is_valid


def test_named_murals_stay_on_current_preserved_walls_and_source_nodes() -> None:
  data = read("src/app/src/data/wallGalleryV298.json")
  evidence = read("geo_data/regierungsviertel/wall-gallery-v298-evidence.json.gz")
  assert len(data["artworks"]) == 8
  for art in data["artworks"]:
    source = next(p for p in evidence["artworkSourceNodes"] if p["id"] == art["id"])
    assert art["point"] == source["geometry"]["coordinates"]
    wall = next(p for p in data["walls"] if p["id"] == art["wallId"])
    assert Polygon(wall["ring"]).boundary.distance(Point(art["point"])) < 0.09
  assert {p["kind"] for p in data["artworks"]} == {
    "vrubel",
    "kinder",
    "noir",
    "alavi",
    "schaefer",
    "heimler",
    "klingenstein",
    "kuehn",
  }


def test_dgm_raster_centres_datum_and_bounded_support_keep_original_samples() -> None:
  data = read("src/app/src/data/wallGalleryV298.json")
  evidence = read("geo_data/regierungsviertel/wall-gallery-v298-evidence.json.gz")
  hill = data["hill"]
  assert hill == evidence["hill"]
  assert hill["origin"] == [2028.5, -2876.5]
  assert hill["stepM"] == 4
  assert len(hill["heights"]) * len(hill["heights"][0]) == 15142
  # Independent actual XYZ lines inspected in official DGM1_390_5822.zip.
  for x, northing, nhn in [
    (391748.5, 5822696.5, 58.78),
    (391792.5, 5822528.5, 58.96),
    (391728.5, 5822620.5, 49.25),
  ]:
    i = round((x - 389500 - hill["origin"][0]) / 4)
    j = round((5820000 - northing - hill["origin"][1]) / 4)
    assert hill["heights"][j][i] == round(nhn - 30, 3)
  mask = shape(hill["mask"])
  for p in data["parkWall"]["geometry"]["coordinates"]:
    assert mask.boundary.distance(Point(p)) > hill["seamWidthM"]
  assert mask.area < 170000
  assert not mask.covers(Point(0, 0))


def test_terrain_receipts_pin_only_actual_city_fields_and_old_nord_props() -> None:
  audit = read("geo_data/regierungsviertel/wall-gallery-v298-terrain-receipts.json.gz")
  assert len(audit["chunks"]) == 8
  for entry in audit["chunks"]:
    current = read(entry["file"])
    assert current["origin"] == entry["origin"]
    assert current["nav"]["groundY"] == entry["navGroundY"] == 3.0
    for mesh, receipt in zip(current["meshes"], entry["meshes"], strict=True):
      assert receipt["kind"] == mesh["kind"]
      for key, sha in receipt["encodedFieldSha256"].items():
        assert hashlib.sha256(str(mesh[key]).encode()).hexdigest() == sha
      if receipt["kind"] == "alt-mitte-v169":
        assert receipt["affectedVertexCount"] == 0
  assert {
    (p["key"], p["mode"], len(p["boxes"])) for p in audit["nordMauerparkV266Props"]
  } == {("4_-6", "drawn", 6), ("4_-6", "minecraft", 84)}


def test_actual_core_sources_have_no_occupied_primitive_in_the_field() -> None:
  evidence = read("geo_data/regierungsviertel/wall-gallery-v298-evidence.json.gz")
  audit = evidence["coreSupportAudit"]
  assert audit["occupiedPrimitiveIntersections"]
  assert set(audit["occupiedPrimitiveIntersections"].values()) == {0}
  for path, expected in audit["sourceSha256"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == expected
  # A misleading rectangular grid overlap must not be treated as a licence
  # to bend unrelated core prisms, props or source arrays.
  ground = read("src/app/public/mesh/regierungsviertel/ground-context.json")
  assert (ground["grid"]["min_x_idx"] + ground["grid"]["cols"]) * ground[
    "cell_m"
  ] > audit["supportBounds"][0]
  mask = shape(read("src/app/src/data/wallGalleryV298.json")["hill"]["mask"])
  prisms = read("src/app/public/mesh/regierungsviertel/lod2-prisms.json")
  assert not any(
    Polygon([(x / 10, z / 10) for x, z in b["ring"]]).intersects(mask)
    for b in prisms["buildings"]
  )
