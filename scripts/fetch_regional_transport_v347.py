"""Bounded current OSM API capture of the complete A10 and its junctions.

Three concurrent requests maximum. Raw map replies stay in the selected audit
folder; derived records contain transport only, never Brandenburg land fill.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import gzip
import json
import time
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = "https://api.openstreetmap.org/api/0.6/"
KINDS = {"motorway", "motorway_link", "trunk_link"}


class Capture:
  def __init__(self, output: Path):
    self.output = output
    output.mkdir(parents=True, exist_ok=True)

  def get(self, path: str) -> dict:
    target = self.output / (
      path.replace("/", "_").replace("?", "_").replace(",", "_") + ".json.gz"
    )
    if target.exists():
      return json.loads(gzip.decompress(target.read_bytes()))
    for attempt in range(3):
      try:
        req = urllib.request.Request(
          API + path,
          headers={
            "User-Agent": "Isometric-Berlin-source-audit/1.0 (bounded A10 survey)"
          },
        )
        with urllib.request.urlopen(req, timeout=45) as reply:
          data = json.load(reply)
        target.write_bytes(
          gzip.compress(json.dumps(data, separators=(",", ":")).encode(), mtime=0)
        )
        return data
      except (OSError, ValueError) as error:
        print(path, "retry", attempt, str(error), flush=True)
        time.sleep(1 + attempt)
    raise RuntimeError(path)

  def many(self, paths: list[str]) -> list[dict]:
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
      return list(pool.map(self.get, paths))


def fetch(output: Path) -> None:
  capture = Capture(output)
  elements = {}
  todo, seen = [21105], set()
  while todo:
    results = capture.many([f"relation/{rid}/full.json" for rid in todo])
    seen.update(todo)
    todo = []
    for data in results:
      for element in data["elements"]:
        elements[element["type"], element["id"]] = element
        if element["type"] == "relation":
          todo += [
            m["ref"]
            for m in element["members"]
            if m["type"] == "relation" and m["ref"] not in seen
          ]
    todo = sorted(set(todo))
  old = json.loads(
    gzip.decompress(
      (
        ROOT / "geo_data/regierungsviertel/region-outlines-v200-source.json.gz"
      ).read_bytes()
    )
  )
  for data in capture.many(
    [f"way/{rid}/full.json" for rid in old["a10EndpointRecoveredWays"]]
  ):
    for element in data["elements"]:
      elements[element["type"], element["id"]] = element
  groups = defaultdict(list)
  for node in elements.values():
    if (
      node["type"] == "node"
      and node.get("tags", {}).get("highway") == "motorway_junction"
    ):
      groups[node["tags"].get("name", f"node-{node['id']}")].append(node)
  boxes = []
  for name, nodes in groups.items():
    pad = 0.012 if any(v in name for v in ["Dreieck", "Kreuz", "Spandau"]) else 0.007
    boxes.append(
      (
        name,
        [
          min(n["lon"] for n in nodes) - pad,
          min(n["lat"] for n in nodes) - pad * 0.65,
          max(n["lon"] for n in nodes) + pad,
          max(n["lat"] for n in nodes) + pad * 0.65,
        ],
      )
    )
  local_roads = {}
  paths = ["map.json?bbox=" + ",".join(f"{v:.6f}" for v in bbox) for _, bbox in boxes]
  for data in capture.many(paths):
    ways = [
      e
      for e in data["elements"]
      if e["type"] == "way" and e.get("tags", {}).get("highway") in KINDS
    ]
    way_ids = {w["id"] for w in ways}
    nodes = {n for way in ways for n in way["nodes"]}
    for element in data["elements"]:
      if element["type"] == "way" and "highway" in element.get("tags", {}):
        local_roads[element["id"]] = element
      if (element["type"] == "way" and element["id"] in way_ids) or (
        element["type"] == "node" and element["id"] in nodes
      ):
        elements[element["type"], element["id"]] = element
  for element in elements.values():
    if element["type"] == "way":
      local_roads[element["id"]] = element
  witnesses = []
  for _round in range(8):
    by_node = defaultdict(set)
    for way in local_roads.values():
      for node in way["nodes"]:
        by_node[node].add(way["id"])
    unresolved = sorted(
      {
        node
        for e in elements.values()
        if e["type"] == "way" and e.get("tags", {}).get("highway", "").endswith("_link")
        for node in (e["nodes"][0], e["nodes"][-1])
        if len(by_node[node]) == 1
      }
    )
    missing = set()
    for node, data in zip(
      unresolved, capture.many([f"node/{n}/ways.json" for n in unresolved])
    ):
      ways = [
        e
        for e in data["elements"]
        if e["type"] == "way" and "highway" in e.get("tags", {})
      ]
      witnesses.append(dict(node=node, ways=ways))
      for way in ways:
        local_roads[way["id"]] = way
        if way["tags"]["highway"] in KINDS and ("way", way["id"]) not in elements:
          missing.add(way["id"])
    if not missing:
      break
    assert len(missing) < 100, "Capture would exceed the finite junction audit"
    for data in capture.many([f"way/{rid}/full.json" for rid in sorted(missing)]):
      for element in data["elements"]:
        elements[element["type"], element["id"]] = element
        if element["type"] == "way":
          local_roads[element["id"]] = element
  else:
    raise RuntimeError("Junction endpoint audit did not converge")
  by_node = defaultdict(list)
  for way in local_roads.values():
    for node in way["nodes"]:
      by_node[node].append(dict(id=f"way/{way['id']}", highway=way["tags"]["highway"]))
  endpoints = [
    dict(
      id=f"way/{way['id']}",
      node=node,
      connections=[w for w in by_node[node] if w["id"] != f"way/{way['id']}"],
    )
    for way in elements.values()
    if way["type"] == "way" and way.get("tags", {}).get("highway", "").endswith("_link")
    for node in (way["nodes"][0], way["nodes"][-1])
  ]
  assert all(row["connections"] for row in endpoints), "Unresolved ramp endpoint"
  out = dict(
    schemaVersion=1,
    retrievedDate="2026-11-15",
    source="OSM official API, ODbL1.0",
    junctionBoxes=boxes,
    endpointWitnesses=witnesses,
    rampEndpoints=endpoints,
    elements=list(elements.values()),
  )
  (output / "a10-assembled-current.json.gz").write_bytes(
    gzip.compress(json.dumps(out, separators=(",", ":")).encode(), mtime=0)
  )
  print(
    "Captured",
    len(elements),
    "transport records; endpoint witnesses",
    len(witnesses),
    flush=True,
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--output", type=Path, required=True)
  fetch(parser.parse_args().output)
