"""Exact-source preservation and deterministic narrow Alexander facade anchors."""

import gzip
import json
import math

from shapely.geometry import Polygon, box

from scripts.build_alexander_recognition_v257 import ROOT, SELECTION, build, digest


def test_deterministic_original_owners_and_all_selected_wall_sheets():
  source = build()
  assert (
    json.loads((ROOT / "src/app/src/data/alexanderRecognitionV257.json").read_text())
    == source
  )
  for key, site in source["sites"].items():
    original = next(
      b
      for b in json.loads(gzip.decompress((ROOT / site["sourcePath"]).read_bytes()))[
        "buildings"
      ]
      if b["id"] == site["parent"]
    )
    assert digest(original) == site["buildingSha256"]
    assert len(original["parts"]) == site["partCount"]
    assert original["osmTags"]["osm_way_id"] == site["osmWay"]
    assert len(site["faces"]) == sum(map(len, SELECTION[key].values()))
    for face in site["faces"]:
      part = next(p for p in original["parts"] if p["id"] == face["part"])
      wall = part["surfaces"][face["index"]]
      assert digest(wall) == face["surfaceSha256"]
      assert wall["kind"] == "WallSurface"
      for endpoint in [face["a"], face["b"]]:
        assert any([p[0], p[2]] == endpoint for p in wall["rings"][0])
      # Every actual podium fitting, including its thin upper cornice,
      # stays inside the source wall; no new facade bridges an opening.
      if face["part"] == "DEBE3DxF6b2v0Ekh":
        a, b = face["a"], face["b"]
        length = math.dist(a, b)
        d = [(b[0] - a[0]) / length, (b[1] - a[1]) / length]
        wall_polygon = Polygon(
          [
            ((p[0] - a[0]) * d[0] + (p[2] - a[1]) * d[1], p[1])
            for p in wall["rings"][0]
          ]
        )
        assert wall_polygon.buffer(0.001).covers(box(0.02, 5.6, length - 0.02, 16.375))
  assert source["sites"]["cubix"]["partCount"] == 5
  assert source["sites"]["rathauspassagen"]["partCount"] == 18


def test_small_additive_runtime_source_does_not_bundle_duplicate_shells():
  path = ROOT / "src/app/src/data/alexanderRecognitionV257.json"
  assert path.stat().st_size < 8_000
  source = build()
  assert len(source["sites"]["cubix"]["faces"]) == 8
  assert len(source["sites"]["rathauspassagen"]["faces"]) == 14
  assert all(
    "surfaces" not in site and "buildings" not in site
    for site in source["sites"].values()
  )
