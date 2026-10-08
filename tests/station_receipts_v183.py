"""Replay only four exact owner substitutions before granting preservation exceptions."""

from __future__ import annotations

import copy
import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
PACKETS = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
sys.path.insert(0, str(ROOT / "scripts"))

import integrate_alexander_stations_v183 as integrator  # noqa: E402

OWNERS = {
  "DEBE00YY1TF0003o",
  "DEBE01YYK00001Xy",
  "DEBE01YYK00002iS",
  "DEBE01YYK00003SW",
}
CHUNKS = {
  "5_-1": {"drawn", "minecraft"},
  "5_0": {"drawn", "minecraft"},
  "6_-1": {"minecraft"},
  "6_0": {"drawn", "minecraft"},
  "6_1": {"drawn", "minecraft"},
  "5_-1-alt-mitte-v169-1": {"drawn"},
  "5_0-alt-mitte-v169-1": {"drawn"},
  "6_0-alt-mitte-v169-1": {"drawn"},
  "6_1-alt-mitte-v169-1": {"drawn"},
}


def baseline(path: Path, release: str = "v1.0.82") -> bytes:
  """Read an immutable committed input, never a mutable generator receipt."""
  return subprocess.check_output(
    ["git", "show", f"{release}:{path.relative_to(ROOT)}"], cwd=ROOT
  )


def verified_station_replacements() -> tuple[dict, set[str]]:
  """Require deterministic exact subtraction and retain every unrelated byte.

  The integrator rebuilds the four prior v169 owners from retained source
  sheets, then proves their triangle signatures and source ink were the only
  removals. Replaying in a temporary tree validates the recorded hashes and
  does not merely trust the audit's boolean preservation claim.
  """
  audit = json.loads(
    (
      ROOT / "geo_data/regierungsviertel/alexander-stations-v183-audit.json"
    ).read_bytes()
  )
  assert set(audit["sourceIds"]) == OWNERS
  assert audit["retainedCoreFacadeOwner"] == "DEBE01YYK00001QK"
  assert {r["id"]: set(r["modes"]) for r in audit["chunks"]} == CHUNKS
  old = json.loads(baseline(PACKETS / "manifest.json"))
  current = json.loads((PACKETS / "manifest.json").read_bytes())
  old_chunks = {row["id"]: row for row in old["chunks"]}
  current_chunks = {row["id"]: row for row in current["chunks"]}
  subset = copy.deepcopy(old)
  subset["chunks"] = [r for r in old["chunks"] if r["id"] in CHUNKS]
  original_appearance = copy.deepcopy(integrator.APPEARANCE)
  files = set()
  try:
    with tempfile.TemporaryDirectory(prefix="berlin-v183-owner-proof-") as directory:
      root = Path(directory)
      output = root / "packets"
      output.mkdir()
      (root / "geo_data/regierungsviertel").mkdir(parents=True)
      (output / "manifest.json").write_text(json.dumps(subset))
      for chunk in subset["chunks"]:
        for mode in ("drawn", "minecraft"):
          name = chunk[mode]["url"]
          original = baseline(PACKETS / name)
          assert hashlib.sha256(original).hexdigest() == chunk[mode]["sha256"]
          (output / name).write_bytes(original)
      with (
        patch.object(integrator, "ROOT", root),
        patch.object(integrator, "DEFAULT_OUTPUT", output),
      ):
        assert integrator.integrate() == audit
      replay = json.loads((output / "manifest.json").read_bytes())
      for chunk in replay["chunks"]:
        assert chunk == current_chunks[chunk["id"]]
        for mode in ("drawn", "minecraft"):
          name = chunk[mode]["url"]
          assert (output / name).read_bytes() == (PACKETS / name).read_bytes()
          if mode in CHUNKS[chunk["id"]]:
            files.add(str((PACKETS / name).relative_to(ROOT)))
      for row in audit["chunks"]:
        for mode, receipt in row["modes"].items():
          assert receipt["oldSha256"] == old_chunks[row["id"]][mode]["sha256"]
          assert receipt["newSha256"] == current_chunks[row["id"]][mode]["sha256"]
  finally:
    integrator.APPEARANCE.clear()
    integrator.APPEARANCE.update(original_appearance)
  return {r["id"]: r for r in audit["chunks"]}, files
