"""Verify the additive terrace complement against the retained source geometry."""

import hashlib
import json
import math
from pathlib import Path

import geopandas as gpd
import pytest
from shapely.affinity import affine_transform
from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parents[1]
OSM = ROOT / "geo_data/regierungsviertel/osm.gpkg"
DATA = ROOT / "src/app/src/data"


def test_terrace_addition_is_only_the_exact_connected_source_complement() -> None:
  saved = json.loads((DATA / "nationalgalerieApronV221Source.json").read_text())
  gallery = json.loads((DATA / "neueNationalgalerieV183Source.json").read_text())
  terrace = next(part for part in gallery["parts"] if part["id"] == "MSMgX8rD")
  old_ring = [[x / 10, z / 10] for x, z in terrace["ring"]]
  assert saved["subtractedRingXZ"] == old_ring
  assert saved["sourceFileSha256"] == hashlib.sha256(OSM.read_bytes()).hexdigest()
  roads = gpd.read_file(
    OSM, layer="roads", where="element = 'relation' AND id = '21583'"
  ).to_crs(25833)
  assert len(roads) == 1
  world = affine_transform(roads.geometry.iloc[0], [1, 0, 0, -1, -389500, 5820000])
  full = saved["fullPavingPolygonXZ"]
  retained = Polygon(full["ring"], full["holes"])
  assert retained.symmetric_difference(world).area < 1e-7
  assert retained.hausdorff_distance(world) < 1e-7
  assert len(retained.interiors) == 1

  poi = gpd.read_file(
    OSM, layer="pois", where="element = 'node' AND id = '1881346251'"
  ).to_crs(25833)
  assert len(poi) == 1
  moore = affine_transform(poi.geometry.iloc[0], [1, 0, 0, -1, -389500, 5820000])
  assert moore.x == pytest.approx(-241.7248615444405, abs=1e-8)
  assert moore.y == pytest.approx(1290.5216721436009, abs=1e-8)
  old = Polygon(old_ring)
  assert not old.covers(moore)
  assert world.covers(moore)
  complement = world.difference(old)
  components = list(complement.geoms)
  chosen = [part for part in components if part.covers(moore)]
  assert len(chosen) == 1
  addition = Polygon(saved["ringXZ"], saved["holesXZ"])
  assert addition.symmetric_difference(chosen[0]).area < 1e-7
  assert addition.hausdorff_distance(chosen[0]) < 1e-7
  assert addition.intersection(old).area < 1e-8
  assert addition.area == pytest.approx(2792.130814231289, abs=1e-6)
  assert all(part.area < 1 for part in components if not part.covers(moore))
  assert saved["groundY"] == terrace["y0_dm"] / 10 == 5.2
  assert saved["terraceTopY"] == (terrace["y0_dm"] + terrace["h_dm"]) / 10 == 9.8

  c, s = math.cos(math.radians(-19.58)), math.sin(math.radians(-19.58))
  cx, cz = gallery["centerXZ"]
  stairs = Polygon(
    [
      [cx + c * x + s * z, cz - s * x + c * z]
      for x, z in [(-15, 54), (15, 54), (15, 61.59), (-15, 61.59)]
    ]
  )
  assert addition.intersection(stairs).area == 0
  assert addition.distance(stairs) > 20
