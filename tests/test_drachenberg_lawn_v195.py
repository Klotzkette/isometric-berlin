"""The additive lawn/path repair owns only the formerly missing mapped polygon."""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest
from pyproj import Transformer
from shapely.geometry import Point, Polygon, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
sys.path.insert(0, str(ROOT / "scripts"))
from build_teufelsberg_terrain_v195 import offset_at  # noqa: E402


def evidence_and_data() -> tuple[dict, dict]:
  evidence = json.loads((GEO / "drachenberg-lawn-v195-evidence.json").read_bytes())
  data = json.loads((ROOT / "src/app/src/data/drachenbergLawnV195.json").read_bytes())
  return evidence, data


def test_complete_retained_source_ring_minus_unchanged_scopes_is_the_only_patch() -> (
  None
):
  evidence, data = evidence_and_data()
  assert evidence["sourceLicense"] == "ODbL-1.0"
  assert evidence["sourceTags"]["landuse"] == "grass"
  assert data["sourceId"] == "OSM-way-15700939"
  project = Transformer.from_crs(4326, 25833, always_xy=True).transform
  scopes = []
  assert len(evidence["oldScopes"]) == 6
  for source in evidence["oldScopes"]:
    raw = (GEO / source["path"]).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == source["sha256"]
    scopes.extend(
      transform(project, shape(f["geometry"])) for f in json.loads(raw)["features"]
    )
  old = unary_union(scopes)
  source = shape(evidence["sourceProjectedGeoJSON"])
  assert source.area == pytest.approx(18280.9811248, abs=0.00001)
  assert (
    source.symmetric_difference(
      transform(project, shape(evidence["sourceGeoJSON"]))
    ).area
    < 0.00001
  )
  expected = source.difference(old)
  patch = shape(evidence["patchWorldGeoJSON"])
  actual = transform(lambda x, z, y=None: (x + 389500, 5820000 - z), patch)
  assert actual.symmetric_difference(expected).area < 1e-7
  assert actual.intersection(old).area < 1e-7
  assert patch.area == pytest.approx(647.2579065736, abs=0.000001)
  assert evidence["patchAreaM2"] == pytest.approx(patch.area)
  # This point previously exposed paper beneath the second flier.
  assert patch.covers(Point(-8408.524, 1650.2395))
  assert not patch.covers(Point(-8395.524, 1638.2395))


def test_crossing_path_reuses_its_complete_course_and_inherited_width() -> None:
  evidence, data = evidence_and_data()
  assert data["pathSourceId"] == "OSM-way-185585685"
  assert evidence["pathTags"]["highway"] == "path"
  assert evidence["pathTags"]["surface"] == "dirt"
  assert "width" not in evidence["pathTags"]
  assert evidence["pathWidthM"] == 2.2
  assert evidence["pathWidthSource"] == "class_fallback"
  route = shape(evidence["pathProjectedGeoJSON"])
  patch = shape(evidence["patchWorldGeoJSON"])
  route = transform(lambda x, y, z=None: (x - 389500, 5820000 - y), route)
  expected = route.buffer(
    1.1, cap_style="round", join_style="round", quad_segs=3
  ).intersection(patch)
  actual = shape(evidence["pathPatchWorldGeoJSON"])
  assert expected.symmetric_difference(actual).area < 1e-7
  assert actual.area == pytest.approx(34.0040886158, abs=0.000001)
  assert actual.difference(patch).area < 1e-8
  # Both cut ends meet the old scope edge; no guessed extension or new alignment.
  assert route.intersection(patch.boundary).geom_type == "MultiPoint"
  assert len(route.intersection(patch.boundary).geoms) == 2


