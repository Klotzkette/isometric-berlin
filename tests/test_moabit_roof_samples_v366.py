import json

import numpy as np

from scripts.sample_moabit_roofs_v366 import DATA, ROOT, geometry_signature, roof_sample


def test_roof_sample_rejects_canopy_shadow_and_mixed_surfaces():
  green = np.tile([38, 91, 43], (90, 1))
  tile = np.tile([146, 86, 64], (100, 1))
  assert roof_sample(green) is None
  assert roof_sample(np.zeros((100, 3))) is None
  assert roof_sample(np.vstack([tile, 255 - tile])) is None
  assert roof_sample(np.vstack([tile, green[:8]])) == ([146, 86, 64], 100)


def test_roof_receipts_match_complete_housing_geometry_and_valid_pixels():
  samples = json.loads((DATA / "moabitRoofSamplesV366.json").read_bytes())
  proof = json.loads(
    (ROOT / "geo_data/regierungsviertel/moabit-roof-samples-v366.json").read_bytes()
  )["sampledInteriorPixels"]
  originals = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_bytes()
  )["buildings"]
  assert len(samples) > 200
  assert samples.keys() == proof.keys()
  matches = {
    p["id"]
    for p in originals
    if p["id"] in samples and geometry_signature(p) == samples[p["id"]][:2]
  }
  assert matches == samples.keys()
  assert min(proof.values()) >= 80
