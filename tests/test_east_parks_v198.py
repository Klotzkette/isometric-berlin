"""Bounded eastern park source-preservation checks."""

import hashlib
import json
from pathlib import Path

from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = json.loads((ROOT / "src/app/src/data/eastParksV198.json").read_text())
EVIDENCE = json.loads((GEO / "east-parks-v198-evidence.json").read_text())


def test_retained_complete_source_models_are_byte_identical() -> None:
  for name, digest in EVIDENCE["preserved"].items():
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == digest
  assert all(url.startswith("https://") for url in EVIDENCE["references"])


def test_memorial_layout_has_all_source_owners_and_heights() -> None:
  assert len(DATA["cenotaphs"]) == 16
  assert len({r["id"] for r in DATA["cenotaphs"]}) == 16
  assert len(DATA["flags"]) == 2
  assert {r["height"] for r in DATA["cenotaphs"]} == {2.5}
  assert {r["height"] for r in DATA["flags"]} == {14}
  memorial = Polygon(DATA["memorial"][0], DATA["memorial"][1:])
  for owner in DATA["cenotaphs"] + DATA["flags"]:
    rr = owner["rings"]
    assert memorial.buffer(0.002).covers(Polygon(rr[0], rr[1:]))
  nav = json.loads((ROOT / "src/app/src/data/eastParksV198Navigation.json").read_text())
  assert not {r["owner"] for r in nav} & {"way/44387292", "way/142701801"}
  mausoleum = [r for r in nav if r["owner"] == "way/142701713"]
  assert mausoleum and all(r["groundY"] == 11 and r["topY"] == 20 for r in mausoleum)


def test_ground_coverage_keeps_park_holes_and_source_vertices() -> None:
  ground = [Polygon(g["rings"][0], g["rings"][1:]) for g in DATA["grounds"]]
  area = unary_union(ground)
  park = unary_union([Polygon(r[0], r[1:]) for r in DATA["park"]])
  assert area.difference(park.buffer(0.003)).area < 0.1
  assert abs(sum(g.area for g in ground) - area.area) < 1
  assert area.area > 650_000
  records = {r["id"]: r for r in EVIDENCE["records"]}
  for c in DATA["cenotaphs"]:
    exact = shape(records[c["id"]]["geometry"])
    generated = Polygon(c["rings"][0], c["rings"][1:])
    assert exact.hausdorff_distance(generated) < 0.001
