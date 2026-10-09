"""Source feet, no broad clearance, and independent one-metre seat coverage."""

import gzip
import json
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from build_waldbuehne_v201 import DATA, GEO, PROXIES, SEATS, source


def test_source_complete_original_sheets_and_real_stage_identity():
  s = source()
  assert {o["id"] for o in s["owners"]} == PROXIES - {"OSM-way-767528490"}
  assert s["tentOSM"]["properties"]["other_tags"] == '"description"=>"Bühne"'
  assert (
    sum(len(p["surfaces"]) for o in s["owners"] if o["id"] in SEATS for p in o["parts"])
    == 358
  )
  draw = json.loads((DATA / "waldbuehneV201.json").read_bytes())
  vertices = {
    tuple(p) for p in np.asarray(draw["sites"][0]["positions"]).reshape(-1, 3)
  }
  for o in s["owners"]:
    if o["id"] not in SEATS:
      continue
    for p in o["parts"]:
      for f in p["surfaces"]:
        for r in f["rings"]:
          assert all(tuple(v) in vertices for v in r)


def test_ground_mask_is_exact_source_footprint_and_native_rendered_cells():
  s = source()
  m = json.loads((GEO / "waldbuehne-v201-ground-masks.json").read_bytes())
  nav = json.loads((DATA / "waldbuehneV201Navigation.json").read_bytes())
  precise = unary_union(
    [
      Polygon(p["ring"], p["holes"])
      for o in s["owners"]
      if o["id"] in SEATS
      for p in o["parts"]
    ]
  )
  assert precise.symmetric_difference(shape(m["seatingDrawn"])).area < 1e-8
  assert (
    shape(m["drawn"]).symmetric_difference(precise.union(shape(m["stageDrawn"]))).area
    < 1e-8
  )
  native = unary_union([box(x, z, x + 1, z + 1) for x, z, y in nav["nativeFloors"]])
  assert native.symmetric_difference(shape(m["minecraft"])).area < 1e-8
  assert shape(m["drawn"]).area < 5200 and native.area < 5000


def test_separate_transition_retains_prior_checkpoint_and_only23_named_proxies():
  r = json.loads((GEO / "waldbuehne-v201-packet-audit.json").read_bytes())
  assert set(r["sourceOwners"]) == PROXIES
  assert len(r["baselineDescriptors"]) == len(r["replacementDescriptors"]) == 2
  checkpoint = json.loads(gzip.decompress((GEO / r["checkpoint"]["url"]).read_bytes()))
  assert len(checkpoint) == 4
  for p in r["packets"]:
    for mode, a in p["modes"].items():
      assert {b["sourceId"] for b in a["removedNav"]} <= PROXIES
      assert a["newDescriptor"]["bytes"] < 650000
      assert a["newDescriptor"]["decodedBytes"] < 2600000
