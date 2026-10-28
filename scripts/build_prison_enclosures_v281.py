"""Step 10: small retained-source prison exterior companion, no source retirement."""

from __future__ import annotations

import json
from pathlib import Path

from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1]


def build(root: Path = ROOT) -> dict:
  """Cut only evidenced gates from complete mapped exterior wall courses."""
  source = json.loads(
    (
      root / "geo_data/regierungsviertel/prison-enclosures-v281-source.json"
    ).read_bytes()
  )
  segments = []
  for wall in source["wallSource"]:
    geometry = shape(wall["geometry"])
    for gate in source["gates"]:
      point = shape(gate["geometry"])
      if geometry.distance(point) < 0.16:
        geometry = geometry.difference(point.buffer(2.1))
    for part in getattr(geometry, "geoms", [geometry]):
      points = list(part.coords)
      segments.extend([*a, *b] for a, b in zip(points, points[1:]))
  return dict(
    walls=segments,
    towers=source["towers"],
    wallHeightEstimate=5.0,
    wallThicknessEstimate=0.48,
    ground=5.2,
    gateHalfWidthEstimate=2.1,
    wallIds=[w["id"] for w in source["wallSource"]],
    gatePoints=[g["geometry"]["coordinates"] for g in source["gates"]],
  )


if __name__ == "__main__":
  path = ROOT / "src/app/src/data/prisonEnclosuresV281.json"
  path.write_text(json.dumps(build(), separators=(",", ":")) + "\n")
