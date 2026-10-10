"""Source preservation, exact ownership and measured body checks for v209."""

from __future__ import annotations

import gzip
import hashlib
import json
import sys
from pathlib import Path
from statistics import median

from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_volksbuehne_orankesee_v209 as build  # noqa: E402


def read(path: str) -> dict:
  return json.loads((ROOT / path).read_text())


def test_complete_original_shell_and_holes_are_retained() -> None:
  runtime = read("src/app/src/data/volksbuehneEnvelopeV209.json")
  evidence = read("geo_data/regierungsviertel/volksbuehne-v209-source.json")
  original = read("geo_data/regierungsviertel/volksbuehne-v189-source.json")
  assert evidence["originalSource"] == original
  assert len(original["building"]["surfaces"]) == 75
  vertices = {tuple(v[:3]) for v in runtime["drawn"]["vertices"]}
  for sheet in original["building"]["surfaces"]:
    for ring in sheet["ringsEpsg25833Nhn"]:
      for x, n, h in ring:
        assert (
          round(x - 389500, 3),
          round(h - 35.866 + 3, 3),
          round(5820000 - n, 3),
        ) in vertices
  assert len(runtime["rings"]) == 3
  footprint = Polygon(runtime["rings"][0], runtime["rings"][1:])
  for volume in runtime["volumes"]:
    assert shape(volume["footprint"]).difference(footprint).area < 0.00001


def test_roof_heights_are_derived_from_retained_official_interior_samples() -> None:
  runtime = read("src/app/src/data/volksbuehneEnvelopeV209.json")
  measured = read("geo_data/regierungsviertel/volksbuehne-v209-bdom-samples.json")
  assert len(measured["samples"]) == 220
  assert measured["license"] == "dl-de/zero-2-0"
  heights = {(r[2], r[3]): r[4] for r in measured["samples"]}
  for volume in runtime["volumes"][:2]:
    actual = median(heights[tuple(p)] for p in volume["sampleCoordinates"])
    assert volume["roofNhn"] == round(actual, 3)
    assert abs(volume["topY"] - (actual - 35.866 + 3)) < 1e-9
  assert runtime["volumes"][0]["topY"] == 42.254
  assert runtime["volumes"][1]["topY"] == 28.889


def test_navigation_rebuilds_only_the_same_three_upper_volumes() -> None:
  runtime = read("src/app/src/data/volksbuehneEnvelopeV209.json")
  nav = read("src/app/src/data/volksbuehneV209Navigation.json")
  assert build.navigation(runtime) == nav
  assert nav["upperVolumesOnly"] is True
  assert len(nav["flatVolumes"]) == 2
  assert {v["lowY"] for v in nav["flatVolumes"]} == {23.564}
  assert nav["rearRoof"]["lowY"] == 23.564
  assert nav["rearRoof"]["highY"] == runtime["volumes"][2]["topY"]


def test_precise_triangle_gates_retain_immutable_packet_and_every_other_owner() -> None:
  receipt = read("src/app/src/data/volksbuehneOwnershipV209.json")
  assert [len(r["triangles"]) for r in receipt["records"]] == [221, 13056]
  for record in receipt["records"]:
    path = (
      ROOT
      / f"src/app/public/mesh/surrounding-berlin-v159/5_-2.{record['mode']}.json.gz"
    )
    assert hashlib.sha256(path.read_bytes()).hexdigest() == record["packetSha256"]
    packet = json.loads(gzip.decompress(path.read_bytes()))
    part = next(m for m in packet["meshes"] if m["kind"] == record["kind"])
    fnv = 2166136261
    for value in [part["positions"], part["colors"], part["indices"]]:
      for c in value:
        fnv = ((fnv ^ ord(c)) * 16777619) & 0xFFFFFFFF
    assert fnv == record["fingerprint"]
    assert record["owner"] == "DEBE01YYK00001YG"
    assert len(set(record["triangles"])) == len(record["triangles"])
  rebuilt, _, gate = build.theatre()
  assert json.loads(json.dumps(rebuilt)) == read(
    "src/app/src/data/volksbuehneEnvelopeV209.json"
  )
  assert gate == receipt


def test_orankesee_keeps_full_source_coast_and_sand_excludes_water() -> None:
  runtime = read("src/app/src/data/orankeseeV209.json")
  source = read("geo_data/regierungsviertel/orankesee-v209-source.json")
  original = shape(source["fullWater"])
  assert original.symmetric_difference(Polygon(runtime["shoreline"])).area < 0.3
  sand = unary_union(
    [
      Polygon([(p[0], p[2]) for p in runtime["sand"][i : i + 3]])
      for i in range(0, len(runtime["sand"]), 3)
    ]
  )
  assert sand.intersection(original).area < 0.1
  assert runtime["noNewWaterSurface"] is True
  assert source["newScope"] is False
  assert {"way/4788724", "relation/3099999", "way/10354648"}.issubset(
    {f["id"] for f in runtime["features"]}
  )
  assert len(runtime["shoreline"]) == 82
  assert len(runtime["features"]) == 99
