"""Every core source is audited; only source-bound unknown residential paint changes."""

from __future__ import annotations

import gzip
import hashlib
import io
import json
import subprocess
from collections import defaultdict
from pathlib import Path, PurePosixPath

from scripts import build_core_house_colours_v273 as module

PROTECTION_COMMIT = "8c91c81e4b592572abd087c7ca32a7749e740eb5"
EVIDENCE_SHA256 = "af94c3a687fd6102e473350c345bf106a84ac8810c76fbf8e385010991764787"
RUNTIME_SHA256 = "4f6384565300fbc08a4c1333d3300fd9fedd0b93532c545b225530ad6a8f5461"
COMPILER_SHA256 = "fcb0cd4680e676d62863c2b30589388297ca6acbaa290ecb859f4547f31c8b79"


class HistoricalProtectionFiles:
  """Read-only finite Git view; run the original scan rather than copy its IDs.

  This commit includes the evidenced v275 K0002RLM transfer and v277 refresh.
  Later authored modules must not silently change that frozen compiler input.
  Every historical file that contributes an ID still needs its complete old
  SHA-256 receipt, and the complete resulting receipt list and ID union match.
  """

  def __init__(self) -> None:
    self.files = set(
      subprocess.check_output(
        ["git", "ls-tree", "-r", "--name-only", PROTECTION_COMMIT], cwd=module.ROOT
      )
      .decode()
      .splitlines()
    )
    self.process = subprocess.Popen(
      ["git", "cat-file", "--batch"],
      cwd=module.ROOT,
      stdin=subprocess.PIPE,
      stdout=subprocess.PIPE,
    )

  def read(self, path: str) -> bytes:
    assert path in self.files and ".." not in PurePosixPath(path).parts
    assert self.process.stdin is not None and self.process.stdout is not None
    self.process.stdin.write(f"{PROTECTION_COMMIT}:{path}\n".encode())
    self.process.stdin.flush()
    header = self.process.stdout.readline().decode().split()
    assert len(header) == 3 and header[1] == "blob"
    raw = self.process.stdout.read(int(header[2]))
    assert len(raw) == int(header[2]) and self.process.stdout.read(1) == b"\n"
    return raw

  def close(self) -> None:
    assert self.process.stdin is not None
    self.process.stdin.close()
    self.process.wait(timeout=10)
    assert self.process.returncode == 0

  def path(self, path: str) -> HistoricalProtectionPath:
    return HistoricalProtectionPath(self, path)


class HistoricalProtectionPath:
  """Only the path operations used by the unchanged protections() scan."""

  def __init__(self, source: HistoricalProtectionFiles, path: str) -> None:
    self.source, self.path = source, path

  def __truediv__(self, name: str) -> HistoricalProtectionPath:
    return self.source.path(f"{self.path}/{name}")

  @property
  def name(self) -> str:
    return PurePosixPath(self.path).name

  def __lt__(self, other: HistoricalProtectionPath) -> bool:
    return self.path < other.path

  def glob(self, pattern: str) -> list[HistoricalProtectionPath]:
    return [
      self.source.path(path)
      for path in self.source.files
      if str(PurePosixPath(path).parent) == self.path
      and PurePosixPath(path).match(pattern)
    ]

  def read_text(self) -> str:
    return self.source.read(self.path).decode()

  def open(self, mode: str) -> io.BytesIO:
    assert mode == "rb"
    return io.BytesIO(self.source.read(self.path))

  def relative_to(self, root: Path) -> Path:
    assert root == module.ROOT
    return Path(self.path)


def historical_protections(monkeypatch) -> tuple[set[str], list[dict[str, str]]]:
  """Replay all old files and reject stale/forged receipts or incomplete scans."""
  assert module.digest(module.EVIDENCE) == EVIDENCE_SHA256
  assert module.digest(module.OUTPUT) == RUNTIME_SHA256
  assert module.digest(Path(module.__file__)) == COMPILER_SHA256
  frozen = evidence()
  assert len(frozen["protectionReceipts"]) == 664
  source = HistoricalProtectionFiles()
  try:
    assert (
      source.read(str(module.EVIDENCE.relative_to(module.ROOT)))
      == module.EVIDENCE.read_bytes()
    )
    assert (
      source.read(str(module.OUTPUT.relative_to(module.ROOT)))
      == module.OUTPUT.read_bytes()
    )
    for receipt in frozen["protectionReceipts"]:
      assert (
        hashlib.sha256(source.read(receipt["file"])).hexdigest() == receipt["sha256"]
      )
    with monkeypatch.context() as historical:
      historical.setattr(module, "APP", source.path("src/app/src"))
      historical.setattr(module, "GEO", source.path("geo_data/regierungsviertel"))
      protected, receipts = module.protections()
    assert receipts == frozen["protectionReceipts"]
    assert sorted(protected) == frozen["protectedIds"]
    assert len(protected) == 22449 and "K0002RLM" in protected
    return protected, receipts
  finally:
    source.close()


