"""Retained owners, actual facade binding and bounded church reconstruction."""

import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, box

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data/schoolCultureV228.json"
EVIDENCE = ROOT / "geo_data/regierungsviertel/school-culture-v228-evidence.json"


def test_retained_inputs_and_actual_facade_binding() -> None:
  """No owner/source changed; each accent stays inside the delivered wall."""
  source = json.loads(DATA.read_text())
  evidence = json.loads(EVIDENCE.read_text())
  for path, expected in evidence["sourceHashes"].items():
    # The raw archive is non-bundled and optional in fresh checkouts.
    p = ROOT / path
    if "/raw/" in path and not p.exists():
      continue
    assert hashlib.sha256(p.read_bytes()).hexdigest() == expected
  assert {s["key"] for s in source["sites"]} == {
    "jewish-gymnasium",
    "otto-weidt-workshop",
    "sophienkirche",
    "gymnasium-steglitz",
    "gymnasium-tiergarten",
  }
  for s in source["sites"]:
    for f in evidence["faces"][s["key"]]:
      points = np.array(f["rings"][0])
      a, b = max(
        ((a, b) for a in points for b in points),
        key=lambda ab: np.linalg.norm((ab[1] - ab[0])[[0, 2]]),
      )
      d = np.array([b[0] - a[0], 0, b[2] - a[2]])
      d /= np.linalg.norm(d)
      wall = Polygon([[(p - a) @ d, p[1]] for p in points]).buffer(0.002)
      for i in f["boxes"]:
        r = s["boxes"][i]
        u = (np.array(r[:3]) - a) @ d
        assert wall.covers(
          box(u - r[3] / 2, r[1] - r[4] / 2, u + r[3] / 2, r[1] + r[4] / 2)
        )
        assert r[5] <= 0.25
  assert DATA.stat().st_size < 330_000


def test_sophien_tower_stays_on_church_and_at_documented_height() -> None:
  """New tower occupies existing solid ground, leaving neighbouring paths open."""
  source = json.loads(DATA.read_text())
  s = next(x for x in source["sites"] if x["key"] == "sophienkirche")
  old = json.loads((ROOT / "src/app/src/data/mitteHeritageV166Source.json").read_text())
  part = next(p for p in old["parts"] if p["parentId"] == "DEBE01YYK0000080")
  # Stored parent-ring orientation remains unchanged.
  ring = part.get("ring")
  if ring is None:
    raise AssertionError("Missing retained church footprint")
  assert Polygon(ring).buffer(0.05).covers(Polygon(s["recognition"]["towerFootprint"]))
  assert s["recognition"]["towerHeightM"] == 69
  top = max(max(p[1] for p in r["ring"]) for r in s["sheets"])
  assert 72 < top <= 74.2
  assert len(s["nativeRows"]) < 5000


def test_letters_read_left_to_right_from_outside() -> None:
  """Exterior viewers see the normal-facing side of each lettering plane."""
  source = json.loads(DATA.read_text())
  labels = [label for s in source["sites"] for label in s["labels"]]
  assert len(labels) == 2
  for label in labels:
    # Right crossed with up must face the viewer, not into the source wall.
    assert np.dot(np.cross(label["direction"], [0, 1, 0]), label["normal"]) > 0.999
