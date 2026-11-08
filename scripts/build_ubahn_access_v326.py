"""Compile finite BVG names and retained OSM public U-Bahn access geometry.

The source fixture preserves all original coordinates/tags. No network, old
asset mutation, invented station, or neighbourhood generation occurs here.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from pathlib import Path
from typing import Any

from shapely.geometry import LineString, Point

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/ubahn-access-v326-source.json.gz"
OUTPUT = ROOT / "src/app/src/data/ubahnAccessV326.json"
INDEX = ROOT / "src/app/src/data/ubahnAccessV326Index.json"


def build(source: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
  """Retain all names; construct only positively associated public accesses."""
  if source.get("schemaVersion") != 1 or len(source["stations"]) != 175:
    raise ValueError("Incomplete current BVG station inventory")
  station_ids = set(source["stations"])
  nodes = source["entrances"]
  if len({n["id"] for n in nodes}) != len(nodes):
    raise ValueError("Duplicate source entrance")
  by_node: dict[str, list[dict[str, Any]]] = {}
  for way in source["accessWays"]:
    for node in way["entrances"]:
      by_node.setdefault(node, []).append(way)
  protected = source["authoredEntrances"]
  stations = []
  for key, station in source["stations"].items():
    stations.append(
      {
        "id": key,
        "name": station["name"],
        "bvgName": station["bvgName"],
        "lines": station["lines"],
        "nodes": [n["id"] for n in station["nodes"]],
        "entrances": station["entrances"],
        "temporaryU6Closure": "U6" in station["lines"]
        and station["name"]
        in [
          "Alt-Tegel",
          "Borsigwerke",
          "Holzhauser Str.",
          "Otisstr.",
          "Scharnweberstr.",
        ],
      }
    )
  entries, omitted = [], []
  for node in nodes:
    sid = node.get("station")
    if sid not in station_ids:
      omitted.append({"id": node["id"], "reason": "no-positive-current-U-association"})
      continue
    if node["id"] in protected:
      omitted.append(
        {
          "id": node["id"],
          "reason": "retained-authored",
          "owner": protected[node["id"]],
        }
      )
      continue
    tags = node["tags"]
    if (
      tags.get("entrance_marker:subway") == "no"
      or tags.get("indoor") == "yes"
      or ("level" in tags and "0" not in tags["level"].split(";"))
    ):
      omitted.append({"id": node["id"], "reason": "nonpublic-or-explicit-nonsurface"})
      continue
    point = node["point"]
    connected = by_node.get(node["id"], [])
    candidates = []
    for way in connected:
      coords = way["points"]
      for a, b in zip(coords, coords[1:]):
        if math.dist(a, b) < 0.05:
          continue
        dist = LineString([a, b]).distance(Point(point))
        if dist < 0.1:
          candidates.append(
            (0 if way["tags"].get("highway") == "steps" else 1, way, a, b)
          )
    if not candidates:
      omitted.append({"id": node["id"], "reason": "no-mapped-heading"})
      continue
    _, heading_way, a, b = sorted(candidates, key=lambda c: (c[0], c[1]["id"]))[0]
    direction = [(b[i] - a[i]) / math.dist(a, b) for i in [0, 1]]
    stair = None
    for _, way, _, _ in sorted(candidates, key=lambda c: (c[0], c[1]["id"])):
      wt = way["tags"]
      if wt.get("highway") != "steps" or wt.get("incline") not in ["up", "down"]:
        continue
      if wt.get("indoor") == "yes" or wt.get("conveying") in [
        "yes",
        "forward",
        "backward",
      ]:
        continue
      coords = (
        way["points"] if wt["incline"] == "down" else list(reversed(way["points"]))
      )
      if math.dist(point, coords[0]) > 0.1:
        continue  # Ascending or internal stairs do not become descents.
      length = LineString(coords).length
      if not 1 < length < 40:
        continue
      try:
        width = float(wt.get("width", "2.3").removesuffix(" m"))
      except ValueError:
        width = 2.3
      if not 0.8 <= width <= 8:
        continue
      count_text = wt.get("step_count", "")
      count = int(count_text) if count_text.isdigit() else max(3, round(length / 0.30))
      if not 3 <= count <= 120:
        continue
      ring = [
        list(p)
        for p in LineString(coords)
        .buffer(width / 2, cap_style=2, join_style=2)
        .exterior.coords
      ]
      stair = {
        "sourceWay": way["id"],
        "points": coords,
        "ring": ring,
        "width": width,
        "length": length,
        "steps": count,
        "mappedStepCount": count_text.isdigit(),
        "mappedWidth": "width" in wt,
        "descent": count * 0.17,
        "level": wt.get("level"),
      }
      direction = [
        (coords[1][i] - coords[0][i]) / math.dist(coords[0], coords[1]) for i in [0, 1]
      ]
      break
    entries.append(
      {
        "id": node["id"],
        "station": sid,
        "point": point,
        "key": f"{math.floor(point[0] / 512)}_{math.floor(point[1] / 512)}",
        "axis": direction,
        "headingWay": heading_way["id"],
        "association": node["association"],
        "ref": tags.get("ref", ""),
        "stair": stair,
      }
    )
  entries.sort(key=lambda n: n["id"])
  keys = sorted({n["key"] for n in entries})
  profile = {
    "schemaVersion": 1,
    "source": source["source"],
    "references": source["references"],
    "stations": stations,
    "entries": entries,
    "omitted": omitted,
    "estimates": {
      "fittings": "Standard recognition U/name panels, pole positions, small sections and colours are display estimates, not a photographic survey of each portal.",
      "stairs": "Original full OSM polylines/incline/levels retained. Untagged widths 2.3m, untagged counts from 0.30m going and every 0.17m riser are display estimates. No underground continuation inferred.",
      "ground": "Each selected top uses the caller's actual terrain sample; no source payload or callback retained.",
      "native": "Independent cardinal treads/rails/signs and raster letter cells; no smooth duplicate, equal full/touch detail.",
    },
  }
  index = {
    "schemaVersion": 1,
    "keys": keys,
    "stations": [
      {"id": s["id"], "name": s["name"], "lines": s["lines"]} for s in stations
    ],
    "entries": [
      {k: n[k] for k in ["id", "station", "key"]}
      | {"sourceWay": n["stair"]["sourceWay"] if n["stair"] else None}
      for n in entries
    ],
  }
  return profile, index


def main() -> None:
  """Reproduce two new finite assets from immutable source evidence only."""
  raw = SOURCE.read_bytes()
  profile, index = build(json.loads(gzip.decompress(raw)))
  profile["evidenceSha256"] = hashlib.sha256(raw).hexdigest()
  for path, value in [(OUTPUT, profile), (INDEX, index)]:
    path.write_text(
      json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
      + "\n"
    )
    print(path.relative_to(ROOT), path.stat().st_size)
  print(
    "stations",
    len(profile["stations"]),
    "entries",
    len(profile["entries"]),
    "stairs",
    sum(n["stair"] is not None for n in profile["entries"]),
    "keys",
    len(index["keys"]),
  )


if __name__ == "__main__":
  main()