@pytest.mark.parametrize("mode", ["drawn", "native"])
def test_triangles_cover_only_the_exact_partition_with_matching_field_heights(
  mode: str,
) -> None:
  evidence, data = evidence_and_data()
  model = data[mode]
  vertices = np.asarray(model["positions"]) + data["origin"]
  colors = np.asarray(model["colors"])
  triangles = np.asarray(model["indices"]).reshape(-1, 3)
  assert len(vertices) == evidence["counts"][mode]["vertices"]
  assert len(triangles) == evidence["counts"][mode]["triangles"]
  patch = shape(evidence["patchWorldGeoJSON"])
  path = shape(evidence["pathPatchWorldGeoJSON"])
  tops, path_tops, risers = [], [], []
  for indices in triangles:
    points = vertices[indices]
    assert np.all(colors[indices] == colors[indices[0]])
    path_face = tuple(colors[indices[0]]) == (149, 131, 92)
    assert path_face or tuple(colors[indices[0]]) == (51, 90, 36)
    baseline = 3.12 if path_face else 3.01
    footprint = Polygon(points[:, [0, 2]])
    if footprint.area < 1e-9:
      assert mode == "native"
      assert np.ptp(points[:, 0]) < 1e-8 or np.ptp(points[:, 2]) < 1e-8
      risers.append(points)
      continue
    tops.append(footprint)
    if path_face:
      path_tops.append(footprint)
    x, y, z = points.mean(axis=0)
    assert y == pytest.approx(baseline + offset_at(x, z, mode == "native"), abs=1e-7)
    if mode == "native":
      assert np.ptp(points[:, 1]) < 1e-8
    else:
      for px, py, pz in points:
        assert py == pytest.approx(baseline + offset_at(px, pz), abs=1e-7)
  combined = unary_union(tops)
  assert combined.symmetric_difference(patch).area < 1e-6
  assert sum(p.area for p in tops) == pytest.approx(patch.area, abs=1e-6)
  assert unary_union(path_tops).symmetric_difference(path).area < 1e-6
  assert not risers if mode == "drawn" else len(risers) > 0


def test_data_and_field_are_hash_bound_without_changing_old_sources() -> None:
  evidence, _ = evidence_and_data()
  for key, path in [
    ("fieldSha256", ROOT / "src/app/src/data/teufelsbergTerrainV195.json"),
    ("dataSha256", ROOT / "src/app/src/data/drachenbergLawnV195.json"),
  ]:
    assert hashlib.sha256(path.read_bytes()).hexdigest() == evidence[key]
  cache = ROOT / evidence["sourceCache"]
  if cache.exists():
    assert (
      hashlib.sha256(cache.read_bytes()).hexdigest() == evidence["sourceCacheSha256"]
    )


def test_runtime_factory_is_bounded_static_and_navigation_matches_visible_tops() -> (
  None
):
  code = """
import {createDrachenbergLawnV195,drachenbergLawnGroundAtV195 as ground} from './src/DrachenbergLawnV195';
import {Mesh} from 'three';
const results=[];
for(const native of [false,true]){
  const root=createDrachenbergLawnV195(native);let bytes=0,faces=0;
  root.updateMatrixWorld(true);
  root.traverse(o=>{
    if(o.matrixAutoUpdate)throw Error('mutable transform');
    if(!(o instanceof Mesh))return;
    const g=o.geometry,p=g.getAttribute('position'),idx=g.getIndex();
    if(g.getAttribute('uv')||!g.boundingBox||!g.boundingSphere)throw Error('bounds/textures');
    for(const a of Object.values(g.attributes))bytes+=a.array.byteLength;
    bytes+=idx.array.byteLength;
    for(let i=0;i<idx.count;i+=3){
      const points=[0,1,2].map(j=>[p.getX(idx.getX(i+j))+root.position.x,p.getY(idx.getX(i+j)),p.getZ(idx.getX(i+j))+root.position.z]);
      const [a,b,c]=points,area=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
      if(Math.abs(area)<1e-7)continue;
      const centre=[0,1,2].map(axis=>points.reduce((s,p)=>s+p[axis],0)/3),height=ground(centre[0],centre[2],native);
      if(height===null||Math.abs(height-centre[1])>0.0001)throw Error('navigation mismatch '+JSON.stringify({native,centre,height}));
      faces++;
    }
  });
  if(ground(-8408.524,1650.2395,native)===null)throw Error('missing flier support');
  for(const [x,z] of [[-8395.524,1638.2395],[-8500,1600],[-8360,1700],[0,0]])if(ground(x,z,native)!==null)throw Error('scope leak');
  results.push({native,meshes:root.children.length,bytes,faces});
}
console.log(JSON.stringify(results));
"""
  run = subprocess.run(
    ["bun", "-e", code],
    cwd=ROOT / "src/app",
    check=False,
    capture_output=True,
    text=True,
  )
  assert run.returncode == 0, run.stderr
  for result in json.loads(run.stdout):
    assert result["meshes"] == 1
    assert result["bytes"] < 15_000
    assert result["faces"] > 30
