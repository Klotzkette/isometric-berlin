"""Source accounting for the bounded v187 southwest recognition models."""

from __future__ import annotations

import gzip
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"


def read(path: Path) -> dict:
  """Load static evidence."""
  return json.loads(
    gzip.decompress(path.read_bytes()) if path.suffix == ".gz" else path.read_text()
  )


def test_exact_owner_exclusions_and_all_original_parts() -> None:
  source = read(GEO / "southwest-landmarks-v187-source.json.gz")
  runtime = read(DATA / "southWestLandmarksV187.json")
  exclusions = read(GEO / "southwest-landmarks-v187-exclusions.geojson")["features"]
  originals = {p["id"]: p for p in source["profiles"]}
  assert len(originals) == 25
  assert {f["properties"]["id"] for f in exclusions} == set(originals)
  represented = {s["part"] for site in runtime["sites"] for s in site["surfaces"]}
  assert represented == {
    p["id"] for owner in originals.values() for p in owner["parts"]
  }
  project = Transformer.from_crs(4326, 25833, always_xy=True)
  from shapely.ops import transform

  for feature in exclusions:
    owner = originals[feature["properties"]["id"]]
    footprints = unary_union([Polygon(p["ring"], p["holes"]) for p in owner["parts"]])
    mapped = transform(
      lambda x, y: (
        project.transform(x, y)[0] - 389500,
        5820000 - project.transform(x, y)[1],
      ),
      shape(feature["geometry"]),
    )
    assert footprints.symmetric_difference(mapped).area < 0.01


def test_drawn_payload_reproduces_from_frozen_source_and_keeps_steglitz() -> None:
  script = ROOT / "scripts/build_southwest_landmarks_v187.py"
  sys.path.insert(0, str(ROOT / "scripts"))
  try:
    spec = importlib.util.spec_from_file_location("southwest_v187", script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    runtime, evidence = module.build()
  finally:
    sys.path.pop(0)
  assert runtime == read(DATA / "southWestLandmarksV187.json")
  old = DATA / "steglitzV182Source.json"
  assert (
    evidence["existingSteglitzSha256"] == hashlib.sha256(old.read_bytes()).hexdigest()
  )
  assert runtime["sites"][-1]["surfaces"] == []
  assert len(runtime["sites"][-1]["boxes"]) == 36
  assert (
    sum(
      len(s["triangles"])
      for site in runtime["sites"]
      for s in site["surfaces"]
      if s["kind"] != "RecognitionSurface"
    )
    == 3832
  )


def test_navigation_retains_exact_part_holes_and_rendered_heights() -> None:
  source = read(GEO / "southwest-landmarks-v187-source.json.gz")
  evidence = read(GEO / "southwest-landmarks-v187-evidence.json")
  nav = read(DATA / "southWestLandmarksV187Navigation.json")["buildings"]
  offsets = {o["id"]: o["rigidYOffset"] for o in evidence["owners"]}
  parts = {
    p["id"]: (owner["id"], p) for owner in source["profiles"] for p in owner["parts"]
  }
  assert len(nav) == len(parts) == 134
  for entry in nav:
    owner, part = parts[entry["id"]]
    assert entry["owner"] == entry["sourceId"] == owner
    assert entry["ring"] == part["ring"]
    assert entry["holes"] == part["holes"]
    assert entry["groundY"] == round(part["ground_y_m"] + offsets[owner], 3)
    assert entry["topY"] == round(part["top_y_m"] + offsets[owner], 3)
  fu = [n for n in nav if n["owner"] == "DEBE06YYB00009Fd"]
  assert len({n["topY"] for n in fu}) > 20
  assert any(n["holes"] for n in fu)
