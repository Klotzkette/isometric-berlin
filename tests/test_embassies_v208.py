"""Regression checks for the bounded embassy/Trade Mission facade correction."""

import hashlib
import json
from pathlib import Path

from shapely.geometry import Point, Polygon

from scripts.build_embassies_v208 import build

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data/embassiesV208.json"
RECEIPT = ROOT / "geo_data/regierungsviertel/embassies-v208-source.json"


def test_embassies_reproduce_and_preserve_all_source_sheets() -> None:
  data, evidence = build()
  assert data == json.loads(DATA.read_text())
  assert evidence == json.loads(RECEIPT.read_text())
  assert len(data["sourceIds"]) == 17
  original = ROOT / "src/app/src/unterDenLindenSource.json"
  assert (
    hashlib.sha256(original.read_bytes()).hexdigest() == evidence["priorSourceSha256"]
  )
  for file, digest in evidence["retainedHashes"].items():
    assert hashlib.sha256((ROOT / file).read_bytes()).hexdigest() == digest
  for key in ["russianEmbassy", "aeroflot"]:
    old = next(
      p for p in json.loads(original.read_text())["profiles"] if p["key"] == key
    )
    new = next(p for p in evidence["source"]["profiles"] if p["key"] == key)
    assert old == new


def test_aeroflot_twelve_axes_four_floors_and_true_reference_roles() -> None:
  data = json.loads(DATA.read_text())
  fi = data["aeroflotFrontFace"]
  rows = [r for r in data["boxes"] if r[8] == fi]
  panes = [r for r in rows if r[9] == "pane"]
  assert len(panes) == 48
  assert len({r[1] for r in panes}) == 4
  assert len({(r[0], r[2]) for r in panes}) == 12
  assert len([r for r in rows if r[9] == "lattice-upright"]) == 5
  assert len([r for r in rows if r[9] == "lattice-crossmember"]) == 23
  assert len([r for r in rows if r[9] == "roof-letter-support"]) == 5
  assert not any(r[9] in ["roof-sign-board", "court-fill"] for r in rows)


def test_native_complete_pane_extents_clear_retained_four_metre_columns() -> None:
  data, receipt = json.loads(DATA.read_text()), json.loads(RECEIPT.read_text())
  checked = 0
  for r in data["blocks"]:
    if data["faces"][r[7]]["owner"] != 16 or r[8] != "pane":
      continue
    x, y, z, w, h, d = r[:6]
    for x0, z0, x1, z1, low, high in receipt["nativeAeroflotRetainedColumns"]:
      overlap = (
        min(x + w / 2, x1) - max(x - w / 2, x0),
        min(z + d / 2, z1) - max(z - d / 2, z0),
        min(y + h / 2, high) - max(y - h / 2, low),
      )
      assert min(overlap) <= 0, (r, [x0, z0, x1, z1, low, high])
    checked += 1
  assert checked > 100
  assert receipt["maximumNativeClearanceM"] < 2.32
  ownership = json.loads(
    (ROOT / "src/app/src/data/altMitteV169Ownership.json").read_text()
  )
  assert not {p[-8:] for p in data["sourceIds"]}.intersection(ownership["prismIds"])


def test_return_apertures_stay_below_actual_eaves_and_outside_source_walls() -> None:
  data, receipt = json.loads(DATA.read_text()), json.loads(RECEIPT.read_text())
  parts = next(
    p for p in receipt["source"]["profiles"] if p["key"] == "russianEmbassy"
  )["parts"]
  count = 0
  for row in data["boxes"]:
    f = data["faces"][row[8]]
    if row[9] != "pane" or f["role"] != "embassy-return":
      continue
    x, y, z, _w, h, _d = row[:6]
    assert y + h / 2 < f["high"] - 1.0
    assert y - h / 2 > 5.2
    part = parts[f["owner"]]
    assert not Polygon(part["ring"], part["holes"]).covers(Point(x, z))
    count += 1
  assert count > 200
