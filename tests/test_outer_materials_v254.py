"""Replay the incremental source evidence without changing existing geometry."""

import ast
import base64
import gzip
import hashlib
import json
import subprocess
from collections import defaultdict
from pathlib import Path, PurePosixPath

import numpy as np
from shapely.affinity import translate
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

from scripts import build_outer_materials_v254 as build
from scripts.historical_asset_reader_v194 import historical_asset_bytes_v194


def test_receipts_replay_only_exact_generic_surfaces_and_protect_previous_owners():
  evidence = build.base.read_json(build.EVIDENCE)
  output = build.base.read_json(build.OUTPUT)
  previous = build.base.read_json(build.previous.EVIDENCE)
  assert (
    build.appearance.digest(build.previous.OUTPUT) == evidence["previousReceiptSha256"]
  )
  assert not set(evidence["owners"]) & set(evidence["protectedOwners"])
  assert set(previous["owners"]) <= set(evidence["protectedOwners"])
  assert build.appearance.digest(build.ROOFS) == evidence["roofSourceSha256"]
  assert {row["owner"] for row in build.base.read_json(build.ROOFS)["owners"]} <= set(
    evidence["protectedOwners"]
  )
  assert 100 < len(evidence["owners"]) <= 250
  assert build.OUTPUT.stat().st_size < 26_000
  counts = defaultdict(int)
  for asset in evidence["assets"]:
    path = build.OUT / asset["url"]
    raw = historical_asset_bytes_v194(path, asset["sha256"], asset.get("bytes"))
    assert hashlib.sha256(raw).hexdigest() == asset["sha256"]
    decoded = gzip.decompress(raw)
    assert gzip.decompress(path.read_bytes()) == decoded
    packet = json.loads(decoded)
    family = "minecraft" if ".minecraft." in path.name else "drawn"
    tile = path.name.removesuffix(f".{family}.json.gz")
    assert tile.startswith(build.PREFIXES)
    for receipt in output["packets"][family + ":" + tile]:
      part = packet["meshes"][receipt["mesh"]]
      assert part["kind"] == "city"
      assert build.appearance.fingerprint(part) == receipt["fingerprint"]
      expected, _ = build.previous.owned_colours(
        part, packet, evidence["owners"], family == "minecraft"
      )
      actual = {}
      for first, count, colour in np.frombuffer(
        base64.b64decode(receipt["runs"]), "<u4"
      ).reshape(-1, 3):
        packed = output["palette"][colour]
        rgb = packed >> 16, (packed >> 8) & 255, packed & 255
        for vertex in range(int(first), int(first + count)):
          assert vertex not in actual
          actual[vertex] = rgb
      assert actual == expected
      counts[family + "Vertices"] += len(actual)
  assert dict(counts) == evidence["counts"]


def test_complete_owner_footprints_match_the_unchanged_retained_material_extract(monkeypatch):
  evidence = build.base.read_json(build.EVIDENCE)
  _expected_v314 = {
    (build.OUT / _asset_v314["url"]).resolve(): _asset_v314["sha256"]
    for _asset_v314 in evidence["sourceAssets"]
  }
  _reader_v314 = Path.read_bytes
  _digest_v315 = build.appearance.digest
  with monkeypatch.context() as _scope_v314:
    _scope_v314.setattr(
      Path, "read_bytes", _historical_source_reader_v314(_expected_v314, _reader_v314)
    )
    _scope_v314.setattr(
      build.appearance, "digest",
      _historical_source_digest_v315(_expected_v314, _reader_v314, _digest_v315),
    )
    context = build.base.read_json(build.CONTEXT)
    assert build.appearance.digest(build.CONTEXT) == evidence["contextSha256"]
    records = {row["id"]: row for row in context["records"]}
    outlines = defaultdict(list)
    for asset in evidence["sourceAssets"]:
      assert build.appearance.digest(build.OUT / asset["url"]) == asset["sha256"]
      packet = build.base.read_json(build.OUT / asset["url"])
      ox, _, oz = packet["origin"]
      for row in packet["nav"]["buildings"]:
        if row["sourceId"] in evidence["owners"]:
          outlines[row["sourceId"]].append(
            translate(Polygon(row["ring"], row["holes"]), ox, oz)
          )
    for owner, row in evidence["owners"].items():
      record = records[row["osm"]]
      assert set(row["tags"]) <= set(build.previous.KEYS)
      assert row["tags"] == record["tags"]
      source, mapped = unary_union(outlines[owner]), shape(record["geometry"])
      overlap = source.intersection(mapped).area
      assert min(overlap / source.area, overlap / mapped.area) >= 0.97
      assert min(row["coverage"]) >= 0.97
      assert tuple(build.previous.tones(row["tags"])) == tuple(
        tuple(row[key]) if row[key] is not None else None for key in ("wall", "roof")
      )


