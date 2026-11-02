"""Exact old-manifest asset reads after proven v194/v299/v242 projections.

Only a finite manifest's ordinary public gzip paths are eligible. An expected
full byte length and SHA256 must match the actual reader or one independently
verified predecessor. No recompression, filename-only substitution or writes.
"""

from __future__ import annotations

import hashlib
import re
from pathlib import Path
from typing import Callable

from scripts.integrate_lossless_v194 import PUBLIC, predecessor_packet_bytes_v194

Reader = Callable[[Path], bytes]


def historical_asset_bytes_v194(
  path: Path,
  expected_sha256: str,
  expected_bytes: int | None = None,
  reader: Reader = Path.read_bytes,
) -> bytes:
  """Reach an unchanged full expected fingerprint only through audited stages."""
  assert re.fullmatch("[0-9a-f]{64}", expected_sha256)
  assert expected_bytes is None or type(expected_bytes) is int and expected_bytes >= 0
  raw = reader(path)

  def matches(value: bytes) -> bool:
    return (expected_bytes is None or len(value) == expected_bytes) and (
      hashlib.sha256(value).hexdigest() == expected_sha256
    )

  if matches(raw):
    return raw
  assert path.resolve().is_relative_to(PUBLIC), "Nonpublic historical source changed"

  def retained(source: Path) -> bytes:
    return raw if source.resolve() == path.resolve() else reader(source)

  from scripts.integrate_fidelity_v299 import predecessor_packet_bytes_v299
  from scripts.spree_bridge_lineage_v242 import predecessor_packet_bytes_v242

  for project in (
    predecessor_packet_bytes_v194,
    predecessor_packet_bytes_v299,
    predecessor_packet_bytes_v242,
  ):
    before = project(path, retained)
    if matches(before):
      return before
  raise AssertionError(f"No exact complete historical asset proof: {path.name}")


def manifest_asset_reader_v194(
  manifest: dict, reader: Reader = Path.read_bytes
) -> Reader:
  """Bind old asset reads to their complete declared immutable descriptor."""
  expected: dict[Path, tuple[int, str]] = {}
  for descriptor in manifest["chunks"]:
    for mode in ("drawn", "minecraft"):
      asset = descriptor.get(mode)
      if asset is None:
        continue
      name = asset["url"]
      assert (
        isinstance(name, str)
        and not Path(name).is_absolute()
        and Path(name).as_posix() == name
        and ".." not in Path(name).parts
        and "\\" not in name
        and name.endswith(".json.gz")
      ), "Unsafe historical public asset"
      pin = (asset["bytes"], asset["sha256"])
      assert type(pin[0]) is int and pin[0] >= 0
      assert isinstance(pin[1], str) and re.fullmatch("[0-9a-f]{64}", pin[1])
      path = (PUBLIC / name).resolve()
      assert path.is_relative_to(PUBLIC)
      assert path not in expected or expected[path] == pin
      expected[path] = pin

  def historical(path: Path) -> bytes:
    pin = expected.get(path.resolve())
    if pin is None:
      return reader(path)
    return historical_asset_bytes_v194(path, pin[1], pin[0], reader)

  return historical
