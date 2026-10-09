"""Exact roof storage, with retained inputs and reproducible source packing."""

import base64
import gzip
import hashlib
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"


def test_all_roof_coordinates_are_exact_ieee_doubles() -> None:
  packed = json.loads((DATA / "altMitteRoofStorageV198.json").read_text())
  raw = gzip.decompress(base64.b64decode(packed["gzip"]))
  expected = bytearray()
  for source in packed["sources"]:
    data = (DATA / source["path"]).read_bytes()
    assert hashlib.sha256(data).hexdigest() == source["sha256"]
    for triangle in json.loads(data):
      for vertex in triangle:
        expected.extend(struct.pack("<3d", *vertex))
  assert raw == expected
  assert len(raw) == packed["bytes"] == packed["triangles"] * 72
  assert hashlib.sha256(raw).hexdigest() == packed["sha256"]
  assert packed["triangles"] == 75_029


def test_roof_packing_is_reproducible_without_touching_source(
  monkeypatch, tmp_path
) -> None:
  from scripts import pack_navigation_roofs_v198 as build

  monkeypatch.setattr(build, "DATA", tmp_path)
  inputs = []
  for path in build.INPUTS:
    copy = tmp_path / path.relative_to(DATA)
    copy.parent.mkdir(parents=True, exist_ok=True)
    copy.write_bytes(path.read_bytes())
    inputs.append(copy)
  monkeypatch.setattr(build, "INPUTS", inputs)
  build.build()
  assert (tmp_path / "altMitteRoofStorageV198.json").read_bytes() == (
    DATA / "altMitteRoofStorageV198.json"
  ).read_bytes()
