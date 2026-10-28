"""Independent exact-owner, low-shelter and original evidence regressions."""

import gzip
import hashlib
import json

from shapely.geometry import Point, Polygon, box

from scripts.build_bebelplatz_building_source import extract_parent, part_profile
from scripts.build_steppengarten_shelter_v283 import EVIDENCE, OUTPUT, ROOT, build


def test_complete_original_and_offline_rebuild():
  evidence = json.loads(gzip.decompress(EVIDENCE.read_bytes()))
  archive = ROOT / evidence["lod2"]["path"]
  assert hashlib.sha256(archive.read_bytes()).hexdigest() == evidence["lod2"]["sha256"]
  original = part_profile(extract_parent(archive, "DEBE00YYT600005H"))
  assert evidence["original"] == original
  assert len(original["surfaces"]) == 8
  assert original["height_m"] == 20.646
  data = json.loads(OUTPUT.read_bytes())
  assert data == build()
  assert data["ring"] == original["ring"]
  assert data["groundY"] == original["ground_y_m"]
  assert abs(data["ridgeY"] - data["groundY"] - 3.25) < 1e-9
  assert evidence["alkis"]["function"] == "51009_1610"
  assert evidence["osm"]["attributes"]["id"] == "317399384"
  # Surface observations are retained as trees, never quietly labelled roof survey.
  assert len(evidence["bdom"]) == 9
  heights = [
    float(s["response"]["features"][0]["properties"]["Höhenangabe_in_Meter_über_NHN"])
    for s in evidence["bdom"]
  ]
  assert min(heights) == 39.89 and max(heights) == 52.20


def test_only_exact_existing_source_prism_and_native_columns_are_receipted():
  data = json.loads(OUTPUT.read_bytes())
  for source in data["inputs"]:
    assert (
      hashlib.sha256((ROOT / source["path"]).read_bytes()).hexdigest()
      == source["sha256"]
    )
  prisms = json.loads((ROOT / data["inputs"][0]["path"]).read_bytes())["buildings"]
  assert [p for p in prisms if p["id"] == "T600005H"] == data["previousPrisms"]
  assert data["neighbours"] == []
  assert len(data["columns"]) == 3
  voxel = json.loads((ROOT / data["inputs"][1]["path"]).read_bytes())
  for x, z, low, high, kind in data["columns"]:
    rows = voxel["building_rows"][z - voxel["grid"]["min_z_idx"]]
    assert any(
      voxel["grid"]["min_x_idx"] + start
      <= x
      < voxel["grid"]["min_x_idx"] + start + count
      and [lo, hi, c] == [low, high, kind]
      for start, count, lo, hi, c in rows
    )


def test_low_open_centre_in_both_independent_geometry_families():
  data = json.loads(OUTPUT.read_bytes())
  centre = Polygon(data["ring"]).centroid
  assert not any(Polygon(w["ring"]).covers(centre) for w in data["walls"])
  assert not any(
    box(x - 0.125, z - 0.125, x + 0.125, z + 0.125).covers(centre)
    for x, z in data["nativeWalls"]
  )
  assert len(data["roofs"]) == 4
  assert max(v[1] for t in data["roofs"] for v in t) == data["ridgeY"]
  assert all(h <= 0.25 for _, _, _, _, h, _, _, _ in data["nativeBoxes"] if h != 2.3)
  assert (
    max(y + h / 2 for _, y, _, _, h, _, _, _ in data["nativeBoxes"])
    <= data["ridgeY"] + 0.25
  )
  # West gable approach reaches the centre without crossing a wall, unlike the
  # previous solid twenty-metre prism. The original ground remains unchanged.
  b, c = data["ring"][1:3]
  entry = Point((b[0] + c[0]) / 2, (b[1] + c[1]) / 2)
  for k in range(21):
    point = Point(
      entry.x + (centre.x - entry.x) * k / 20, entry.y + (centre.y - entry.y) * k / 20
    )
    assert not any(Polygon(w["ring"]).covers(point) for w in data["walls"])
    assert not any(
      box(x - 0.125, z - 0.125, x + 0.125, z + 0.125).covers(point)
      for x, z in data["nativeWalls"]
    )
