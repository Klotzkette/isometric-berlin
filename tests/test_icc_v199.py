"""Complete measured ICC ownership, independent representations and tight budgets."""

import gzip
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"


def read(path):
  return json.loads(
    gzip.decompress(path.read_bytes()) if path.suffix == ".gz" else path.read_bytes()
  )


def test_every_measured_surface_is_transferred_without_reduction():
  source = read(GEO / "icc-v199-source.json.gz")
  receipt = read(GEO / "icc-v199-surface-receipt.json.gz")["surfaces"]
  nav = read(DATA / "iccV199Navigation.json")["buildings"]
  assert len(nav) == 50
  assert len(receipt) == 671
  assert len({(r["owner"], r["part"], r["surface"]) for r in receipt}) == 671
  lookup = {(r["owner"], r["part"], r["surface"]): r for r in receipt}
  for owner in source["owners"]:
    dy = 3.55 - min(p["ground_y_m"] for p in owner["parts"])
    for part in owner["parts"]:
      for i, s in enumerate(part["surfaces"]):
        result = lookup[owner["id"], part["id"], i]
        assert result["kind"] == s["kind"]
        for a, b in zip(s["rings"], result["rings"], strict=True):
          assert len(a) == len(b)
          for p, q in zip(a, b, strict=True):
            assert p[0] == q[0] and p[2] == q[2]
            assert abs(p[1] + dy - q[1]) < 0.00051


def test_render_payloads_are_finite_complete_and_bounded():
  drawn = read(DATA / "iccV199.json")["sites"]
  native = read(DATA / "iccV199Native.json")["sites"]
  assert [s["key"] for s in drawn] == [s["key"] for s in native]
  assert len(drawn) == 3
  for s in drawn:
    assert len(s["positions"]) == len(s["colors"]) * 3
    assert max(s["indices"]) < 65536
    assert np.isfinite(s["positions"]).all()
    assert len(s["indices"]) > 100
  assert sum(len(s["boxes"]) for s in native) < 30000
  for s in native:
    assert not s["positions"] and not s["rods"] and not s["indices"]
    a = np.asarray(s["boxes"])
    assert np.isfinite(a).all()
    assert a.shape[1] == 7 and np.all(a[:, 3:6] > 0)
    assert np.all(a[:, 3:6] % 1 == 0)
  assert (DATA / "iccV199.json").stat().st_size < 3 * 1024 * 1024
  assert (DATA / "iccV199Native.json").stat().st_size < 3 * 1024 * 1024