def evidence() -> dict:
  """Read the finite immutable colour/source receipt."""
  return json.loads(gzip.decompress(module.EVIDENCE.read_bytes()))


def test_all_existing_core_parts_have_an_audited_outcome() -> None:
  data = evidence()
  source = json.loads(module.PRISMS.read_text())
  assert data["sourceParts"] == len(source["buildings"]) == 29818
  assert sum(data["counts"].values()) == 29818
  assert sum(x["auditedParts"] for x in data["regions"].values()) == 29818
  # v275 transfers the sole generic Werkhof house to its complete named model.
  # The 7,173 remaining colour rows are unchanged; the v275 receipt keeps the
  # removed K0002RLM row and original runtime/evidence hashes independently.
  assert data["counts"]["selected"] == len(data["selected"]) == 7173
  assert "K0002RLM" in data["protectedIds"]
  assert all(row["id"] != "K0002RLM" for row in data["selected"])
  assert data["regions"]["Moabit"]["selected"] == 2599
  assert data["regions"]["Kreuzberg"]["selected"] == 1063
  assert data["regions"]["Schöneberg"]["selected"] == 196
  for receipt in data["inputs"]:
    assert module.digest(module.ROOT / receipt["file"]) == receipt["sha256"]


def test_exact_receipts_reject_modified_geometry_or_sample_and_keep_family_colour() -> (
  None
):
  data = evidence()
  source = json.loads(module.PRISMS.read_text())["buildings"]
  runtime = json.loads(module.OUTPUT.read_text())["owners"]
  families = defaultdict(set)
  for row in data["selected"]:
    part = source[row["index"]]
    assert part["id"] == row["id"]
    assert row["function"] in module.RESIDENTIAL
    assert module.source_guard(part) == row["receipt"][:2]
    assert row["receipt"] in runtime[part["id"]]
    assert part["id"] not in data["protectedIds"]
    assert row["family"] not in data["blockedFamilies"]
    families[row["family"]].add(row["receipt"][2])
    for key in ("class", "h_dm", "y0_dm", "roof"):
      assert (
        module.source_guard(part | {key: part.get(key, 0) + 1}) != row["receipt"][:2]
      )
  assert all(len(colours) == 1 for colours in families.values())
  assert len(set(row["receipt"][2] for row in data["selected"])) == 12


def test_mapped_materials_and_coloured_or_non_residential_owners_remain_outside() -> (
  None
):
  data = evidence()
  source = json.loads(module.PRISMS.read_text())["buildings"]
  attributes = json.loads(module.ATTR.read_text())
  for row in data["selected"]:
    part = source[row["index"]]
    assert max(part["tone"]) - min(part["tone"]) < 24
    assert part["class"] == 0
    tags = (
      attributes["records"][attributes["prisms"][part["id"]]]["tags"]
      if part["id"] in attributes["prisms"]
      else {}
    )
    assert not any(
      key in tags
      for key in (
        "building:colour",
        "building:material",
        "facade:colour",
        "facade:material",
      )
    )
    if any(key in tags for key in ("roof:colour", "roof:material")):
      assert row["receipt"][3] == row["receipt"][5] == -1
  assert data["geometryChanges"] == data["newRuntimeMeshes"] == data["newGpuBytes"] == 0


def test_compiler_is_reproducible_without_rewriting_source(monkeypatch) -> None:
  protections = historical_protections(monkeypatch)
  monkeypatch.setattr(module, "protections", lambda: protections)
  runtime, replayed_evidence = module.compile_receipts()
  assert runtime == json.loads(module.OUTPUT.read_text())
  assert replayed_evidence == evidence()
