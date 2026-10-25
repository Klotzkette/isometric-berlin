"""Source and preservation checks for the requested north Alexander facades."""

import hashlib
import json
from pathlib import Path

from shapely.geometry import Polygon, box

from scripts.build_alexander_north_v272 import build, digest

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data/alexanderNorthV272.json"


def test_exact_measured_wall_receipts_and_reproducibility() -> None:
  data = json.loads(DATA.read_text())
  assert build() == data
  raw = (ROOT / data["sourcePath"]).read_bytes()
  assert hashlib.sha256(raw).hexdigest() == data["sourceSha256"]
  evidence = json.loads(raw)
  assert data["sourcePartCount"] == len(evidence["parts"]) == 107
  parts = {p["id"]: p for p in evidence["parts"]}
  for face in data["faces"]:
    part = parts[face["part"]]
    surface = part["surfaces"][face["surface"]]
    assert face["surfaceSha256"] == digest(surface)
    assert face["parent"] == part["parentId"]
    assert surface["kind"] == "WallSurface"
  assert len(data["faces"]) == 16
  assert {f["parent"] for f in data["faces"]} == {
    "DEBE01YYK00009bU",
    "DEBE01YYK00005vN",
  }


def test_each_new_fitting_stays_in_its_exact_original_wall() -> None:
  data = json.loads(DATA.read_text())
  polygons = [Polygon(f["localRings"][0], f["localRings"][1:]) for f in data["faces"]]
  roles: set[str] = set()
  for face, u, y, w, h, out, depth, colour in data["panels"]:
    assert w > 0 and h > 0 and 0 < depth <= 0.78
    assert 0 < out <= 0.92
    assert 0 <= colour <= 0xFFFFFF
    assert (
      polygons[face]
      .buffer(-0.02)
      .covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2))
    )
    roles.add(data["faces"][face]["role"])
  assert roles == {"slab", "stair", "cafe", "podium"}
  assert min(row[2] - row[4] / 2 for row in data["panels"]) > 3
  assert len(data["panels"]) < 4000


def test_sign_identity_is_separate_from_historical_newspaper_lettering() -> None:
  data = json.loads(DATA.read_text())
  assert data["crown"]["text"] == "BERLINER VERLAG"
  assert data["historicalRoofText"] == "BERLINER ZEITUNG"
  assert "historical reinstatement" in data["policy"]
  assert data["retiredSignReceipt"]["drawn"]["count"] == 150
  assert data["retiredSignReceipt"]["native"]["count"] == 595
  assert data["retiredSignReceipt"]["unrelatedDrawn"]["count"] == 214
  assert data["retiredSignReceipt"]["unrelatedNative"]["count"] == 983
  assert DATA.stat().st_size < 180_000
