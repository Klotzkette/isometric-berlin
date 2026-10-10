"""Independent source retention and bounded Wedding additions."""

import json
from collections import Counter
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
SRC = json.loads((GEO / "wedding-sites-v210-source.json").read_bytes())
AUDIT = json.loads((GEO / "wedding-sites-v210-evidence.json").read_bytes())
DETAIL = json.loads((ROOT / "src/app/src/data/weddingSitesV210.json").read_bytes())
ENV = json.loads(
  (ROOT / "src/app/src/data/weddingSitesV210Envelopes.json").read_bytes()
)


def test_all_complete_source_owners_still_have_unchanged_core_prisms():
  prisms = {
    p["id"]: p
    for p in json.loads(
      (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_bytes()
    )["buildings"]
  }
  assert Counter(o["site"] for o in SRC["owners"]) == {"bayer": 83, "erika": 3}
  assert sum(len(o["parts"]) for o in SRC["owners"]) == 217
  assert sum(len(p["surfaces"]) for o in SRC["owners"] for p in o["parts"]) == 2390
  for owner in SRC["owners"]:
    for p in owner["parts"]:
      assert prisms[p["id"][-8:]] == p["prism"]
      assert (
        abs(p["ground_y_m"] + p["displayOffsetY"] - p["prism"]["y0_dm"] / 10) < 1e-10
      )
  assert AUDIT["oldPrismsChanged"] == AUDIT["newScopeArea"] == 0


def test_exact_existing_irregular_campus_not_an_invented_rectangle():
  campus = shape(SRC["sites"]["6255291"]["geometry"])
  assert abs(campus.area - 144148.364277) < 1e-4
  assert campus.area < box(*campus.bounds).area * 0.6
  from shapely.ops import transform

  from isometric_berlin.data.fetch_lod2 import load_bounds_polygon, project_to_berlin

  bounds = project_to_berlin(load_bounds_polygon(GEO / "bounds-v158.geojson"))
  for site in SRC["sites"].values():
    footprint = transform(
      lambda x, z: (x + 389500, 5820000 - z), shape(site["geometry"])
    )
    assert footprint.intersection(bounds).area / footprint.area > 1 - 1e-9
  # All three exact retained site shapes are already inside the core; source
  # envelope and no new ground/scope records accompany this additive work.
  assert SRC["metadata"]["coreCoverageFraction"] == 1
  assert "ground" not in ENV
  assert len(SRC["owners"]) == 86


def test_hall_additions_cover_complete_original_ring_and_sample_datum():
  owner = next(o for o in SRC["owners"] if o["id"] == "DEBE01YYK0003xSI")
  p = owner["parts"][0]
  fp = Polygon(p["ring"], p["holes"])
  assert shape(ENV["volumes"][0]["geometry"]).equals(fp)
  assert fp.buffer(1e-8).covers(shape(ENV["volumes"][1]["geometry"]))
  assert AUDIT["roofY"] == 13.96 and AUDIT["annexY"] == 10.31
  assert AUDIT["sourceToCoreOffsetY"] == 0.6
  assert len(AUDIT["pylons"]) == 5
  for s in ENV["surfaces"]:
    for t in s["triangles"]:
      for x, y, z in t:
        assert fp.buffer(1e-7).covers(Point(x, z))
  assert Counter(r[12] for r in DETAIL["boxes"])["five concrete V-pylons"] == 10


def test_every_bayer_window_fits_its_original_wall_sheet_with_sibling_cores_retained():
  for aperture in AUDIT["apertures"]:
    f = AUDIT["faces"][aperture["face"]]
    a = np.array(f["origin"])
    d = np.array(f["direction"])
    rings = [
      [(float(np.dot(np.subtract(p, a), d)), p[1]) for p in ring] for ring in f["rings"]
    ]
    polygon = Polygon(rings[0], rings[1:])
    u, y, w, h = [aperture[k] for k in ["u", "y", "w", "h"]]
    assert polygon.buffer(1e-5).covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2))
    assert f["part"] not in {"DEBE3DCnWJbGuzoD", "DEBE3DuXNzx7SIbu", "DEBE3DnGHghdmSFX"}


def test_mapped_public_perimeter_and_gate_gaps_are_source_bound():
  campus = shape(SRC["sites"]["6255291"]["geometry"])
  features = {i["id"]: i for i in SRC["perimeter"]}
  gates = unary_union(
    [
      shape(i["geometry"]).buffer(float(i["tags"].get("width", 3)) / 2)
      for i in SRC["perimeter"]
      if i["tags"]["barrier"] == "gate"
    ]
  )
  from shapely.geometry import LineString

  for barrier in ENV["barriers"]:
    line = LineString(barrier["points"])
    source = shape(features[barrier["id"]]["geometry"])
    assert source.buffer(1e-7).covers(line)
    assert campus.boundary.buffer(2.000001).covers(line)
    assert line.intersection(gates.buffer(-1e-5)).length < 1e-7
  assert ENV["barriers"]


def test_strict_finite_json_and_independent_native_roles():
  def fail(x):
    raise ValueError(x)

  for path in [
    GEO / "wedding-sites-v210-source.json",
    GEO / "wedding-sites-v210-evidence.json",
    ROOT / "src/app/src/data/weddingSitesV210.json",
    ROOT / "src/app/src/data/weddingSitesV210Envelopes.json",
  ]:
    json.loads(path.read_bytes(), parse_constant=fail)
  assert {r[12] for r in DETAIL["boxes"]} == {r[8] for r in DETAIL["blocks"]}
  assert all(all(v > 0 for v in r[3:6]) for r in DETAIL["blocks"] + ENV["blocks"])
  assert AUDIT["nativeBytes"] < 3 * 1024**2


def test_every_original_lod2_sheet_and_hole_matches_the_retained_official_archives():
  import hashlib
  import xml.etree.ElementTree as ET
  import zipfile

  from isometric_berlin.data.fetch_lod2 import GML_ID, NS, leaf_building_parts
  from scripts.build_bebelplatz_building_source import part_profile

  targets = {o["id"]: o for o in SRC["owners"]}
  seen = set()
  for path in [
    GEO / "raw/wedding-v210/LoD2_388_5822.zip",
    GEO / "raw/lod2/LoD2_389_5822.zip",
  ]:
    if not path.exists():
      import pytest

      pytest.skip(
        "Optional official archives absent; committed source receipt remains available"
      )
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    with zipfile.ZipFile(path) as z:
      for member in z.namelist():
        if not member.lower().endswith((".gml", ".xml")):
          continue
        with z.open(member) as stream:
          for _, p in ET.iterparse(stream, events=("end",)):
            if p.tag != f"{{{NS['bldg']}}}Building":
              continue
            identity = p.get(GML_ID)
            if identity in targets:
              owner = targets[identity]
              expected = [
                {k: v for k, v in part.items() if k not in ["prism", "displayOffsetY"]}
                for part in owner["parts"]
              ]
              assert expected == [
                part_profile(part) for part in leaf_building_parts(p) or [p]
              ]
              assert owner["sha256"] == digest
              seen.add(identity)
            p.clear()
  assert seen == set(targets)
