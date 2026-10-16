"""Receipt for exactly two superseded, non-surveyed v182 window grids.

Measured source outlines use 0x62696A and are explicitly never selected.
The independent west-civic v210 exclusions remain outside this receipt.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/app/src/data/cityRecognitionV182.json"
OUTPUT = ROOT / "src/app/src/data/townhallV227Previous.json"


def build() -> dict[str, Any]:
  """Record complete immutable rows, selected by exact feature ranges."""
  raw = SOURCE.read_bytes()
  source = json.loads(raw)
  features = [
    item
    for item in source["features"]
    if item["name"] in {"Rathaus Tiergarten", "Rathaus Mitte"}
  ]
  assert {item["name"] for item in features} == {
    "Rathaus Tiergarten",
    "Rathaus Mitte",
  }
  boxes, segments = [], []
  for feature in features:
    for index in range(feature["firstBox"], feature["firstBox"] + feature["boxCount"]):
      boxes.append({"index": index, "row": source["boxes"][index]})
    for index in range(
      feature["firstSegment"], feature["firstSegment"] + feature["segmentCount"]
    ):
      row = source["segments"][index]
      if row[-1] in {0xBDC5BF, 0xB0BABF}:
        segments.append({"index": index, "row": row})
  assert all(row["row"][-1] != 0x62696A for row in segments)
  return {
    "source": SOURCE.relative_to(ROOT).as_posix(),
    "sourceSha256": hashlib.sha256(raw).hexdigest(),
    "sourceRows": {
      "boxes": len(source["boxes"]),
      "segments": len(source["segments"]),
    },
    "features": features,
    "reason": "Replace only estimated window grids/caps and floor bands; retain every measured edge and source owner",
    "boxes": boxes,
    "segments": segments,
  }


if __name__ == "__main__":
  OUTPUT.write_text(json.dumps(build(), separators=(",", ":")) + "\n")