def _published_protected_owners_v254() -> set[str]:
  """Replay every immutable prior input; later retirement references are not prior."""
  commit = "f5e54c46eed0c84b4c95e0132a3a68b0818eece5"
  compiler_sha = "9a23c858adbc359089bc2a0dc06c79d6d7cfeb3c6a443aa91b45f2c6a9e2553f"
  evidence_sha = "4362a8e8e596470fac9408849f7c056c02ffadd7f09c2a0f8ca48da240f98948"
  inputs_sha = "d19e43b73e592c9ffd8ca6e4bca08f3d4b0022f27aac30275baa877d3cdd9d3b"
  files = (
    subprocess.check_output(
      ["git", "ls-tree", "-r", "--name-only", commit], cwd=build.ROOT
    )
    .decode()
    .splitlines()
  )
  process = subprocess.Popen(
    ["git", "cat-file", "--batch"],
    cwd=build.ROOT,
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
  )
  cache: dict[str, bytes] = {}

  def read(path: str) -> bytes:
    assert path in files and ".." not in PurePosixPath(path).parts
    if path not in cache:
      assert process.stdin is not None and process.stdout is not None
      process.stdin.write(f"{commit}:{path}\n".encode())
      process.stdin.flush()
      header = process.stdout.readline().decode().split()
      assert len(header) == 3 and header[1] == "blob"
      raw = process.stdout.read(int(header[2]))
      assert len(raw) == int(header[2]) and process.stdout.read(1) == b"\n"
      cache[path] = raw
    return cache[path]

  class FrozenPath:
    def __init__(self, path: str) -> None:
      self.path = path

    @property
    def name(self) -> str:
      return PurePosixPath(self.path).name

    def read_text(self) -> str:
      return read(self.path).decode()

  class FrozenRoot:
    def glob(self, pattern: str) -> list[FrozenPath]:
      return [
        FrozenPath(path)
        for path in files
        if len(PurePosixPath(path).parts) == len(PurePosixPath(pattern).parts)
        and PurePosixPath(path).match(pattern)
      ]

  try:
    source = read("scripts/build_outer_materials_v232.py")
    assert hashlib.sha256(source).hexdigest() == compiler_sha
    assert hashlib.sha256(build.EVIDENCE.read_bytes()).hexdigest() == evidence_sha
    for name in (
      "outer-facades-v230-context.json.gz",
      "district-facades-v188-evidence.json.gz",
      "kiez-facades-v209-evidence.json.gz",
      "outer-facades-v230-evidence.json.gz",
      build.EVIDENCE.name,
      build.previous.EVIDENCE.name,
      build.ROOFS.name,
    ):
      path = build.GEO / name
      assert read(path.relative_to(build.ROOT).as_posix()) == path.read_bytes()
    original = next(
      row
      for row in ast.parse(source).body
      if isinstance(row, ast.FunctionDef) and row.name == "protected_owners"
    )
    scope = {**vars(build.previous), "ROOT": FrozenRoot()}
    exec(
      compile(
        ast.Module(body=[original], type_ignores=[]),
        "<pinned-v254-prior-owner-scan>",
        "exec",
      ),
      scope,
    )
    prior = scope["protected_owners"]()
    assert len(prior) == 24236
    receipts = {path: hashlib.sha256(raw).hexdigest() for path, raw in cache.items()}
    assert len(receipts) == 1161
    assert (
      hashlib.sha256(
        json.dumps(receipts, sort_keys=True, separators=(",", ":")).encode()
      ).hexdigest()
      == inputs_sha
    )
    published = prior | set(build.base.read_json(build.previous.EVIDENCE)["owners"])
    published.update(
      row["owner"] for row in build.base.read_json(build.ROOFS)["owners"]
    )
    assert len(published) == 24520
    assert published == set(build.base.read_json(build.EVIDENCE)["protectedOwners"])
    return prior
  finally:
    assert process.stdin is not None
    process.stdin.close()
    process.wait(timeout=10)
    assert process.returncode == 0


def test_no_receipt_can_override_an_earlier_material_vertex():
  current = build.base.read_json(build.OUTPUT)["packets"]
  previous = build.base.read_json(build.previous.OUTPUT)["packets"]
  assert set(current).isdisjoint(previous)
  # Earlier individually authored models and facade/roof source owners are
  # protected even when they carry a previously unused material tag.
  protected = set(build.base.read_json(build.EVIDENCE)["protectedOwners"])
  owners = set(build.base.read_json(build.EVIDENCE)["owners"])
  assert not owners & (protected | _published_protected_owners_v254())


def _historical_source_reader_v314(expected, reader):
  def historical(path):
    digest = expected.get(path.resolve())
    if digest is None:
      return reader(path)
    return historical_asset_bytes_v194(path, digest, reader=reader)

  return historical


def _historical_source_digest_v315(expected, reader, digest):
  def historical(path):
    expected_digest = expected.get(path.resolve())
    if expected_digest is None:
      return digest(path)
    return hashlib.sha256(
      historical_asset_bytes_v194(path, expected_digest, reader=reader)
    ).hexdigest()

  return historical
