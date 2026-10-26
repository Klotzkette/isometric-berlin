"""Source completeness, bounded ownership and actual independent native geometry."""

import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon
from shapely.ops import unary_union

from scripts.build_opera_theatres_ownership_v274 import build
from scripts.build_theatres_v272 import digest

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"


def source():
  return json.loads(
    gzip.decompress((GEO / "opera-theatres-v274-source.json.gz").read_bytes())
  )


def test_complete_source_leaves_and_datum_retained():
  p = source()
  assert len(p["parents"]) == 9 and len(p["parts"]) == 71
  assert len({q["id"] for q in p["parts"]}) == 71
  for parent in p["parents"]:
    assert digest(parent["sourceParts"]) == parent["sourceSha256"]
    offset = 30 - parent["groundNHN"] + parent["groundY"]
    for part in parent["sourceParts"]:
      output = next(q for q in p["parts"] if q["id"] == part["id"])
      assert output["polygons"] == [dict(ring=part["ring"], holes=part["holes"])]
      assert output["topY"] == round(part["top_y_m"] + offset, 3)
      actual = [q for q in p["surfaces"] if q["partId"] == part["id"]]
      assert len(actual) == len(part["surfaces"])
      for s, t in zip(part["surfaces"], actual, strict=True):
        assert t["kind"] == s["kind"]
        assert t["rings"] == [
          [[x, round(y + offset, 3), z] for x, y, z in r] for r in s["rings"]
        ]
        assert t["triangles"]
  assert max(q["topY"] for q in p["parts"] if q["parentId"] == "DEBE04YY500004Vq") > 42


def test_exact_previous_owner_replay_and_neighbours_stay():
  expected = json.loads((DATA / "operaTheatresV274Ownership.json").read_bytes())
  assert build() == expected
  assert len(expected["records"]) == 6
  assert sum(len(r["triangles"]) for r in expected["records"]) == 1220
  assert sum(len(r["segments"]) for r in expected["lineRecords"]) == 100
  assert {r["owner"] for r in expected["records"]} == {
    "DEBE04YY500002EM",
    "DEBE04YY50002cf0",
  }
  p = source()
  assert {o["id"] for o in p["legacyPrisms"]} == {
    "49449348",
    "67502908",
    "74917641",
    "49449351",
    "49449350",
    "23471381",
  }
  feet = unary_union(
    [
      Polygon(q["ring"], q["holes"]).buffer(0)
      for f in p["parents"]
      if f["name"] == "Schillertheater"
      for q in f["sourceParts"]
    ]
  )
  for o in p["legacyPrisms"]:
    foot = Polygon(
      [[x / 10, z / 10] for x, z in o["ring"]],
      [[[x / 10, z / 10] for x, z in h] for h in o["holes"]],
    )
    assert feet.intersection(foot).area / foot.area > 0.94
  # The small overlap with this unrelated neighbour never claims its ownership.
  assert "49449347" not in {o["id"] for o in p["legacyPrisms"]}


def test_prior_measured_edges_and_authored_details_preserved():
  p = json.loads((GEO / "opera-theatres-v274-evidence.json").read_bytes())
  for name, sha in p["preservedFiles"].items():
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == sha
  owner = json.loads((DATA / "operaTheatresV274Ownership.json").read_bytes())
  prior = json.loads((DATA / "cityRecognitionV182.json").read_bytes())
  assert len(owner["previousBoxes"]) == 30 and len(owner["previousSegments"]) == 60
  for index, row in owner["previousSegments"]:
    assert row == prior["segments"][index]
    assert row[6] == 0xBDC5BF  # Estimated window sills; no measured source ink.
  for index, row in owner["previousBoxes"]:
    assert row == prior["boxes"][index]


def test_native_shell_is_surface_only_and_fittings_clear_replacement_shell():
  p = source()
  cells = np.asarray(p["nativeBlocks"], dtype=object)
  assert len(cells) == 15984
  assert all(r[3:7] == [2, 2, 2, 0] for r in p["nativeBlocks"])
  assert len({tuple(r[:3]) for r in p["nativeBlocks"]}) == len(cells)
  cc = np.asarray([r[:6] for r in p["nativeBlocks"]], float)
  for r in p["nativeDetails"]:
    assert r[6] == 0
    if not r[8].startswith(("schiller-", "deutsche-oper-")):
      continue
    # No hidden new recognition panel or mullion inside its own measured native shell.
    center = np.array(r[:3])
    half = np.array(r[3:6]) / 2
    hit = np.all(np.abs(cc[:, :3] - center) < cc[:, 3:6] / 2 + half - 0.001, axis=1)
    assert not hit.any(), r
  runtime = json.loads((DATA / "operaTheatresV274.json").read_bytes())
  packed = np.frombuffer(base64.b64decode(runtime["nativeBoxes"]), dtype="<f4").reshape(
    -1, 8
  )
  assert np.all(packed[:, 6] == 0)
  assert np.all(np.isfinite(packed)) and np.all(packed[:, 3:6] > 0)


def test_architectural_identity_not_a_palette_only_change():
  p = source()
  roles = {r[8] for r in p["facadeBoxes"]}
  assert {
    "schiller-curved-foyer-glass",
    "deutsche-oper-east-foyer-glass",
    "deutsche-oper-concrete-panel-joint",
    "komische-copper-portal-return",
    "grips-spiral-tread-nosing",
    "staatsoper-entablature-dentil",
  } <= roles
  curve = [r for r in p["facadeBoxes"] if r[8] == "schiller-curved-foyer-glass"]
  assert len(curve) >= 15 and len({round(r[6], 3) for r in curve}) >= 15
  glass = [r for r in p["facadeBoxes"] if r[8] == "deutsche-oper-east-foyer-glass"]
  assert len(glass) == 1 and -4269 < glass[0][0] < -4264
  assert all(r[2] < 669 for r in glass)
  assert {q["text"] for q in p["labels"]} == {"SCHILLERTHEATER", "DEUTSCHE OPER BERLIN"}
