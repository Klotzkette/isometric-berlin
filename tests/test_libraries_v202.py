"""Independent preservation and placement checks for the bounded library overlay."""

import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "src/app/src/data/librariesV202.json").read_text())
EVIDENCE = json.loads(
  (ROOT / "src/app/src/data/librariesV202Evidence.json").read_text()
)


def test_retained_sources_and_complete_historic_sheet_are_unchanged():
  for name, digest in EVIDENCE["retainedInputs"].items():
    path = ROOT / name
    if "/raw/" in name and not path.exists():
      continue  # Raw CityGML archives are intentionally absent in clean clones.
    assert hashlib.sha256(path.read_bytes()).hexdigest() == digest
  path = ROOT / "geo_data/regierungsviertel/alt-mitte-v169/source-390_5819-00.json.gz"
  record = next(
    r
    for r in json.loads(gzip.decompress(path.read_bytes()))["buildings"]
    if r["id"] == "DEBE01YYK00002vr"
  )
  assert EVIDENCE["sourceRecords"][0] == record
  assert len(record["parts"]) == 18
  assert len(EVIDENCE["sourceRecords"][1]["parts"]) == 56


def test_scharoun_attachment_planes_keep_individual_delivered_datums():
  for p in EVIDENCE["sourceRecords"][1]["parts"]:
    assert p["groundY"] == p["legacyPrism"]["y0_dm"] / 10
    for source, placed in zip(p["sourceSheets"], p["surfaces"], strict=True):
      for a, b in zip(source["rings"], placed["rings"], strict=True):
        for old, current in zip(a, b, strict=True):
          assert old[0] == current[0] and old[2] == current[2]
          assert abs(old[1] + p["sourceYTranslationM"] - current[1]) < 0.00001


def test_details_stay_bounded_to_their_own_building_and_leave_court_centres_open():
  shapes = {}
  for r in EVIDENCE["sourceRecords"]:
    for p in r["parts"]:
      shapes[p["id"]] = unary_union(
        [Polygon(f["ring"], f["holes"]) for f in p["footprintPolygons"]]
      )
  for r in DATA["boxes"]:
    x, y, z, _, h, _, _, _, role, _, _, oi = r
    fp = shapes[DATA["owners"][oi]["id"]]
    assert fp.distance(Point(x, z)) < (2.0 if role == 8 else 0.4)
    assert y - h / 2 > DATA["owners"][oi]["groundY"] + 0.5
  # Sample the broad historic Ehrenhof centre, both library approaches and two
  # retained interior courts. No low-level box is permitted to fill them.
  samples = [(1365, 163), (1327, 85), (1390, 122), (-190, 1290), (-185, 1320)]
  for x, z in samples:
    for r in DATA["boxes"]:
      if r[1] - r[4] / 2 > 8:
        continue
      delta = np.array([x - r[0], z - r[2]])
      c, s = np.cos(r[6]), np.sin(r[6])
      assert abs(delta @ [c, -s]) > r[3] / 2 or abs(delta @ [s, c]) > r[5] / 2


def test_no_other_city_source_is_reassigned():
  assert {o["parentId"] for o in DATA["owners"]} == {
    "DEBE01YYK00002vr",
    "DEBE01YYK0002PFp",
  }
  assert not any(k in DATA for k in ["replacements", "navigation", "suppressedIds"])
  assert len(DATA["boxes"]) == EVIDENCE["stats"]["drawnBoxes"]
  assert len(DATA["blocks"]) == EVIDENCE["stats"]["nativeBlocks"]
