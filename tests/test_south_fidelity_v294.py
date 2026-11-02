"""Complete retained sources and finite mapped NKZ correction, Step 10."""

from __future__ import annotations

import gzip
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

import pyogrio
import pytest
from shapely.geometry import LineString, Polygon, shape
from shapely.ops import unary_union

from scripts.historical_asset_reader_v194 import historical_asset_bytes_v194

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_bebelplatz_building_source import extract_parent, part_profile  # noqa: E402

from isometric_berlin.data.fetch_lod2 import leaf_building_parts  # noqa: E402


def read(relative: str) -> dict[str, Any]:
  path = ROOT / relative
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


SOURCE = read("geo_data/regierungsviertel/south-fidelity-v294-source.json.gz")
DATA = read("src/app/src/data/southFidelityV294.json")


def test_all_original_official_parts_and_sheets_survive_verbatim() -> None:
  for owner in SOURCE["originals"]:
    archive = (
      ROOT
      / "geo_data/regierungsviertel/raw/lod2"
      / owner["archiveUrl"].rsplit("/", 1)[1]
    )
    if not archive.exists():
      pytest.skip("Ignored official source ZIP is unavailable in this checkout")
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == owner["archiveSha256"]
    parent = extract_parent(archive, owner["owner"])
    parts = [part_profile(p) for p in leaf_building_parts(parent) or [parent]]
    assert parts == owner["parts"]
    if owner["key"].startswith("nkz"):
      assert (
        next(o for o in DATA["nkzOwners"] if o["owner"] == owner["owner"])["parts"]
        == parts
      )
    else:
      assert DATA["metropolParts"] == parts


def test_roof_sheets_remain_complete_and_only_mapped_lower_aperture_yields() -> None:
  road = LineString(DATA["passage"]["cutPoints"]).buffer(5.5, cap_style=2)
  for shell in DATA["nkzShells"]:
    owner = next(o for o in DATA["nkzOwners"] if o["owner"] == shell["owner"])
    original = unary_union([Polygon(p["ring"], p["holes"]) for p in owner["parts"]])
    roofs = unary_union(
      [
        Polygon([[x, z] for x, y, z in t["p"]])
        for t in shell["triangles"]
        if t["role"] == "nkz-complete-retained-roof"
      ]
    )
    assert original.symmetric_difference(roofs).area < 1e-6
    outside = unary_union(
      [Polygon(s["ring"], s["holes"]) for s in shell["solids"] if s["minY"] == 3]
    )
    above = unary_union(
      [Polygon(s["ring"], s["holes"]) for s in shell["solids"] if s["minY"] == 7.5]
    )
    assert outside.symmetric_difference(original.difference(road)).area < 1e-6
    assert above.symmetric_difference(original.intersection(road)).area < 1e-6
    assert outside.union(above).symmetric_difference(original).area < 1e-6
    assert all(len(b) == 7 and all(v > 0 for v in b[3:6]) for b in shell["blocks"])


def test_original_packets_and_all_prior_geometry_inputs_remain_identical() -> None:
  for path, digest in SOURCE["inputs"].items():
    target = ROOT / path
    if not target.exists():
      pytest.skip("Ignored complete original input is unavailable")
    raw = historical_asset_bytes_v194(target, digest)
    assert hashlib.sha256(raw).hexdigest() == digest
  packets = read("src/app/src/data/southFidelityV294Packets.json")
  manifest = read("src/app/public/mesh/surrounding-berlin-v159/manifest.json")
  for key, record in packets["packets"].items():
    mode, identifier = key.split(":")
    desc = next(d for d in manifest["chunks"] if d["id"] == identifier)
    path = ROOT / "src/app/public/mesh/surrounding-berlin-v159" / desc[mode]["url"]
    raw = historical_asset_bytes_v194(path, record["sourcePacketSha256"])
    assert hashlib.sha256(raw).hexdigest() == record["sourcePacketSha256"]
  assert packets["keys"] == ["drawn:6_4", "minecraft:6_4"]


def test_all_exact_mapped_plans_and_original_passage_points_are_retained() -> None:
  path = ROOT / "geo_data/regierungsviertel/raw/outer-v159/candidate.gpkg"
  if not path.exists():
    pytest.skip("Ignored original OSM snapshot is unavailable")
  assert hashlib.sha256(path.read_bytes()).hexdigest() == SOURCE["osmSnapshotSha256"]
  for feature in SOURCE["features"]:
    assert (
      DATA["plans"][feature["id"].split("/")[1]]
      == feature["geometry"]["coordinates"][0][0][:-1]
    )
  road = (
    pyogrio.read_dataframe(path, layer="lines", where="osm_id='65425836'")
    .to_crs(25833)
    .iloc[0]
  )
  original = [
    [round(x - 389500, 3), round(5820000 - z, 3)] for x, z in road.geometry.coords
  ]
  assert DATA["passage"]["points"] == original
  assert '"tunnel"=>"building_passage"' in DATA["passage"]["tags"]
  assert DATA["passage"]["signedMaxHeightM"] == 4
  assert shape(SOURCE["originals"][0]["previous"]["geometry"]).area > 400


def test_mauer_context_keeps_exact_complete_current_prism_owners_and_inputs() -> None:
  source = read("geo_data/regierungsviertel/mauer-context-v294-source.json.gz")
  data = read("src/app/src/data/mauerContextV294.json")
  current = read("src/app/public/mesh/regierungsviertel/lod2-prisms.json")["buildings"]
  assert {b["key"] for b in data["buildings"]} == {
    "48118905",
    "1056820805",
    "relation/280070",
    "relation/318560",
  }
  assert sum(len(b["originalPrisms"]) for b in data["buildings"]) == 30
  for building in data["buildings"]:
    original = next(b for b in source["buildings"] if b["key"] == building["key"])
    assert original["originalPrisms"] == building["originalPrisms"]
    for part in building["originalPrisms"]:
      assert next(p for p in current if p["id"] == part["id"]) == part
    assert shape(original["geometry"]).is_valid
  for path, digest in source["inputs"].items():
    target = ROOT / path
    if not target.exists():
      pytest.skip("Ignored complete OSM input unavailable")
    raw = historical_asset_bytes_v194(target, digest)
    assert hashlib.sha256(raw).hexdigest() == digest
