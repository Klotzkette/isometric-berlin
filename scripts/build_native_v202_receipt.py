"""Freeze the narrowly audited v202 native owner delta from offline captures."""

from __future__ import annotations

import base64
import difflib
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
FIX = ROOT / "src/app/tests/fixtures"


def build() -> None:
  """Run audit-native-v202.ts in all four variants before calling this helper."""
  historical = json.loads((FIX / "minecraft-payload-only-v200.json").read_text())
  baseline = {}
  profiles = {}
  for profile in ["full", "mobile"]:
    old = Path(f"/tmp/v202-native-legacy-{profile}")
    new = Path(f"/tmp/v202-native-current-{profile}")
    before = json.loads(old.with_suffix(".json").read_text())
    after = json.loads(new.with_suffix(".json").read_text())
    assert before == historical[profile], (
      f"{profile}: counterfactual changed legacy bytes"
    )
    baseline[profile] = after
    profiles[profile] = {}
    for name, prior in before.items():
      if prior == after[name]:
        continue

      def rows(prefix: Path) -> list[bytes]:
        p = str(prefix) + "-" + name.replace(" ", "_") + "-"
        matrices = np.fromfile(p + "instanceMatrix.bin", dtype="<f4").reshape(-1, 16)
        colors = np.fromfile(p + "instanceColor.bin", dtype="<f4").reshape(-1, 3)
        return [r.tobytes() for r in np.column_stack([matrices, colors])]

      a, b = rows(old), rows(new)
      delta = {
        "beforeCount": len(a),
        "afterCount": len(b),
        "retainedCount": 0,
        "removed": [],
        "added": [],
      }
      for kind, lo, hi, start, end in difflib.SequenceMatcher(
        None, a, b, autojunk=False
      ).get_opcodes():
        if kind == "equal":
          delta["retainedCount"] += hi - lo
          continue
        delta["removed"] += [
          {"index": i, "data": base64.b64encode(a[i]).decode()} for i in range(lo, hi)
        ]
        delta["added"] += [
          {"index": i, "data": base64.b64encode(b[i]).decode()}
          for i in range(start, end)
        ]
      profiles[profile][name] = delta
      print(
        profile,
        name,
        len(a),
        len(b),
        "removed",
        len(delta["removed"]),
        "added",
        len(delta["added"]),
        flush=True,
      )
  for suffix, data in [
    ("", baseline),
    (
      "-delta",
      {
        "method": "Only two v202 exact predicates disabled; historical v200 hashes must match before diff. Every unchanged record and ordering retained.",
        "profiles": profiles,
      },
    ),
  ]:
    (FIX / f"minecraft-payload-only-v202{suffix}.json").write_text(
      json.dumps(data, separators=(",", ":")) + "\n"
    )


if __name__ == "__main__":
  build()
