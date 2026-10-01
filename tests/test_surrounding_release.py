"""Small offline delivery fixtures for the two surrounding-city world families."""

from __future__ import annotations

import base64
import gzip
import hashlib
import importlib.util
import json
import struct
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
  "surrounding_release_checker", ROOT / "scripts/check_release_readiness.py"
)
assert SPEC and SPEC.loader
checker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(checker)


def tiny_chunk(*, minecraft: bool) -> bytes:
  """One real indexed ground triangle, with separate native-grid coordinates."""
  width = 200 if minecraft else 175
  positions = struct.pack("<9H", 0, 1300, 0, 0, 1300, 200, width, 1300, 0)
  ring = [[0, 0], [0, 2], [width / 100, 0], [0, 0]]
  payload = {
    "schemaVersion": 1,
    "id": "0_0",
    "origin": [0, -10, 0],
    "meshes": [
      {
        "kind": "city",
        "positionType": "u16cm",
        "positions": base64.b64encode(positions).decode(),
        "colors": base64.b64encode(bytes([125, 130, 103] * 3)).decode(),
        "indices": base64.b64encode(struct.pack("<3I", 0, 1, 2)).decode(),
      }
    ],
    "lines": {"positionType": "u16cm", "positions": "", "colors": ""},
    "nav": {
      "ground": [{"ring": ring, "holes": []}],
      "buildings": [],
      "water": [],
      "bridges": [],
      "roads": [],
      "groundY": 3,
    },
  }
  return json.dumps(payload, separators=(",", ":")).encode()


def write_manifest(folder: Path, manifest: dict) -> None:
  (folder / "manifest.json").write_text(json.dumps(manifest))


@pytest.fixture
def small_site(tmp_path: Path) -> tuple[Path, Path, dict]:
  site = tmp_path / "site"
  folder = site / "mesh/surrounding-berlin-v159"
  folder.mkdir(parents=True)
  chunk: dict = {"id": "0_0"}
  for family in ("drawn", "minecraft"):
    raw = tiny_chunk(minecraft=family == "minecraft")
    packed = gzip.compress(raw, mtime=0)
    name = f"0_0.{family}.json.gz"
    (folder / name).write_bytes(packed)
    chunk[family] = {
      "url": name,
      "encoding": "gzip",
      "bytes": len(packed),
      "decodedBytes": len(raw),
      "sha256": hashlib.sha256(packed).hexdigest(),
    }
  manifest = {"schemaVersion": 1, "chunks": [chunk]}
  write_manifest(folder, manifest)
  return site, folder, manifest


def test_complete_drawn_and_native_gzip_delivery_is_accepted(small_site) -> None:
  site, _, manifest = small_site
  assert (
    manifest["chunks"][0]["drawn"]["sha256"]
    != (manifest["chunks"][0]["minecraft"]["sha256"])
  )
  assert checker.surrounding_city_failures(site) == []


@pytest.mark.parametrize("family", ["drawn", "minecraft"])
@pytest.mark.parametrize("field", ["sha256", "bytes"])
def test_tampered_digest_or_transfer_size_is_rejected(
  small_site, family: str, field: str
) -> None:
  site, folder, manifest = small_site
  asset = manifest["chunks"][0][family]
  asset[field] = "0" * 64 if field == "sha256" else asset[field] + 1
  write_manifest(folder, manifest)
  failures = checker.surrounding_city_failures(site)
  assert any(
    "differs from manifest" in failure and asset["url"] in failure
    for failure in failures
  )


@pytest.mark.parametrize("absolute", [False, True])
def test_nonlocal_chunk_path_is_rejected_even_when_asset_exists(
  small_site, absolute: bool
) -> None:
  site, folder, manifest = small_site
  asset = manifest["chunks"][0]["drawn"]
  outside = folder.parent / "escaped.json.gz"
  outside.write_bytes((folder / asset["url"]).read_bytes())
  asset["url"] = str(outside) if absolute else "../escaped.json.gz"
  write_manifest(folder, manifest)
  assert any(
    "non-local outline chunk path" in failure
    for failure in checker.surrounding_city_failures(site)
  )


@pytest.mark.parametrize("family", ["drawn", "minecraft"])
def test_wrong_decoded_size_is_rejected_despite_correct_compressed_hash(
  small_site, family: str
) -> None:
  site, folder, manifest = small_site
  asset = manifest["chunks"][0][family]
  asset["decodedBytes"] += 1
  write_manifest(folder, manifest)
  failures = checker.surrounding_city_failures(site)
  assert any(
    "Invalid losslessly packed outline chunk" in failure and asset["url"] in failure
    for failure in failures
  )


@pytest.mark.parametrize("family", ["drawn", "minecraft"])
@pytest.mark.parametrize("damage", ["truncated", "invalid-deflate", "bad-crc"])
def test_broken_gzip_returns_a_failure_instead_of_crashing_the_checker(
  small_site, family: str, damage: str
) -> None:
  site, folder, manifest = small_site
  asset = manifest["chunks"][0][family]
  path = folder / asset["url"]
  packed = path.read_bytes()
  if damage == "truncated":
    damaged = packed[:-3]
  elif damage == "invalid-deflate":
    # Keep the valid gzip header/footer but use reserved DEFLATE block type 3.
    damaged = packed[:10] + b"\x07" + packed[-8:]
  else:
    damaged = packed[:-8] + bytes([packed[-8] ^ 1]) + packed[-7:]
  path.write_bytes(damaged)
  # A checksum-matching manifest still cannot make an invalid stream usable.
  asset["bytes"] = len(damaged)
  asset["sha256"] = hashlib.sha256(damaged).hexdigest()
  write_manifest(folder, manifest)
  assert any(
    "Incomplete surrounding-city package" in failure
    for failure in checker.surrounding_city_failures(site)
  )


@pytest.mark.parametrize("family", ["drawn", "minecraft"])
def test_missing_one_world_family_is_rejected(small_site, family: str) -> None:
  site, folder, manifest = small_site
  name = manifest["chunks"][0][family]["url"]
  (folder / name).unlink()
  assert any(
    "Incomplete surrounding-city package" in failure and name in failure
    for failure in checker.surrounding_city_failures(site)
  )
