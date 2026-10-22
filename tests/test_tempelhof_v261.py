"""Step 10: retained metric entrance and documented Airlift Memorial envelope."""

import hashlib
import json
import math
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_tempelhof_v261 as model  # noqa: E402

SOURCE = json.loads(model.SOURCE.read_text())
DATA = json.loads(model.OUTPUT.read_text())


def test_source_wall_is_exact_and_complete_older_airport_source_is_unchanged() -> None:
  old_path = ROOT / "geo_data/regierungsviertel" / SOURCE["previousSource"]
  assert (
    hashlib.sha256(old_path.read_bytes()).hexdigest() == SOURCE["previousSourceSha256"]
  )
  old = json.loads(old_path.read_text())
  owner = next(p for p in old["parents"] if p["id"] == SOURCE["sourceOwner"])
  front = next(s for s in owner["surfaces"] if s["id"] == SOURCE["front"]["id"])
  assert front == SOURCE["front"] == DATA["front"]
  entrance_owner = next(p for p in old["parents"] if p["id"] == SOURCE["entranceOwner"])
  entrance = next(
    s for s in entrance_owner["surfaces"] if s["id"] == SOURCE["entranceFront"]["id"]
  )
  assert entrance == SOURCE["entranceFront"] == DATA["entranceFront"]
  assert sum(len(p["surfaces"]) for p in old["parents"]) == 2044
  assert DATA == model.build()
  assert DATA["sourceSha256"] == hashlib.sha256(model.SOURCE.read_bytes()).hexdigest()


def test_memorial_uses_inventory_dimensions_and_three_separated_westward_tips() -> None:
  points = [v for t in DATA["triangles"] for v in t[1:]]
  spans = [max(p[i] for p in points) - min(p[i] for p in points) for i in range(3)]
  assert spans[1] == pytest.approx(20)
  # Inventory gives 7 m breadth and 6 m depth; bronze projects a few mm.
  assert spans[0] == pytest.approx(6, abs=0.03)
  assert spans[2] == pytest.approx(7, abs=0.03)
  ax, ground, az = DATA["monument"]["anchor"]
  tips = [p for p in points if p[1] == ground + 20]
  assert tips and max(p[0] for p in tips) < ax - 3
  ranges = [(-3.5, -2.8), (-0.35, 0.35), (2.8, 3.5)]
  assert all(
    any(lo - 1e-5 <= p[2] - az <= hi + 1e-5 for lo, hi in ranges) for p in tips
  )
  assert all(
    any(lo - 1e-5 <= p[2] - az <= hi + 1e-5 for p in tips) for lo, hi in ranges
  )
  assert DATA["monument"]["baseHeightM"] == 0.42
  assert DATA["monument"]["bronzeBandHeightM"] == 0.32
  assert DATA["monument"]["osmId"] == "node/27431777"
  assert "not a survey" in DATA["status"]


def test_native_geometry_is_bounded_orthogonal_and_preserves_two_air_gaps() -> None:
  blocks = DATA["blocks"]
  assert len(blocks) < 150
  assert all(
    len(b) == 7 and all(math.isfinite(n) for n in b) and min(b[3:6]) > 0 for b in blocks
  )
  ax, ground, az = DATA["monument"]["anchor"]
  assert min(b[1] - b[4] / 2 for b in blocks) == pytest.approx(ground, abs=1e-5)
  assert max(b[1] + b[4] / 2 for b in blocks) == pytest.approx(ground + 20, abs=1e-5)
  top = [b for b in blocks if b[1] + b[4] / 2 > ground + 19.99]
  assert len(top) == 3 and max(b[0] for b in top) < ax - 3
  assert all(
    not any(abs(az + gap - b[2]) <= b[5] / 2 for b in top) for gap in [-1.5, 1.5]
  )
  assert model.OUTPUT.stat().st_size < 150_000


def test_geometry_has_no_degenerate_faces_or_external_runtime_media() -> None:
  for _, a, b, c in DATA["triangles"]:
    u, v = [b[i] - a[i] for i in range(3)], [c[i] - a[i] for i in range(3)]
    cross = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ]
    assert sum(n * n for n in cross) > 1e-14
  urls = {s["url"] for s in SOURCE["sources"]}
  assert any("09055091" in u for u in urls)
  assert any("bildhauerei-in-berlin" in u for u in urls)
  assert "CC BY 4.0" in json.dumps(SOURCE)
  assert "https://" not in model.OUTPUT.read_text()
