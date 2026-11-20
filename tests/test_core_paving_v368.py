"""Keep the core extension reproducible from the local survey and S41 boundary."""

import base64
import gzip
import json
import sys
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

from isometric_berlin.generation.build_minecraft_voxels import to_world

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_core_paving_v368 as paving  # noqa: E402
from ring_paving_scope_v368 import scope  # noqa: E402


def test_core_edges_and_plazas_rebuild_from_the_retained_survey(tmp_path):
  paving.build(tmp_path)
  for name in (
    "innerCityPavementEdgesV368.json",
    "innerCityPlazaEdgesV368.json",
    "innerCitySquareStreetsV368.json",
  ):
    assert (tmp_path / name).read_bytes() == (paving.DATA / name).read_bytes()


def test_survey_faces_stay_inside_the_scope_and_outside_the_recorded_openings():
  data = json.loads((paving.DATA / "innerCitySquareStreetsV368.json").read_bytes())
  roles = []
  for group in data["groups"]:
    offsets = np.frombuffer(base64.b64decode(group["xz"]), "<i2").reshape(-1, 2)
    points = (offsets + np.array(group["origin"])) / 100
    index = np.frombuffer(base64.b64decode(group["index"]), "<u2").reshape(-1, 3)
    roles.append(shapely.coverage_union_all(shapely.polygons(points[index])))
  whole = unary_union(roles)
  geo = ROOT / "geo_data/regierungsviertel"
  districts = json.loads((geo / "house-districts-v233.geojson").read_bytes())[
    "features"
  ]
  allowed = unary_union(
    [
      to_world(shape(f["geometry"]))
      for f in districts
      if f["properties"]["nam"] in paving.DISTRICTS
    ]
  ).intersection(scope())
  assert whole.difference(allowed).area < 0.01
  # No duplication of overlapping survey classes or uncovered input places.
  assert sum(g.area for g in roles) - whole.area < 0.01
  assert 50_000 < whole.area < 50_200
  survey = json.loads(
    gzip.decompress((geo / "inner-city-square-streets-v368.json.gz").read_bytes())
  )
  for x, y, radius in survey["siteWindows"].values():
    west, south = x - radius, y - radius
    east, north = x + radius, y + radius
    area = to_world(
      Polygon([(west, south), (east, south), (east, north), (west, north)])
    )
    assert whole.intersection(area).area > 3_000
  for feature in survey["features"]:
    if feature["id"].startswith(
      (
        "bm_zugangsbauwerk.",
        "cc_treppe.",
        "bz_gleiskoerper_strab.",
        "bv_springbrunnen_zierbrunnen.",
      )
    ):
      assert whole.intersection(to_world(shape(feature["geom"]))).area < 0.01
