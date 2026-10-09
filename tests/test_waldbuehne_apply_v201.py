"""Only exact verified post-terrain owners may be replaced."""

from __future__ import annotations

import gzip
import hashlib
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import apply_waldbuehne_packets_v201 as installer


@pytest.fixture
def staged(tmp_path, monkeypatch):
  geo, public = tmp_path / "geo", tmp_path / "public"
  geo.mkdir()
  public.mkdir()
  stage = geo / "raw/waldbuehne-v201/packets"
  stage.mkdir(parents=True)
  monkeypatch.setattr(installer, "GEO", geo)
  monkeypatch.setattr(installer, "PUBLIC", public)
  rows = []
  for name, directory in (("before", public), ("after", stage)):
    row = {"id": "bowl", "buildingCount": 23 if name == "before" else 0}
    for mode in ("drawn", "minecraft"):
      plain = json.dumps({"id": "bowl", "mesh": name}).encode()
      raw = gzip.compress(plain, mtime=0)
      asset = {
        "url": f"bowl.{mode}.gz",
        "bytes": len(raw),
        "decodedBytes": len(plain),
        "sha256": hashlib.sha256(raw).hexdigest(),
      }
      (directory / asset["url"]).write_bytes(raw)
      row[mode] = asset
    rows.append(row)
  manifest = {"chunks": [rows[0]], "unchanged": [1, 2, 3]}
  for path in (public / "manifest.json", geo / "outskirts-v187-manifest.json"):
    path.write_text(json.dumps(manifest))
  (geo / "waldbuehne-v201-packet-audit.json").write_text(
    json.dumps({"baselineDescriptors": [rows[0]], "replacementDescriptors": [rows[1]]})
  )
  return geo, public, stage, rows


def test_exact_transition_is_repeatable_and_preserves_other_metadata(staged):
  _, public, _, rows = staged
  installer.apply()
  installer.apply()
  assert json.loads((public / "manifest.json").read_bytes()) == {
    "chunks": [rows[1]],
    "unchanged": [1, 2, 3],
  }


def test_unrecognized_owner_descriptor_is_not_overwritten(staged):
  _, public, _, _ = staged
  path = public / "manifest.json"
  data = json.loads(path.read_bytes())
  data["chunks"][0]["buildingCount"] = 99
  path.write_text(json.dumps(data))
  with pytest.raises(AssertionError):
    installer.apply()
  assert json.loads(path.read_bytes()) == data


def test_corrupt_replacement_changes_nothing(staged):
  _, public, stage, _ = staged
  before = {p.name: p.read_bytes() for p in public.iterdir()}
  (stage / "bowl.drawn.gz").write_bytes(b"bad")
  with pytest.raises(AssertionError):
    installer.apply()
  assert {p.name: p.read_bytes() for p in public.iterdir()} == before
