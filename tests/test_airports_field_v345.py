"""Independent retained-source and geometry-complement receipts."""

import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
PACK = ROOT / "src/app/public/mesh/surrounding-berlin-v159"


def test_airport_payload_and_metric_source_are_unchanged():
  fittings = json.loads((DATA / "airportExteriorsV345.json").read_bytes())
  for path, pin in [
    (GEO / "airports-v194-source.json", fittings["sourceSha256"]),
    (DATA / "airportsV194.json", fittings["sourcePayloadSha256"]),
  ]:
    assert hashlib.sha256(path.read_bytes()).hexdigest() == pin
  assert len(fittings["hosts"]) == 263
  assert {h["owner"] for h in fittings["hosts"]} == {
    "DEBE07YY9000088X",
    "relation/13234",
    "way/24378140",
  }
  assert all(h["drawnRange"][0] < h["drawnRange"][1] for h in fittings["hosts"])
  assert all(len(b) == 7 and np.isfinite(b).all() for b in fittings["blocks"])


def test_dgm_correction_preserves_source_and_complete_outside():
  evidence = json.loads((GEO / "tempelhofer-field-v345-evidence.json").read_bytes())
  source = json.loads((DATA / "tempelhoferFieldV345.json").read_bytes())
  assert evidence["domainAreaM2"] == 38176
  assert evidence["actualDgmRangeNHN"][1] - evidence["actualDgmRangeNHN"][0] > 2
  assert evidence["localDatumNHN"] == source["datumNHN"] == 43.57
  assert min(map(min, source["offsets"])) < -0.5
  assert max(map(max, source["offsets"])) > 0.3
  for mode in ("drawn", "minecraft"):
    raw = (PACK / f"ring182-2_9.{mode}.json.gz").read_bytes()
    assert hashlib.sha256(raw).hexdigest() == evidence["sourcePackets"][mode]
    packet = json.loads(gzip.decompress(raw))
    domain = unary_union([box(a, z, b, z + 4) for z, a, b in source["runs"]])
    for building in packet["nav"]["buildings"]:
      footprint = Polygon(
        [
          (x + packet["origin"][0], z + packet["origin"][2])
          for x, z in building["ring"]
        ]
      )
      assert footprint.distance(domain) > 12
    for proof in evidence["proof"][mode]:
      mesh = packet["meshes"][proof["mesh"]]
      p = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
      p = p / 100 + packet["origin"]
      c = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
      ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      for record in proof["provenance"]:
        tri = ix[record["sourceTriangle"]]
        assert np.ptp(p[tri, 1]) < 0.002
        assert np.all(c[tri] == [51, 90, 36])
        assert abs(p[tri[0], 1] - 3.01) < 0.002
        inside = sum(r[3] for r in record["fields"])
        assert abs(record["sourceAreaM2"] - record["outsideAreaM2"] - inside) < 1e-6
    for part in source["plans"][mode]["parts"]:
      c = np.frombuffer(base64.b64decode(part["append"]["colors"]), "u1").reshape(-1, 3)
      assert np.all(c == [51, 90, 36])
