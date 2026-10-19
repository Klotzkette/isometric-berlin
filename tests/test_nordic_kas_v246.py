"""Independent site/prism/native-column and whole-city preservation receipts."""

import gzip
import hashlib
import json
import subprocess
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import LineString, Polygon, shape

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
SOURCE = json.loads(
  gzip.decompress((GEO / "nordic-kas-v246-source.json.gz").read_bytes())
)
DATA = json.loads((ROOT / "src/app/src/data/nordicAndKasV246.json").read_text())


def test_complete_input_preservation_and_exact_runtime_projection():
  for path, digest in SOURCE["inputHashes"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest
  assert DATA == {
    k: SOURCE[k] for k in ("copper", "faces", "nativeCellM", "nativeCells")
  }
  # v237 packets stay immutable, including every KAS window/door/profile.
  old = json.loads((GEO / "spree-v237-manifest-addition.json").read_text())
  for desc in old["chunks"]:
    for mode in ("drawn", "minecraft"):
      p = ROOT / "src/app/public/mesh/surrounding-berlin-v159" / desc[mode]["url"]
      assert hashlib.sha256(p.read_bytes()).hexdigest() == desc[mode]["sha256"]


def test_exact_six_nordic_houses_and_distinct_kas_headquarters():
  buildings = {b["osmWayId"]: b for b in SOURCE["buildings"]}
  assert set(buildings) == {
    "26746070",
    "37428406",
    "26746069",
    "26746068",
    "26746067",
    "26746071",
    "33135651",
    "609711202",
  }
  assert SOURCE["footprint"]["osmWayId"] == "25999438"
  assert buildings["26746071"]["name"] == "Felleshus"
  assert buildings["33135651"]["tags"]["addr:street"] == "Klingelhöferstraße"
  assert buildings["609711202"]["tags"]["addr:housenumber"] == "23"
  assert "33755520" not in buildings and "25999445" not in buildings
  source_prisms = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  for b in buildings.values():
    mapped = shape(b["geometry"])
    for part in b["parts"]:
      assert part in source_prisms
      poly = Polygon(np.array(part["ring"]) / 10)
      assert mapped.intersection(poly).area / poly.area > 0.75


def test_copper_uses_actual_site_course_and_keeps_rauchstrasse_open():
  ring = SOURCE["footprint"]["geometry"]["coordinates"][0][0]
  assert shape(SOURCE["footprint"]["geometry"]).geoms[0].exterior.is_ccw
  assert len(SOURCE["copper"]) == 51
  assert 226 < SOURCE["copperLengthM"] < 230
  for edge in SOURCE["copper"]:
    assert edge["a"] == ring[edge["edge"]] and edge["b"] == ring[edge["edge"] + 1]
    assert not (
      min(edge["a"][1], edge["b"][1]) > 1109
      and LineString([edge["a"], edge["b"]]).length > 20
    )
  assert (
    abs(
      sum(LineString([e["a"], e["b"]]).length for e in SOURCE["copper"])
      - SOURCE["copperLengthM"]
    )
    < 1e-8
  )


def test_every_facade_matches_exact_retained_prism_edge_and_height():
  parts = {p["id"]: p for b in SOURCE["buildings"] for p in b["parts"]}
  old = json.loads((GEO / "spree-tiergarten-v237-evidence.json").read_text())
  for f in SOURCE["faces"]:
    p = parts[f["owner"]]
    ring = list(
      shapely.orient_polygons(
        Polygon(np.array(p["ring"]) / 10), exterior_cw=False
      ).exterior.coords
    )
    assert list(ring[f["edge"]]) == f["a"] and list(ring[f["edge"] + 1]) == f["b"]
    assert f["low"] == p["y0_dm"] / 10
    assert f["high"] == (p["y0_dm"] + p["h_dm"]) / 10
    assert p["roof"] == 1000
    if f["style"].startswith("kas"):
      assert any(
        r["owner"] == f["owner"]
        and any(w["a"] == f["a"] and w["b"] == f["b"] for w in r["walls"])
        for r in old["records"]
      )


def test_native_support_is_exact_existing_columns():
  vox = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json").read_text()
  )
  expected = []
  for iz, runs in enumerate(vox["building_rows"]):
    z = (vox["grid"]["min_z_idx"] + iz + 0.5) * vox["cell_m"]
    if not 1024 <= z <= 1210:
      continue
    for start, count, lo, hi, *_ in runs:
      for ix in range(start, start + count):
        x = (vox["grid"]["min_x_idx"] + ix + 0.5) * vox["cell_m"]
        if -1504 <= x <= -1280:
          expected.append([x, z, lo / 10, hi / 10])
  assert SOURCE["nativeCells"] == expected and len(expected) == 705


def test_only_documented_nordic_arc_is_retired_from_existing_module():
  path = "src/app/src/DiplomaticAndRobertKochDetails.ts"
  old = subprocess.check_output(
    ["git", "show", "v1.0.145:" + path], cwd=ROOT, text=True
  )
  start = old.index("  // Nordic embassies:")
  end = old.index("  // Mexican embassy:", start)
  previous = old[start:end]
  assert "full ? 26 : 14" in previous and "Math.sin(a) * 55" in previous
  current = (ROOT / path).read_text()
  assert "Math.sin(a) * 55" not in current
  assert "addNordicAndKasV246(b)" in current
