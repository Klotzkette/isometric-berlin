"""Private staging must not overwrite unrelated or unverified public geometry."""

from __future__ import annotations

import gzip
import hashlib
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import apply_amphitheatre_packets_v201 as installer


@pytest.fixture
def staged(tmp_path, monkeypatch):
  geo = tmp_path / "geo"
  public = tmp_path / "public"
  geo.mkdir()
  public.mkdir()
  monkeypatch.setattr(installer, "ROOT", tmp_path)
  monkeypatch.setattr(installer, "GEO", geo)
  monkeypatch.setattr(installer, "PUBLIC", public)

  def packet(identity, value, mode):
    plain = json.dumps({"id": identity, "geometry": value}).encode()
    raw = gzip.compress(plain, mtime=0)
    return raw, {
      "url": f"{identity}.{mode}.gz",
      "sha256": hashlib.sha256(raw).hexdigest(),
      "bytes": len(raw),
      "decodedBytes": len(plain),
    }

  chunks = []
  for identity in ("olympic", "wuhlheide", "unrelated"):
    descriptor = {"id": identity, "buildingCount": 1}
    for mode in ("drawn", "minecraft"):
      raw, asset = packet(identity, "original", mode)
      (public / asset["url"]).write_bytes(raw)
      descriptor[mode] = asset
    chunks.append(descriptor)
  baseline = {
    "chunks": chunks,
    "footprint": [[1, 2, 3]],
    "outskirtsV187": {"chunkCount": 3},
  }
  baseline_bytes = json.dumps(baseline).encode()
  (public / "manifest.json").write_bytes(baseline_bytes)
  (geo / "outskirts-v187-manifest.json").write_bytes(baseline_bytes)
  monkeypatch.setattr(
    installer.subprocess, "check_output", lambda *a, **k: baseline_bytes
  )
  patches = []
  for identity in ("olympic", "wuhlheide"):
    stage = geo / f"raw/{identity}-v201/packets"
    stage.mkdir(parents=True)
    descriptor = {"id": identity, "buildingCount": 1}
    for mode in ("drawn", "minecraft"):
      raw, asset = packet(identity, "measured relief", mode)
      (stage / asset["url"]).write_bytes(raw)
      descriptor[mode] = asset
    patch = geo / (
      "olympic-v201-manifest-patch.json"
      if identity == "olympic"
      else "raw/wuhlheide-v201/manifest-patch.json"
    )
    patch.write_text(json.dumps({"chunks": [descriptor]}))
    prefix = "base" if identity == "olympic" else "baseline"
    receipt = {
      f"{prefix}Release": "v1.0.100",
      f"{prefix}ManifestSha256": hashlib.sha256(baseline_bytes).hexdigest(),
    }
    (geo / f"{identity}-v201-packet-audit.json").write_text(json.dumps(receipt))
    patches.append(descriptor)
  return public, geo, baseline, patches


def test_installer_is_idempotent_and_retains_unrelated_packet(staged):
  public, _, baseline, patches = staged
  unrelated = (public / "unrelated.drawn.gz").read_bytes()
  result = installer.apply()
  assert result["chunks"] == patches + [baseline["chunks"][2]]
  assert result["footprint"] == baseline["footprint"]
  assert (public / "unrelated.drawn.gz").read_bytes() == unrelated
  assert installer.apply() == result


def test_corrupt_staged_asset_changes_no_public_bytes(staged):
  public, geo, _, _ = staged
  before = {p.name: p.read_bytes() for p in public.iterdir()}
  (geo / "raw/wuhlheide-v201/packets/wuhlheide.minecraft.gz").write_bytes(b"invalid")
  with pytest.raises(AssertionError):
    installer.apply()
  assert {p.name: p.read_bytes() for p in public.iterdir()} == before


def test_unrelated_manifest_edit_is_never_overwritten(staged):
  public, _, baseline, _ = staged
  baseline["footprint"].append([4, 5, 6])
  changed = json.dumps(baseline).encode()
  (public / "manifest.json").write_bytes(changed)
  with pytest.raises(AssertionError, match="unrelated"):
    installer.apply()
  assert (public / "manifest.json").read_bytes() == changed
